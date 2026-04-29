# Database Guide

## 1. Database

본 프로젝트는 PostgreSQL을 사용한다.

- DB: predictive_maintenance
- User: postgres
- Password: 1234
- Port: 5432
- Docker Container: my_postgres

---

## 2. Docker 실행

docker compose up -d

---

## 3. PostgreSQL 접속

docker exec -it my_postgres psql -U postgres -d predictive_maintenance

---

## 4. 테이블 확인

\dt

---

## 5. 주요 테이블

- plant: 발전소 정보
- equipment: 설비 정보
- motor_sensor_data: 고압전동기 센서 데이터
- tube_sensor_data: IGCC 튜브 센서 데이터
- anomaly_config: 이상 판단 기준
- motor_anomaly_result: 고압전동기 이상 탐지 결과
- tube_anomaly_result: 튜브 이상 탐지 결과
- alert_history: 알림 전송 이력
- motor_anomaly_sensor_contribution: 모터 이상 원인 후보 센서
- tube_anomaly_sensor_contribution: 튜브 이상 원인 후보 센서

---

## 6. 주의사항

- measured_at: 실제 센서 데이터가 측정된 시간
- created_at: DB에 저장된 시간
- alert_history.anomaly_result_id는 FK가 아닌 논리 참조 값
- Python과 Spring Boot는 동일한 Docker PostgreSQL DB를 사용해야 함
- 로컬 PostgreSQL이 켜져 있으면 Docker DB와 충돌할 수 있음