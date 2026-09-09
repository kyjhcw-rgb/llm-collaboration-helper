import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import ReactFlow, { Background, Controls, applyNodeChanges, applyEdgeChanges, useReactFlow, ReactFlowProvider, ConnectionMode, getSmoothStepPath } from 'reactflow';
import 'reactflow/dist/style.css';
import { useCanvasStore, recalculateContainerSizes, LAYOUT } from '../../store/useCanvasStore';
import './FlowArea.css';
import CustomNode from './CustomNode';
import CustomEdge from './CustomEdge';

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

function isNodeRevealed(nodeId, nodesMap) {
    let current = nodesMap.get(nodeId);
    while (current?.parentNode) current = nodesMap.get(current.parentNode);
    if (!current || current.data?.type !== 'feature') return true;
    return current.data?.hidden === false;
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
    const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);
    const edgeTypes = useMemo(() => ({ custom: CustomEdge }), []);

    const { selectedNodeId, setSelectedNodeId, setSelectedEdgeId } = useCanvasStore();
    const { screenToFlowPosition } = useReactFlow();

    const isLive = useCanvasStore(state => state.currentVersion === 'live');
    const userRole = useCanvasStore(state => state.userRole);
    const isEditable = isLive && userRole !== 'GUEST';

    const nodes = useCanvasStore((state) => state.nodes);
    const edges = useCanvasStore((state) => state.edges);
    const myUserId = useCanvasStore((state) => state.myUserId);
    const sendPresenceUpdate = useCanvasStore((state) => state.sendPresenceUpdate);

    // 지금 내가 선택 중인 블록이 바뀔 때마다 팀원들에게 실시간으로 알림.
    // nodes 배열 자체는 위치 변경 등으로 계속 새 참조가 되므로, 실제 선택 id 목록을
    // 문자열로 만들어 그 "값"이 바뀔 때만 전송되도록 한다.
    const selectedIds = useMemo(() => nodes.filter((n) => n.selected).map((n) => n.id), [nodes]);
    const selectedIdsKey = selectedIds.join(',');
    useEffect(() => {
        sendPresenceUpdate(selectedIds);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedIdsKey]);

    const connectingHandleRef = useRef(null);
    const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);

    const closeFile = useCallback((fileId) => {
        if (!isEditable) return;
        const state = useCanvasStore.getState();
        const nextNodes = state.nodes.map(n => n.id !== fileId ? n : {
            ...n,
            data: { ...n.data, hidden: true, lastUpdatedBy: myUserId, lastUpdatedAt: Date.now() },
        });
        state.setNodes(nextNodes);
    }, [isEditable, myUserId]);

    const onNodeContextMenu = useCallback((event, node) => {
        event.preventDefault();
        if (!isEditable || node.data?.type !== 'feature') { setContextMenu(null); return; }
        setContextMenu({ x: event.clientX, y: event.clientY, fileId: node.id });
    }, [isEditable]);

    useEffect(() => {
        if (!contextMenu) return;
        const close = () => setContextMenu(null);
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [contextMenu]);

    const nodesMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
    const getRoot = useCallback((nodeId) => {
        let current = nodesMap.get(nodeId);
        while (current?.parentNode) {
            current = nodesMap.get(current.parentNode);
        }
        return current;
    }, [nodesMap]);

    const revealedNodes = useMemo(
        () => nodes.filter(n => {
            const root = getRoot(n.id);
            if (!root || root.data?.type !== 'feature') return true;
            return root.data?.hidden === false;
        }),
        [nodes, getRoot]
    );

    const openFiles = useMemo(
        () => nodes.filter(n => n.data?.type === 'feature' && n.data?.hidden === false),
        [nodes]
    );

    const visibleNodeIds = useMemo(() => new Set(revealedNodes.map(n => n.id)), [revealedNodes]);

    const displayEdges = useMemo(() => {
        return edges
            .filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
            .map(e => ({ ...e, zIndex: e.id === hoveredEdgeId ? 10 : 0 }));
    }, [edges, visibleNodeIds, hoveredEdgeId]);

    const relatedCallMethods = useMemo(() => {
        if (!selectedNodeId) return [];
        const selectedNode = nodesMap.get(selectedNodeId);
        if (!selectedNode || selectedNode.data?.type !== 'method') return [];

        const relatedIds = new Set();
        edges.forEach(edge => {
            if (edge.source === selectedNodeId) {
                relatedIds.add(edge.target);
            } else if (edge.target === selectedNodeId) {
                relatedIds.add(edge.source);
            }
        });

        return Array.from(relatedIds)
            .map(id => nodesMap.get(id))
            .filter(n => n && n.data?.type === 'method');
    }, [selectedNodeId, nodesMap, edges]);

    const handleNodesChange = useCallback((changes) => {
        if (!isEditable) return;
        const state = useCanvasStore.getState();
        if (state.userRole === 'GUEST') return;

        let nextNodes = applyNodeChanges(changes, state.nodes);
        let nextEdges = state.edges;
        let edgesChanged = false;

        const changedNodeIds = new Set(
            changes.filter(c => c.type === 'position' || (c.type === 'dimensions' && c.resizing)).map(c => c.id)
        );
        nextNodes = nextNodes.map(n => {
            if (changedNodeIds.has(n.id)) {
                return { ...n, data: { ...n.data, lastUpdatedBy: myUserId, lastUpdatedAt: Date.now() } };
            }
            return n;
        });

        for (const change of changes) {
            if (change.type === 'remove') {
                nextEdges = nextEdges.filter(
                    edge => edge.source !== change.id && edge.target !== change.id
                );
                edgesChanged = true;
            }
        }

        if (changes.some(c => c.type === 'remove')) {
            nextNodes = recalculateContainerSizes(nextNodes);
        }

        state.setNodes(nextNodes);
        if (edgesChanged) state.setEdges(nextEdges);
    }, [isEditable, myUserId]);

    const handleNodeDragStop = useCallback((event, draggedNode) => {
        if (!isEditable) return;
        const state = useCanvasStore.getState();
        if (state.userRole === 'GUEST') return;

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
            if (validParentTypes.length === 0) continue;

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

                    const overlapX = Math.min(absPos.x + dw, parentAbs.x + pw) - Math.max(absPos.x, parentAbs.x);
                    const overlapY = Math.min(absPos.y + dh, parentAbs.y + ph) - Math.max(absPos.y, parentAbs.y);

                    if (overlapX > 0 && overlapY > 0) {
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

                const nodesMapCurrent = new Map(nextNodes.map(n => [n.id, n]));
                const otherNodes = nextNodes.filter(n => n.id !== currentParentId && isNodeRevealed(n.id, nodesMapCurrent));
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
                    nextNodes = nextNodes.map(n => n.id !== nodeId ? n :
                        { ...n, parentNode: undefined, position: absPos }
                    );
                }
                continue;
            }

            const nodesMapFresh = new Map(nextNodes.map(n => [n.id, n]));
            const visibleCandidates = nextNodes.filter(n => isNodeRevealed(n.id, nodesMapFresh));
            const bestParent = findBestParent(node, visibleCandidates, validParentTypes, nodesMapFresh);
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

        const siblingAffectedIds = new Set();
        for (const movedId of draggedIds) {
            const { nodes: newNodes, affectedIds } = resolveOverlaps(nextNodes, movedId);
            nextNodes = newNodes;
            for (const id of affectedIds) siblingAffectedIds.add(id);
        }
        if (siblingAffectedIds.size > 0) {
            nextNodes = nextNodes.map(n => {
                if (!siblingAffectedIds.has(n.id)) return n;
                const cx = Math.max(LAYOUT.PADDING, n.position.x);
                const cy = Math.max(LAYOUT.HEADER_HEIGHT, n.position.y);
                return (cx === n.position.x && cy === n.position.y) ? n
                    : { ...n, position: { x: cx, y: cy } };
            });
        }
        nextNodes = recalculateContainerSizes(nextNodes);
        state.setNodes(nextNodes);
    }, [isEditable]);

    const handleEdgesChange = useCallback((chs) => {
        if (!isEditable) return;
        const state = useCanvasStore.getState();
        if (state.userRole === 'GUEST') return;

        const changedEdgeIds = new Set(chs.map(c => c.id));
        const nextEdges = applyEdgeChanges(chs, state.edges).map(e => {
            if (changedEdgeIds.has(e.id)) {
                return { ...e, data: { ...e.data, lastUpdatedBy: myUserId, lastUpdatedAt: Date.now() } };
            }
            return e;
        });

        state.setEdges(nextEdges);
    }, [isEditable, myUserId]);

    const handleConnect = useCallback((params) => {
        if (!isEditable) return;
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
                data: { ...existingEdge.data, badgeCount: currentCount + 1, lastUpdatedBy: myUserId, lastUpdatedAt: Date.now() }
            };
            state.setEdges(newEdges);
        } else {
            const newEdge = {
                ...safeParams,
                id: `edge_${Date.now()}`,
                type: 'custom',
                zIndex: 9999,
                data: { type: 'call', badgeCount: 1, sourceNodeType, lastUpdatedBy: myUserId, lastUpdatedAt: Date.now() }
            };
            state.setEdges(state.edges.concat(newEdge));
        }
    }, [isEditable, myUserId]);

    const onConnectStart = useCallback((event, { nodeId, handleId }) => {
        connectingHandleRef.current = { nodeId, handleId };
    }, []);

    const onConnectEnd = useCallback((event) => {
        if (!isEditable) return;
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
    }, [handleConnect, isEditable]);

    const onDrop = useCallback((event) => {
        event.preventDefault();

        const fileId = event.dataTransfer.getData('application/canvas-file-id');
        if (fileId) {
            if (!isEditable) { alert("읽기 전용 상태입니다."); return; }
            const state = useCanvasStore.getState();
            const targetNode = state.nodes.find(n => n.id === fileId);
            if (!targetNode) return;

            const projectedPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
            const w = targetNode.width || targetNode.style?.width || 400;
            const h = targetNode.height || targetNode.style?.height || 300;

            const nextNodes = state.nodes.map(n => n.id !== fileId ? n : {
                ...n,
                position: { x: projectedPosition.x - w / 2, y: projectedPosition.y - h / 2 },
                data: { ...n.data, hidden: false, lastUpdatedBy: myUserId, lastUpdatedAt: Date.now() },
            });
            state.setNodes(recalculateContainerSizes(nextNodes));
            return;
        }

        if (!isEditable) { alert("읽기 전용 상태입니다."); return; }
        const state = useCanvasStore.getState();
        const type = event.dataTransfer.getData('application/reactflow');
        if (!type) return;

        let nodeClass = 'canvas-node method-node';
        let initialWidth = 150;
        let initialHeight = 50;
        let zIndex = 30;
        let domainType = 'method';

        if (type === '클래스') {
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
            const visibleCandidates = state.nodes.filter(n => isNodeRevealed(n.id, nodesMap));
            const bestParent = findBestParent(newNode, visibleCandidates, validParentTypes, nodesMap);
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
    }, [screenToFlowPosition, isEditable, myUserId]);

    const selectedNode = useMemo(() => nodesMap.get(selectedNodeId), [nodesMap, selectedNodeId]);

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
            {/* 상단 중앙 플로팅 탭 바 — 현재 열려있는(hidden:false) 기능/파일 목록 */}
{openFiles.length > 0 && (
    <div className="canvas-top-tabbar-container">
        <div className="open-files-tabbar">
            {openFiles.map(file => {
                const isSelected = file.id === selectedNodeId;
                return (
                    <div 
                        key={file.id} 
                        className={`open-file-tab ${isSelected ? 'active' : ''}`}
                        onClick={() => setSelectedNodeId(file.id)}
                    >
                        <span className="open-file-tab-label">
                            {file.data?.label || file.data?.name || '기능'}
                        </span>
                        {isEditable && (
                            <button
                                className="open-file-tab-close"
                                title="닫기"
                                onClick={(e) => {
                                    e.stopPropagation(); // 탭 클릭 이벤트와 겹쳐서 선택되는 것 방지
                                    closeFile(file.id);
                                }}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    </div>
)}

            {contextMenu && (
                <div
                    className="canvas-context-menu"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button onClick={() => { closeFile(contextMenu.fileId); setContextMenu(null); }}>
                        파일 닫기
                    </button>
                </div>
            )}

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
                nodes={revealedNodes}
                edges={displayEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                connectionLineComponent={CustomConnectionLine}
                elevateEdgesOnSelect={true}
                connectionMode={ConnectionMode.Loose}
                nodesConnectable={isEditable}
                nodesDraggable={isEditable}
                elementsSelectable={true}
                onlyRenderVisibleElements={true}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={handleConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onNodeDragStop={handleNodeDragStop}
                onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                onNodeContextMenu={onNodeContextMenu}
                onEdgeClick={(_, edge) => setSelectedEdgeId(edge.id)}
                onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
                onEdgeMouseLeave={() => setHoveredEdgeId(null)}
                onPaneClick={() => {
                    setSelectedNodeId(null);
                    setSelectedEdgeId(null);
                    setContextMenu(null);
                }}
                onMoveStart={() => setContextMenu(null)}
                minZoom={0.05}
                maxZoom={2}
                fitView
            >
                <Background color="#aaa" gap={20} variant="dots" />
                <Controls />
            </ReactFlow>

            {selectedNode && selectedNode.data?.type === 'method' && (
                <div className="call-relation-panel" style={{
                    position: 'absolute',
                    bottom: 20,
                    left: 20,
                    right: 20,
                    backgroundColor: '#ffffff',
                    border: '1px solid #ccc',
                    borderRadius: '10px',
                    padding: '15px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 100
                }}>
                    <div style={{ fontSize: '20px',fontWeight: 'bold', marginBottom: '0px', color: '#333' }}>
                        호출 관계 목록 <span style={{ color: '#0056b3' }}>{selectedNode.data?.label}</span>
                    </div>
                    {relatedCallMethods.length > 0 ? (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {relatedCallMethods.map(m => (
                                <span key={m.id} style={{
                                    backgroundColor: '#fff3cd',
                                    border: '1px solid #ffeba2',
                                    color: '#856404',
                                    padding: '5px 10px',
                                    borderRadius: '5px',
                                    fontSize: '20px'
                                }}>
                                    🔹 {m.data?.label}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <div style={{ fontSize: '20px', padding: '6px 10px',color: '#777' }}>연관된 호출 메서드가 없습니다.</div>
                    )}
                </div>
            )}
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
