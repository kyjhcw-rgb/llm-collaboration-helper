import { useEffect, useRef, useState } from 'react';

// 마이크 녹음(캡처)만 담당하는 훅. 녹음이 끝나면(onStop) Blob을 그대로 넘겨줄 뿐,
// 그 Blob으로 뭘 할지(state에 보관/즉시 업로드 등)는 사용하는 쪽에서 결정한다.
export function useAudioRecorder({ onStop } = {}) {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const streamRef = useRef(null);
    const onStopRef = useRef(onStop);
    onStopRef.current = onStop; // 매 렌더마다 최신 콜백을 갖도록 갱신
    const startingRef = useRef(false); // 시작 처리 중 여부를 동기적으로 체크 (연타 시 스트림이 중복 생성되는 것 방지)

    useEffect(() => {
        // 페이지를 벗어날 때 마이크가 계속 켜져 있지 않도록 정리
        return () => {
            streamRef.current?.getTracks().forEach((t) => t.stop());
        };
    }, []);

    const startRecording = async () => {
        // isRecording(state)은 반영 시차가 있어 연타를 못 막으므로, ref로 동기 차단
        if (startingRef.current || mediaRecorderRef.current?.state === 'recording') return;
        startingRef.current = true;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            audioChunksRef.current = [];

            const recorder = new MediaRecorder(stream);
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            recorder.onstop = () => {
                // 실제로 녹음된 mimeType을 그대로 사용 (브라우저마다 webm/mp4 등으로 다를 수 있음)
                const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
                setIsRecording(false);
                streamRef.current?.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
                onStopRef.current?.(blob);
            };

            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
        } catch (err) {
            console.error('마이크 접근 실패:', err);
            alert('마이크를 사용할 수 없습니다. 브라우저 권한을 확인해주세요.');
        } finally {
            startingRef.current = false;
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    };

    const toggleRecording = () => {
        if (isRecording) stopRecording();
        else startRecording();
    };

    return { isRecording, mediaRecorderRef, startRecording, stopRecording, toggleRecording };
}
