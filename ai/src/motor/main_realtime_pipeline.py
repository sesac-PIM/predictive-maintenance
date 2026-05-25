import os
from datetime import datetime

import joblib
import numpy as np
import pandas as pd
import psycopg2
import tensorflow as tf

from load_real_15 import MOTOR_SENSOR_TAGS
from runtime_config import (
    DB_CONFIG,
    MOTOR_MAX_WINDOWS_PER_RUN,
    MOTOR_MODEL_DIR,
    MOTOR_RUN_MODE,
    MOTOR_STEP_SIZE,
    MOTOR_WINDOW_SIZE,
    resolve_motor_config_id,
    resolve_motor_equipment_ids,
)


os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

COMPONENT_CONFIG = {
    "MAC_A": {
        "current_col": "ii1211a", "run_threshold": 84.3077, "denominator": 3.3486, "lower_threshold": 0.3766, "upper_threshold": 0.8000,
        "target_cols": ["ii1211a", "tt1228a", "tt1227a", "yi1593aa", "yi1593ab", "yi1594aa", "yi1594ab"],
        "current": "ii1211a", "temp_cols": ["tt1227a", "tt1228a"], "vib_cols": ["yi1593aa", "yi1593ab", "yi1594aa", "yi1594ab"],
        "de_bearing": "tt1227a", "nde_bearing": "tt1228a", "de_vib_1": "yi1593ab", "nde_vib_1": "yi1593aa", "de_vib_2": "yi1594ab", "nde_vib_2": "yi1594aa",
    },
    "MAC_B": {
        "current_col": "ii1211b", "run_threshold": 115.5087, "denominator": 2.2630, "lower_threshold": 0.4788, "upper_threshold": 0.8000,
        "target_cols": ["ii1211b", "tt1228b", "tt1227b", "yi1593ba", "yi1593bb", "yi1594ba", "yi1594bb"],
        "current": "ii1211b", "temp_cols": ["tt1227b", "tt1228b"], "vib_cols": ["yi1593ba", "yi1593bb", "yi1594ba", "yi1594bb"],
        "de_bearing": "tt1227b", "nde_bearing": "tt1228b", "de_vib_1": "yi1593bb", "nde_vib_1": "yi1593ba", "de_vib_2": "yi1594bb", "nde_vib_2": "yi1594ba",
    },
    "BAC": {
        "current_col": "ii1442", "run_threshold": 152.3229, "denominator": 2.9202, "lower_threshold": 0.5221, "upper_threshold": 0.8000,
        "target_cols": ["ii1442", "tt1427", "tt1428", "yi1483a", "yi1483b", "yi1484a", "yi1484b"],
        "current": "ii1442", "temp_cols": ["tt1427", "tt1428"], "vib_cols": ["yi1483a", "yi1483b", "yi1484a", "yi1484b"],
        "de_bearing": "tt1428", "nde_bearing": "tt1427", "de_vib_1": "yi1483b", "nde_vib_1": "yi1483a", "de_vib_2": "yi1484b", "nde_vib_2": "yi1484a",
    },
    "DGAN": {
        "current_col": "ii7140", "run_threshold": 86.5540, "denominator": 10.3298, "lower_threshold": 0.2797, "upper_threshold": 0.8000,
        "target_cols": ["ii7140", "tt7111", "tt7100", "yi7364a", "yi7364b", "yi7365a", "yi7365b"],
        "current": "ii7140", "temp_cols": ["tt7100", "tt7111"], "vib_cols": ["yi7364a", "yi7364b", "yi7365a", "yi7365b"],
        "de_bearing": "tt7100", "nde_bearing": "tt7111", "de_vib_1": "yi7364b", "nde_vib_1": "yi7364a", "de_vib_2": "yi7365b", "nde_vib_2": "yi7365a",
    },
    "VHP": {
        "current_col": "ii7145", "run_threshold": 88.6906, "denominator": 2.8614, "lower_threshold": 0.5011, "upper_threshold": 0.8000,
        "target_cols": ["ii7145", "tt7152", "tt7151", "yi7358a", "yi7358b", "yi7359a", "yi7359b"],
        "current": "ii7145", "temp_cols": ["tt7151", "tt7152"], "vib_cols": ["yi7358a", "yi7358b", "yi7359a", "yi7359b"],
        "de_bearing": "tt7151", "nde_bearing": "tt7152", "de_vib_1": "yi7358b", "nde_vib_1": "yi7358a", "de_vib_2": "yi7359b", "nde_vib_2": "yi7359a",
    },
}


