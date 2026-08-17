import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useCanvasStore } from "./store/useCanvasStore";
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
            <Routes>{/* 로그인 없이 바로 들어갈 수 있는 더미 라우트 */}
  <Route path="/canvas/demo" element={<CanvasPage isDemo={true} />} />
  
  {/* 동적 라우트 */}
  <Route path="/canvas/:projectId" element={<CanvasPage />} />
                
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/projects" element={<ProjectListPage />}/>
                <Route path="profile" element={<ProfilePage />}/>
                <Route path="/projects/new" element={<ProjectCreatePage />} />
                {/* URL에 projectId를 명시하도록 변경 */}
                <Route path="/canvas/:projectId" element={<CanvasPage />} />
                <Route path="/guideline" element={<Guideline />} />
            </Routes>
        </BrowserRouter>
    );
}
