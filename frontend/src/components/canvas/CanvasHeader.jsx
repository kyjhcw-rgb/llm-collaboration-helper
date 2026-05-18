import React from 'react';
import { useNavigate } from 'react-router-dom';
import './CanvasHeader.css';
import { useCanvasStore } from '../../store/useCanvasStore';

const CanvasHeader = () => {
  const navigate = useNavigate();

  // 접속 중인 유저 더미 데이터 배열
  const onlineUsers = [
    { id: 1, name: 'USER 1', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hong' },
    { id: 2, name: 'USER 2', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jeon' }
  ];

  // 로그아웃 버튼을 누르면 첫 화면(랜딩 페이지)으로 돌아가게 해주는 함수
  const handleLogout = () => {
    navigate('/');
  };

  // 로고를 누르면 프로젝트 목록 화면(로비)으로 이동하게 해주는 함수
  const goToProjectList = () => {
    navigate('/projects');
  };
  const saveProject = useCanvasStore(
  (state) => state.saveProject);

const handleSave = () => {
  saveProject();
  alert('저장 완료되었습니다!');};

  return (
    <header className="CanvasPage-header">
      <div className="header-left">
        {/* 로고 영역을 클릭하면 이동 */}
      <h1 onClick={goToProjectList} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
        Our Diagram
      </h1>
      <button className="save-btn" onClick={handleSave}>
          저장
        </button>
      </div>
        
      <div className="header-right">
        
        {/* 접속 중인 멤버 목록을 보여주는 영역 */}
        <div className="online-members">
          {onlineUsers.map(user => (
            <div key={user.id} className="member-avatar">
              <img src={user.avatar} alt={`${user.name} 프로필`} />
              {/* 초록색 온라인 상태 표시 콩알 */}
              <div className="online-dot"></div>
              {/* 마우스 올리면 나오는 이름표*/}
              <span className="tooltip">{user.name}</span>
            </div>
          ))}
        </div>
        
        {/* 로그아웃 버튼 */}
        <button className="logout-btn" onClick={handleLogout}>
          로그아웃
        </button>
      </div>
    </header>
  );
};

export default CanvasHeader;