def resolve_id(cursor, explicit_id, query: str, label: str) -> int:
    if explicit_id:
        return int(explicit_id)
    cursor.execute(query)
    row = cursor.fetchone()
    if not row:
        raise RuntimeError(f"{label} not found.")
    return int(row[0])


def calculate_severity(score: float, warning_threshold: float, danger_threshold: float) -> str:
    if score >= danger_threshold:
        return "DANGER"
    if score >= warning_threshold:
        return "WARNING"
    return "NORMAL"


def evaluate_domain_rules(window_df: pd.DataFrame, cfg: dict) -> tuple[list[str], list[str]]:
    detected_events = []
    logs = []

    for col in cfg["vib_cols"]:
        vib_data = window_df[col]
        if vib_data.std() > 0:
            z_score = (vib_data.iloc[-1] - vib_data.mean()) / vib_data.std()
            if z_score >= 4:
                detected_events.append("BURST")
                logs.append(f"[BURST] {col} 진동 급변 감지 (Z-Score: {z_score:.2f})")

    t_de = window_df[cfg["de_bearing"]].mean()
    t_nde = window_df[cfg["nde_bearing"]].mean()
    if t_nde > 0 and (abs(t_de - t_nde) / t_nde) * 100 >= 20:
        detected_events.append("IMBALANCE")
        logs.append(f"[IMBALANCE] 베어링 온도 DE/NDE 불균형 {(abs(t_de - t_nde) / t_nde * 100):.1f}%")

    for de_v, nde_v, label in [(cfg["de_vib_1"], cfg["nde_vib_1"], "1차"), (cfg["de_vib_2"], cfg["nde_vib_2"], "2차")]:
        v_de = window_df[de_v].mean()
        v_nde = window_df[nde_v].mean()
        if v_nde > 0 and (abs(v_de - v_nde) / v_nde) * 100 >= 20:
            detected_events.append("IMBALANCE")
            logs.append(f"[IMBALANCE] {label} 진동 DE/NDE 불균형 {(abs(v_de - v_nde) / v_nde * 100):.1f}%")

    curr_start = window_df[cfg["current"]].iloc[0]
    curr_end = window_df[cfg["current"]].iloc[-1]
    if curr_start > 0 and (abs(curr_end - curr_start) / curr_start) * 100 >= 10:
        detected_events.append("LOAD_CHANGE")
        logs.append(f"[LOAD_CHANGE] 전류 급변 {(abs(curr_end - curr_start) / curr_start * 100):.1f}%")

    curr_pct = ((curr_end - curr_start) / curr_start) * 100 if curr_start > 0 else 0
    if curr_pct >= 5:
        detected_events.append("TREND_CHANGE")
        logs.append(f"[TREND] 전류 지속 상승 {curr_pct:.1f}%")

    for col in cfg["temp_cols"]:
        start = window_df[col].iloc[0]
        pct = ((window_df[col].iloc[-1] - start) / start) * 100 if start > 0 else 0
        if pct >= 0.5:
            detected_events.append("TREND_CHANGE")
            logs.append(f"[TREND] 온도 센서 {col} 지속 상승 {pct:.2f}%")

    for col in cfg["vib_cols"]:
        start = window_df[col].iloc[0]
        pct = ((window_df[col].iloc[-1] - start) / start) * 100 if start > 0 else 0
        if pct >= 1.5:
            detected_events.append("TREND_CHANGE")
            logs.append(f"[TREND] 진동 센서 {col} 지속 상승 {pct:.1f}%")

    corr_matrix = window_df[cfg["target_cols"]].corr()
    for i, col1 in enumerate(cfg["target_cols"]):
        for col2 in cfg["target_cols"][i + 1:]:
            corr = corr_matrix.loc[col1, col2]
            if "ii" in col1 and "tt" in col2 or "tt" in col1 and "ii" in col2:
                baseline_corr = 0.65
            elif "tt" in col1 and "tt" in col2:
                baseline_corr = 0.80
            elif "yi" in col1 and "yi" in col2:
                baseline_corr = 0.55
            else:
                baseline_corr = 0.20
            if pd.notna(corr) and abs(corr - baseline_corr) >= 0.3:
                detected_events.append("RELATION_CHANGE")
                logs.append(f"[RELATION] 센서 상관관계 변화 {col1}/{col2}: {abs(corr - baseline_corr):.2f}")

    if not detected_events:
        return ["NORMAL"], ["모든 센서가 안정 범위 안에 있습니다."]

    return list(dict.fromkeys(detected_events)), logs


