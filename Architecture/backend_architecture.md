# Backend Architecture

## Top-level system overview
- **API layer**: A FastAPI application (`app/main.py`) exposes REST endpoints for authentication, projects, data ingestion, visualizations, notifications, meetings, student engagement, and related resources. It centralizes CORS, routing, and health checks so clients have a single entry point.
- **Data persistence**: MongoDB stores application documents such as users, projects, records, notifications, and ingestion jobs. Both asynchronous (`motor`) and synchronous (`pymongo`) clients are available depending on whether the caller runs inside FastAPI or a Celery worker.
- **Object storage**: MinIO (S3-compatible) holds uploaded files (ingestion inputs, visualizations, documents). The backend streams objects in and out and keeps metadata in MongoDB.
- **Cache and messaging**: Redis underpins two roles: (1) the Celery broker/result backend for background tasks, and (2) a pub/sub + hash store for publishing ingestion/visualization job progress to clients.
- **Background processing**: Celery workers execute ingestion and visualization tasks. They autoscale based on host resources to keep long-running jobs responsive.
- **Configuration**: Environment-driven settings (MongoDB/Redis/MinIO credentials, JWT parameters, CORS origins, Celery prefix) are centralized in `app/core/config.py`, keeping deployments consistent.

## Application composition (FastAPI)
- **App bootstrap**: `app/main.py` instantiates the FastAPI app, applies CORS middleware with configured origins, exposes `/health`, and mounts routers for each domain (auth, users, projects, documents, records, student engagement, ingestion, visualizations, notifications, meetings). This keeps HTTP surface area modular while sharing middleware and dependencies.
- **Authentication dependency**: `app/core/auth.py` defines `get_current_user` to decode JWTs, enforce presence of a `sub` and `role`, and expose the user to route handlers. The helper `require_head` restricts certain endpoints to GD/DH roles.
- **Configuration loader**: `app/core/config.py` uses `pydantic-settings` to pull configuration from environment variables or `.env`, normalizing CORS origin lists, JWT settings, data stores, and Celery prefixes.

## Data and integration layers
- **MongoDB connections**: `app/db/mongo.py` provides a singleton `AsyncIOMotorClient` for request-time operations, while `app/db/sync_mongo.py` offers a cached synchronous client for Celery tasks. Both target the same database name and URI defined in settings.
- **Redis clients**: `app/core/redis_client.py` exposes cached async and sync Redis clients, allowing web handlers to use async Redis APIs and workers to use blocking operations with shared configuration.
- **MinIO client**: `app/core/minio_client.py` lazily instantiates a global MinIO SDK client with endpoint, credentials, and TLS mode drawn from settings, ensuring consistent buckets for documents, ingestion sources, and visualization outputs.
- **System awareness**: `app/core/system_info.py` computes RAM/CPU and returns autoscale bounds so Celery workers can scale between sensible minimums and maximums based on host capacity.

## Domain modules and routing
- **Routers**: Each feature area has its own router under `app/routers/`, keeping URL prefixes, response models, and dependency wiring localized. Examples include `projects` (membership-gated project CRUD and member search), `documents` (MinIO-backed file handling), `records` (data records), `student_engagement`, `ingestion`, `visualizations`, `notifications`, and `meetings`. Routers depend on the authentication dependency and typically call repositories for data access.
- **Models**: Pydantic models in `app/models/` describe request/response schemas for users, projects, documents, ingestion jobs, visualizations, notifications, meetings, student engagement, and records. They enforce shape and validation across routers and tasks.
- **Repositories**: Classes in `app/repositories/` encapsulate MongoDB queries per domain (projects, ingestions, visualizations, notifications), keeping persistence logic isolated from route handlers and tasks.

## Background jobs and streaming updates
- **Celery setup**: `app/core/celery_app.py` builds a Celery app using Redis for broker and results. It registers ingestion and visualization task modules, configures JSON serializers, late acknowledgements, worker recycling, and provides helper functions for autoscale arguments based on host resources.
- **Ingestion pipeline**: `app/tasks/ingestion.py` defines the `ingest_file` task to pull uploaded files from MinIO, parse headers or samples (CSV, Excel, DAT, MAT), and publish progress to Redis channels while persisting job status in hashes. It also creates user notifications in MongoDB to surface job outcomes.
- **Visualization pipeline**: `app/tasks/visualization.py` consumes stored ingestion results to generate visualization artifacts, writing outputs back to MinIO, updating MongoDB records, and broadcasting status via Redis similar to ingestion tasks.
- **Progress delivery**: Both pipelines use Redis pub/sub channels (`ingestion:{job_id}:events` etc.) and hash keys to provide real-time status and resumable state to HTTP clients.

## Dependency flow and request lifecycle
1. **Client call** enters FastAPI at a router endpoint, which validates payloads against Pydantic models and obtains `CurrentUser` via JWT decoding.
2. **Business logic** in the router delegates to a repository to read/write MongoDB using the async client. For uploads or visualization requests, routers also orchestrate MinIO object placement and enqueue Celery tasks via the configured Celery app.
3. **Background worker** picks up tasks, uses synchronous MongoDB and Redis clients for durable progress tracking, and streams objects from MinIO as needed. Task status is published back to Redis for UI polling/streaming.
4. **Responses** are serialized through Pydantic schemas, ensuring consistent shapes across API consumers, while job progress can be consumed separately through Redis-backed channels.

## Configuration and deployment notes
- Defaults target localhost services, but `.env` overrides allow custom endpoints/credentials for MongoDB, Redis, MinIO, JWT, and CORS. Docker-compose tooling under `backend/scripts/` can launch dependent containers and the API/worker stack for local development.
- Celery autoscaling aims for 8 worker ceiling (minimum 4), adjusted to host CPU count, to balance throughput for large ingestion jobs without manual tuning. Windows uses a solo pool when prefork is unavailable.

## Extensibility guidelines
- Add new APIs by creating Pydantic models under `app/models/`, writing repository methods for MongoDB access, and wiring a new router module that applies `get_current_user` dependencies and any role checks.
- For new background workflows, register tasks in a module under `app/tasks/`, import that module in `app/core/celery_app.py`, and mirror the Redis pub/sub status pattern used by ingestion/visualization for real-time feedback.
- When integrating new storage buckets or services, extend `Settings` in `app/core/config.py` so deployments can configure endpoints without code changes.
