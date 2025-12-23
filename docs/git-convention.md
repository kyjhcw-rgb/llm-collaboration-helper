# Git 협업 규칙

## 브랜치 전략
- main: 발표/배포용
- develop: 통합 개발 브랜치
- feature/*: 개인 작업 브랜치

## develop 브랜치 규칙
- develop 브랜치에 직접 push 금지
- 모든 변경은 PR을 통해서만 병합
- develop은 항상 실행 가능한 상태 유지

## PR 규칙
- PR 대상은 develop
- 한 PR = 한 기능
- PR 템플릿 필수 작성

## PR 리뷰
- 최소 1명 확인
- 동작 여부와 의도 위주 리뷰
- 24시간 리뷰 없으면 merge 가능

## 금지 사항
- main / develop 직접 push 금지
- 여러 기능을 한 PR에 포함 금지
