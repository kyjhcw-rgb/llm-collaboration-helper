import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/ProjectListPage.css';
import usericon from '../images/usericon.png';
import { useCanvasStore } from '../store/useCanvasStore';

export default function ProjectListPage() {
  const navigate = useNavigate();

  const [projects, setProjects] =
    useState([]);

  const loadProject =
    useCanvasStore(
      (state) =>
        state.loadProject
    );

  const deleteProject =
    useCanvasStore(
      (state) =>
        state.deleteProject
    );

  // 저장된 프로젝트 불러오기
  useEffect(() => {
    const savedProjects =
      JSON.parse(
        localStorage.getItem(
          'saved-projects'
        )
      ) || [];

    setProjects(savedProjects);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(
      'accessToken'
    );
    navigate('/login');
  };

  const resetProject =
  useCanvasStore(
    (state) =>
      state.resetProject
  );

  // 프로젝트 이어하기
  const handleOpenProject = (
    project
  ) => {
    loadProject(project);
    navigate('/canvas');
  };

  // 삭제
  const handleDeleteProject = (
    e,
    projectId
  ) => {
    e.stopPropagation();

    const confirmDelete =
      window.confirm(
        '프로젝트를 삭제할까요?'
      );

    if (!confirmDelete) return;

    deleteProject(projectId);

    const updatedProjects =
      projects.filter(
        (project) =>
          project.id !==
          projectId
      );

    setProjects(
      updatedProjects
    );
  };

  return (
    <main className="ProjectListPage-background">
      <header className="ProjectListPage-header">
        <h1>Our Diagram</h1>

        <h2>
          <img
            className="usericon"
            src={usericon}
            alt="user-icon"
          />

          <button
            type="button"
            onClick={
              handleLogout
            }
          >
            로그아웃
          </button>
        </h2>
      </header>

      <section className="ProjectListPage-contents-top">
        <h1>내 프로젝트</h1>

        <button type="button"
        onClick={() => {
            resetProject();
            navigate('/projects/new');
            }}
>
    + 새 프로젝트
    </button>
      </section>

      <section className="ProjectListPage-contents-bottom">
        {projects.length >
        0 ? (
          <div className="project-grid">
            {projects.map(
              (project) => (
                <div
                  key={project.id}
                  className="project-card"
                  onClick={() =>
                    handleOpenProject(
                      project
                    )
                  }
                >
                  <h3>
                    {
                      project.projectName
                    }
                  </h3>

                  <small>
                    {new Date(
                      project.savedAt
                    ).toLocaleString()}
                  </small>
                  
                  {/* 삭제 버튼 */}
                  <button
                    className="delete-btn"
                    onClick={(
                      e
                    ) =>
                      handleDeleteProject(
                        e,
                        project.id
                      )
                    }
                  >
                    삭제
                  </button>


                  

                </div>
              )
            )}
          </div>
        ) : (
          <div
            style={{
              textAlign:
                'center',
              marginTop:
                '50px',
              color: '#888',
            }}
          >
            <p>
              현재 참여 중인
              프로젝트가
              없습니다.
            </p>
            <p>
              새 프로젝트를
              생성하여 협업을
              시작해보세요!
            </p>
          </div>
        )}
      </section>
    </main>
  );
}