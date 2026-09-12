FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
COPY tests ./tests
RUN npm run build

FROM node:24.19.0-bookworm-slim AS runtime
ENV NODE_ENV=production PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npx playwright install --with-deps chromium && chmod -R a+rX /ms-playwright
COPY --from=build /app/dist/src ./dist/src
RUN mkdir /reports && chown node:node /reports
USER node
WORKDIR /reports
ENTRYPOINT ["node", "/app/dist/src/cli.js"]
CMD ["--help"]

FROM runtime AS test
COPY --from=build /app/dist/tests /app/dist/tests
ENTRYPOINT ["node", "--test", "--test-concurrency=1", "/app/dist/tests/integration.test.js"]

FROM runtime AS final
