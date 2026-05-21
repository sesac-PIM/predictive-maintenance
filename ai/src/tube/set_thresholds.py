import pandas as pd
import psycopg2
from runtime_config import DB_CONFIG, WINDOW_SIZE, resolve_tube_config_id, resolve_tube_equipment_id

def set_dynamic_thresholds():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    equipment_id = resolve_tube_equipment_id(cur)
    config_id = resolve_tube_config_id(cur)

    # [1] 데이터 로드 (tube_sensor_data)
    print("Fetching data from tube_sensor_data...")
    query = "SELECT * FROM tube_sensor_data WHERE equipment_id = %s ORDER BY measured_at ASC"
    df = pd.read_sql(query, conn, params=(equipment_id,))
    
    if len(df) < WINDOW_SIZE:
        print("Not enough data for sliding window.")
        return

    sensor_cols = [
        'tag_13tt0064', 'tag_15pdt0002a', 'tag_13pdt0067', 'tag_13fi0044', 
        'tag_13ffyc0046', 'tag_13fy0045', 'tag_13jyi9001', 'tag_10ind0001',
        'bopc1_1_16200_fi_po041'
    ]

    print("Cleaning old dynamic thresholds...")
    cur.execute("DELETE FROM tube_sensor_threshold WHERE equipment_id = %s", (equipment_id,))
    
    print(f"Calculating dynamic 3-sigma thresholds for {len(df) - WINDOW_SIZE + 1} windows (Step=1)...")
    
    # [2] 슬라이딩 윈도우 (Step=1) 마다 동적 임계치 계산 및 저장
    data_to_insert = []
    
    for i in range(len(df) - WINDOW_SIZE + 1):
        window_df = df.iloc[i : i + WINDOW_SIZE]
        
        window_start_at = window_df.iloc[0]['measured_at']
        window_end_at = window_df.iloc[-1]['measured_at']
        
        for col in sensor_cols:
            mean_val = window_df[col].mean()
            std_val = window_df[col].std()
            
            # 동적 3-sigma (해당 윈도우의 데이터 기준)
            upper = mean_val + (3 * std_val)
            lower = mean_val - (3 * std_val)
            
            if upper <= lower:
                upper += 0.001
                lower -= 0.001
            
            data_to_insert.append((
                equipment_id, config_id, col, window_start_at, window_end_at, float(lower), float(upper)
            ))
            
    # [3] 대량 INSERT 실행 (execute_values 사용)
    from psycopg2.extras import execute_values
    query = """
        INSERT INTO tube_sensor_threshold (
            equipment_id, config_id, sensor_tag, window_start_at, window_end_at, 
            lower_threshold, upper_threshold
        ) VALUES %s
    """
    execute_values(cur, query, data_to_insert)
    
    conn.commit()
    print(f"[SUCCESS] Saved {len(data_to_insert)} dynamic threshold rows to DB.")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    set_dynamic_thresholds()
