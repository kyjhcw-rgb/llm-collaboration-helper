import React from 'react';
import './SidebarLeft.css';

const SidebarLeft = () => {
    // 드래그 시작 시 블록 타입을 전달함
    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div className="sidebar-left">
            {/* 상단: 디렉토리 트리 영역 (위쪽 정렬 및 좌측 밀착) */}
            <div className="directory-container">
                <h2 className="sidebar-title">프로젝트 디렉토리</h2>
                <div className="directory-box">
                    <div className="tree-root">
                        <div className="tree-item project">내 프로젝트</div>
                        <ul className="tree-branch">
                            <li className="tree-item file">로그인 페이지</li>
                            <li className="tree-item file">채팅 페이지</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* 하단: 사용 가능한 블록 팔레트 (Blocks 레이아웃 적용) */}
            <div className="block-palette">
                <div className="blocks-header">Blocks</div>
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