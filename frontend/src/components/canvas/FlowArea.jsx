import React, { useCallback, useRef } from 'react';
import ReactFlow, {
    Background,
    Controls,
    ConnectionMode,
    useStore,
    getSmoothStepPath,
    ReactFlowProvider,
    useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useCanvasStore } from '../../store/useCanvasStore';
import CustomNode from './CustomNode';
import CustomEdge from './CustomEdge';
import './FlowArea.css';

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

// =============================================
// 연결 미리보기 선 커스텀 (OFFSET 동기화)
// =============================================
const OFFSET_BY_TYPE = { feature: 176, class: 252, method: 301 };

function CustomConnectionLine({ fromX, fromY, toX, toY, fromPosition, toPosition }) {
    const connectionNodeId = useStore((state) => state.connectionNodeId);
    const nodes = useCanvasStore((state) => state.nodes);
    const sourceNode = nodes.find((n) => n.id === connectionNodeId);
    const sourceType = sourceNode?.data?.type || 'method';
    const OFFSET = OFFSET_BY_TYPE[sourceType] ?? 0;

    const [path] = getSmoothStepPath({
        sourceX: fromX,
        sourceY: fromY + OFFSET,
        sourcePosition: fromPosition,
        targetX: toX,
        targetY: toY + OFFSET,
        targetPosition: toPosition,
        borderRadius: 10,
    });

    return (
        <g>
            <path fill="none" stroke="#4953BE" strokeWidth={2} strokeDasharray="5 5" d={path} />
        </g>
    );
}

// =============================================
// 캔버스 핵심 컴포넌트
// =============================================
const FlowContents = () => {
    const {
        setSelectedNodeId,
        setSelectedEdgeId,
        onNodesChange,
        onEdgesChange,
        onConnect,
        addNode
    } = useCanvasStore();

    const { screenToFlowPosition } = useReactFlow();

    const nodes = useCanvasStore((state) => state.nodes);
    const edges = useCanvasStore((state) => state.edges);
    const userRole = useCanvasStore((state) => state.userRole);

    // GUEST 권한인지 판별하여 편집 가능 여부를 결정
    const isEditable = userRole !== 'GUEST';

    const connectingHandleRef = useRef(null);

    const onConnectStart = useCallback((event, { nodeId, handleId }) => {
        connectingHandleRef.current = { nodeId, handleId };
    }, []);

    const onConnectEnd = useCallback((event) => {
        // 권한이 없거나 시작점이 없으면 무시
        if (!connectingHandleRef.current || !isEditable) return;

        // 핸들 위에서 드래그를 멈추면 React Flow가 자체 처리하므로 무시
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

                // 스토어의 onConnect 호출
                onConnect({
                    source: sourceNodeId,
                    sourceHandle: sourceHandleId,
                    target: targetNodeId,
                    targetHandle: closestPort
                });
            }
        }
        connectingHandleRef.current = null;
    }, [onConnect, isEditable]);

    // 외부 사이드바에서 캔버스로 블록을 드롭할 때 실행됨
    const onDrop = useCallback((event) => {
        event.preventDefault();

        // [보안] 권한이 없으면 드롭 이벤트를 무시
        if (!isEditable) return;

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

        // 스토어의 addNode를 호출하여 동기화
        addNode(newNode);
    }, [screenToFlowPosition, isEditable, addNode]);

    return (
        <div
            className="canvas-main"
            onDrop={onDrop}
            onDragOver={(e) => {
                e.preventDefault();
                // 권한에 따라 마우스 커서 표시 변경 (move / none)
                e.dataTransfer.dropEffect = isEditable ? 'move' : 'none';
            }}
            style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}
        >
            {/* SVG 마커 정의 (화살표 모양) */}
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

            {/* 게스트 유저를 위한 안내 UI */}
            {!isEditable && (
                <div style={{
                    position: 'absolute', top: 15, left: '50%', transform: 'translateX(-50%)',
                    backgroundColor: '#e74c3c', color: 'white', padding: '8px 18px',
                    borderRadius: '20px', zIndex: 1000, fontWeight: 'bold', fontSize: '14px',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                }}>
                    👀 읽기 전용 모드 (Guest 권한)
                </div>
            )}

            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                connectionLineComponent={CustomConnectionLine}
                elevateEdgesOnSelect={true}
                connectionMode={ConnectionMode.Loose}

                // [핵심 보안] isEditable 변수로 ReactFlow 내부의 상호작용 속성 제어
                nodesConnectable={isEditable}
                nodesDraggable={isEditable}
                elementsSelectable={isEditable}

                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onNodeClick={(_, node) => { if (isEditable) setSelectedNodeId(node.id); }}
                onEdgeClick={(_, edge) => { if (isEditable) setSelectedEdgeId(edge.id); }}
                onPaneClick={() => {
                    setSelectedNodeId(null);
                    setSelectedEdgeId(null);
                }}
                minZoom={0.05}
                maxZoom={2}
                fitView
            >
                <Background color="#aaa" gap={20} variant="dots" />
                {/* 컨트롤(줌인/줌아웃) 패널. 게스트일 경우 노드 상호작용 관련 버튼 비활성화 */}
                <Controls showInteractive={isEditable} />
            </ReactFlow>
        </div>
    );
};

// =============================================
// FlowArea 래퍼 (ReactFlowProvider 필수)
// =============================================
const FlowArea = () => (
    <div style={{ flex: 1, width: '100%', height: '100%', display: 'flex' }}>
        <ReactFlowProvider>
            <FlowContents />
        </ReactFlowProvider>
    </div>
);

export default FlowArea;