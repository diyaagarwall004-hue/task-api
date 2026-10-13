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

function goToLogin() {
  localStorage.removeItem('token');
  localStorage.removeItem('userName');
  localStorage.removeItem('userRole');
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

    // Backend chahe sirf array bheje ya pagination wala object, dono handle ho jayenge
    const users = Array.isArray(data) ? data : data.users;
    const totalPages = data.totalPages || 1;
    const totalUsers = data.totalUsers || users.length;

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
    const doneCount = user.tasks.filter((t) => t.status === 'completed').length;
    const pendingCount = user.tasks.length - doneCount;

    const card = document.createElement('div');
    card.className = 'user-card';

    // Naam + ID
    const name = document.createElement('h3');
    name.textContent = `${user.name} (ID: ${user.id})`;
    card.appendChild(name);

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
    totalBadge.textContent = `${user.tasks.length} tasks`;

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

    if (user.tasks.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No tasks yet';
      list.appendChild(li);
    } else {
      user.tasks.forEach((task) => {
        const li = document.createElement('li');
        li.textContent = task.description
          ? `${task.title} — ${task.description}`
          : task.title;
        if (task.status === 'completed') li.classList.add('completed');
        list.appendChild(li);
      });
    }

    card.appendChild(list);
    usersContainer.appendChild(card);
  });
}

// ================== PAGINATION BUTTONS ==================
prevBtn.addEventListener('click', () => loadUsers(currentPage - 1));
nextBtn.addEventListener('click', () => loadUsers(currentPage + 1));

// ================== PAGE KHULTE HI ==================
if (!token) {
  window.location.href = 'index.html';
} else {
  loadUsers(1);
}