import os
import time
from datetime import datetime


os.environ.setdefault("TUBE_RUN_MODE", "replay")
os.environ.setdefault("TUBE_MAX_WINDOWS_PER_RUN", "1")

from inference_tube import run_inference  # noqa: E402


def worker_interval_seconds() -> int:
    return max(1, int(os.getenv("TUBE_WORKER_INTERVAL_SECONDS", "60")))


def main() -> None:
    print("[TUBE WORKER] started")
    while True:
        started = time.monotonic()
        try:
            run_inference()
        except Exception as exc:
            print(f"[{datetime.now().isoformat(timespec='seconds')}] [TUBE WORKER ERROR] {exc}")

        elapsed = time.monotonic() - started
        time.sleep(max(0, worker_interval_seconds() - elapsed))


if __name__ == "__main__":
    main()
