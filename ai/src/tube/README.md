# TUBE AI pipeline

Run order:

```text
python ai/src/tube/db_loader.py
python ai/src/tube/set_thresholds.py
python ai/src/tube/inference_tube.py
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

BACKEND_BASE_URL=http://localhost:8080
TUBE_ALERT_API_TOKEN=
```

If `TUBE_ALERT_API_TOKEN` is empty, inference still saves anomaly results and sensor contributions to DB, but it skips backend alert API calls.
