"""
Main application entrypoint.

This file integrates all existing routers (auth, users, projects, documents)
and the new flight data router for uploading large flight data files. It
preserves the existing functionality of your application while adding
endpoints under `/api/flightdata` for data upload, confirmation, listing,
downloading, deletion and sharing.

To apply this overlay, copy this file over your existing
`backend/app/main.py` in the `datainjection` branch of the repository.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import auth, users, projects, documents, flight_data

app = FastAPI(title="flightdv backend")

# Configure CORS to allow requests from the frontend. The allowed origins
# are defined in the `.env` file via the CORS_ORIGINS environment variable.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    """Simple health check endpoint."""
    return {"ok": True}


# Register existing routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(documents.router)

# Register the flight data router under /api/flightdata. This router provides
# CRUD endpoints for uploading large data files to MinIO, storing their
# metadata in MongoDB and managing per-user access.
app.include_router(flight_data.router)