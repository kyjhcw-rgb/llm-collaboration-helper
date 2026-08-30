import React, { useState } from 'react';
import './SidebarLeft.css';
import homeIcon from '../../images/home.png';
import folderIcon from '../../images/folder.png';
import documentIcon from '../../images/document.png';
import { useCanvasStore } from '../../store/useCanvasStore';

const SidebarLeft = () => {
    const projectName = useCanvasStore((state) => state.projectName);
    const nodes = useCanvasStore((state) => state.nodes);
    const userRole = useCanvasStore((state) => state.userRole);
    const isLive = useCanvasStore((state) => state.currentVersion === 'live');
    // 파일 드래그는 공유 캔버스 데이터(위치/표시 여부)를 바꾸는 편집 행위라 GUEST(읽기 전용)는 금지
    const canDragFiles = isLive && userRole !== 'GUEST';

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

    // 디렉토리 트리의 파일(기능) 항목을 캔버스로 드래그 — 새 블록을 만드는 게 아니라
    // 이미 존재하는 그 파일의 블록들을 캔버스에 "표시"하기 위한 용도라 위 onDragStart와는
    // 별개의 dataTransfer 키를 사용한다 (FlowArea의 onDrop에서 이 키 유무로 분기)
    const onFileDragStart = (event, fileId) => {
        event.dataTransfer.setData('application/canvas-file-id', fileId);
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
                                    {/* 파일 타이틀 & 화살표 — 캔버스로 드래그하면 이 파일의 블록들이 표시됨 */}
                                    <div
                                        className="tree-item-title"
                                        draggable={canDragFiles}
                                        onDragStart={canDragFiles ? (e) => onFileDragStart(e, feature.id) : undefined}
                                        onClick={() => toggleNode(feature.id)}
                                        title={canDragFiles ? "캔버스로 드래그하면 이 파일의 블록이 표시됩니다" : undefined}
                                    >
                                        <span className="tree-arrow">
                                            {isFeatureExpanded ? '▼' : '▶'}
                                        </span>
                                        <img src={folderIcon} alt="folder" className="project-folder-icon" />
                                        <span>{feature.data.label}</span>
                                    </div>

                                    {/* 하위 클래스(Class) 목록 + 클래스 없이 파일에 바로 붙은 메소드 */}
                                    {isFeatureExpanded && (
                                        <div className="tree-branch">
                                            {methodNodes
                                                .filter((method) => method.parentNode === feature.id)
                                                .map((method) => (
                                                    <div key={method.id} className="tree-item-title method-item">
                                                        <span className="tree-bullet">🔹</span>
                                                        <span>{method.data.label}</span>
                                                    </div>
                                                ))}
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
