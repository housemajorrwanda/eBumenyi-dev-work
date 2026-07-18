FROM ollama/ollama:0.6.8

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY start.sh /start.sh
RUN chmod +x /start.sh

ENV OLLAMA_HOST=0.0.0.0:11434
ENV OLLAMA_MODEL=llama3.2
ENV OLLAMA_CONTEXT_LENGTH=4096
ENV OLLAMA_FLASH_ATTENTION=0
ENV OLLAMA_VULKAN=0
ENV OLLAMA_MAX_LOADED_MODELS=1
ENV OLLAMA_NUM_PARALLEL=1
ENV OLLAMA_KEEP_ALIVE=-1

EXPOSE 11434


ENTRYPOINT []
CMD ["/start.sh"]
