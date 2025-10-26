# app/main.py (relevant bits)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.mongo import connect_to_mongo, close_mongo_connection
from app.routers import auth, users, projects

app = FastAPI(title="FlightDV Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers: DON'T add another prefix here — routers already have it.
app.include_router(auth.router)     # auth.py should have prefix="/api/auth"
app.include_router(users.router)    # users.py has prefix="/api/users"
app.include_router(projects.router) # projects.py has prefix="/api/projects"

@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
