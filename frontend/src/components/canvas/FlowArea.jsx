import React, { useCallback, useRef } from 'react';
import ReactFlow, { Background, Controls, applyNodeChanges, applyEdgeChanges, useReactFlow, ReactFlowProvider, ConnectionMode, getSmoothStepPath } from 'reactflow';
import 'reactflow/dist/style.css';
import { useCanvasStore, recalculateContainerSizes, LAYOUT } from '../../store/useCanvasStore';
import './FlowArea.css';
import CustomNode from './CustomNode';
import CustomEdge from './CustomEdge';

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

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

function findBestParent(draggedNode, allNodes, validParentTypes, nodesMap) {
    const absPos = getAbsolutePosition(draggedNode.id, nodesMap);
    const dw = draggedNode.width || draggedNode.style?.width || 150;
    const dh = draggedNode.height || draggedNode.style?.height || 50;

    let best = null;
    let bestZ = -1;

    for (const node of allNodes) {
        if (node.id === draggedNode.id) continue;
        if (!validParentTypes.includes(node.data?.type)) continue;

        const p = getAbsolutePosition(node.id, nodesMap);
        const pw = node.width || node.style?.width || 400;
        const ph = node.height || node.style?.height || 300;

        const overlapX = Math.min(absPos.x + dw, p.x + pw) - Math.max(absPos.x, p.x);
        const overlapY = Math.min(absPos.y + dh, p.y + ph) - Math.max(absPos.y, p.y);

        if (overlapX > 0 && overlapY > 0) {
            const z = node.style?.zIndex || 0;
            if (z > bestZ) { bestZ = z; best = node; }
        }
    }
    return best;
}

// C: 이동된 노드와 겹치는 형제를 DOWN/RIGHT로만 밀어냄 (clamp 재충돌 없음, idempotent).
// 반환: { nodes: 수정된 배열, affectedIds: 실제로 밀린 형제 ID 집합 }
function resolveOverlaps(nodes, movedNodeId) {
    const movedNode = nodes.find(n => n.id === movedNodeId);
    if (!movedNode || !movedNode.parentNode) return { nodes, affectedIds: new Set() };

    const mW = movedNode.width || movedNode.style?.width || 150;
    const mH = movedNode.height || movedNode.style?.height || 50;
    const siblings = nodes.filter(n => n.parentNode === movedNode.parentNode && n.id !== movedNodeId);

    let result = [...nodes];
    const affectedIds = new Set();

    for (const sib of siblings) {
        const cm = result.find(n => n.id === movedNodeId);
        const cs = result.find(n => n.id === sib.id);
        if (!cm || !cs) continue;

        const sW = cs.width || cs.style?.width || 150;
        const sH = cs.height || cs.style?.height || 50;

        const overlapX = Math.min(cm.position.x + mW, cs.position.x + sW) - Math.max(cm.position.x, cs.position.x);
        const overlapY = Math.min(cm.position.y + mH, cs.position.y + sH) - Math.max(cm.position.y, cs.position.y);

        if (overlapX <= 0 || overlapY <= 0) continue;

        if (overlapX < overlapY) {
            const newX = cs.position.x <= cm.position.x
                ? cm.position.x + mW + LAYOUT.PADDING
                : cs.position.x + overlapX;
            result = result.map(n => n.id !== sib.id ? n : { ...n, position: { x: newX, y: n.position.y } });
        } else {
            const newY = cs.position.y <= cm.position.y
                ? cm.position.y + mH + LAYOUT.PADDING
                : cs.position.y + overlapY;
            result = result.map(n => n.id !== sib.id ? n : { ...n, position: { x: n.position.x, y: newY } });
        }
        affectedIds.add(sib.id);
    }

    return { nodes: result, affectedIds };
}

