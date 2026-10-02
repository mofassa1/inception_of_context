"""The rules of the board: what a valid task is, and what you can ask about the tasks."""

from .models import PRIORITIES
from .storage import TaskStore


class TaskService:
    def __init__(self, store=None):
        self.store = store or TaskStore()

    def create(self, title, priority="normal"):
        title = (title or "").strip()
        if not title:
            raise ValueError("a task needs a title")
        if priority not in PRIORITIES:
            raise ValueError(f"priority must be one of {', '.join(PRIORITIES)}")
        return self.store.add(title, priority)

    def list_tasks(self, query=""):
        term = query.strip().lower()
        return [task for task in self.store.all() if term in task.title.lower()]

    def toggle(self, task_id):
        task = self.store.get(task_id)
        if task is None:
            raise KeyError(task_id)
        task.done = not task.done
        return task

    def remove(self, task_id):
        if not self.store.delete(task_id):
            raise KeyError(task_id)

    def stats(self):
        tasks = self.store.all()
        done = sum(1 for task in tasks if task.done)
        progress = round(100 * done / len(tasks)) if tasks else 0
        return {"total": len(tasks), "done": done, "open": len(tasks) - done, "progress": progress}
