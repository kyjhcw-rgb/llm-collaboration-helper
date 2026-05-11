import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';

export const useCanvasStore = create(
  persist(
    temporal(
      (set, get) => ({
        // 프로젝트 이름
        projectName: '',

        // 현재 열려있는 프로젝트 id
        currentProjectId: null,

        setProjectName: (name) =>
          set({ projectName: name }),

        resetProject: () =>
  set({
    currentProjectId: null,
    projectName: '',
    pages: {
      default_page: {
        nodes: [
          {
            id: '1',
            type: 'default',
            data: {
              label: '회원가입',
              description:
                '새로운 사용자를 등록합니다.',
            },
            position: {
              x: 260,
              y: 80,
            },
            className:
              'feature-node',
          },
        ],
        edges: [],
      },
    },
    currentPageId:
      'default_page',
    selectedNodeId: null,
          }),

        // 페이지별 데이터 구조
        pages: {
          default_page: {
            nodes: [
              {
                id: '1',
                type: 'default',
                data: {
                  label: '회원가입',
                  description:
                    '새로운 사용자를 등록합니다.',
                },
                position: {
                  x: 260,
                  y: 80,
                },
                className: 'feature-node',
              },
            ],
            edges: [],
          },
        },

        currentPageId: 'default_page',
        selectedNodeId: null,

        // 페이지 전환 및 노드 선택
        setCurrentPageId: (id) =>
          set({ currentPageId: id }),

        setSelectedNodeId: (id) =>
          set({ selectedNodeId: id }),

        // 데이터 업데이트
        setNodes: (nodes) =>
          set((state) => ({
            pages: {
              ...state.pages,
              [state.currentPageId]: {
                ...state.pages[
                  state.currentPageId
                ],
                nodes,
              },
            },
          })),

        setEdges: (edges) =>
          set((state) => ({
            pages: {
              ...state.pages,
              [state.currentPageId]: {
                ...state.pages[
                  state.currentPageId
                ],
                edges,
              },
            },
          })),

        // 노드 상세 수정
        updateNodeData: (
          nodeId,
          newData
        ) =>
          set((state) => {
            const page =
              state.pages[
                state.currentPageId
              ];

            if (!page) return state;

            const updatedNodes =
              page.nodes.map((node) =>
                node.id === nodeId
                  ? {
                      ...node,
                      data: {
                        ...node.data,
                        ...newData,
                      },
                    }
                  : node
              );

            return {
              pages: {
                ...state.pages,
                [state.currentPageId]: {
                  ...page,
                  nodes: updatedNodes,
                },
              },
            };
          }),

        // 프로젝트 저장
        saveProject: () => {
          const state = get();

          // 기존 저장 목록 가져오기
          const savedProjects =
            JSON.parse(
              localStorage.getItem(
                'saved-projects'
              )
            ) || [];

          // 저장할 프로젝트 데이터
          const projectData = {
            id:
              state.currentProjectId ||
              Date.now(),

            projectName:
              state.projectName,

            pages:
              state.pages,

            savedAt:
              new Date().toISOString(),
          };

          // 기존 프로젝트 찾기
          const existingIndex =
            savedProjects.findIndex(
              (project) =>
                project.id ===
                state.currentProjectId
            );

          // 있으면 덮어쓰기
          if (existingIndex !== -1) {
            savedProjects[
              existingIndex
            ] = projectData;
          } else {
            // 없으면 새 프로젝트 생성
            savedProjects.push(
              projectData
            );
          }

          // localStorage 저장
          localStorage.setItem(
            'saved-projects',
            JSON.stringify(
              savedProjects
            )
          );

          // 현재 프로젝트 id 기억
          set({
            currentProjectId:
              projectData.id,
          });
        },

        // 프로젝트 불러오기
        loadProject: (
          projectData
        ) => {
          set({
            currentProjectId:
              projectData.id,

            projectName:
              projectData.projectName,

            pages:
              projectData.pages,

            currentPageId:
              Object.keys(
                projectData.pages
              )[0] ||
              'default_page',
          });
        },
        // 프로젝트 삭제
        deleteProject: (projectId) => {
  const savedProjects =
    JSON.parse(
      localStorage.getItem(
        'saved-projects'
      )
    ) || [];

  const filteredProjects =
    savedProjects.filter(
      (project) =>
        project.id !== projectId
    );

  localStorage.setItem(
    'saved-projects',
    JSON.stringify(
      filteredProjects
    )
  );
        },
      }),
      {
        partialize: (state) => {
          const {
            selectedNodeId,
            currentPageId,
            ...rest
          } = state;

          return rest;
        },
      }
    ),
    {
      name: 'canvas-storage',
    }
  )
);