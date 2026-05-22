import re

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

from runtime_config import DB_CONFIG, MOTOR_DATA_PATH, MOTOR_EQUIPMENT_ID, MOTOR_LOAD_LIMIT, resolve_motor_config_id


MOTOR_SENSOR_TAGS = [
    "ii1211a", "tt1228a", "yi1593aa", "tt1227a", "yi1593ab", "yi1594aa", "yi1594ab",
    "ii1211b", "tt1228b", "yi1593ba", "tt1227b", "yi1593bb", "yi1594ba", "yi1594bb",
    "ii1442", "tt1427", "yi1483a", "tt1428", "yi1483b", "yi1484a", "yi1484b",
    "ii7140", "tt7111", "yi7364a", "tt7100", "yi7364b", "yi7365a", "yi7365b",
    "ii7145", "tt7152", "yi7358a", "tt7151", "yi7358b", "yi7359a", "yi7359b",
]


def compact_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def resolve_id(cursor, explicit_id, query: str, label: str) -> int:
    if explicit_id:
        return int(explicit_id)
    cursor.execute(query)
    row = cursor.fetchone()
    if not row:
        raise RuntimeError(f"{label} not found. Check init.sql seed data first.")
    return int(row[0])


def rename_motor_columns(df: pd.DataFrame) -> pd.DataFrame:
    compact_to_original = {compact_name(column): column for column in df.columns}
    rename_map = {}

    for tag in MOTOR_SENSOR_TAGS:
        tag_key = compact_name(tag)
        source = next((original for compact, original in compact_to_original.items() if tag_key in compact), None)
        if source:
            rename_map[source] = tag

    measured_at_source = next(
        (column for column in df.columns if compact_name(column) in {"measuredat", "time", "timestamp", "datetime"}),
        None,
    )
    if measured_at_source:
        rename_map[measured_at_source] = "measured_at"

    return df.rename(columns=rename_map)


def prepare_dataframe() -> pd.DataFrame:
    if not MOTOR_DATA_PATH.exists():
        raise FileNotFoundError(f"Motor data file not found: {MOTOR_DATA_PATH}")

    print(f"Reading motor CSV: {MOTOR_DATA_PATH}")
    df = pd.read_csv(MOTOR_DATA_PATH)
    df = rename_motor_columns(df)

    missing = [tag for tag in MOTOR_SENSOR_TAGS if tag not in df.columns]
    if missing:
        raise RuntimeError(f"Missing motor sensor columns after mapping: {', '.join(missing)}")

    if "measured_at" in df.columns:
        df["measured_at"] = pd.to_datetime(df["measured_at"], errors="coerce")
    else:
        df["measured_at"] = pd.date_range(end=pd.Timestamp.now().floor("min"), periods=len(df), freq="5min")

    df = df.dropna(subset=["measured_at"]).sort_values("measured_at")
    df[MOTOR_SENSOR_TAGS] = df[MOTOR_SENSOR_TAGS].apply(pd.to_numeric, errors="coerce")
    df = df.dropna(subset=MOTOR_SENSOR_TAGS)

    if MOTOR_LOAD_LIMIT > 0:
        df = df.tail(MOTOR_LOAD_LIMIT)

    if df.empty:
        raise RuntimeError("No valid motor rows to load.")

    return df[["measured_at", *MOTOR_SENSOR_TAGS]].reset_index(drop=True)


def save_thresholds(cursor, equipment_id: int, config_id: int, df: pd.DataFrame) -> None:
    window_start_at = df["measured_at"].min()
    window_end_at = df["measured_at"].max()
    rows = []

    for tag in MOTOR_SENSOR_TAGS:
        series = df[tag]
        lower = float(series.min())
        upper = float(series.max())
        if lower == upper:
            lower -= 0.001
            upper += 0.001
        rows.append((equipment_id, config_id, tag, window_start_at, window_end_at, lower, upper))

    cursor.execute("DELETE FROM motor_sensor_threshold WHERE equipment_id = %s AND config_id = %s", (equipment_id, config_id))
    execute_values(
        cursor,
        """
        INSERT INTO motor_sensor_threshold (
            equipment_id, config_id, sensor_tag, window_start_at, window_end_at,
            lower_threshold, upper_threshold
        ) VALUES %s
        """,
        rows,
    )


def load_and_insert() -> None:
    df = prepare_dataframe()

    with psycopg2.connect(**DB_CONFIG) as conn:
        with conn.cursor() as cursor:
            equipment_id = resolve_id(
                cursor,
                MOTOR_EQUIPMENT_ID,
                "SELECT equipment_id FROM equipment WHERE equipment_type = 'MOTOR' ORDER BY unit_no, equipment_id LIMIT 1",
                "MOTOR equipment",
            )
            config_id = resolve_motor_config_id(cursor)

            print(f"Clearing motor_sensor_data for equipment_id={equipment_id}")
            cursor.execute("DELETE FROM motor_sensor_data WHERE equipment_id = %s", (equipment_id,))

            rows = [
                (equipment_id, row.measured_at.to_pydatetime(), *[float(getattr(row, tag)) for tag in MOTOR_SENSOR_TAGS])
                for row in df.itertuples(index=False)
            ]
            execute_values(
                cursor,
                f"""
                INSERT INTO motor_sensor_data (
                    equipment_id, measured_at, {", ".join(MOTOR_SENSOR_TAGS)}
                ) VALUES %s
                """,
                rows,
            )
            save_thresholds(cursor, equipment_id, config_id, df)

    print(f"[SUCCESS] Loaded {len(df)} motor rows and {len(MOTOR_SENSOR_TAGS)} thresholds.")


if __name__ == "__main__":
    load_and_insert()
