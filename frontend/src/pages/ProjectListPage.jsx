import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/ProjectListPage.css';
import usericon from '../images/usericon.png';
import { useCanvasStore } from '../store/useCanvasStore';
import { request } from '../api/http';

export default function ProjectListPage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [nickname, setNickname] = useState('사용자'); // 닉네임 상태 추가

    const resetProject = useCanvasStore((state) => state.resetProject);
    const loadProjectFromServer = useCanvasStore((state) => state.loadProjectFromServer);

    // 1. 백엔드에서 프로젝트 목록 및 사용자 정보를 불러오기
    useEffect(() => {
        const fetchData = async () => {
            try {
                // 프로젝트 목록 조회
                const projectsData = await request('/projects');
                setProjects(projectsData);

                // 사용자 정보(닉네임) 조회
                // 백엔드 API 경로가 다르다면 수정해 주세요 (예: '/members/me', '/user/profile' 등)
                const userData = await request('/users/me'); 
                if (userData && userData.nickname) {
                    setNickname(userData.nickname);
                }
            } catch (error) {
                console.error("데이터 로드 실패:", error);
            }
        };
        fetchData();
    }, []);

    // 2. 프로필 이동 처리 
    const handleEditProfile = () => {
        navigate('/profile', { state: { nickname } }); 
    };

    const handleLogout = () => {
        localStorage.removeItem('accessToken');
        useCanvasStore.getState().resetProject();
        navigate('/login');
    };

    // 프로젝트 이어하기
    const handleOpenProject = (project) => {
        navigate(`/canvas/${project.id}`);
    };

    // 프로젝트 정보 수정 및 단건 조회 API 활용 로직
    const handleUpdateProject = async (e, project) => {
        e.stopPropagation();

        try {
            const latestProject = await request(`/projects/${project.id}`, { method: 'GET' });

            const newTitle = window.prompt("새로운 프로젝트 이름을 입력하세요:", latestProject.title);
            if (newTitle === null) return;
            if (!newTitle.trim()) {
                alert("프로젝트 이름은 필수 입력 항목입니다.");
                return;
            }

            const updatedProject = await request(`/projects/${project.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    title: newTitle,
                    framework: latestProject.framework,
                    freedomLevel: latestProject.freedomLevel,
                    descriptionPrompt: latestProject.descriptionPrompt
                })
            });

            setProjects((prev) =>
                prev.map((p) => (p.id === project.id ? updatedProject : p))
            );
            alert("프로젝트 이름이 수정되었습니다.");
        } catch (error) {
            console.error("수정 실패:", error);
            alert('프로젝트 수정 처리에 실패했습니다.');
        }
    };

    // 프로젝트 삭제 API 호출
    const handleDeleteProject = async (e, projectId) => {
        e.stopPropagation();

        const confirmDelete = window.confirm('프로젝트를 삭제할까요?');
        if (!confirmDelete) return;

        try {
            await request(`/projects/${projectId}`, { method: 'DELETE' });
            const updatedProjects = projects.filter((project) => project.id !== projectId);
            setProjects(updatedProjects);
        } catch (error) {
            console.error("삭제 실패:", error);
            alert('프로젝트 삭제에 실패했습니다.');
        }
    };

    return (
        
        <main className="ProjectListPage-background">
            <header className="ProjectListPage-header">
                <h1>Our Diagram</h1>
                
                {/* 헤더 우측 사용자 영역 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div 
                        onClick={handleEditProfile} 
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                        title="프로필 수정으로 이동"
                    >
                        <img className="usericon" src={usericon} alt="user-icon" />
                        <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{nickname}님</span>
                    </div>
                    
                    <button type="button" onClick={handleLogout}>로그아웃</button>
                </div>
            </header>

            <section className="ProjectListPage-contents-top">
                <h1>내 프로젝트</h1>
                <button type="button" onClick={() => {
                    resetProject();
                    navigate('/projects/new');
                }}>
                    + 새 프로젝트
                </button>
            </section>

            <section className="ProjectListPage-contents-bottom">
                {projects.length > 0 ? (
                    <div className="project-grid">
                        {projects.map((project) => (
                            <div key={project.id} className="project-card" onClick={() => handleOpenProject(project)}>
                                <h3>{project.title}</h3>
                                <small>{project.framework}</small>

                                <div className="project-card-actions" style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                                    <button
                                        type="button"
                                        className="edit-btn"
                                        onClick={(e) => handleUpdateProject(e, project)}
                                    >
                                        수정
                                    </button>
                                    <button
                                        type="button"
                                        className="delete-btn"
                                        onClick={(e) => handleDeleteProject(e, project.id)}
                                    >
                                        삭제
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', marginTop: '30px', color: '#888' }}>
                        <p>현재 참여 중인 프로젝트가 없습니다. 새 프로젝트를 생성하여 협업을 시작해보세요!</p>
                    </div>
                )}
            </section>
        </main>
    );
}