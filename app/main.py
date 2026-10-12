from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db.init_db import init_db
from app.routers import admin, auth, groups, lessons, students, subjects, teachers


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="O'quv Markazi CRM", lifespan=lifespan)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(students.router)
app.include_router(subjects.router)
app.include_router(groups.router)
app.include_router(lessons.router)
app.include_router(teachers.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "O'quv Markazi CRM backend"}
