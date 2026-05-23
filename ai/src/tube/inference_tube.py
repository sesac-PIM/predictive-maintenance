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
    MAX_WINDOWS_PER_RUN,
    MODEL_PATH,
    RUN_MODE,
    SCALER_PATH,
    STEP_SIZE,
    WINDOW_SIZE,
    resolve_tube_config_id,
    resolve_tube_equipment_ids,
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
    input_cols = [
        'tag_13tt0064', 'tag_15pdt0002a', 'tag_13pdt0067', 'tag_13fi0044',
        'tag_13ffyc0046', 'tag_13fy0045', 'tag_13jyi9001', 'tag_10ind0001',
        'bopc1_1_16200_fi_po041', 'feat_flow_diff', 'feat_temp_ma'
    ]

    try:
        scaler = joblib.load(SCALER_PATH)
    except Exception as e:
        print(f"[ERROR] {SCALER_PATH} not found. Please run train_tube.py first.")
        print(f"[DETAIL] {e}")
        return

    device = torch.device("cpu")
    model = TransformerAutoencoder(input_dim=11).to(device)
    try:
        model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
        model.eval()
    except Exception as e:
        print(f"[ERROR] {MODEL_PATH} not found or dimension mismatch. Please run train_tube.py first.")
        print(f"[DETAIL] {e}")
        return

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    equipment_ids = resolve_tube_equipment_ids(cur)
    config_id = resolve_tube_config_id(cur)

    cur.execute("SELECT warning_threshold FROM anomaly_config WHERE config_id = %s", (config_id,))
    config_row = cur.fetchone()
    warning_th = config_row[0] if config_row else 0.3
    if RUN_MODE == "batch":
        print(f"Clearing old TUBE results for {len(equipment_ids)} equipments...")
        cur.execute("""
            DELETE FROM tube_anomaly_sensor_contribution
            WHERE tube_anomaly_result_id IN (
                SELECT tube_anomaly_result_id
                FROM tube_anomaly_result
                WHERE equipment_id = ANY(%s)
            )
        """, (equipment_ids,))
        cur.execute("DELETE FROM tube_anomaly_result WHERE equipment_id = ANY(%s)", (equipment_ids,))
        conn.commit()
    else:
        print(
            f"TUBE run mode={RUN_MODE}, window={WINDOW_SIZE}, step={STEP_SIZE}, "
            f"max_windows_per_run={MAX_WINDOWS_PER_RUN or 1 if RUN_MODE == 'replay' else MAX_WINDOWS_PER_RUN}"
        )

    for equipment_id in equipment_ids:
        print(f"Fetching TUBE data from DB (equipment_id={equipment_id})...")
        query = "SELECT * FROM tube_sensor_data WHERE equipment_id = %s ORDER BY measured_at ASC"
        df = pd.read_sql(query, conn, params=(equipment_id,))

        if len(df) < WINDOW_SIZE:
            print(f"[SKIP] equipment_id={equipment_id}: need {WINDOW_SIZE} rows, found {len(df)}")
            continue

        print(f"Loaded TUBE config_id={config_id}, equipment_id={equipment_id}, warning threshold={warning_th}")
        print("Calculating derived features (11 features total)...")
        df['feat_flow_diff'] = df['tag_13ffyc0046'] - df['tag_13fi0044']
        df['feat_temp_ma'] = df['tag_13tt0064'].rolling(window=24, min_periods=1).mean()

        X_raw = df[input_cols].values
        X_scaled = scaler.transform(X_raw)

        cur.execute(
            """
            SELECT MAX(window_end_at)
            FROM tube_anomaly_result
            WHERE equipment_id = %s
              AND config_id = %s
            """,
            (equipment_id, config_id),
        )
        last_window_end_at = cur.fetchone()[0] if RUN_MODE == "replay" else None
        max_windows = MAX_WINDOWS_PER_RUN
        if RUN_MODE == "replay" and max_windows <= 0:
            max_windows = 1

        total_windows = max(0, len(X_scaled) - WINDOW_SIZE + 1)
        print(f"Starting inference with 11 features for {total_windows} candidate windows...")
        latest_alert_result_id = None
        processed_windows = 0

        for i in range(0, total_windows, STEP_SIZE):
            window = X_scaled[i:i+WINDOW_SIZE]
            input_tensor = torch.FloatTensor(window).unsqueeze(0).to(device)

            with torch.no_grad():
                recon = model(input_tensor)
                score = torch.mean((input_tensor - recon)**2).item()
                diff = torch.abs(input_tensor - recon)[0][-1].numpy()

            measured_at = df.iloc[i + WINDOW_SIZE - 1]['measured_at']
            if last_window_end_at is not None and measured_at <= last_window_end_at:
                continue

            cur.execute("""
                INSERT INTO tube_anomaly_result (
                    equipment_id, config_id, window_start_at, window_end_at, measured_at, anomaly_score
                ) VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (equipment_id, config_id, window_start_at, window_end_at)
                DO UPDATE SET
                    measured_at = EXCLUDED.measured_at,
                    anomaly_score = EXCLUDED.anomaly_score
                RETURNING tube_anomaly_result_id
            """, (equipment_id, config_id, df.iloc[i]['measured_at'], measured_at, measured_at, float(score)))

            res_id = cur.fetchone()[0]

            diff_raw = diff[:9]
            diff_sum = np.sum(diff_raw)
            if diff_sum > 0:
                contribution_normalized = diff_raw / diff_sum
            else:
                contribution_normalized = diff_raw

            sorted_indices = np.argsort(contribution_normalized)[::-1]
            ranks = {idx: rank + 1 for rank, idx in enumerate(sorted_indices)}

            for idx, s_score in enumerate(contribution_normalized):
                cur.execute("""
                    INSERT INTO tube_anomaly_sensor_contribution (
                        tube_anomaly_result_id, sensor_tag, sensor_value, contribution_score, contribution_rank
                    ) VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (tube_anomaly_result_id, sensor_tag)
                    DO UPDATE SET
                        sensor_value = EXCLUDED.sensor_value,
                        contribution_score = EXCLUDED.contribution_score,
                        contribution_rank = EXCLUDED.contribution_rank
                """, (res_id, input_cols[idx], float(X_raw[i + WINDOW_SIZE - 1][idx]), float(s_score), ranks[idx]))

            if score >= warning_th:
                latest_alert_result_id = res_id

            processed_windows += 1
            if processed_windows % 500 == 0:
                print(f"Processed {processed_windows} windows for equipment_id={equipment_id}...")
                conn.commit()
            if max_windows > 0 and processed_windows >= max_windows:
                break

        conn.commit()
        print(f"[OK] equipment_id={equipment_id}: saved {processed_windows} TUBE windows")
        if latest_alert_result_id:
            alert_headers = get_alert_headers()
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
