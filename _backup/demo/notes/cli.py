import argparse

from notes.service import NoteNotFound, NoteService
from notes.storage import NoteStorage

DEFAULT_STORE = "notes.json"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="notes", description="A tiny notes app.")
    parser.add_argument("--store", default=DEFAULT_STORE, help="path to the notes file")

    commands = parser.add_subparsers(dest="command", required=True)

    add = commands.add_parser("add", help="add a note")
    add.add_argument("title")
    add.add_argument("body", nargs="?", default="")

    commands.add_parser("list", help="list every note")

    search = commands.add_parser("search", help="search notes")
    search.add_argument("term")

    delete = commands.add_parser("delete", help="delete a note")
    delete.add_argument("note_id", type=int)

    return parser


def format_note(note: dict) -> str:
    return f"[{note['id']}] {note['title']} — {note['created']}"


def run(arguments: argparse.Namespace) -> int:
    service = NoteService(NoteStorage(arguments.store))

    if arguments.command == "add":
        note = service.create(arguments.title, arguments.body)
        print(format_note(note))
        return 0

    if arguments.command == "list":
        for note in service.list_notes():
            print(format_note(note))
        return 0

    if arguments.command == "search":
        for note in service.search(arguments.term):
            print(format_note(note))
        return 0

    try:
        service.delete(arguments.note_id)
    except NoteNotFound as error:
        print(error)
        return 1

    print(f"deleted {arguments.note_id}")
    return 0


def main(argv: list[str] | None = None) -> int:
    return run(build_parser().parse_args(argv))
