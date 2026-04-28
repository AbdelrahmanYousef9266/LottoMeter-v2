# syntax=docker/dockerfile:1
FROM python:3.13-slim

# Prevent Python from writing .pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    FLASK_APP=run.py

# Install system deps for psycopg2 + bcrypt
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (better Docker layer caching)
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy app code
COPY . .

# Expose Flask/Gunicorn port
EXPOSE 5000

# Production entrypoint — Gunicorn runs the Flask app factory
CMD ["sh", "-c", "flask db upgrade && gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 --access-logfile - run:app"]