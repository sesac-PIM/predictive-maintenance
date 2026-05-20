import psycopg2

DB_CONFIG = {
    "host": "localhost",
    "database": "predictive_maintenance",
    "user": "postgres",
    "password": "1234",
    "port": "5432"
}

def check_db():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # 1. 이상 점수 결과 개수 확인
        cur.execute("SELECT COUNT(*) FROM tube_anomaly_result;")
        res_count = cur.fetchone()[0]
        
        # 2. 센서 기여도 결과 개수 확인
        cur.execute("SELECT COUNT(*) FROM tube_anomaly_sensor_contribution;")
        con_count = cur.fetchone()[0]
        
        # 3. 최신 데이터 1건 샘플 확인
        cur.execute("SELECT measured_at, anomaly_score FROM tube_anomaly_result ORDER BY measured_at DESC LIMIT 1;")
        sample = cur.fetchone()

        print("--- DB Verification Result ---")
        print(f"Result Table: {res_count} rows loaded")
        print(f"Contribution Table: {con_count} rows loaded")
        if sample:
            print(f"Latest Timestamp: {sample[0]}")
            print(f"Latest Score: {sample[1]:.4f}")
        print("-------------------------------")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error checking DB: {e}")

if __name__ == "__main__":
    check_db()
