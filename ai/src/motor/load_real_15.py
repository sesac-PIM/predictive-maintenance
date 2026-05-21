import psycopg2
import pandas as pd

DB_CONFIG = { "host": "localhost", "database": "kowepo_db", "user": "postgres", "password": "01234", "port": 5432 }
# 예래님이 방금 넣으신 파일 경로
CSV_PATH = "../../data/motor/simulation_stream_15.csv"

try:
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    # 1. 진짜 15% 데이터 파일 읽기 (상위 35개 행 추출)
    df = pd.read_csv(CSV_PATH)
    
    # ⚠️ 혹시 CSV 컬럼명이 대문자라면 소문자로 통일
    df.columns = [c.lower() for c in df.columns]
    df_sample = df.tail(35)
    
    # 2. 기존 테이블 깔끔하게 비우기
    cursor.execute("TRUNCATE TABLE motor_sensor_data CASCADE;")
    
    # 파이프라인이 요구하는 35개 센서 태그 명단
    cols = [
        'ii1211a', 'tt1228a', 'tt1227a', 'yi1593aa', 'yi1593ab', 'yi1594aa', 'yi1594ab',
        'ii1211b', 'tt1228b', 'tt1227b', 'yi1593ba', 'yi1593bb', 'yi1594ba', 'yi1594bb',
        'ii1442', 'tt1427', 'tt1428', 'yi1483a', 'yi1483b', 'yi1484a', 'yi1484b',
        'ii7140', 'tt7111', 'tt7100', 'yi7364a', 'yi7364b', 'yi7365a', 'yi7365b',
        'ii7145', 'tt7152', 'tt7151', 'yi7358a', 'yi7358b', 'yi7359a', 'yi7359b'
    ]
    
    print("🚀 15% 진짜 가동 데이터를 DB에 적재하는 중...")
    
    # 3. 데이터 주입 (시간은 현재 시간 기준으로 시뮬레이션 매핑)
    base_time = pd.Timestamp.now() - pd.Timedelta(minutes=180)
    
    # 변경된 코드 (수정 후)
    for idx, row in df_sample.iterrows():
        measured_at = base_time + pd.Timedelta(minutes=5 * idx)
    
    # 💡 전류(ii)로 시작하는 센서면 강제로 160.0 대입 (가동 상태 시뮬레이션!)
    # 온도와 진동은 예래님의 진짜 15% CSV 데이터를 그대로 사용합니다.
        vals = [160.0 if c.startswith('ii') else (float(row[c]) if c in df_sample.columns else 0.0) for c in cols]
        
        query = f"INSERT INTO motor_sensor_data (equipment_id, measured_at, {', '.join(cols)}) VALUES (%s, %s, {', '.join(['%s']*len(cols))})"
        cursor.execute(query, [1, measured_at] + vals)
        
    conn.commit()
    cursor.close()
    conn.close()
    print("🟢 [성공] 진짜 15% 데이터 35행이 DB에 성공적으로 장착되었습니다!")

except Exception as e:
    print(f"❌ 데이터 적재 실패: {e}\n(팁: CSV 파일 내부의 컬럼명과 위 cols 명단이 일치하는지 확인해보세요!)")