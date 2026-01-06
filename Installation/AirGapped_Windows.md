# Air-gapped Installation Guide (Windows)

This guide explains how to package and run the FlightData backend (FastAPI) and frontend (React/Vite) on a Windows computer that has **no internet access**. The process has two phases:
1. **Prepare on a computer that does have internet.** Download everything and place it on a USB drive or DVD.
2. **Install and run on the offline Windows server.** Follow the simple steps with the materials you prepared.

The instructions use screenshots and menus you will see on Windows. Anyone comfortable installing normal software can follow them.

---

## Part A — Prepare the installation media (online computer)

### 1) Collect installers (save them in a folder called `installers/`)
- **Docker Desktop for Windows** (stable release). Download the installer `.exe` from Docker's website.
- **Python 3.11 (64-bit) Windows installer**. Choose the installer that works without internet ("offline installer").
- **Node.js LTS (18 or 20) 64-bit Windows installer**. Download the `.msi` so it can run without internet.
- **PowerShell 7 (if the offline PC does not already have it)** from Microsoft's download page.

### 2) Get the repository files
- Clone or download this repository.
- Copy the entire `flightdata_cspvtltd` folder onto your media. This includes the `backend/` and `frontend/` folders.

### 3) Save Docker images for MongoDB, MinIO, and Redis
The backend uses Docker to run MongoDB, MinIO, and Redis automatically.【F:backend/README.md†L17-L23】
1. Open PowerShell on the online computer.
2. Pull the images (only needs to happen once):
   ```pwsh
   docker pull mongo:7
   docker pull redis:7
   docker pull quay.io/minio/minio:latest
   ```
3. Save them as files so they can be loaded offline:
   ```pwsh
   mkdir -Force images
   docker save mongo:7    -o images/mongo-7.tar
   docker save redis:7    -o images/redis-7.tar
   docker save quay.io/minio/minio:latest -o images/minio-latest.tar
   ```
4. Copy the `images/` folder to your installation media.

### 4) Download Python dependencies for offline use
The backend uses FastAPI, Celery, and other Python packages listed in `backend/requirements.txt`.【F:backend/README.md†L6-L23】
1. In PowerShell, go to the `backend` folder from the repository copy on the online computer.
2. Create a download folder and fetch all required wheels:
   ```pwsh
   python -m pip install --upgrade pip
   mkdir -Force wheelhouse
   python -m pip download -r requirements.txt -d wheelhouse
   ```
3. Confirm the `wheelhouse/` folder now holds many `.whl` files. Copy this folder to your installation media.

### 5) Prepare the frontend dependencies
The frontend uses Vite and React, with dependencies listed in `frontend/package.json`.【F:frontend/package.json†L6-L26】
1. On the online computer, go to the `frontend` folder.
2. Install the node modules so they are ready for offline use:
   ```pwsh
   npm ci
   ```
3. Build the production site (creates a `dist/` folder):
   ```pwsh
   npm run build
   ```
4. Copy the following to your installation media:
   - The entire `frontend/node_modules/` folder (so offline installs do not need the internet).
   - The `frontend/dist/` folder (ready-to-serve static files).
   - The original `frontend/package-lock.json` and `frontend/package.json` (already in the repo copy).

### 6) Optional: add helpful extras
- A text file with the commands from this guide for quick copy/paste.
- A short note of the API URL you plan to use (for example, `http://localhost:8000`).

When Parts 1–6 are finished, your installation media should contain:
- `installers/` (Docker Desktop, Python, Node.js, PowerShell installers)
- `images/` (Mongo, MinIO, Redis Docker image tar files)
- `backend/wheelhouse/` (Python wheels)
- `frontend/node_modules/` and `frontend/dist/`
- The whole repository folder (`flightdata_cspvtltd`) with its scripts.

---

## Part B — Install and run on the offline Windows server

### 1) Copy files from the media
1. Create a folder on the server, e.g., `C:\flightdata`.
2. Copy everything from the installation media into that folder, keeping the same structure.

### 2) Install required software (one time)
1. **Docker Desktop:** run the installer from `installers/`. Accept defaults and start Docker Desktop. Make sure it shows "Running" in the task tray.
2. **Python 3.11:** run the offline installer. Check "Add python.exe to PATH" when offered.
3. **Node.js LTS:** run the `.msi`. This installs `node` and `npm`.
4. **PowerShell 7 (if needed):** run the installer so you can execute the helper scripts.

