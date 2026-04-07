import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Landing.css";
import logoimage from "../images/logo1.png";

export default function Landing() {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate("/login");
  };

  return (
    <div className="landing-container">
      {/* 로고 이미지 */}
      <img className="logo-image" src={logoimage} alt="logo" />

      {/* 메인 텍스트 박스 */}
      <div className="logo-box">
        <div className="our-diagram">Our Diagram</div>
      </div>

      {/* 시작하기 버튼 */}
      <button className="start-btn" onClick={handleStart}>
        시작하기
      </button>
    </div>
  );
}
