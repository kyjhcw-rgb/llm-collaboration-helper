import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/ProjectListPage.css';
import usericon from '../images/usericon.png';
import { useCanvasStore } from '../store/useCanvasStore';
import { request } from '../api/http';

export default function ProjectListPage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);

    const resetProject = useCanvasStore((state) => state.resetProject);
    const loadProjectFromServer = useCanvasStore((state) => state.loadProjectFromServer); // 추가된 부분

    // 백엔드에서 프로젝트 목록 불러오기
    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const data = await request('/projects');
                setProjects(data); // 백엔드 응답(List<ProjectRes>) 세팅
            } catch (error) {
                console.error("프로젝트 로드 실패:", error);
            }
        };
        fetchProjects();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('accessToken');
        navigate('/login');
    };

    // 프로젝트 이어하기
    const handleOpenProject = async (project) => {
        // 1. 스토어에 현재 선택된 프로젝트 ID 셋팅
        useCanvasStore.setState({
            currentProjectId: project.id,
            projectName: project.title
        });

        // 2. 백엔드에서 해당 프로젝트의 캔버스(다이어그램) 데이터 로드 (단절 구간 해결)
        await loadProjectFromServer(project.id);

        // 3. 데이터 동기화 완료 후 화면 이동
        navigate('/canvas');
    };

    // 프로젝트 삭제 API 호출
    const handleDeleteProject = async (e, projectId) => {
        e.stopPropagation();

        const confirmDelete = window.confirm('프로젝트를 삭제할까요?');
        if (!confirmDelete) return;

        try {
            await request(`/projects/${projectId}`, { method: 'DELETE' });
            // 성공 시 화면에서도 제거
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
                <h2>
                    <img className="usericon" src={usericon} alt="user-icon" />
                    <button type="button" onClick={handleLogout}>로그아웃</button>
                </h2>
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

                                <button className="delete-btn" onClick={(e) => handleDeleteProject(e, project.id)}>
                                    삭제
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', marginTop: '50px', color: '#888' }}>
                        <p>현재 참여 중인 프로젝트가 없습니다.</p>
                        <p>새 프로젝트를 생성하여 협업을 시작해보세요!</p>
                    </div>
                )}
            </section>
        </main>
    );
}