function CustomConnectionLine({ fromX, fromY, toX, toY, fromPosition, toPosition }) {
    const [path] = getSmoothStepPath({
        sourceX: fromX,
        sourceY: fromY,
        sourcePosition: fromPosition,
        targetX: toX,
        targetY: toY,
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

    // ─── handleNodesChange ───────────────────────────────────────────────────
    // drag 중 position 반영 + select/dimensions 배치 layout 보존 + 삭제 처리만 담당.
    // drag end 후처리(reparenting/clamp/overlap/recalc)는 onNodeDragStop으로 이전.
    const handleNodesChange = useCallback((changes) => {
        const state = useCanvasStore.getState();
        if (state.userRole === 'GUEST') return;

        let nextNodes = applyNodeChanges(changes, state.nodes);
        let nextEdges = state.edges;
        let edgesChanged = false;

        for (const change of changes) {
            if (change.type === 'remove') {
                nextEdges = nextEdges.filter(
                    edge => edge.source !== change.id && edge.target !== change.id
                );
                edgesChanged = true;
            }
        }

        // Method 1: select·dimensions 배치는 layout 속성(position·size·parentNode)을
        // store 현재값으로 보존 → select 배치가 recalc 결과를 덮어쓰지 않음.
        const hasPositionOrRemove = changes.some(c => c.type === 'position' || c.type === 'remove');
        if (!hasPositionOrRemove) {
            const prevMap = new Map(state.nodes.map(n => [n.id, n]));
            nextNodes = nextNodes.map(n => {
                const prev = prevMap.get(n.id);
                if (!prev) return n;
                return { ...prev, selected: n.selected, dragging: n.dragging };
            });
            state.setNodes(nextNodes);
            return;
        }

        // 노드 삭제 시 컨테이너 크기 재계산
        if (changes.some(c => c.type === 'remove')) {
            nextNodes = recalculateContainerSizes(nextNodes);
        }

        state.setNodes(nextNodes);
        if (edgesChanged) state.setEdges(nextEdges);
    }, []);

    // ─── handleNodeDragStop ──────────────────────────────────────────────────
    // React Flow v11의 신뢰할 수 있는 drag end 신호.
    // 이 시점에 store.nodes에는 드래그 중 position 변화가 이미 반영돼 있음.
    // 후처리: D(면적겹침) → B(clamp) → reparenting → C(resolveOverlaps) → A(recalc)
    const handleNodeDragStop = useCallback((event, draggedNode) => {
        const state = useCanvasStore.getState();
        if (state.userRole === 'GUEST') return;

        // 멀티셀렉트: selected인 노드 전체를 드래그 대상으로 포함
        const draggedIds = new Set(
            state.nodes
                .filter(n => n.selected || n.id === draggedNode.id)
                .map(n => n.id)
        );

        let nextNodes = [...state.nodes];

        for (const nodeId of draggedIds) {
            const node = nextNodes.find(n => n.id === nodeId);
            if (!node) continue;

            const validParentTypes = VALID_PARENT_TYPES[node.data?.type] || [];
            if (validParentTypes.length === 0) continue; // feature는 reparenting 없음

            const nodesMap = new Map(nextNodes.map(n => [n.id, n]));
            const absPos = getAbsolutePosition(node.id, nodesMap);
            const dw = node.width || node.style?.width || 150;
            const dh = node.height || node.style?.height || 50;
            const currentParentId = node.parentNode;

            if (currentParentId) {
                const curParent = nodesMap.get(currentParentId);
                if (curParent) {
                    const parentAbs = getAbsolutePosition(currentParentId, nodesMap);
                    const pw = curParent.width || curParent.style?.width || 400;
                    const ph = curParent.height || curParent.style?.height || 300;

                    // D: 면적 겹침이 조금이라도 있으면 부모 안에 유지
                    const overlapX = Math.min(absPos.x + dw, parentAbs.x + pw) - Math.max(absPos.x, parentAbs.x);
                    const overlapY = Math.min(absPos.y + dh, parentAbs.y + ph) - Math.max(absPos.y, parentAbs.y);

                    if (overlapX > 0 && overlapY > 0) {
                        // B: 위/왼쪽 경계 초과 시에만 clamp (아래/오른쪽은 A가 부모를 확장)
                        const clampedX = Math.max(LAYOUT.PADDING, node.position.x);
                        const clampedY = Math.max(LAYOUT.HEADER_HEIGHT, node.position.y);
                        if (clampedX !== node.position.x || clampedY !== node.position.y) {
                            nextNodes = nextNodes.map(n => n.id !== nodeId ? n : {
                                ...n,
                                position: { x: clampedX, y: clampedY }
                            });
                        }
                        continue;
                    }
                }

                // 현재 부모와 면적 겹침 없음 → 새 부모 탐색 또는 완전 분리
                const nodesMapCurrent = new Map(nextNodes.map(n => [n.id, n]));
                const otherNodes = nextNodes.filter(n => n.id !== currentParentId);
                const bestParent = findBestParent(node, otherNodes, validParentTypes, nodesMapCurrent);

                if (bestParent) {
                    const newParentAbs = getAbsolutePosition(bestParent.id, nodesMapCurrent);
                    const relX = Math.max(LAYOUT.PADDING, absPos.x - newParentAbs.x);
                    let relY = Math.max(LAYOUT.HEADER_HEIGHT, absPos.y - newParentAbs.y);
                    for (const sib of nextNodes.filter(n => n.parentNode === bestParent.id && n.id !== nodeId && draggedIds.has(n.id))) {
                        const sH = sib.height || sib.style?.height || 50;
                        if (Math.min(relY + dh, sib.position.y + sH) - Math.max(relY, sib.position.y) > 0) {
                            relY = sib.position.y + sH + LAYOUT.PADDING;
                        }
                    }
                    nextNodes = nextNodes.map(n => n.id !== nodeId ? n : {
                        ...n,
                        parentNode: bestParent.id,
                        position: { x: relX, y: relY },
                    });
                } else {
                    // 완전 탈출 → 자유 노드 (절대좌표로 전환, parentNode 제거)
                    nextNodes = nextNodes.map(n => n.id !== nodeId ? n :
                        { ...n, parentNode: undefined, position: absPos }
                    );
                }
                continue;
            }

            // 부모 없는 노드가 drag 후 부모 위에 드롭된 경우
            const nodesMapFresh = new Map(nextNodes.map(n => [n.id, n]));
            const bestParent = findBestParent(node, nextNodes, validParentTypes, nodesMapFresh);
            if (bestParent) {
                const newParentAbs = getAbsolutePosition(bestParent.id, nodesMapFresh);
                const relX = Math.max(LAYOUT.PADDING, absPos.x - newParentAbs.x);
                let relY = Math.max(LAYOUT.HEADER_HEIGHT, absPos.y - newParentAbs.y);
                for (const sib of nextNodes.filter(n => n.parentNode === bestParent.id && n.id !== nodeId && draggedIds.has(n.id))) {
                    const sH = sib.height || sib.style?.height || 50;
                    if (Math.min(relY + dh, sib.position.y + sH) - Math.max(relY, sib.position.y) > 0) {
                        relY = sib.position.y + sH + LAYOUT.PADDING;
                    }
                }
                nextNodes = nextNodes.map(n => n.id !== nodeId ? n : {
                    ...n,
                    parentNode: bestParent.id,
                    position: { x: relX, y: relY },
                });
            }
        }

        // C: 이동 노드 기준 형제 겹침 해소 (DOWN/RIGHT only → idempotent)
        const siblingAffectedIds = new Set();
        for (const movedId of draggedIds) {
            const { nodes: newNodes, affectedIds } = resolveOverlaps(nextNodes, movedId);
            nextNodes = newNodes;
            for (const id of affectedIds) siblingAffectedIds.add(id);
        }
        // 밀린 형제만 선택적 clamp — 가만히 있는 자식은 절대 건드리지 않음
        if (siblingAffectedIds.size > 0) {
            nextNodes = nextNodes.map(n => {
                if (!siblingAffectedIds.has(n.id)) return n;
                const cx = Math.max(LAYOUT.PADDING, n.position.x);
                const cy = Math.max(LAYOUT.HEADER_HEIGHT, n.position.y);
                return (cx === n.position.x && cy === n.position.y) ? n
                    : { ...n, position: { x: cx, y: cy } };
            });
        }
        // A: 컨테이너 크기 재계산 (bottom-up, position 불변, idempotent)
        nextNodes = recalculateContainerSizes(nextNodes);
        state.setNodes(nextNodes);
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
                onNodeDragStop={handleNodeDragStop}
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
