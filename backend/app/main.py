"""
Main application entrypoint with flight data and plot routes.

This version of main.py preserves existing routes (auth, users,
projects, documents) and adds the flight data and flight plots
routers. It should be used to replace ``backend/app/main.py`` in the
``datainjection`` branch.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import auth, users, projects, documents, flight_data, flight_plot


app = FastAPI(title="flightdv backend")

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


# Register core routes
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(documents.router)
app.include_router(flight_data.router)
app.include_router(flight_plot.router)