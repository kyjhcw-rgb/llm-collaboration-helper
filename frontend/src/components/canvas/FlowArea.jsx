import React, { useCallback, useRef } from 'react';
import ReactFlow, { Background, Controls, applyNodeChanges, applyEdgeChanges, useReactFlow, ReactFlowProvider, ConnectionMode, useStore, getSmoothStepPath } from 'reactflow';
import 'reactflow/dist/style.css';
import { useCanvasStore, recalculateContainerSizes, LAYOUT } from '../../store/useCanvasStore';
import './FlowArea.css';
import CustomNode from './CustomNode';
import CustomEdge from './CustomEdge';

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

const OFFSET_BY_TYPE = { feature: 176, class: 252, method: 301 };

const VALID_PARENT_TYPES = {
    method: ['class', 'feature'],
    class:  ['feature'],
    feature: [],
};

function getAbsolutePosition(nodeId, nodesMap) {
    const node = nodesMap.get(nodeId);
    if (!node) return { x: 0, y: 0 };
    if (!node.parentNode) return { x: node.position.x, y: node.position.y };
    const parentAbs = getAbsolutePosition(node.parentNode, nodesMap);
    return { x: parentAbs.x + node.position.x, y: parentAbs.y + node.position.y };
}

// 드래그된 블록이 유효한 부모와 겹치는지 확인 (중심점이 아닌 면적 겹침 사용)
// → 부모 경계 바깥에 살짝 걸쳐 놓아도 감지되어 부모가 자동으로 커짐
function findBestParent(draggedNode, allNodes, validParentTypes, nodesMap) {
    const absPos = getAbsolutePosition(draggedNode.id, nodesMap);
    const dw = draggedNode.style?.width || 150;
    const dh = draggedNode.style?.height || 50;

    let best = null;
    let bestZ = -1;

    for (const node of allNodes) {
        if (node.id === draggedNode.id) continue;
        if (!validParentTypes.includes(node.data?.type)) continue;

        const p = getAbsolutePosition(node.id, nodesMap);
        const pw = node.style?.width || 400;
        const ph = node.style?.height || 300;

        // 사각형 겹침 여부 (1px 이상 겹치면 부모로 인식)
        const overlapX = Math.min(absPos.x + dw, p.x + pw) - Math.max(absPos.x, p.x);
        const overlapY = Math.min(absPos.y + dh, p.y + ph) - Math.max(absPos.y, p.y);

        if (overlapX > 0 && overlapY > 0) {
            const z = node.style?.zIndex || 0;
            if (z > bestZ) { bestZ = z; best = node; }
        }
    }
    return best;
}

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