def load_component_model(component_name: str, model_cache: dict):
    if component_name in model_cache:
        return model_cache[component_name]

    suffix = component_name.lower()
    scaler = joblib.load(MOTOR_MODEL_DIR / f"scaler_{suffix}.pkl")
    autoencoder = tf.keras.models.load_model(MOTOR_MODEL_DIR / f"autoencoder_{suffix}.keras")
    model_cache[component_name] = (scaler, autoencoder)
    return scaler, autoencoder


def fetch_latest_window(conn, equipment_id: int) -> pd.DataFrame:
    columns = ", ".join(MOTOR_SENSOR_TAGS)
    query = f"""
        SELECT measured_at, {columns}
        FROM motor_sensor_data
        WHERE equipment_id = %s
        ORDER BY measured_at DESC
        LIMIT %s
    """
    df = pd.read_sql_query(query, conn, params=(equipment_id, MOTOR_WINDOW_SIZE))
    return df.sort_values("measured_at").reset_index(drop=True)


def fetch_all_sensor_data(conn, equipment_id: int) -> pd.DataFrame:
    columns = ", ".join(MOTOR_SENSOR_TAGS)
    query = f"""
        SELECT measured_at, {columns}
        FROM motor_sensor_data
        WHERE equipment_id = %s
        ORDER BY measured_at ASC
    """
    return pd.read_sql_query(query, conn, params=(equipment_id,))


def get_last_window_end_at(cursor, equipment_id: int, config_id: int):
    cursor.execute(
        """
        SELECT MAX(window_end_at)
        FROM motor_anomaly_result
        WHERE equipment_id = %s
          AND config_id = %s
        """,
        (equipment_id, config_id),
    )
    return cursor.fetchone()[0]


def get_config_model_version(cursor, config_id: int) -> str:
    cursor.execute(
        "SELECT model_version FROM anomaly_config WHERE config_id = %s",
        (config_id,),
    )
    row = cursor.fetchone()
    if not row:
        raise RuntimeError(f"anomaly_config not found: config_id={config_id}")
    return str(row[0])


def get_last_checkpoint_at(cursor, equipment_id: int, model_version: str):
    cursor.execute(
        """
        SELECT last_processed_at
        FROM inference_checkpoint
        WHERE equipment_id = %s
          AND equipment_type = 'MOTOR'
          AND model_version = %s
        """,
        (equipment_id, model_version),
    )
    row = cursor.fetchone()
    return row[0] if row else None


