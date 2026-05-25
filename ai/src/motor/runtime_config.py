import os
from pathlib import Path


AI_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = AI_DIR.parent


def env(name: str, default: str) -> str:
    return os.getenv(name, default)


DB_CONFIG = {
    "host": env("DB_HOST", "localhost"),
    "database": env("DB_NAME", "predictive_maintenance"),
    "user": env("DB_USER", "postgres"),
    "password": env("DB_PASSWORD", "1234"),
    "port": env("DB_PORT", "5432"),
}

MOTOR_DATA_PATH = Path(
    env("MOTOR_DATA_PATH", str(AI_DIR / "data" / "motor" / "simulation_stream_15.csv"))
)
MOTOR_MODEL_DIR = Path(env("MOTOR_MODEL_DIR", str(AI_DIR / "models" / "motor")))

MOTOR_EQUIPMENT_ID = os.getenv("MOTOR_EQUIPMENT_ID")
MOTOR_CONFIG_ID = os.getenv("MOTOR_CONFIG_ID")
MOTOR_MODEL_VERSION = env("MOTOR_MODEL_VERSION", "motor-runtime")
MOTOR_WARNING_THRESHOLD = float(env("MOTOR_WARNING_THRESHOLD", "0.7"))
MOTOR_DANGER_THRESHOLD = float(env("MOTOR_DANGER_THRESHOLD", "0.9"))

MOTOR_WINDOW_SIZE = max(1, int(env("MOTOR_WINDOW_SIZE", "30")))
MOTOR_STEP_SIZE = max(1, int(env("MOTOR_STEP_SIZE", "5")))
MOTOR_RUN_MODE = env("MOTOR_RUN_MODE", "latest").lower()
MOTOR_MAX_WINDOWS_PER_RUN = max(0, int(env("MOTOR_MAX_WINDOWS_PER_RUN", "0")))
MOTOR_LOAD_LIMIT = int(env("MOTOR_LOAD_LIMIT", "0"))


def resolve_motor_config_id(cursor) -> int:
    if MOTOR_CONFIG_ID:
        return int(MOTOR_CONFIG_ID)

    cursor.execute(
        """
        SELECT config_id
        FROM anomaly_config
        WHERE equipment_type = 'MOTOR'
          AND is_active = TRUE
        ORDER BY config_id DESC
        LIMIT 1
        """
    )
    row = cursor.fetchone()
    if row:
        return int(row[0])

    cursor.execute(
        """
        INSERT INTO anomaly_config (
            equipment_type, model_version, warning_threshold, danger_threshold, is_active
        ) VALUES ('MOTOR', %s, %s, %s, TRUE)
        ON CONFLICT (equipment_type, model_version)
        DO UPDATE SET
            warning_threshold = EXCLUDED.warning_threshold,
            danger_threshold = EXCLUDED.danger_threshold,
            is_active = TRUE
        RETURNING config_id
        """,
        (MOTOR_MODEL_VERSION, MOTOR_WARNING_THRESHOLD, MOTOR_DANGER_THRESHOLD),
    )
    return int(cursor.fetchone()[0])


def resolve_motor_equipment_ids(cursor) -> list[int]:
    if MOTOR_EQUIPMENT_ID:
        return [int(MOTOR_EQUIPMENT_ID)]

    cursor.execute(
        """
        SELECT equipment_id
        FROM equipment
        WHERE equipment_type = 'MOTOR'
        ORDER BY plant_id, unit_no, equipment_id
        """
    )
    rows = cursor.fetchall()
    if not rows:
        raise RuntimeError("No MOTOR equipment found.")
    return [int(row[0]) for row in rows]
