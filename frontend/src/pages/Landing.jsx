import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Landing.css";

export default function Landing() {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate("/login");
  };

  return (
    <div className="landing-container">

      <div className="landing-logo">
        <span>로고</span>
      </div>

      <div className="landing-text-box">
        <h1>
          LLM Agent 기반<br />
          팀 프로젝트 협업 도우미
        </h1>
      </div>

      <button className="start-btn" onClick={handleStart}>
        시작하기
      </button>

    </div>
  );
}
