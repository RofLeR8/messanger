from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.users.router import router as user_router
from app.chat.router import router as chat_router
from app.users.users_router import router as users_router
from app.uploads.router import router as uploads_router
from app.notifications.router import router as notifications_router
from app.websocket.manager import manager
import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown - disconnect all WebSocket connections
    manager.active_connections.clear()
    manager.notification_connections.clear()
    manager.chat_users.clear()
    manager.user_chats.clear()
    manager.online_users.clear()

app = FastAPI(lifespan=lifespan)

# Serve frontend static files
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
app.mount('/static', StaticFiles(directory=os.path.join(frontend_dir, 'static')), name='static')
app.mount('/js', StaticFiles(directory=os.path.join(frontend_dir, 'js')), name='js')

# Mount uploads directory for serving files (MUST be before API routes)
# Uses /uploads/files/ to avoid conflict with /uploads/file POST endpoint
uploads_dir = os.path.join(os.path.dirname(__file__), "uploads", "uploads")
app.mount('/uploads/files', StaticFiles(directory=uploads_dir, html=True), name='uploads-files')

@app.get("/")
async def root():
    return FileResponse(os.path.join(frontend_dir, "index.html"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173", "http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router)
app.include_router(users_router)
app.include_router(chat_router)
app.include_router(uploads_router)
app.include_router(notifications_router)

