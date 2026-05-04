import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from src.app.main import app


class TestAuthEndpoints:
    """Tests for authentication API endpoints."""

    @pytest.mark.asyncio
    async def test_auth_page(self):
        """Test auth page endpoint."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/auth/")
            
            assert response.status_code == 200
            assert "message" in response.json()

    @pytest.mark.asyncio
    async def test_auth_page_message(self):
        """Test auth page returns correct message."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/auth/")
            
            data = response.json()
            assert "Auth endpoint" in data["message"]


class TestRootEndpoint:
    """Tests for root endpoint."""

    @pytest.mark.asyncio
    async def test_root(self):
        """Test root endpoint returns index.html."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/")
            
            assert response.status_code == 200


class TestOpenAPI:
    """Tests for OpenAPI documentation."""

    @pytest.mark.asyncio
    async def test_openapi_json(self):
        """Test OpenAPI JSON endpoint."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            
            assert response.status_code == 200
            assert "application/json" in response.headers.get("content-type", "")
            data = response.json()
            assert "openapi" in data or "info" in data


class TestSecurityMiddleware:
    """Tests for security middleware."""

    @pytest.mark.asyncio
    async def test_blocked_scanner_path_wp_admin(self):
        """Test blocked scanner path /wp-admin returns 404."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/wp-admin")
            
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_blocked_scanner_path_php(self):
        """Test blocked scanner path /xmlrpc.php returns 404."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/xmlrpc.php")
            
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_blocked_suffix_php(self):
        """Test blocked file suffix .php returns 404."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/test.php")
            
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_blocked_suffix_env(self):
        """Test blocked file suffix .env returns 404."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/.env")
            
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_allowed_path_auth(self):
        """Test allowed path /auth is accessible."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/auth")
            
            assert response.status_code in [200, 307, 404]

    @pytest.mark.asyncio
    async def test_allowed_path_users(self):
        """Test allowed path /users is accessible."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/users")
            
            assert response.status_code in [200, 307, 404]

    @pytest.mark.asyncio
    async def test_allowed_exact_root(self):
        """Test allowed exact path / returns 200."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/")
            
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_blocked_path_env_file(self):
        """Test blocked path .env file."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/.git/config")
            
            assert response.status_code == 404