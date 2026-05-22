-- 기존 테이블 삭제
DROP TABLE IF EXISTS motor_anomaly_sensor_contribution CASCADE;
DROP TABLE IF EXISTS tube_anomaly_sensor_contribution CASCADE;
DROP TABLE IF EXISTS alert_history CASCADE;
DROP TABLE IF EXISTS motor_anomaly_result CASCADE;
DROP TABLE IF EXISTS tube_anomaly_result CASCADE;
DROP TABLE IF EXISTS motor_sensor_threshold CASCADE;
DROP TABLE IF EXISTS tube_sensor_threshold CASCADE;
DROP TABLE IF EXISTS anomaly_config CASCADE;
DROP TABLE IF EXISTS motor_sensor_data CASCADE;
DROP TABLE IF EXISTS tube_sensor_data CASCADE;
DROP TABLE IF EXISTS equipment CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS plant CASCADE;

--------------------------------------------------
-- 0. users
--------------------------------------------------
CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_user_role
        CHECK (role IN ('ROLE_USER', 'ROLE_ADMIN'))
);

--------------------------------------------------
-- 1. plant
--------------------------------------------------
CREATE TABLE plant (
    plant_id BIGSERIAL PRIMARY KEY,
    plant_name VARCHAR(100) NOT NULL,
    location VARCHAR(100),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    generation_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--------------------------------------------------
-- 2. equipment
--------------------------------------------------
CREATE TABLE equipment (
    equipment_id BIGSERIAL PRIMARY KEY,
    plant_id BIGINT NOT NULL,
    equipment_name VARCHAR(100) NOT NULL,
    unit_no INT NOT NULL,
    equipment_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    status_updated_at TIMESTAMP,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_equipment_plant
        FOREIGN KEY (plant_id)
        REFERENCES plant(plant_id),

    CONSTRAINT chk_equipment_type
        CHECK (equipment_type IN ('MOTOR', 'TUBE')),

    CONSTRAINT chk_equipment_status
        CHECK (status IN ('NORMAL', 'WARNING', 'DANGER', 'INACTIVE'))
);

--------------------------------------------------
-- 3. motor_sensor_data
--------------------------------------------------
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
        FOREIGN KEY (equipment_id)
        REFERENCES equipment(equipment_id)
);

--------------------------------------------------
-- 4. tube_sensor_data
--------------------------------------------------
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
        FOREIGN KEY (equipment_id)
        REFERENCES equipment(equipment_id)
);

--------------------------------------------------
-- 5. anomaly_config
--------------------------------------------------
CREATE TABLE anomaly_config (
    config_id BIGSERIAL PRIMARY KEY,
    equipment_type VARCHAR(20) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    warning_threshold DOUBLE PRECISION NOT NULL,
    danger_threshold DOUBLE PRECISION NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_config_equipment_type
        CHECK (equipment_type IN ('MOTOR', 'TUBE')),

    CONSTRAINT chk_config_threshold
        CHECK (warning_threshold < danger_threshold),

    CONSTRAINT uq_config_equipment_type_model
        UNIQUE (equipment_type, model_version)
);

--------------------------------------------------
-- 6. motor_sensor_threshold
-- window 기반 동적 threshold
-- equipment + sensor_tag + window 기준
--------------------------------------------------
CREATE TABLE motor_sensor_threshold (
    motor_sensor_threshold_id BIGSERIAL PRIMARY KEY,
    equipment_id BIGINT NOT NULL,
    config_id BIGINT NOT NULL,
    sensor_tag VARCHAR(100) NOT NULL,
    window_start_at TIMESTAMP NOT NULL,
    window_end_at TIMESTAMP NOT NULL,
    lower_threshold DOUBLE PRECISION NOT NULL,
    upper_threshold DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_motor_threshold_equipment
        FOREIGN KEY (equipment_id)
        REFERENCES equipment(equipment_id),

    CONSTRAINT fk_motor_threshold_config
        FOREIGN KEY (config_id)
        REFERENCES anomaly_config(config_id),

    CONSTRAINT chk_motor_threshold_window
        CHECK (window_start_at < window_end_at),

    CONSTRAINT chk_motor_threshold_range
        CHECK (lower_threshold < upper_threshold),

    CONSTRAINT uq_motor_threshold_window
        UNIQUE (equipment_id, config_id, sensor_tag, window_start_at, window_end_at)
);

