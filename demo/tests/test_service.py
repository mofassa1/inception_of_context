import unittest

from tasks.service import TaskService


class TaskServiceTest(unittest.TestCase):
    def setUp(self):
        self.service = TaskService()

    def test_create_gives_increasing_ids(self):
        first = self.service.create("write the README")
        second = self.service.create("ship it", "high")
        self.assertEqual((first.id, second.id), (1, 2))
        self.assertEqual(second.priority, "high")

    def test_an_empty_title_is_refused(self):
        with self.assertRaises(ValueError):
            self.service.create("   ")

    def test_an_unknown_priority_is_refused(self):
        with self.assertRaises(ValueError):
            self.service.create("call the bank", "urgent")

    def test_list_tasks_searches_titles(self):
        self.service.create("Buy milk")
        self.service.create("Fix the login bug")
        self.assertEqual([task.title for task in self.service.list_tasks("BUG")], ["Fix the login bug"])

    def test_toggle_marks_done_then_open(self):
        task = self.service.create("water the plants")
        self.assertTrue(self.service.toggle(task.id).done)
        self.assertFalse(self.service.toggle(task.id).done)

    def test_remove_an_unknown_task_raises(self):
        with self.assertRaises(KeyError):
            self.service.remove(42)

    def test_stats_counts_progress(self):
        for title in ["a", "b", "c", "d"]:
            self.service.create(title)
        self.service.toggle(1)
        self.assertEqual(self.service.stats(), {"total": 4, "done": 1, "open": 3, "progress": 25})


if __name__ == "__main__":
    unittest.main()
