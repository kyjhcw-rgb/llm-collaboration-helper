import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Lobby() {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate('/create');
  };

  return (
    <div style={{ 
      backgroundColor: '#4A80F6', // 로그인 화면과 비슷한 파란색 배경
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontFamily: 'sans-serif'
    }}>
      
      {/* 로고 영역 (와이어프레임 참고) */}
      <div style={{ 
        width: '120px', 
        height: '100px', 
        backgroundColor: '#D9D9D9', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        marginBottom: '50px' 
      }}>
        <span style={{ color: '#fff', fontWeight: 'bold' }}>로고</span>
      </div>

      {/* 메인 텍스트 박스 */}
      <div style={{ 
        backgroundColor: '#FFFFFF', 
        padding: '30px 60px', 
        borderRadius: '20px', 
        marginBottom: '80px', 
        textAlign: 'center',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ 
          color: '#4A80F6', // 글씨는 배경과 맞춘 파란색
          margin: 0, 
          fontSize: '36px', 
          lineHeight: '1.6',
          fontWeight: 'bold'
        }}>
          LLM Agent 기반<br />
          팀 프로젝트 협업 도우미
        </h1>
      </div>

      {/* 시작하기 버튼 */}
      <button 
        onClick={handleStart}
        style={{ 
          background: 'none', 
          border: 'none', 
          color: '#FFFFFF', 
          fontSize: '32px', 
          fontWeight: 'bold', 
          borderBottom: '3px solid #FFFFFF', // 흰색 밑줄
          paddingBottom: '5px', 
          cursor: 'pointer' 
        }}
      >
        시작하기
      </button>

    </div>
  );
}