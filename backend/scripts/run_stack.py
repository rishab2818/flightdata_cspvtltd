"""Run the full backend stack with a single command.

This helper uses Docker to start MongoDB, Redis, and MinIO, then launches
uvicorn and a Celery worker with autoscale bounds derived from
``app.core.system_info``. It is intended to be run from the ``backend``
folder:

    python scripts/run_stack.py --host 0.0.0.0 --port 8000

By default this script will auto-compile and install the ``flightdata_rust``
extension (via maturin) if it is not already available in the active Python
environment. Pass ``--no-build-rust`` to skip this step if you have already
installed the wheel elsewhere.

Press ``Ctrl+C`` to stop the API and Celery processes. Docker containers are
left running so they can be reused across runs.
"""

import argparse
import importlib
import signal
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, Iterable, List, Optional

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.system_info import describe_autoscale
DATA_ROOT = PROJECT_ROOT / "data"


def run_command(
    args: List[str], check: bool = True, cwd: Optional[Path] = None
) -> subprocess.CompletedProcess:
    result = subprocess.run(
        args,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        cwd=str(cwd) if cwd else None,
    )
    if check and result.returncode != 0:
        raise RuntimeError(f"Command failed ({' '.join(args)}):\n{result.stdout}")
    return result


def ensure_docker_available() -> None:
    if shutil.which("docker") is None:
        raise RuntimeError("Docker is required to start MongoDB, Redis, and MinIO. Please install Docker and ensure it is on PATH.")
    try:
        run_command(["docker", "info"], check=True)
    except RuntimeError as exc:
        raise RuntimeError("Docker is installed but not reachable. Is the daemon running?") from exc


def _windows_rust_help() -> str:
    return (
        "Windows quick help: ensure Docker Desktop is running, install the "
        "Visual Studio Build Tools with C++ workload, and confirm `cargo` is "
        "on PATH (install from https://rustup.rs/). Then re-run this script; it "
        "will compile flightdata_rust automatically."
    )


def ensure_rust_extension(build: bool) -> None:
    """Guarantee the compiled Rust wheel is importable.

    If ``flightdata_rust`` is missing, build/install it with ``maturin`` in
    release mode unless the user explicitly disables the build. This keeps the
    ingestion/visualization paths on the Rust fast path without requiring a
    manual install step. ``flightdata_rust`` is the Rust extension that powers
    the faster parsers used by Celery tasks; it is built from
    ``backend/rust/flightdata_rust``.
    """

    try:
        importlib.import_module("flightdata_rust")
        print("[rust] flightdata_rust already installed")
        return
    except ModuleNotFoundError:
        if not build:
            raise RuntimeError(
                "flightdata_rust extension is not installed and auto-build is "
                "disabled. Rerun without --no-build-rust (or install the "
                "wheel manually)."
            )

    if shutil.which("cargo") is None:
        msg = (
            "Rust toolchain (cargo) is not available. Install Rust from "
            "https://rustup.rs/ and re-run this script to compile the "
            "flightdata_rust extension automatically."
        )
        if sys.platform.startswith("win"):
            msg = f"{msg}\n\n{_windows_rust_help()}"
        raise RuntimeError(msg)

    crate_dir = PROJECT_ROOT / "rust" / "flightdata_rust"
    print(f"[rust] building flightdata_rust from {crate_dir}")
    try:
        run_command([sys.executable, "-m", "pip", "install", "maturin>=1.4,<2"], check=True)
        run_command(
            [sys.executable, "-m", "maturin", "develop", "--release"],
            check=True,
            cwd=crate_dir,
        )
    except Exception as exc:  # noqa: BLE001 - show helpful guidance
        msg = f"flightdata_rust build failed: {exc}"
        if sys.platform.startswith("win"):
            msg = f"{msg}\n\n{_windows_rust_help()}"
        raise RuntimeError(msg) from exc

    importlib.import_module("flightdata_rust")
    print("[rust] flightdata_rust built and installed")


def container_exists(name: str) -> bool:
    result = run_command([
        "docker",
        "ps",
        "-a",
        "--filter",
        f"name=^{name}$",
        "--format",
        "{{.Names}}",
    ])
    return name in result.stdout.splitlines()


def container_running(name: str) -> bool:
    result = run_command([
        "docker",
        "ps",
        "--filter",
        f"name=^{name}$",
        "--format",
        "{{.Names}}",
    ])
    return name in result.stdout.splitlines()


