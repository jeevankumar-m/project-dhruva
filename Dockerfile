FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install Python and Node.js
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    curl \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY . /app

# Install Python dependencies
RUN python3 -m pip install --no-cache-dir \
    fastapi \
    "uvicorn[standard]" \
    numpy \
    pydantic \
    sgp4 \
    astropy

# Install Node.js dependencies and build Next.js frontend
WORKDIR /app/dhruva-frontend
RUN npm install && npm run build

WORKDIR /app

EXPOSE 8000
EXPOSE 3000

# Create startup script
RUN printf '#!/bin/bash\necho "FastAPI backend running at PORT : 8000 and NextJs frontend running at PORT : 3000"\npython3 -m uvicorn server:app --host 0.0.0.0 --port 8000 &\ncd /app/dhruva-frontend && npm start -- -p 3000 &\nwait\n' > /app/start.sh && chmod +x /app/start.sh

CMD ["/app/start.sh"]
