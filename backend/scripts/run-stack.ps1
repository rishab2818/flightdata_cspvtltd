Param(
    [string]$PythonPath = "python",
    [string]$Host = "127.0.0.1",
    [int]$ApiPort = 8000
)

Write-Host "Starting Option 2 (FastAPI + Mongo + MinIO + Redis + Celery)" -ForegroundColor Cyan

# Derive autoscale bounds from the app helper
$autoscale = & $PythonPath - <<'PY'
from app.core.system_info import describe_autoscale
import json
print(json.dumps(describe_autoscale()))
PY

$autoscaleObj = $null
try { $autoscaleObj = $autoscale | ConvertFrom-Json } catch {}
if ($autoscaleObj) {
    Write-Host "Autoscale -> max: $($autoscaleObj.autoscale_max) min: $($autoscaleObj.autoscale_min) CPUs: $($autoscaleObj.cpus) RAM: $($autoscaleObj.ram_gb)GB" -ForegroundColor Green
}

$celeryMax = if($autoscaleObj){$autoscaleObj.autoscale_max}else{4}
$celeryMin = if($autoscaleObj){$autoscaleObj.autoscale_min}else{2}

# Start Redis if not running (docker required)
if (-not (Get-Process -Name redis-server -ErrorAction SilentlyContinue)) {
    Write-Host "Launching Redis via docker (container name: flightdata-redis)" -ForegroundColor Yellow
    docker run -d --name flightdata-redis -p 6379:6379 redis:7 2>$null | Out-Null
}

# Start API
Start-Process -NoNewWindow -FilePath $PythonPath -ArgumentList "-m", "uvicorn", "app.main:app", "--host", $Host, "--port", $ApiPort
Write-Host "API listening on http://$Host:$ApiPort" -ForegroundColor Green

# Start Celery worker
# Windows cannot use the prefork pool; force the solo pool to avoid spawn/unpack errors
$celeryArgs = @("-m", "celery", "-A", "app.core.celery_app.celery_app", "worker", "--pool=solo", "--concurrency=1", "--loglevel=info")
Start-Process -NoNewWindow -FilePath $PythonPath -ArgumentList $celeryArgs
Write-Host "Celery worker started with solo pool (concurrency 1)" -ForegroundColor Green
