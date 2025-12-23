# llm-collaboration-helper
LLM Agent 기반 팀 프로젝트 협업 도우미

## 프로젝트 배경 및 목적
팀 프로젝트에서는 협업 과정이 성과에 큰 영향을 미치지만,  
협업 상태를 객관적으로 파악하기는 어려움

본 프로젝트는 협업 도구(GitHub, Notion 등)에서 발생하는 데이터를 분석하여  
팀의 협업 상태를 정량적으로 진단하고,  
LLM Agent를 활용해 이를 이해하기 쉬운 설명과 행동 조언으로 제공하는 것을 목표로 합니다.

## 주요 기능

### 1. 협업 상태 진단
- GitHub / Notion 데이터 수집
- 협업 지표 산출
- Rule 기반으로 팀 협업 상태 판단

### 2. 협업 상태 설명 & 조언 (LLM Agent)
- 분석 결과를 자연어로 요약
- 업무 성격 태깅
- 팀 협업 개선을 위한 행동 조언 제공

## 시스템 아키텍처

- Frontend: React
- Backend: Spring Boot
- LLM Server: ? 
- Database: ?
- Deployment: ?

## 기술 스택

### Frontend
- React
- 

### Backend
- Spring Boot
- Spring Data JPA
- Swagger (OpenAPI)

### LLM
- 
- FastAPI
- Prompt Engineering

### Database
- 

### DevOps / Collaboration
- GitHub (PR 기반 협업)
- Notion (업무 관리)
- Cloudtype (배포)

## 레포지토리 구조

llm-collaboration-helper/
├─ frontend/        # React Frontend
├─ backend/         # Spring Boot Backend
├─ llm/             # Python LLM Server
├─ docs/            # Project Documentation
├─ .github/         # PR Template
└─ README.md

## 협업 방식

- feature/* 브랜치에서 개인 작업
- Pull Request를 통해 develop 브랜치로 병합
- develop 브랜치는 PR 필수 보호 설정 적용 (자세한 규칙은 docs/git-convention.md) 참고)
- Notion을 활용한 이슈 및 일정 관리
