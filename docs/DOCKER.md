# Brain Docker deployment

This is a **single-container** deployment: Express serves the Vite-built React UI and API on port 5000. MongoDB remains external; Docker does not create, migrate or back up a database.

## Before starting

- Install Docker Engine with the Compose plugin.
- Copy `.env.example` to `.env` and set the required credentials and an existing `MONGODB_URI`. Never commit `.env`.
- For a local test, use a **non-production database** and distinct credentials.
- For a production domain, set `CLIENT_URL` and `CORS_ALLOWED_ORIGINS` to its HTTPS origin; set `CORS_STRICT_ORIGINS=true`. Configure `TRUST_PROXY=1` only after confirming a single trusted Nginx proxy.
- If the MongoDB server runs on the VPS itself, `localhost` inside Docker means the container, not the VPS. Use a reachable, secured database endpoint. Do not expose MongoDB publicly.

## Windows local test

From a checkout of the `docker/brain-container` branch, in PowerShell:

```powershell
docker compose config
docker compose up --build -d
docker compose ps
```

Visit http://localhost:8081 and check http://localhost:8081/api/health and http://localhost:8081/api/ready. The health endpoint only confirms HTTP liveness; readiness checks dependencies. Test authentication and basic data flows against a test database.

Stop the local test with `docker compose down`. Do not use `down -v` for production services.

## Beast rollout (manual; requires separate production approval)

1. Inspect current PM2, Nginx, occupied ports, running containers, MongoDB access, backups and rollback procedure. Keep the current app running.
2. Check out the reviewed Docker branch on Beast in a **separate directory**, not the live PM2 workspace. Supply secrets via an untracked `.env`.
3. Verify port 8081 is free; change the loopback-only host port if necessary.
4. Run `sudo docker compose config` and `sudo docker compose up --build -d` only after approval.
5. Inspect `sudo docker compose ps`, `sudo docker compose logs --tail=100 brain`, `curl -fsS http://127.0.0.1:8081/api/health`, and `curl -fsS http://127.0.0.1:8081/api/ready`. Check login and app workflows before switching traffic.
6. After separate Nginx change approval, point the Brain server block to `http://127.0.0.1:8081`, validate Nginx configuration, reload safely, and verify the public HTTPS site.
7. Stop the old Brain PM2 process **only after** the new site is verified. Keep a rollback path to the old upstream and process.

The app has a single-instance in-memory rate limiter by default; embedding jobs can be lost on restart when using the in-process queue. Review `docs/OPERATIONS.md` before production deployment. Docker does not automatically install or run Codex CLI for the separate manual AI workflows.
