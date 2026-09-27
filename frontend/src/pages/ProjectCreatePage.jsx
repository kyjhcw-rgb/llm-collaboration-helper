import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request, requestUpload } from '../api/http';
import { useCanvasStore } from '../store/useCanvasStore';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
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

  // 녹음 파일은 메모리(Blob)에만 보관하다가, 사용자가 "설명으로 정리하기"를 누르면 전송하고 버림
  const [audioBlob, setAudioBlob] = useState(null);
  const [describing, setDescribing] = useState(false);
  const { isRecording, toggleRecording } = useAudioRecorder({
    onStop: (blob) => {
      if (!blob || blob.size === 0) {
        alert('녹음된 내용이 없습니다.');
        return;
      }
      setAudioBlob(blob);
    },
  });

  const handleResizeHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, []);

  // 녹음 정리 결과처럼 코드로 값이 바뀌어도 높이가 따라가도록
  useEffect(() => {
    handleResizeHeight();
  }, [descriptionPrompt, handleResizeHeight]);

  const handleDiscardRecording = () => {
    setAudioBlob(null);
  };

  // 회의 녹음 → 프로젝트 설명 정리 → 설명란에 이어 붙이기
  const handleDescribe = async () => {
    if (!audioBlob || describing) return;
    setDescribing(true);
    try {
      const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const formData = new FormData();
      formData.append('file', audioBlob, `meeting.${ext}`);
      const res = await requestUpload('/projects/meeting-description', formData);
      const description = (res?.description || '').trim();
      if (description) {
        setDescriptionPrompt((prev) => (prev.trim() ? `${prev.trim()}\n\n${description}` : description));
      }
      setAudioBlob(null);
    } catch (e) {
      console.error('회의 내용 정리 실패:', e);
      alert('회의 내용을 정리하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setDescribing(false);
    }
  };

  const hasPendingAudio = isRecording || describing || !!audioBlob;

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

        // [수정] 새로 생성된 프로젝트 ID 기반의 URL로 이동
        navigate(`/canvas/${res.id}`);
    } catch (error) {
      console.error("프로젝트 생성 오류:", error);
      alert("프로젝트 생성에 실패했습니다.");
      setIsLoading(false);
    }
  };

  // 녹음 중이거나 정리 전/정리 중인 녹음이 있으면 생성을 막는다 (녹음해 두고 잊은 채 생성하는 것 방지)
  const handleSubmit = () => {
    if (hasPendingAudio) return;
    handleCreate();
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
              onClick={toggleRecording}
              disabled={!isRecording && (describing || !!audioBlob)}
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
          {describing && (
            <div className="recording-status">
              ⏳ 회의 내용을 정리하는 중입니다...
            </div>
          )}
          {!isRecording && !describing && audioBlob && (
            <div className="recording-status">
              🎙️ 녹음이 완료되었습니다.
              <button type="button" className="recording-describe-btn" onClick={handleDescribe}>
                설명으로 정리하기
              </button>
              <button type="button" className="recording-discard-btn" onClick={handleDiscardRecording}>
                삭제
              </button>
            </div>
          )}
        </div>

        <div className="button-group">
          <button className="submit-btn" onClick={handleSubmit} disabled={hasPendingAudio}>생성하기</button>
          <button className="cancel-btn" onClick={() => navigate(-1)}>취소</button>
        </div>
      </div>
    </div>
  );
}