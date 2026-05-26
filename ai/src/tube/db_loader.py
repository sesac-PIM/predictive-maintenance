import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

from runtime_config import DB_CONFIG, DATA_PATH, resolve_tube_equipment_ids


REQUIRED_COLUMNS = [
    "time",
    "SGC OUT TEMP",
    "HPHT FSH FLTR DP-A",
    "GF VSS PRESS TAP/ANSP DP",
    "MP Steam Flow",
    "MP STM DRUM IN FW FLW",
    "MP Balance",
    "Heat Duty",
    "IG Load %",
    "Demi Water Trans Pump Discharge Flow",
]

NORMAL_SHEET_CANDIDATES = ["정상 데이터", "정상데이터", "normal", "Normal"]
ABNORMAL_SHEET_CANDIDATES = ["비정상 데이터", "비정상데이터", "abnormal", "Abnormal"]


def _pick_sheet(sheet_names, candidates):
    normalized = {name.replace(" ", "").lower(): name for name in sheet_names}
    for candidate in candidates:
        found = normalized.get(candidate.replace(" ", "").lower())
        if found:
            return found
    return None


def _convert_time(series):
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_datetime(series, unit="D", origin="1899-12-30")
    return pd.to_datetime(series)


def _load_dataset():
    print(f"Reading Excel: {DATA_PATH}")
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"TUBE data file not found: {DATA_PATH}. "
            "Place the dataset in ai/data/tube or set TUBE_DATA_PATH."
        )

    workbook = pd.ExcelFile(DATA_PATH)
    normal_sheet = _pick_sheet(workbook.sheet_names, NORMAL_SHEET_CANDIDATES)
    abnormal_sheet = _pick_sheet(workbook.sheet_names, ABNORMAL_SHEET_CANDIDATES)
    data_sheet = abnormal_sheet or normal_sheet or workbook.sheet_names[0]

    df = pd.read_excel(DATA_PATH, sheet_name=data_sheet)
    missing = [column for column in REQUIRED_COLUMNS if column not in df.columns]
    if missing:
        raise ValueError(f"Missing required TUBE columns: {missing}")

    df = df[REQUIRED_COLUMNS].copy()
    df["time"] = _convert_time(df["time"])
    df = df.dropna(subset=REQUIRED_COLUMNS).sort_values("time").reset_index(drop=True)

    if normal_sheet and abnormal_sheet:
        df_normal = pd.read_excel(DATA_PATH, sheet_name=normal_sheet)
        if "time" not in df_normal.columns:
            raise ValueError(f"Missing time column in normal sheet: {normal_sheet}")

        df_normal["time"] = _convert_time(df_normal["time"])
        normal_start = df_normal["time"].min()
        normal_end = df_normal["time"].max()
        print(f"Normal data range: {normal_start} ~ {normal_end}")
        df = df[~df["time"].between(normal_start, normal_end)].reset_index(drop=True)
    else:
        print(f"Using sheet '{data_sheet}' as monitoring data.")

    print(f"Rows to insert into DB: {len(df)}")
    if len(df) > 0:
        print(f"Monitoring range: {df['time'].min()} ~ {df['time'].max()}")

    return df


def load_and_insert():
    df = _load_dataset()
    if df.empty:
        print("No monitoring rows to insert.")
        return

    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        equipment_ids = resolve_tube_equipment_ids(cur)

        print(f"Clearing TUBE source and derived data for {len(equipment_ids)} TUBE equipments...")
        cur.execute("""
            DELETE FROM tube_anomaly_sensor_contribution
            WHERE tube_anomaly_result_id IN (
                SELECT tube_anomaly_result_id
                FROM tube_anomaly_result
                WHERE equipment_id = ANY(%s)
            )
        """, (equipment_ids,))
        cur.execute("DELETE FROM alert_history WHERE equipment_id = ANY(%s) AND anomaly_result_type = 'TUBE'", (equipment_ids,))
        cur.execute("DELETE FROM tube_anomaly_result WHERE equipment_id = ANY(%s)", (equipment_ids,))
        cur.execute("DELETE FROM inference_checkpoint WHERE equipment_id = ANY(%s) AND equipment_type = 'TUBE'", (equipment_ids,))
        cur.execute("DELETE FROM tube_sensor_data WHERE equipment_id = ANY(%s)", (equipment_ids,))
        cur.execute("""
            UPDATE equipment
            SET status = 'NORMAL',
                status_updated_at = CURRENT_TIMESTAMP
            WHERE equipment_id = ANY(%s)
        """, (equipment_ids,))

        query = """
            INSERT INTO tube_sensor_data (
                equipment_id, measured_at,
                tag_13tt0064, tag_15pdt0002a, tag_13pdt0067,
                tag_13fi0044, tag_13ffyc0046, tag_13fy0045,
                tag_13jyi9001, tag_10ind0001, bopc1_1_16200_fi_po041
            ) VALUES %s
        """

        total_rows = 0
        for equipment_id in equipment_ids:
            data_to_insert = []
            for _, row in df.iterrows():
                data_to_insert.append(
                    (
                        equipment_id,
                        row["time"],
                        row["SGC OUT TEMP"],
                        row["HPHT FSH FLTR DP-A"],
                        row["GF VSS PRESS TAP/ANSP DP"],
                        row["MP Steam Flow"],
                        row["MP STM DRUM IN FW FLW"],
                        row["MP Balance"],
                        row["Heat Duty"],
                        row["IG Load %"],
                        row["Demi Water Trans Pump Discharge Flow"],
                    )
                )
            execute_values(cur, query, data_to_insert)
            total_rows += len(data_to_insert)

        conn.commit()
        print(f"[SUCCESS] {total_rows} rows -> tube_sensor_data ({len(equipment_ids)} equipments)")

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[ERROR] {e}")
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    load_and_insert()
