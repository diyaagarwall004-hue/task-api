// ================== SECTION 1: SETUP ==================
const API_URL = '/api';

// HTML elements ko pakadna (id se)
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const authMessage = document.getElementById('auth-message');
const userNameSpan = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');
const taskForm = document.getElementById('task-form');
const taskList = document.getElementById('task-list');
const adminLink = document.getElementById('admin-link');
const TASKS_PER_PAGE = 10;
let currentFilter = 'all';
let currentTaskPage = 1;

// ================== SECTION 2: HELPERS ==================
function showMessage(text, type) {
  authMessage.textContent = text;
  authMessage.className = 'message ' + type;
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  };
}

function getPermissions() {
  try {
    return JSON.parse(localStorage.getItem('userPermissions')) || [];
  } catch (e) {
    return [];
  }
}

function showDashboard() {
  authSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  userNameSpan.textContent = localStorage.getItem('userName');
  if (getPermissions().includes('users:read')) {
    adminLink.classList.remove('hidden');
  } else {
    adminLink.classList.add('hidden');
  }
  loadTasks();
}

function showAuth() {
  dashboardSection.classList.add('hidden');
  authSection.classList.remove('hidden');
  signupForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
}

// ================== SECTION 3: LOGIN <-> SIGNUP SWITCH ==================
document.getElementById('show-signup').addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.classList.add('hidden');
  signupForm.classList.remove('hidden');
  showMessage('', '');
});

document.getElementById('show-login').addEventListener('click', (e) => {
  e.preventDefault();
  signupForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
  showMessage('', '');
});

// ================== SECTION 4: SIGNUP ==================
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('signup-name').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;

  try {
    const res = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      showMessage(data.message, 'error');
      return;
    }

    signupForm.reset();
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    showMessage('Signup successful! Please login.', 'success');
  } catch (error) {
    showMessage('Cannot connect to server. Is the backend running?', 'error');
  }
});

// ================== SECTION 5: LOGIN ==================
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      showMessage(data.message, 'error');
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('userName', data.user.name);
    localStorage.setItem('userRole', data.user.role);
    localStorage.setItem('userId', data.user.id);
    localStorage.setItem('userPermissions', JSON.stringify(data.user.permissions || []));

    loginForm.reset();
    showMessage('', '');
    showDashboard();
  } catch (error) {
    showMessage('Cannot connect to server. Is the backend running?', 'error');
  }
});

// ================== SECTION 6: LOGOUT ==================
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('userName');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userId');
  localStorage.removeItem('userPermissions');
  showAuth();
}

logoutBtn.addEventListener('click', () => {
  logout();
  showMessage('Logged out successfully.', 'success');
});

// ================== SECTION 7: TASKS LOAD KARNA ==================
// The server does the filtering and pagination: GET /api/tasks?page=&limit=&status=
async function loadTasks(page = currentTaskPage) {
  const params = new URLSearchParams({ page, limit: TASKS_PER_PAGE });
  if (currentFilter !== 'all') params.set('status', currentFilter);

  try {
    const res = await fetch(`${API_URL}/tasks?${params}`, { headers: authHeaders() });
    if (handleSessionExpiry(res)) return;

    const data = await res.json();
    if (!res.ok) {
      taskList.innerHTML = '';
      showTaskError(data.message || 'Could not load tasks.');
      return;
    }

    // If the last task on a page was deleted, step back one page.
    if (data.tasks.length === 0 && page > 1) return loadTasks(page - 1);

    currentTaskPage = page;
    renderTasks(data.tasks);
    renderTaskPagination(data.pagination);
  } catch (error) {
    showTaskError('Could not load tasks.');
  }
}

function showTaskError(text) {
  taskList.innerHTML = '';
  const li = document.createElement('li');
  li.textContent = text;
  taskList.appendChild(li);
}

function renderTaskPagination({ page, totalPages }) {
  const box = document.getElementById('task-pagination');
  box.classList.toggle('hidden', totalPages <= 1);
  document.getElementById('task-page-info').textContent = `Page ${page} of ${totalPages}`;
  document.getElementById('task-prev-btn').disabled = page <= 1;
  document.getElementById('task-next-btn').disabled = page >= totalPages;
}

