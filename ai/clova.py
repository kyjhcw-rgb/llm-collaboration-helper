import sounddevice as sd
import numpy as np
from scipy.io.wavfile import write
import requests
import json
import threading
from dotenv import load_dotenv

load_dotenv()

# --- [1. 설정 영역: 본인의 정보를 입력하세요] ---
INVOKE_URL = "https://clovaspeech-gw.ncloud.com/external/v1/15024/c4de3225b3ec50c9169584d70190755dfdfb078ecb26515de6fd0a2f12288d75"
SECRET_KEY = "12eecb0127c54853aba3dfe80fb944a2".strip()
FILENAME = "meeting_record.wav"
FS = 44100  # 샘플링 레이트

class RealTimeRecorder:
    def __init__(self):
        self.recording = []
        self.is_recording = False

    def callback(self, indata, frames, time, status):
        """마이크 입력 데이터를 계속 리스트에 추가합니다."""
        if self.is_recording:
            self.recording.append(indata.copy())

    def record(self):
        self.is_recording = True
        self.recording = []
        print("🔴 녹음 시작... (종료하려면 [Enter] 키를 누르세요)")
        
        # 비차단(Non-blocking) 방식으로 마이크 입력 시작
        with sd.InputStream(samplerate=FS, channels=1, callback=self.callback):
            input()  # 사용자가 Enter를 누를 때까지 대기
            self.is_recording = False
        
        print("⏹️ 녹음 중지. 파일을 처리 중입니다...")
        
        # 녹음된 데이터를 하나의 배열로 합치고 저장
        audio_data = np.concatenate(self.recording, axis=0)
        write(FILENAME, FS, audio_data)
        return FILENAME

def send_to_clova(file_path):
    print("🚀 클로바노트 API 전송 중...")
    request_url = f"{INVOKE_URL}/recognizer/upload"
    
    params = {
        "language": "ko-KR",
        "completion": "sync", 
        "diarization": {"enable": True}
    }
    
    headers = {'X-CLOVASPEECH-API-KEY': SECRET_KEY}
    
    with open(file_path, 'rb') as f:
        files = {
            'media': (file_path, f, 'audio/wav'), # 파일 정보를 명확히 명시
            'params': (None, json.dumps(params), 'application/json')
        }
        
        # --- [여기서 요청을 보내고 응답을 기다립니다] ---
        response = requests.post(request_url, headers=headers, files=files)
        
        # [추가할 디버깅 코드] 서버 응답 상태를 바로 확인합니다.
        print(f"📡 서버 응답 상태 코드: {response.status_code}") 

        if response.status_code == 200:
            res = response.json()
            print("\n" + "="*50)
            print("📜 [회의록 변환 결과]")
            print("="*50)
            
            # 결과가 비어있지 않은지 확인
            if not res.get('segments'):
                print("⚠️ 변환된 내용이 없습니다. 목소리가 너무 작거나 짧을 수 있습니다.")
            
            for segment in res.get('segments', []):
                speaker = segment.get('speaker', {}).get('name', '알수없음')
                time_stamp = segment.get('start') / 1000
                text = segment.get('text')
                print(f"[{time_stamp:>6.1f}초] {speaker}: {text}")
                
            print("="*50)
            print(f"\n✅ 전체 요약 텍스트: {res.get('text')}")
        else:
            print(f"❌ 에러 발생: {response.status_code}")
            print(f"내용: {response.text}")

# --- [메인 실행] ---
if __name__ == "__main__":
    recorder = RealTimeRecorder()
    audio_file = recorder.record() # 엔터 칠 때까지 녹음
    send_to_clova(audio_file)      # 결과 확인