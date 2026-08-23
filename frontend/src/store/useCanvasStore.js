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

// 표시 전용: 엣지 연결 개수를 4분위(1~4)로 나눠 상위 블록을 강조.
// data.connectionTier/connectionCount는 stripUIProps에서 반드시 제거해야
// Yjs 맵에 표시 전용 값이 섞여 들어가지 않는다 (zIndex와 동일한 이유).
function injectConnectionHighlight(nodes, edges) {
    const degree = new Map(nodes.map(n => [n.id, 0]));
    edges.forEach(e => {
        if (degree.has(e.source)) degree.set(e.source, degree.get(e.source) + 1);
        if (degree.has(e.target)) degree.set(e.target, degree.get(e.target) + 1);
    });

    const sortedCounts = Array.from(degree.values()).sort((a, b) => a - b);
    const quantileAt = (p) => sortedCounts[Math.min(sortedCounts.length - 1, Math.floor(p * sortedCounts.length))];
    const q1 = quantileAt(0.25), q2 = quantileAt(0.5), q3 = quantileAt(0.75);

    // 연결이 거의 없는 그래프(대부분 0개)에서는 4분위 경계가 전부 0에 붙어버려
    // 엣지 1개짜리 블록까지 "허브"로 잡히는 문제가 있어, 최소 연결 수 하한을 둔다.
    const MIN_HUB_CONNECTIONS = 2;
    const tierOf = (count) => {
        if (count < MIN_HUB_CONNECTIONS) return 1;
        if (count <= q1) return 1;
        if (count <= q2) return 2;
        if (count <= q3) return 3;
        return 4;
    };

    const TIER_BOX_SHADOW = {
        4: '0 0 0 3px #ff4d4f, 0 0 14px 4px rgba(255,77,79,0.55)',
        3: '0 0 0 2px #f5a623',
    };

    return nodes.map(n => {
        const connectionCount = degree.get(n.id) ?? 0;
        const connectionTier = tierOf(connectionCount);
        return {
            ...n,
            data: { ...n.data, connectionCount, connectionTier },
            style: { ...n.style, boxShadow: TIER_BOX_SHADOW[connectionTier] },
        };
    });
}

// React Flow의 UI 전용 상태(선택, 드래그 상태 등)를 제거하여 Yjs 맵을 깨끗하게 유지하고 무한 통신 스팸을 방지
function stripUIProps(node) {
    const { positionAbsolute, selected, dragging, resizing, measured, zIndex, ...cleanNode } = node;
    if (cleanNode.style) {
        const cleanStyle = { ...cleanNode.style };
        delete cleanStyle.zIndex;
        delete cleanStyle.boxShadow;
        cleanNode.style = cleanStyle;
    }
    if (cleanNode.data) {
        const { connectionCount, connectionTier, ...cleanData } = cleanNode.data;
        cleanNode.data = cleanData;
    }
    return cleanNode;
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
                annotations: block.annotations || '',
                lastUpdatedBy: null,
                lastUpdatedAt: null
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
            badgeCount: edge.badgeCount || 1,
            lastUpdatedBy: null,
            lastUpdatedAt: null
        }
    }));

    return { nodes, edges };
}

// Uint8Array <-> Base64 변환 헬퍼 (Yjs 이진 데이터 송수신 용)
function uint8ArrayToBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToUint8Array(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
}

// ==========================================
// Yjs 엔진 및 공유 Map 초기화
// ==========================================
let ydoc = new Y.Doc();
let ynodesMap = ydoc.getMap('nodes');
let yedgesMap = ydoc.getMap('edges');
let undoManager = new Y.UndoManager([ynodesMap, yedgesMap], {
    trackedOrigins: new Set(['local']),
});
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
    undoManager = new Y.UndoManager([ynodesMap, yedgesMap], {
        trackedOrigins: new Set(['local']),
    });
}

