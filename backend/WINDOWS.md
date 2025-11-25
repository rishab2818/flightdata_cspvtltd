# Running the FastAPI backend on Windows

These steps assume Windows 10/11 with PowerShell 7+. They keep the Option 2 stack (FastAPI + MongoDB + MinIO + Redis + Celery) self-contained while respecting the autoscale bounds already built into the `run-stack.ps1` helper.

## 1. Prerequisites
- **Python 3.11+** installed and on your `PATH`.
- **PowerShell 7+** (preferred for consistent scripting).
- **Docker Desktop** running (used to start MongoDB, Redis, and an optional MinIO container).
- **Git** to clone the repository.

## 2. Clone and create a virtual environment
```pwsh
git clone https://github.com/<your-org>/flightdata_cspvtltd.git
cd flightdata_cspvtltd\backend
python -m venv .venv
./.venv/Scripts/Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

## 3. Configure environment (optional)
Defaults in `app/core/config.py` already point to `localhost` for MongoDB, Redis, and MinIO. If you need to override anything (e.g., changing JWT secret or MinIO credentials), create a `.env` file in `backend/`:
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

## 4. Start backing services (MongoDB, MinIO, Redis)
Run these in PowerShell with Docker Desktop running. Redis is auto-started by the stack script, but starting it yourself is harmless.
```pwsh
# MongoDB (data persisted to a local folder)
docker run -d --name flightdata-mongo -p 27017:27017 -v "$PWD/data/mongo:/data/db" mongo:7

# MinIO (if you prefer Docker instead of the bundled start-minio.ps1)
docker run -d --name flightdata-minio -p 9000:9000 -p 9090:9090 \ 
  -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin \ 
  -v "$PWD/data/minio:/data" quay.io/minio/minio server /data --console-address ":9090"

# Redis (optional here; run-stack.ps1 will also start it)
docker run -d --name flightdata-redis -p 6379:6379 redis:7
```
> If you already have a native MinIO install, you can instead run `../start-minio.ps1` after adjusting its `MINIO_EXE` and data directory paths.

## 5. Launch the API and Celery
The helper script computes autoscale bounds from your CPU/RAM and then launches uvicorn and Celery workers. Because Celery's prefork pool is not supported on Windows, the script uses the `solo` pool (single worker) to avoid spawn/unpack errors you may see in the logs. Run it from `backend/` with your virtual environment active:
```pwsh
./scripts/run-stack.ps1 -PythonPath "./.venv/Scripts/python.exe" -Host "127.0.0.1" -ApiPort 8000
```
- API will be available at `http://127.0.0.1:8000`.
- Celery runs with the `solo` pool on Windows; autoscale is disabled because it depends on the prefork pool.
- If Redis is not running, the script will start a `flightdata-redis` Docker container automatically.

## 6. Verifying and interacting
- Open `http://127.0.0.1:8000/docs` for the FastAPI Swagger UI.
- Upload files via the ingestion endpoints; MinIO buckets `ingestion` and `user-docs` will be created on demand by the tasks.
- Logs from uvicorn and Celery appear in the PowerShell windows started by the script. Stop them with `Ctrl+C` or by closing the processes.

## 7. Stopping services
```pwsh
# Stop API/Celery: close the PowerShell sessions or end the processes.
# Stop Docker containers (if you started them):
docker stop flightdata-mongo flightdata-minio flightdata-redis
# Remove them when you are done:
docker rm flightdata-mongo flightdata-minio flightdata-redis
```
