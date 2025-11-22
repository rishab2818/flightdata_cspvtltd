from celery import Celery
from app.core.config import settings
from app.core.system_info import autoscale_bounds

celery_app = Celery(
    settings.celery_task_prefix,
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.ingestion"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_acks_late=True,
    worker_max_tasks_per_child=100,
)


def autoscale_args():
    min_w, max_w = autoscale_bounds()
    return max_w, min_w


def print_autoscale():
    min_w, max_w = autoscale_bounds()
    print(f"Autoscale bounds -> max:{max_w} min:{min_w}")


if __name__ == "__main__":
    print_autoscale()
