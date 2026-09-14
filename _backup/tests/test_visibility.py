import pytest

from p1.core.errors import PathNotFound, PathNotVisible
from p2.filesystem import FileSystemService


def test_a_folder_outside_the_mounted_directories_says_so(tmp_path):
    """Inside the container such a folder does not exist at all."""
    service = FileSystemService(set(), visible_roots=["/mounted/home"])

    with pytest.raises(PathNotVisible) as raised:
        service.list_directory(str(tmp_path / "project-the-container-cannot-see"))

    assert "outside the folders the API container can see" in raised.value.message
    assert "/mounted/home" in raised.value.message


def test_a_missing_folder_inside_a_mounted_directory_is_simply_not_found(tmp_path):
    service = FileSystemService(set(), visible_roots=[str(tmp_path)])

    with pytest.raises(PathNotFound):
        service.list_directory(str(tmp_path / "gone"))


def test_on_the_host_every_folder_is_visible(tmp_path):
    service = FileSystemService(set(), visible_roots=[])

    listed, _entries = service.list_directory(str(tmp_path))

    assert listed == tmp_path.resolve()
