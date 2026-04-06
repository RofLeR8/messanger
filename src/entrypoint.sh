#!/bin/bash
set -e

# Run alembic migrations
echo "Running database migrations..."
cd /app/src
alembic upgrade head

# Start the application
echo "Starting application..."
cd /app
exec uvicorn src.app.main:app --host 0.0.0.0 --port 8000
