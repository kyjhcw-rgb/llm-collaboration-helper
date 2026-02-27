import "./ProjectBox.css";
import HelpButton from "./HelpButton";

export default function ProjectBox() {
  return (
    <div className="box">
      <div className="header">
        <div className="box-name">PROJECT</div>
        <div className="top-right">
          <button className="complete">완성</button>
          <button className="delete">삭제</button>
          <input type="checkbox" className="all-checkbox" />
        </div>
      </div>

      <div className="body">
        <img src="/images/file.png" alt="파일" className="file-icon" />
        <div className="name">LLM Agent 프로젝트</div>
        <div className="right">
          <div className="project-dday">D-12</div>
          <img src="/images/협업상태(안정).png" alt="협업상태" className="project-status-stable" />
          <input type="checkbox" className="checkbox" />
        </div>
      </div>

      <div className="footer">
        <HelpButton imgSrc="/images/협업 도움말.png" alt="협업도움말" />
      </div>
    </div>
  );
}
