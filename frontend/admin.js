// ================== SETUP ==================
const API_URL = '/api';
const LIMIT = 5; // ek page pe kitne users
let currentPage = 1;

const usersContainer = document.getElementById('users-container');
const summary = document.getElementById('admin-summary');
const pageInfo = document.getElementById('page-info');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

const token = localStorage.getItem('token');
const ROLES = ['user', 'admin', 'super_admin'];
const myId = parseInt(localStorage.getItem('userId'));
let myPermissions = [];
try {
  myPermissions = JSON.parse(localStorage.getItem('userPermissions')) || [];
} catch (e) {}
const canManageRoles = myPermissions.includes('roles:manage');
const canAssign = myPermissions.includes('tasks:assign');

// ================== HELPERS ==================
function formatDate(dateString) {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleString('en-IN');
}

function addLine(parent, text) {
  const line = document.createElement('div');
  line.textContent = text;
  parent.appendChild(line);
}

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
}

function labelRole(role) {
  return role.replace('_', ' ');
}

async function changeRole(user, newRole, select, note) {
  note.textContent = 'Saving...';
  note.className = 'inline-note';
  try {
    const res = await fetch(`${API_URL}/auth/users/${user.id}/role`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ role: newRole })
    });
    const data = await res.json();
    if (!res.ok) {
      select.value = user.role;
      note.textContent = data.message;
      note.className = 'inline-note error';
      return;
    }
    loadUsers(currentPage);
  } catch (error) {
    select.value = user.role;
    note.textContent = 'Could not reach the server';
    note.className = 'inline-note error';
  }
}

async function assignTask(user, input, dueInput, note) {
  const title = input.value.trim();
  if (!title) return;
  const body = { title, userId: user.id };
  // datetime-local gives the admin's local time; send it as an exact moment (UTC).
  if (dueInput.value) body.dueDate = new Date(dueInput.value).toISOString();
  try {
    const res = await fetch(`${API_URL}/tasks/assign`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
      note.textContent = data.message;
      note.className = 'inline-note error';
      return;
    }
    loadUsers(currentPage);
  } catch (error) {
    note.textContent = 'Could not reach the server';
    note.className = 'inline-note error';
  }
}

function goToLogin() {
  localStorage.removeItem('token');
  localStorage.removeItem('userName');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userId');
  localStorage.removeItem('userPermissions');
  window.location.href = 'index.html';
}

