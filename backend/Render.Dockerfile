FROM node:24-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM python:3.12-slim
RUN useradd --uid 10001 --create-home patchguard
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
WORKDIR /app
COPY backend/server.py backend/remote_jobs.py backend/manage_user.py backend/database.py backend/schema.sql ./
COPY --from=frontend /app/dist /app/site
ENV PATCHGUARD_HOST=0.0.0.0 PATCHGUARD_PORT=8787 PATCHGUARD_REQUIRE_POSTGRES=1 PATCHGUARD_COOKIE_SECURE=1
EXPOSE 8787
USER patchguard
CMD ["python", "server.py"]
