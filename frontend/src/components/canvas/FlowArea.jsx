import React, { useCallback } from 'react';
import ReactFlow, { Background, Controls, applyNodeChanges, applyEdgeChanges, addEdge, useReactFlow, ReactFlowProvider, MarkerType, ConnectionMode } from 'reactflow';
import 'reactflow/dist/style.css';
import { useCanvasStore } from '../../store/useCanvasStore';
import './FlowArea.css'; 
import CustomNode from './CustomNode';

const nodeTypes = {
    custom: CustomNode,
};

const FlowContents = () => {
    const { pages, currentPageId, setNodes, setEdges, setSelectedNodeId } = useCanvasStore();
    const { screenToFlowPosition } = useReactFlow();

    const nodes = pages[currentPageId]?.nodes || [];
    const edges = pages[currentPageId]?.edges || [];

    const defaultEdgeOptions = {
        type: 'straight',
        style: { strokeWidth: 3, stroke: '#4953BE' }, 
        markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#4953BE',
        },
        zIndex: 50, 
    };

    const onDrop = (event) => {
        event.preventDefault();
        const type = event.dataTransfer.getData('application/reactflow');
        if (!type) return;

        let nodeClass = 'canvas-node method-node';
        let initialWidth = 150;
        let initialHeight = 50;
        let zIndex = 30; 

        if (type === '기능') {
            nodeClass = 'canvas-node feature-node';
            initialWidth = 400;  
            initialHeight = 300;
            zIndex = 10;         
        } else if (type === '클래스') {
            nodeClass = 'canvas-node class-node';
            initialWidth = 250;  
            initialHeight = 150;
            zIndex = 20;         
        }

        const projectedPosition = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        });

        const position = {
            x: projectedPosition.x - (initialWidth / 2),
            y: projectedPosition.y - 320
        };

        const newNode = {
            id: `node_${Date.now()}`,
            type: 'custom',
            position, 
            data: { label: `${type} 블록`, description: '' , blockType: type},
            className: nodeClass,
            style: {
                width: initialWidth,
                height: initialHeight,
                zIndex: zIndex, 
            }
        };

        setNodes(nodes.concat(newNode));
    };

    return (
        <div 
            className="canvas-main" 
            onDrop={onDrop} 
            onDragOver={(e) => e.preventDefault()} 
            style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                defaultEdgeOptions={defaultEdgeOptions}
                connectionMode={ConnectionMode.Loose}
                onNodesChange={(chs) => setNodes(applyNodeChanges(chs, nodes))}
                onEdgesChange={(chs) => setEdges(applyEdgeChanges(chs, edges))}
                onConnect={(params) => setEdges(addEdge(params, edges))}
                onNodeClick={(_, node) => setSelectedNodeId(node.id)}
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