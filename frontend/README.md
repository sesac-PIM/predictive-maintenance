# KOWEPO-EMS Frontend

React + Vite 기반의 예지보전 모니터링 대시보드입니다.

## Local Run

```bash
npm install
npm run dev
```

기본 개발 서버 주소는 `http://localhost:3000`입니다.

## Environment

`frontend/.env` 파일을 생성하고 다음 값을 설정합니다.

```env
VITE_API_BASE_URL=http://localhost:8080
VITE_KAKAO_MAP_KEY=your_kakao_javascript_key
```

배포 환경에서는 `VITE_API_BASE_URL`을 백엔드 서버 주소로 설정합니다.
