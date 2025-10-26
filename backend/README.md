# FlightDV Backend (FastAPI + MongoDB + JWT)

Features:
- Seed `admin` user (password `admin`)
- `/api/auth/login` -> returns JWT + role + access_level_value
- CORS for Vite dev on 5173

## Windows Setup (MongoDB + Backend)

### 1) Install MongoDB Community Server (no Docker required)
- Download from: https://www.mongodb.com/try/download/community
- During install, check **Install MongoDB as a Service**.
- Default service listens on `mongodb://localhost:27017`.
- Open *Services* and ensure **MongoDB Server** is running.

(Alternative via Docker Desktop)
```powershell
docker run --name mongodb -d -p 27017:27017 -v %cd%\mongo_data:/data/db mongo:6
```

### 2) Run the backend
```powershell
# From this folder
.un_dev.ps1
```
- The script creates a venv, installs deps, copies `.env.example` to `.env`, seeds admin, and runs Uvicorn on **http://127.0.0.1:8000**.

### 3) Test login
```bash
curl -X POST http://127.0.0.1:8000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"admin\",\"password\":\"admin\"}"
```

### 4) Connect frontend
- Add a simple fetch to `POST /api/auth/login` and, on success, set your React context using returned `username`, `role`, and `access_level_value`.
- Keep the JWT for future calls in `localStorage` (we'll add protected APIs later).

## Nginx (reverse proxy)
- Download Windows build: https://nginx.org/en/download.html
- Replace `conf/nginx.conf` with `nginx.conf.example` OR add the server block into yours.
- Start `nginx.exe`. It will listen on `http://localhost:8080` and proxy to Uvicorn on 8000.

## Project Layout
```
app/
  core/        # config, security
  db/          # mongo client
  models/      # pydantic models + role map
  routers/     # auth router
  main.py
scripts/
  seed_admin.py
.env.example
nginx.conf.example
requirements.txt
run_dev.ps1
```
