import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import { request } from '../api/http';

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
    const { HEADER_HEIGHT, PADDING } = LAYOUT;

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

export const useCanvasStore = create(
    persist(
        temporal(
            (set, get) => ({
                projectName: '',
                currentProjectId: null,
                currentVersion: 'live', // 초기 상태를 'live'로 명확히 지정
                availableVersions: [], // { versionNumber, commitMessage, createdAt } 객체 배열

                nodes: [],
                edges: [],

                selectedNodeId: null,
                selectedEdgeId: null,

                setProjectName: (name) => set({ projectName: name }),

                resetProject: () => {
                    localStorage.removeItem('canvas-storage');
                    set({
                        currentProjectId: null,
                        projectName: '',
                        availableVersions: [],
                        nodes: [],
                        edges: [],
                        selectedNodeId: null,
                        selectedEdgeId: null,
                    });
                },

                setSelectedNodeId: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
                setSelectedEdgeId: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

                setNodes: (nodes) => set({ nodes }),
                setEdges: (edges) => set({ edges }),

                updateNodeData: (nodeId, newData) =>
                    set((state) => ({
                        nodes: state.nodes.map((node) => {
                            if (node.id === nodeId) {
                                const updatedData = { ...node.data, ...newData };
                                if (newData.name) updatedData.label = newData.name;
                                if (newData.label) updatedData.name = newData.label;
                                return { ...node, data: updatedData };
                            }
                            return node;
                        }),
                    })),

                updateEdgeData: (edgeId, newData) =>
                    set((state) => ({
                        edges: state.edges.map((edge) => {
                            if (edge.id === edgeId) {
                                return { ...edge, data: { ...edge.data, ...newData } };
                            }
                            return edge;
                        }),
                    })),

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

                        set({
                            currentProjectId: projectId,
                            // 백엔드 응답에서 버전 번호가 안 오므로, 넘겨받은 파라미터를 그대로 사용해 상태 유지
                            currentVersion: versionNumber || 'live',
                            nodes: fixOverlapsAndRecalculate(nodes),
                            edges: edges,
                            selectedNodeId: null,
                            selectedEdgeId: null
                        });

                        get().loadVersionsFromServer(projectId);
                    } catch (error) {
                        console.error("데이터 로드 실패:", error);
                        alert("다이어그램 데이터를 불러오지 못했습니다.");
                    }
                },

                // 1. 단순 라이브 저장 (UPSERT 동기화, 버전 증가는 없음)
                saveProjectToServer: async () => {
                    const state = get();
                    const projectId = state.currentProjectId;
                    if (!projectId) return;

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

                // 2. 버전 박제 (Commit)
                commitVersionToServer: async (commitMessage = "새로운 버전 저장") => {
                    const { currentProjectId, saveProjectToServer, loadVersionsFromServer } = get();
                    if (!currentProjectId) {
                        alert("연결된 프로젝트가 없습니다.");
                        return;
                    }

                    try {
                        // 박제하기 전에 현재 화면의 최신 상태를 백엔드에 한 번 동기화
                        await saveProjectToServer();

                        const response = await request(`/projects/${currentProjectId}/canvas/commit`, {
                            method: "POST",
                            body: JSON.stringify({ commitMessage })
                        });

                        if (response && response.newVersion) {
                            alert(`v${response.newVersion} 버전이 성공적으로 기록(Commit) 되었습니다!`);
                            // 현재 가리키는 버전 상태를 방금 생성된 최신 버전 번호로 즉시 변경
                            set({ currentVersion: response.newVersion });

                            // 이후 서버에서 최신 버전 목록 리스트를 다시 받아옴
                            await get().loadVersionsFromServer(currentProjectId);
                        }
                    } catch (error) {
                        console.error("버전 저장(Commit) 실패:", error);
                        alert("버전 저장에 실패했습니다.");
                    }
                },

                deleteVersionFromServer: async (versionNumber) => {
                    const { currentProjectId, availableVersions, loadProjectFromServer } = get();
                    if (!currentProjectId) return;

                    if (!window.confirm(`정말 ${versionNumber} 버전을 삭제하시겠습니까?`)) return;

                    try {
                        await request(`/projects/${currentProjectId}/canvas?version=${versionNumber}`, {
                            method: "DELETE"
                        });

                        // 삭제된 버전을 제외한 새로운 배열 구성 (versionNumber 프로퍼티 매칭)
                        const remainingVersions = availableVersions.filter(v => v.versionNumber !== versionNumber);
                        set({ availableVersions: remainingVersions });

                        alert(`${versionNumber} 버전이 삭제되었습니다.`);
                        // 삭제 후 안전하게 현재 라이브 상태로 강제 복귀
                        await loadProjectFromServer(currentProjectId, null);
                    } catch (error) {
                        console.error("버전 삭제 실패:", error);
                        alert("버전 삭제에 실패했습니다.");
                    }
                }
            }),
            {
                partialize: (state) => {
                    const { selectedNodeId, selectedEdgeId, ...rest } = state;
                    return rest;
                },
            }
        ),
        { name: 'canvas-storage' }
    )
);