import psycopg2
import pandas as pd
import numpy as np
import tensorflow as tf
import joblib
import os
from datetime import datetime

# 텐서플로 단순 시스템 경고 로그 숨기기
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

DB_CONFIG = { "host": "localhost", "database": "kowepo_db", "user": "postgres", "password": "01234", "port": 5432 }
WINDOW = 30
SOURCE_EQUIPMENT_ID = 1  # 실물 데이터가 존재하는 마스터 1호기 고압전동기 ID
CONFIG_ID = 1            # 👈 백엔드 규격: anomaly_config 테이블의 MOTOR 설정 ID는 무조건 1번 고정

# =========================================================================
# [구간 1] 5대 부품 내부 연산용 마스터 맵 (config_id는 제거하고 컴포넌트 명으로 제어)
# =========================================================================
COMPONENT_CONFIG = {
    "MAC_A": {
        "current_col": "ii1211a", "run_threshold": 84.3077, "denominator": 3.3486, "lower_threshold": 0.3766, "upper_threshold": 0.8000,
        "target_cols": ["ii1211a", "tt1228a", "tt1227a", "yi1593aa", "yi1593ab", "yi1594aa", "yi1594ab"],
        "current": "ii1211a", "temp_cols": ["tt1227a", "tt1228a"], "vib_cols": ["yi1593aa", "yi1593ab", "yi1594aa", "yi1594ab"],
        "de_bearing": "tt1227a", "nde_bearing": "tt1228a", "de_vib_1": "yi1593ab", "nde_vib_1": "yi1593aa", "de_vib_2": "yi1594ab", "nde_vib_2": "yi1594aa"
    },
    "MAC_B": {
        "current_col": "ii1211b", "run_threshold": 115.5087, "denominator": 2.2630, "lower_threshold": 0.4788, "upper_threshold": 0.8000,
        "target_cols": ["ii1211b", "tt1228b", "tt1227b", "yi1593ba", "yi1593bb", "yi1594ba", "yi1594bb"],
        "current": "ii1211b", "temp_cols": ["tt1227b", "tt1228b"], "vib_cols": ["yi1593ba", "yi1593bb", "yi1594ba", "yi1594bb"],
        "de_bearing": "tt1227b", "nde_bearing": "tt1228b", "de_vib_1": "yi1593bb", "nde_vib_1": "yi1593ba", "de_vib_2": "yi1594bb", "nde_vib_2": "yi1594ba"
    },
    "BAC": {
        "current_col": "ii1442", "run_threshold": 152.3229, "denominator": 2.9202, "lower_threshold": 0.5221, "upper_threshold": 0.8000,
        "target_cols": ["ii1442", "tt1427", "tt1428", "yi1483a", "yi1483b", "yi1484a", "yi1484b"],
        "current": "ii1442", "temp_cols": ["tt1427", "tt1428"], "vib_cols": ["yi1483a", "yi1483b", "yi1484a", "yi1484b"],
        "de_bearing": "tt1428", "nde_bearing": "tt1427", "de_vib_1": "yi1483b", "nde_vib_1": "yi1483a", "de_vib_2": "yi1484b", "nde_vib_2": "yi1484a"
    },
    "DGAN": {
        "current_col": "ii7140", "run_threshold": 86.5540, "denominator": 10.3298, "lower_threshold": 0.2797, "upper_threshold": 0.8000,
        "target_cols": ["ii7140", "tt7111", "tt7100", "yi7364a", "yi7364b", "yi7365a", "yi7365b"],
        "current": "ii7140", "temp_cols": ["tt7100", "tt7111"], "vib_cols": ["yi7364a", "yi7364b", "yi7365a", "yi7365b"],
        "de_bearing": "tt7100", "nde_bearing": "tt7111", "de_vib_1": "yi7364b", "nde_vib_1": "yi7364a", "de_vib_2": "yi7365b", "nde_vib_2": "yi7365a"
    },
    "VHP": {
        "current_col": "ii7145", "run_threshold": 88.6906, "denominator": 2.8614, "lower_threshold": 0.5011, "upper_threshold": 0.8000,
        "target_cols": ["ii7145", "tt7152", "tt7151", "yi7358a", "yi7358b", "yi7359a", "yi7359b"],
        "current": "ii7145", "temp_cols": ["tt7151", "tt7152"], "vib_cols": ["yi7358a", "yi7358b", "yi7359a", "yi7359b"],
        "de_bearing": "tt7151", "nde_bearing": "tt7152", "de_vib_1": "yi7358b", "nde_vib_1": "yi7358a", "de_vib_2": "yi7359b", "nde_vib_2": "yi7359a"
    }
}

