import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useCanvasStore } from "./store/useCanvasStore"; 
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ProjectListPage from "./pages/ProjectListPage";
import ProjectCreatePage from "./pages/ProjectCreatePage";
import CanvasPage from "./pages/CanvasPage";

export default function App() {
    useEffect(() => {
        const handleKeyDown = (e) => {
            // 입력창(input, textarea)에서 입력 중일 때는 단축키가 작동하지 않게 막아야 해
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modifier = isMac ? e.metaKey : e.ctrlKey;

            if (modifier && e.key.toLowerCase() === 'z') {
                if (e.shiftKey) {
                    // Ctrl + Shift + Z: 다시 실행(Redo)이야
                    useCanvasStore.temporal.getState().redo();
                } else {
                    // Ctrl + Z: 되돌리기(Undo)야
                    useCanvasStore.temporal.getState().undo();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/projects" element={<ProjectListPage />} />
                <Route path="/projects/new" element={<ProjectCreatePage />} />
                <Route path="/canvas" element={<CanvasPage />} />
            </Routes>
        </BrowserRouter>
    );
}