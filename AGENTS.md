回答は必ず日本語で行ってください。

# Repository Guidelines

## Project Structure & Module Organization
The Flask backend inside `server/` hosts `app.py`, data helpers, and Docker/requirements files; it pulls chat profiles via the management API (D1) and persists embeddings in `qdrant_storage/`. The iframe-friendly frontend sits in `front/` (`index.html` for the chat shell, `widget.js` for the embeddable loader, `upload.html` for knowledge uploads). `iframe-embed.html` and `sample.html` provide local playgrounds for verifying widget behavior before promoting to production.

## Build, Test, and Development Commands
- `docker compose up --build`: rebuilds both `web` (Flask) and `frontend` images and starts the vectordb container; use `-d` for detached mode.  
- `docker compose logs -f web` / `frontend`: tails service-specific logs to observe Gemini calls or widget network chatter.  
- `docker compose restart web`: hot-reloads server code after Python changes; pair with `frontend` when editing `front/`.  
- `docker compose down -v`: stops the stack and purges volumes when you need a clean Chroma index.  
Use `curl http://localhost:8000/health` or open `iframe-embed.html` in a browser to confirm a healthy environment.

## Coding Style & Naming Conventions
Python modules use 4-space indentation, snake_case function names, and descriptive module-level constants (`UPLOAD_FOLDER`, `SESSION_TOKEN_TTL`); match `server/app.py` patterns and import ordering. Prefer dataclass-like dictionaries for tenant payloads and wrap risky external calls (`genai`, Qdrant, pdf parsers) with clear logging. Frontend scripts are plain ES5; keep everything inside the existing IIFE, camelCase DOM helpers, and guard globals via the `window.__IFRAME_WIDGET_LOADED__` flag. Update Dockerfiles when adding new dependencies.

## Testing Guidelines
There is no automated suite yet; when adding features, place pytest cases under `server/tests/test_<feature>.py` and cover both success and fallback flows (e.g., Gemini timeouts, tenant lookup misses). For the widget, rely on manual smoke tests: run `docker-compose up`, open `iframe-embed.html`, and verify token issuance plus iframe toggling through the browser console. Document new manual steps in `README.md` until they can be scripted.

## Commit & Pull Request Guidelines
Recent history mixes Conventional Commits (`feat:`, `docs:`) with concise Japanese summaries; keep the `<type>: <imperative>` style, add a short scope when helpful, and mention tenant IDs or APIs touched (e.g., `fix(server): guard /public/init host parsing`). PRs should describe the change, list test evidence (`curl`, screenshots of the widget), and link to any tenant/customer ticket. Include rollout notes or config migrations (new env vars, schema updates) so operators can stage safely.

## Security & Configuration Tips
Never commit actual Gemini keys or tenant secrets; use `.env.example` for defaults and ensure `WIDGET_JWT_SECRET` is rotated per environment. Restrictions such as allowed domains reside in D1 via the management API; validate domain ownership before adding entries and keep sample tenants clearly flagged.
