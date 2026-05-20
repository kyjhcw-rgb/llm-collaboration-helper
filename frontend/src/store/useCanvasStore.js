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
                currentVersion: 1,
                availableVersions: [],

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
                        currentVersion: 1,
                        availableVersions: [],
                        nodes: [],
                        edges: [],
                        selectedNodeId: null,
                        selectedEdgeId: null,
                    });
                },

                // 노드와 엣지 선택은 상호 배타적으로 동작하도록 설정
                setSelectedNodeId: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
                setSelectedEdgeId: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

                setNodes: (nodes) => set({ nodes }),
                setEdges: (edges) => set({ edges }),

                // 노드 데이터 로컬 업데이트
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

                // 엣지 데이터(타입 등) 로컬 업데이트
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

                loadProjectFromServer: async (projectId, version = null) => {
                    try {
                        const url = version
                            ? `/projects/${projectId}/canvas?version=${version}`
                            : `/projects/${projectId}/canvas`;

                        const data = await request(url, { method: "GET" });

                        const nodes = (data.blocks || []).map(block => {
                            let nodeClass = 'canvas-node method-node';
                            let initialWidth = 150;
                            let initialHeight = 50;
                            let zIndex = 30;

                            if (block.type === 'feature') {
                                nodeClass = 'canvas-node feature-node';
                                initialWidth = 400;
                                initialHeight = 300;
                                zIndex = 10;
                            } else if (block.type === 'class') {
                                nodeClass = 'canvas-node class-node';
                                initialWidth = 250;
                                initialHeight = 150;
                                zIndex = 20;
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

                        // 엣지 데이터를 스토어에 맞게 변환 (CustomEdge가 읽을 수 있도록 data 필드 활용)
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
                            currentVersion: data.version || 1,
                            nodes: nodes,
                            edges: edges
                        });

                        get().loadVersionsFromServer(projectId);

                    } catch (error) {
                        console.error("서버에서 데이터를 불러오는 중 오류 발생:", error);
                        alert("다이어그램 데이터를 불러오지 못했습니다.");
                    }
                },

                saveProjectToServer: async () => {
                    const state = get();
                    const projectId = state.currentProjectId;

                    if (!projectId) {
                        alert("현재 연결된 프로젝트 ID가 없습니다.");
                        return;
                    }

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

                    // 엣지 데이터를 백엔드 DTO에 맞게 변환
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
                        const response = await request(`/projects/${projectId}/canvas/sync`, {
                            method: "POST",
                            body: JSON.stringify({ blocks, edges })
                        });

                        if (response && response.newVersion) {
                            set({ currentVersion: response.newVersion });
                            get().loadVersionsFromServer(projectId);
                        }
                        alert(`새로운 버전(v${response.newVersion})으로 성공적으로 저장되었습니다!`);
                    } catch (error) {
                        console.error("저장 중 오류 발생:", error);
                        alert('저장에 실패했습니다.');
                    }
                },

                deleteVersionFromServer: async (version) => {
                    const { currentProjectId, availableVersions, loadProjectFromServer } = get();
                    if (!currentProjectId) return;

                    if (!window.confirm(`정말 ${version} 버전을 삭제하시겠습니까?`)) return;

                    try {
                        // 1. 서버에 삭제 요청
                        await request(`/projects/${currentProjectId}/canvas?version=${version}`, {
                            method: "DELETE"
                        });

                        // 2. 현재 로컬 상태에서 삭제된 버전 필터링
                        const remainingVersions = availableVersions.filter(v => v !== version);
                        set({ availableVersions: remainingVersions });

                        // 3. 삭제 후 화면 갱신 (남은 버전 중 최신 버전 불러오기)
                        if (remainingVersions.length > 0) {
                            const latestVersion = Math.max(...remainingVersions);
                            await loadProjectFromServer(currentProjectId, latestVersion);
                            alert(`${version} 버전이 삭제되고, 최신 버전(${latestVersion})을 불러왔습니다.`);
                        } else {
                            // 남은 버전이 없을 경우 캔버스를 백지로 초기화
                            set({ nodes: [], edges: [], currentVersion: null });
                            alert(`${version} 버전이 삭제되었습니다. 남은 버전이 없습니다.`);
                        }

                    } catch (error) {
                        console.error("버전 삭제 실패:", error);
                        alert("버전 삭제에 실패했습니다.");
                    }
                }
            }),
            {
                partialize: (state) => {
                    // 선택 상태는 로컬 스토리지에 저장하지 않음
                    const { selectedNodeId, selectedEdgeId, ...rest } = state;
                    return rest;
                },
            }
        ),
        {
            name: 'canvas-storage',
        }
    )
);