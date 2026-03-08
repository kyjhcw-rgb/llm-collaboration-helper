import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ProjectBox.css"; 
import folderIcon from "../images/folder.png"; 

export default function ProjectCreate() {
  const navigate = useNavigate();

  // 1~7단계 상태
  const [step, setStep] = useState(1);

  // 프로젝트 기본 정보 상태
  const [form, setForm] = useState({
    name: "",
    repoUrl: "",
    notionUrl: "",
    startDate: "",
    endDate: "",
    analysisCycle: 24,
  });

  // 기획서 파일 상태
  const [file, setFile] = useState(null);

  // input 공통 변경 핸들러
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // 다음 단계 또는 분석 시작
  const handleNext = async () => {
    if (step < 7) {
      setStep(step + 1);
    } else {
      try {
        const formData = new FormData();
        Object.entries(form).forEach(([key, value]) => formData.append(key, value));
        if (file) formData.append("file", file);

        // TODO: 실제 API 호출
        // const result = await createProject(formData);
        // alert("프로젝트가 생성되었습니다.");
        // navigate(`/projects/${result.projectId}/quality`);
        
        alert("프로젝트 분석을 시작합니다.");
        navigate("/lobby"); // 임시 경로
      } catch (err) {
        console.error(err);
        alert("프로젝트 생성 중 오류 발생");
      }
    }
  };

  return (
    <div className="container" style={{ display: "flex", justifyContent: "center", padding: "0px" }}>
      <div className="box">
        {/* 헤더 */}
        <div className="header" style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <img src={folderIcon} alt="folder" style={{ width: "40px" }} />
          <div style={{ border: "1px solid #D0DFFF", padding: "5px 15px", borderRadius: "10px", backgroundColor: "#fff" }}>
            <span style={{ color: "#000", fontWeight: "bold" }}>
              {form.name || "project name"}
            </span>
          </div>
        </div>

        {/* 본문 */}
        <div className="content" style={{ color: "black",padding: "30px", minHeight: "400px" }}>
          {step === 1 && (
            <div>
              <h3>Step 1. 기본 정보</h3>
              <div style={{ marginTop: "10px" }}>
                <label>프로젝트 이름: </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  style={{ marginBottom: "10px", padding: "5px" }}
                />
              </div>
              <div style={{ color: "black",marginTop: "10px" }}>
                <h4>프로젝트 실행 날짜</h4>
                시작일: <input type="date" name="startDate" value={form.startDate} onChange={handleChange} /> <br /><br/>
                종료일: <input type="date" name="endDate" value={form.endDate} onChange={handleChange} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3>Step 2. 분석 설정</h3>
              <label>
                분석 주기 (시간):
                <input
                  type="number"
                  name="analysisCycle"
                  value={form.analysisCycle}
                  onChange={handleChange}
                  style={{ width: "60px", marginLeft: "5px" }}
                />
              </label>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3>Step 3. 깃허브 연결</h3>
              <input
                type="text"
                name="repoUrl"
                placeholder="GitHub Repository URL"
                value={form.repoUrl}
                onChange={handleChange}
                style={{ width: "300px", padding: "5px" }}
              />
            </div>
          )}

          {step === 4 && (
            <div>
              <h3>Step 4. 노션 연결</h3>
              <input
                type="text"
                name="notionUrl"
                placeholder="Notion 페이지 URL"
                value={form.notionUrl}
                onChange={handleChange}
                style={{ width: "300px", padding: "5px" }}
              />
            </div>
          )}

          {step === 5 && (
            <div>
              <h3>Step 5. 기획서 업로드</h3>
              <input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setFile(e.target.files[0])} />
            </div>
          )}

          {step === 6 && (
            <div>
              <h3>Step 6. 팀원 매핑</h3>
              <p>팀원의 GITHUB와 NOTION 계정을 매핑해주세요.</p>
              <table style={{ width: "100%", marginTop: "20px" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#888" }}>
                    <th>GITHUB</th>
                    <th>NOTION</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ color: "#FF5B5B", fontWeight: "bold" }}>user-id</td>
                    <td>
                      <select style={{ padding: "5px" }}>
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

        {/* 버튼 */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "20px", gap: "10px" }}>
          <button
            style={{ border: "1px solid #3C79FE", color: "#3C79FE", padding: "10px 25px", borderRadius: "5px" }}
            onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
          >
            {step === 1 ? "닫기" : "이전"}
          </button>
          <button
            style={{ backgroundColor: "#3C79FE", color: "#fff", padding: "10px 25px", borderRadius: "5px" }}
            onClick={handleNext}
          >
            {step === 7 ? "분석" : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
}
