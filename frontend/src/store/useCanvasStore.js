import { create } from 'zustand';
import * as Y from 'yjs';
import { request } from '../api/http'
// import { persist } from 'zustand/middleware';
// import { temporal } from 'zundo';

export const LAYOUT = { HEADER_HEIGHT: 36, PADDING: 16 };

const DEFAULT_SIZES = {
    feature: { w: 400, h: 300 },
    class:   { w: 250, h: 150 },
    method:  { w: 150, h: 50  },
};

// 자식 블록이 부모 경계를 넘을 때만 부모를 키우고,
// 자식이 빠지면 type 기본 크기로 복귀 (강제 스택 없음 — 자유 배치 유지)
export function recalculateContainerSizes(nodes) {
    const nodeMap = new Map(nodes.map(n => [n.id, { ...n, style: { ...n.style } }]));
    const childrenMap = new Map();
    for (const node of nodes) {
        if (node.parentNode) {
            if (!childrenMap.has(node.parentNode)) childrenMap.set(node.parentNode, []);
            childrenMap.get(node.parentNode).push(node.id);
        }
    }

    const processed = new Set();
    const { PADDING } = LAYOUT;

    function processNode(nodeId) {
        if (processed.has(nodeId)) return;
        processed.add(nodeId);

        const children = childrenMap.get(nodeId) || [];
        for (const childId of children) processNode(childId);

        const node = nodeMap.get(nodeId);
        if (!node) return;

        const def = DEFAULT_SIZES[node.data?.type] || { w: 400, h: 300 };

        // 자식 없으면 기본 크기로 복귀, 있으면 자식 위치/크기 기준으로 최솟값 계산
        let neededW = def.w;
        let neededH = def.h;
        for (const child of children.map(id => nodeMap.get(id)).filter(Boolean)) {
            neededW = Math.max(neededW, child.position.x + (child.style?.width  || 150) + PADDING);
            neededH = Math.max(neededH, child.position.y + (child.style?.height || 50)  + PADDING);
        }

        // width/height 최상위 프로퍼티도 함께 설정:
        // ReactFlow는 DOM 측정(ResizeObserver) 대신 이 값을 즉시 내부 계산에 사용하므로
        // style.height만 바꾸면 생기는 1프레임 지연으로 인한 자식 좌표 오류를 방지함
        nodeMap.set(nodeId, {
            ...node,
            width: neededW,
            height: neededH,
            style: { ...node.style, width: neededW, height: neededH },
        });
    }

    for (const node of nodes) processNode(node.id);
    return [...nodeMap.values()];
}

