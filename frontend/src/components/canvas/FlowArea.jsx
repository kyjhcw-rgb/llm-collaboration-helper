import React, { useCallback } from 'react';
import ReactFlow, { Background, Controls, applyNodeChanges, applyEdgeChanges, useReactFlow, ReactFlowProvider, ConnectionMode } from 'reactflow';
import 'reactflow/dist/style.css';
import { useCanvasStore } from '../../store/useCanvasStore';
import './FlowArea.css';
import CustomNode from './CustomNode';
import CustomEdge from './CustomEdge';

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

const FlowContents = () => {
    const { setSelectedNodeId, setSelectedEdgeId } = useCanvasStore();
    const { screenToFlowPosition } = useReactFlow();

    const nodes = useCanvasStore((state) => state.nodes);
    const edges = useCanvasStore((state) => state.edges);

    const handleNodesChange = useCallback((changes) => {
        useCanvasStore.setState((state) => {
            let nextEdges = state.edges;
            changes.forEach((change) => {
                if (change.type === 'remove') {
                    nextEdges = nextEdges.filter(
                        (edge) => edge.source !== change.id && edge.target !== change.id
                    );
                }
            });
            return {
                nodes: applyNodeChanges(changes, state.nodes),
                edges: nextEdges
            };
        });
    }, []);

    const handleEdgesChange = useCallback((chs) => {
        useCanvasStore.setState((state) => ({ edges: applyEdgeChanges(chs, state.edges) }));
    }, []);

    // 선 연결 시 뱃지(중복 연결) 처리 로직
    const handleConnect = useCallback((params) => {
        useCanvasStore.setState((state) => {
            // 이미 동일한 source와 target을 가진 선이 있는지 확인
            const existingEdgeIndex = state.edges.findIndex(
                e => e.source === params.source && e.target === params.target
            );

            if (existingEdgeIndex !== -1) {
                // 선이 있으면 뱃지 카운트 증가
                const newEdges = [...state.edges];
                const existingEdge = newEdges[existingEdgeIndex];
                const currentCount = existingEdge.data?.badgeCount || 1;

                newEdges[existingEdgeIndex] = {
                    ...existingEdge,
                    data: { ...existingEdge.data, badgeCount: currentCount + 1 }
                };
                return { edges: newEdges };
            } else {
                // 선이 없으면 새로 생성 (기본은 파란색 call 타입)
                const newEdge = {
                    ...params,
                    id: `edge_${Date.now()}`,
                    type: 'custom',
                    data: { type: 'call', badgeCount: 1 }
                };
                return { edges: state.edges.concat(newEdge) };
            }
        });
    }, []);

    const onDrop = useCallback((event) => {
        event.preventDefault();
        const type = event.dataTransfer.getData('application/reactflow');
        if (!type) return;

        let nodeClass = 'canvas-node method-node';
        let initialWidth = 150;
        let initialHeight = 50;
        let zIndex = 30;
        let domainType = 'method';

        if (type === '기능') {
            nodeClass = 'canvas-node feature-node';
            initialWidth = 400;
            initialHeight = 300;
            zIndex = 10;
            domainType = 'feature';
        } else if (type === '클래스') {
            nodeClass = 'canvas-node class-node';
            initialWidth = 250;
            initialHeight = 150;
            zIndex = 20;
            domainType = 'class';
        }

        const projectedPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });

        const newNode = {
            id: `node_${Date.now()}`,
            type: 'custom',
            position: { x: projectedPosition.x - (initialWidth / 2), y: projectedPosition.y - 320 },
            data: { label: `${type} 블록`, description: '', type: domainType, name: `${type} 블록` },
            className: nodeClass,
            style: { width: initialWidth, height: initialHeight, zIndex: zIndex }
        };

        useCanvasStore.setState((state) => ({ nodes: [...state.nodes, newNode] }));
    }, [screenToFlowPosition]);

    return (
        <div
            className="canvas-main"
            onDrop={onDrop}
            onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            }}
            style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}
        >
            {/* 커스텀 화살표 디자인 정의를 위한 SVG 공간 */}
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                <defs>
                    {/* 파란색 꽉 찬 화살표 (메서드 호출) */}
                    <marker id="marker-call" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#4953BE" />
                    </marker>
                    {/* 보라색 빈 화살표 (상속) */}
                    <marker id="marker-inheritance" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#fff" stroke="#8E44AD" strokeWidth="1.5" />
                    </marker>
                    {/* 초록색 빈 화살표 (구현) */}
                    <marker id="marker-implementation" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#fff" stroke="#27AE60" strokeWidth="1.5" />
                    </marker>
                </defs>
            </svg>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                connectionMode={ConnectionMode.Loose}
                nodesConnectable={true}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={handleConnect}
                onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                onEdgeClick={(_, edge) => setSelectedEdgeId(edge.id)} /* 🌟 선 클릭 이벤트 추가 */
                onPaneClick={() => {
                    setSelectedNodeId(null);
                    setSelectedEdgeId(null);
                }}
                minZoom={0.05}
                maxZoom={2}
                fitView
            >
                <Background color="#aaa" gap={20} variant="dots" />
                <Controls />
            </ReactFlow>
        </div>
    );
};

const FlowArea = () => (
    <div style={{ flex: 1, width: '100%', height: '100%', display: 'flex' }}>
        <ReactFlowProvider>
            <FlowContents />
        </ReactFlowProvider>
    </div>
);

export default FlowArea;