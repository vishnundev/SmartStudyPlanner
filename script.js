// Smart Study Planner - script.js
// Data model: tasks array stored in localStorage under 'ssp_tasks'
let tasks = [];
let selectedTaskId = null;
const LS_KEY = "ssp_tasks_v1";
const NOTES_KEY = "ssp_notes_v1";

// DOM refs
const titleEl = document.getElementById("title");
const descEl = document.getElementById("desc");
const dateEl = document.getElementById("date");
const priorityEl = document.getElementById("priority");
const tagEl = document.getElementById("tag");
const addBtn = document.getElementById("addBtn");
const clearBtn = document.getElementById("clearBtn");
const tasksList = document.getElementById("tasksList");
const filterTag = document.getElementById("filterTag");
const filterStatus = document.getElementById("filterStatus");
const searchInput = document.getElementById("search");
const completedCount = document.getElementById("completedCount");
const pendingCount = document.getElementById("pendingCount");
const totalCount = document.getElementById("totalCount");
const progressCtx = document.getElementById("progressChart").getContext("2d");
const themeToggle = document.getElementById("themeToggle");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const quickNotes = document.getElementById("quickNotes");
const saveNotesBtn = document.getElementById("saveNotes");

// Pomodoro
let pomInterval = null;
let pomRemaining = 25 * 60;
let pomState = "stopped"; // running, paused, stopped
const timerEl = document.getElementById("timer");
const startPom = document.getElementById("startPom");
const pausePom = document.getElementById("pausePom");
const resetPomBtn = document.getElementById("resetPom"); // CORRECTED VARIABLE NAME
const workMin = document.getElementById("workMin");
const breakMin = document.getElementById("breakMin");
const pomodoroTask = document.getElementById("pomodoroTask");
let onBreak = false;

// Chart.js
let progressChart = null;

// Utilities
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function saveTasks() { localStorage.setItem(LS_KEY, JSON.stringify(tasks)); render(); }
function loadTasks() { const raw = localStorage.getItem(LS_KEY); tasks = raw ? JSON.parse(raw) : []; }
function saveNotes() { localStorage.setItem(NOTES_KEY, quickNotes.value); alert("Notes saved locally."); }
function loadNotes() { quickNotes.value = localStorage.getItem(NOTES_KEY) || ""; }

// Theme
function loadTheme() { if (localStorage.getItem("ssp_theme") === "dark") { document.body.classList.add("dark"); themeToggle.textContent = "☀️"; } }
function toggleTheme() { document.body.classList.toggle("dark"); themeToggle.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙"; localStorage.setItem("ssp_theme", document.body.classList.contains("dark") ? "dark" : "light"); }

// Render tasks
function render() {
    tasksList.innerHTML = "";
    // Filters
    const tagFilter = filterTag.value;
    const statusFilter = filterStatus.value;
    const q = searchInput.value.trim().toLowerCase();

    const filtered = tasks.filter(t => {
        if (tagFilter && t.tag !== tagFilter) return false;
        if (statusFilter === "done" && !t.done) return false;
        if (statusFilter === "pending" && t.done) return false;
        if (q && !(t.title.toLowerCase().includes(q) || (t.desc || '').toLowerCase().includes(q))) return false;
        return true;
    }).sort((a, b) => {
        // prioritize by date then priority
        if (a.date && b.date) return new Date(a.date) - new Date(b.date);
        if (a.date) return -1;
        if (b.date) return 1;
        return 0;
    });

    filtered.forEach(t => {
        const div = document.createElement("div");
        div.className = "task" + (t.done ? " done" : "");
        div.innerHTML = `
      <div class="meta">
        <h3>${t.title}</h3>
        <p>${t.desc || ""}</p>
        <div class="tags">
          <span class="tag">${t.priority}</span>
          ${t.date ? `<span class="tag">${t.date}</span>` : ""}
          ${t.tag ? `<span class="tag">${t.tag}</span>` : ""}
        </div>
      </div>
      <div class="actions">
        <button class="action-btn" onclick="toggleDone('${t.id}')" title="Mark as ${t.done ? 'Pending' : 'Done'}">${t.done ? "↺" : "✓"}</button>
        <button class="action-btn" onclick="selectTask('${t.id}')" title="Select for Pomodoro">🎯</button>
        <button class="action-btn" onclick="editTask('${t.id}')" title="Edit">✎</button>
        <button class="action-btn" onclick="deleteTask('${t.id}')" title="Delete">🗑</button>
      </div>
    `;
        tasksList.appendChild(div);
    });

    updateFilters();
    updateStats();
    drawChart();
}

function updateFilters() {
    const tags = Array.from(new Set(tasks.map(t => t.tag).filter(Boolean)));
    const currentVal = filterTag.value; // Remember the current selection
    filterTag.innerHTML = `<option value="">All Tags</option>` + tags.map(tt => `<option value="${tt}">${tt}</option>`).join("");
    filterTag.value = currentVal; // Restore the selection
}

function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.done).length;
    const pending = total - completed;
    completedCount.textContent = completed;
    pendingCount.textContent = pending;
    totalCount.textContent = total;
}

