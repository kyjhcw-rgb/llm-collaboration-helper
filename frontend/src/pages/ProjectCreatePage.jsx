import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../api/http';
import { useCanvasStore } from '../store/useCanvasStore';
import '../styles/ProjectCreatePage.css';

export default function ProjectCreatePage() {
    const navigate = useNavigate();
    const textareaRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);

    const [title, setTitle] = useState('');
    const [framework, setFramework] = useState('');
    const [freedomLevel, setFreedomLevel] = useState(1);
    const [descriptionPrompt, setDescriptionPrompt] = useState('');

    const handleResizeHeight = useCallback(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, []);

    const handleCreate = async () => {
        if (!title.trim()) {
            alert("프로젝트 이름을 입력해주세요.");
            return;
        }
        setIsLoading(true);

        try {
            // 실제 백엔드(DB)에 프로젝트 생성 요청
            const res = await request('/projects', {
                method: 'POST',
                body: JSON.stringify({
                    title: title,
                    framework: framework,
                    freedomLevel: Number(freedomLevel),
                    descriptionPrompt: descriptionPrompt
                })
            });

            // 생성 성공 시 Zustand 스토어에 프로젝트 정보 초기화 및 셋팅
            useCanvasStore.getState().resetProject();
            useCanvasStore.setState({
                currentProjectId: res.id,
                projectName: res.title
            });

            // 백엔드(AI 등)가 자동 생성해둔 다이어그램 초기 데이터가 있다면 로드
            await useCanvasStore.getState().loadProjectFromServer(res.id);

            // 캔버스로 이동
            navigate('/canvas');
        } catch (error) {
            console.error("프로젝트 생성 오류:", error);
            alert("프로젝트 생성에 실패했습니다.");
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <h2>루트 다이어그램 설계 중...</h2>
                <p>작성해주신 초안을 바탕으로 AI가 프로젝트 구조를 그리고 있습니다.</p>
            </div>
        );
    }

    return (
        <div className="create-container">
            <div className="create-box">
                <h1 className="create-title">새 프로젝트 생성</h1>

                <div className="input-group">
                    <label>프로젝트 이름</label>
                    <input
                        type="text"
                        placeholder="프로젝트 이름을 입력하세요"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>

                <div className="row-group">
                    <div className="input-group">
                        <label>프레임워크</label>
                        <input
                            type="text"
                            placeholder="예: React, Spring 등"
                            value={framework}
                            onChange={(e) => setFramework(e.target.value)}
                        />
                    </div>

                    <div className="input-group">
                        <div className="label-with-link">
                            <label>자유도</label>
                            <Link to="/guideline" target="_blank" className="guide-link">
                                (How to use)
                            </Link>
                        </div>
                        <input
                            type="number"
                            min="1"
                            max="3"
                            value={freedomLevel}
                            onChange={(e) => setFreedomLevel(e.target.value)}
                            placeholder="1: 기능, 2: 클래스, 3: 메소드"
                        />
                    </div>
                </div>

                <div className="input-group">
                    <label>초안 설명</label>
                    <textarea
                        ref={textareaRef}
                        onChange={(e) => {
                            handleResizeHeight();
                            setDescriptionPrompt(e.target.value);
                        }}
                        value={descriptionPrompt}
                        className="auto-resize-textarea"
                        placeholder="프로젝트에 대한 자세한 설명을 자유롭게 적어주세요."
                    ></textarea>
                </div>

                <div className="button-group">
                    <button className="submit-btn" onClick={handleCreate}>
                        생성하기
                    </button>
                    <button className="cancel-btn" onClick={() => navigate(-1)}>
                        취소
                    </button>
                </div>
            </div>
        </div>
    );
}