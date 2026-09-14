# notes

A small notes app used as the target project for Inception of Context.

```
python main.py add "buy milk" "semi-skimmed"
python main.py list
python main.py search milk
python main.py delete 1
```

Use it from Python:

```python
from notes.service import NoteService
from notes.storage import NoteStorage

def add_welcome_note(path: str) -> dict:
    return NoteService(NoteStorage(path)).create("welcome", "first note")
```

Tests: `python -m pytest -q`
