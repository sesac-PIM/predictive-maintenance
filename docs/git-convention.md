# Git Convention

## 📌 브랜치 전략

- main: 최종 배포 브랜치
- dev: 개발 통합 브랜치
- feature/*: 기능 개발 브랜치

예시:

feature/backend-api  
feature/python-model  

---

## 📌 브랜치 생성

git checkout -b feature/기능명

---

## 📌 커밋 메시지 규칙

형식:

type: 내용

---

## 📌 type 종류

- feat: 새로운 기능 추가
- fix: 버그 수정
- docs: 문서 수정
- style: 코드 스타일 변경 (공백, 세미콜론 등)
- refactor: 코드 리팩토링
- test: 테스트 코드 추가
- chore: 기타 변경사항

---

## 📌 커밋 예시

feat: equipment 조회 API 구현  
fix: DB 연결 오류 수정  
docs: README 작성  

---

## 📌 커밋 규칙

- 한 커밋 = 한 기능
- 의미 없는 메시지 금지 (ex: 수정, 변경, fix 등)
- 기능 단위로 커밋

---

## 📌 작업 흐름

1. feature 브랜치 생성
2. 작업 진행
3. commit
4. push
5. Pull Request → dev
6. dev → main 병합

---

## 📌 Pull Request 규칙

- 제목: 기능 요약
- 내용:
  - 작업 내용
  - 변경 사항
  - 테스트 여부

---

## 📌 금지 사항

- main 브랜치 직접 커밋 금지
- 의미 없는 커밋 메시지 금지