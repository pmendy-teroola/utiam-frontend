/**
 * core/auth.js — U TIAM POS
 * Gestion login / logout / session utilisateur + changement obligatoire de MdP.
 * Dependances : core/api.js
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
    if (data.user.must_change_password) {
      authShowForcedPasswordChange();
    } else {
      authShowApp();
    }
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
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('app-screen').style.display = 'none';
  const forced = document.getElementById('auth-forced-modal');
  if (forced) forced.remove();
}

function authShowApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').classList.remove('hidden');
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
    if (currentUser.must_change_password) {
      authShowForcedPasswordChange();
    } else {
      authShowApp();
    }
  }
});

// ─── CHANGEMENT OBLIGATOIRE DE MOT DE PASSE ──────────────
function authShowForcedPasswordChange() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('app-screen').style.display = 'none';

  let modal = document.getElementById('auth-forced-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'auth-forced-modal';
  modal.style.cssText = `
    position: fixed; inset: 0; z-index: 1000;
    background: var(--bg-main);
    background-image: radial-gradient(ellipse at 20% 50%, #1a1500 0%, transparent 60%),
                      radial-gradient(ellipse at 80% 50%, #0a1a0a 0%, transparent 60%);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
  `;
  modal.innerHTML = `
    <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;padding:40px;width:100%;max-width:440px">
      <div style="width:56px;height:56px;background:var(--warning);border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#000" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
      </div>
      <div style="text-align:center;font-size:20px;font-weight:800;margin-bottom:6px">Changement obligatoire</div>
      <div style="text-align:center;color:var(--text-secondary);font-size:13px;margin-bottom:24px">
        Pour des raisons de securite, vous devez<br>changer votre mot de passe avant de continuer.
      </div>

      <div style="display:flex;flex-direction:column;gap:12px">
        <input id="forced-new-password" type="password" placeholder="Nouveau mot de passe" class="input"
               onkeydown="if(event.key==='Enter') document.getElementById('forced-confirm-password').focus()" />
        <input id="forced-confirm-password" type="password" placeholder="Confirmer le mot de passe" class="input"
               onkeydown="if(event.key==='Enter') authSubmitForcedPasswordChange()" />

        <div style="font-size:11px;color:var(--text-muted);padding:0 4px">
          Le mot de passe doit contenir au moins :
          <ul style="margin:6px 0 0 16px;padding:0">
            <li>8 caracteres</li>
            <li>1 chiffre</li>
            <li>1 majuscule</li>
          </ul>
        </div>

        <button class="login-btn" onclick="authSubmitForcedPasswordChange()">Valider</button>
        <button class="btn-logout" style="text-align:center;justify-content:center" onclick="authLogout()">Se deconnecter</button>

        <div id="forced-error" class="login-error hidden"></div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('forced-new-password').focus(), 100);
}

async function authSubmitForcedPasswordChange() {
  const newPwd = document.getElementById('forced-new-password').value;
  const confirmPwd = document.getElementById('forced-confirm-password').value;
  const err = document.getElementById('forced-error');
  err.classList.add('hidden');

  if (!newPwd || !confirmPwd) {
    err.textContent = 'Veuillez remplir les deux champs.';
    err.classList.remove('hidden');
    return;
  }
  if (newPwd !== confirmPwd) {
    err.textContent = 'Les mots de passe ne correspondent pas.';
    err.classList.remove('hidden');
    return;
  }
  if (newPwd.length < 8) {
    err.textContent = 'Le mot de passe doit contenir au moins 8 caracteres.';
    err.classList.remove('hidden');
    return;
  }
  if (!/[0-9]/.test(newPwd)) {
    err.textContent = 'Le mot de passe doit contenir au moins 1 chiffre.';
    err.classList.remove('hidden');
    return;
  }
  if (!/[A-Z]/.test(newPwd)) {
    err.textContent = 'Le mot de passe doit contenir au moins 1 majuscule.';
    err.classList.remove('hidden');
    return;
  }

  const result = await api('PUT', '/api/users/me/password', { new_password: newPwd });

  if (result && result.success) {
    currentUser.must_change_password = false;
    localStorage.setItem('utiam_user', JSON.stringify(currentUser));
    document.getElementById('auth-forced-modal').remove();
    authShowApp();
  } else {
    err.textContent = (result && result.error) || 'Erreur lors du changement de mot de passe.';
    err.classList.remove('hidden');
  }
}

// ─── CHANGEMENT VOLONTAIRE DE MOT DE PASSE ───────────────
function authOpenChangePassword() {
  let modal = document.getElementById('auth-change-pwd-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'auth-change-pwd-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:440px">
      <div class="modal-title">Changer mon mot de passe</div>

      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label class="form-label">Mot de passe actuel</label>
          <input id="chpwd-current" type="password" class="input" />
        </div>
        <div>
          <label class="form-label">Nouveau mot de passe</label>
          <input id="chpwd-new" type="password" class="input" />
        </div>
        <div>
          <label class="form-label">Confirmer le nouveau mot de passe</label>
          <input id="chpwd-confirm" type="password" class="input"
                 onkeydown="if(event.key==='Enter') authSubmitChangePassword()" />
        </div>
        <div style="font-size:11px;color:var(--text-muted);padding:0 4px">
          Le mot de passe doit contenir au moins 8 caracteres, 1 chiffre et 1 majuscule.
        </div>
      </div>
      <div id="chpwd-error" class="form-error hidden"></div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="document.getElementById('auth-change-pwd-modal').remove()">Annuler</button>
        <button class="btn btn-primary" id="chpwd-submit" onclick="authSubmitChangePassword()">Mettre a jour</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('chpwd-current').focus(), 100);
}

async function authSubmitChangePassword() {
  const current = document.getElementById('chpwd-current').value;
  const newPwd = document.getElementById('chpwd-new').value;
  const confirmPwd = document.getElementById('chpwd-confirm').value;
  const err = document.getElementById('chpwd-error');
  err.classList.add('hidden');

  if (!current || !newPwd || !confirmPwd) {
    err.textContent = 'Veuillez remplir tous les champs.';
    err.classList.remove('hidden');
    return;
  }
  if (newPwd !== confirmPwd) {
    err.textContent = 'Les nouveaux mots de passe ne correspondent pas.';
    err.classList.remove('hidden');
    return;
  }
  if (newPwd.length < 8) {
    err.textContent = 'Le mot de passe doit contenir au moins 8 caracteres.';
    err.classList.remove('hidden');
    return;
  }
  if (!/[0-9]/.test(newPwd)) {
    err.textContent = 'Le mot de passe doit contenir au moins 1 chiffre.';
    err.classList.remove('hidden');
    return;
  }
  if (!/[A-Z]/.test(newPwd)) {
    err.textContent = 'Le mot de passe doit contenir au moins 1 majuscule.';
    err.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('chpwd-submit');
  btn.textContent = 'Mise a jour...'; btn.disabled = true;

  const result = await api('PUT', '/api/users/me/password', {
    current_password: current,
    new_password: newPwd
  });

  btn.disabled = false; btn.textContent = 'Mettre a jour';

  if (result && result.success) {
    document.getElementById('auth-change-pwd-modal').remove();
    alert('Mot de passe modifie avec succes.');
  } else {
    err.textContent = (result && result.error) || 'Erreur lors du changement.';
    err.classList.remove('hidden');
  }
}
