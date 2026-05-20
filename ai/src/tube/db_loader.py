import pandas as pd
import numpy as np
import psycopg2
from datetime import datetime, timedelta
from psycopg2.extras import execute_values
import os

# 1. DB 설정
DB_CONFIG = {
    "host": "localhost",
    "database": "predictive_maintenance",
    "user": "postgres",
    "password": "1234",
    "port": "5432"
}

# 파일 경로 (절대경로로 지정 - 실행 위치 무관)
BASE_DIR = r"C:\Users\PC\Documents\project\final_project"
FILE_PATH = os.path.join(BASE_DIR, 'IGCC 튜브누설 고장 데이터셋.xlsx')

EQUIPMENT_ID = 2

def load_and_insert():
    print(f"Reading Excel: {FILE_PATH}")

    # 정상 데이터 시트 로드 (시간 범위 확인용)
    df_normal   = pd.read_excel(FILE_PATH, sheet_name='정상 데이터')
    df_abnormal = pd.read_excel(FILE_PATH, sheet_name='비정상 데이터')

    # 시간 변환 (Excel Serial Date → datetime)
    df_normal['time']   = pd.to_datetime(df_normal['time'],   unit='D', origin='1899-12-30')
    df_abnormal['time'] = pd.to_datetime(df_abnormal['time'], unit='D', origin='1899-12-30')

    # 정상 데이터 기간 확인
    normal_start = df_normal['time'].min()
    normal_end   = df_normal['time'].max()
    print(f"정상 데이터 기간: {normal_start} ~ {normal_end}")

    # 비정상 시트에서 정상 데이터 기간 제외 → 실제 모니터링 구간만
    df = df_abnormal[~df_abnormal['time'].between(normal_start, normal_end)].sort_values('time').reset_index(drop=True)
    print(f"DB에 적재할 행수 (정상 구간 제외 후): {len(df)}")
    if len(df) > 0:
        print(f"모니터링 구간: {df['time'].min()} ~ {df['time'].max()}")

    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        print("Clearing existing tube_sensor_data...")
        cur.execute("DELETE FROM tube_sensor_data WHERE equipment_id = %s", (EQUIPMENT_ID,))

        data_to_insert = []
        for _, row in df.iterrows():
            record = (
                EQUIPMENT_ID,
                row['time'],
                row['SGC OUT TEMP'],                        # tag_13tt0064
                row['HPHT FSH FLTR DP-A'],                  # tag_15pdt0002a
                row['GF VSS PRESS TAP/ANSP DP'],            # tag_13pdt0067
                row['MP Steam Flow'],                        # tag_13fi0044
                row['MP STM DRUM IN FW FLW'],                # tag_13ffyc0046
                row['MP Balance'],                           # tag_13fy0045
                row['Heat Duty'],                            # tag_13jyi9001
                row['IG Load %'],                            # tag_10ind0001
                row['Demi Water Trans Pump Discharge Flow']  # bopc1_1_16200_fi_po041
            )
            data_to_insert.append(record)

        query = """
            INSERT INTO tube_sensor_data (
                equipment_id, measured_at,
                tag_13tt0064, tag_15pdt0002a, tag_13pdt0067,
                tag_13fi0044, tag_13ffyc0046, tag_13fy0045,
                tag_13jyi9001, tag_10ind0001, bopc1_1_16200_fi_po041
            ) VALUES %s
        """
        execute_values(cur, query, data_to_insert)
        conn.commit()
        print(f"[SUCCESS] {len(df)} rows → tube_sensor_data (equipment_id={EQUIPMENT_ID})")

    except Exception as e:
        if conn: conn.rollback()
        print(f"[ERROR] {e}")
    finally:
        if conn: conn.close()

if __name__ == "__main__":
    load_and_insert()

