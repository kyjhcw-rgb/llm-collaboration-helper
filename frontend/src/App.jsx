import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useCanvasStore } from "./store/useCanvasStore";
import Landing from "./pages/Landing"; // 1. Landing 컴포넌트 import 추가
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ProfilePage from "./pages/ProfilePage";
import ProjectListPage from "./pages/ProjectListPage";
import ProjectCreatePage from "./pages/ProjectCreatePage";
import CanvasPage from "./pages/CanvasPage";
import Guideline from "./pages/Guideline";

export default function App() {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modifier = isMac ? e.metaKey : e.ctrlKey;

            if (modifier && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    useCanvasStore.getState().redo();
                } else {
                    useCanvasStore.getState().undo();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
                {/* 1. Root 경로를 Landing 페이지로 연결 */}
                <Route path="/" element={<Landing />} />

                {/* 인증 관련 라우트 */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/profile" element={<ProfilePage />} />

                {/* 프로젝트 관련 라우트 */}
                <Route path="/projects" element={<ProjectListPage />} />
                <Route path="/projects/new" element={<ProjectCreatePage />} />

                {/* 캔버스 라우트 (중복 제거 완료) */}
                <Route path="/canvas/demo" element={<CanvasPage isDemo={true} />} />
                <Route path="/canvas/:projectId" element={<CanvasPage />} />

                {/* 가이드라인 라우트 */}
                <Route path="/guideline" element={<Guideline />} />
            </Routes>
        </BrowserRouter>
    );
}