// Logs out on 401 (expired or invalid token). Returns true if it did.
function handleSessionExpiry(res) {
  if (res.status !== 401) return false;
  logout();
  showMessage('Session expired. Please login again.', 'error');
  return true;
}

// ================== SECTION 8: TASKS SCREEN PE DIKHANA ==================
function renderTasks(tasks) {
  taskList.innerHTML = '';

  if (tasks.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = currentFilter === 'all' ? 'No tasks yet. Add your first task above!' : `No ${currentFilter} tasks.`;
    taskList.appendChild(empty);
    return;
  }

  tasks.forEach((task) => {
    const li = document.createElement('li');
    if (task.status === 'completed') {
      li.classList.add('completed');
    }

    // Left side: title + description
    const info = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.title;
    info.appendChild(title);

    if (task.description) {
      const desc = document.createElement('span');
      desc.className = 'task-desc';
      desc.textContent = task.description;
      info.appendChild(desc);
    }

    if (task.dueDate) {
      const due = document.createElement('span');
      due.className = 'task-due';
      due.textContent = 'Due: ' + new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      if (task.status !== 'completed' && new Date(task.dueDate) < new Date()) {
        due.classList.add('overdue');
        due.textContent += ' (overdue)';
      }
      info.appendChild(due);
    }

    // Right side: buttons
    const actions = document.createElement('div');
    actions.className = 'task-actions';

    if (task.status !== 'completed') {
      const doneBtn = document.createElement('button');
      doneBtn.textContent = 'Done';
      doneBtn.className = 'btn-complete';
      doneBtn.addEventListener('click', () => completeTask(task.id));
      actions.appendChild(doneBtn);
    }

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.className = 'btn-edit';
    editBtn.addEventListener('click', () => editTask(task));
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'btn-delete';
    deleteBtn.addEventListener('click', () => deleteTask(task.id));
    actions.appendChild(deleteBtn);

    li.appendChild(info);
    li.appendChild(actions);
    taskList.appendChild(li);
  });
}

// ================== SECTION 9: NAYA TASK ADD KARNA ==================
taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('task-title').value;
  const description = document.getElementById('task-description').value;
  const dueValue = document.getElementById('task-due').value;
  const body = { title, description };
  // datetime-local gives the user's local time; send it as an exact moment (UTC).
  if (dueValue) body.dueDate = new Date(dueValue).toISOString();

  const res = await fetch(`${API_URL}/tasks`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body)
  });

  if (handleSessionExpiry(res)) return;
  if (res.ok) {
    taskForm.reset();
    loadTasks(1);
  } else {
    const data = await res.json().catch(() => ({}));
    alert(data.message || 'Could not add the task.');
  }
});

// ================== SECTION 10: COMPLETE, DELETE, EDIT ==================
// Sends a change to the server, shows the error if it fails, then reloads the list.
async function sendTaskChange(url, options) {
  try {
    const res = await fetch(url, { headers: authHeaders(), ...options });
    if (handleSessionExpiry(res)) return;
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || 'Something went wrong.');
    }
  } catch (error) {
    alert('Cannot connect to server.');
  }
  loadTasks();
}

function completeTask(id) {
  return sendTaskChange(`${API_URL}/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'completed' })
  });
}

function deleteTask(id) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  return sendTaskChange(`${API_URL}/tasks/${id}`, { method: 'DELETE' });
}

function editTask(task) {
  const newTitle = prompt('Edit task title:', task.title);
  if (newTitle === null || newTitle.trim() === '') return;
  return sendTaskChange(`${API_URL}/tasks/${task.id}`, {
    method: 'PUT',
    body: JSON.stringify({ title: newTitle.trim() })
  });
}

// ================== SECTION 12: FILTER TABS AND PAGES ==================
document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    loadTasks(1);
  });
});

document.getElementById('task-prev-btn').addEventListener('click', () => loadTasks(currentTaskPage - 1));
document.getElementById('task-next-btn').addEventListener('click', () => loadTasks(currentTaskPage + 1));

// ================== SECTION 11: PAGE KHULTE HI CHECK ==================
if (localStorage.getItem('token')) {
  showDashboard();
} else {
  showAuth();
}