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
let allTasks = [];
let currentFilter = 'all';

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

function showDashboard() {
  authSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  userNameSpan.textContent = localStorage.getItem('userName');
  if (localStorage.getItem('userRole') === 'admin') {
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
    localStorage.setItem('userRole',data.user.role);

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
  showAuth();
}

logoutBtn.addEventListener('click', () => {
  logout();
  showMessage('Logged out successfully.', 'success');
});

// ================== SECTION 7: TASKS LOAD KARNA ==================
async function loadTasks() {
  try {
    const res = await fetch(`${API_URL}/tasks`, { headers: authHeaders() });

    if (res.status === 401) {
      logout();
      showMessage('Session expired. Please login again.', 'error');
      return;
    }

    if (res.status === 403) {
        summary.textContent = 'Access denied. Only admins can view this page.';
        summary.className = 'message error';
        usersContainer.innerHTML = '';
        document.querySelector('.pagination').classList.add('hidden');
        return;
    }

    const tasks = await res.json();
    allTasks = tasks;
    applyFilter();
  } catch (error) {
    taskList.innerHTML = '<li>Could not load tasks.</li>';
  }
}

// ================== SECTION 8: TASKS SCREEN PE DIKHANA ==================
function renderTasks(tasks) {
  taskList.innerHTML = '';

  if (tasks.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'No tasks yet. Add your first task above!';
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

  const res = await fetch(`${API_URL}/tasks`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title, description })
  });

  if (res.ok) {
    taskForm.reset();
    loadTasks();
  }
});

// ================== SECTION 10: COMPLETE & DELETE ==================
async function completeTask(id) {
  await fetch(`${API_URL}/tasks/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ status: 'completed' })
  });
  loadTasks();
}

async function deleteTask(id) {
  if (!confirm('Are you sure you want to delete this task?')) return;

  await fetch(`${API_URL}/tasks/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  loadTasks();
}

// ================== SECTION 12: EDIT TASK ==================
async function editTask(task) {
  const newTitle = prompt('Edit task title:', task.title);

  if (newTitle === null || newTitle.trim() === '') return;

  await fetch(`${API_URL}/tasks/${task.id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ title: newTitle.trim() })
  });
  loadTasks();
}

// ================== SECTION 13: FILTER TABS ==================
function applyFilter() {
  let filtered = allTasks;

  if (currentFilter === 'pending') {
    filtered = allTasks.filter((t) => t.status !== 'completed');
  } else if (currentFilter === 'completed') {
    filtered = allTasks.filter((t) => t.status === 'completed');
  }

  renderTasks(filtered);
}

document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    applyFilter();
  });
});

// ================== SECTION 11: PAGE KHULTE HI CHECK ==================
if (localStorage.getItem('token')) {
  showDashboard();
} else {
  showAuth();
}