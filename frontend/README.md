# LLM Project Frontend

LLM 기반 프로젝트 분석 서비스를 위한 프론트엔드 애플리케이션입니다.  
React를 기반으로 프로젝트 생성, 대시보드, 설정 페이지 구조를 구현했습니다.

---

## 📌 현재 구현 상태

- React 기반 프로젝트 구조 세팅 완료
- 프로젝트 생성 페이지 구현
- 프로젝트 단위 라우팅 구조 구현
- 공통 레이아웃 (Header / Sidebar) 구성
- 대시보드 페이지 구조 구현
  - 품질(정합성) 대시보드
  - 팀 & 인사이트 대시보드
  - 협업 추세 대시보드
- API 연동 코드 작성 완료 (현재는 백엔드 미연결 상태)

> ⚠️ 현재 API 서버는 연결되어 있지 않으며,  
> 실제 데이터는 추후 백엔드 연동 또는 더미 데이터로 대체 예정입니다.

---

## 🛠️ 기술 스택

- React 18
- React Router DOM
- JavaScript (ES6+)
- Create React App

---

## 📂 프로젝트 구조
src/
┣ api/ # API 요청 함수
┣ components/ # 공통 컴포넌트 (Header, Sidebar 등)
┣ pages/ # 페이지 단위 컴포넌트
┣ router/ # 라우터 설정
┣ App.js
┗ index.js

---

## ▶️ 실행 방법

### 1. Node.js 설치
- Node.js v18 이상 권장  
  https://nodejs.org

### 2. 프로젝트 클론

```bash
git clone <레포지토리 주소>
cd frontend

npm install // 의존성 설치
npm start // 개발 서버 실행