--------------------------------------------------
-- 7. tube_sensor_threshold
-- window 기반 동적 threshold
-- equipment + sensor_tag + window 기준
--------------------------------------------------
CREATE TABLE tube_sensor_threshold (
    tube_sensor_threshold_id BIGSERIAL PRIMARY KEY,
    equipment_id BIGINT NOT NULL,
    config_id BIGINT NOT NULL,
    sensor_tag VARCHAR(150) NOT NULL,
    window_start_at TIMESTAMP NOT NULL,
    window_end_at TIMESTAMP NOT NULL,
    lower_threshold DOUBLE PRECISION NOT NULL,
    upper_threshold DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tube_threshold_equipment
        FOREIGN KEY (equipment_id)
        REFERENCES equipment(equipment_id),

    CONSTRAINT fk_tube_threshold_config
        FOREIGN KEY (config_id)
        REFERENCES anomaly_config(config_id),

    CONSTRAINT chk_tube_threshold_window
        CHECK (window_start_at < window_end_at),

    CONSTRAINT chk_tube_threshold_range
        CHECK (lower_threshold < upper_threshold),

    CONSTRAINT uq_tube_threshold_window
        UNIQUE (equipment_id, config_id, sensor_tag, window_start_at, window_end_at)
);

--------------------------------------------------
-- 8. motor_anomaly_result
-- window 기반: N개의 motor_sensor_data -> 1개의 anomaly_result
--------------------------------------------------
CREATE TABLE motor_anomaly_result (
    motor_anomaly_result_id BIGSERIAL PRIMARY KEY,
    equipment_id BIGINT NOT NULL,
    config_id BIGINT NOT NULL,

    window_start_at TIMESTAMP NOT NULL,
    window_end_at TIMESTAMP NOT NULL,
    measured_at TIMESTAMP NOT NULL,

    anomaly_score DOUBLE PRECISION NOT NULL,

    event_type VARCHAR(50),
    duration_sec INT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_motor_anomaly_equipment
        FOREIGN KEY (equipment_id)
        REFERENCES equipment(equipment_id),

    CONSTRAINT fk_motor_anomaly_config
        FOREIGN KEY (config_id)
        REFERENCES anomaly_config(config_id),

    CONSTRAINT chk_motor_window_range
        CHECK (window_start_at < window_end_at),

    CONSTRAINT uq_motor_anomaly_window
        UNIQUE (equipment_id, config_id, window_start_at, window_end_at)
);

--------------------------------------------------
-- 9. tube_anomaly_result
-- window 기반: N개의 tube_sensor_data -> 1개의 anomaly_result
--------------------------------------------------
CREATE TABLE tube_anomaly_result (
    tube_anomaly_result_id BIGSERIAL PRIMARY KEY,
    equipment_id BIGINT NOT NULL,
    config_id BIGINT NOT NULL,

    window_start_at TIMESTAMP NOT NULL,
    window_end_at TIMESTAMP NOT NULL,
    measured_at TIMESTAMP NOT NULL,

    anomaly_score DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tube_anomaly_equipment
        FOREIGN KEY (equipment_id)
        REFERENCES equipment(equipment_id),

    CONSTRAINT fk_tube_anomaly_config
        FOREIGN KEY (config_id)
        REFERENCES anomaly_config(config_id),

    CONSTRAINT chk_tube_window_range
        CHECK (window_start_at < window_end_at),

    CONSTRAINT uq_tube_anomaly_window
        UNIQUE (equipment_id, config_id, window_start_at, window_end_at)
);

--------------------------------------------------
-- 10. alert_history
-- motor/tube anomaly_result를 공통으로 참조해야 하므로
-- anomaly_result_id는 직접 FK가 아니라 논리 참조
--------------------------------------------------
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
        REFERENCES equipment(equipment_id),

    CONSTRAINT chk_alert_result_type
        CHECK (anomaly_result_type IN ('MOTOR', 'TUBE')),

    CONSTRAINT chk_alert_severity
        CHECK (severity IN ('NORMAL', 'WARNING', 'DANGER')),

    CONSTRAINT chk_alert_channel
        CHECK (channel IS NULL OR channel IN ('WEB', 'EMAIL', 'SLACK', 'SMS')),

    CONSTRAINT chk_alert_send_status
        CHECK (send_status IS NULL OR send_status IN ('PENDING', 'SUCCESS', 'FAILED'))
);

--------------------------------------------------
-- 11. motor_anomaly_sensor_contribution
--------------------------------------------------
CREATE TABLE motor_anomaly_sensor_contribution (
    motor_contribution_id BIGSERIAL PRIMARY KEY,
    motor_anomaly_result_id BIGINT NOT NULL,

    sensor_tag VARCHAR(100) NOT NULL,
    sensor_value DOUBLE PRECISION,
    contribution_score DOUBLE PRECISION,
    contribution_rank INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_motor_contribution_result
        FOREIGN KEY (motor_anomaly_result_id)
        REFERENCES motor_anomaly_result(motor_anomaly_result_id),

    CONSTRAINT chk_motor_contribution_rank
        CHECK (contribution_rank IS NULL OR contribution_rank > 0),

    CONSTRAINT uq_motor_contribution_result_tag
        UNIQUE (motor_anomaly_result_id, sensor_tag)
);

