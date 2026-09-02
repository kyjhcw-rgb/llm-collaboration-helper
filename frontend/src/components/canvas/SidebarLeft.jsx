import React, { useState, useMemo } from 'react';
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

    const toggleNode = (id) => {
        setOpenNodes((prev) => ({
            ...prev,
            [id]: prev[id] !== undefined ? !prev[id] : false,
        }));
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

    return (
        <div className="sidebar-left">
            <div className="directory-container">
                <h2 className="sidebar-title">프로젝트 디렉토리</h2>

                <div className="directory-box">
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
                                        title={canDragFiles ? "클릭 시 미리보기, 드래그 시 캔버스에 배치됩니다." : undefined}
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
        </div>
    );
};

export default SidebarLeft;
