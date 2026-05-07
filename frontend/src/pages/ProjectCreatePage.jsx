import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/ProjectCreatePage.css';

export default function ProjectCreatePage() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreate = () => {
    setIsLoading(true);

    /* 백엔드 연결할 때 수정할 곳 시작 */
    // 나중에 백엔드 API가 완성되면 아래 타이머 부분을 지우고 진짜 API 호출 코드를 넣음
    setTimeout(() => {
      // 3초 뒤에 완료되었다고 치고 다음 페이지로 넘김
      navigate('/canvas');
    }, 3000);
    /* 백엔드 연결할 때 수정할 곳 끝 */
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
          <input type="text" placeholder="프로젝트 이름을 입력하세요" />
        </div>

        {/* 두 칸을 한 줄로 나란히 묶기 위한 그룹 박스 */}
        <div className="row-group">
          <div className="input-group">
            <label>프레임워크</label>
            <input type="text" placeholder="예: React, Spring 등" />
          </div>

          <div className="input-group">
            <label>자유도 (1~5)</label>
            <input type="number" min="1" max="5" defaultValue="1" />
          </div>
        </div>

        <div className="input-group">
          <label>초안 설명</label>
          {/* 높이를 넉넉하게 잡아둔 커다란 상자 */}
          <textarea 
            rows="8" 
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