import pandas as pd
import numpy as np
import torch
import joblib
import psycopg2
import requests
from model_arch import TransformerAutoencoder
from runtime_config import (
    ALERT_API_TOKEN,
    ALERT_PASSWORD,
    ALERT_USERNAME,
    BACKEND_BASE_URL,
    DB_CONFIG,
    MODEL_PATH,
    SCALER_PATH,
    WINDOW_SIZE,
    resolve_tube_config_id,
    resolve_tube_equipment_id,
)


def get_alert_headers():
    if ALERT_API_TOKEN:
        return {"Authorization": f"Bearer {ALERT_API_TOKEN}"}

    try:
        response = requests.post(
            f"{BACKEND_BASE_URL}/api/auth/login",
            json={"username": ALERT_USERNAME, "password": ALERT_PASSWORD},
            timeout=5,
        )
        response.raise_for_status()
        access_token = response.json().get("accessToken")
        if not access_token:
            raise RuntimeError("Login response did not include accessToken.")
        return {"Authorization": f"Bearer {access_token}"}
    except Exception as e:
        print(f"[WARN] Could not get backend alert token. Alert API calls will be skipped: {e}")
        return None


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

    # [1] DB?먯꽌 ?먮낯 9媛??쇱꽌 ?곗씠??濡쒕뱶
    print("Fetching data from DB...")
    query = "SELECT * FROM tube_sensor_data WHERE equipment_id = %s ORDER BY measured_at ASC"
    df = pd.read_sql(query, conn, params=(equipment_id,))
    
    if len(df) < WINDOW_SIZE:
        print("Not enough data for inference.")
        return

    # [1.5] ?쒖꽦 TUBE ?꾧퀎移??ㅼ젙 議고쉶
    cur.execute("SELECT warning_threshold FROM anomaly_config WHERE config_id = %s", (config_id,))
    config_row = cur.fetchone()
    warning_th = config_row[0] if config_row else 0.3
    print(f"Loaded TUBE config_id={config_id}, equipment_id={equipment_id}, warning threshold={warning_th}")

    # [2] 蹂닿퀬??濡쒖쭅: ?뚯깮 蹂??2媛??ㅼ떆媛??앹꽦 (DB 而щ읆 異붽? ?놁씠 吏꾪뻾)
    print("Calculating derived features (11 features total)...")
    # ?뚯깮1: ?좊웾李⑥씠 = ?쒕읆?좊웾 - ?ㅽ??좊웾 (tag_13ffyc - tag_13fi)
    df['feat_flow_diff'] = df['tag_13ffyc0046'] - df['tag_13fi0044']
    # ?뚯깮2: ?⑤룄 ?대룞?됯퇏 (24?ㅽ뀦)
    df['feat_temp_ma'] = df['tag_13tt0064'].rolling(window=24, min_periods=1).mean()

    # 紐⑤뜽 ?낅젰 ?쒖꽌 (珥?11媛?
    input_cols = [
        'tag_13tt0064', 'tag_15pdt0002a', 'tag_13pdt0067', 'tag_13fi0044', 
        'tag_13ffyc0046', 'tag_13fy0045', 'tag_13jyi9001', 'tag_10ind0001', 
        'bopc1_1_16200_fi_po041', 'feat_flow_diff', 'feat_temp_ma'
    ]
    
    X_raw = df[input_cols].values
    
    # [3] ?꾩쿂由?(11李⑥썝 ?꾩슜 ?ㅼ??쇰윭 濡쒕뱶)
    try:
        scaler = joblib.load(SCALER_PATH)
        X_scaled = scaler.transform(X_raw)
    except Exception as e:
        print(f"[ERROR] {SCALER_PATH} not found. Please run train_tube.py first.")
        print(f"[DETAIL] {e}")
        return
    
    # [4] 紐⑤뜽 濡쒕뱶 (11李⑥썝 ?ㅼ젙)
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
    alert_headers = get_alert_headers()
    latest_alert_result_id = None
    
    for i in range(len(X_scaled) - WINDOW_SIZE + 1):
        window = X_scaled[i:i+WINDOW_SIZE]
        input_tensor = torch.FloatTensor(window).unsqueeze(0).to(device)
        
        with torch.no_grad():
            recon = model(input_tensor)
            score = torch.mean((input_tensor - recon)**2).item()
            diff = torch.abs(input_tensor - recon)[0][-1].numpy()
            
        measured_at = df.iloc[i + WINDOW_SIZE - 1]['measured_at']
        
        # [5] 寃곌낵 ???(?댁긽 ?먯닔)
        cur.execute("""
            INSERT INTO tube_anomaly_result (
                equipment_id, config_id, window_start_at, window_end_at, measured_at, anomaly_score
            ) VALUES (%s, %s, %s, %s, %s, %s) RETURNING tube_anomaly_result_id
        """, (equipment_id, config_id, df.iloc[i]['measured_at'], measured_at, measured_at, float(score)))
        
        res_id = cur.fetchone()[0]
        
        # [6] 寃곌낵 ???(?쇱꽌蹂?湲곗뿬??- ?뚯깮蹂???쒖쇅, ?먮낯 9媛쒕쭔 ???
        diff_raw = diff[:9] # ?ㅼそ ?뚯깮蹂??2媛??섎씪?닿린
        diff_sum = np.sum(diff_raw)
        if diff_sum > 0:
            contribution_normalized = diff_raw / diff_sum
        else:
            contribution_normalized = diff_raw

        # 湲곗뿬???쒖쐞 怨꾩궛 (?먯닔媛 ???쒖꽌?濡??뺣젹???몃뜳??諛섑솚)
        sorted_indices = np.argsort(contribution_normalized)[::-1]
        
        # ?쒖쐞瑜??뺤뀛?덈━濡?留ㅽ븨 (idx -> rank)
        ranks = {idx: rank + 1 for rank, idx in enumerate(sorted_indices)}

        for idx, s_score in enumerate(contribution_normalized):
            cur.execute("""
                INSERT INTO tube_anomaly_sensor_contribution (
                    tube_anomaly_result_id, sensor_tag, sensor_value, contribution_score, contribution_rank
                ) VALUES (%s, %s, %s, %s, %s)
            """, (res_id, input_cols[idx], float(X_raw[i + WINDOW_SIZE - 1][idx]), float(s_score), ranks[idx]))

        # [7] ?댁긽 吏뺥썑 諛깆뿏??API ?곕룞 (二쇱쓽 ?꾧퀎移?珥덇낵 ??
        if score >= warning_th:
            latest_alert_result_id = res_id


        if (i+1) % 500 == 0:
            print(f"Processed {i+1} rows...")
            conn.commit()

    conn.commit()
    if latest_alert_result_id:
        if alert_headers:
            try:
                url = f"{BACKEND_BASE_URL}/api/alerts/tube/{latest_alert_result_id}/send"
                response = requests.post(url, headers=alert_headers, timeout=5)
                if response.status_code >= 400:
                    print(f"[WARN] Alert API failed ({response.status_code}): {response.text[:200]}")
                else:
                    print(f"[SUCCESS] Alert API sent for latest TUBE anomaly_result_id={latest_alert_result_id}")
            except Exception as e:
                print(f"[WARN] Alert API call failed: {e}")
        else:
            print("[WARN] Backend alert auth is unavailable. Skipping backend alert API call.")
    cur.close()
    conn.close()
    print("[SUCCESS] 11-feature inference completed and results saved to DB.")

if __name__ == "__main__":
    run_inference()
