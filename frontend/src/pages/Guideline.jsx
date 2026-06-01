import { useState } from "react";
import "../styles/Guideline.css";

export default function Guideline() {
  const [level, setLevel] = useState(null);

  return (
    <div className="guideline-container">
      <h1>자유도 사용 가이드</h1>

      <div className="level-buttons">
        <button className={level === 1 ? "active" : ""} onClick={() => setLevel(1)}>Level 1 | 엄격</button>
        <button className={level === 2 ? "active" : ""} onClick={() => setLevel(2)}>Level 2 | 균형</button>
        <button className={level === 3 ? "active" : ""} onClick={() => setLevel(3)}>Level 3 | 자율</button>
      </div>

      {level === 1 && (
        <div className="guide-content">
          <h2>설계 구조 중심</h2>
          <p>인터페이스와 메서드 뼈대만 생성합니다.</p>

          <h3>초안 설명 권장 길이</h3>
          <p>-자 이상</p>

          <h3>추천 상황</h3>
          <ul>
            <li>아키텍처 설계</li>
            <li>객체지향 구조 학습</li>
          </ul>
        </div>
      )}

      {level === 2 && (
        <div className="guide-content">
          <h2>실용성 중심</h2>
          <p>JPA, Lombok 등 범용 라이브러리를 활용합니다.</p>

          <h3>초안 설명 권장 길이</h3>
          <p>-자 이상</p>

          <h3>추천 상황</h3>
          <ul>
            <li>CRUD 개발</li>
            <li>실무 수준 코드 생성</li>
          </ul>
        </div>
      )}

      {level === 3 && (
        <div className="guide-content">
          <h2>AI 최적화 중심</h2>
          <p>목적에 맞는 전체 구현 코드를 자유롭게 작성합니다.</p>

          <h3>초안 설명 권장 길이</h3>
          <p>-자 이상</p>

          <h3>추천 상황</h3>
          <ul>
            <li>전체 프로젝트 생성</li>
          </ul>
        </div>
      )}
    </div>
  );
}