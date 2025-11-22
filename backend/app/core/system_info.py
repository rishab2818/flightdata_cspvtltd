import os
from math import ceil
import psutil


def detect_resources():
    total_gb = psutil.virtual_memory().total / (1024 ** 3)
    cpu_count = os.cpu_count() or 2
    return total_gb, cpu_count


def autoscale_bounds():
    """Compute Celery autoscale bounds based on RAM/CPU.

    Designed to run comfortably on 8 GB with conservative bounds while
    allowing larger hosts to scale up without manual tuning.
    """
    total_gb, cpu_count = detect_resources()

    if total_gb <= 8:
        max_workers = min(2, max(1, cpu_count))
    elif total_gb <= 16:
        max_workers = min(4, max(2, cpu_count))
    elif total_gb <= 32:
        max_workers = min(8, max(3, cpu_count * 2 // 3))
    elif total_gb <= 64:
        max_workers = min(12, cpu_count * 2)
    else:
        # On 128 GB+ let CPU drive the scale up to a safe ceiling
        max_workers = min(24, cpu_count * 4)

    min_workers = max(1, max_workers // 2)
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
