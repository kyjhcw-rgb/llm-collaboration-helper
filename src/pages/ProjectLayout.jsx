import { Outlet, useParams } from "react-router-dom";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

export default function ProjectLayout() {
  // URL에서 projectId 추출
  const { projectId } = useParams();

  return (
    <div>
      {/* 상단 헤더 */}
      <Header projectId={projectId} />

      <div style={{ display: "flex" }}>
        {/* 좌측 사이드바 */}
        <Sidebar projectId={projectId} />

        {/* 메인 콘텐츠 영역 */}
        <main style={{ flex: 1, padding: "20px" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
