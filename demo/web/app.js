// The frontend: talks to the JSON API of server.py and draws the board again after each change.

const list = document.querySelector("#tasks");
const form = document.querySelector("#new-task");
const search = document.querySelector("#search");
const stats = document.querySelector("#stats");

async function api(method, path, body) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}

function renderTask(task) {
  const item = document.createElement("li");
  item.className = `task ${task.priority}` + (task.done ? " done" : "");
  item.innerHTML = `<input type="checkbox" ${task.done ? "checked" : ""}><span></span><button aria-label="Delete">×</button>`;
  item.querySelector("span").textContent = task.title;
  item.querySelector("input").onchange = () => api("PATCH", `/api/tasks/${task.id}`).then(refresh);
  item.querySelector("button").onclick = () => api("DELETE", `/api/tasks/${task.id}`).then(refresh);
  return item;
}

async function refresh() {
  const query = encodeURIComponent(search.value);
  const [tasks, summary] = await Promise.all([
    api("GET", `/api/tasks?q=${query}`),
    api("GET", "/api/stats"),
  ]);
  list.replaceChildren(...tasks.map(renderTask));
  stats.textContent = `${summary.done}/${summary.total} done · ${summary.progress}%`;
}

form.onsubmit = async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  try {
    await api("POST", "/api/tasks", { title: data.get("title"), priority: data.get("priority") });
    form.reset();
  } catch (error) {
    alert(error.message);
  }
  refresh();
};

search.oninput = refresh;
refresh();
