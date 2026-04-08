import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ProjectListPage from "./pages/ProjectListPage";
import ProjectCreatePage from "./pages/ProjectCreatePage";
import CanvasPage from "./pages/CanvasPage";

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />

                {/* 인증 페이지 */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />

                {/* 프로젝트 관리 페이지 */}
                <Route path="/projects" element={<ProjectListPage />} />
                <Route path="/projects/new" element={<ProjectCreatePage />} />

                {/* 다이어그램 캔버스 (에디터) 페이지 */}
                <Route path="/canvas/:projectId" element={<CanvasPage />} />
            </Routes>
        </BrowserRouter>
    );
}