const FlowContents = () => {
    const { setSelectedNodeId, setSelectedEdgeId } = useCanvasStore();
    const { screenToFlowPosition } = useReactFlow();

    const nodes = useCanvasStore((state) => state.nodes);
    const edges = useCanvasStore((state) => state.edges);
    const connectingHandleRef = useRef(null);

    const handleNodesChange = useCallback((changes) => {
        const state = useCanvasStore.getState();
        if (state.userRole === 'GUEST') return;

        let nextNodes = applyNodeChanges(changes, state.nodes);

        // 2단계 전파 후처리: method→class(expandParent)가 class 크기를 키운 후,
        // class→feature 전파는 ReactFlow가 자동 처리 못할 수 있으므로 수동으로 보정
        const nodesMapAfter = new Map(nextNodes.map(n => [n.id, n]));
        let didGrow = false;
        for (const node of nextNodes) {
            if (!node.parentNode) continue;
            const parent = nodesMapAfter.get(node.parentNode);
            if (!parent) continue;
            const nW = node.width || node.style?.width || 150;
            const nH = node.height || node.style?.height || 50;
            const childRight = node.position.x + nW + LAYOUT.PADDING;
            const childBottom = node.position.y + nH + LAYOUT.PADDING;
            const pW = parent.width || parent.style?.width || 400;
            const pH = parent.height || parent.style?.height || 300;
            if (childRight > pW || childBottom > pH) {
                const newW = Math.max(pW, childRight);
                const newH = Math.max(pH, childBottom);
                nodesMapAfter.set(parent.id, {
                    ...parent,
                    width: newW,
                    height: newH,
                    style: { ...parent.style, width: newW, height: newH },
                });
                didGrow = true;
            }
        }
        if (didGrow) nextNodes = [...nodesMapAfter.values()];

        let nextEdges = state.edges;
        let edgesChanged = false;
        let needsRecalc = false;

        changes.forEach((change) => {
            if (change.type === 'remove') {
                nextEdges = nextEdges.filter(
                    (edge) => edge.source !== change.id && edge.target !== change.id
                );
                edgesChanged = true;
                needsRecalc = true;
            }
        });

        // 드래그 완료(dragging: false) 시점에 reparenting 처리
        const dragEndChanges = changes.filter(c => c.type === 'position' && c.dragging === false);

        for (const change of dragEndChanges) {
            const draggedNode = nextNodes.find(n => n.id === change.id);
            if (!draggedNode) continue;

            const validParentTypes = VALID_PARENT_TYPES[draggedNode.data?.type] || [];
            if (validParentTypes.length === 0) continue;

            const nodesMap = new Map(nextNodes.map(n => [n.id, n]));
            const absPos = getAbsolutePosition(draggedNode.id, nodesMap);
            const dw = draggedNode.style?.width || 150;
            const dh = draggedNode.style?.height || 50;
            const currentParentId = draggedNode.parentNode;

            if (currentParentId) {
                const curParent = nodesMap.get(currentParentId);
                if (curParent) {
                    const parentAbs = getAbsolutePosition(currentParentId, nodesMap);
                    const pw = curParent.style?.width || 400;
                    const cx = absPos.x + dw / 2;
                    const cy = absPos.y + dh / 2;

                    const staysInParent =
                        cx >= parentAbs.x && cx <= parentAbs.x + pw &&
                        cy >= parentAbs.y + LAYOUT.HEADER_HEIGHT;

                    if (staysInParent) {
                        needsRecalc = true;
                        continue;
                    }
                }

                const otherNodes = nextNodes.filter(n => n.id !== currentParentId);
                const bestParent = findBestParent(draggedNode, otherNodes, validParentTypes, nodesMap);

                if (bestParent) {
                    const siblings = nextNodes.filter(n => n.parentNode === bestParent.id && n.id !== draggedNode.id);
                    const newY = siblings.length > 0
                        ? Math.max(...siblings.map(s => s.position.y + (s.style?.height || 50))) + LAYOUT.PADDING
                        : LAYOUT.HEADER_HEIGHT + 8;
                    nextNodes = nextNodes.map(n => n.id !== draggedNode.id ? n : {
                        ...n,
                        parentNode: bestParent.id,
                        position: { x: LAYOUT.PADDING, y: newY },
                    });
                } else {
                    nextNodes = nextNodes.map(n => n.id !== draggedNode.id ? n :
                        { ...n, parentNode: undefined, position: absPos }
                    );
                    needsRecalc = true;
                }
                needsRecalc = true;
                continue;
            }

            const bestParent = findBestParent(draggedNode, nextNodes, validParentTypes, nodesMap);
            if (bestParent) {
                const siblings = nextNodes.filter(n => n.parentNode === bestParent.id && n.id !== draggedNode.id);
                const newY = siblings.length > 0
                    ? Math.max(...siblings.map(s => s.position.y + (s.style?.height || 50))) + LAYOUT.PADDING
                    : LAYOUT.HEADER_HEIGHT + 8;
                nextNodes = nextNodes.map(n => n.id !== draggedNode.id ? n : {
                    ...n,
                    parentNode: bestParent.id,
                    position: { x: LAYOUT.PADDING, y: newY },
                });
                needsRecalc = true;
            }
        }

        if (needsRecalc) nextNodes = recalculateContainerSizes(nextNodes);

        // 💡 핵심: 변경된 상태를 store에 세팅하여 Yjs 웹소켓으로 자동 동기화되게 함 (HEAD의 Yjs 동기화 보존)
        state.setNodes(nextNodes);
        if (edgesChanged) state.setEdges(nextEdges);

    }, []);

    const handleEdgesChange = useCallback((chs) => {
        const state = useCanvasStore.getState();
        if (state.userRole === 'GUEST') return;
        state.setEdges(applyEdgeChanges(chs, state.edges));
    }, []);

    const handleConnect = useCallback((params) => {
        const state = useCanvasStore.getState();
        if (state.userRole === 'GUEST') return;

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
            state.setEdges(newEdges);
        } else {
            const newEdge = {
                ...safeParams,
                id: `edge_${Date.now()}`,
                type: 'custom',
                zIndex: 9999,
                data: { type: 'call', badgeCount: 1, sourceNodeType }
            };
            state.setEdges(state.edges.concat(newEdge));
        }
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
        const state = useCanvasStore.getState();

        if (state.userRole === 'GUEST') {
            alert("게스트는 편집할 수 없습니다.");
            return;
        }

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
            width: initialWidth,
            height: initialHeight,
            style: { width: initialWidth, height: initialHeight, zIndex: zIndex },
        };

        const allNodes = [...state.nodes, newNode];
        const nodesMap = new Map(allNodes.map(n => [n.id, n]));
        const validParentTypes = VALID_PARENT_TYPES[domainType] || [];

        let finalNode = newNode;
        if (validParentTypes.length > 0) {
            const bestParent = findBestParent(newNode, state.nodes, validParentTypes, nodesMap);
            if (bestParent) {
                // 사이드바에서 드롭 시: 기존 자식들 아래에 쌓아서 배치
                const siblings = state.nodes.filter(n => n.parentNode === bestParent.id);
                const newY = siblings.length > 0
                    ? Math.max(...siblings.map(s => s.position.y + (s.style?.height || 50))) + LAYOUT.PADDING
                    : LAYOUT.HEADER_HEIGHT + 8;

                finalNode = {
                    ...newNode,
                    parentNode: bestParent.id,
                    position: { x: LAYOUT.PADDING, y: newY },
                };
            }
        }

        state.setNodes(recalculateContainerSizes([...state.nodes, finalNode]));

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