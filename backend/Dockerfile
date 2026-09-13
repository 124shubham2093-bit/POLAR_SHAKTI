FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# frontend build is copied in by CI or docker-compose build context if present
COPY --if-exists ../frontend/dist ./static
ENV POLAR_EMS_DATA=/app/data

EXPOSE 8321
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8321"]
