"""Entry point for the flight data upload demonstration app.

This file replicates the structure of the existing FastAPI app and
registers the new flight data router. It is provided here for
illustration; in the real repository you would update `app/main.py`
directly.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import flight_data

app = FastAPI(title="flightdv backend with flight data upload")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"ok": True}


# Include the flight data router under /api/flightdata
app.include_router(flight_data.router)