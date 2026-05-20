/**
 * core/auth.js — U TIAM POS
 * Gestion login / logout / session utilisateur.
 * Dépendances : core/api.js
 */

let currentUser = JSON.parse(localStorage.getItem('utiam_user') || 'null');

async function authLogin() {
  const email    = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const err      = document.getElementById('login-error');
  err.classList.add('hidden');

  const data = await api('POST', '/api/auth/login', { email, password });
  if (data && data.token) {
    localStorage.setItem('utiam_token', data.token);
    localStorage.setItem('utiam_user', JSON.stringify(data.user));
    currentUser = data.user;
    authShowApp();
  } else {
    err.textContent = (data && data.error) || 'Erreur de connexion';
    err.classList.remove('hidden');
  }
}

function authLogout() {
  localStorage.removeItem('utiam_token');
  localStorage.removeItem('utiam_user');
  currentUser = null;
  document.getElementById('login-screen').style.display = '';
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app-screen').style.display = 'none';
}

function authShowApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'flex';
  document.getElementById('user-name').textContent    = currentUser.display_name;
  document.getElementById('user-role').textContent    = currentUser.role;
  document.getElementById('user-avatar').textContent  = currentUser.display_name[0].toUpperCase();
  document.getElementById('topbar-user').textContent  = currentUser.display_name;
  buildNav();
  renderTab('pos');
}

window.addEventListener('DOMContentLoaded', () => {
  if (currentUser && localStorage.getItem('utiam_token')) {
    authShowApp();
  }
});
