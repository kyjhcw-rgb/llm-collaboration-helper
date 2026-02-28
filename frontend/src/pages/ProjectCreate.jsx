<<<<<<< HEAD
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import "../style/ProjectBox.css"; 
import folderIcon from "../images/folder.png"; 

export default function ProjectCreate() {
  const navigate = useNavigate();
  // 1부터 7까지 단계를 저장해 둠
  const [step, setStep] = useState(1);
  // 프로젝트 이름을 저장함
  const [projectName, setProjectName] = useState("");

  // 다음 단계로 넘기거나 마지막 단계에서 분석을 시작함
  const handleNext = () => {
    if (step < 7) {
      setStep(step + 1);
    } else {
      alert("프로젝트 분석을 시작합니다."); 
      navigate('/lobby');
    }
  };

  return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center', paddingTop: '50px' }}>
      <div className="box">
        <div className="header" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <img src={folderIcon} alt="folder" style={{ width: '40px' }} />
          <div style={{ border: '1px solid #D0DFFF', padding: '5px 15px', borderRadius: '10px', backgroundColor: '#fff' }}>
             <span style={{ color: '#000', fontWeight: 'bold' }}>
               {projectName || "project name"}
             </span>
          </div>
        </div>

        <div className="content" style={{ padding: '30px', minHeight: '400px' }}>
          {step === 1 && (
            <div>
              <h3>Step 1. 기본 정보</h3>
              <div style={{ marginTop: '10px' }}>
                <label>프로젝트 이름: </label>
                <input 
                  type="text" 
                  value={projectName} 
                  onChange={(e) => setProjectName(e.target.value)} 
                  style={{ marginBottom: '10px', padding: '5px' }} 
                />
              </div>
              <div style={{ marginTop: '10px' }}>
                <h4>프로젝트 실행 날짜</h4>
                시작일: <input type="text" placeholder="년" style={{ width: '50px', marginRight: '5px' }} /> 년 
                <input type="text" placeholder="월" style={{ width: '30px', margin: '0 5px' }} /> 월 
                <input type="text" placeholder="일" style={{ width: '30px', margin: '0 5px' }} /> 일 <br/><br/>
                종료일: <input type="text" placeholder="년" style={{ width: '50px', marginRight: '5px' }} /> 년 
                <input type="text" placeholder="월" style={{ width: '30px', margin: '0 5px' }} /> 월 
                <input type="text" placeholder="일" style={{ width: '30px', margin: '0 5px' }} /> 일
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3>Step 2. 분석 설정 및 생성 (주기)</h3>
              <div style={{ marginTop: '10px' }}>
                분석 주기: <input type="number" style={{ width: '50px' }} /> 일
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3>Step 3. 깃허브 데이터 연결</h3>
              <p>해당 프로젝트의 GITHUB Repository를 연결해주세요.</p>
              <select style={{ padding: '5px', width: '200px' }}>
                <option>레포지토리 선택 (드롭다운)</option>
                <option>user/backend</option>
                <option>user/frontend</option>
              </select>
            </div>
          )}

          {step === 4 && (
            <div>
              <h3>Step 4. 노션 데이터 연결</h3>
              <p>해당 프로젝트에 해당하는 노션 데이터 소스 연결</p>
              <select style={{ padding: '5px', width: '200px' }}>
                <option>태스크 선택 (드롭다운)</option>
                <option>Task 1</option>
              </select>
            </div>
          )}

          {step === 5 && (
            <div>
              <h3>Step 5. 기획서 업로드</h3>
              <input type="file" />
            </div>
          )}

          {step === 6 && (
            <div>
              <h3 style={{ marginBottom: '10px' }}>Step 6. 팀원 매핑</h3>
              <p>팀원의 GITHUB와 NOTION 계정을 매핑해주세요.</p>
              <table style={{ width: '100%', marginTop: '20px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#888' }}>
                    <th>GITHUB</th>
                    <th>NOTION</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ color: '#FF5B5B', fontWeight: 'bold' }}>user-id</td>
                    <td>
                      <select style={{ padding: '5px' }}>
                        <option>선택</option>
                        <option>Notion User A</option>
                      </select>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {step === 7 && (
            <div>
              <h3>Step 7. 설정 완료</h3>
              <p>준비가 완료되었습니다. 아래의 분석 버튼을 눌러주세요.</p>
            </div>
          )}
        </div>

        {/* 버튼 영역 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '20px', gap: '10px' }}>
          <button 
            style={{ border: '1px solid #3C79FE', color: '#3C79FE', padding: '10px 25px', borderRadius: '5px' }} 
            onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}
          >
            {step === 1 ? '닫기' : '이전'}
          </button>
          <button 
            style={{ backgroundColor: '#3C79FE', color: '#fff', padding: '10px 25px', borderRadius: '5px' }} 
            onClick={handleNext}
          >
            {step === 7 ? '분석' : '다음'}
          </button>
        </div>
      </div>
    </div>
  );
}
=======
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProject } from "../api/project";

export default function ProjectCreate() {
  const navigate = useNavigate();

  // 프로젝트 기본 정보 상태
  const [form, setForm] = useState({
    name: "",
    repoUrl: "",
    notionUrl: "",
    startDate: "",
    endDate: "",
    analysisCycle: 24,
  });

  // 기획서 파일 상태 (선택)
  const [file, setFile] = useState(null);

  // input 공통 변경 핸들러
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 프로젝트 생성 요청
  const handleSubmit = async () => {
    try {
      const formData = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, value);
      });

      if (file) {
        formData.append("file", file);
      }

      // 더미 API → { projectId } 반환
      const result = await createProject(formData);

      alert("프로젝트가 생성되었습니다.");

      // 생성 후 첫 대시보드로 이동
      navigate(`/projects/${result.projectId}/quality`);
    } catch (error) {
      console.error(error);
      alert("프로젝트 생성 중 오류가 발생했습니다.");
    }
  };

  return (
    <div
      style={{
        padding: "40px",
        maxWidth: "600px",
        margin: "0 auto",
      }}
    >
      <h1>프로젝트 생성</h1>
      <p>새 프로젝트의 기본 정보를 입력하세요.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <input
          name="name"
          placeholder="프로젝트 명"
          value={form.name}
          onChange={handleChange}
        />

        <input
          name="repoUrl"
          placeholder="GitHub Repository URL"
          value={form.repoUrl}
          onChange={handleChange}
        />

        <input
          name="notionUrl"
          placeholder="Notion 페이지 URL"
          value={form.notionUrl}
          onChange={handleChange}
        />

        <label>
          시작일
          <input
            type="date"
            name="startDate"
            value={form.startDate}
            onChange={handleChange}
          />
        </label>

        <label>
          종료일
          <input
            type="date"
            name="endDate"
            value={form.endDate}
            onChange={handleChange}
          />
        </label>

        <label>
          분석 주기 (시간)
          <input
            type="number"
            name="analysisCycle"
            value={form.analysisCycle}
            onChange={handleChange}
          />
        </label>

        <label>
          기획서 파일 (선택)
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={(e) => setFile(e.target.files[0])}
          />
        </label>

        <button
          onClick={handleSubmit}
          style={{
            marginTop: "20px",
            padding: "10px",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          프로젝트 생성
        </button>
      </div>
    </div>
  );
}
>>>>>>> origin/develop
