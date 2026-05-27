import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../api/http';
import { useCanvasStore } from '../store/useCanvasStore';
import '../styles/ProjectCreatePage.css';

export default function ProjectCreatePage() {
  const navigate = useNavigate();
  const textareaRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);

  // Zustand 스토어와 상태 관리
  const { projectName, setProjectName } = useCanvasStore();
  const [framework, setFramework] = useState('');
  const [freedomLevel, setFreedomLevel] = useState(1);
  const [descriptionPrompt, setDescriptionPrompt] = useState('');

  const handleResizeHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, []);

  // 🌟 API 연결 부분 (절대 수정 금지)
  const handleCreate = async () => {
    if (!projectName.trim()) {
      alert("프로젝트 이름을 입력해주세요.");
      return;
    }
    setIsLoading(true);

    try {
      const res = await request('/projects', {
        method: 'POST',
        body: JSON.stringify({
          title: projectName,
          framework: framework,
          freedomLevel: Number(freedomLevel),
          descriptionPrompt: descriptionPrompt
        })
      });

      useCanvasStore.getState().resetProject();
      useCanvasStore.setState({
        currentProjectId: res.id,
        projectName: res.title
      });

      await useCanvasStore.getState().loadProjectFromServer(res.id);
      navigate('/canvas');
    } catch (error) {
      console.error("프로젝트 생성 오류:", error);
      alert("프로젝트 생성에 실패했습니다.");
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <h2>루트 다이어그램 설계 중...</h2>
        <p>작성해주신 초안을 바탕으로 AI가 프로젝트 구조를 그리고 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="create-container">
      <div className="create-box">
        <h1 className="create-title">새 프로젝트 생성</h1>

        <div className="input-group">
          <label>프로젝트 이름</label>
          <input
            type="text"
            placeholder="프로젝트 이름을 입력하세요"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
        </div>

        <div className="row-group">
          <div className="input-group">
            <label>프레임워크</label>
            <input
              type="text"
              placeholder="예: React, Spring 등"
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
            />
          </div>

          <div className="input-group">
            <div className="label-with-link">
              <label>자유도</label>
              <Link to="/guideline" target="_blank" className="guide-link">
                (How to use)
              </Link>
            </div>
            <input
              type="number"
              min="1"
              max="3"
              value={freedomLevel}
              onChange={(e) => setFreedomLevel(e.target.value)}
            />
          </div>
        </div>

        {/* 초안 설명 - 마이크 버튼 포함된 레이아웃 */}
        <div className="input-group">
          <label>초안 설명</label>
          <div className="textarea-wrapper">
            <textarea
              ref={textareaRef}
              className="auto-resize-textarea project-description-textarea"
              placeholder="프로젝트에 대한 자세한 설명을 자유롭게 적어주세요."
              value={descriptionPrompt}
              onChange={(e) => {
                handleResizeHeight();
                setDescriptionPrompt(e.target.value);
              }}
            ></textarea>
            
            {/* 음성 인식 버튼: 추후 로직 연결 시 onClick에 함수만 넣으면 됩니다 */}
            <button type="button" className="voice-mic-btn" title="음성으로 입력하기">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" fill="currentColor"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="button-group">
          <button className="submit-btn" onClick={handleCreate}>생성하기</button>
          <button className="cancel-btn" onClick={() => navigate(-1)}>취소</button>
        </div>
      </div>
    </div>
  );
}