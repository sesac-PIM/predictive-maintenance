# API Specification

## Base URL

/api

---

## 1. 설비 전체 조회

Request  
GET /equipments  

Response  

[
  {
    "equipmentId": 1,
    "plantName": "IGCC 발전소",
    "equipmentName": "고압전동기 A",
    "equipmentType": "MOTOR",
    "status": "NORMAL"
  }
]

---

## 2. 설비 상세 조회

Request  
GET /equipments/{equipmentId}  

Response  

{
  "equipmentId": 1,
  "plantName": "IGCC 발전소",
  "equipmentName": "고압전동기 A",
  "equipmentType": "MOTOR",
  "status": "NORMAL",
  "statusUpdatedAt": "2026-04-28T21:00:00"
}

---

## 3. 설비 상태 요약 조회

Request  
GET /equipments/summary  

Response  

{
  "totalCount": 2,
  "normalCount": 1,
  "warningCount": 0,
  "dangerCount": 1
}

---

## 4. 센서 데이터 조회

Request  
GET /equipments/{equipmentId}/sensor-data  

Response  

[
  {
    "measuredAt": "2026-04-28T10:00:00",
    "ii1211a": 12.3,
    "tt1228a": 45.1
  }
]

※ equipmentType에 따라 motor_sensor_data 또는 tube_sensor_data 반환

---

## 5. 이상 탐지 결과 조회

Request  
GET /equipments/{equipmentId}/anomalies  

Response  

[
  {
    "anomalyResultId": 1,
    "measuredAt": "2026-04-28T10:00:00",
    "anomalyScore": 0.87,
    "severity": "DANGER"
  }
]

※ severity는 anomaly_config 기준으로 계산된 값

---

## 6. 이상 원인 센서 조회

Request  
GET /api/anomalies/{type}/{anomalyId}/contributions  

Path Variable  
type: motor | tube  

Response  

[
  {
    "sensorName": "ii1211a",
    "sensorValue": 12.3,
    "contributionScore": 0.7,
    "contributionRank": 1
  }
]

---

## 7. 알림 이력 조회

Request  
GET /alerts  

Response  

[
  {
    "alertId": 1,
    "equipmentId": 1,
    "severity": "DANGER",
    "message": "모터 이상 감지",
    "occurredAt": "2026-04-28T10:00:00"
  }
]

---

## 설계 기준

- RESTful 구조 기반  
- 리소스 중심 URL 설계  
- equipment를 기준으로 하위 리소스 구성  
- sensor-data / anomalies는 설비 하위 리소스  
- contribution은 anomaly 하위 리소스  