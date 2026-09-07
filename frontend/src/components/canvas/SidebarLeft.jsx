import React, { useState, useMemo, useEffect } from 'react';
import './SidebarLeft.css';
import homeIcon from '../../images/home.png';
import folderIcon from '../../images/folder.png';
import documentIcon from '../../images/document.png';
import { useCanvasStore } from '../../store/useCanvasStore';

const SidebarLeft = () => {
    const projectName = useCanvasStore((state) => state.projectName);
    const nodes = useCanvasStore((state) => state.nodes);
    const edges = useCanvasStore((state) => state.edges);
    const selectedNodeId = useCanvasStore((state) => state.selectedNodeId);
    const setSelectedNodeId = useCanvasStore((state) => state.setSelectedNodeId);
    const userRole = useCanvasStore((state) => state.userRole);
    const isLive = useCanvasStore((state) => state.currentVersion === 'live');
    const canDragFiles = isLive && userRole !== 'GUEST';

    const [openNodes, setOpenNodes] = useState({});
    const [fileContextMenu, setFileContextMenu] = useState(null); // { x, y, fileId } — 파일 우클릭 시 "삭제" 메뉴

    const toggleNode = (id) => {
        setOpenNodes((prev) => ({
            ...prev,
            [id]: prev[id] !== undefined ? !prev[id] : false,
        }));
    };

    // 새 파일(기능 블록) 추가 — 처음엔 캔버스에 안 보이는 상태(hidden)로 생성되고,
    // 사이드바에서 드래그하거나 클릭해야 캔버스에 나타남
    const handleAddFile = () => {
        if (!canDragFiles) return;
        const name = window.prompt('새 파일 이름을 입력하세요', '새 파일');
        if (!name) return;

        const state = useCanvasStore.getState();
        const newFile = {
            id: `feature_${Date.now()}`,
            type: 'custom',
            position: { x: 0, y: 0 },
            width: 400,
            height: 300,
            className: 'canvas-node feature-node',
            style: { width: 400, height: 300, zIndex: 10 },
            data: {
                label: name,
                type: 'feature',
                name,
                description: '',
                hidden: true,
                lastUpdatedBy: state.myUserId,
                lastUpdatedAt: Date.now(),
            },
        };
        state.setNodes([...state.nodes, newFile]);
    };

    // 파일 이름 변경
    const handleRenameFile = (fileId) => {
        if (!canDragFiles) return;
        const state = useCanvasStore.getState();
        const target = state.nodes.find((n) => n.id === fileId);
        if (!target) return;

        const newName = window.prompt('새 파일 이름을 입력하세요', target.data?.label || target.data?.name || '');
        if (!newName || newName === target.data?.label) return;

        const nextNodes = state.nodes.map((n) => n.id !== fileId ? n : {
            ...n,
            data: { ...n.data, label: newName, name: newName, lastUpdatedBy: state.myUserId, lastUpdatedAt: Date.now() },
        });
        state.setNodes(nextNodes);
    };

    // 파일 삭제 — 파일과 그 안의 모든 클래스/메소드, 관련 엣지까지 함께 제거
    const handleDeleteFile = (fileId) => {
        if (!canDragFiles) return;
        if (!window.confirm('이 파일을 삭제하시겠습니까? 안에 있는 클래스/메소드도 모두 함께 삭제됩니다.')) return;

        const state = useCanvasStore.getState();
        const toRemove = new Set([fileId]);
        let changed = true;
        while (changed) {
            changed = false;
            for (const n of state.nodes) {
                if (n.parentNode && toRemove.has(n.parentNode) && !toRemove.has(n.id)) {
                    toRemove.add(n.id);
                    changed = true;
                }
            }
        }

        state.setNodes(state.nodes.filter((n) => !toRemove.has(n.id)));
        state.setEdges(state.edges.filter((e) => !toRemove.has(e.source) && !toRemove.has(e.target)));
        if (selectedNodeId && toRemove.has(selectedNodeId)) setSelectedNodeId(null);
    };

    const featureNodes = nodes.filter((node) => node.data.type === 'feature');
    const classNodes = nodes.filter((node) => node.data.type === 'class');
    const methodNodes = nodes.filter((node) => node.data.type === 'method');

    const handleFeatureClick = (featureId) => {
        const state = useCanvasStore.getState();
        const myUserId = state.myUserId;

        const nextNodes = state.nodes.map((node) => {
            if (node.data?.type === 'feature') {
                if (node.id === featureId) {
                    return {
                        ...node,
                        position: { x: 100, y: 100 },
                        data: { ...node.data, hidden: false, lastUpdatedBy: myUserId, lastUpdatedAt: Date.now() },
                    };
                }
                return {
                    ...node,
                    data: { ...node.data, hidden: true, lastUpdatedBy: myUserId, lastUpdatedAt: Date.now() },
                };
            }
            return node;
        });

        state.setNodes(nextNodes);
        setSelectedNodeId(featureId);
    };

    const relatedMethodIds = useMemo(() => {
        if (!selectedNodeId) return new Set();
        const selectedNode = nodes.find(n => n.id === selectedNodeId);
        if (!selectedNode || selectedNode.data?.type !== 'method') return new Set();

        const ids = new Set();
        edges.forEach((e) => {
            if (e.source === selectedNodeId) ids.add(e.target);
            if (e.target === selectedNodeId) ids.add(e.source);
        });
        return ids;
    }, [selectedNodeId, nodes, edges]);

    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    const onFileDragStart = (event, fileId) => {
        event.dataTransfer.setData('application/canvas-file-id', fileId);
        event.dataTransfer.effectAllowed = 'move';
    };

    // 다른 곳을 클릭하면 파일 삭제 메뉴 닫기
    useEffect(() => {
        if (!fileContextMenu) return;
        const close = () => setFileContextMenu(null);
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [fileContextMenu]);

    return (
        <div className="sidebar-left">
            <div className="directory-container">
                <div className="directory-header">
                    <h2 className="sidebar-title">프로젝트 디렉토리</h2>
                    {canDragFiles && (
                        <button className="add-file-btn" title="새 파일 추가" onClick={handleAddFile}>
                            +
                        </button>
                    )}
                </div>

                <div
                    className="directory-box"
                    onContextMenu={(e) => {
                        e.preventDefault();
                        if (!canDragFiles) return;
                        setFileContextMenu({ x: e.clientX, y: e.clientY, fileId: null });
                    }}
                >
                    <div className="tree-root">
                        <div className="tree-root-project">
                            <img src={homeIcon} alt="home" className="project-home-icon" />
                            {projectName || '내 프로젝트'}
                        </div>

                        {featureNodes.map((feature) => {
                            const isFeatureExpanded = openNodes[feature.id] ?? true;
                            const isFeatureSelected = feature.id === selectedNodeId || feature.data?.hidden === false;

                            return (
                                <div key={feature.id} className="tree-root-item">
                                    <div
                                        className={`tree-item-title ${isFeatureSelected ? 'highlight-blue' : ''}`}
                                        draggable={canDragFiles}
                                        onDragStart={canDragFiles ? (e) => onFileDragStart(e, feature.id) : undefined}
                                        onClick={() => {
                                            toggleNode(feature.id);
                                            handleFeatureClick(feature.id);
                                        }}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (!canDragFiles) return;
                                            setFileContextMenu({ x: e.clientX, y: e.clientY, fileId: feature.id });
                                        }}
                                        title={canDragFiles ? "클릭 시 미리보기, 드래그 시 캔버스에 배치, 우클릭 시 메뉴" : undefined}
                                    >
                                        <span className="tree-arrow">
                                            {isFeatureExpanded ? '▼' : '▶'}
                                        </span>
                                        <img src={folderIcon} alt="folder" className="project-folder-icon" />
                                        <span>{feature.data.label}</span>
                                    </div>

                                    {isFeatureExpanded && (
                                        <div className="tree-branch">
                                            {methodNodes
                                                .filter((method) => method.parentNode === feature.id)
                                                .map((method) => {
                                                    const isSelected = method.id === selectedNodeId;
                                                    const isRelated = relatedMethodIds.has(method.id);

                                                    return (
                                                        <div
                                                            key={method.id}
                                                            className={`tree-item-title method-item ${
                                                                isSelected ? 'highlight-blue' : isRelated ? 'highlight-yellow' : ''
                                                            }`}
                                                            onClick={() => setSelectedNodeId(method.id)}
                                                        >
                                                            <span className="tree-bullet">🔹</span>
                                                            <span>{method.data.label}</span>
                                                        </div>
                                                    );
                                                })}
                                            {classNodes
                                                .filter((cls) => cls.parentNode === feature.id)
                                                .map((cls) => {
                                                    const isClassExpanded = openNodes[cls.id] ?? true;
                                                    const isClassSelected = cls.id === selectedNodeId;

                                                    return (
                                                        <div key={cls.id} className="tree-node-group">
                                                            <div
                                                                className={`tree-item-title ${isClassSelected ? 'highlight-blue' : ''}`}
                                                                onClick={() => {
                                                                    toggleNode(cls.id);
                                                                    setSelectedNodeId(cls.id);
                                                                }}
                                                            >
                                                                <span className="tree-arrow">
                                                                    {isClassExpanded ? '▼' : '▶'}
                                                                </span>
                                                                <img src={documentIcon} alt="document" className="project-document-icon" />
                                                                <span>{cls.data.label}</span>
                                                            </div>

                                                            {isClassExpanded && (
                                                                <div className="tree-branch">
                                                                    {methodNodes
                                                                        .filter((method) => method.parentNode === cls.id)
                                                                        .map((method) => {
                                                                            const isSelected = method.id === selectedNodeId;
                                                                            const isRelated = relatedMethodIds.has(method.id);

                                                                            return (
                                                                                <div
                                                                                    key={method.id}
                                                                                    className={`tree-item-title method-item ${
                                                                                        isSelected ? 'highlight-blue' : isRelated ? 'highlight-yellow' : ''
                                                                                    }`}
                                                                                    onClick={() => setSelectedNodeId(method.id)}
                                                                                >
                                                                                    <span className="tree-bullet">🔹</span>
                                                                                    <span>{method.data.label}</span>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="block-palette">
                <div className="blocks-header">블록</div>

                <div className="block-list">
                    <div
                        className="drag-block class"
                        draggable
                        onDragStart={(e) => onDragStart(e, '클래스')}
                    >
                        클래스
                    </div>
                    <div
                        className="drag-block method"
                        draggable
                        onDragStart={(e) => onDragStart(e, '메소드')}
                    >
                        메소드
                    </div>
                </div>
            </div>

            {fileContextMenu && (
                <div
                    className="sidebar-context-menu"
                    style={{ top: fileContextMenu.y, left: fileContextMenu.x }}
                >
                    <button onClick={() => { handleAddFile(); setFileContextMenu(null); }}>
                        새 파일 추가
                    </button>
                    {fileContextMenu.fileId && (
                        <>
                            <button onClick={() => { handleRenameFile(fileContextMenu.fileId); setFileContextMenu(null); }}>
                                이름 바꾸기
                            </button>
                            <button className="danger" onClick={() => { handleDeleteFile(fileContextMenu.fileId); setFileContextMenu(null); }}>
                                파일 삭제
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default SidebarLeft;
