import { BrowserRouter, Routes, Route } from "react-router-dom";

import ProjectCreate from "../pages/ProjectCreate";
import ProjectLayout from "../pages/ProjectLayout";
import DashboardQuality from "../pages/DashboardQuality";
import DashboardTeam from "../pages/DashboardTeam";
import DashboardTrend from "../pages/DashboardTrend";
import Settings from "../pages/Settings";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 첫 화면은 프로젝트 생성 페이지로 연결함 */}
        <Route path="/" element={<ProjectCreate />} />

        {/* 프로젝트 공통 레이아웃 안에 대시보드 메뉴들 중첩해서 넣었어 */}
        <Route path="/projects/:projectId" element={<ProjectLayout />}>
          <Route path="quality" element={<DashboardQuality />} />
          <Route path="team" element={<DashboardTeam />} />
          <Route path="trend" element={<DashboardTrend />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}