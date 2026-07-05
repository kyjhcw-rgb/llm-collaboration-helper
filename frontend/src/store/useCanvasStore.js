import { create } from 'zustand';
import * as Y from 'yjs';
import { request } from '../api/http';

export const LAYOUT = { HEADER_HEIGHT: 36, PADDING: 16 };

const DEFAULT_SIZES = {
    feature: { w: 400, h: 300 },
    class:   { w: 250, h: 150 },
    method:  { w: 150, h: 50  },
};

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

        let neededW = def.w;
        let neededH = def.h;
        for (const child of children.map(id => nodeMap.get(id)).filter(Boolean)) {
            neededW = Math.max(neededW, child.position.x + (child.style?.width  || 150) + PADDING);
            neededH = Math.max(neededH, child.position.y + (child.style?.height || 50)  + PADDING);
        }

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

        const children = childIds.map(id => nodeMap.get(id)).filter(Boolean);

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

const ydoc = new Y.Doc();
const ynodesMap = ydoc.getMap('nodes');
const yedgesMap = ydoc.getMap('edges');
let ws = null;
let syncDebounceTimer = null;
let ydocUpdateHandler = null;

export const useCanvasStore = create((set, get) => ({
    projectName: '',
    currentProjectId: null,
    currentVersion: 'live',
    userRole: 'GUEST',
    availableVersions: [],

    nodes: [],
    edges: [],

    selectedNodeId: null,
    selectedEdgeId: null,

    setProjectName: (name) => set({ projectName: name }),
    setSelectedNodeId: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
    setSelectedEdgeId: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

    setNodes: (newNodes) => {
        if (get().userRole === 'GUEST' || get().currentVersion !== 'live') return;

        ydoc.transact(() => {
            const currentIds = new Set(newNodes.map(n => n.id));

            // 1. 삭제된 노드가 있을 때만 Yjs에서 제거
            Array.from(ynodesMap.keys()).forEach(id => {
                if (!currentIds.has(id)) ynodesMap.delete(id);
            });

            // 2. selected, dragging 등의 transient UI 상태를 제외한 실제 데이터만 비교 후 업데이트
            newNodes.forEach(n => {
                const existing = ynodesMap.get(n.id);

                if (!existing ||
                    existing.position?.x !== n.position?.x ||
                    existing.position?.y !== n.position?.y ||
                    existing.width !== n.width ||
                    existing.height !== n.height ||
                    existing.parentNode !== n.parentNode ||
                    JSON.stringify(existing.data) !== JSON.stringify(n.data)) {

                    // 🚀 순수 다이어그램 정형 데이터 스냅샷만 선별하여 Yjs 구조 오염 및 패킷 폭풍 차단
                    ynodesMap.set(n.id, {
                        id: n.id,
                        parentNode: n.parentNode,
                        type: n.type,
                        position: n.position,
                        width: n.width,
                        height: n.height,
                        className: n.className,
                        style: n.style,
                        data: n.data
                    });
                }
            });
        }, 'local');
    },

    setEdges: (newEdges) => {
        if (get().userRole === 'GUEST' || get().currentVersion !== 'live') return;

        ydoc.transact(() => {
            const currentIds = new Set(newEdges.map(e => e.id));

            // 1. 삭제된 엣지 제거
            Array.from(yedgesMap.keys()).forEach(id => {
                if (!currentIds.has(id)) yedgesMap.delete(id);
            });

            // 2. 실질적인 관계선 연결 정보 변경 시에만 동기화
            newEdges.forEach(e => {
                const existing = yedgesMap.get(e.id);

                if (!existing ||
                    existing.source !== e.source ||
                    existing.target !== e.target ||
                    existing.sourceHandle !== e.sourceHandle ||
                    existing.targetHandle !== e.targetHandle ||
                    JSON.stringify(existing.data) !== JSON.stringify(e.data)) {

                    yedgesMap.set(e.id, {
                        id: e.id,
                        source: e.source,
                        target: e.target,
                        sourceHandle: e.sourceHandle,
                        targetHandle: e.targetHandle,
                        type: e.type,
                        zIndex: e.zIndex,
                        data: e.data
                    });
                }
            });
        }, 'local');
    },

    initWebSocket: (projectId, token, role) => {
        set({ currentProjectId: projectId, userRole: role });

        if (ws) ws.close();

        if (ydocUpdateHandler) {
            ydoc.off('update', ydocUpdateHandler);
        }

        const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080';
        const targetUrl = `${WS_BASE_URL}/ws/crdt/${projectId}?token=${token}`;
        ws = new WebSocket(targetUrl);
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => console.log(`📡 웹소켓 연결 완료 (권한: ${role})`);

        ws.onmessage = (event) => {
            // 1. 텍스트 메시지(명령어) 수신 감지 및 처리
            if (typeof event.data === 'string') {
                if (event.data === 'FORCE_RELOAD') {
                    console.log("🔄 방장이 다이어그램을 복원했습니다. 화면을 강제로 최신화합니다!");
                    const currentId = get().currentProjectId;
                    if (currentId) {
                        get().loadProjectFromServer(currentId, null);
                    }
                }
                return; // 텍스트 처리 완료 시 함수 종료
            }

            // 2. 바이너리 데이터(Yjs CRDT 상태) 수신 처리
            const update = new Uint8Array(event.data);
            Y.applyUpdate(ydoc, update, 'remote');
        };

        ws.onclose = () => {
            console.log('웹소켓 연결이 종료되었습니다.');
            if (get().currentProjectId !== null && get().currentVersion === 'live') {
                setTimeout(() => {
                    if (get().currentProjectId !== null && get().currentVersion === 'live') {
                        get().initWebSocket(projectId, token, role);
                    }
                }, 3000);
            }
        };

        ydocUpdateHandler = (update, origin) => {
            if (origin !== 'remote' && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(update);
            }

            set({
                nodes: Array.from(ynodesMap.values()),
                edges: Array.from(yedgesMap.values())
            });

            if (get().userRole !== 'GUEST' && origin === 'local' && get().currentVersion === 'live') {
                clearTimeout(syncDebounceTimer);
                syncDebounceTimer = setTimeout(() => {
                    get().saveProjectToServer();
                }, 3000);
            }
        };

        ydoc.on('update', ydocUpdateHandler);
    },

    disconnectWebSocket: () => {
        if (ws) {
            ws.close();
            ws = null;
        }
        if (ydocUpdateHandler) {
            ydoc.off('update', ydocUpdateHandler);
            ydocUpdateHandler = null;
        }
        clearTimeout(syncDebounceTimer);
    },

    resetProject: () => {
        localStorage.removeItem('canvas-storage');
        get().disconnectWebSocket();

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
        if (get().userRole === 'GUEST' || get().currentVersion !== 'live') return;
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
        if (get().userRole === 'GUEST' || get().currentVersion !== 'live') return;
        ydoc.transact(() => {
            const edge = yedgesMap.get(edgeId);
            if (edge) {
                yedgesMap.set(edgeId, { ...edge, data: { ...edge.data, ...newData } });
            }
        }, 'local');
    },

    deleteNode: (nodeId) => {
        if (get().userRole === 'GUEST' || get().currentVersion !== 'live') return;
        ydoc.transact(() => {
            ynodesMap.delete(nodeId);
            const connectedEdges = Array.from(yedgesMap.values()).filter(
                e => e.source === nodeId || e.target === nodeId
            );
            connectedEdges.forEach(e => yedgesMap.delete(e.id));
        }, 'local');
    },

    deleteEdge: (edgeId) => {
        if (get().userRole === 'GUEST' || get().currentVersion !== 'live') return;
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
                let initialWidth = block.width || 150;
                let initialHeight = block.height || 50;
                let zIndex = 30;

                if (block.type === 'feature') {
                    nodeClass = 'canvas-node feature-node';
                    if (!block.width) initialWidth = 400;
                    if (!block.height) initialHeight = 300;
                    zIndex = 10;
                } else if (block.type === 'class') {
                    nodeClass = 'canvas-node class-node';
                    if (!block.width) initialWidth = 250;
                    if (!block.height) initialHeight = 150;
                    zIndex = 20;
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

            ydoc.transact(() => {
                ynodesMap.clear();
                yedgesMap.clear();
                finalNodes.forEach(node => ynodesMap.set(node.id, node));
                edges.forEach(edge => yedgesMap.set(edge.id, edge));
            }, 'remote');

            set({
                currentProjectId: projectId,
                currentVersion: versionNumber || 'live',
                selectedNodeId: null,
                selectedEdgeId: null
            });

            if (versionNumber !== null) {
                get().disconnectWebSocket();
            } else {
                const token = localStorage.getItem("accessToken");
                if (token && !ws) {
                    get().initWebSocket(projectId, token, get().userRole);
                }
            }

            get().loadVersionsFromServer(projectId);
        } catch (error) {
            console.error("데이터 로드 실패:", error);
            alert("다이어그램 데이터를 불러오지 못했습니다.");
        }
    },

    restoreVersionFromServer: async (versionNumber) => {
        const { currentProjectId, userRole } = get();
        if (!currentProjectId) return;
        if (userRole !== 'OWNER') {
            alert("과거 버전으로 복원할 권한이 없습니다. (OWNER 전용)");
            return;
        }

        if (!window.confirm(`정말 v${versionNumber} 버전으로 복원하시겠습니까?\n현재 라이브 상태의 데이터는 모두 덮어씌워지며 복구할 수 없습니다!`)) return;

        try {
            await request(`/projects/${currentProjectId}/canvas/versions/${versionNumber}/restore`, {
                method: "POST",
                body: JSON.stringify({}) // 빈 데이터를 명시적으로 전송하여 에러 방어
            });
            alert(`성공적으로 v${versionNumber} 버전으로 복원되었습니다. 편집을 시작합니다.`);

            // 복원을 누른 방장은 웹소켓이 끊겨있으므로 수동으로 본인 화면을 라이브로 갱신
            await get().loadProjectFromServer(currentProjectId, null);
        } catch (error) {
            console.error("버전 복원 실패:", error);
            alert("버전 복원에 실패했습니다.");
        }
    },

    saveProjectToServer: async () => {
        const state = get();
        const projectId = state.currentProjectId;
        if (!projectId || state.userRole === 'GUEST' || state.currentVersion !== 'live') return;

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
            width: node.width || node.style?.width,
            height: node.height || node.style?.height,
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
        } catch (error) {
            console.error("동기화 오류:", error);
        }
    },

    commitVersionToServer: async (commitMessage = "새로운 버전 저장") => {
        const { currentProjectId, saveProjectToServer, userRole, currentVersion } = get();
        if (!currentProjectId || userRole === 'GUEST' || currentVersion !== 'live') {
            alert("라이브 상태에서만 버전을 저장할 수 있습니다.");
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
                await get().loadVersionsFromServer(currentProjectId);
            }
        } catch (error) {
            console.error("버전 저장 실패:", error);
        }
    },

    deleteVersionFromServer: async (versionNumber) => {
        const { currentProjectId, availableVersions, loadProjectFromServer, userRole } = get();
        if (!currentProjectId || userRole === 'GUEST') return;

        if (!window.confirm(`정말 ${versionNumber} 버전을 삭제하시겠습니까?`)) return;

        try {
            await request(`/projects/${currentProjectId}/canvas?version=${versionNumber}`, { method: "DELETE" });

            const remainingVersions = availableVersions.filter(v => v.versionNumber !== versionNumber);
            set({ availableVersions: remainingVersions });
            alert(`${versionNumber} 버전이 삭제되었습니다.`);

            if(get().currentVersion === versionNumber) {
                await loadProjectFromServer(currentProjectId, null);
            }
        } catch (error) {
            console.error("버전 삭제 실패:", error);
        }
    }
}));