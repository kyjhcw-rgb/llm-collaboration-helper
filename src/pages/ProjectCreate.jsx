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
