import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './CanvasHeader.css';
import { useCanvasStore } from '../../store/useCanvasStore';

const CanvasHeader = () => {
    const navigate = useNavigate();

    // 접속 중인 유저 더미 데이터 배열
    const onlineUsers = [
        { id: 1, name: 'USER 1', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hong' },
        { id: 2, name: 'USER 2', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jeon' }
    ];

    // 로그아웃 버튼을 누르면 첫 화면(랜딩 페이지)으로 돌아가게 해주는 함수
    const handleLogout = () => {
        navigate('/');
    };

    // 로고를 누르면 프로젝트 목록 화면(로비)으로 이동하게 해주는 함수
    const goToProjectList = () => {
        navigate('/projects');
    };

    // 스토어에서 서버 저장 함수 및 버전 상태/함수 가져오기 추가
    const {
        saveProjectToServer,
        currentProjectId,
        currentVersion,
        availableVersions,
        loadProjectFromServer,
        loadVersionsFromServer
    } = useCanvasStore();

    // 캔버스 진입 시 버전 목록 불러오기
    useEffect(() => {
        if (currentProjectId) {
            loadVersionsFromServer(currentProjectId);
        }
    }, [currentProjectId, currentVersion, loadVersionsFromServer]);

    // 버전 선택 시 다이어그램 불러오기
    const handleVersionChange = async (e) => {
        const targetVersion = Number(e.target.value);
        if (currentProjectId && targetVersion) {
            await loadProjectFromServer(currentProjectId, targetVersion);
        }
    };

    const handleSave = () => {
        // 백엔드로 저장 요청 전송
        saveProjectToServer();
    };

    return (
        <header className="CanvasPage-header">
            <div className="header-left">
                {/* 로고 영역을 클릭하면 이동 */}
                <h1 onClick={goToProjectList} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    Our Diagram
                </h1>

                {/* 버전 선택 드롭다운 영역 */}
                <div className="version-select-container">
                    <select
                        value={currentVersion || ""}
                        onChange={handleVersionChange}
                        className="version-dropdown"
                    >
                        {availableVersions.map((v) => (
                            <option key={v} value={v}>
                                Version {v} {v === Math.max(...availableVersions) ? "(최신)" : ""}
                            </option>
                        ))}
                    </select>
                </div>

                <button className="save-btn" onClick={handleSave}>
                    저장
                </button>
            </div>

            <div className="header-right">
                {/* 접속 중인 멤버 목록을 보여주는 영역 */}
                <div className="online-members">
                    {onlineUsers.map(user => (
                        <div key={user.id} className="member-avatar">
                            <img src={user.avatar} alt={`${user.name} 프로필`} />
                            {/* 초록색 온라인 상태 표시 콩알 */}
                            <div className="online-dot"></div>
                            {/* 마우스 올리면 나오는 이름표*/}
                            <span className="tooltip">{user.name}</span>
                        </div>
                    ))}
                </div>

                {/* 로그아웃 버튼 */}
                <button className="logout-btn" onClick={handleLogout}>
                    로그아웃
                </button>
            </div>
        </header>
    );
};

export default CanvasHeader;