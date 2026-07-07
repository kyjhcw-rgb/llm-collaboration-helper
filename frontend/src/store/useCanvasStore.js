import { mockCanvasResponse } from '../mock/mockCanvasData';

import { create } from 'zustand';
import * as Y from 'yjs';
import { request } from '../api/http'
// import { persist } from 'zustand/middleware';
// import { temporal } from 'zundo';

export const LAYOUT = { HEADER_HEIGHT: 36, PADDING: 16, FEATURE_GAP: 150 };

const DEFAULT_SIZES = {
    feature: { w: 400, h: 300 },
    class:   { w: 250, h: 150 },
    method:  { w: 150, h: 50  },
};

// 표시 전용: Yjs 데이터를 건드리지 않고 set() 직전에 주입.
// feature < class < method 순으로 자식이 부모 위에 렌더링됨.
// 엣지 기본 zIndex(0)보다 높아 블럭이 엣지 앞에 오며, hover 시 엣지(10)가 블럭 위로 올라옴.
const TYPE_ZINDEX = { feature: 1, class: 2, method: 3 };
function injectZIndex(nodes) {
    return nodes.map(n => ({
        ...n,
        style: { ...n.style, zIndex: TYPE_ZINDEX[n.data?.type] ?? 1 }
    }));
}

// feature/class 컨테이너 크기를 자식 bounding box에 맞게 조정.
// 규칙: 아래/오른쪽으로만 확장, position은 절대 수정하지 않음(idempotent).
// method 등 리프 노드는 건드리지 않음(NodeResizer 결과 보존).
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

        const childIds = childrenMap.get(nodeId) || [];
        for (const childId of childIds) processNode(childId);

        const node = nodeMap.get(nodeId);
        if (!node) return;

        // 리프 노드(method 등)는 건드리지 않음 — 사용자 resize 보존
        const nodeType = node.data?.type;
        if (nodeType !== 'feature' && nodeType !== 'class') return;

        const def = DEFAULT_SIZES[nodeType] || { w: 400, h: 300 };

        // 자식 없는 컨테이너는 기본 크기로 복귀
        if (childIds.length === 0) {
            nodeMap.set(nodeId, {
                ...node,
                width: def.w,
                height: def.h,
                style: { ...node.style, width: def.w, height: def.h },
            });
            return;
        }

        // 자식들의 오른쪽/아래쪽 끝을 기준으로 최솟값 계산 (position 불변)
        // width/height를 .width → .style.width → DEFAULT 순으로 참조해 일관성 보장
        let neededW = def.w;
        let neededH = def.h;
        for (const childId of childIds) {
            const child = nodeMap.get(childId);
            if (!child) continue;
            const cw = child.width || child.style?.width || DEFAULT_SIZES[child.data?.type]?.w || 150;
            const ch = child.height || child.style?.height || DEFAULT_SIZES[child.data?.type]?.h || 50;
            neededW = Math.max(neededW, child.position.x + cw + PADDING);
            neededH = Math.max(neededH, child.position.y + ch + PADDING);
        }

        // .width/.height 와 style.width/height 를 항상 동기화:
        // ReactFlow는 ResizeObserver 대신 이 값을 즉시 내부 계산에 사용함
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
    // 고아 노드 방지 로직 (부모가 리스트에 없으면 강제로 의존성 끊기)
    const validNodeIds = new Set(nodes.map(n => n.id));
    const safeNodes = nodes.map(n => (n.parentNode && !validNodeIds.has(n.parentNode)) ? { ...n, parentNode: undefined } : n);

    const nodeMap = new Map(safeNodes.map(n => [n.id, { ...n, style: { ...n.style } }]));
    const childrenMap = new Map();
    for (const node of safeNodes) {
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

                const childType = childNode.data?.type;
                const childX = childType === 'class' ? PADDING + 56 : childType === 'method' ? PADDING + 32 : PADDING + 8;
                nodeMap.set(child.id, { ...childNode, position: { x: childX, y: currentY } });
                neededW = Math.max(neededW, childX + childW + PADDING);
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

    for (const node of safeNodes) processNode(node.id);

    // 최상위 노드(feature 등) 수평 겹침 감지 → FEATURE_GAP으로 자동 배치
    // 겹침 없으면 유저가 직접 배치한 위치 보존
    const { FEATURE_GAP } = LAYOUT;
    const roots = [...nodeMap.values()].filter(n => !n.parentNode);
    let hasHorizOverlap = false;
    outerLoop: for (let i = 0; i < roots.length; i++) {
        for (let j = i + 1; j < roots.length; j++) {
            const a = nodeMap.get(roots[i].id), b = nodeMap.get(roots[j].id);
            const aW = a.width || a.style?.width || DEFAULT_SIZES.feature.w;
            const bW = b.width || b.style?.width || DEFAULT_SIZES.feature.w;
            if (Math.min(a.position.x + aW, b.position.x + bW) - Math.max(a.position.x, b.position.x) > 0) {
                hasHorizOverlap = true;
                break outerLoop;
            }
        }
    }
    if (hasHorizOverlap) {
        const sorted = [...roots].sort((a, b) => a.position.x - b.position.x);
        let curX = 0;
        for (const node of sorted) {
            const n = nodeMap.get(node.id);
            const nW = n.width || n.style?.width || DEFAULT_SIZES.feature.w;
            nodeMap.set(node.id, { ...n, position: { x: curX, y: n.position.y } });
            curX += nW + FEATURE_GAP;
        }
    }

    return [...nodeMap.values()];
}

