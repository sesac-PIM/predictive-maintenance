# TUBE data

Place the tube leakage dataset here for local or EC2 loading.

Default path used by `ai/src/tube/db_loader.py`:

```text
ai/data/tube/IGCC 튜브누설 고장 데이터셋.xlsx
```

You can override the path with:

```text
TUBE_DATA_PATH=/absolute/path/to/dataset.xlsx
```

Do not commit private or oversized raw data unless the team has agreed to store it in Git.
