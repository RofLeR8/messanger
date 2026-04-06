FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install --no-cache-dir poetry==2.0.0

# Copy dependency files first for better caching
COPY pyproject.toml poetry.lock ./

# Configure Poetry and install dependencies (including dev for alembic)
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --no-root

# Copy application code
COPY src/ ./src/
COPY frontend/ ./frontend/

# Copy and make entrypoint executable
COPY src/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port
EXPOSE 8000

# Run the entrypoint script
ENTRYPOINT ["/entrypoint.sh"]
