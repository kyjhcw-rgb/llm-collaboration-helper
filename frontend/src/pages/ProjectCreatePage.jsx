import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request, requestUpload } from '../api/http';
import { useCanvasStore } from '../store/useCanvasStore';
import '../styles/ProjectCreatePage.css';

export default function ProjectCreatePage() {
  const navigate = useNavigate();
  const textareaRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);

  // Zustand 스토어와 상태 관리
  const { projectName, setProjectName } = useCanvasStore();
  const [framework, setFramework] = useState('');
  const [freedomLevel, setFreedomLevel] = useState(1);
  const [descriptionPrompt, setDescriptionPrompt] = useState('');

  // 녹음 관련 상태 — 녹음 파일은 별도 DB/스토리지 없이 메모리(Blob)에만 보관하다가
  // 프로젝트 생성 직후 백엔드로 바로 전송하고 버림
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    // 페이지를 벗어날 때 마이크가 계속 켜져 있지 않도록 정리
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleResizeHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, []);

  const handleMicClick = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        setAudioBlob(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
        setIsRecording(false);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error('마이크 접근 실패:', err);
      alert('마이크를 사용할 수 없습니다. 브라우저 권한을 확인해주세요.');
    }
  };

  const handleDiscardRecording = () => {
    setAudioBlob(null);
  };

  // 🌟 API 연결 부분 (절대 수정 금지)
  const handleCreate = async () => {
    if (!projectName.trim()) {
      alert("프로젝트 이름을 입력해주세요.");
      return;
    }
    setIsLoading(true);

    try {
      const res = await request('/projects', {
        method: 'POST',
        body: JSON.stringify({
          title: projectName,
          framework: framework,
          freedomLevel: Number(freedomLevel),
          descriptionPrompt: descriptionPrompt
        })
      });

        // 녹음된 음성이 있으면 프로젝트 생성 직후 바로 백엔드로 전송 (로컬에는 보관하지 않음)
        if (audioBlob) {
          try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.webm');
            await requestUpload(`/projects/${res.id}/meeting-audio`, formData);
          } catch (audioError) {
            console.error("음성 파일 전송 실패:", audioError);
            alert("프로젝트는 생성되었지만 녹음 파일 전송에는 실패했습니다.");
          }
        }

        // [수정] 새로 생성된 프로젝트 ID 기반의 URL로 이동
        navigate(`/canvas/${res.id}`);
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
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
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
            />
          </div>
        </div>

        {/* 초안 설명 - 마이크 버튼 포함된 레이아웃 */}
        <div className="input-group">
          <label>초안 설명</label>
          <div className="textarea-wrapper">
            <textarea
              ref={textareaRef}
              className="auto-resize-textarea project-description-textarea"
              placeholder="프로젝트에 대한 자세한 설명을 자유롭게 적어주세요."
              value={descriptionPrompt}
              onChange={(e) => {
                handleResizeHeight();
                setDescriptionPrompt(e.target.value);
              }}
            ></textarea>
            
            <button
              type="button"
              className={`voice-mic-btn ${isRecording ? 'recording' : ''}`}
              title={isRecording ? '녹음 종료' : '음성으로 녹음하기'}
              onClick={handleMicClick}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" fill="currentColor"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="currentColor"/>
              </svg>
            </button>
          </div>

          {isRecording && (
            <div className="recording-status recording-active">
              🔴 녹음 중입니다... 마이크 버튼을 다시 누르면 종료됩니다.
            </div>
          )}
          {!isRecording && audioBlob && (
            <div className="recording-status">
              🎙️ 녹음이 완료되었습니다. 프로젝트 생성 시 함께 전송됩니다.
              <button type="button" className="recording-discard-btn" onClick={handleDiscardRecording}>
                삭제
              </button>
            </div>
          )}
        </div>

        <div className="button-group">
          <button className="submit-btn" onClick={handleCreate}>생성하기</button>
          <button className="cancel-btn" onClick={() => navigate(-1)}>취소</button>
        </div>
      </div>
    </div>
  );
}