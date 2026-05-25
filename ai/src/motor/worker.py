import os
import time
from datetime import datetime


os.environ.setdefault("MOTOR_RUN_MODE", "replay")
os.environ.setdefault("MOTOR_MAX_WINDOWS_PER_RUN", "1")

from main_realtime_pipeline import execute_pipeline  # noqa: E402


def worker_interval_seconds() -> int:
    return max(1, int(os.getenv("MOTOR_WORKER_INTERVAL_SECONDS", "60")))


def main() -> None:
    print("[MOTOR WORKER] started")
    while True:
        started = time.monotonic()
        try:
            execute_pipeline()
        except Exception as exc:
            print(f"[{datetime.now().isoformat(timespec='seconds')}] [MOTOR WORKER ERROR] {exc}")

        elapsed = time.monotonic() - started
        time.sleep(max(0, worker_interval_seconds() - elapsed))


if __name__ == "__main__":
    main()
