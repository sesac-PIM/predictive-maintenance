# TUBE AI pipeline

Run order:

```text
python ai/src/tube/db_loader.py
python ai/src/tube/set_thresholds.py
python ai/src/tube/inference_tube.py
```

Continuous worker mode:

```text
python ai/src/tube/worker.py
```

Important environment variables:

```text
DB_HOST=localhost
DB_PORT=5432
DB_NAME=predictive_maintenance
DB_USER=postgres
DB_PASSWORD=1234

TUBE_UNIT_NO=1
TUBE_EQUIPMENT_NAME=
TUBE_DATA_PATH=
TUBE_MODEL_PATH=
TUBE_SCALER_PATH=
TUBE_WINDOW_SIZE=24
TUBE_STEP_SIZE=1
TUBE_RUN_MODE=replay
TUBE_MAX_WINDOWS_PER_RUN=1
TUBE_WORKER_INTERVAL_SECONDS=60
```

The AI pipeline writes inference results to the database only. Backend scheduling reads
new anomaly rows, creates alert history, and sends Slack notifications.
