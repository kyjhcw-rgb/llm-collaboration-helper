import React from "react";
import "../styles/Lobby.css";
import foldericon from "../images/folder.png";
import stateicon from "../images/signalGreen.png"; // ← 이거 구글 아이콘으로 바꿔주기!
import add from "../images/add.png";
import { useNavigate } from "react-router-dom";

export default function Lobby() {
    const navigate = useNavigate();
  return (
    <div className="background"> 

    <div className="box">
      <div className="header">
        <div className="box-name">PROJECT</div>
        <img src={add} alt="add" className="add" onClick={() => navigate("/projectcreate")}/>
        <div className="top-right">
          <button className="complete">완성</button>
          <button className="delete">삭제</button>
          <input type="checkbox" className="all-checkbox" />
        </div>
      </div>

      <div className="body">
        <img src={foldericon} alt="folder" className="foldericon" />
        <div className="name">LLM Agent 프로젝트</div>
        <div className="right">
            <img src={stateicon} alt="state" className="stateicon" />
            <div className="project-state">ACTIVE</div>
            <input type="checkbox" className="checkbox" />
        </div>
      </div>

    </div>

      
    </div>
  );
}