export const useCanvasStore = create((set, get) => ({
    projectName: '',
    currentProjectId: null,
    currentVersion: 'live', // 초기 상태를 'live'로 명확히 지정
    userRole: 'GUEST',
    myUserId: null, // 권한 변경 감지용
    projectMembers: [], // 멤버 정보 상태 추가
    onlineUsers: [],
    availableVersions: [], // { versionNumber, commitMessage, createdAt } 객체 배열

    // 6번: 마지막 커밋 이후 바뀐 블록을 표시하기 위한 체크포인트.
    // 블록의 data.lastUpdatedAt이 이 값보다 크면 "커밋 이후 변경됨"으로 간주.
    lastCommitAt: 0,

    nodes: [],
    edges: [],

    selectedNodeId: null,
    selectedEdgeId: null,

    setProjectName: (name) => set({ projectName: name }),
    setSelectedNodeId: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
    setSelectedEdgeId: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

    undo: () => undoManager.undo(),
    redo: () => undoManager.redo(),

    // 💡 Yjs 동기화를 위해 노드와 엣지를 설정하는 핵심 메서드
    // 💡 수정됨: Zustand 로컬 상태를 우선 업데이트하여 UI 반응성 확보
    setNodes: (newNodes) => {
        set({ nodes: newNodes }); // 💡 먼저 로컬 UI 업데이트하여 버벅임/튕김 해결

        if (get().userRole === 'GUEST' || get().currentVersion !== 'live') return;
        const currentIds = new Set(newNodes.map(n => n.id));
        ydoc.transact(() => {
            Array.from(ynodesMap.keys()).forEach(id => {
                if (!currentIds.has(id)) ynodesMap.delete(id);
            });
            newNodes.forEach(n => {
                let cleanNode = stripUIProps(n);
                if (cleanNode.parentNode && !currentIds.has(cleanNode.parentNode)) {
                    cleanNode = { ...cleanNode, parentNode: undefined };
                }
                const existing = ynodesMap.get(cleanNode.id);
                if (!existing || JSON.stringify(existing) !== JSON.stringify(cleanNode)) {
                    ynodesMap.set(cleanNode.id, cleanNode);
                }
            });
        }, 'local');
    },

    setEdges: (newEdges) => {
        set({ edges: newEdges }); // 💡 로컬 UI 우선 업데이트

        if (get().userRole === 'GUEST' || get().currentVersion !== 'live') return;
        ydoc.transact(() => {
            const currentIds = new Set(newEdges.map(e => e.id));
            Array.from(yedgesMap.keys()).forEach(id => {
                if (!currentIds.has(id)) yedgesMap.delete(id);
            });
            newEdges.forEach(e => {
                const cleanEdge = stripUIProps(e);
                const existing = yedgesMap.get(cleanEdge.id);
                if (!existing || JSON.stringify(existing) !== JSON.stringify(cleanEdge)) {
                    yedgesMap.set(cleanEdge.id, cleanEdge);
                }
            });
        }, 'local');
    },

    initWebSocket: (projectId, token, role, myUserId) => {
        set({ currentProjectId: projectId, userRole: role, myUserId: myUserId });

        // React 18 StrictMode로 인해 웹소켓이 두 번 열리는 현상 방지
        if (ws) {
            ws.onclose = null;
            ws.close();
            ws = null;
        }

        // 💡 수정됨: 현재 도메인 환경에 맞추어 동적으로 WebSocket URL 설정
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const currentHost = window.location.host;

        // [수정된 부분] 3000번 포트로 들어와도 백엔드(8080) 웹소켓으로 자동 우회
        const targetHost = (currentHost.includes('localhost:3000') || currentHost.includes('localhost:5173'))
            ? 'localhost:8080'
            : currentHost;

        // [🚨 가장 치명적이었던 변수명 에러 수정 (host -> targetHost)]
        const targetUrl = `${protocol}//${targetHost}/ws/crdt/${projectId}?token=${token}`;

        ws = new WebSocket(targetUrl);
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
            console.log('WebSocket Connected - 서버에 최신 상태를 요청합니다 (REQUEST_SYNC)');

            // 접속 즉시 서버에게 현재까지의 완벽한 Yjs 상태를 요청함
            ws.send(JSON.stringify({
                type: 'REQUEST_SYNC'
            }));
        };

        ws.onmessage = (event) => {
            if (typeof event.data === 'string') {
                try {
                    const msg = JSON.parse(event.data);

                    // 서버가 내려준 스냅샷 + 누적 로그 적용
                    if (msg.type === 'SYNC_STATE') {
                        if (msg.snapshot) {
                            Y.applyUpdate(ydoc, base64ToUint8Array(msg.snapshot), 'remote');
                        }
                        if (msg.logs && msg.logs.length > 0) {
                            msg.logs.forEach(logBase64 => {
                                Y.applyUpdate(ydoc, base64ToUint8Array(logBase64), 'remote');
                            });
                        }
                        console.log('서버로부터 Yjs 통합 상태 동기화 완료!');
                    } else if (msg.type === 'ONLINE_USERS') {
                        // 온라인 유저 목록 수신 시 상태 업데이트
                        set({ onlineUsers: msg.users });
                    } else if (msg.type === 'FORCE_RELOAD') {
                        // 버전 복원, 회의 녹음 반영 등 방장의 여러 액션에서 공통으로 쏘는 이벤트라
                        // 특정 원인을 단정하지 않는 문구를 사용 (실제 원인 구분은 백엔드가 reason을 안 보내줘서 불가)
                        alert("캔버스가 갱신되었습니다. 최신 상태로 동기화합니다.");
                        window.location.reload();
                    } else if (msg.type === 'VERSION_CREATED') {
                        // 방장이 버전을 생성했다는 알림을 받으면, 접속자 모두가 드롭다운 목록을 업데이트
                        get().loadVersionsFromServer(projectId);
                        // 6번: 커밋 체크포인트 갱신 → 이 시점 이전 변경분은 "커밋 이후 변경" 표시에서 빠짐
                        set({ lastCommitAt: Date.now() });
                    } else if (msg.type === 'ROLE_UPDATED') {
                        if (msg.userId === get().myUserId) {
                            alert(`당신의 권한이 [${msg.newRole === 'MEMBER' ? '편집자 (MEMBER)' : '조회자 (GUEST)'}] 로 변경되었습니다.`);
                            set({ userRole: msg.newRole });
                        }
                    } else if (msg.type === 'KICKED') {
                        alert("프로젝트에서 추방되었습니다.");
                        get().disconnectWebSocket();
                        window.location.href = '/projects';
                    } else if (msg.type === 'MENTIONED') {
                        alert(`🔔 ${msg.senderNickname}님이 댓글에서 회원님을 멘션했습니다!`);
                    }
                } catch(e) {}
                return;
            }

            // 실시간 편집으로 발생하는 바이너리 데이터 적용
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

        get().bindYdocUpdateHandler();
    },

    // ydoc이 재생성될 때마다(resetYjsEnv) 반드시 다시 호출해서 로컬 편집 전송/원격 수신 반영/자동저장
    // 파이프라인을 "현재" ydoc에 연결해야 한다. 웹소켓 연결이 이미 열려 있는 상태에서 ydoc만 새로 만들어지는
    // 경우(예: deleteVersionFromServer 이후 라이브 재로드)를 놓치면, initWebSocket이 다시 불리지 않아서
    // 그 세션은 이후 실시간 동기화/자동저장이 조용히 끊긴다.
    bindYdocUpdateHandler: () => {
        if (ydocUpdateHandler) {
            ydoc.off('update', ydocUpdateHandler);
            ydocUpdateHandler = null;
        }

        // 💡 수정됨: Yjs 갱신 시 기존 로컬 UI 상태(selected, measured 등)를 병합하여 UI 튕김 방지
        ydocUpdateHandler = (update, origin) => {
            if (origin !== 'remote' && ws && ws.readyState === WebSocket.OPEN && get().currentVersion === 'live') {
                ws.send(update);
            }

            // 현재 Zustand에 있는 노드의 UI 전용 상태들(선택, 드래그, 크기 정보) 가져오기
            const currentNodes = get().nodes;
            const uiStateMap = new Map(currentNodes.map(n => [n.id, {
                selected: n.selected, dragging: n.dragging, resizing: n.resizing, measured: n.measured
            }]));

            const rawNodes = Array.from(ynodesMap.values()).map(n => {
                const ui = uiStateMap.get(n.id) || {};
                const res = { ...n };
                if (ui.selected !== undefined) res.selected = ui.selected;
                if (ui.dragging !== undefined) res.dragging = ui.dragging;
                if (ui.resizing !== undefined) res.resizing = ui.resizing;
                if (ui.measured !== undefined) res.measured = ui.measured;
                return res;
            });

            const currentEdges = get().edges;
            const edgeUiMap = new Map(currentEdges.map(e => [e.id, { selected: e.selected }]));

            const rawEdges = Array.from(yedgesMap.values()).map(e => {
                const ui = edgeUiMap.get(e.id) || {};
                const res = { ...e };
                if (ui.selected !== undefined) res.selected = ui.selected;
                return res;
            });

            set({
                nodes: injectConnectionHighlight(injectZIndex(computePositionAbsolute(sortNodesParentFirst(rawNodes))), rawEdges),
                edges: rawEdges
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
        if (ws) {
            ws.onclose = null; // 의도적인 종료 시 자동 재연결 이벤트 방지
            ws.close();
            ws = null;
        }
        if (ydocUpdateHandler) { ydoc.off('update', ydocUpdateHandler); ydocUpdateHandler = null; }
        clearTimeout(syncDebounceTimer);
    },

    resetProject: () => {
        localStorage.removeItem('canvas-storage');
        get().disconnectWebSocket();
        resetYjsEnv();
        set({
            currentProjectId: null,
            projectName: '',
            userRole: 'GUEST',
            availableVersions: [],
            nodes: [],
            edges: [],
            selectedNodeId: null,
            selectedEdgeId: null,
            onlineUsers: [],
        });
    },

    updateNodeData: (nodeId, newData) => {
        if (get().userRole === 'GUEST' || get().currentVersion !== 'live') return;

        // 💡 로컬 상태 즉시 반영하여 빠른 피드백 제공
        set(state => ({
            nodes: state.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n)
        }));

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

        // 로컬 엣지 즉시 반영
        set(state => ({
            edges: state.edges.map(e => e.id === edgeId ? { ...e, data: { ...e.data, ...newData } } : e)
        }));

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

        // 화면에서 노드 즉시 제거
        set(state => ({ nodes: state.nodes.filter(n => n.id !== nodeId) }));

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
            const { yjsData } = data;   // 서버에서 전달받은 Base64 Yjs 바이너리

            // Yjs 평행우주 충돌 방지를 위해 REST 로드 시 아예 백지로 갈아끼우기
            resetYjsEnv();

            // Yjs 바이너리 데이터가 있으면 Apply, 없으면 (구버전) 수동 주입
            if (yjsData) {
                const bytes = base64ToUint8Array(yjsData);
                Y.applyUpdate(ydoc, bytes); // CRDT 편집 히스토리 완벽 복원
            } else {
                const finalNodes = sortNodesParentFirst(fixOverlapsAndRecalculate(nodes));
                ydoc.transact(() => {
                    finalNodes.forEach(node => ynodesMap.set(node.id, stripUIProps(node)));
                    edges.forEach(edge => yedgesMap.set(edge.id, stripUIProps(edge)));
                }, 'local');
            }

            const rawNodes = Array.from(ynodesMap.values());
            const displayEdges = Array.from(yedgesMap.values());
            const displayNodes = injectConnectionHighlight(injectZIndex(computePositionAbsolute(sortNodesParentFirst(rawNodes))), displayEdges);

            set({
                currentProjectId: projectId,
                currentVersion: versionNumber || 'live',
                selectedNodeId: null,
                selectedEdgeId: null,
                nodes: displayNodes,
                edges: displayEdges
            });

            // 라이브 화면일 때만: ydoc이 새로 만들어졌으니 반드시 리스너를 다시 연결해야 함
            if (!versionNumber && get().currentProjectId && get().myUserId !== null) {
                if (!ws) {
                    // 웹소켓 자체가 없는 상태(최초 마운트, 혹은 버전 조회 후 라이브 복귀) → 새로 연결
                    const token = localStorage.getItem("accessToken");
                    if (token) get().initWebSocket(projectId, token, get().userRole, get().myUserId);
                } else {
                    // 웹소켓은 이미 연결돼 있지만(예: 버전 삭제 후 재로드) ydoc만 교체된 경우.
                    // initWebSocket을 다시 부르지 않으므로 리스너를 직접 재바인딩해줘야 계속 동기화된다.
                    get().bindYdocUpdateHandler();
                }
            }

            get().loadVersionsFromServer(projectId);
        } catch (error) {
            console.error("데이터 로드 실패:", error);
            alert("다이어그램 데이터를 불러오지 못했습니다.");
        }
    },

    // 💡 mockData도 로직 동일하게 맞춤
    loadMockData: () => {
        if (ydocUpdateHandler) {
            ydoc.off('update', ydocUpdateHandler);
            ydocUpdateHandler = null;
        }
        ydocUpdateHandler = () => {
            const currentNodes = get().nodes;
            const uiStateMap = new Map(currentNodes.map(n => [n.id, { selected: n.selected, dragging: n.dragging, resizing: n.resizing, measured: n.measured }]));
            const rawNodes = Array.from(ynodesMap.values()).map(n => {
                const ui = uiStateMap.get(n.id) || {};
                return { ...n, selected: ui.selected, dragging: ui.dragging, resizing: ui.resizing, measured: ui.measured };
            });
            const currentEdges = get().edges;
            const edgeUiMap = new Map(currentEdges.map(e => [e.id, { selected: e.selected }]));
            const rawEdges = Array.from(yedgesMap.values()).map(e => {
                const ui = edgeUiMap.get(e.id) || {};
                return { ...e, selected: ui.selected };
            });
            set({
                nodes: injectConnectionHighlight(injectZIndex(computePositionAbsolute(sortNodesParentFirst(rawNodes))), rawEdges),
                edges: rawEdges
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
            height: parseFloat(node.height || node.style?.height || DEFAULT_SIZES[node.data?.type]?.h || 50),
            lastUpdatedBy: node.data?.lastUpdatedBy || null
        }));

        const edges = state.edges.map(edge => ({
            frontendId: edge.id,
            sourceFrontendId: edge.source,
            targetFrontendId: edge.target,
            sourceHandle: edge.sourceHandle || null,
            targetHandle: edge.targetHandle || null,
            type: edge.data?.type || 'call',
            badgeCount: edge.data?.badgeCount || 1,
            lastUpdatedBy: edge.data?.lastUpdatedBy || null
        }));

        // 현재 Yjs 전체 상태를 바이너리로 추출하여 Base64 인코딩
        const yjsUpdate = Y.encodeStateAsUpdate(ydoc);
        const yjsDataBase64 = uint8ArrayToBase64(yjsUpdate);

        try {
            await request(`/projects/${projectId}/canvas/sync`, {
                method: "POST",
                body: JSON.stringify({ blocks, edges, yjsData: yjsDataBase64 })
            });
        } catch (error) {
            console.error("동기화 오류:", error);
        }
    },

    // 영구 버전 삭제 추가
    commitVersionToServer: async (commitMessage = "새로운 버전 저장") => {
        const { currentProjectId, saveProjectToServer, userRole, currentVersion } = get();
        // 방장만 버전 생성이 가능하도록 권한 확인 변경
        if (!currentProjectId || userRole !== 'OWNER' || currentVersion !== 'live') {
            alert("방장만 버전을 생성할 수 있습니다.");
            return;
        }

        try {
            await saveProjectToServer(); // 찰나의 누락된 데이터 억지로 동기화
            const response = await request(`/projects/${currentProjectId}/canvas/commit`, {
                method: "POST",
                body: JSON.stringify({ commitMessage })
            });

            if (response && response.newVersion) {
                // [수정된 부분] 과거 버전으로 강제 이동하던 코드 삭제 (계속 Live로 남음)
                alert(`v${response.newVersion} 버전이 성공적으로 저장되었습니다!\n계속해서 Live 상태로 편집을 진행합니다.`);
                // 갱신은 백엔드에서 쏘는 VERSION_CREATED 웹소켓을 통해 자동 처리됨
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
            // 복원 버튼을 누른 방장은 과거 버전 조회 중이어서 웹소켓이 끊겨있음
            // 따라서 본인 스스로 리로드해서 Live 캔버스로 복귀시킴
            // 팀원들은 웹소켓 연결이 되어있으므로 FORCE_RELOAD 신호를 받고 리로드됨
            alert(`v${versionNumber} 상태로 복원되었습니다. Live 캔버스로 이동합니다.`);
            window.location.reload();
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