def update_checkpoint(cursor, equipment_id: int, model_version: str, window_end_at) -> None:
    cursor.execute(
        """
        INSERT INTO inference_checkpoint (
            equipment_id, equipment_type, model_version, last_processed_at, updated_at
        ) VALUES (%s, 'MOTOR', %s, %s, CURRENT_TIMESTAMP)
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


def iter_window_frames(df: pd.DataFrame, last_window_end_at=None):
    total_windows = max(0, len(df) - MOTOR_WINDOW_SIZE + 1)
    for start in range(0, total_windows, MOTOR_STEP_SIZE):
        end = start + MOTOR_WINDOW_SIZE
        window_df = df.iloc[start:end].reset_index(drop=True)
        window_end_at = window_df["measured_at"].iloc[-1]
        if last_window_end_at is not None and window_end_at <= last_window_end_at:
            continue
        yield window_df


def process_window(cursor, df: pd.DataFrame, equipment_id: int, config_id: int, warning_threshold: float, danger_threshold: float, model_cache: dict) -> bool:
    if len(df) < MOTOR_WINDOW_SIZE:
        print(f"[SKIP] equipment_id={equipment_id}: need {MOTOR_WINDOW_SIZE} rows, found {len(df)}")
        return False

    window_start_at = df["measured_at"].iloc[0]
    window_end_at = df["measured_at"].iloc[-1]
    duration_sec = int((window_end_at - window_start_at).total_seconds())

    total_scores = []
    all_events = []
    all_logs = []
    all_contributions = []

    for component_name, cfg in COMPONENT_CONFIG.items():
        if (df[cfg["current_col"]].iloc[-10:] <= cfg["run_threshold"]).all():
            continue

        features = {f"{col}_mean": df[col].mean() for col in cfg["target_cols"]}
        features.update({f"{col}_std": df[col].std() for col in cfg["target_cols"]})
        x_df = pd.DataFrame([features])

        scaler, autoencoder = load_component_model(component_name, model_cache)
        x_df = x_df[scaler.feature_names_in_]
        x_scaled = scaler.transform(x_df)
        pred = autoencoder.predict(x_scaled, verbose=0)
        raw_error = np.mean(np.square(x_scaled - pred))
        anomaly_score = min(1.0, raw_error / cfg["denominator"])
        total_scores.append(anomaly_score)

        events, logs = evaluate_domain_rules(df, cfg)
        if events == ["NORMAL"]:
            if anomaly_score > cfg["upper_threshold"]:
                events = ["UNKNOWN_CRITICAL"]
                logs = [f"[{component_name}] 원인 미상 중요 패턴 이상 감지"]
            elif anomaly_score > cfg["lower_threshold"]:
                events = ["UNKNOWN_DRIFT"]
                logs = [f"[{component_name}] 원인 미상 패턴 변화 감지"]

        all_events.extend(events)
        all_logs.extend([f"[{component_name}] {log}" for log in logs])

        feature_names = x_df.columns.tolist()
        squared_errors = np.squeeze(np.square(x_scaled - pred))
        for col in cfg["target_cols"]:
            idx_mean = feature_names.index(f"{col}_mean")
            idx_std = feature_names.index(f"{col}_std")
            all_contributions.append({
                "sensor_tag": col,
                "sensor_value": float(df[col].iloc[-1]),
                "contribution_score": float(squared_errors[idx_mean] + squared_errors[idx_std]),
            })

    if not total_scores:
        final_score = 0.0
        final_event = "STOP"
        final_description = "설비 운전 전류가 기준값 이하입니다."
    else:
        final_score = float(max(total_scores))
        hierarchy = ["BURST", "IMBALANCE", "UNKNOWN_CRITICAL", "LOAD_CHANGE", "TREND_CHANGE", "RELATION_CHANGE", "UNKNOWN_DRIFT", "NORMAL"]
        final_event = next((event for event in hierarchy if event in all_events), "NORMAL")
        final_description = " | ".join(all_logs[:8]) if all_logs else "설비 상태가 안정적입니다."

    cursor.execute(
        """
        INSERT INTO motor_anomaly_result (
            equipment_id, config_id, window_start_at, window_end_at, measured_at,
            anomaly_score, event_type, duration_sec, description
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (equipment_id, config_id, window_start_at, window_end_at)
        DO UPDATE SET
            measured_at = EXCLUDED.measured_at,
            anomaly_score = EXCLUDED.anomaly_score,
            event_type = EXCLUDED.event_type,
            duration_sec = EXCLUDED.duration_sec,
            description = EXCLUDED.description,
            alert_processed = FALSE
        RETURNING motor_anomaly_result_id
        """,
        (equipment_id, config_id, window_start_at, window_end_at, window_end_at, final_score, final_event, duration_sec, final_description),
    )
    result_id = int(cursor.fetchone()[0])

    all_contributions = sorted(all_contributions, key=lambda x: x["contribution_score"], reverse=True)
    for rank, contribution in enumerate(all_contributions, start=1):
        cursor.execute(
            """
            INSERT INTO motor_anomaly_sensor_contribution (
                motor_anomaly_result_id, sensor_tag, sensor_value, contribution_score, contribution_rank
            ) VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (motor_anomaly_result_id, sensor_tag)
            DO UPDATE SET
                sensor_value = EXCLUDED.sensor_value,
                contribution_score = EXCLUDED.contribution_score,
                contribution_rank = EXCLUDED.contribution_rank
            """,
            (result_id, contribution["sensor_tag"], contribution["sensor_value"], contribution["contribution_score"], rank),
        )

    severity = calculate_severity(final_score, warning_threshold, danger_threshold)
    print(f"[OK] equipment_id={equipment_id} score={final_score:.4f} severity={severity} event={final_event}")
    return True


def process_equipment(conn, cursor, equipment_id: int, config_id: int, warning_threshold: float, danger_threshold: float, model_cache: dict) -> None:
    model_version = get_config_model_version(cursor, config_id)

    if MOTOR_RUN_MODE == "latest":
        df = fetch_latest_window(conn, equipment_id)
        if process_window(cursor, df, equipment_id, config_id, warning_threshold, danger_threshold, model_cache):
            update_checkpoint(cursor, equipment_id, model_version, df["measured_at"].iloc[-1])
            conn.commit()
        return

    df = fetch_all_sensor_data(conn, equipment_id)
    if len(df) < MOTOR_WINDOW_SIZE:
        print(f"[SKIP] equipment_id={equipment_id}: need {MOTOR_WINDOW_SIZE} rows, found {len(df)}")
        return

    last_window_end_at = None
    if MOTOR_RUN_MODE == "replay":
        last_window_end_at = get_last_checkpoint_at(cursor, equipment_id, model_version)
        if last_window_end_at is None:
            last_window_end_at = get_last_window_end_at(cursor, equipment_id, config_id)
    max_windows = MOTOR_MAX_WINDOWS_PER_RUN
    if MOTOR_RUN_MODE == "replay" and max_windows <= 0:
        max_windows = 1

    processed = 0
    for window_df in iter_window_frames(df, last_window_end_at):
        if process_window(cursor, window_df, equipment_id, config_id, warning_threshold, danger_threshold, model_cache):
            update_checkpoint(cursor, equipment_id, model_version, window_df["measured_at"].iloc[-1])
            processed += 1
        if processed % 50 == 0:
            conn.commit()
        if max_windows > 0 and processed >= max_windows:
            break

    conn.commit()
    if processed == 0:
        print(f"[NOOP] equipment_id={equipment_id}: no new MOTOR windows")
    else:
        print(f"[DONE] equipment_id={equipment_id}: saved {processed} MOTOR windows")


def execute_pipeline() -> None:
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting motor inference pipeline")
    print(
        f"MOTOR run mode={MOTOR_RUN_MODE}, window={MOTOR_WINDOW_SIZE}, "
        f"step={MOTOR_STEP_SIZE}, max_windows_per_run={MOTOR_MAX_WINDOWS_PER_RUN}"
    )

    with psycopg2.connect(**DB_CONFIG) as conn:
        with conn.cursor() as cursor:
            config_id = resolve_motor_config_id(cursor)
            cursor.execute("SELECT warning_threshold, danger_threshold FROM anomaly_config WHERE config_id = %s", (config_id,))
            warning_threshold, danger_threshold = cursor.fetchone()

            equipment_ids = resolve_motor_equipment_ids(cursor)
            model_cache = {}

            for equipment_id in equipment_ids:
                process_equipment(
                    conn,
                    cursor,
                    equipment_id,
                    config_id,
                    float(warning_threshold),
                    float(danger_threshold),
                    model_cache,
                )

    print("[DONE] Motor inference pipeline complete")


if __name__ == "__main__":
    execute_pipeline()