// RF v11은 nodes 배열 순서대로 positionAbsolute를 누적 계산하므로
// 부모가 자식보다 반드시 앞에 와야 한다. 위상 정렬(DFS).
function sortNodesParentFirst(nodes) {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const sorted = [];
    const visited = new Set();

    function visit(id) {
        if (visited.has(id)) return;
        visited.add(id);
        let node = nodeMap.get(id);
        if (!node) return;

        // [에러 수정] 존재하지 않는 부모를 가리키는 노드가 ReactFlow에 주입되면 화면이 즉시 크래시됨.
        // 이를 방지하기 위해 부모가 맵에 존재하지 않는다면 고아 노드로 만듦.
        if (node.parentNode && !nodeMap.has(node.parentNode)) {
            node = { ...node, parentNode: undefined };
            nodeMap.set(id, node);
        }

        if (node.parentNode) visit(node.parentNode);
        sorted.push(node);
    }
    for (const node of nodes) visit(node.id);
    return sorted;
}

// Yjs Y.Map은 삽입 순서를 보장하지 않고 positionAbsolute도 없으므로
// RF에 넘기기 전에 반드시 직접 계산해서 주입해야 한다.
// RF가 positionAbsolute를 받으면 내부 재계산 없이 그대로 사용한다.
function computePositionAbsolute(nodes) {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const cache = new Map();
    function getAbs(id) {
        if (cache.has(id)) return cache.get(id);
        const node = nodeMap.get(id);
        if (!node) { cache.set(id, { x: 0, y: 0 }); return { x: 0, y: 0 }; }
        const abs = node.parentNode
            ? { x: getAbs(node.parentNode).x + node.position.x, y: getAbs(node.parentNode).y + node.position.y }
            : { x: node.position.x, y: node.position.y };
        cache.set(id, abs);
        return abs;
    }
    return nodes.map(n => ({ ...n, positionAbsolute: getAbs(n.id) }));
}

// 서버 응답 형식({ blocks, edges }) → React Flow 노드/엣지 변환
// loadProjectFromServer 와 loadMockData 양쪽에서 재사용
function parseCanvasData(data) {
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
            style: { width: initialWidth, height: initialHeight, zIndex },
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

    return { nodes, edges };
}

// ==========================================
// Yjs 엔진 및 공유 Map 초기화
// ==========================================
let ydoc = new Y.Doc();
let ynodesMap = ydoc.getMap('nodes');
let yedgesMap = ydoc.getMap('edges');
let ws = null;
let syncDebounceTimer = null;
let ydocUpdateHandler = null; // 추가: 이벤트 리스너 해제를 위한 참조 변수

function resetYjsEnv() {
    if (ydocUpdateHandler) {
        ydoc.off('update', ydocUpdateHandler);
        ydocUpdateHandler = null;
    }
    ydoc = new Y.Doc();
    ynodesMap = ydoc.getMap('nodes');
    yedgesMap = ydoc.getMap('edges');
}

