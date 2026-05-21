import pandas as pd
import numpy as np
import torch
import joblib
import psycopg2
import requests
from model_arch import TransformerAutoencoder
from runtime_config import (
    ALERT_API_TOKEN,
    BACKEND_BASE_URL,
    DB_CONFIG,
    MODEL_PATH,
    SCALER_PATH,
    WINDOW_SIZE,
    resolve_tube_config_id,
    resolve_tube_equipment_id,
)

def run_inference():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    equipment_id = resolve_tube_equipment_id(cur)
    config_id = resolve_tube_config_id(cur)

    print("Clearing old results...")
    cur.execute("""
        DELETE FROM tube_anomaly_sensor_contribution
        WHERE tube_anomaly_result_id IN (
            SELECT tube_anomaly_result_id
            FROM tube_anomaly_result
            WHERE equipment_id = %s
        )
    """, (equipment_id,))
    cur.execute("DELETE FROM tube_anomaly_result WHERE equipment_id = %s", (equipment_id,))
    conn.commit()

    # [1] DB에서 원본 9개 센서 데이터 로드
    print("Fetching data from DB...")
    query = "SELECT * FROM tube_sensor_data WHERE equipment_id = %s ORDER BY measured_at ASC"
    df = pd.read_sql(query, conn, params=(equipment_id,))
    
    if len(df) < WINDOW_SIZE:
        print("Not enough data for inference.")
        return

    # [1.5] 활성 TUBE 임계치 설정 조회
    cur.execute("SELECT warning_threshold FROM anomaly_config WHERE config_id = %s", (config_id,))
    config_row = cur.fetchone()
    warning_th = config_row[0] if config_row else 0.3
    print(f"Loaded TUBE config_id={config_id}, equipment_id={equipment_id}, warning threshold={warning_th}")

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
    except Exception as e:
        print(f"[ERROR] {SCALER_PATH} not found. Please run train_tube.py first.")
        print(f"[DETAIL] {e}")
        return
    
    # [4] 모델 로드 (11차원 설정)
    device = torch.device("cpu")
    model = TransformerAutoencoder(input_dim=11).to(device)
    try:
        model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
        model.eval()
    except Exception as e:
        print(f"[ERROR] {MODEL_PATH} not found or dimension mismatch. Please run train_tube.py first.")
        print(f"[DETAIL] {e}")
        return

    print(f"Starting inference with 11 features for {len(X_scaled) - WINDOW_SIZE + 1} windows...")
    alert_token_warning_printed = False
    
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
        """, (equipment_id, config_id, df.iloc[i]['measured_at'], measured_at, measured_at, float(score)))
        
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
            if not ALERT_API_TOKEN:
                if not alert_token_warning_printed:
                    print("[WARN] TUBE_ALERT_API_TOKEN is not set. Skipping backend alert API calls.")
                    alert_token_warning_printed = True
                continue
            try:
                url = f"{BACKEND_BASE_URL}/api/alerts/tube/{res_id}/send"
                headers = {"Authorization": f"Bearer {ALERT_API_TOKEN}"}
                response = requests.post(url, headers=headers, timeout=3)
                if response.status_code >= 400:
                    print(f"[WARN] Alert API failed ({response.status_code}): {response.text[:200]}")
            except Exception as e:
                print(f"[WARN] Alert API call failed: {e}")


        if (i+1) % 500 == 0:
            print(f"Processed {i+1} rows...")
            conn.commit()

    conn.commit()
    cur.close()
    conn.close()
    print("[SUCCESS] 11-feature inference completed and results saved to DB.")

if __name__ == "__main__":
    run_inference()
