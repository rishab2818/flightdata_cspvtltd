"""
Run the full backend stack WITHOUT Docker.

Starts:
- MongoDB (Windows service)
- Redis (Memurai service)
- MinIO (local executable)
- Uvicorn API
- Celery worker (solo pool on Windows)

Usage:
    python scripts/run_stack_nodocker.py --host 0.0.0.0 --port 8000
"""

import argparse
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import List

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.system_info import describe_autoscale  # noqa

# ---------------- CONFIG ----------------
MONGO_SERVICE_NAME = ["MongoDB"]
REDIS_SERVICE_NAME = ["memurai"]

MINIO_EXE = Path("C:/minio/minio.exe")
MINIO_DATA = Path("C:/minio-data")

# ----------------------------------------


def run_cmd(cmd: List[str], check: bool = True) -> subprocess.CompletedProcess:
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if check and result.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}\n{result.stdout}")
    return result


# def ensure_windows_service_running(service_name: str) -> None:
#     print(f"[service] checking {service_name}")
#     result = run_cmd(["sc", "query", service_name], check=False)
#     if "RUNNING" in result.stdout:
#         print(f"[service] {service_name} already running")
#         return

#     print(f"[service] starting {service_name}")
#     run_cmd(["sc", "start", service_name])

def ensure_windows_service_running_exact(service_names: list[str]) -> None:
    """
    Ensures one of the given Windows service names exists and is running.
    Matching is STRICT against SERVICE_NAME only.
    """

    print(f"[service] checking services: {service_names}")

    result = run_cmd(["sc", "query", "type=", "service"], check=False)
    lines = result.stdout.splitlines()

    existing_services = []

    for line in lines:
        if line.strip().startswith("SERVICE_NAME:"):
            svc = line.split(":", 1)[1].strip()
            existing_services.append(svc)

    matched_service = None
    for name in service_names:
        for svc in existing_services:
            if svc.lower() == name.lower():
                matched_service = svc
                break
        if matched_service:
            break

    if not matched_service:
        raise RuntimeError(
            f"None of these services were found: {service_names}\n"
            f"Available services (partial): {existing_services[:15]}"
        )

    status = run_cmd(["sc", "query", matched_service], check=False).stdout
    if "RUNNING" in status:
        print(f"[service] {matched_service} already running")
        return

    print(f"[service] starting {matched_service}")
    run_cmd(["sc", "start", matched_service])





def start_process(label: str, args: List[str]) -> subprocess.Popen:
    print(f"[proc] starting {label}: {' '.join(args)}")
    return subprocess.Popen(args)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Start backend stack without Docker")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--minio-console-port", type=int, default=9090)
    parser.add_argument("--minio-api-port", type=int, default=9000)
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    # 1️⃣ Ensure MongoDB + Redis services
    ensure_windows_service_running_exact(MONGO_SERVICE_NAME)
    ensure_windows_service_running_exact(REDIS_SERVICE_NAME)

    # 2️⃣ Start MinIO (if not already running)
    minio_proc = start_process(
        "minio",
        [
            str(MINIO_EXE),
            "server",
            str(MINIO_DATA),
            "--console-address",
            f":{args.minio_console_port}",
        ],
    )

    autoscale = describe_autoscale()
    print(
        "[autoscale] RAM={ram}GB CPU={cpu}".format(
            ram=autoscale["ram_gb"],
            cpu=autoscale["cpus"],
        )
    )

    processes: List[subprocess.Popen] = []

    # 3️⃣ Start Uvicorn (USE VENV PYTHON)
    processes.append(
        start_process(
            "uvicorn",
            [
                sys.executable,
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                args.host,
                "--port",
                str(args.port),
            ],
        )
    )

    # 4️⃣ Start Celery
    celery_cmd = [
        sys.executable,
        "-m",
        "celery",
        "-A",
        "app.core.celery_app.celery_app",
        "worker",
        "--loglevel=info",
    ]

    if sys.platform.startswith("win"):
        celery_cmd.extend(["-P", "solo"])
        print("[celery] Windows detected → solo pool")

    processes.append(start_process("celery", celery_cmd))

    # ---------------- SIGNAL HANDLING ----------------
    def shutdown(signum, frame):
        print("\n[proc] shutting down...")
        for p in processes:
            if p.poll() is None:
                p.terminate()
        if minio_proc.poll() is None:
            minio_proc.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    print(f"API: http://{args.host}:{args.port}")
    print(f"MinIO Console: http://{args.host}:{args.minio_console_port}")
    print("Press Ctrl+C to stop")

    # ---------------- WATCHDOG LOOP ----------------
    try:
        while True:
            for p in processes:
                if p.poll() is not None:
                    raise RuntimeError(f"{p.args} exited unexpectedly")
            time.sleep(1)
    except KeyboardInterrupt:
        shutdown(signal.SIGINT, None)


if __name__ == "__main__":
    main()
