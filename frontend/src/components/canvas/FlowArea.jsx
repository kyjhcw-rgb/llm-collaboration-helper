import React, { useCallback, useRef } from 'react';
import ReactFlow, { Background, Controls, applyNodeChanges, applyEdgeChanges, useReactFlow, ReactFlowProvider, ConnectionMode, useStore, getSmoothStepPath, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import { useCanvasStore } from '../../store/useCanvasStore';
import './FlowArea.css';
import CustomNode from './CustomNode';
import CustomEdge from './CustomEdge';

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

// =============================================
// 연결 미리보기 선 커스텀 (OFFSET 동기화)
// =============================================
const OFFSET_BY_TYPE = { feature: 176, class: 252, method: 301 };

function inferPositions(sourceX, sourceY, targetX, targetY) {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    if (Math.abs(dx) >= Math.abs(dy)) {
        if (dx >= 0) return { sourcePos: Position.Right, targetPos: Position.Left };
        else         return { sourcePos: Position.Left,  targetPos: Position.Right };
    } else {
        if (dy >= 0) return { sourcePos: Position.Bottom, targetPos: Position.Top };
        else         return { sourcePos: Position.Top,    targetPos: Position.Bottom };
    }
}

function CustomConnectionLine({ fromX, fromY, toX, toY }) {
    const connectionNodeId = useStore((state) => state.connectionNodeId);
    const nodes = useCanvasStore((state) => state.nodes);
    const sourceNode = nodes.find((n) => n.id === connectionNodeId);
    const sourceType = sourceNode?.data?.type || 'method';
    const OFFSET = OFFSET_BY_TYPE[sourceType] ?? 0;

    const { sourcePos, targetPos } = inferPositions(fromX, fromY + OFFSET, toX, toY + OFFSET);

    const [path] = getSmoothStepPath({
        sourceX: fromX,
        sourceY: fromY + OFFSET,
        sourcePosition: sourcePos,
        targetX: toX,
        targetY: toY + OFFSET,
        targetPosition: targetPos,
        borderRadius: 10,
    });

    return (
        <g>
            <path fill="none" stroke="#4953BE" strokeWidth={2} strokeDasharray="5 5" d={path} />
        </g>
    );
}

// =============================================

const FlowContents = () => {
    const { setSelectedNodeId, setSelectedEdgeId } = useCanvasStore();
    const { screenToFlowPosition } = useReactFlow();

    const nodes = useCanvasStore((state) => state.nodes);
    const edges = useCanvasStore((state) => state.edges);

    const connectingHandleRef = useRef(null);

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

    const handleConnect = useCallback((params) => {
        useCanvasStore.setState((state) => {
            const safeParams = {
                ...params,
                sourceHandle: params.sourceHandle || 'bottom',
                targetHandle: params.targetHandle || 'top'
            };

            const sourceNode = state.nodes.find((n) => n.id === safeParams.source);
            const sourceNodeType = sourceNode?.data?.type || 'method';

            const existingEdgeIndex = state.edges.findIndex(
                e => e.source === safeParams.source && e.target === safeParams.target
            );

            if (existingEdgeIndex !== -1) {
                const newEdges = [...state.edges];
                const existingEdge = newEdges[existingEdgeIndex];
                const currentCount = existingEdge.data?.badgeCount || 1;
                newEdges[existingEdgeIndex] = {
                    ...existingEdge,
                    sourceHandle: safeParams.sourceHandle,
                    targetHandle: safeParams.targetHandle,
                    data: { ...existingEdge.data, badgeCount: currentCount + 1 }
                };
                return { edges: newEdges };
            } else {
                const newEdge = {
                    ...safeParams,
                    id: `edge_${Date.now()}`,
                    type: 'custom',
                    zIndex: 9999,
                    data: { type: 'call', badgeCount: 1, sourceNodeType }
                };
                return { edges: state.edges.concat(newEdge) };
            }
        });
    }, []);

    const onConnectStart = useCallback((event, { nodeId, handleId }) => {
        connectingHandleRef.current = { nodeId, handleId };
    }, []);

    const onConnectEnd = useCallback((event) => {
        if (!connectingHandleRef.current) return;

        if (event.target.classList.contains('react-flow__handle')) {
            connectingHandleRef.current = null;
            return;
        }

        const targetNodeElement = event.target.closest('.react-flow__node');
        if (targetNodeElement) {
            const targetNodeId = targetNodeElement.getAttribute('data-id');
            const sourceNodeId = connectingHandleRef.current.nodeId;
            const sourceHandleId = connectingHandleRef.current.handleId || 'bottom';

            if (targetNodeId && sourceNodeId !== targetNodeId) {
                const clientX = event.changedTouches ? event.changedTouches[0].clientX : event.clientX;
                const clientY = event.changedTouches ? event.changedTouches[0].clientY : event.clientY;

                const rect = targetNodeElement.getBoundingClientRect();

                const portCoords = {
                    top:    { x: rect.left + rect.width / 2, y: rect.top },
                    bottom: { x: rect.left + rect.width / 2, y: rect.bottom },
                    left:   { x: rect.left,  y: rect.top + rect.height / 2 },
                    right:  { x: rect.right, y: rect.top + rect.height / 2 }
                };

                let closestPort = 'top';
                let minDistance = Infinity;

                for (const [side, pos] of Object.entries(portCoords)) {
                    const dist = Math.hypot(clientX - pos.x, clientY - pos.y);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestPort = side;
                    }
                }

                handleConnect({
                    source: sourceNodeId,
                    sourceHandle: sourceHandleId,
                    target: targetNodeId,
                    targetHandle: closestPort
                });
            }
        }
        connectingHandleRef.current = null;
    }, [handleConnect]);

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
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                <defs>
                    <marker id="marker-call" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#4953BE" />
                    </marker>
                    <marker id="marker-inheritance" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                        <path d="M 0 0 L 10 5 L 0 10 Z" fill="#fff" stroke="#8E44AD" strokeWidth="2" />
                    </marker>
                    <marker id="marker-implementation" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                        <path d="M 0 0 L 10 5 L 0 10 Z" fill="#fff" stroke="#27AE60" strokeWidth="2" />
                    </marker>
                </defs>
            </svg>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                connectionLineComponent={CustomConnectionLine}
                elevateEdgesOnSelect={true}
                connectionMode={ConnectionMode.Loose}
                nodesConnectable={true}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={handleConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                onEdgeClick={(_, edge) => setSelectedEdgeId(edge.id)}
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