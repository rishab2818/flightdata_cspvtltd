import os
from math import ceil
import psutil


def detect_resources():
    total_gb = psutil.virtual_memory().total / (1024 ** 3)
    cpu_count = os.cpu_count() or 2
    return total_gb, cpu_count


def autoscale_bounds():
    """Return Celery autoscale bounds.

    We target eight workers so large ingestion jobs (including multi-GB files)
    can be processed concurrently without manual tuning.
    """

    _total_gb, cpu_count = detect_resources()
    # Honour host resources but never drop below an 8-worker ceiling requested
    # for heavy workloads. When CPUs are fewer than 8 we still cap at 8 to
    # favour throughput; Celery/OS scheduling will share cores as needed.
    max_workers = max(8, cpu_count)
    min_workers = max(4, max_workers // 2)
    return min_workers, max_workers


def describe_autoscale():
    min_w, max_w = autoscale_bounds()
    total_gb, cpu = detect_resources()
    return {
        "ram_gb": round(total_gb, 2),
        "cpus": cpu,
        "autoscale_min": min_w,
        "autoscale_max": max_w,
    }


if __name__ == "__main__":
    import json

    print(json.dumps(describe_autoscale(), indent=2))
