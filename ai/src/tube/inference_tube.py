import pandas as pd
import numpy as np
import torch
import joblib
import psycopg2
from model_arch import TransformerAutoencoder
from runtime_config import (
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


def get_config_model_version(cur, config_id: int) -> str:
    cur.execute(
        "SELECT model_version FROM anomaly_config WHERE config_id = %s",
        (config_id,),
    )
    row = cur.fetchone()
    if not row:
        raise RuntimeError(f"anomaly_config not found: config_id={config_id}")
    return str(row[0])


def get_last_result_at(cur, equipment_id: int, config_id: int):
    cur.execute(
        """
        SELECT MAX(window_end_at)
        FROM tube_anomaly_result
        WHERE equipment_id = %s
          AND config_id = %s
        """,
        (equipment_id, config_id),
    )
    return cur.fetchone()[0]


def get_last_checkpoint_at(cur, equipment_id: int, model_version: str):
    cur.execute(
        """
        SELECT last_processed_at
        FROM inference_checkpoint
        WHERE equipment_id = %s
          AND equipment_type = 'TUBE'
          AND model_version = %s
        """,
        (equipment_id, model_version),
    )
    row = cur.fetchone()
    return row[0] if row else None


def update_checkpoint(cur, equipment_id: int, model_version: str, window_end_at) -> None:
    cur.execute(
        """
        INSERT INTO inference_checkpoint (
            equipment_id, equipment_type, model_version, last_processed_at, updated_at
        ) VALUES (%s, 'TUBE', %s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (equipment_id, equipment_type, model_version)
        DO UPDATE SET
            last_processed_at = GREATEST(
                COALESCE(inference_checkpoint.last_processed_at, EXCLUDED.last_processed_at),
                EXCLUDED.last_processed_at
            ),
            updated_at = CURRENT_TIMESTAMP
        """,
        (equipment_id, model_version, window_end_at),
    )


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
    model_version = get_config_model_version(cur, config_id)

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

        last_window_end_at = None
        if RUN_MODE == "replay":
            last_window_end_at = get_last_checkpoint_at(cur, equipment_id, model_version)
            if last_window_end_at is None:
                last_window_end_at = get_last_result_at(cur, equipment_id, config_id)
        max_windows = MAX_WINDOWS_PER_RUN
        if RUN_MODE == "replay" and max_windows <= 0:
            max_windows = 1

        total_windows = max(0, len(X_scaled) - WINDOW_SIZE + 1)
        print(f"Starting inference with 11 features for {total_windows} candidate windows...")
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
                    anomaly_score = EXCLUDED.anomaly_score,
                    alert_processed = FALSE
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

            update_checkpoint(cur, equipment_id, model_version, measured_at)
            processed_windows += 1
            if processed_windows % 500 == 0:
                print(f"Processed {processed_windows} windows for equipment_id={equipment_id}...")
                conn.commit()
            if max_windows > 0 and processed_windows >= max_windows:
                break

        conn.commit()
        print(f"[OK] equipment_id={equipment_id}: saved {processed_windows} TUBE windows")
    cur.close()
    conn.close()
    print("[SUCCESS] 11-feature inference completed and results saved to DB.")

if __name__ == "__main__":
    run_inference()
