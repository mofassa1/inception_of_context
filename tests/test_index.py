import os

from p1.chunker import chunk_file
from p1.store import Store

DEMO = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "demo")

FRONTEND = """// The frontend: talks to the API.

const list = document.querySelector("#tasks");
const search = document.querySelector("#search");

async function api(method, path) {
  const response = await fetch(path, { method });
  return response.json();
}

function renderTask(task) {
  const item = document.createElement("li");
  item.querySelector("input").onchange = () => api("PATCH", `/api/tasks/${task.id}`);
  return item;
}

async function refresh() {
  list.replaceChildren(...(await api("GET", "/api/tasks")).map(renderTask));
}

form.onsubmit = async (event) => {
  event.preventDefault();
  refresh();
};

search.oninput = refresh;
refresh();
"""


def uncovered_lines(source, chunks):
    covered = set()
    for chunk in chunks:
        covered.update(range(chunk.start_line, chunk.end_line + 1))
    return [
        number
        for number, line in enumerate(source.splitlines(), 1)
        if line.strip() and number not in covered
    ]


def test_every_line_of_a_js_file_is_in_a_chunk():
    chunks = chunk_file("web/app.js", FRONTEND)

    assert uncovered_lines(FRONTEND, chunks) == []
    assert [chunk.qualified_name for chunk in chunks] == [
        "__module__",
        "api",
        "renderTask",
        "refresh",
        "form.onsubmit",
    ]


def test_a_chunk_starts_on_its_function_line():
    lines = FRONTEND.splitlines()
    for chunk in chunk_file("web/app.js", FRONTEND)[1:]:
        assert chunk.qualified_name.split(".")[-1] in lines[chunk.start_line - 1]


def test_a_nested_arrow_function_does_not_split_its_parent():
    render = next(chunk for chunk in chunk_file("web/app.js", FRONTEND) if chunk.qualified_name == "renderTask")

    assert "onchange = () =>" in render.content
    assert "return item;" in render.content


def test_a_file_without_function_is_cut_by_length():
    source = "".join(f"line {number}\n" for number in range(1, 46))
    chunks = chunk_file("notes.txt", source)

    assert [(chunk.start_line, chunk.end_line) for chunk in chunks] == [(1, 40), (41, 45)]
    assert uncovered_lines(source, chunks) == []


def test_every_line_of_the_demo_is_indexed():
    for folder, folders, files in os.walk(DEMO):
        folders[:] = [name for name in folders if name != "__pycache__"]
        for name in files:
            path = os.path.join(folder, name)
            with open(path, encoding="utf-8") as file:
                source = file.read()
            assert uncovered_lines(source, chunk_file(path, source)) == [], path


def test_the_chunks_of_a_file_come_back_in_the_order_of_the_file(tmp_path):
    # What the editor showed as "chunk #2, #3, #1": renderTask was stored by an older index,
    # the full one stored the others after it, and ChromaDB answered in storage order.
    store = Store(tmp_path / "chroma", tmp_path)
    chunks = chunk_file("web/app.js", FRONTEND)
    render = [chunk for chunk in chunks if chunk.qualified_name == "renderTask"]
    store.add_chunks(render, [[1.0, 0.0, 0.0]])
    store.add_chunks(chunks, [[1.0, 0.0, 0.0]] * len(chunks))

    names = [chunk["metadata"]["qualified_name"] for chunk in store.chunks_of_file("web/app.js")]
    assert names == ["__module__", "api", "renderTask", "refresh", "form.onsubmit"]
