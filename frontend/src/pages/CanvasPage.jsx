import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isMockMode = searchParams.get('mock') === 'true';
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const setupProjectWorkspace = async () => {
            // ?mock=true 일 때는 백엔드 없이 더미 데이터로 바로 진입
            if (isMockMode) {
                useCanvasStore.getState().loadMockData();
                setIsLoading(false);
                return;
            }

            // 새로고침 등으로 스토어에 ID가 날아갔을 경우 방어 로직
            if (!projectId) {
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

                // [수정] 1. 새로고침을 대비하여 프로젝트 기본 정보(이름 등)를 백엔드에서 조회
                const projectInfo = await request(`/projects/${projectId}`, { method: "GET" });
                useCanvasStore.setState({ projectName: projectInfo.title });

                // [수정] 2. 멤버 목록을 조회하여 내 권한 및 고유 ID 확보
                const members = await request(`/projects/${projectId}/members`, { method: "GET" });
                const myInfo = members?.find(m => m.username === username);

                if (!myInfo) {
                    alert("이 프로젝트에 접근할 권한이 없습니다. (초대가 필요합니다)");
                    navigate("/projects");
                    return;
                }

                // 웹소켓이 최초 연결될 때 올바른 권한/유저ID를 쓰도록 REST 로드 전에 미리 세팅
                useCanvasStore.setState({ userRole: myInfo.role, myUserId: myInfo.userId });

                // 과거 찌꺼기를 지우고 REST API로 도화지를 완전히 새로 세팅.
                // 웹소켓이 아직 없으면 내부에서 자동으로 연결까지 처리함 (중복 연결 방지를 위해 별도 initWebSocket 호출 안 함)
                await useCanvasStore.getState().loadProjectFromServer(projectId, null);

                setIsLoading(false);

            } catch (error) {
                console.error("작업 공간 초기화 실패:", error);
                alert("프로젝트 공간을 조회할 수 없습니다.");
                navigate("/projects");
            }
        };

        setupProjectWorkspace();

        return () => {
            if (!isMockMode) {
                // disconnectWebSocket() 대신 resetProject()를 호출하여 상태를 완전히 비웁니다.
                useCanvasStore.getState().resetProject();
            }
        };
    }, [projectId, navigate, isMockMode]);

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