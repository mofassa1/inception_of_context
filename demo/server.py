"""The backend: a JSON API under /api, and the web/ folder as static files.

    python server.py      then open http://127.0.0.1:5050
"""

import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from tasks.service import TaskService

PORT = 5050
WEB_FOLDER = Path(__file__).parent / "web"
service = TaskService()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_FOLDER), **kwargs)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(length) or b"{}")

    def task_id(self):
        return int(urlparse(self.path).path.rsplit("/", 1)[1])

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/api/tasks":
            query = parse_qs(url.query).get("q", [""])[0]
            return self.send_json(200, [task.to_dict() for task in service.list_tasks(query)])
        if url.path == "/api/stats":
            return self.send_json(200, service.stats())
        return super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != "/api/tasks":
            return self.send_json(404, {"error": "not found"})
        body = self.read_json()
        try:
            task = service.create(body.get("title"), body.get("priority", "normal"))
        except ValueError as error:
            return self.send_json(400, {"error": str(error)})
        return self.send_json(201, task.to_dict())

    def do_PATCH(self):
        try:
            return self.send_json(200, service.toggle(self.task_id()).to_dict())
        except (KeyError, ValueError):
            return self.send_json(404, {"error": "no such task"})

    def do_DELETE(self):
        try:
            service.remove(self.task_id())
        except (KeyError, ValueError):
            return self.send_json(404, {"error": "no such task"})
        return self.send_json(200, {"ok": True})


if __name__ == "__main__":
    print(f"Taskboard on http://127.0.0.1:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
