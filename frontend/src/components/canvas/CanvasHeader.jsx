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
        // 1. 브라우저에 저장된 JWT 토큰 삭제 (실질적인 로그아웃 처리)
        localStorage.removeItem('accessToken');

        // 2. 스토어에 남아있는 현재 캔버스 및 프로젝트 정보 완벽 초기화
        useCanvasStore.getState().resetProject();

        // 3. 로그인 페이지로 이동
        navigate('/login');
    };

    // 로고를 누르면 프로젝트 목록 화면(로비)으로 이동하게 해주는 함수
    const goToProjectList = () => {
        navigate('/projects');
    };

    // 스토어에서 서버 저장 함수 및 버전 상태/함수 가져오기 추가
    const {
        saveProjectToServer,
        commitVersionToServer,
        currentProjectId,
        currentVersion,
        availableVersions,
        loadProjectFromServer,
        loadVersionsFromServer,
        deleteVersionFromServer
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

    // [동작 1] 단순히 현재 작업 중인 상태를 DB 라이브 테이블에 덮어씀 (버전 추가 X)
    const handleLiveSync = async () => {
        await saveProjectToServer();
        alert("현재 다이어그램 상태가 캔버스 라이브 DB에 동기화되었습니다.");
    };

    // [동작 2] 팀원들과 합의된 현재 상태를 불변의 역사(Version)로 영구 박제함
    const handleCommit = async () => {
        const commitMessage = window.prompt(
            "버전 히스토리에 남길 커밋 메시지를 입력하세요 (예: 결제 모듈 완성)",
            "새로운 다이어그램 구조 업데이트"
        );

        // 사용자가 취소를 누르지 않고 내용을 입력한 경우에만 박제 진행
        if (commitMessage !== null) {
            await commitVersionToServer(commitMessage);
        }
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
                            // availableVersions 배열이 객체 배열({versionNumber, commitMessage})로 바뀌었음에 대응
                            <option key={v.versionNumber || v} value={v.versionNumber || v}>
                                Version {v.versionNumber || v} {(v.versionNumber || v) === Math.max(...availableVersions.map(av => av.versionNumber || av)) ? "(최신)" : ""}
                            </option>
                        ))}
                    </select>
                    {/* 현재 선택된 버전을 삭제하는 버튼 */}
                    {availableVersions.length > 0 && (
                        <button
                            className="delete-version-btn"
                            onClick={() => {
                                // 실수로 삭제하는 것 방지
                                if (window.confirm(`정말 버전 ${currentVersion}을 삭제하시겠습니까?`)) {
                                    deleteVersionFromServer(currentVersion);
                                }
                            }}
                            style={{
                                marginLeft: '10px',
                                backgroundColor: '#ff4d4f',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            버전 삭제
                        </button>
                    )}
                </div>

                {/* 변경된 저장 버튼 영역: 라이브 동기화 & 버전 박제 */}
                <div className="action-buttons" style={{ display: 'flex', gap: '8px', marginLeft: '15px' }}>
                    <button className="sync-btn" onClick={handleLiveSync} style={{ padding: '6px 12px', cursor: 'pointer' }}>
                        라이브 동기화
                    </button>
                    <button className="commit-btn" onClick={handleCommit} style={{ padding: '6px 12px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        버전 박제 (Commit)
                    </button>
                </div>
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