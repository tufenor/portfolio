FROM node:20-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production \
    MONEYIA_APP_HOST=0.0.0.0 \
    MONEYIA_APP_PORT=8899 \
    MONEYIA_CDP_PORT=9333

COPY app ./app
COPY dashboard ./dashboard
COPY data ./data
COPY tools ./tools

RUN useradd --create-home --uid 10001 moneyia \
    && chown -R moneyia:moneyia /app
USER moneyia

EXPOSE 8899
CMD ["node", "app/server.mjs"]
