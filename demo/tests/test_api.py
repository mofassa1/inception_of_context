import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import server
from tasks.service import TaskService


class QuietHandler(server.Handler):
    def log_message(self, *args):
        pass


class ApiTest(unittest.TestCase):
    def setUp(self):
        server.service = TaskService()
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.httpd.server_port}"

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()

    def call(self, method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        request = Request(self.base + path, data=data, method=method)
        request.add_header("Content-Type", "application/json")
        try:
            with urlopen(request) as response:
                return response.status, json.loads(response.read())
        except HTTPError as error:
            return error.code, json.loads(error.read())

    def test_create_then_list(self):
        self.assertEqual(self.call("POST", "/api/tasks", {"title": "demo day"})[0], 201)
        status, tasks = self.call("GET", "/api/tasks")
        self.assertEqual((status, tasks[0]["title"]), (200, "demo day"))

    def test_a_bad_task_is_a_400(self):
        status, payload = self.call("POST", "/api/tasks", {"title": ""})
        self.assertEqual((status, payload["error"]), (400, "a task needs a title"))

    def test_stats_follow_the_board(self):
        self.call("POST", "/api/tasks", {"title": "one"})
        self.call("PATCH", "/api/tasks/1")
        self.assertEqual(self.call("GET", "/api/stats")[1]["progress"], 100)


if __name__ == "__main__":
    unittest.main()
