import React, { useState } from 'react';
import './SidebarLeft.css';
import homeIcon from '../../images/home.png';
import folderIcon from '../../images/folder.png';
import documentIcon from '../../images/document.png';
import { useCanvasStore } from '../../store/useCanvasStore';

const SidebarLeft = () => {
    const projectName = useCanvasStore((state) => state.projectName);
    const nodes = useCanvasStore((state) => state.nodes);

    // 🌟 디렉토리 트리 항목 열림/닫힘 상태 관리 ({ [nodeId]: boolean })
    const [openNodes, setOpenNodes] = useState({});

    // 🌟 노드 토글 함수 (열려있으면 닫고, 닫혀있으면 엶)
    const toggleNode = (id) => {
        setOpenNodes((prev) => ({
            ...prev,
            [id]: prev[id] !== undefined ? !prev[id] : false, // 기본 열림 상태에서 클릭 시 닫힘
        }));
    };

    const featureNodes = nodes.filter((node) => node.data.type === 'feature');
    const classNodes = nodes.filter((node) => node.data.type === 'class');
    const methodNodes = nodes.filter((node) => node.data.type === 'method');

    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div className="sidebar-left">
            {/* 상단: 프로젝트 디렉토리 영역 */}
            <div className="directory-container">
                <h2 className="sidebar-title">프로젝트 디렉토리</h2>

                <div className="directory-box">
                    <div className="tree-root">
                        <div className="tree-root-project">
                            <img src={homeIcon} alt="home" className="project-home-icon" />
                            {projectName || '내 프로젝트'}
                        </div>

                        {/* 기능 ➔ 클래스 ➔ 메소드 (트리 구조) */}
                        {featureNodes.map((feature) => {
                            const isFeatureExpanded = openNodes[feature.id] ?? true; // 기본값: 열림

                            return (
                                <div key={feature.id} className="tree-root-item">
                                    {/* 기능(Feature) 타이틀 & 화살표 */}
                                    <div className="tree-item-title" onClick={() => toggleNode(feature.id)}>
                                        <span className="tree-arrow">
                                            {isFeatureExpanded ? '▼' : '▶'}
                                        </span>
                                        <img src={folderIcon} alt="folder" className="project-folder-icon" />
                                        <span>{feature.data.label}</span>
                                    </div>

                                    {/* 하위 클래스(Class) 목록 */}
                                    {isFeatureExpanded && (
                                        <div className="tree-branch">
                                            {classNodes
                                                .filter((cls) => cls.parentNode === feature.id)
                                                .map((cls) => {
                                                    const isClassExpanded = openNodes[cls.id] ?? true;

                                                    return (
                                                        <div key={cls.id} className="tree-node-group">
                                                            {/* 클래스 타이틀 & 화살표 */}
                                                            <div className="tree-item-title" onClick={() => toggleNode(cls.id)}>
                                                                <span className="tree-arrow">
                                                                    {isClassExpanded ? '▼' : '▶'}
                                                                </span>
                                                                <img src={documentIcon} alt="document" className="project-document-icon" />
                                                                <span>{cls.data.label}</span>
                                                            </div>

                                                            {/* 하위 메소드(Method) 목록 */}
                                                            {isClassExpanded && (
                                                                <div className="tree-branch">
                                                                    {methodNodes
                                                                        .filter((method) => method.parentNode === cls.id)
                                                                        .map((method) => (
                                                                            <div key={method.id} className="tree-item-title method-item">
                                                                                <span className="tree-bullet">🔹</span>
                                                                                <span>{method.data.label}</span>
                                                                            </div>
                                                                        ))}
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

            {/* 하단: Blocks 영역 (드롭다운 없이 단순 블록 목록) */}
            <div className="block-palette">
                <div className="blocks-header">블록</div>

                <div className="block-list">
                    <div
                        className="drag-block feature"
                        draggable
                        onDragStart={(e) => onDragStart(e, '기능')}
                    >
                        기능
                    </div>
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