// 서버 로드 전용: 겹치는 형제 노드를 수직 재배치 후 컨테이너 크기 계산
// - 겹침 감지: LLM이 여러 블록을 같은 y에 생성한 경우 → 자동 재배치
// - 겹침 없음: 유저가 직접 배치한 커스텀 위치 → 보존 (크기만 재계산)
function fixOverlapsAndRecalculate(nodes) {
    const nodeMap = new Map(nodes.map(n => [n.id, { ...n, style: { ...n.style } }]));
    const childrenMap = new Map();

    for (const node of nodes) {
        if (node.parentNode) {
            if (!childrenMap.has(node.parentNode)) childrenMap.set(node.parentNode, []);
            childrenMap.get(node.parentNode).push(node.id);
        }
    }

    const processed = new Set();
    const { HEADER_HEIGHT, PADDING } = LAYOUT;

    function processNode(nodeId) {
        if (processed.has(nodeId)) return;
        processed.add(nodeId);

        const childIds = childrenMap.get(nodeId) || [];
        for (const childId of childIds) processNode(childId);

        const node = nodeMap.get(nodeId);
        if (!node) return;

        const def = DEFAULT_SIZES[node.data?.type] || { w: 400, h: 300 };

        if (childIds.length === 0) {
            nodeMap.set(nodeId, { ...node, width: def.w, height: def.h, style: { ...node.style, width: def.w, height: def.h } });
            return;
        }

        // 자식들의 최신 상태 수집 (재귀 처리 후 갱신된 높이 포함)
        const children = childIds.map(id => nodeMap.get(id)).filter(Boolean);

        // 형제 노드 간 수직 겹침 감지 (LLM이 같은 y에 여러 블록을 놓은 경우)
        let hasOverlap = false;
        outer: for (let i = 0; i < children.length; i++) {
            for (let j = i + 1; j < children.length; j++) {
                const a = children[i], b = children[j];
                const aH = a.style?.height || DEFAULT_SIZES[a.data?.type]?.h || 50;
                const bH = b.style?.height || DEFAULT_SIZES[b.data?.type]?.h || 50;
                if (a.position.y < b.position.y + bH && a.position.y + aH > b.position.y) {
                    hasOverlap = true;
                    break outer;
                }
            }
        }

        let neededW = def.w;
        let neededH = def.h;

        if (hasOverlap) {
            // 원래 posY 기준으로 정렬 후 수직 재배치 (LLM 의도한 순서 최대한 보존)
            const sorted = [...children].sort((a, b) => a.position.y - b.position.y);
            let currentY = HEADER_HEIGHT + 8;

            for (const child of sorted) {
                const childNode = nodeMap.get(child.id);
                const childDef = DEFAULT_SIZES[childNode.data?.type] || { w: 150, h: 50 };
                const childH = childNode.style?.height || childDef.h;
                const childW = childNode.style?.width || childDef.w;

                nodeMap.set(child.id, { ...childNode, position: { x: PADDING, y: currentY } });
                neededW = Math.max(neededW, PADDING + childW + PADDING);
                currentY += childH + PADDING;
            }
            neededH = Math.max(def.h, currentY);
        } else {
            // 겹침 없음: 유저 배치 위치 유지, 크기만 계산
            for (const child of children) {
                const childDef = DEFAULT_SIZES[child.data?.type] || { w: 150, h: 50 };
                neededW = Math.max(neededW, child.position.x + (child.style?.width || childDef.w) + PADDING);
                neededH = Math.max(neededH, child.position.y + (child.style?.height || childDef.h) + PADDING);
            }
        }

        nodeMap.set(nodeId, { ...node, width: neededW, height: neededH, style: { ...node.style, width: neededW, height: neededH } });
    }

    for (const node of nodes) processNode(node.id);
    return [...nodeMap.values()];
}

// ==========================================
// Yjs 엔진 및 공유 Map 초기화
// ==========================================
const ydoc = new Y.Doc();
const ynodesMap = ydoc.getMap('nodes');
const yedgesMap = ydoc.getMap('edges');
let ws = null;
let syncDebounceTimer = null;

