import React, { useCallback } from 'react';
import ReactFlow, { Background, Controls, applyNodeChanges, applyEdgeChanges, addEdge, useReactFlow, ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import { useCanvasStore } from '../../store/useCanvasStore';

import './FlowArea.css'; 

const FlowContents = () => {
    const { pages, currentPageId, setNodes, setEdges, setSelectedNodeId } = useCanvasStore();
    const { project } = useReactFlow();

    const nodes = pages[currentPageId]?.nodes || [];
    const edges = pages[currentPageId]?.edges || [];

    const onDrop = (event) => {
        event.preventDefault();
        // 사이드바에서 끌어온 블록의 타입(기능, 클래스, 메소드)을 받아옴
        const type = event.dataTransfer.getData('application/reactflow');
        if (!type) return;

        const position = project({
            x: event.clientX - 280, 
            y: event.clientY - 70,  
        });

        // 끌어온 타입에 따라 노드의 클래스명을 동적으로 변경함
        let nodeClass = 'canvas-node feature-node'; // 기본 파란색
        if (type === '클래스') {
            nodeClass = 'canvas-node class-node'; // 초록색
        } else if (type === '메소드') {
            nodeClass = 'canvas-node method-node'; // 핑크색
        }

        const newNode = {
            id: `node_${Date.now()}`,
            type: 'default',
            position,
            data: { label: `${type} 블록`, description: '' },
            className: nodeClass // 동적으로 결정된 클래스 적용
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