# =========================================================================
# [구간 2] 하이브리드 엔진 파트 - 다중 탐지 독립 전수조사 엔진 (예래님 원본 로직 유지)
# =========================================================================
def evaluate_domain_rules(window_df, cfg):
    detected_events = []
    logs = []
    
    # 1. BURST 룰
    for col in cfg["vib_cols"]:
        vib_data = window_df[col]
        if vib_data.std() > 0:
            z = (vib_data.iloc[-1] - vib_data.mean()) / vib_data.std()
            if z >= 4:
                if "BURST" not in detected_events: detected_events.append("BURST")
                logs.append(f"[BURST] {col} 센서 돌발 고진동 발생 (Z-Score: {z:.2f})")

    # 2. IMBALANCE 룰
    t_de, t_nde = window_df[cfg["de_bearing"]].mean(), window_df[cfg["nde_bearing"]].mean()
    if t_nde > 0 and (abs(t_de - t_nde) / t_nde) * 100 >= 20:
        if "IMBALANCE" not in detected_events: detected_events.append("IMBALANCE")
        logs.append(f"[IMBALANCE] 베어링 온도 DE/NDE 불균형({(abs(t_de-t_nde)/t_nde*100):.1f}%)")
            
    for de_v, nde_v, label in [(cfg["de_vib_1"], cfg["nde_vib_1"], "1차축"), (cfg["de_vib_2"], cfg["nde_vib_2"], "2차축")]:
        v_de, v_nde = window_df[de_v].mean(), window_df[nde_v].mean()
        if v_nde > 0 and (abs(v_de - v_nde) / v_nde) * 100 >= 20:
            if "IMBALANCE" not in detected_events: detected_events.append("IMBALANCE")
            logs.append(f"[IMBALANCE] {label} 진동 DE/NDE 불균형({(abs(v_de-v_nde)/v_nde*100):.1f}%)")

    # 3. LOAD_CHANGE 룰
    curr_start, curr_end = window_df[cfg["current"]].iloc[0], window_df[cfg["current"]].iloc[-1]
    if curr_start > 0 and (abs(curr_end - curr_start) / curr_start) * 100 >= 10:
        detected_events.append("LOAD_CHANGE")
        logs.append(f"[LOAD_CHANGE] 운전 전류 급변({(abs(curr_end-curr_start)/curr_start*100):.1f}%)")

    # 4. TREND_CHANGE 룰 (지속 상승)
    curr_pct = ((window_df[cfg["current"]].iloc[-1] - window_df[cfg["current"]].iloc[0]) / window_df[cfg["current"]].iloc[0]) * 100 if window_df[cfg["current"]].iloc[0] > 0 else 0
    if curr_pct >= 5:
        if "TREND_CHANGE" not in detected_events: detected_events.append("TREND_CHANGE")
        logs.append(f"[TREND] 전류 센서 지속 상승 ({curr_pct:.1f}%)")
        
    for col in cfg["temp_cols"]:
        t_pct = ((window_df[col].iloc[-1] - window_df[col].iloc[0]) / window_df[col].iloc[0]) * 100 if window_df[col].iloc[0] > 0 else 0
        if t_pct >= 0.5:
            if "TREND_CHANGE" not in detected_events: detected_events.append("TREND_CHANGE")
            logs.append(f"[TREND] 온도 센서 [{col}] 지속 상승 ({t_pct:.2f}%)")
            
    for col in cfg["vib_cols"]:
        v_pct = ((window_df[col].iloc[-1] - window_df[col].iloc[0]) / window_df[col].iloc[0]) * 100 if window_df[col].iloc[0] > 0 else 0
        if v_pct >= 1.5:
            if "TREND_CHANGE" not in detected_events: detected_events.append("TREND_CHANGE")
            logs.append(f"[TREND] 진동 센서 [{col}] 지속 상승 ({v_pct:.1f}%)")

    # 5. RELATION_CHANGE 룰
    current_corr_matrix = window_df[cfg["target_cols"]].corr()
    for i in range(len(cfg["target_cols"])):
        for j in range(i + 1, len(cfg["target_cols"])):
            col1, col2 = cfg["target_cols"][i], cfg["target_cols"][j]
            current_corr = current_corr_matrix.loc[col1, col2]
            
            if ("ii" in col1 and "tt" in col2) or ("tt" in col1 and "ii" in col2): baseline_corr = 0.65
            elif "tt" in col1 and "tt" in col2: baseline_corr = 0.80
            elif "yi" in col1 and "yi" in col2: baseline_corr = 0.55
            else: baseline_corr = 0.20

            if pd.notna(current_corr) and abs(current_corr - baseline_corr) >= 0.3:
                if "RELATION_CHANGE" not in detected_events: detected_events.append("RELATION_CHANGE")
                logs.append(f"[RELATION] 위상 변동 [{col1}↔{col2}](갭: {abs(current_corr-baseline_corr):.2f})")

    if not detected_events:
        return "NORMAL", ["모든 센서가 안정 범위 내에 있습니다."]
        
    return detected_events, logs