### 3) Load the Docker images (one time)
1. Open PowerShell (as a regular user is fine) and go to `C:\flightdata\images`.
2. Load each image file:
   ```pwsh
   docker load -i mongo-7.tar
   docker load -i redis-7.tar
   docker load -i minio-latest.tar
   ```
   After this, Docker can start MongoDB, Redis, and MinIO without internet.

### 4) Set up the backend (FastAPI + Celery)
1. Open PowerShell and go to `C:\flightdata\flightdata_cspvtltd\backend`.
2. Create and activate a virtual environment:
   ```pwsh
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
3. Install Python packages **from the local wheelhouse only**:
   ```pwsh
   python -m pip install --no-index --find-links .\wheelhouse -r requirements.txt
   ```
4. (Optional) Create a `.env` file in this folder if you want to change database or MinIO settings. The defaults already point to local services as shown in `backend/README.md`.【F:backend/README.md†L29-L41】
5. Start the full backend stack (API + Celery + required containers):
   ```pwsh
   python scripts/run_stack.py --host 0.0.0.0 --port 8000
   ```
   - The script will start MongoDB, Redis, and MinIO using Docker (data stored under `backend/data/`).【F:backend/README.md†L17-L23】
   - The API will be available at `http://localhost:8000/docs`.【F:backend/README.md†L25-L27】
   - On Windows, Celery uses a single-worker "solo" mode automatically. You do not need to configure anything.【F:backend/README.md†L21-L23】
6. Leave this PowerShell window open so the backend keeps running. Stop it anytime with `Ctrl+C`.

### 5) Set up the frontend (React/Vite)
You can either run the built static files or use the development server.

**Option A: Serve the pre-built static site (simplest)**
1. Go to `C:\flightdata\flightdata_cspvtltd\frontend`.
2. Install a small static server (first time only, uses the bundled modules):
   ```pwsh
   npm set offline true
   npm install serve --cache .\.npm-cache --prefer-offline
   ```
3. Serve the built files from `dist/`:
   ```pwsh
   npx serve dist --listen 4173
   ```
4. Open a browser on the server and visit `http://localhost:4173`. The site will talk to the backend at the API URL defined in your `.env`.

**Option B: Run the Vite dev server (if you need live reload)**
1. Ensure `frontend/node_modules/` exists (copied from the media).
2. In PowerShell, from `frontend/` run:
   ```pwsh
   npm run dev -- --host --port 5173
   ```
3. Open `http://localhost:5173` in a browser.

> If the frontend needs to reach a different API URL, create a file `frontend/.env` with `VITE_API_BASE_URL=http://localhost:8000` (or whatever host/port you chose). The React app reads this at startup.

### 6) Verifying everything works
- Backend API docs: open `http://localhost:8000/docs`. You should see the FastAPI Swagger page.【F:backend/README.md†L25-L27】
- MinIO console: open `http://localhost:9090` (user: `minioadmin`, password: `minioadmin`).
- Frontend: open the URL from Option A or B and log in / upload files as usual.

### 7) Stopping and restarting
- To stop the backend, press `Ctrl+C` in its PowerShell window. Restart with the same command in step 4.5.
- To stop the frontend server, press `Ctrl+C` in its PowerShell window. Restart with the same command in step 5.
- Docker containers keep their data under `backend/data/`, so your MongoDB/MinIO data persists between runs.

---

## Quick checklist for the offline operator
- [ ] Install Docker Desktop, Python 3.11, Node.js, and PowerShell (if needed) from the `installers/` folder.
- [ ] Load `mongo-7.tar`, `redis-7.tar`, and `minio-latest.tar` using `docker load`.
- [ ] Create the Python venv and install from `wheelhouse` with `--no-index`.
- [ ] Run `python scripts/run_stack.py --host 0.0.0.0 --port 8000`.
- [ ] Serve the frontend via `npx serve dist --listen 4173` (or run `npm run dev`).
- [ ] Open the browser to confirm: `http://localhost:8000/docs`, `http://localhost:9090`, and the frontend URL.

You now have a fully offline, repeatable installation that fits on a CD or USB drive.