// ================== USERS LOAD KARNA ==================
async function loadUsers(page) {
  try {
    const res = await fetch(`${API_URL}/auth/users?limit=${LIMIT}&page=${page}`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (res.status === 401) {
      goToLogin();
      return;
    }

    
    if (res.status === 403) {
      summary.textContent = 'Access denied. Only admins can view this page.';
      summary.className = 'message error';
      usersContainer.innerHTML = '';
      document.querySelector('.pagination').classList.add('hidden');
      return;
    }

    const data = await res.json();
    if (!res.ok) {
      summary.textContent = data.message || 'Could not load users.';
      summary.className = 'message error';
      return;
    }

    const { users, pagination } = data;
    const totalPages = Math.max(pagination.totalPages, 1);
    const totalUsers = pagination.total;

    currentPage = page;
    renderUsers(users);

    summary.textContent = `Total users: ${totalUsers}`;
    summary.className = 'message';
    pageInfo.textContent = `Page ${page} of ${totalPages}`;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= totalPages;
  } catch (error) {
    summary.textContent = 'Could not load users. Is the backend running?';
    summary.className = 'message error';
  }
}

// ================== USER CARDS BANANA ==================
function renderUsers(users) {
  usersContainer.innerHTML = '';

  users.forEach((user) => {
    // Totals come from the server; only the most recent tasks are listed.
    const { total, pending: pendingCount, completed: doneCount } = user.taskStats;

    const card = document.createElement('div');
    card.className = 'user-card';

    // Naam + ID
    const name = document.createElement('h3');
    name.textContent = `${user.name} (ID: ${user.id})`;
    card.appendChild(name);

    const roleRow = document.createElement('div');
    roleRow.className = 'role-row';
    const roleBadge = document.createElement('span');
    roleBadge.className = 'badge role ' + user.role;
    roleBadge.textContent = labelRole(user.role);
    roleRow.appendChild(roleBadge);

    if (canManageRoles && user.id !== myId) {
      const select = document.createElement('select');
      ROLES.forEach((r) => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = labelRole(r);
        select.appendChild(opt);
      });
      select.value = user.role;
      const note = document.createElement('span');
      note.className = 'inline-note';
      select.addEventListener('change', () => changeRole(user, select.value, select, note));
      roleRow.append(select, note);
    }
    card.appendChild(roleRow);

    // Email, signup, last login
    const meta = document.createElement('div');
    meta.className = 'user-meta';
    addLine(meta, `Email: ${user.email}`);
    addLine(meta, `Signed up: ${formatDate(user.createdAt)}`);
    addLine(meta, `Last login: ${formatDate(user.lastLogin)}`);
    card.appendChild(meta);

    // Badges
    const badges = document.createElement('div');
    badges.className = 'badges';

    const totalBadge = document.createElement('span');
    totalBadge.className = 'badge';
    totalBadge.textContent = `${total} tasks`;

    const pendingBadge = document.createElement('span');
    pendingBadge.className = 'badge pending';
    pendingBadge.textContent = `${pendingCount} pending`;

    const doneBadge = document.createElement('span');
    doneBadge.className = 'badge done';
    doneBadge.textContent = `${doneCount} done`;

    badges.append(totalBadge, pendingBadge, doneBadge);
    card.appendChild(badges);

    // Task list
    const list = document.createElement('ul');
    list.className = 'user-tasks';

    if (user.recentTasks.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No tasks yet';
      list.appendChild(li);
    } else {
      user.recentTasks.forEach((task) => {
        const li = document.createElement('li');
        let text = task.description
          ? `${task.title} — ${task.description}`
          : task.title;
        if (task.dueDate) {
          text += `  (due ${new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })})`;
        }
        li.textContent = text;
        if (task.status === 'completed') li.classList.add('completed');
        list.appendChild(li);
      });
    }

    card.appendChild(list);

    if (total > user.recentTasks.length) {
      const more = document.createElement('div');
      more.className = 'inline-note';
      more.textContent = `Showing the ${user.recentTasks.length} most recent of ${total} tasks`;
      card.appendChild(more);
    }

    if (canAssign) {
      const form = document.createElement('form');
      form.className = 'assign-form';
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = `Assign a task to ${user.name}`;
      const dueInput = document.createElement('input');
      dueInput.type = 'datetime-local';
      dueInput.title = 'Due date and time (optional)';
      const btn = document.createElement('button');
      btn.type = 'submit';
      btn.textContent = 'Assign';
      const note = document.createElement('span');
      note.className = 'inline-note';
      form.append(input, dueInput, btn, note);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        assignTask(user, input, dueInput, note);
      });
      card.appendChild(form);
    }
    usersContainer.appendChild(card);
  });
}

// ================== ASSIGN TO ALL USERS ==================
const assignAllForm = document.getElementById('assign-all-form');
if (canAssign) {
  assignAllForm.classList.remove('hidden');
}
assignAllForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const note = document.getElementById('assign-all-note');
  const title = document.getElementById('assign-all-title').value.trim();
  const description = document.getElementById('assign-all-desc').value.trim();
  if (!confirm('Assign this task to ALL users?')) return;

  try {
    const res = await fetch(`${API_URL}/tasks/assign-all`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ title, description })
    });
    const data = await res.json();
    note.textContent = data.message;
    note.className = res.ok ? 'inline-note' : 'inline-note error';
    if (res.ok) {
      assignAllForm.reset();
      loadUsers(currentPage);
    }
  } catch (error) {
    note.textContent = 'Could not reach the server';
    note.className = 'inline-note error';
  }
});

// ================== PAGINATION BUTTONS ==================
prevBtn.addEventListener('click', () => loadUsers(currentPage - 1));
nextBtn.addEventListener('click', () => loadUsers(currentPage + 1));

// ================== PAGE KHULTE HI ==================
if (!token) {
  window.location.href = 'index.html';
} else {
  loadUsers(1);
}