# =========================================================================
# [구간 3 & 4] 통배합 매핑 및 자동 호기 배포 오케스트레이터
# =========================================================================
def execute_pipeline():
    print(f"\n⏱️ [{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 고압전동기 멀티 호기-35개 센서 통배합 파이프라인 가동")
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # DB에 등록된 모든 MOTOR 타입 설비 ID(1호기, 2호기 등) 동적 확보
        cursor.execute("SELECT equipment_id FROM equipment WHERE equipment_type = 'MOTOR';")
        db_motor_ids = [row[0] for row in cursor.fetchall()]
        
        if not db_motor_ids:
            print(" ❌ [에러] DB equipment 테이블에 등록된 MOTOR 타입 설비가 없습니다.")
            return

        # 1호기에서 35개 마스터 센서 데이터 전수 일괄 로드
        all_cols = []
        for comp in COMPONENT_CONFIG.values():
            all_cols.extend(comp["target_cols"])
        all_cols = list(set(all_cols))
        
        query = f"SELECT measured_at, {', '.join(all_cols)} FROM motor_sensor_data WHERE equipment_id = {SOURCE_EQUIPMENT_ID} ORDER BY measured_at DESC LIMIT {WINDOW};"
        df = pd.read_sql_query(query, conn)
        
        if len(df) < WINDOW:
            print(f" ❌ [에러] 1호기(ID:{SOURCE_EQUIPMENT_ID})의 실시간 시계열 데이터가 부족합니다.")
            return
            
        df = df.sort_values("measured_at")
        
        window_start_at = df["measured_at"].iloc[0]
        window_end_at = df["measured_at"].iloc[-1]
        measured_at = window_end_at
        duration_sec = int((window_end_at - window_start_at).total_seconds())

        # 모든 부품의 결과를 모을 통합 바구니 생성
        total_scores = []
        all_detected_events = []
        all_component_logs = []
        all_sensor_contributions = []

        # 5대 부품 내부 연산 순회 (적재하지 않고 계산만 취합)
        for comp_name, cfg in COMPONENT_CONFIG.items():
            
            # 10분 연속 미가동 필터링
            if (df[cfg["current_col"]].iloc[-10:] <= cfg["run_threshold"]).all():
                continue

            # AI 오차 분석 구동
            row_features = {f"{col}_mean": df[col].mean() for col in cfg["target_cols"]}
            row_features.update({f"{col}_std": df[col].std() for col in cfg["target_cols"]})
            X_df = pd.DataFrame([row_features])
            
            scaler = joblib.load(f"../../models/motor/scaler_{comp_name.lower()}.pkl")
            autoencoder = tf.keras.models.load_model(f"../../models/motor/autoencoder_{comp_name.lower()}.keras")
            
            X_df = X_df[scaler.feature_names_in_]
            X_scaled = scaler.transform(X_df)
            pred = autoencoder.predict(X_scaled, verbose=0)
            raw_error = np.mean(np.square(X_scaled - pred))
            anomaly_score = min(1.0, raw_error / cfg["denominator"])
            total_scores.append(anomaly_score)

            # 물리 규칙 판정
            comp_events, comp_logs = evaluate_domain_rules(df, cfg)
            
            if isinstance(comp_events, list): # 고장 감지 시
                all_detected_events.extend(comp_events)
                all_component_logs.extend([f"[{comp_name}]{log}" for log in comp_logs])
            else: # NORMAL 상태일 때 미지 고장 하이브리드 제어
                if anomaly_score > cfg["lower_threshold"]:
                    if anomaly_score > cfg["upper_threshold"]:
                        all_detected_events.append("UNKNOWN_CRITICAL")
                        all_component_logs.append(f"[{comp_name}][위험] 원인 불명의 패턴 이상 감지")
                    else:
                        all_detected_events.append("UNKNOWN_DRIFT")
                        all_component_logs.append(f"[{comp_name}][주의] 가동 패턴 변화 감지")

            # 센서 기여도 추출 및 바구니 축적
            feature_names = X_df.columns.tolist()
            sq_errors = np.squeeze(np.square(X_scaled - pred))
            for col in cfg["target_cols"]:
                idx_mean = feature_names.index(f"{col}_mean")
                idx_std = feature_names.index(f"{col}_std")
                total_err = float(sq_errors[idx_mean] + sq_errors[idx_std])
                all_sensor_contributions.append({
                    "sensor_tag": col, "sensor_value": float(df[col].iloc[-1]), "contribution_score": total_err
                })

        # 최종 대표 데이터 압축 및 의사결정
        if not total_scores:
            final_score = 0.0
            final_event = "STOP"
            final_description = "설비 내 모든 핵심 부품이 정지 상태입니다."
        else:
            final_score = max(total_scores)  # 5대 부품 중 최고 점수를 대표로 선정
            
            # 심각도 서열에 따른 대표 명찰 매핑
            severity_hierarchy = ["BURST", "IMBALANCE", "UNKNOWN_CRITICAL", "LOAD_CHANGE", "TREND_CHANGE", "RELATION_CHANGE", "UNKNOWN_DRIFT"]
            final_event = "NORMAL"
            for severity in severity_hierarchy:
                if severity in all_detected_events:
                    final_event = severity
                    break
            final_description = " | ".join(all_component_logs) if all_component_logs else "설비 상태가 매우 안정적입니다."

        # 35개 센서 기여도 통합 순위 쫙 매기기
        all_sensor_contributions = sorted(all_sensor_contributions, key=lambda x: x["contribution_score"], reverse=True)

        # -----------------------------------------------------------------
        # [DB 배포 구간] 모든 호기 ID를 순회하며 미러링 적재 가동
        # -----------------------------------------------------------------
        for eq_id in db_motor_ids:
            # 8번 결과 테이블 적재 (config_id = 1 고정으로 완벽 우회)
            cursor.execute("""
                INSERT INTO motor_anomaly_result (
                    equipment_id, config_id, window_start_at, window_end_at, measured_at,
                    anomaly_score, event_type, duration_sec, description
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (equipment_id, config_id, window_start_at, window_end_at) 
                DO UPDATE SET 
                    measured_at = EXCLUDED.measured_at, anomaly_score = EXCLUDED.anomaly_score,
                    event_type = EXCLUDED.event_type, duration_sec = EXCLUDED.duration_sec, description = EXCLUDED.description
                RETURNING motor_anomaly_result_id;
            """, (eq_id, CONFIG_ID, window_start_at, window_end_at, measured_at, float(final_score), final_event, duration_sec, final_description))
            
            result_id = cursor.fetchone()[0]

            # 11번 기여도 테이블 적재 (한 호기 결과 아래에 35개 센서 한 번에 줄 세우기)
            for rank, contrib in enumerate(all_sensor_contributions, start=1):
                cursor.execute("""
                    INSERT INTO motor_anomaly_sensor_contribution (
                        motor_anomaly_result_id, sensor_tag, sensor_value, contribution_score, contribution_rank
                    ) VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (motor_anomaly_result_id, sensor_tag)
                    DO UPDATE SET
                        sensor_value = EXCLUDED.sensor_value, contribution_score = EXCLUDED.contribution_score, contribution_rank = EXCLUDED.contribution_rank;
                """, (result_id, contrib["sensor_tag"], contrib["sensor_value"], contrib["contribution_score"], rank))
            
            print(f"   🟢 [호기 미러링 성공] 설비 ID {eq_id} ➡️ 대표 상태: {final_event} | 대표 점수: {final_score:.4f}")

        conn.commit()
        cursor.close()
        conn.close()
        print("\n🎯 [마스터 컴플리트] 모든 호기 동시 주입 및 35개 센서 통배합 처리 대성공!")
        
    except Exception as e:
        print(f"❌ 파이프라인 연산 실패 원인: {e}")

if __name__ == "__main__":
    execute_pipeline()