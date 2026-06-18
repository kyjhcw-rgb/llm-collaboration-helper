import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CanvasHeader.css';
import { useCanvasStore } from '../../store/useCanvasStore';
import { request } from '../../api/http';

const CanvasHeader = () => {
    const navigate = useNavigate();

    const {
        currentProjectId,
        currentVersion,
        availableVersions,
        userRole, // 내 권한 (OWNER, MEMBER, GUEST)
        saveProjectToServer,
        commitVersionToServer,
        loadProjectFromServer,
        loadVersionsFromServer,
        deleteVersionFromServer
    } = useCanvasStore();

    // 모달 및 멤버 관리 상태
    const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
    const [projectMembers, setProjectMembers] = useState([]);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('MEMBER');

    // 접속 중인 유저 더미 데이터 (추후 Yjs Awareness 연동 가능)
    const onlineUsers = [
        { id: 1, name: '접속자', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hong' }
    ];

    useEffect(() => {
        if (currentProjectId) {
            loadVersionsFromServer(currentProjectId);
        }
    }, [currentProjectId, currentVersion, loadVersionsFromServer]);

    // 모달을 열 때 프로젝트 멤버 목록 조회
    const openMemberModal = async () => {
        try {
            const members = await request(`/projects/${currentProjectId}/members`, { method: 'GET' });
            setProjectMembers(members);
            setIsMemberModalOpen(true);
        } catch (error) {
            console.error("멤버 목록 조회 실패:", error);
            alert("멤버 목록을 불러올 수 없습니다.");
        }
    };

    // 팀원 권한 변경 (OWNER 전용)
    const handleRoleChange = async (userId, newRole) => {
        try {
            await request(`/projects/${currentProjectId}/members/${userId}/role`, {
                method: 'PATCH',
                body: JSON.stringify({ role: newRole })
            });
            // 로컬 상태 즉시 갱신
            setProjectMembers(prev => prev.map(m => m.userId === userId ? { ...m, role: newRole } : m));
            alert("권한이 성공적으로 변경되었습니다.");
        } catch (error) {
            console.error("권한 변경 실패:", error);
            alert("권한 변경에 실패했습니다.");
        }
    };

    // 팀원 내보내기 (OWNER) 또는 자진 탈퇴
    const handleRemoveMember = async (userId, isSelfExit = false) => {
        const msg = isSelfExit ? "정말 이 프로젝트에서 탈퇴하시겠습니까?" : "해당 멤버를 내보내시겠습니까?";
        if (!window.confirm(msg)) return;

        try {
            await request(`/projects/${currentProjectId}/members/${userId}`, { method: 'DELETE' });

            if (isSelfExit) {
                alert("프로젝트에서 탈퇴했습니다.");
                navigate('/projects');
            } else {
                setProjectMembers(prev => prev.filter(m => m.userId !== userId));
                alert("멤버가 제외되었습니다.");
            }
        } catch (error) {
            console.error("멤버 제외 실패:", error);
            alert("처리 중 오류가 발생했습니다.");
        }
    };

    // 팀원 초대
    const handleInviteSubmit = async () => {
        if (!inviteEmail.trim()) {
            alert("초대할 팀원의 이메일을 입력해주세요.");
            return;
        }

        try {
            await request(`/projects/${currentProjectId}/members/invite`, {
                method: 'POST',
                body: JSON.stringify({ email: inviteEmail, role: inviteRole })
            });
            alert(`${inviteEmail} 님을 초대했습니다!`);
            setInviteEmail('');
            setInviteRole('MEMBER');
            // 초대 후 목록 새로고침
            const members = await request(`/projects/${currentProjectId}/members`, { method: 'GET' });
            setProjectMembers(members);
        } catch (error) {
            console.error("초대 실패:", error);
            alert("가입되지 않은 사용자입니다.\n이메일을 다시 확인해 주세요.");
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('accessToken');
        useCanvasStore.getState().resetProject();
        navigate('/login');
    };

    const goToProjectList = () => navigate('/projects');

    const handleVersionChange = async (e) => {
        const targetVersion = Number(e.target.value);
        if (currentProjectId && targetVersion) {
            await loadProjectFromServer(currentProjectId, targetVersion);
        }
    };

    const handleLiveSync = async () => {
        await saveProjectToServer();
        alert("현재 다이어그램 상태가 캔버스 라이브 DB에 동기화되었습니다.");
    };

    const handleCommit = async () => {
        const commitMessage = window.prompt("버전 히스토리에 남길 커밋 메시지를 입력하세요", "새로운 다이어그램 구조 업데이트");
        if (commitMessage !== null) await commitVersionToServer(commitMessage);
    };

    return (
        <header className="CanvasPage-header">
            <div className="header-left">
                <h1 onClick={goToProjectList} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    Our Diagram
                </h1>

                <div className="version-select-container">
                    <select value={currentVersion || ""} onChange={handleVersionChange} className="version-dropdown">
                        {availableVersions.map((v) => (
                            <option key={v.versionNumber || v} value={v.versionNumber || v}>
                                Version {v.versionNumber || v} {(v.versionNumber || v) === Math.max(...availableVersions.map(av => av.versionNumber || av)) ? "(최신)" : ""}
                            </option>
                        ))}
                    </select>
                    {availableVersions.length > 0 && userRole === 'OWNER' && (
                        <button className="delete-version-btn" onClick={() => {
                            if (window.confirm(`정말 버전 ${currentVersion}을 삭제하시겠습니까?`)) deleteVersionFromServer(currentVersion);
                        }}
                                style={{ marginLeft: '10px', backgroundColor: '#ff4d4f', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>
                            버전 삭제
                        </button>
                    )}
                </div>

                <div className="action-buttons" style={{ display: 'flex', gap: '8px', marginLeft: '15px' }}>
                    {userRole !== 'GUEST' && (
                        <>
                            <button className="sync-btn" onClick={handleLiveSync} style={{ padding: '6px 12px', cursor: 'pointer' }}>라이브 동기화</button>
                            <button className="commit-btn" onClick={handleCommit} style={{ padding: '6px 12px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>버전 박제 (Commit)</button>
                        </>
                    )}
                </div>
            </div>

            <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>

                {/* 방장뿐만 아니라 누구나 멤버 관리를 볼 수 있음 (권한 제어는 모달 내부에서) */}
                <button
                    onClick={openMemberModal}
                    style={{ padding: '6px 16px', backgroundColor: '#4953BE', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    멤버 관리
                </button>

                <div className="online-members">
                    {onlineUsers.map(user => (
                        <div key={user.id} className="member-avatar">
                            <img src={user.avatar} alt="프로필" />
                            <div className="online-dot"></div>
                            <span className="tooltip">{user.name}</span>
                        </div>
                    ))}
                </div>

                <button className="logout-btn" onClick={handleLogout}>로그아웃</button>
            </div>

            {/* 종합 멤버 관리 및 초대 모달 */}
            {isMemberModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
                    <div style={{ backgroundColor: 'white', padding: '30px 40px', borderRadius: '12px', width: '600px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', boxSizing: 'border-box' }}>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '20px', color: '#111' }}>프로젝트 멤버 관리</h2>
                            <button onClick={() => setIsMemberModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '26px', cursor: 'pointer', color: '#888', padding: 0, lineHeight: 1 }}>&times;</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b' }}>팀원 목록 ({projectMembers.length}명)</span>
                            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 10px' }}>
                                {projectMembers.map((member, index) => (
                                    <div key={member.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 5px', borderBottom: index !== projectMembers.length - 1 ? '1px solid #f1f5f9' : 'none', gap: '10px' }}>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                            <div style={{ minWidth: '36px', minHeight: '36px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '16px', fontWeight: 'bold', color: '#64748b', flexShrink: 0 }}>
                                                {member.nickname.charAt(0).toUpperCase()}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                                <span style={{ fontSize: '15px', fontWeight: '600', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.nickname}</span>
                                                <span style={{ fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.email}</span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                                            {/* 방장이 다른 팀원 권한 수정 시 보이는 선택지 (멤버 / 게스트) */}
                                            {userRole === 'OWNER' && member.role !== 'OWNER' ? (
                                                <select
                                                    value={member.role}
                                                    onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                                                    style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#334155', outline: 'none', cursor: 'pointer', backgroundColor: 'white' }}
                                                >
                                                    <option value="MEMBER">멤버</option>
                                                    <option value="GUEST">게스트</option>
                                                </select>
                                            ) : (
                                                <span style={{
                                                    padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap',
                                                    backgroundColor: member.role === 'OWNER' ? '#fef08a' : member.role === 'MEMBER' ? '#dbeafe' : '#f1f5f9',
                                                    color: member.role === 'OWNER' ? '#a16207' : member.role === 'MEMBER' ? '#1d4ed8' : '#475569'
                                                }}>
                                                    {/* 역할 뱃지에 표기되는 텍스트 (방장 / 멤버 / 게스트) */}
                                                    {member.role === 'OWNER' ? '방장' : member.role === 'MEMBER' ? '멤버' : '게스트'}
                                                </span>
                                            )}

                                            {userRole === 'OWNER' && member.role !== 'OWNER' && (
                                                <button onClick={() => handleRemoveMember(member.userId, false)} style={{ height: '32px', padding: '0 12px', backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                    삭제
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 새 팀원 초대 영역 */}
                        {userRole === 'OWNER' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b' }}>새 팀원 초대</span>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%' }}>
                                    <input
                                        type="email"
                                        placeholder="초대할 팀원의 이메일"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        style={{ flex: 1, minWidth: 0, height: '44px', padding: '0 16px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                    {/*초대 시 권한 선택 박스*/}
                                    <select
                                        value={inviteRole}
                                        onChange={(e) => setInviteRole(e.target.value)}
                                        style={{ flexShrink: 0, width: '150px', height: '44px', padding: '0 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none', color: '#334155', boxSizing: 'border-box', backgroundColor: 'white', cursor: 'pointer' }}
                                    >
                                        <option value="MEMBER">멤버 (수정 가능)</option>
                                        <option value="GUEST">게스트 (읽기 전용)</option>
                                    </select>
                                    <button
                                        onClick={handleInviteSubmit}
                                        style={{ flexShrink: 0, height: '44px', padding: '0 24px', backgroundColor: '#4953BE', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', boxSizing: 'border-box', whiteSpace: 'nowrap' }}
                                    >
                                        초대하기
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
};

export default CanvasHeader;