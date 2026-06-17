import { create } from 'zustand';
import * as Y from 'yjs';
import { applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { request } from '../api/http';

// ==========================================
// 1. Yjs 엔진 및 공유 Map 초기화
// ==========================================
const ydoc = new Y.Doc();
const ynodesMap = ydoc.getMap('nodes');
const yedgesMap = ydoc.getMap('edges');

let ws = null;
let syncDebounceTimer = null;

export const useCanvasStore = create((set, get) => ({
    // 프로젝트 기본 상태
    projectName: '',
    currentProjectId: null,
    currentVersion: 'live',
    userRole: 'GUEST', // 기본 권한은 가장 안전한 GUEST로 설정
    availableVersions: [],

    // React Flow 렌더링용 배열 상태
    nodes: [],
    edges: [],

    // UI 선택 상태
    selectedNodeId: null,
    selectedEdgeId: null,

    setProjectName: (name) => set({ projectName: name }),

    setSelectedNodeId: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
    setSelectedEdgeId: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

    // ==========================================
    // 2. 웹소켓 및 실시간 동기화 (Yjs)
    // ==========================================
    initWebSocket: (projectId, token, role) => {
        set({ currentProjectId: projectId, userRole: role });

        if (ws) {
            ws.close();
        }

        // 서버 환경에 맞춰 URL 수정 (예: process.env.REACT_APP_WS_URL)
        const targetUrl = `ws://localhost:8080/ws/crdt/${projectId}?token=${token}`;

        ws = new WebSocket(targetUrl);
        ws.binaryType = 'arraybuffer'; // Yjs 바이너리 통신을 위해 필수

        ws.onopen = () => {
            console.log(`📡 웹소켓 연결 완료: 프로젝트 ID = ${projectId}, 내 권한 = ${role}`);
        };

        ws.onmessage = (event) => {
            // 다른 유저가 변경한 바이너리 데이터를 받아 Yjs 문서에 적용
            const update = new Uint8Array(event.data);
            Y.applyUpdate(ydoc, update, 'remote'); // 무한 루프 방지를 위해 origin을 'remote'로 설정
        };

        ws.onclose = () => {
            console.log('웹소켓 연결이 종료되었습니다.');
        };

        // Yjs 문서(ydoc)에 변경이 발생할 때마다 실행됨 (로컬/원격 모두 포함)
        ydoc.on('update', (update, origin) => {
            // 내가 변경한 것('local')이면 웹소켓을 통해 서버로 전송하여 브로드캐스트
            if (origin !== 'remote' && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(update);
            }

            // Yjs Map 데이터를 React Flow가 읽을 수 있는 배열로 변환하여 상태 갱신
            const currentNodes = Array.from(ynodesMap.values());
            const currentEdges = Array.from(yedgesMap.values());

            set({ nodes: currentNodes, edges: currentEdges });

            // [핵심] 편집 권한이 있는 경우, 3초 동안 입력이 없으면 백엔드 DB(Block, Edge 테이블)에 UPSERT
            if (get().userRole !== 'GUEST') {
                clearTimeout(syncDebounceTimer);
                syncDebounceTimer = setTimeout(() => {
                    get().saveProjectToServer();
                }, 3000);
            }
        });
    },

    disconnectWebSocket: () => {
        if (ws) {
            ws.close();
            ws = null;
        }
    },

    resetProject: () => {
        localStorage.removeItem('canvas-storage');
        if (ws) {
            ws.close();
            ws = null;
        }
        // 로컬 데이터 완전 초기화
        ydoc.transact(() => {
            ynodesMap.clear();
            yedgesMap.clear();
        }, 'local');

        set({
            currentProjectId: null,
            projectName: '',
            userRole: 'GUEST',
            availableVersions: [],
            nodes: [],
            edges: [],
            selectedNodeId: null,
            selectedEdgeId: null,
        });
    },

    // ==========================================
    // 3. React Flow 인터랙션 제어 (Yjs 연동)
    // ==========================================
    onNodesChange: (changes) => {
        if (get().userRole === 'GUEST') return; // GUEST는 조작 불가

        ydoc.transact(() => {
            const currentNodes = Array.from(ynodesMap.values());
            const nextNodes = applyNodeChanges(changes, currentNodes);

            changes.forEach((change) => {
                if (change.type === 'remove') {
                    ynodesMap.delete(change.id);
                }
            });

            nextNodes.forEach((node) => {
                ynodesMap.set(node.id, node);
            });
        }, 'local');
    },

    onEdgesChange: (changes) => {
        if (get().userRole === 'GUEST') return;

        ydoc.transact(() => {
            const currentEdges = Array.from(yedgesMap.values());
            const nextEdges = applyEdgeChanges(changes, currentEdges);

            changes.forEach((change) => {
                if (change.type === 'remove') {
                    yedgesMap.delete(change.id);
                }
            });

            nextEdges.forEach((edge) => {
                yedgesMap.set(edge.id, edge);
            });
        }, 'local');
    },

    onConnect: (params) => {
        if (get().userRole === 'GUEST') return;

        ydoc.transact(() => {
            const safeParams = {
                ...params,
                sourceHandle: params.sourceHandle || 'bottom',
                targetHandle: params.targetHandle || 'top'
            };

            const existingEdgeKey = Array.from(yedgesMap.keys()).find((key) => {
                const e = yedgesMap.get(key);
                return e.source === safeParams.source && e.target === safeParams.target;
            });

            if (existingEdgeKey) {
                const existingEdge = yedgesMap.get(existingEdgeKey);
                const currentCount = existingEdge.data?.badgeCount || 1;
                yedgesMap.set(existingEdgeKey, {
                    ...existingEdge,
                    sourceHandle: safeParams.sourceHandle,
                    targetHandle: safeParams.targetHandle,
                    data: { ...existingEdge.data, badgeCount: currentCount + 1 }
                });
            } else {
                const edgeId = `edge_${Date.now()}`;
                const newEdge = {
                    ...safeParams,
                    id: edgeId,
                    type: 'custom',
                    zIndex: 9999,
                    data: { type: 'call', badgeCount: 1 }
                };
                yedgesMap.set(edgeId, newEdge);
            }
        }, 'local');
    },

    addNode: (newNode) => {
        if (get().userRole === 'GUEST') return;
        ydoc.transact(() => {
            ynodesMap.set(newNode.id, newNode);
        }, 'local');
    },

    updateNodeData: (nodeId, newData) => {
        if (get().userRole === 'GUEST') return;
        ydoc.transact(() => {
            const node = ynodesMap.get(nodeId);
            if (node) {
                const updatedData = { ...node.data, ...newData };
                if (newData.name) updatedData.label = newData.name;
                if (newData.label) updatedData.name = newData.label;
                ynodesMap.set(nodeId, { ...node, data: updatedData });
            }
        }, 'local');
    },

    updateEdgeData: (edgeId, newData) => {
        if (get().userRole === 'GUEST') return;
        ydoc.transact(() => {
            const edge = yedgesMap.get(edgeId);
            if (edge) {
                yedgesMap.set(edgeId, { ...edge, data: { ...edge.data, ...newData } });
            }
        }, 'local');
    },

    // Yjs 트랜잭션을 이용한 안전한 노드 삭제 기능
    deleteNode: (nodeId) => {
        if (get().userRole === 'GUEST') return;
        ydoc.transact(() => {
            ynodesMap.delete(nodeId);
            // 노드가 삭제될 때 연결되어 있던 선(Edge)들도 함께 찾아서 삭제
            const connectedEdges = Array.from(yedgesMap.values()).filter(
                e => e.source === nodeId || e.target === nodeId
            );
            connectedEdges.forEach(e => yedgesMap.delete(e.id));
        }, 'local');
    },

    // Yjs 트랜잭션을 이용한 안전한 엣지 삭제 기능
    deleteEdge: (edgeId) => {
        if (get().userRole === 'GUEST') return;
        ydoc.transact(() => {
            yedgesMap.delete(edgeId);
        }, 'local');
    },

    // ==========================================
    // 4. 서버 API 연동 (불러오기, 저장, 버전 관리)
    // ==========================================
    loadVersionsFromServer: async (projectId) => {
        try {
            const versions = await request(`/projects/${projectId}/canvas/versions`, { method: "GET" });
            set({ availableVersions: versions || [] });
        } catch (error) {
            console.error("버전 목록 로드 실패:", error);
        }
    },

    loadProjectFromServer: async (projectId, versionNumber = null) => {
        console.log("A. loadProjectFromServer 호출됨! 프로젝트 ID:", projectId);
        try {
            const url = versionNumber
                ? `/projects/${projectId}/canvas?version=${versionNumber}`
                : `/projects/${projectId}/canvas`;
            console.log("B. API 요청 URL:", url);

            const data = await request(url, { method: "GET" });
            console.log("C. 백엔드에서 받은 데이터:", data);

            // 서버에서 받아온 초기 데이터를 Yjs 문서에 덮어씌움
            ydoc.transact(() => {
                ynodesMap.clear();
                yedgesMap.clear();

                (data.blocks || []).forEach(block => {
                    let nodeClass = 'canvas-node method-node';
                    let initialWidth = 150, initialHeight = 50, zIndex = 30;

                    if (block.type === 'feature') {
                        nodeClass = 'canvas-node feature-node';
                        initialWidth = 400; initialHeight = 300; zIndex = 10;
                    } else if (block.type === 'class') {
                        nodeClass = 'canvas-node class-node';
                        initialWidth = 250; initialHeight = 150; zIndex = 20;
                    }

                    const node = {
                        id: block.frontendId,
                        parentNode: block.parentFrontendId || undefined,
                        type: 'custom',
                        position: { x: block.posX || 0, y: block.posY || 0 },
                        className: nodeClass,
                        style: { width: initialWidth, height: initialHeight, zIndex: zIndex },
                        data: {
                            label: block.name,
                            type: block.type,
                            name: block.name,
                            description: block.description || '',
                            parameters: block.parameters || '',
                            returnType: block.returnType || '',
                            annotations: block.annotations || ''
                        }
                    };
                    ynodesMap.set(node.id, node);
                });

                (data.edges || []).forEach(edge => {
                    const mappedEdge = {
                        id: edge.frontendId,
                        source: edge.sourceFrontendId,
                        target: edge.targetFrontendId,
                        sourceHandle: edge.sourceHandle || null,
                        targetHandle: edge.targetHandle || null,
                        type: 'custom',
                        zIndex: 9999,
                        data: {
                            type: edge.type || 'call',
                            badgeCount: edge.badgeCount || 1
                        }
                    };
                    yedgesMap.set(mappedEdge.id, mappedEdge);
                });
            }, 'remote'); // 초기 로드는 타인에게 브로드캐스트하지 않도록 'remote'로 설정

            set({
                currentProjectId: projectId,
                currentVersion: versionNumber || 'live',
                selectedNodeId: null,
                selectedEdgeId: null
            });

            get().loadVersionsFromServer(projectId);
        } catch (error) {
            console.error("데이터 로드 실패:", error);
            alert("다이어그램 데이터를 불러오지 못했습니다.");
        }
    },

    saveProjectToServer: async () => {
        const state = get();
        const projectId = state.currentProjectId;

        // GUEST는 저장 권한이 없음
        if (!projectId || state.userRole === 'GUEST') return;

        const blocks = state.nodes.map(node => ({
            frontendId: node.id,
            parentFrontendId: node.parentNode || null,
            type: node.data?.type || 'feature',
            name: node.data?.name || node.data?.label || 'Untitled',
            description: node.data?.description || '',
            parameters: node.data?.parameters || null,
            returnType: node.data?.returnType || null,
            annotations: node.data?.annotations || null,
            posX: node.position.x,
            posY: node.position.y,
        }));

        const edges = state.edges.map(edge => ({
            frontendId: edge.id,
            sourceFrontendId: edge.source,
            targetFrontendId: edge.target,
            sourceHandle: edge.sourceHandle || null,
            targetHandle: edge.targetHandle || null,
            type: edge.data?.type || 'call',
            badgeCount: edge.data?.badgeCount || 1,
        }));

        try {
            await request(`/projects/${projectId}/canvas/sync`, {
                method: "POST",
                body: JSON.stringify({ blocks, edges })
            });
            console.log("라이브 데이터 스냅샷 동기화 완료 (UPSERT & is_deleted 마킹)");
        } catch (error) {
            console.error("동기화 오류:", error);
        }
    },

    commitVersionToServer: async (commitMessage = "새로운 버전 저장") => {
        const { currentProjectId, saveProjectToServer, userRole } = get();

        if (!currentProjectId) {
            alert("연결된 프로젝트가 없습니다.");
            return;
        }

        if (userRole === 'GUEST') {
            alert("버전을 저장할 권한이 없습니다.");
            return;
        }

        try {
            // 저장(Commit) 직전에 최신 상태를 강제로 한 번 동기화
            await saveProjectToServer();

            const response = await request(`/projects/${currentProjectId}/canvas/commit`, {
                method: "POST",
                body: JSON.stringify({ commitMessage })
            });

            if (response && response.newVersion) {
                alert(`v${response.newVersion} 버전이 성공적으로 기록(Commit) 되었습니다!`);
                set({ currentVersion: response.newVersion });
                await get().loadVersionsFromServer(currentProjectId);
            }
        } catch (error) {
            console.error("버전 저장(Commit) 실패:", error);
            alert("버전 저장에 실패했습니다.");
        }
    },

    deleteVersionFromServer: async (versionNumber) => {
        const { currentProjectId, availableVersions, loadProjectFromServer, userRole } = get();

        if (!currentProjectId) return;

        // OWNER 권한이 필요한 경우, 여기서 추가 검증 가능
        if (userRole === 'GUEST') {
            alert("버전을 삭제할 권한이 없습니다.");
            return;
        }

        if (!window.confirm(`정말 ${versionNumber} 버전을 삭제하시겠습니까?`)) return;

        try {
            await request(`/projects/${currentProjectId}/canvas?version=${versionNumber}`, {
                method: "DELETE"
            });

            const remainingVersions = availableVersions.filter(v => v.versionNumber !== versionNumber);
            set({ availableVersions: remainingVersions });

            alert(`${versionNumber} 버전이 삭제되었습니다.`);
            await loadProjectFromServer(currentProjectId, null);
        } catch (error) {
            console.error("버전 삭제 실패:", error);
            alert("버전 삭제에 실패했습니다.");
        }
    }
}));