--------------------------------------------------
-- 12. tube_anomaly_sensor_contribution
--------------------------------------------------
CREATE TABLE tube_anomaly_sensor_contribution (
    tube_contribution_id BIGSERIAL PRIMARY KEY,
    tube_anomaly_result_id BIGINT NOT NULL,

    sensor_tag VARCHAR(150) NOT NULL,
    sensor_value DOUBLE PRECISION,
    contribution_score DOUBLE PRECISION,
    contribution_rank INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tube_contribution_result
        FOREIGN KEY (tube_anomaly_result_id)
        REFERENCES tube_anomaly_result(tube_anomaly_result_id),

    CONSTRAINT chk_tube_contribution_rank
        CHECK (contribution_rank IS NULL OR contribution_rank > 0),

    CONSTRAINT uq_tube_contribution_result_tag
        UNIQUE (tube_anomaly_result_id, sensor_tag)
);

--------------------------------------------------
-- Index
--------------------------------------------------
CREATE INDEX idx_equipment_plant_id
    ON equipment(plant_id);

CREATE INDEX idx_equipment_type
    ON equipment(equipment_type);

CREATE INDEX idx_motor_sensor_equipment_measured
    ON motor_sensor_data(equipment_id, measured_at);

CREATE INDEX idx_tube_sensor_equipment_measured
    ON tube_sensor_data(equipment_id, measured_at);

CREATE INDEX idx_motor_threshold_latest
    ON motor_sensor_threshold(equipment_id, config_id, window_end_at);

CREATE INDEX idx_motor_threshold_window
    ON motor_sensor_threshold(equipment_id, config_id, window_start_at, window_end_at);

CREATE INDEX idx_tube_threshold_latest
    ON tube_sensor_threshold(equipment_id, config_id, window_end_at);

CREATE INDEX idx_tube_threshold_window
    ON tube_sensor_threshold(equipment_id, config_id, window_start_at, window_end_at);

CREATE INDEX idx_motor_anomaly_equipment_window
    ON motor_anomaly_result(equipment_id, window_start_at, window_end_at);

CREATE INDEX idx_tube_anomaly_equipment_window
    ON tube_anomaly_result(equipment_id, window_start_at, window_end_at);

CREATE INDEX idx_motor_anomaly_config
    ON motor_anomaly_result(config_id);

CREATE INDEX idx_tube_anomaly_config
    ON tube_anomaly_result(config_id);

CREATE INDEX idx_alert_equipment_occurred
    ON alert_history(equipment_id, occurred_at);

CREATE INDEX idx_alert_result_type_id
    ON alert_history(anomaly_result_type, anomaly_result_id);

CREATE INDEX idx_motor_contribution_result_rank
    ON motor_anomaly_sensor_contribution(motor_anomaly_result_id, contribution_rank);

CREATE INDEX idx_tube_contribution_result_rank
    ON tube_anomaly_sensor_contribution(tube_anomaly_result_id, contribution_rank);

--------------------------------------------------
-- 기본 데이터
--------------------------------------------------

-- plant
INSERT INTO plant (
    plant_name,
    location,
    latitude,
    longitude,
    generation_count
)
VALUES
('태안발전본부', '충남 태안', 36.745, 126.297, 11),
('평택발전본부', '경기 평택', 36.974, 126.846, 7),
('서인천발전본부', '인천 서구', 37.526, 126.602, 8),
('군산발전본부', '전북 군산', 35.981, 126.708, 1),
('김포발전본부', '경기 김포', 37.615, 126.724, 2);

-- equipment
INSERT INTO equipment (
    plant_id,
    equipment_name,
    unit_no,
    equipment_type,
    status,
    status_updated_at,
    description
)
VALUES
(1, '고압전동기 A', 1, 'MOTOR', 'NORMAL', CURRENT_TIMESTAMP, '고압전동기 이상징후 감지 대상 설비'),
(1, 'IGCC 튜브 A', 1, 'TUBE', 'NORMAL', CURRENT_TIMESTAMP, '튜브 누설 감지 대상 설비');

-- anomaly_config
INSERT INTO anomaly_config (
    equipment_type,
    model_version,
    warning_threshold,
    danger_threshold,
    is_active
)
VALUES
('MOTOR', 'motor-v1', 0.7, 0.9, TRUE),
('TUBE', 'tube-v1', 0.3, 0.4, TRUE);
