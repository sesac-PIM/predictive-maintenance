import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import joblib
import psycopg2
from sklearn.preprocessing import MinMaxScaler
from model_arch import TransformerAutoencoder

# 1. DB 설정
DB_CONFIG = {
    "host": "localhost",
    "database": "predictive_maintenance",
    "user": "postgres",
    "password": "1234",
    "port": "5432"
}

def train_model():
    # [1] 데이터 로드
    conn = psycopg2.connect(**DB_CONFIG)
    print("Fetching training data from DB...")
    query = "SELECT * FROM tube_sensor_data ORDER BY measured_at ASC"
    df = pd.read_sql(query, conn)
    conn.close()

    # [2] 보고서 로직: 파생 변수 2개 생성 (실시간 계산)
    print("Generating derived features (11 variables total)...")
    # 파생1: 유량차이 = 드럼유량 - 스팀유량
    df['feat_flow_diff'] = df['tag_13ffyc0046'] - df['tag_13fi0044']
    # 파생2: 온도 이동평균 (24스텝)
    df['feat_temp_ma'] = df['tag_13tt0064'].rolling(window=24, min_periods=1).mean()

    # 모델 입력 변수 목록 (총 11개)
    input_cols = [
        'tag_13tt0064', 'tag_15pdt0002a', 'tag_13pdt0067', 'tag_13fi0044', 
        'tag_13ffyc0046', 'tag_13fy0045', 'tag_13jyi9001', 'tag_10ind0001', 
        'bopc1_1_16200_fi_po041', 'feat_flow_diff', 'feat_temp_ma'
    ]
    
    data = df[input_cols].values
    
    # [3] 스케일링 및 저장
    scaler = MinMaxScaler()
    data_scaled = scaler.fit_transform(data)
    joblib.dump(scaler, 'modeling/tube_scaler_v11.pkl')
    print("Scaler saved as modeling/tube_scaler_v11.pkl")

    # [4] 시퀀스 데이터 생성 (Window=24)
    def create_sequences(data, seq_length=24):
        sequences = []
        for i in range(len(data) - seq_length + 1):
            sequences.append(data[i:i+seq_length])
        return torch.FloatTensor(np.array(sequences))

    X = create_sequences(data_scaled)
    
    # [5] 모델 학습 (Transformer Autoencoder)
    device = torch.device("cpu")
    model = TransformerAutoencoder(input_dim=11).to(device)
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)

    print(f"Starting training with 11 features. Shape: {X.shape}")
    model.train()
    for epoch in range(100): # 빠른 테스트를 위해 100회 (필요시 늘리세요)
        optimizer.zero_grad()
        output = model(X)
        loss = criterion(output, X)
        loss.backward()
        optimizer.step()
        if (epoch + 1) % 20 == 0:
            print(f"Epoch [{epoch+1}/100], Loss: {loss.item():.6f}")

    # [6] 모델 저장
    torch.save(model.state_dict(), 'modeling/tube_model_v11.pth')
    print("[SUCCESS] 11-variable model saved as modeling/tube_model_v11.pth")

if __name__ == "__main__":
    train_model()
