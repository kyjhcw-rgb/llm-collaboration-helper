import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';

export const useCanvasStore = create(
  persist(
    temporal(
      (set, get) => ({
        // 프로젝트 이름
        projectName: '',

        setProjectName: (name) =>
          set({ projectName: name }),

        // 페이지별 데이터 구조
        pages: {
          default_page: {
            nodes: [
              {
                id: '1',
                type: 'default',
                data: {
                  label: '회원가입',
                  description: '새로운 사용자를 등록합니다.',
                },
                position: { x: 260, y: 80 },
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
                ...state.pages[state.currentPageId],
                nodes,
              },
            },
          })),

        setEdges: (edges) =>
          set((state) => ({
            pages: {
              ...state.pages,
              [state.currentPageId]: {
                ...state.pages[state.currentPageId],
                edges,
              },
            },
          })),

        // 노드 상세 수정
        updateNodeData: (nodeId, newData) =>
          set((state) => {
            const page =
              state.pages[state.currentPageId];

            if (!page) return state;

            const updatedNodes = page.nodes.map(
              (node) =>
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