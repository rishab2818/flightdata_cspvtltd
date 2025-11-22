# FlightData Backend

This folder contains the FastAPI backend along with helper scripts for running
its dependencies (MongoDB, Redis, and MinIO) locally.

## Quick start (one command)
1. Install system requirements: Python 3.11+, Docker running and on your PATH.
2. Install dependencies once:
   ```bash
   python -m pip install --upgrade pip
   python -m pip install -r requirements.txt
   ```
3. From this `backend/` folder, start everything with a single command:
   ```bash
   python scripts/run_stack.py --host 0.0.0.0 --port 8000
   ```
   The script will:
   - Ensure Docker containers for MongoDB, Redis, and MinIO are running
     (creating them if needed and storing data under `backend/data/`).
   - Launch uvicorn for the API.
   - Launch a Celery worker with autoscale bounds derived from your CPU/RAM.
     On Windows, Celery falls back to the `solo` pool (autoscale disabled)
     because the prefork pool is unsupported.

Access the API at `http://<host>:<port>/docs` and the MinIO console at
`http://<host>:9090`. Press `Ctrl+C` to stop uvicorn and Celery; the Docker
containers remain running so later starts are fast.

## Environment overrides
Defaults in `app/core/config.py` expect services on localhost. Override values
by creating a `.env` file in this folder:
```env
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DB=flightdv
REDIS_URL=redis://127.0.0.1:6379/0
MINIO_ENDPOINT=127.0.0.1:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_SECURE=false
MINIO_INGESTION_BUCKET=ingestion
JWT_SECRET=change-me
```
