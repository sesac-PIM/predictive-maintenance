import pandas as pd
import numpy as np
import torch
import joblib
import psycopg2
from datetime import timedelta
import requests
from model_arch import TransformerAutoencoder

# 1. 설정
DB_CONFIG = {
    "host": "localhost",
    "database": "predictive_maintenance",
    "user": "postgres",
    "password": "1234",
    "port": "5432"
}

# 11개 변수 전용 모델 및 스케일러 경로
MODEL_PATH = 'ai/models/tube/tube_model_v11.pth'
SCALER_PATH = 'ai/models/tube/tube_scaler_v11.pkl'
EQUIPMENT_ID = 2
CONFIG_ID = 2
WINDOW_SIZE = 24

def run_inference():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    print("Clearing old results...")
    cur.execute("TRUNCATE TABLE tube_anomaly_sensor_contribution CASCADE;")
    cur.execute("TRUNCATE TABLE tube_anomaly_result CASCADE;")
    conn.commit()

    # [1] DB에서 원본 9개 센서 데이터 로드
    print("Fetching data from DB...")
    query = "SELECT * FROM tube_sensor_data WHERE equipment_id = %s ORDER BY measured_at ASC"
    df = pd.read_sql(query, conn, params=(EQUIPMENT_ID,))
    
    if len(df) < WINDOW_SIZE:
        print("Not enough data for inference.")
        return

    # [1.5] 임계치 설정 조회 (config_id = 2)
    cur.execute("SELECT warning_threshold FROM anomaly_config WHERE config_id = %s", (CONFIG_ID,))
    config_row = cur.fetchone()
    warning_th = config_row[0] if config_row else 0.3
    print(f"Loaded warning threshold: {warning_th}")

    # [2] 보고서 로직: 파생 변수 2개 실시간 생성 (DB 컬럼 추가 없이 진행)
    print("Calculating derived features (11 features total)...")
    # 파생1: 유량차이 = 드럼유량 - 스팀유량 (tag_13ffyc - tag_13fi)
    df['feat_flow_diff'] = df['tag_13ffyc0046'] - df['tag_13fi0044']
    # 파생2: 온도 이동평균 (24스텝)
    df['feat_temp_ma'] = df['tag_13tt0064'].rolling(window=24, min_periods=1).mean()

    # 모델 입력 순서 (총 11개)
    input_cols = [
        'tag_13tt0064', 'tag_15pdt0002a', 'tag_13pdt0067', 'tag_13fi0044', 
        'tag_13ffyc0046', 'tag_13fy0045', 'tag_13jyi9001', 'tag_10ind0001', 
        'bopc1_1_16200_fi_po041', 'feat_flow_diff', 'feat_temp_ma'
    ]
    
    X_raw = df[input_cols].values
    
    # [3] 전처리 (11차원 전용 스케일러 로드)
    try:
        scaler = joblib.load(SCALER_PATH)
        X_scaled = scaler.transform(X_raw)
    except:
        print(f"[ERROR] {SCALER_PATH} not found. Please run train_tube.py first.")
        return
    
    # [4] 모델 로드 (11차원 설정)
    device = torch.device("cpu")
    model = TransformerAutoencoder(input_dim=11).to(device)
    try:
        model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
        model.eval()
    except:
        print(f"[ERROR] {MODEL_PATH} not found or dimension mismatch. Please run train_tube.py first.")
        return

    print(f"Starting inference with 11 features for {len(X_scaled) - WINDOW_SIZE + 1} windows...")
    
    for i in range(len(X_scaled) - WINDOW_SIZE + 1):
        window = X_scaled[i:i+WINDOW_SIZE]
        input_tensor = torch.FloatTensor(window).unsqueeze(0).to(device)
        
        with torch.no_grad():
            recon = model(input_tensor)
            score = torch.mean((input_tensor - recon)**2).item()
            diff = torch.abs(input_tensor - recon)[0][-1].numpy()
            
        measured_at = df.iloc[i + WINDOW_SIZE - 1]['measured_at']
        
        # [5] 결과 저장 (이상 점수)
        cur.execute("""
            INSERT INTO tube_anomaly_result (
                equipment_id, config_id, window_start_at, window_end_at, measured_at, anomaly_score
            ) VALUES (%s, %s, %s, %s, %s, %s) RETURNING tube_anomaly_result_id
        """, (EQUIPMENT_ID, CONFIG_ID, df.iloc[i]['measured_at'], measured_at, measured_at, float(score)))
        
        res_id = cur.fetchone()[0]
        
        # [6] 결과 저장 (센서별 기여도 - 파생변수 제외, 원본 9개만 저장)
        diff_raw = diff[:9] # 뒤쪽 파생변수 2개 잘라내기
        diff_sum = np.sum(diff_raw)
        if diff_sum > 0:
            contribution_normalized = diff_raw / diff_sum
        else:
            contribution_normalized = diff_raw

        # 기여도 순위 계산 (점수가 큰 순서대로 정렬한 인덱스 반환)
        sorted_indices = np.argsort(contribution_normalized)[::-1]
        
        # 순위를 딕셔너리로 매핑 (idx -> rank)
        ranks = {idx: rank + 1 for rank, idx in enumerate(sorted_indices)}

        for idx, s_score in enumerate(contribution_normalized):
            cur.execute("""
                INSERT INTO tube_anomaly_sensor_contribution (
                    tube_anomaly_result_id, sensor_tag, sensor_value, contribution_score, contribution_rank
                ) VALUES (%s, %s, %s, %s, %s)
            """, (res_id, input_cols[idx], float(X_raw[i + WINDOW_SIZE - 1][idx]), float(s_score), ranks[idx]))

        # [7] 이상 징후 백엔드 API 연동 (주의 임계치 초과 시)
        if score >= warning_th:
            try:
                url = f"http://localhost:8080/api/alerts/tube/{res_id}/send"
                # 백엔드가 슬랙 메시지를 보내는 동안 지연되지 않도록 timeout 설정 (또는 백그라운드 요청)
                requests.post(url, timeout=1) 
            except Exception as e:
                pass # API 호출 실패로 인해 파이프라인이 멈추면 안 됨


        if (i+1) % 500 == 0:
            print(f"Processed {i+1} rows...")
            conn.commit()

    conn.commit()
    cur.close()
    conn.close()
    print("[SUCCESS] 11-feature inference completed and results saved to DB.")

if __name__ == "__main__":
    run_inference()
