import psycopg2
from pandas import read_sql

DB_CONFIG = {
    "host": "localhost",
    "database": "predictive_maintenance",
    "user": "postgres",
    "password": "1234",
    "port": "5432"
}

def print_table_samples():
    conn = psycopg2.connect(**DB_CONFIG)
    
    tables = [
        ("1. anomaly_config (AI 설정)", "SELECT * FROM anomaly_config;"),
        ("2. tube_sensor_threshold (센서별 임계치)", "SELECT * FROM tube_sensor_threshold LIMIT 5;"),
        ("3. tube_sensor_data (원본 데이터)", "SELECT * FROM tube_sensor_data LIMIT 3;"),
        ("4. tube_anomaly_result (분석 요약)", "SELECT * FROM tube_anomaly_result ORDER BY measured_at DESC LIMIT 5;"),
        ("5. tube_anomaly_sensor_contribution (원인 분석)", "SELECT * FROM tube_anomaly_sensor_contribution LIMIT 5;")
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
