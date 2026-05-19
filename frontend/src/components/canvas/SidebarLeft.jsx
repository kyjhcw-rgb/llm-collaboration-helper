import React from 'react';
import './SidebarLeft.css';
import homeIcon from '../../images/home.png';
import { useCanvasStore } from '../../store/useCanvasStore';

const SidebarLeft = () => {
    const projectName =
        useCanvasStore(
            (state) => state.projectName
        );

    const onDragStart = (
        event,
        nodeType
    ) => {
        event.dataTransfer.setData(
            'application/reactflow',
            nodeType
        );

        event.dataTransfer.effectAllowed =
            'move';
    };

    return (
        <div className="sidebar-left">
            {/* 상단 */}
            <div className="directory-container">
                <h2 className="sidebar-title">
                    프로젝트 디렉토리
                </h2>

                <div className="directory-box">
                    <div className="tree-root">
                        <div className="tree-item-project">
                            <img src={homeIcon} alt="home" className="project-home-icon"/>
                            {projectName || '내 프로젝트'}

                        </div>

                    </div>
                </div>
            </div>

            {/* 하단 */}
            <div className="block-palette">
                <div className="blocks-header">
                    블록
                </div>

                <div className="block-list">
                    <div
                        className="drag-block feature"
                        draggable
                        onDragStart={(e) =>
                            onDragStart(e, '기능')
                        }
                    >
                        기능
                    </div>

                    <div
                        className="drag-block class"
                        draggable
                        onDragStart={(e) =>
                            onDragStart(e, '클래스')
                        }
                    >
                        클래스
                    </div>

                    <div
                        className="drag-block method"
                        draggable
                        onDragStart={(e) =>
                            onDragStart(e, '메소드')
                        }
                    >
                        메소드
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SidebarLeft;