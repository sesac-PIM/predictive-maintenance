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

MOTOR_WINDOW_SIZE = int(env("MOTOR_WINDOW_SIZE", "30"))
MOTOR_LOAD_LIMIT = int(env("MOTOR_LOAD_LIMIT", "0"))
MOTOR_ALERT_API_BASE_URL = env("MOTOR_ALERT_API_BASE_URL", "http://localhost:8080")
MOTOR_ALERT_API_TOKEN = os.getenv("MOTOR_ALERT_API_TOKEN")
MOTOR_ALERT_USERNAME = os.getenv("MOTOR_ALERT_USERNAME", os.getenv("AI_ALERT_USERNAME", "codex_admin"))
MOTOR_ALERT_PASSWORD = os.getenv("MOTOR_ALERT_PASSWORD", os.getenv("AI_ALERT_PASSWORD", "1234"))
