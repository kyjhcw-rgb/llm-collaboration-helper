import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/ProjectCreatePage.css';

export default function ProjectCreatePage() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  
  // 텍스트 박스 높이 자동 조절을 위해 DOM 요소에 접근할 ref를 만들어줘
  const textareaRef = useRef(null); 

  // 사용자가 타이핑할 때마다 실행되어서 텍스트 박스 높이를 늘려주는 함수야
  const handleResizeHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // 높이를 한 번 초기화하고
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'; // 스크롤 길이만큼 늘려줘
    }
  }, []);

  const handleCreate = () => {
    setIsLoading(true);

    /* 백엔드 연결 시 진짜 API 호출로 대체할 부분이야 */
    setTimeout(() => {
      // 3초 뒤에 완료되었다고 치고 캔버스 페이지로 넘겨
      navigate('/canvas');
    }, 3000);
  };

  // 로딩 상태일 때는 이 화면(중앙 정렬 스피너)을 보여줘
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
        
        {/* 첫 번째 열: 프로젝트 이름 */}
        <div className="input-group">
          <label>프로젝트 이름</label>
          <input type="text" placeholder="프로젝트 이름을 입력하세요" />
        </div>

        {/* 두 번째 열: 프레임워크 & 자유도 */}
        <div className="row-group">
          <div className="input-group">
            <label>프레임워크</label>
            <input type="text" placeholder="예: React, Spring 등" />
          </div>

          <div className="input-group">
            <div className="label-with-link">
                <label>자유도</label>
                <Link to="/guideline" target="_blank" className="guide-link">(How to use)</Link>
            </div>
            <input type="number" min="1" max="3" defaultValue="1" placeholder="1: 기능, 2: 클래스, 3: 메소드" />
          </div>
        </div>

        {/* 세 번째 열: 초안 설명 */}
        <div className="input-group">
          <label>초안 설명</label>
          <textarea 
            ref={textareaRef}
            onChange={handleResizeHeight}
            className="auto-resize-textarea"
            placeholder="프로젝트에 대한 자세한 설명을 자유롭게 적어주세요. (예: 로그인 기능이 있는 쇼핑몰 메인 페이지)"
          ></textarea>
        </div>

        <div className="button-group">
          <button className="submit-btn" onClick={handleCreate}>생성하기</button>
          <button className="cancel-btn" onClick={() => navigate(-1)}>취소</button>
        </div>
      </div>
    </div>
  );
}