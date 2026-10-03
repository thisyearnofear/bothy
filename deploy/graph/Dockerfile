# TuringDB daemon + the loopback-only read bridge in one container.
# The bridge deliberately binds 127.0.0.1 (apps/agent/src/graph/sidecar.py), so
# socat republishes it on the private compose network only; nothing is
# published to the host.
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends socat \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir turingdb pandas
WORKDIR /app
COPY apps/agent/src/graph/sidecar.py apps/agent/src/graph/read-policy.json ./
COPY deploy/graph/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh
EXPOSE 6778
CMD ["./entrypoint.sh"]
