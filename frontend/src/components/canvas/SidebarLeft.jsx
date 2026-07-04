import React from 'react';
import './SidebarLeft.css';
import homeIcon from '../../images/home.png';
import folderIcon from '../../images/folder.png';
import documentIcon from '../../images/document.png';
import { useCanvasStore } from '../../store/useCanvasStore';

const SidebarLeft = () => {
    const projectName =
        useCanvasStore(
            (state) => state.projectName
        );
    const nodes = useCanvasStore((state) => state.nodes);
    const featureNodes = nodes.filter((node) => node.data.type === 'feature');
    const classNodes = nodes.filter((node) => node.data.type === 'class');
    const methodNodes = nodes.filter((node) => node.data.type === 'method');
    
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
                        <div className="tree-root-project">
                            <img src={homeIcon} alt="home" className="project-home-icon"/>
                            {projectName || '내 프로젝트'}

                        </div>
                        
                        {featureNodes.map(feature => (
                            <div key={feature.id} className="tree-root-item"><img src={folderIcon} alt="folder" className="project-folder-icon"/>{feature.data.label}
                            
                            {classNodes.filter(cls => cls.parentNode === feature.id).map(cls => (
                                 <div key={cls.id} className="tree-root-item"> <img src={documentIcon} alt="document" className="project-document-icon"/> {cls.data.label}
                                 
                                 {methodNodes.filter(method => method.parentNode === cls.id).map(method => (
                                    <div key={method.id} className="tree-root-item">🔹 {method.data.label}
                                    
                                    </div>
            ))}
        </div>
      ))}
  </div>
))}
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