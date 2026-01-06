# start-minio.ps1
# PowerShell script to set MinIO environment and start the server

# --- Configuration ---
$MINIO_USER = "minioadmin"
$MINIO_PASS = "minioadmin"
$DATA_DIR = "D:\minio-data"
$MINIO_EXE = "C:\minio\minio.exe"
$SERVER_ADDRESS = ":9000"
$CONSOLE_ADDRESS = ":9090"

# --- Set Environment Variables (for current session) ---
Write-Host "Setting MinIO credentials..." -ForegroundColor Green
$env:MINIO_ROOT_USER = $MINIO_USER
$env:MINIO_ROOT_PASSWORD = $MINIO_PASS

# Optional: Set permanently (uncomment if needed)
# [Environment]::SetEnvironmentVariable("MINIO_ROOT_USER", $MINIO_USER, "User")
# [Environment]::SetEnvironmentVariable("MINIO_ROOT_PASSWORD", $MINIO_PASS, "User")

# --- Create Data Directory ---
Write-Host "Creating data directory at $DATA_DIR..." -ForegroundColor Green
if (-not (Test-Path $DATA_DIR)) {
    New-Item -ItemType Directory -Path $DATA_DIR -Force | Out-Null
    Write-Host "Directory created: $DATA_DIR" -ForegroundColor Cyan
} else {
    Write-Host "Directory already exists: $DATA_DIR" -ForegroundColor Yellow
}

# --- Change to MinIO Directory ---
Write-Host "Changing to MinIO directory: $(Split-Path $MINIO_EXE -Parent)" -ForegroundColor Green
Set-Location (Split-Path $MINIO_EXE -Parent)

# --- Start MinIO Server ---
Write-Host "Starting MinIO server..." -ForegroundColor Green
Write-Host "Access API at: http://127.0.0.1$SERVER_ADDRESS" -ForegroundColor Cyan
Write-Host "Access Console at: http://127.0.0.1$CONSOLE_ADDRESS" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow

& $MINIO_EXE server $DATA_DIR --address $SERVER_ADDRESS --console-address $CONSOLE_ADDRESS