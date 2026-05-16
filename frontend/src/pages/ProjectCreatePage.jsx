import React, {
  useState,
  useRef,
  useCallback,
} from 'react';
import {
  useNavigate,
  Link,
} from 'react-router-dom';
import '../styles/ProjectCreatePage.css';

import { useCanvasStore } from '../store/useCanvasStore';

export default function ProjectCreatePage() {
  const [isLoading, setIsLoading] =
    useState(false);

  const navigate = useNavigate();

  const textareaRef = useRef(null);

  // Zustand
  const {
    projectName,
    setProjectName,
  } = useCanvasStore();

  const handleResizeHeight =
    useCallback(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height =
          'auto';

        textareaRef.current.style.height =
          textareaRef.current.scrollHeight +
          'px';
      }
    }, []);

  const handleCreate = () => {
    setIsLoading(true);

    setTimeout(() => {
      navigate('/canvas');
    }, 3000);
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <h2>루트 다이어그램 설계 중...</h2>
        <p>
          작성해주신 초안을 바탕으로 AI가
          프로젝트 구조를 그리고 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="create-container">
      <div className="create-box">
        <h1 className="create-title">
          새 프로젝트 생성
        </h1>

        {/* 프로젝트 이름 */}
        <div className="input-group">
          <label>프로젝트 이름</label>

          <input
            type="text"
            placeholder="프로젝트 이름을 입력하세요"
            value={projectName}
            onChange={(e) =>
              setProjectName(e.target.value)
            }
          />
        </div>

        {/* 프레임워크 & 자유도 */}
        <div className="row-group">
          <div className="input-group">
            <label>프레임워크</label>

            <input
              type="text"
              placeholder="예: React, Spring 등"
            />
          </div>

          <div className="input-group">
            <div className="label-with-link">
              <label>자유도</label>

              <Link
                to="/guideline"
                target="_blank"
                className="guide-link"
              >
                (How to use)
              </Link>
            </div>

            <input
              type="number"
              min="1"
              max="3"
              defaultValue="1"
              placeholder="1: 기능, 2: 클래스, 3: 메소드"
            />
          </div>
        </div>

        {/* 초안 설명 */}
        <div className="input-group">
          <label>초안 설명</label>

          {/* 텍스트창과 버튼을 묶어줄 래퍼를 추가했어 */}
          <div className="textarea-wrapper">
            <textarea
              ref={textareaRef}
              onChange={handleResizeHeight}
              className="auto-resize-textarea project-description-textarea"
              placeholder="프로젝트에 대한 자세한 설명을 자유롭게 적어주세요."
            ></textarea>
            
            {/* 우측 하단에 들어갈 마이크 버튼 추가 */}
            <button type="button" className="voice-mic-btn" title="음성으로 입력하기">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" fill="currentColor"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="button-group">
          <button
            className="submit-btn"
            onClick={handleCreate}
          >
            생성하기
          </button>

          <button
            className="cancel-btn"
            onClick={() => navigate(-1)}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}