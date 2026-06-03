# KOWEPO-EMS Predictive Maintenance

KOWEPO-EMS는 한국서부발전 발전 설비의 센서 데이터를 기반으로 이상 징후를 탐지하고, 설비 상태를 실시간 대시보드와 Slack 알림으로 제공하는 예지보전 모니터링 시스템입니다.

튜브와 고압전동기 데이터를 PostgreSQL에 적재한 뒤 Python AI Worker가 윈도우 단위로 이상 점수를 계산합니다. Spring Boot 백엔드는 센서 데이터, 추론 결과, 알림 이력을 API와 SSE로 제공하고, React 대시보드는 발전본부/호기/설비 단위로 상태를 시각화합니다.

## Service URL

- Deployed Frontend: [http://15.165.142.93](http://15.165.142.93)
- Local Frontend: `http://localhost:3000`

## Key Features

- 발전본부별 설비 현황: 태안, 평택, 서인천, 군산, 김포 발전본부의 설비 상태와 위치 시각화
- 상세 대시보드: 튜브/고압전동기 이상 점수 추이, 이벤트 타임라인, 실시간 센서 현황, 기여도, 운전 상태 변화 표시
- AI 추론 파이프라인: 튜브 24시간 윈도우/1시간 스텝, 고압전동기 30분 윈도우/5분 스텝 기반 이상 탐지
- Checkpoint Replay: `inference_checkpoint` 기준으로 마지막 처리 시점 이후의 데이터만 순차 처리
- Slack 알림: 신규 이상 결과를 감지하고 상태 전이 기준으로 중복 알림을 줄인 Slack Webhook 전송
- SSE 실시간 갱신: 백엔드 이벤트 스트림으로 프론트엔드가 필요한 API만 다시 조회
- JWT 인증: 로그인, access token, refresh token 기반 인증 흐름

## Architecture

```mermaid
flowchart LR
    subgraph AI["Python AI Worker"]
        A1["Raw Data Loader"]
        A2["Tube Inference<br/>24h window / 1h step"]
        A3["Motor Inference<br/>30m window / 5m step"]
        A4["Checkpoint Replay"]
    end

    subgraph DB["PostgreSQL"]
        D1[("sensor_data")]
        D2[("anomaly_result")]
        D3[("sensor_contribution")]
        D4[("sensor_threshold")]
        D5[("inference_checkpoint")]
        D6[("alert_history")]
        D7[("plant / equipment")]
    end

    subgraph BE["Spring Boot Backend"]
        B1["REST API"]
        B2["Alert Scheduler"]
        B3["Slack Webhook"]
        B4["SSE Event Stream"]
        B5["JWT Auth"]
    end

    subgraph FE["React Dashboard"]
        F1["Plant Map"]
        F2["Equipment Dashboard"]
        F3["Operation Log"]
        F4["Notification UI"]
    end

    A1 --> D1
    A2 --> D2
    A2 --> D3
    A2 --> D4
    A2 --> D5
    A3 --> D2
    A3 --> D3
    A3 --> D4
    A3 --> D5
    DB --> B1
    D2 --> B2
    B2 --> D6
    B2 --> B3
    B2 --> B4
    B1 --> FE
    B4 --> FE
```

## Data Pipeline

1. Source data load
   - Tube source: `ai/data/tube/tube.csv`
   - Motor source: `ai/data/motor/simulation_25_12_30.csv`
   - 동일 원천 데이터를 여러 발전본부/호기 설비에 복제 적재하여 설비별 모니터링 시나리오를 구성합니다.

2. AI inference
   - Tube: 24시간 윈도우, 1시간 스텝으로 이상 점수와 센서 기여도를 계산합니다.
   - Motor: 30분 윈도우, 5분 스텝으로 컴포넌트별 이상 점수, 이벤트 타입, 센서 기여도, 동적 센서 임계값을 계산합니다.
   - Worker는 `inference_checkpoint`를 기준으로 이미 처리한 구간을 건너뛰고 다음 윈도우부터 이어서 처리합니다.

3. Result storage
   - 추론 결과는 `tube_anomaly_result`, `motor_anomaly_result`에 저장합니다.
   - 원인 분석용 기여도는 `tube_anomaly_sensor_contribution`, `motor_anomaly_sensor_contribution`에 저장합니다.
   - 윈도우별 동적 센서 임계값은 `tube_sensor_threshold`, `motor_sensor_threshold`에 저장합니다.

4. Alert processing
   - Spring Boot Scheduler가 `alert_processed = false`인 신규 이상 결과를 조회합니다.
   - `anomaly_config`의 warning/danger 기준으로 severity를 계산합니다.
   - 알림 이력을 `alert_history`에 저장하고, Slack Webhook으로 최종 알림을 전송합니다.
   - 처리 완료된 결과는 `alert_processed = true`로 변경해 중복 알림을 줄입니다.

5. Frontend refresh
   - React는 SSE 연결(`/api/events/stream`)을 유지합니다.
   - 이벤트를 받으면 발전기 현황, 상세 대시보드, 운영 로그, 알림 UI에 필요한 API만 다시 조회합니다.

## ERD

현재 ERD는 `init.sql` 기준 DB 스키마를 반영합니다. 이상 탐지 결과는 센서 원천 데이터의 시간 윈도우를
기반으로 생성되며, `alert_history.anomaly_result_id`는 모터/튜브 결과 테이블을 공통으로 가리키는
논리 참조입니다.

```mermaid
erDiagram
    plant ||--o{ equipment : has
    users ||--o{ refresh_token : owns
    equipment ||--o{ motor_sensor_data : records
    equipment ||--o{ tube_sensor_data : records
    equipment ||--o{ motor_sensor_threshold : thresholds
    equipment ||--o{ tube_sensor_threshold : thresholds
    equipment ||--o{ motor_anomaly_result : produces
    equipment ||--o{ tube_anomaly_result : produces
    equipment ||--o{ inference_checkpoint : tracks
    equipment ||--o{ alert_history : alerts
    anomaly_config ||--o{ motor_anomaly_result : configures
    anomaly_config ||--o{ tube_anomaly_result : configures
    anomaly_config ||--o{ motor_sensor_threshold : configures
    anomaly_config ||--o{ tube_sensor_threshold : configures
    motor_anomaly_result ||--o{ motor_anomaly_sensor_contribution : explains
    tube_anomaly_result ||--o{ tube_anomaly_sensor_contribution : explains

    plant {
      bigint plant_id PK
      varchar plant_name
      varchar location
      double latitude
      double longitude
      int generation_count
      timestamp created_at
    }

    users {
      bigint user_id PK
      varchar username
      varchar password
      varchar role
      timestamp created_at
    }

    refresh_token {
      bigint refresh_token_id PK
      bigint user_id FK
      varchar token
      timestamp expires_at
      boolean revoked
      timestamp created_at
    }

    equipment {
      bigint equipment_id PK
      bigint plant_id FK
      varchar equipment_name
      int unit_no
      varchar equipment_type
      varchar status
      timestamp status_updated_at
      varchar description
      timestamp created_at
    }

    motor_sensor_data {
      bigint motor_sensor_data_id PK
      bigint equipment_id FK
      timestamp measured_at
      double ii1211a
      double tt1228a
      double yi1593aa
      double tt1227a
      double yi1593ab
      double yi1594aa
      double yi1594ab
      double ii1211b
      double tt1228b
      double yi1593ba
      double tt1227b
      double yi1593bb
      double yi1594ba
      double yi1594bb
      double ii1442
      double tt1427
      double yi1483a
      double tt1428
      double yi1483b
      double yi1484a
      double yi1484b
      double ii7140
      double tt7111
      double yi7364a
      double tt7100
      double yi7364b
      double yi7365a
      double yi7365b
      double ii7145
      double tt7152
      double yi7358a
      double tt7151
      double yi7358b
      double yi7359a
      double yi7359b
    }

    tube_sensor_data {
      bigint tube_sensor_data_id PK
      bigint equipment_id FK
      timestamp measured_at
      double tag_13tt0064
      double tag_15pdt0002a
      double tag_13pdt0067
      double tag_13fi0044
      double tag_13ffyc0046
      double tag_13fy0045
      double tag_13jyi9001
      double tag_10ind0001
      double bopc1_1_16200_fi_po041
    }

    anomaly_config {
      bigint config_id PK
      varchar equipment_type
      varchar model_version
      double warning_threshold
      double danger_threshold
      boolean is_active
      timestamp created_at
    }

    motor_sensor_threshold {
      bigint motor_sensor_threshold_id PK
      bigint equipment_id FK
      bigint config_id FK
      varchar sensor_tag
      timestamp window_start_at
      timestamp window_end_at
      double lower_threshold
      double upper_threshold
      timestamp created_at
    }

    tube_sensor_threshold {
      bigint tube_sensor_threshold_id PK
      bigint equipment_id FK
      bigint config_id FK
      varchar sensor_tag
      timestamp window_start_at
      timestamp window_end_at
      double lower_threshold
      double upper_threshold
      timestamp created_at
    }

    motor_anomaly_result {
      bigint motor_anomaly_result_id PK
      bigint equipment_id FK
      bigint config_id FK
      varchar component_name
      timestamp window_start_at
      timestamp window_end_at
      timestamp measured_at
      double anomaly_score
      varchar event_type
      int duration_sec
      text description
      boolean alert_processed
      timestamp created_at
    }

    tube_anomaly_result {
      bigint tube_anomaly_result_id PK
      bigint equipment_id FK
      bigint config_id FK
      timestamp window_start_at
      timestamp window_end_at
      timestamp measured_at
      double anomaly_score
      boolean alert_processed
      timestamp created_at
    }

    inference_checkpoint {
      bigint checkpoint_id PK
      bigint equipment_id FK
      varchar equipment_type
      varchar model_version
      timestamp last_processed_at
      timestamp updated_at
    }

    alert_history {
      bigint alert_id PK
      bigint equipment_id FK
      bigint anomaly_result_id
      varchar anomaly_result_type
      timestamp occurred_at
      varchar severity
      varchar message
      varchar channel
      varchar send_status
      timestamp created_at
    }

    motor_anomaly_sensor_contribution {
      bigint motor_contribution_id PK
      bigint motor_anomaly_result_id FK
      varchar sensor_tag
      double sensor_value
      double contribution_score
      int contribution_rank
      timestamp created_at
    }

    tube_anomaly_sensor_contribution {
      bigint tube_contribution_id PK
      bigint tube_anomaly_result_id FK
      varchar sensor_tag
      double sensor_value
      double contribution_score
      int contribution_rank
      timestamp created_at
    }
```

## API Summary

Base URL: `/api`

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/auth/signup` | 회원 가입 |
| `POST` | `/auth/login` | 로그인 및 access/refresh token 발급 |
| `POST` | `/auth/refresh` | refresh token으로 access token 재발급 |
| `GET` | `/plants` | 발전본부 목록 조회 |
| `GET` | `/equipments?plantId={id}` | 설비 목록 조회 |
| `GET` | `/equipments/summary` | 설비 상태 요약 조회 |
| `GET` | `/equipments/{equipmentId}` | 설비 상세 조회 |
| `GET` | `/equipments/{equipmentId}/sensor-data?limit={n}` | 최신 센서 데이터 조회 |
| `GET` | `/equipments/{equipmentId}/sensor-thresholds` | 동적 센서 임계값 조회 |
| `GET` | `/equipments/{equipmentId}/anomalies?component={name}&limit={n}` | 이상 탐지 결과 조회 |
| `GET` | `/equipments/{equipmentId}/anomalies/{anomalyResultId}/contributions` | 이상 원인 센서 기여도 조회 |
| `GET` | `/alerts?type={MOTOR\|TUBE}&severity={WARNING\|DANGER}&limit={n}` | Slack 알림 이력 조회 |
| `POST` | `/alerts/motor/{anomalyResultId}/send` | 모터 Slack 알림 수동 전송 |
| `POST` | `/alerts/tube/{anomalyResultId}/send` | 튜브 Slack 알림 수동 전송 |
| `GET` | `/events/stream` | SSE 이벤트 스트림 |

상세 명세는 [docs/api-spec.md](docs/api-spec.md)를 참고합니다.

## Tech Stack

| Layer | Stack |
| --- | --- |
| Frontend | React 19, Vite, TypeScript, Recharts, Lucide React, Kakao Map JavaScript API |
| Backend | Java 21, Spring Boot 4, Spring Security, Spring Data JPA, JWT, SSE |
| Database | PostgreSQL 15 |
| AI Pipeline | Python 3.11, pandas, NumPy, scikit-learn, PyTorch, TensorFlow, psycopg2 |
| Infra | Docker, Docker Compose, AWS EC2, Nginx |
| Notification | Slack Incoming Webhook |

## Project Structure

```text
predictive-maintenance/
├─ ai/
│  ├─ data/
│  │  ├─ motor/
│  │  └─ tube/
│  ├─ models/
│  └─ src/
│     ├─ motor/
│     └─ tube/
├─ backend/
│  └─ src/main/java/org/example/backend/
├─ docs/
├─ frontend/
│  └─ src/
├─ init.sql
├─ docker-compose.yml
└─ README.md
```

## Environment Variables

민감한 값은 Git에 커밋하지 않고 `.env`, IDE Run Configuration, Shell 환경 변수로 관리합니다.

### Backend

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/predictive_maintenance
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=1234
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### Frontend

`frontend/.env` 파일을 생성합니다.

```env
VITE_API_BASE_URL=http://localhost:8080
VITE_KAKAO_MAP_KEY=your_kakao_javascript_key
```

### AI Worker

```powershell
$env:DB_HOST="localhost"
$env:DB_PORT="5432"
$env:DB_NAME="predictive_maintenance"
$env:DB_USER="postgres"
$env:DB_PASSWORD="1234"
```

AWS EC2의 PostgreSQL에 직접 적재하거나 추론 결과를 저장할 때는 `DB_HOST`를 EC2 Public IP로 변경합니다.

## Local Run

### 1. PostgreSQL

```bash
docker compose up -d postgres
```

초기 스키마와 seed 데이터는 `init.sql`을 기준으로 생성됩니다.

### 2. Backend

Windows PowerShell:

```powershell
cd backend
.\gradlew.bat bootRun
```

Linux/macOS:

```bash
cd backend
./gradlew bootRun
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

기본 프론트엔드 주소는 `http://localhost:3000`입니다.

### 4. Python Environment

Windows PowerShell:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r ai\requirements.txt
```

### 5. Source Data Load

```powershell
python ai\src\tube\db_loader.py
python ai\src\tube\set_thresholds.py
python ai\src\motor\load_real_15.py
```

### 6. AI Worker

Tube worker:

```powershell
$env:TUBE_RUN_MODE="replay"
$env:TUBE_MAX_WINDOWS_PER_RUN="1"
$env:TUBE_WORKER_INTERVAL_SECONDS="60"
python ai\src\tube\worker.py
```

Motor worker:

```powershell
$env:MOTOR_RUN_MODE="replay"
$env:MOTOR_MAX_WINDOWS_PER_RUN="1"
$env:MOTOR_WORKER_INTERVAL_SECONDS="60"
python ai\src\motor\worker.py
```

## Deployment Notes

- EC2에는 PostgreSQL, Spring Boot Backend, React/Nginx Frontend를 배포할 수 있습니다.
- Python AI Worker는 EC2에서 실행하거나, 로컬 PC에서 EC2 PostgreSQL을 바라보도록 실행할 수 있습니다.
- 로컬 Worker로 EC2 DB에 결과를 적재하려면 `DB_HOST`를 EC2 Public IP로 설정하고 EC2 보안 그룹에서 PostgreSQL 포트 접근을 허용해야 합니다.
- Kakao Map JavaScript Key는 실제 접속 도메인 또는 `localhost:3000`을 Kakao Developers의 JavaScript SDK 도메인에 등록해야 정상 동작합니다.

## Implementation Troubleshooting

개발 중 실제로 발생한 구조적 문제와 이를 코드에서 해결한 방식을 정리했습니다.

| Area | Symptom | Root Cause | Resolution |
| --- | --- | --- | --- |
| Plant summary | 가스화기 점수가 위험 구간인데 발전기 현황 카드의 막대가 정상 색상처럼 표시됨 | 튜브 결과는 2024년 데이터, 모터 결과는 2025년 데이터라 `latest N` 조회를 한 묶음으로 처리하면 최신 시점이 다른 설비 타입이 서로 밀어내는 구조가 됨 | 설비 타입별 최신 결과를 분리해 계산하고, 같은 시점의 후보 중 가장 높은 severity를 대표 상태로 선택 |
| Operation log | 고압전동기 로그는 보이는데 가스화기 로그가 비어 있거나, 선택한 호기 외 로그가 섞여 보임 | 전체 결과를 먼저 limit으로 자른 뒤 화면에서 필터링하면 특정 설비 타입이나 호기가 limit 밖으로 밀림 | 가스화기와 고압전동기 로그 후보를 타입별로 분리한 뒤 병합/정렬하고, 선택한 plant/unit/type 기준으로 다시 필터링 |
| Motor component view | MAC A 탭에서 MAC B, BAC 등 다른 부품의 이벤트와 기여도가 함께 표시됨 | 모터 결과가 equipment 기준으로만 조회되고 component 기준 필터가 충분히 적용되지 않음 | Backend anomaly 조회에 component 필터를 반영하고, Frontend도 현재 선택된 motor group의 센서/기여도만 표시하도록 정리 |
| STOP state handling | 전류가 음수이거나 가동 임계치 이하인데도 정상/이상 점수로 해석됨 | 센서 노이즈와 정지 상태를 AI 이상 점수와 같은 방식으로 처리함 | Python worker에서 정지 구간은 `STOP` 이벤트와 score `0`으로 저장하고, Frontend에서는 전류 표시를 `0` 이상으로 보정하며 STOP 이벤트를 운전 상태 변화에 우선 반영 |
| Alert processing | 같은 위험 상태가 반복적으로 Slack 알림으로 전송됨 | worker가 매 window마다 결과를 insert하므로 scheduler가 모든 결과를 신규 알림 대상으로 볼 수 있음 | `alert_processed`와 `alert_history`를 사용하고, equipment/type별 이전 severity와 달라질 때만 Slack을 전송 |
| Trend chart scrolling | 결과가 쌓일 때 차트가 최신으로 튀거나, 스크롤 중 그래프가 흔들리고 축이 사라지는 것처럼 보임 | 전체 데이터를 한 번에 렌더링하면서 브라우저 기본 스크롤과 차트 내부 scale 계산이 섞임 | 차트에는 최신 또는 선택 구간의 10개 point만 렌더링하고, 별도 scroll state로 window range를 이동. 사용자가 최신 구간을 보고 있을 때만 새 데이터에 자동 추적 |
| Realtime update cost | 짧은 polling 주기에서 API 호출이 많아지고 화면이 깜빡임 | 화면 전체를 주기적으로 재조회하면 변경이 없는 데이터까지 계속 다시 그림 | SSE는 데이터 변경 신호만 전달하고, Frontend는 현재 화면에 필요한 API만 refetch하며 이전 데이터를 유지한 채 다음 데이터를 반영 |
