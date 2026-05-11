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

          <textarea
            ref={textareaRef}
            onChange={handleResizeHeight}
            className="auto-resize-textarea"
            placeholder="프로젝트에 대한 자세한 설명을 자유롭게 적어주세요."
          ></textarea>
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