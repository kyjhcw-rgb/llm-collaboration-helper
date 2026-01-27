import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
// import { fetchTeamDashboard } from "../api/dashboard";

export default function DashboardTeam() {
  const { projectId } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!projectId) return;

    // 🔹 임시 더미 데이터
    const dummyData = {
      aiAdvice: {
        summary: "현재 팀의 협업 상태는 전반적으로 양호합니다.",
        detail:
          "다만 특정 인원에게 커밋이 집중되는 경향이 있으므로 역할 분산을 고려해보세요.",
      },
      members: [
        {
          name: "김철수",
          role: "Frontend",
          activeScore: 82,
        },
        {
          name: "이영희",
          role: "Backend",
          activeScore: 91,
        },
        {
          name: "박민수",
          role: "AI / Data",
          activeScore: 76,
        },
      ],
    };

    // 실제 API 대신 더미 데이터 사용
    setTimeout(() => {
      setData(dummyData);
    }, 500);

    // 🔻 실제 API 연결 시 아래 코드만 되살리면 됨
    // fetchTeamDashboard(projectId).then(setData);
  }, [projectId]);

  if (!data) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h2>팀 & 인사이트</h2>

      <section style={{ marginBottom: "24px" }}>
        <h3>AI 조언</h3>
        <p><strong>요약:</strong> {data.aiAdvice.summary}</p>
        <p><strong>상세:</strong> {data.aiAdvice.detail}</p>
      </section>

      <section>
        <h3>팀원 목록</h3>
        <ul>
          {data.members.map((member, idx) => (
            <li key={idx}>
              {member.name} ({member.role}) — 활동 점수: {member.activeScore}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
