-- 기존 테이블 삭제 (순서 중요)
DROP TABLE IF EXISTS motor_anomaly_sensor_contribution;
DROP TABLE IF EXISTS tube_anomaly_sensor_contribution;
DROP TABLE IF EXISTS alert_history;
DROP TABLE IF EXISTS motor_anomaly_result;
DROP TABLE IF EXISTS tube_anomaly_result;
DROP TABLE IF EXISTS anomaly_config;
DROP TABLE IF EXISTS motor_sensor_data;
DROP TABLE IF EXISTS tube_sensor_data;
DROP TABLE IF EXISTS equipment;
DROP TABLE IF EXISTS plant;

--------------------------------------------------

-- 1. plant
CREATE TABLE plant (
    plant_id BIGSERIAL PRIMARY KEY,
    plant_name VARCHAR(100) NOT NULL,
    location VARCHAR(100),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--------------------------------------------------

-- 2. equipment
CREATE TABLE equipment (
    equipment_id BIGSERIAL PRIMARY KEY,
    plant_id BIGINT NOT NULL,
    equipment_name VARCHAR(100) NOT NULL,
    equipment_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    status_updated_at TIMESTAMP,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_equipment_plant
    FOREIGN KEY (plant_id) REFERENCES plant(plant_id)
);

--------------------------------------------------

-- 3. motor_sensor_data
CREATE TABLE motor_sensor_data (
    motor_sensor_data_id BIGSERIAL PRIMARY KEY,
    equipment_id BIGINT NOT NULL,
    measured_at TIMESTAMP NOT NULL,

    ii1211a DOUBLE PRECISION,
    tt1228a DOUBLE PRECISION,
    yi1593aa DOUBLE PRECISION,
    tt1227a DOUBLE PRECISION,
    yi1593ab DOUBLE PRECISION,
    yi1594aa DOUBLE PRECISION,
    yi1594ab DOUBLE PRECISION,
    ii1211b DOUBLE PRECISION,
    tt1228b DOUBLE PRECISION,
    yi1593ba DOUBLE PRECISION,
    tt1227b DOUBLE PRECISION,
    yi1593bb DOUBLE PRECISION,
    yi1594ba DOUBLE PRECISION,
    yi1594bb DOUBLE PRECISION,

    ii1442 DOUBLE PRECISION,
    tt1427 DOUBLE PRECISION,
    yi1483a DOUBLE PRECISION,
    tt1428 DOUBLE PRECISION,
    yi1483b DOUBLE PRECISION,
    yi1484a DOUBLE PRECISION,
    yi1484b DOUBLE PRECISION,

    ii7140 DOUBLE PRECISION,
    tt7111 DOUBLE PRECISION,
    yi7364a DOUBLE PRECISION,
    tt7100 DOUBLE PRECISION,
    yi7364b DOUBLE PRECISION,
    yi7365a DOUBLE PRECISION,
    yi7365b DOUBLE PRECISION,

    ii7145 DOUBLE PRECISION,
    tt7152 DOUBLE PRECISION,
    yi7358a DOUBLE PRECISION,
    tt7151 DOUBLE PRECISION,
    yi7358b DOUBLE PRECISION,
    yi7359a DOUBLE PRECISION,
    yi7359b DOUBLE PRECISION,

    CONSTRAINT fk_motor_sensor_equipment
    FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
);

--------------------------------------------------

-- 4. tube_sensor_data
CREATE TABLE tube_sensor_data (
    tube_sensor_data_id BIGSERIAL PRIMARY KEY,
    equipment_id BIGINT NOT NULL,
    measured_at TIMESTAMP NOT NULL,

    tag_13tt0064 DOUBLE PRECISION,
    tag_15pdt0002a DOUBLE PRECISION,
    tag_13pdt0067 DOUBLE PRECISION,
    tag_13fi0044 DOUBLE PRECISION,
    tag_13ffyc0046 DOUBLE PRECISION,
    tag_13fy0045 DOUBLE PRECISION,
    tag_13jyi9001 DOUBLE PRECISION,
    tag_10ind0001 DOUBLE PRECISION,
    bopc1_1_16200_fi_po041 DOUBLE PRECISION,

    CONSTRAINT fk_tube_sensor_equipment
    FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
);

--------------------------------------------------

-- 5. anomaly_config
CREATE TABLE anomaly_config (
    config_id BIGSERIAL PRIMARY KEY,
    equipment_type VARCHAR(20) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    warning_threshold DOUBLE PRECISION NOT NULL,
    danger_threshold DOUBLE PRECISION NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--------------------------------------------------

-- 6. motor_anomaly_result
CREATE TABLE motor_anomaly_result (
    motor_anomaly_result_id BIGSERIAL PRIMARY KEY,
    motor_sensor_data_id BIGINT NOT NULL,
    config_id BIGINT NOT NULL,
    measured_at TIMESTAMP NOT NULL,
    anomaly_score DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_motor_result_sensor
    FOREIGN KEY (motor_sensor_data_id)
    REFERENCES motor_sensor_data(motor_sensor_data_id),

    CONSTRAINT fk_motor_result_config
    FOREIGN KEY (config_id)
    REFERENCES anomaly_config(config_id)
);

--------------------------------------------------

-- 7. tube_anomaly_result
CREATE TABLE tube_anomaly_result (
    tube_anomaly_result_id BIGSERIAL PRIMARY KEY,
    tube_sensor_data_id BIGINT NOT NULL,
    config_id BIGINT NOT NULL,
    measured_at TIMESTAMP NOT NULL,
    anomaly_score DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tube_result_sensor
    FOREIGN KEY (tube_sensor_data_id)
    REFERENCES tube_sensor_data(tube_sensor_data_id),

    CONSTRAINT fk_tube_result_config
    FOREIGN KEY (config_id)
    REFERENCES anomaly_config(config_id)
);

--------------------------------------------------

-- 8. alert_history
CREATE TABLE alert_history (
    alert_id BIGSERIAL PRIMARY KEY,
    equipment_id BIGINT NOT NULL,
    anomaly_result_id BIGINT NOT NULL,
    anomaly_result_type VARCHAR(20) NOT NULL,
    occurred_at TIMESTAMP NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message VARCHAR(500),
    channel VARCHAR(20),
    send_status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_alert_equipment
    FOREIGN KEY (equipment_id)
    REFERENCES equipment(equipment_id)
);

--------------------------------------------------

-- 9. sensor contribution (motor)
CREATE TABLE motor_anomaly_sensor_contribution (
    motor_contribution_id BIGSERIAL PRIMARY KEY,
    motor_anomaly_result_id BIGINT NOT NULL,
    sensor_name VARCHAR(100),
    sensor_value DOUBLE PRECISION,
    contribution_score DOUBLE PRECISION,
    contribution_rank INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_motor_contribution_result
    FOREIGN KEY (motor_anomaly_result_id)
    REFERENCES motor_anomaly_result(motor_anomaly_result_id)
);

--------------------------------------------------

-- 10. sensor contribution (tube)
CREATE TABLE tube_anomaly_sensor_contribution (
    tube_contribution_id BIGSERIAL PRIMARY KEY,
    tube_anomaly_result_id BIGINT NOT NULL,
    sensor_name VARCHAR(100),
    sensor_value DOUBLE PRECISION,
    contribution_score DOUBLE PRECISION,
    contribution_rank INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tube_contribution_result
    FOREIGN KEY (tube_anomaly_result_id)
    REFERENCES tube_anomaly_result(tube_anomaly_result_id)
);

--------------------------------------------------

-- 인덱스 (성능 중요)
CREATE INDEX idx_motor_sensor_time ON motor_sensor_data(measured_at);
CREATE INDEX idx_tube_sensor_time ON tube_sensor_data(measured_at);

CREATE INDEX idx_motor_result_time ON motor_anomaly_result(measured_at);
CREATE INDEX idx_tube_result_time ON tube_anomaly_result(measured_at);