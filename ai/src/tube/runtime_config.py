import os
from pathlib import Path


PROJECT_ROOT = Path(os.getenv("PROJECT_ROOT", Path(__file__).resolve().parents[3])).resolve()

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "database": os.getenv("DB_NAME", "predictive_maintenance"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "1234"),
    "port": os.getenv("DB_PORT", "5432"),
}

TUBE_UNIT_NO = int(os.getenv("TUBE_UNIT_NO", "1"))
TUBE_EQUIPMENT_NAME = os.getenv("TUBE_EQUIPMENT_NAME")
WINDOW_SIZE = max(1, int(os.getenv("TUBE_WINDOW_SIZE", "24")))
STEP_SIZE = max(1, int(os.getenv("TUBE_STEP_SIZE", "1")))
RUN_MODE = os.getenv("TUBE_RUN_MODE", "batch").lower()
MAX_WINDOWS_PER_RUN = max(0, int(os.getenv("TUBE_MAX_WINDOWS_PER_RUN", "0")))

DATA_PATH = Path(
    os.getenv(
        "TUBE_DATA_PATH",
        PROJECT_ROOT / "ai" / "data" / "tube" / "IGCC 튜브누설 고장 데이터셋.xlsx",
    )
).resolve()
MODEL_PATH = Path(
    os.getenv("TUBE_MODEL_PATH", PROJECT_ROOT / "ai" / "models" / "tube" / "tube_model_v11.pth")
).resolve()
SCALER_PATH = Path(
    os.getenv("TUBE_SCALER_PATH", PROJECT_ROOT / "ai" / "models" / "tube" / "tube_scaler_v11.pkl")
).resolve()

BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8080").rstrip("/")
ALERT_API_TOKEN = os.getenv("TUBE_ALERT_API_TOKEN", "")
ALERT_USERNAME = os.getenv("TUBE_ALERT_USERNAME", os.getenv("AI_ALERT_USERNAME", "codex_admin"))
ALERT_PASSWORD = os.getenv("TUBE_ALERT_PASSWORD", os.getenv("AI_ALERT_PASSWORD", "1234"))


def resolve_tube_equipment_id(cur):
    if TUBE_EQUIPMENT_NAME:
        cur.execute(
            """
            SELECT equipment_id
            FROM equipment
            WHERE equipment_type = 'TUBE'
              AND equipment_name = %s
            ORDER BY equipment_id
            LIMIT 1
            """,
            (TUBE_EQUIPMENT_NAME,),
        )
    else:
        cur.execute(
            """
            SELECT equipment_id
            FROM equipment
            WHERE equipment_type = 'TUBE'
              AND unit_no = %s
            ORDER BY equipment_id
            LIMIT 1
            """,
            (TUBE_UNIT_NO,),
        )

    row = cur.fetchone()
    if not row:
        target = f"equipment_name={TUBE_EQUIPMENT_NAME}" if TUBE_EQUIPMENT_NAME else f"unit_no={TUBE_UNIT_NO}"
        raise RuntimeError(f"TUBE equipment not found ({target}). Check equipment seed data.")
    return row[0]


def resolve_tube_equipment_ids(cur):
    if TUBE_EQUIPMENT_NAME or os.getenv("TUBE_UNIT_NO"):
        return [resolve_tube_equipment_id(cur)]

    cur.execute(
        """
        SELECT equipment_id
        FROM equipment
        WHERE equipment_type = 'TUBE'
        ORDER BY plant_id, unit_no, equipment_id
        """
    )
    rows = cur.fetchall()
    if not rows:
        raise RuntimeError("TUBE equipment not found. Check equipment seed data.")
    return [row[0] for row in rows]


def resolve_tube_config_id(cur):
    cur.execute(
        """
        SELECT config_id
        FROM anomaly_config
        WHERE equipment_type = 'TUBE'
          AND is_active = TRUE
        ORDER BY config_id DESC
        LIMIT 1
        """
    )
    row = cur.fetchone()
    if not row:
        raise RuntimeError("Active TUBE anomaly_config not found.")
    return row[0]
