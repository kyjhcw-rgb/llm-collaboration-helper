import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanvasStore } from '../store/useCanvasStore';
import FlowArea from '../components/canvas/FlowArea';
import SidebarLeft from '../components/canvas/SidebarLeft';
import SidebarRight from '../components/canvas/SidebarRight';
import CanvasHeader from '../components/canvas/CanvasHeader';
import '../styles/CanvasPage.css';

export default function CanvasPage() {
    const navigate = useNavigate();

    // 키보드 입력을 감지하여 되돌리기 기능을 실행함
    useEffect(() => {
        const handleKeyDown = (e) => {
            // 입력창 사용 중일 때는 작동하지 않도록 방어함
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Ctrl + Z 또는 Cmd + Z 입력 확인함
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                if (e.shiftKey) {
                    useCanvasStore.temporal.getState().redo(); // 다시 실행함
                } else {
                    useCanvasStore.temporal.getState().undo(); // 되돌림
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="CanvasPage-container" style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden' }}>
            <CanvasHeader />

            {/* 사이드바와 캔버스가 세로로 꽉 차도록 align-items를 설정함 */}
            <div className="CanvasPage-body" style={{ display: 'flex', flexDirection: 'row', flex: 1, width: '100%', overflow: 'hidden', alignItems: 'stretch' }}>
                <SidebarLeft />
                <FlowArea />
                <SidebarRight />
            </div>
        </div>
    );
}