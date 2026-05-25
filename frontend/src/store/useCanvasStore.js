import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import { request } from '../api/http';

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
                            data: {
                                type: edge.type || 'call',
                                badgeCount: edge.badgeCount || 1
                            }
                        }));

                        set({
                            currentProjectId: projectId,
                            // 백엔드 응답에서 버전 번호가 안 오므로, 넘겨받은 파라미터를 그대로 사용해 상태 유지
                            currentVersion: versionNumber || 'live',
                            nodes: nodes,
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