export const useCanvasStore = create((set, get) => ({
    projectName: '',
    currentProjectId: null,
    currentVersion: 'live', // 초기 상태를 'live'로 명확히 지정
    userRole: 'GUEST',
    myUserId: null, // 권한 변경 감지용
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
        if (get().userRole === 'GUEST' || get().currentVersion !== 'live') return;

        // [에러 수정] React Flow가 키보드 삭제 등으로 부모를 삭제했지만 자식을 남겨둔 경우,
        // Yjs에 고아 노드가 들어가는 것을 방지하기 위한 이중 방어 로직
        const currentIds = new Set(newNodes.map(n => n.id));
        const sanitizedNodes = newNodes.map(n => {
            if (n.parentNode && !currentIds.has(n.parentNode)) {
                return { ...n, parentNode: undefined };
            }
            return n;
        });

        ydoc.transact(() => {
            Array.from(ynodesMap.keys()).forEach(id => {
                if (!currentIds.has(id)) ynodesMap.delete(id);
            });
            sanitizedNodes.forEach(n => {
                const existing = ynodesMap.get(n.id);
                // 값이 실제로 변경된 노드만 핀포인트로 Yjs에 업데이트하여 무한 스팸 트래픽 방지
                if (!existing || JSON.stringify(existing) !== JSON.stringify(n)) {
                    ynodesMap.set(n.id, n);
                }
            });
        }, 'local');
    },

    setEdges: (newEdges) => {
        if (get().userRole === 'GUEST' || get().currentVersion !== 'live') return;
        ydoc.transact(() => {
            const currentIds = new Set(newEdges.map(e => e.id));
            Array.from(yedgesMap.keys()).forEach(id => {
                if (!currentIds.has(id)) yedgesMap.delete(id);
            });
            newEdges.forEach(e => {
                const existing = yedgesMap.get(e.id);
                if (!existing || JSON.stringify(existing) !== JSON.stringify(e)) {
                    yedgesMap.set(e.id, e);
                }
            });
        }, 'local');
    },

    initWebSocket: (projectId, token, role, myUserId) => {
        set({ currentProjectId: projectId, userRole: role, myUserId: myUserId });

        if (ws) ws.close();

        // 수정: 기존에 등록된 update 이벤트 리스너가 있다면 제거하여 중복 증식을 막음
        if (ydocUpdateHandler) {
            ydoc.off('update', ydocUpdateHandler);
        }

        const targetUrl = `ws://localhost:8080/ws/crdt/${projectId}?token=${token}`;
        ws = new WebSocket(targetUrl);
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
            console.log('WebSocket Connected');
            // 웹소켓이 열리면 내 Yjs의 전체 히스토리를 쏴주어 다른 팀원과 Causal History를 완벽 병합시킴
            if (get().currentVersion === 'live') {
                ws.send(Y.encodeStateAsUpdate(ydoc));
                // 새로 방에 들어왔음을 알리고, 남들에게 최신 상태를 쏴달라고 Handshake 요청
                ws.send(JSON.stringify({ type: 'REQUEST_SYNC' }));
            }
        };

        ws.onmessage = (event) => {
            if (typeof event.data === 'string') {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'REQUEST_SYNC') {
                        // 다른 팀원이 접속해서 동기화를 요청하면, 내 Yjs 상태를 즉시 쏴서 평행우주를 강제 병합
                        if (get().currentVersion === 'live') {
                            ws.send(Y.encodeStateAsUpdate(ydoc));
                        }
                    } else if (msg.type === 'FORCE_RELOAD') {
                        alert("방장이 다이어그램을 이전 버전으로 복원했습니다! 라이브 도화지를 새로고침합니다.");
                        get().loadProjectFromServer(projectId, null);
                    } else if (msg.type === 'ROLE_UPDATED') {
                        if (msg.userId === get().myUserId) {
                            alert(`방장에 의해 귀하의 권한이 [${msg.newRole === 'MEMBER' ? '편집자(MEMBER)' : '조회자(GUEST)'}]로 변경되었습니다.`);
                            set({ userRole: msg.newRole });
                        }
                    } else if (msg.type === 'KICKED') {
                        alert("방장에 의해 프로젝트에서 내보내졌습니다.");
                        get().disconnectWebSocket();
                        window.location.href = '/projects';
                    }
                } catch(e) {}
                return;
            }

            const update = new Uint8Array(event.data);
            Y.applyUpdate(ydoc, update, 'remote');
        };

        // 추가: 비정상 종료 시 자동 재연결 방어 로직
        ws.onclose = () => {
            if (get().currentProjectId !== null && get().currentVersion === 'live') {
                setTimeout(() => {
                    if (get().currentProjectId !== null && get().currentVersion === 'live') {
                        // 재연결 시 상태에서 최신 권한과 ID 유지
                        get().initWebSocket(projectId, token, get().userRole, get().myUserId);
                    }
                }, 3000);
            }
        };

        // 수정: 익명 함수 대신 기명 함수(핸들러)로 정의하여 등록
        ydocUpdateHandler = (update, origin) => {
            if (origin !== 'remote' && ws && ws.readyState === WebSocket.OPEN && get().currentVersion === 'live') {
                ws.send(update);
            }

            // 모든 노드를 꺼내고, 에러 방지용 Sanitize 후 주입
            const rawNodes = Array.from(ynodesMap.values());
            set({
                nodes: injectZIndex(computePositionAbsolute(sortNodesParentFirst(rawNodes))),
                edges: Array.from(yedgesMap.values())
            });

            if (get().userRole !== 'GUEST' && get().currentVersion === 'live') {
                clearTimeout(syncDebounceTimer);
                syncDebounceTimer = setTimeout(() => {
                    get().saveProjectToServer();
                }, 3000);
            }
        };
        ydoc.on('update', ydocUpdateHandler);
    },

    disconnectWebSocket: () => {
        if (ws) { ws.close(); ws = null; }
        if (ydocUpdateHandler) { ydoc.off('update', ydocUpdateHandler); ydocUpdateHandler = null; }
        clearTimeout(syncDebounceTimer);
    },

    resetProject: () => {
        localStorage.removeItem('canvas-storage');
        get().disconnectWebSocket();
        ydoc.transact(() => { ynodesMap.clear(); yedgesMap.clear(); }, 'local');
        set({ currentProjectId: null, projectName: '', userRole: 'GUEST', availableVersions: [], nodes: [], edges: [], selectedNodeId: null, selectedEdgeId: null });
    },

    updateNodeData: (nodeId, newData) => {
        if (get().userRole === 'GUEST' || get().currentVersion !== 'live') return;
        ydoc.transact(() => {
            const node = ynodesMap.get(nodeId);
            if (node) {
                const updatedData = { ...node.data, ...newData };
                if (newData.name) updatedData.label = newData.name;
                if (newData.label) updatedData.name = newData.label;
                const newNode = { ...node, data: updatedData };

                // 불필요한 트래픽 억제
                if (JSON.stringify(node) !== JSON.stringify(newNode)) {
                    ynodesMap.set(nodeId, newNode);
                }
            }
        }, 'local');
    },

    updateEdgeData: (edgeId, newData) => {
        if (get().userRole === 'GUEST' || get().currentVersion !== 'live') return;
        ydoc.transact(() => {
            const edge = yedgesMap.get(edgeId);
            if (edge) {
                const newEdge = { ...edge, data: { ...edge.data, ...newData } };
                if (JSON.stringify(edge) !== JSON.stringify(newEdge)) yedgesMap.set(edgeId, newEdge);
            }
        }, 'local');
    },

    deleteNode: (nodeId) => {
        if (get().userRole === 'GUEST' || get().currentVersion !== 'live') return;
        ydoc.transact(() => {
            // [에러 수정] 부모 삭제 시 자식 노드까지 연쇄 삭제(Cascading Delete)하여 고아 노드 남김 방지
            const nodesToDelete = new Set([nodeId]);
            let isAdding = true;

            while(isAdding) {
                isAdding = false;
                for (const node of ynodesMap.values()) {
                    if (node.parentNode && nodesToDelete.has(node.parentNode) && !nodesToDelete.has(node.id)) {
                        nodesToDelete.add(node.id);
                        isAdding = true;
                    }
                }
            }

            nodesToDelete.forEach(id => {
                ynodesMap.delete(id);
                // 연결된 Edge도 삭제
                const connectedEdges = Array.from(yedgesMap.values()).filter(e => e.source === id || e.target === id);
                connectedEdges.forEach(e => yedgesMap.delete(e.id));
            });
        }, 'local');
    },

    deleteEdge: (edgeId) => {
        if (get().userRole === 'GUEST' || get().currentVersion !== 'live') return;
        ydoc.transact(() => { yedgesMap.delete(edgeId); }, 'local');
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
            // 과거 버전 조회 시 읽기 전용 모드로 전환 (웹소켓 연결 해제)
            if (versionNumber) {
                get().disconnectWebSocket();
            }

            const url = versionNumber
                ? `/projects/${projectId}/canvas?version=${versionNumber}`
                : `/projects/${projectId}/canvas`;
            const data = await request(url, { method: "GET" });

            const { nodes, edges } = parseCanvasData(data);
            const finalNodes = sortNodesParentFirst(fixOverlapsAndRecalculate(nodes));

            // 완전히 깨끗한 Yjs 문서로 갈아끼움
            resetYjsEnv();

            ydoc.transact(() => {
                finalNodes.forEach(node => ynodesMap.set(node.id, node));
                edges.forEach(edge => yedgesMap.set(edge.id, edge));
            }, 'local');

            const rawNodes = Array.from(ynodesMap.values());
            const displayNodes = injectZIndex(computePositionAbsolute(sortNodesParentFirst(rawNodes)));
            const displayEdges = Array.from(yedgesMap.values());

            set({
                currentProjectId: projectId,
                currentVersion: versionNumber || 'live',
                selectedNodeId: null,
                selectedEdgeId: null,
                nodes: displayNodes, // 화면 강제 갱신
                edges: displayEdges  // 화면 강제 갱신
            });

            // 다시 Live로 돌아왔을 때 웹소켓 재연결
            if (!versionNumber && !ws && get().currentProjectId) {
                const token = localStorage.getItem("accessToken");
                if (token) get().initWebSocket(projectId, token, get().userRole, get().myUserId);
            }

            get().loadVersionsFromServer(projectId);
        } catch (error) {
            console.error("데이터 로드 실패:", error);
            alert("다이어그램 데이터를 불러오지 못했습니다.");
        }
    },

    loadMockData: () => {
        // initWebSocket을 거치지 않으므로 ydocUpdateHandler가 없음.
        // WebSocket 없이 Yjs → React 상태만 동기화하는 최소 핸들러를 직접 등록.
        if (ydocUpdateHandler) ydoc.off('update', ydocUpdateHandler);
        ydocUpdateHandler = () => {
            set({
                nodes: injectZIndex(computePositionAbsolute(sortNodesParentFirst(Array.from(ynodesMap.values())))),
                edges: Array.from(yedgesMap.values())
            });
        };
        ydoc.on('update', ydocUpdateHandler);

        const { nodes, edges } = parseCanvasData(mockCanvasResponse);
        const finalNodes = sortNodesParentFirst(fixOverlapsAndRecalculate(nodes));

        ydoc.transact(() => {
            ynodesMap.clear();
            yedgesMap.clear();
            finalNodes.forEach(node => ynodesMap.set(node.id, node));
            edges.forEach(edge => yedgesMap.set(edge.id, edge));
        }, 'remote');

        set({
            currentProjectId: 'mock-project',
            currentVersion: 'live',
            userRole: 'OWNER',
            availableVersions: [],
            selectedNodeId: null,
            selectedEdgeId: null
        });

    },

    // 자동 스냅샷 병합 및 DB 청소 요청 추가
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
            posX: parseFloat(node.position.x || 0),
            posY: parseFloat(node.position.y || 0),
            width: parseFloat(node.width || node.style?.width || DEFAULT_SIZES[node.data?.type]?.w || 150),
            height: parseFloat(node.height || node.style?.height || DEFAULT_SIZES[node.data?.type]?.h || 50)
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

    // 영구 버전 삭제 추가
    commitVersionToServer: async (commitMessage = "새로운 버전 저장") => {
        const { currentProjectId, saveProjectToServer, userRole, currentVersion } = get();
        if (!currentProjectId || userRole === 'GUEST' || currentVersion !== 'live') {
            alert("라이브 상태의 편집 권한이 있어야만 커밋할 수 있습니다.");
            return;
        }

        try {
            await saveProjectToServer(); // 찰나의 누락된 데이터 억지로 동기화
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

    // 방장의 라이브 복원 요청
    restoreProjectFromServer: async (versionNumber) => {
        const { currentProjectId, userRole } = get();
        if (!currentProjectId || userRole !== 'OWNER') {
            alert("방장만 버전을 복원할 수 있습니다.");
            return;
        }

        try {
            await request(`/projects/${currentProjectId}/canvas/versions/${versionNumber}/restore`, {
                method: "POST"
            });
            // 복원에 성공하면 백엔드가 FORCE_RELOAD 웹소켓을 모두에게 뿌리므로, 방장 본인도 onmessage에서 새로고침 됨.
        } catch (error) {
            console.error("복원 에러:", error);
            alert("버전 복원에 실패했습니다.");
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