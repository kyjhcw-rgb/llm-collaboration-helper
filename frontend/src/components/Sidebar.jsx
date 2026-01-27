import { NavLink, useParams } from "react-router-dom";

export default function Sidebar() {
  const { projectId } = useParams();

  return (
    <aside
      style={{
        width: "220px",
        borderRight: "1px solid #ddd",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <nav>
        <ul style={{ listStyle: "none", padding: 0 }}>
          <li>
            <NavLink to={`/projects/${projectId}/quality`}>
              빌드 & 퀄리티
            </NavLink>
          </li>
          <li>
            <NavLink to={`/projects/${projectId}/team`}>
              팀 & 인사이트
            </NavLink>
          </li>
          <li>
            <NavLink to={`/projects/${projectId}/trend`}>
              협업 추세
            </NavLink>
          </li>
          <li style={{ marginTop: "16px" }}>
            <NavLink to={`/projects/${projectId}/settings`}>
              설정
            </NavLink>
          </li>
        </ul>
      </nav>
    </aside>
  );
}
