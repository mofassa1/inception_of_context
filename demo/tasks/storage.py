"""Keeps the tasks in memory. Swap it for a database without touching the service."""

from .models import Task


class TaskStore:
    def __init__(self):
        self.tasks = {}
        self.next_id = 1

    def add(self, title, priority):
        task = Task(id=self.next_id, title=title, priority=priority)
        self.tasks[task.id] = task
        self.next_id += 1
        return task

    def get(self, task_id):
        return self.tasks.get(task_id)

    def all(self):
        return sorted(self.tasks.values(), key=lambda task: task.id)

    def delete(self, task_id):
        return self.tasks.pop(task_id, None) is not None