def ensure_container(
    *,
    name: str,
    image: str,
    ports: Iterable[str],
    env: Optional[Dict[str, str]] = None,
    volumes: Optional[Iterable[str]] = None,
    command: Optional[Iterable[str]] = None,
) -> None:
    if container_running(name):
        print(f"[docker] {name} already running")
        return

    if container_exists(name):
        print(f"[docker] starting existing container {name}")
        run_command(["docker", "start", name])
        return

    cmd = ["docker", "run", "-d", "--name", name]
    for mapping in ports:
        cmd.extend(["-p", mapping])
    if volumes:
        for mapping in volumes:
            cmd.extend(["-v", mapping])
    if env:
        for key, value in env.items():
            cmd.extend(["-e", f"{key}={value}"])
    cmd.append(image)
    if command:
        cmd.extend(command)

    print(f"[docker] creating container {name} ({image})")
    run_command(cmd)


def ensure_data_dirs() -> None:
    for path in [DATA_ROOT / "mongo", DATA_ROOT / "minio"]:
        path.mkdir(parents=True, exist_ok=True)


def start_process(label: str, args: List[str]) -> subprocess.Popen:
    print(f"[proc] starting {label}: {' '.join(args)}")
    return subprocess.Popen(args)


def stop_processes(processes: List[subprocess.Popen]) -> None:
    for proc in processes:
        if proc.poll() is None:
            proc.terminate()
    for proc in processes:
        if proc.poll() is None:
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Start Mongo, Redis, MinIO, uvicorn, and Celery with one command.")
    parser.add_argument("--host", default="127.0.0.1", help="Host/interface for uvicorn (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Port for uvicorn (default: 8000)")
    parser.add_argument("--minio-console-port", type=int, default=9090, help="MinIO console port (default: 9090)")
    parser.add_argument("--minio-api-port", type=int, default=9000, help="MinIO API port (default: 9000)")
    parser.add_argument("--mongo-port", type=int, default=27017, help="MongoDB port (default: 27017)")
    parser.add_argument("--redis-port", type=int, default=6379, help="Redis port (default: 6379)")
    parser.add_argument(
        "--build-rust",
        action=argparse.BooleanOptionalAction,
        default=True,
        help=(
            "Build/install the flightdata_rust extension with maturin if it is "
            "missing (default: enabled). Use --no-build-rust to skip."
        ),
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    ensure_data_dirs()
    ensure_docker_available()
    ensure_rust_extension(build=args.build_rust)

    minio_env = {"MINIO_ROOT_USER": "minioadmin", "MINIO_ROOT_PASSWORD": "minioadmin"}

    ensure_container(
        name="flightdata-mongo",
        image="mongo:7",
        ports=[f"{args.mongo_port}:27017"],
        volumes=[f"{DATA_ROOT / 'mongo'}:/data/db"],
    )
    ensure_container(
        name="flightdata-redis",
        image="redis:7",
        ports=[f"{args.redis_port}:6379"],
    )
    ensure_container(
        name="flightdata-minio",
        image="quay.io/minio/minio",
        ports=[f"{args.minio_api_port}:9000", f"{args.minio_console_port}:9090"],
        env=minio_env,
        volumes=[f"{DATA_ROOT / 'minio'}:/data"],
        command=["server", "/data", "--console-address", f":{args.minio_console_port}"],
    )

    autoscale = describe_autoscale()
    print(
        "[autoscale] RAM: {ram} GB, CPU: {cpu}, Celery autoscale min={amin} max={amax}".format(
            ram=autoscale["ram_gb"],
            cpu=autoscale["cpus"],
            amin=autoscale["autoscale_min"],
            amax=autoscale["autoscale_max"],
        )
    )

    processes: List[subprocess.Popen] = []
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
                "--workers",
                "8",
            ],
        )
    )
    celery_cmd: List[str] = [
        sys.executable,
        "-m",
        "celery",
        "-A",
        "app.core.celery_app.celery_app",
        "worker",
        "--loglevel=info",
    ]

    if sys.platform.startswith("win"):
        # Celery's prefork pool is unsupported on Windows; use solo to avoid
        # spawn/unpack errors like "not enough values to unpack".
        celery_cmd.extend(["-P", "solo"])
        print("[celery] Windows detected; using solo pool (autoscale disabled)")
    else:
        celery_cmd.append(
            f"--autoscale={autoscale['autoscale_max']},{autoscale['autoscale_min']}"
        )

    processes.append(start_process("celery", celery_cmd))

    def handle_signal(signum, frame):
        print("\n[proc] stopping processes...")
        stop_processes(processes)
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    print(f"API available at http://{args.host}:{args.port}")
    print(f"MinIO console available at http://{args.host}:{args.minio_console_port}")
    print("Press Ctrl+C to stop uvicorn and Celery; Docker containers stay running.")

    try:
        while True:
            for proc in processes:
                if proc.poll() is not None:
                    raise RuntimeError(f"{proc.args} exited unexpectedly with code {proc.returncode}")
            time.sleep(1)
    except KeyboardInterrupt:
        handle_signal(signal.SIGINT, None)
    except Exception as exc:  # noqa: BLE001 - top-level safety net
        print(f"[proc] exiting due to: {exc}")
        stop_processes(processes)
        sys.exit(1)


if __name__ == "__main__":
    main()
