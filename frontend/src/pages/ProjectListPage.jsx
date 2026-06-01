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
    const loadProjectFromServer = useCanvasStore((state) => state.loadProjectFromServer);

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
        useCanvasStore.getState().resetProject();
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

    // 프로젝트 정보 수정 및 단건 조회 API 활용 로직
    const handleUpdateProject = async (e, project) => {
        e.stopPropagation(); // 카드 자체의 클릭 이벤트(캔버스 진입) 전파 방지

        try {
            // 수정 프롬프트를 열기 전, 단건 조회 API를 통해 백엔드의 최신 정보를 가져옴
            const latestProject = await request(`/projects/${project.id}`, { method: 'GET' });

            const newTitle = window.prompt("새로운 프로젝트 이름을 입력하세요:", latestProject.title);
            if (newTitle === null) return; // 취소 버튼 선택 시 조기 종료
            if (!newTitle.trim()) {
                alert("프로젝트 이름은 필수 입력 항목입니다.");
                return;
            }

            // 백엔드 프로젝트 수정 API 호출 (DTO 명세 조율)
            const updatedProject = await request(`/projects/${project.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    title: newTitle,
                    framework: latestProject.framework,
                    freedomLevel: latestProject.freedomLevel,
                    descriptionPrompt: latestProject.descriptionPrompt
                })
            });

            // 내부 상태 배열 구조 동기화 갱신
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

                                {/* 하단 액션 버튼 배치 영역 제어 */}
                                <div className="project-card-actions" style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                                    <button
                                        type="button"
                                        className="edit-btn"
                                        onClick={(e) => handleUpdateProject(e, project)}
                                        style={{
                                            padding: '4px 8px',
                                            backgroundColor: '#4caf50',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
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
                    <div style={{ textAlign: 'center', marginTop: '50px', color: '#888' }}>
                        <p>현재 참여 중인 프로젝트가 없습니다.</p>
                        <p>새 프로젝트를 생성하여 협업을 시작해보세요!</p>
                    </div>
                )}
            </section>
        </main>
    );
}