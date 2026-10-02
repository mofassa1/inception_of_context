# Taskboard

A tiny full-stack to-do app, the target project of Inception of Context.
Only the Python standard library: nothing to install.

```bash
python server.py          # http://127.0.0.1:5050
python check.py           # every test, the same command the patch loop runs
```

| Layer | Files |
|---|---|
| frontend | `web/index.html`, `web/app.js`, `web/style.css` |
| API | `server.py`: `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/<id>`, `GET /api/stats` |
| rules | `tasks/service.py`: `TaskService` validates, searches, toggles and counts |
| storage | `tasks/storage.py`: `TaskStore`, in memory |
| tests | `tests/test_service.py`, `tests/test_api.py` |
