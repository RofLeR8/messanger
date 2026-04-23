from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from app.users.router import router as user_router
from app.chat.router import router as chat_router
from app.users.users_router import router as users_router
from app.uploads.router import router as uploads_router
from app.notifications.router import router as notifications_router
from app.websocket.manager import manager
from app.config import settings, is_rate_limit_enabled
from collections import defaultdict, deque
import time
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


class EarlySecurityMiddleware(BaseHTTPMiddleware):
    """Early rejection for scanner traffic + basic in-memory rate limiting."""

    _allowed_prefixes = (
        "/auth",
        "/users",
        "/chats",
        "/uploads",
        "/notifications",
        "/static",
        "/js",
        "/docs",
        "/redoc",
    )
    _allowed_exact = {"/", "/openapi.json", "/favicon.ico"}
    _blocked_scanner_paths = {
        "/wp-admin",
        "/wp-login.php",
        "/xmlrpc.php",
        "/phpmyadmin",
        "/.env",
        "/.git/config",
        "/server-status",
    }
    _blocked_suffixes = (".php", ".asp", ".aspx", ".jsp", ".cgi", ".env", ".sql")

    def __init__(self, app):
        super().__init__(app)
        self.requests_by_ip = defaultdict(deque)
        self.window_seconds = 60
        self.max_requests = max(
            int(settings.RATE_LIMIT_REQUESTS_PER_MINUTE) + int(settings.RATE_LIMIT_BURST),
            1,
        )

    @staticmethod
    def _get_client_ip(request: Request) -> str:
        # In VPS/proxy setups, preserve real client IP.
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            first = forwarded_for.split(",")[0].strip()
            if first:
                return first
        if request.client and request.client.host:
            return request.client.host
        return "unknown"

    def _is_allowed_path(self, path: str) -> bool:
        if path in self._allowed_exact:
            return True
        return any(path.startswith(prefix) for prefix in self._allowed_prefixes)

    async def dispatch(self, request: Request, call_next):
        if request.scope.get("type") != "http":
            return await call_next(request)

        path = request.url.path
        lower_path = path.lower()
        if lower_path in self._blocked_scanner_paths or lower_path.endswith(self._blocked_suffixes):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})

        if not self._is_allowed_path(path):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})

        if is_rate_limit_enabled():
            client_ip = self._get_client_ip(request)
            now = time.time()
            timestamps = self.requests_by_ip[client_ip]
            while timestamps and now - timestamps[0] > self.window_seconds:
                timestamps.popleft()
            if len(timestamps) >= self.max_requests:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please try again later."},
                )
            timestamps.append(now)

        return await call_next(request)


app = FastAPI(lifespan=lifespan)
app.add_middleware(EarlySecurityMiddleware)

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