export const useCanvasStore = create((set, get) => ({
    projectName: '',
    currentProjectId: null,
    currentVersion: 'live', // 초기 상태를 'live'로 명확히 지정
    userRole: 'GUEST',
    availableVersions: [], // { versionNumber, commitMessage, createdAt } 객체 배열

    nodes: [],
    edges: [],

    selectedNodeId: null,
    selectedEdgeId: null,

    setProjectName: (name) => set({ projectName: name }),
    setSelectedNodeId: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
    setSelectedEdgeId: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

    // 💡 Yjs 동기화를 위해 노드와 엣지를 설정하는 핵심 메서드
    setNodes: (newNodes) => {
        if (get().userRole === 'GUEST') return;
        ydoc.transact(() => {
            const currentIds = new Set(newNodes.map(n => n.id));
            Array.from(ynodesMap.keys()).forEach(id => {
                if (!currentIds.has(id)) ynodesMap.delete(id);
            });
            newNodes.forEach(n => ynodesMap.set(n.id, n));
        }, 'local');
    },

    setEdges: (newEdges) => {
        if (get().userRole === 'GUEST') return;
        ydoc.transact(() => {
            const currentIds = new Set(newEdges.map(e => e.id));
            Array.from(yedgesMap.keys()).forEach(id => {
                if (!currentIds.has(id)) yedgesMap.delete(id);
            });
            newEdges.forEach(e => yedgesMap.set(e.id, e));
        }, 'local');
    },

    initWebSocket: (projectId, token, role) => {
        set({ currentProjectId: projectId, userRole: role });

        if (ws) ws.close();

        const targetUrl = `ws://localhost:8080/ws/crdt/${projectId}?token=${token}`;
        ws = new WebSocket(targetUrl);
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => console.log(`📡 웹소켓 연결 완료: 프로젝트 ID = ${projectId}, 내 권한 = ${role}`);

        ws.onmessage = (event) => {
            const update = new Uint8Array(event.data);
            Y.applyUpdate(ydoc, update, 'remote');
        };

        ws.onclose = () => console.log('웹소켓 연결이 종료되었습니다.');

        ydoc.on('update', (update, origin) => {
            if (origin !== 'remote' && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(update);
            }

            set({
                nodes: Array.from(ynodesMap.values()),
                edges: Array.from(yedgesMap.values())
            });

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

    deleteNode: (nodeId) => {
        if (get().userRole === 'GUEST') return;
        ydoc.transact(() => {
            ynodesMap.delete(nodeId);
            const connectedEdges = Array.from(yedgesMap.values()).filter(
                e => e.source === nodeId || e.target === nodeId
            );
            connectedEdges.forEach(e => yedgesMap.delete(e.id));
        }, 'local');
    },

    deleteEdge: (edgeId) => {
        if (get().userRole === 'GUEST') return;
        ydoc.transact(() => {
            yedgesMap.delete(edgeId);
        }, 'local');
    },

    loadVersionsFromServer: async (projectId) => {
        try {
            const versions = await request(`/projects/${projectId}/canvas/versions`, { method: "GET" });
            set({ availableVersions: versions || [] });
        } catch (error) {
            console.error("버전 목록 로드 실패:", error);
        }
    },

    loadProjectFromServer: async (projectId, versionNumber = null) => {
        try {
            const url = versionNumber
                ? `/projects/${projectId}/canvas?version=${versionNumber}`
                : `/projects/${projectId}/canvas`;

            const data = await request(url, { method: "GET" });

            const nodes = (data.blocks || []).map(block => {
                let nodeClass = 'canvas-node method-node';
                let initialWidth = 150, initialHeight = 50, zIndex = 30;

                if (block.type === 'feature') {
                    nodeClass = 'canvas-node feature-node';
                    initialWidth = 400; initialHeight = 300; zIndex = 10;
                } else if (block.type === 'class') {
                    nodeClass = 'canvas-node class-node';
                    initialWidth = 250; initialHeight = 150; zIndex = 20;
                }

                return {
                    id: block.frontendId,
                    parentNode: block.parentFrontendId || undefined,
                    type: 'custom',
                    position: { x: block.posX || 0, y: block.posY || 0 },
                    width: initialWidth,
                    height: initialHeight,
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
            });

            const edges = (data.edges || []).map(edge => ({
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
            }));

            const finalNodes = fixOverlapsAndRecalculate(nodes);

            // 초기 로드는 다른 사람에게 뿌리지 않도록 remote 트랜잭션 사용
            ydoc.transact(() => {
                ynodesMap.clear();
                yedgesMap.clear();
                finalNodes.forEach(node => ynodesMap.set(node.id, node));
                edges.forEach(edge => yedgesMap.set(edge.id, edge));
            }, 'remote');

            set({
                currentProjectId: projectId,
                // 백엔드 응답에서 버전 번호가 안 오므로, 넘겨받은 파라미터를 그대로 사용해 상태 유지
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
            console.log("라이브 데이터 스냅샷 동기화 완료");
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