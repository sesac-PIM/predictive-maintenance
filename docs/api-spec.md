# API Specification

Base URL: `/api`

대부분의 조회 API는 JWT access token을 요구합니다. 인증이 필요한 요청에는 `Authorization: Bearer {accessToken}` 헤더를 포함합니다.

## Auth

### POST `/auth/signup`

회원 가입.

Request:

```json
{
  "username": "admin",
  "password": "1234",
  "role": "ROLE_ADMIN"
}
```

Response:

```text
Signup success
```

### POST `/auth/login`

로그인 및 토큰 발급.

Request:

```json
{
  "username": "admin",
  "password": "1234"
}
```

Response:

```json
{
  "accessToken": "...",
  "refreshToken": "..."
}
```

### POST `/auth/refresh`

refresh token으로 access token 재발급.

Request:

```json
{
  "refreshToken": "..."
}
```

## Plants

### GET `/plants`

발전본부 목록 조회.

Response:

```json
[
  {
    "plantId": 1,
    "plantName": "태안발전본부",
    "location": "충청남도 태안군 원북면 발전로 457",
    "latitude": 36.912,
    "longitude": 126.231,
    "generationCount": 11
  }
]
```

## Equipments

### GET `/equipments?plantId={plantId}`

설비 목록 조회. `plantId`를 생략하면 전체 설비를 조회합니다.

### GET `/equipments/summary`

설비 상태 요약 조회.

### GET `/equipments/{equipmentId}`

설비 상세 조회.

### GET `/equipments/{equipmentId}/sensor-data?limit={limit}`

설비 타입에 따라 최신 센서 데이터를 조회합니다.

- `equipment_type = MOTOR`: `motor_sensor_data`
- `equipment_type = TUBE`: `tube_sensor_data`

### GET `/equipments/{equipmentId}/sensor-thresholds`

설비 타입에 따라 동적 센서 임계값을 조회합니다.

- `equipment_type = MOTOR`: `motor_sensor_threshold`
- `equipment_type = TUBE`: `tube_sensor_threshold`

### GET `/equipments/{equipmentId}/anomalies?component={component}&limit={limit}`

이상 탐지 결과를 조회합니다.

Parameters:

| Name | Required | Description |
| --- | --- | --- |
| `component` | No | 고압전동기 컴포넌트 필터. 예: `MAC_A`, `MAC_B`, `BAC`, `DGAN`, `VHP` |
| `limit` | No | 조회 개수 |

### GET `/equipments/{equipmentId}/anomalies/{anomalyResultId}/contributions`

선택한 이상 결과의 센서별 기여도 조회.

Response:

```json
[
  {
    "sensorTag": "ii1211a",
    "sensorName": "MAC_A 전류",
    "sensorValue": 842.79,
    "contributionScore": 0.62,
    "contributionRank": 1
  }
]
```

## Alerts

### GET `/alerts`

Slack 알림 이력 조회.

Parameters:

| Name | Required | Description |
| --- | --- | --- |
| `equipmentId` | No | 설비 ID |
| `severity` | No | `NORMAL`, `WARNING`, `DANGER` |
| `type` | No | `MOTOR`, `TUBE` |
| `limit` | No | 조회 개수 |
| `sort` | No | 정렬 방향 |

### POST `/alerts/motor/{anomalyResultId}/send`

모터 이상 결과에 대한 Slack 알림 수동 전송.

### POST `/alerts/tube/{anomalyResultId}/send`

튜브 이상 결과에 대한 Slack 알림 수동 전송.

## Realtime Events

### GET `/events/stream`

SSE 이벤트 스트림 구독.

Frontend는 이 스트림을 통해 신규 이상 결과 및 알림 이벤트를 감지하고 필요한 API만 다시 조회합니다.
