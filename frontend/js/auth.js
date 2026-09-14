const API = 'http://127.0.0.1:5000/api/auth';

function saveSession(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
}

function getToken() { return localStorage.getItem('token'); }

function getUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || 'null');
    } catch(e) {
        localStorage.removeItem('user');
        return null;
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Redirect to login — works whether served via Flask or file
    var base = window.location.origin;
    window.location.href = base + '/pages/login.html';
}

async function requireAuth() {
    const token = getToken();
    if (!token) return logout();
    const res = await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) logout();
    return res.json();
}

function redirectByRole(role) {
    if (role === 'admin') window.location.href = '/pages/dashboard.html';
    else if (role === 'farmer') window.location.href = '/pages/dashboard.html';
    else window.location.href = '/pages/dashboard.html';
}

async function handleLogin(e) {
    e.preventDefault();
    const email    = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const err      = document.getElementById('error');
    err.textContent = '';

    try {
        const res  = await fetch(`${API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) { err.textContent = data.error || 'Login failed'; return; }
        saveSession(data);
        redirectByRole(data.user.role);
    } catch(e) {
        err.textContent = 'Cannot connect to server. Make sure backend is running.';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const payload = {
        name:     document.getElementById('name').value,
        email:    document.getElementById('email').value,
        password: document.getElementById('password').value,
        role:     document.getElementById('role').value,
        phone:    document.getElementById('phone').value,
        location: document.getElementById('location').value,
    };
    const err = document.getElementById('error');
    err.textContent = '';

    try {
        const res  = await fetch(`${API}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) { err.textContent = data.error || 'Registration failed'; return; }
        saveSession(data);
        redirectByRole(data.user.role);
    } catch(e) {
        err.textContent = 'Cannot connect to server. Make sure backend is running.';
    }
}



