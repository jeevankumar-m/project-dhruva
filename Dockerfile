FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY . /app

RUN python3 -m pip install --no-cache-dir \
    fastapi \
    uvicorn \
    numpy \
    pydantic

EXPOSE 8000

CMD ["python3", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
