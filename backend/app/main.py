from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import auth
from app.routers import users 
from app.routers import projects
from app.routers import documents
from app.routers import records
from app.routers import student_engagement
from app.routers import ingestion
from app.routers import visualizations
from app.routers import notifications
from app.routers import meetings
from app.routers import budgets
from app.routers import mat
app = FastAPI(title="flightdv minimal backend")

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

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(documents.router)
app.include_router(records.router)
app.include_router(student_engagement.router)
app.include_router(ingestion.router)
app.include_router(visualizations.router)
app.include_router(notifications.router)
app.include_router(meetings.router)
app.include_router(budgets.router)
app.include_router(mat.router)
