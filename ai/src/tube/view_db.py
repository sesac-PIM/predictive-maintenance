import psycopg2
from pandas import read_sql
from runtime_config import DB_CONFIG, resolve_tube_equipment_id

def print_table_samples():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    equipment_id = resolve_tube_equipment_id(cur)
    cur.close()
    
    tables = [
        ("1. anomaly_config (AI 설정)", "SELECT * FROM anomaly_config;"),
        ("2. tube_sensor_threshold (센서별 임계치)", f"SELECT * FROM tube_sensor_threshold WHERE equipment_id = {equipment_id} LIMIT 5;"),
        ("3. tube_sensor_data (원본 데이터)", f"SELECT * FROM tube_sensor_data WHERE equipment_id = {equipment_id} LIMIT 3;"),
        ("4. tube_anomaly_result (분석 요약)", f"SELECT * FROM tube_anomaly_result WHERE equipment_id = {equipment_id} ORDER BY measured_at DESC LIMIT 5;"),
        ("5. tube_anomaly_sensor_contribution (원인 분석)", f"""
            SELECT c.*
            FROM tube_anomaly_sensor_contribution c
            JOIN tube_anomaly_result r
              ON r.tube_anomaly_result_id = c.tube_anomaly_result_id
            WHERE r.equipment_id = {equipment_id}
            LIMIT 5;
        """)
    ]
    
    for title, query in tables:
        print(f"\n{'='*60}")
        print(f" {title}")
        print(f"{'='*60}")
        df = read_sql(query, conn)
        if df.empty:
            print("(데이터 없음)")
        else:
            print(df.to_string(index=False))
            
    conn.close()

if __name__ == "__main__":
    print_table_samples()
