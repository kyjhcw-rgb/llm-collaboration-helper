import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // 💡 useParams 제거
import { useCanvasStore } from '../store/useCanvasStore';
import { request } from '../api/http';
import FlowArea from '../components/canvas/FlowArea';
import SidebarLeft from '../components/canvas/SidebarLeft';
import SidebarRight from '../components/canvas/SidebarRight';
import CanvasHeader from '../components/canvas/CanvasHeader';
import '../styles/CanvasPage.css';

const parseJwt = (token) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
};

export default function CanvasPage() {
    // URL 파라미터 대신 Zustand 스토어에서 직접 프로젝트 ID를 가져옴
    const currentProjectId = useCanvasStore((state) => state.currentProjectId);
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const setupProjectWorkspace = async () => {
            // 새로고침 등으로 스토어에 ID가 날아갔을 경우 방어 로직
            if (!currentProjectId) {
                alert("프로젝트 정보가 없습니다. 목록에서 다시 접속해주세요.");
                navigate("/projects");
                return;
            }

            try {
                const token = localStorage.getItem("accessToken");
                if (!token) {
                    alert("로그인이 필요합니다.");
                    navigate("/login");
                    return;
                }

                const decoded = parseJwt(token);
                const username = decoded?.sub;

                // Party 테이블을 기준으로 내 역할(Role) 확인
                const members = await request(`/projects/${currentProjectId}/members`, { method: "GET" });
                const myInfo = members?.find(m => m.username === username);

                if (!myInfo) {
                    alert("이 프로젝트에 접근할 권한이 없습니다. (초대가 필요합니다)");
                    navigate("/projects");
                    return;
                }

                const assignedRole = myInfo.role; // 'OWNER', 'MEMBER', 'GUEST'

                // 권한을 바탕으로 웹소켓 연결 및 캔버스 초기화
                useCanvasStore.getState().initWebSocket(currentProjectId, token, assignedRole);
                await useCanvasStore.getState().loadProjectFromServer(currentProjectId, null);

                setIsLoading(false);
            } catch (error) {
                console.error("작업 공간 초기화 실패:", error);
                alert("프로젝트 공간을 조회할 수 없습니다.");
                navigate("/projects");
            }
        };

        setupProjectWorkspace();

        return () => {
            useCanvasStore.getState().disconnectWebSocket();
        };
    }, [currentProjectId, navigate]);

    if (isLoading) {
        return (
            <div style={{
                display: 'flex', width: '100vw', height: '100vh',
                justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa',
                fontSize: '16px', color: '#4953BE', fontWeight: '500'
            }}>
                권한 확인 및 작업 공간을 불러오는 중입니다...
            </div>
        );
    }

    return (
        <div className="CanvasPage-container" style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden' }}>
            <CanvasHeader />
            <div className="CanvasPage-body" style={{ display: 'flex', flexDirection: 'row', flex: 1, width: '100%', overflow: 'hidden', alignItems: 'stretch' }}>
                <SidebarLeft />
                <FlowArea />
                <SidebarRight />
            </div>
        </div>
    );
}