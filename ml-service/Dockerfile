FROM python:3.11-slim

WORKDIR /service

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    libgomp1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY start-docker.sh ./start-docker.sh
RUN chmod +x ./start-docker.sh

ENV ML_DEVICE=cpu
ENV TTS_ENGINE=flex
ENV OCR_USE_GPU=false

EXPOSE 8100

CMD ["./start-docker.sh"]
