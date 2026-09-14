import pytest

from notes.service import NoteNotFound, NoteService
from notes.storage import NoteStorage


@pytest.fixture
def service(tmp_path):
    return NoteService(NoteStorage(str(tmp_path / "notes.json")))


def test_create_assigns_incrementing_ids(service):
    first = service.create("first", "one")
    second = service.create("second", "two")

    assert first["id"] == 1
    assert second["id"] == 2


def test_create_rejects_a_blank_title(service):
    with pytest.raises(ValueError):
        service.create("   ", "body")


def test_list_returns_every_note(service):
    service.create("a", "")
    service.create("b", "")

    assert len(service.list_notes()) == 2


def test_get_returns_the_matching_note(service):
    created = service.create("findme", "body")

    assert service.get(created["id"])["title"] == "findme"


def test_get_raises_for_an_unknown_id(service):
    with pytest.raises(NoteNotFound):
        service.get(99)


def test_search_matches_title_and_body(service):
    service.create("groceries", "milk and eggs")
    service.create("todo", "call the bank")

    assert len(service.search("milk")) == 1
    assert len(service.search("BANK")) == 1


def test_delete_removes_the_note(service):
    created = service.create("temporary", "")
    service.delete(created["id"])

    assert service.list_notes() == []


def test_delete_raises_for_an_unknown_id(service):
    with pytest.raises(NoteNotFound):
        service.delete(42)