function drawChart() {
    const completed = tasks.filter(t => t.done).length;
    const pending = tasks.length - completed;
    const data = [completed, pending];
    if (!progressChart) {
        progressChart = new Chart(progressCtx, {
            type: 'doughnut',
            data: { labels: ['Completed', 'Pending'], datasets: [{ data, backgroundColor: ['#00b894', '#6c5ce7'], borderWidth: 0 }] },
            options: { cutout: '65%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } }
        });
    } else {
        progressChart.data.datasets[0].data = data;
        progressChart.update();
    }
}

// Task operations
function addTask() {
    const title = titleEl.value.trim();
    if (!title) { alert("Please add a title for the task."); return; }
    const t = { id: uid(), title, desc: descEl.value.trim(), date: dateEl.value || null, priority: priorityEl.value, tag: tagEl.value.trim() || null, done: false, created: new Date().toISOString() };
    tasks.push(t);
    saveTasks();
    titleEl.value = ""; descEl.value = ""; dateEl.value = ""; tagEl.value = "";
    titleEl.focus(); // Auto-focus on title input
}

function toggleDone(id) {
    const t = tasks.find(x => x.id === id); if (!t) return;
    t.done = !t.done;
    saveTasks();
}

function editTask(id) {
    const t = tasks.find(x => x.id === id); if (!t) return;
    const newTitle = prompt("Edit title", t.title);
    if (newTitle === null) return;
    t.title = newTitle.trim() || t.title;
    const newDesc = prompt("Edit description", t.desc);
    if (newDesc === null) return;
    t.desc = newDesc.trim();
    saveTasks();
}

function deleteTask(id) {
    if (!confirm("Are you sure you want to delete this task?")) return;
    tasks = tasks.filter(x => x.id !== id);
    if (selectedTaskId === id) { selectedTaskId = null; pomodoroTask.textContent = "No task selected"; }
    saveTasks();
}

function selectTask(id) {
    selectedTaskId = id;
    const t = tasks.find(x => x.id === id);
    if (t) pomodoroTask.textContent = `Focusing on: ${t.title}`;
}

// Event Listeners
clearBtn.addEventListener("click", () => { titleEl.value = ""; descEl.value = ""; dateEl.value = ""; tagEl.value = ""; });
addBtn.addEventListener("click", addTask);
searchInput.addEventListener("input", render);
filterTag.addEventListener("change", render);
filterStatus.addEventListener("change", render);

// Export / Import
exportBtn.addEventListener("click", () => {
    if(tasks.length === 0) { alert("No tasks to export."); return; }
    const data = { exportedAt: new Date().toISOString(), tasks };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ssp_tasks_export.json"; a.click();
    URL.revokeObjectURL(url);
});

importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", (e) => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const obj = JSON.parse(ev.target.result);
            if (Array.isArray(obj.tasks)) {
                if (confirm("This will replace all current tasks. Continue?")) {
                    tasks = obj.tasks;
                    saveTasks();
                    alert("Imported tasks successfully.");
                }
            } else { alert("Invalid file format."); }
        } catch (err) { alert("Failed to import: " + err.message); }
        importFile.value = '';
    };
    reader.readAsText(f);
});

// Notes & Theme
saveNotesBtn.addEventListener("click", saveNotes);
themeToggle.addEventListener("click", toggleTheme);

// Pomodoro implementation
function formatTime(sec) { const m = Math.floor(sec / 60).toString().padStart(2, '0'); const s = (sec % 60).toString().padStart(2, '0'); return `${m}:${s}`; }

function pomodoroCycle() {
    clearInterval(pomInterval);
    if (!onBreak) {
        if (selectedTaskId) {
            const t = tasks.find(x => x.id === selectedTaskId);
            if (t && !t.done) {
                 t.done = true;
                 saveTasks(); // BUG FIX: Save task immediately
            }
        }
        alert("Work session complete! Time for a break.");
        onBreak = true;
        pomRemaining = (parseInt(breakMin.value) || 5) * 60;
        document.title = "Break Time!";
    } else {
        alert("Break finished. Time to get back to work!");
        onBreak = false;
        pomState = "stopped";
        resetPom(); // Reset to default state
        return;
    }
    pomInterval = setInterval(() => {
        pomRemaining--;
        timerEl.textContent = formatTime(pomRemaining);
        document.title = `${formatTime(pomRemaining)} - ${onBreak ? 'Break' : 'Focus'}`;
        if (pomRemaining <= 0) { pomodoroCycle(); }
    }, 1000);
}

startPom.addEventListener("click", () => {
    if (pomState === "running") return;
    if (pomState === "stopped") {
        if (!selectedTaskId && !confirm("No task selected. Start without linking to a task?")) return;
        pomRemaining = (parseInt(workMin.value) || 25) * 60;
        onBreak = false;
    }
    pomState = "running";
    pomInterval = setInterval(() => {
        pomRemaining--;
        timerEl.textContent = formatTime(pomRemaining);
        document.title = `${formatTime(pomRemaining)} - Focus`;
        if (pomRemaining <= 0) { pomodoroCycle(); }
    }, 1000);
});

pausePom.addEventListener("click", () => {
    if (pomState !== "running") return;
    clearInterval(pomInterval);
    pomState = "paused";
    document.title = "Timer Paused";
});

function resetPom() {
    clearInterval(pomInterval);
    pomState = "stopped";
    onBreak = false;
    pomRemaining = (parseInt(workMin.value) || 25) * 60;
    timerEl.textContent = formatTime(pomRemaining);
    document.title = "Smart Study Planner";
}
resetPomBtn.addEventListener("click", resetPom); // CORRECTED EVENT LISTENER

// Initial Load
function init() {
    loadTheme();
    loadTasks();
    loadNotes();
    render();
}
init();