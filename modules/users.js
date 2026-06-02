/**
 * modules/users.js — U TIAM POS — Module Utilisateurs
 * Charte KANIENE — theme sombre
 *
 * Fonctionnalites :
 * - Liste avec recherche et stats (ventes, CA, derniere activite)
 * - Creation de comptes (admin/gerant/caissier)
 * - Modification (nom, email, role)
 * - Activation / Desactivation (protection dernier admin + soi-meme)
 * - Reinitialisation MdP par admin (force changement au prochain login)
 * - Bouton "Changer mon mot de passe" pour tous les utilisateurs
 */

let usersList = [];
let usersEditId = null;

const ROLE_LABELS = {
  admin: 'Administrateur',
  gerant: 'Gerant',
  caissier: 'Caissier',
};

const ROLE_BADGES = {
  admin: 'badge-danger',
  gerant: 'badge-warning',
  caissier: 'badge-info',
};

async function renderUsers(main) {
  const isAdmin = currentUser && currentUser.role === 'admin';

  main.innerHTML = `
    <div style="max-width:1200px;margin:0 auto">

      <!-- En-tete -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:20px;font-weight:700">Gestion des Utilisateurs</div>
          <div style="color:var(--text-secondary);font-size:13px;margin-top:2px" id="users-count">Chargement...</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary" onclick="authOpenChangePassword()">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
            Changer mon mot de passe
          </button>
          ${isAdmin ? `<button class="btn btn-primary" onclick="usersOpenForm()">+ Nouvel utilisateur</button>` : ''}
        </div>
      </div>

      ${!isAdmin ? `
        <div style="background:#0D1F2D;border:1px solid #1d3552;border-radius:10px;padding:14px 18px;margin-bottom:16px;font-size:13px;color:var(--info)">
          ℹ Seul un administrateur peut creer, modifier ou desactiver des utilisateurs. Vous pouvez consulter la liste et changer votre propre mot de passe.
        </div>
      ` : ''}

      <!-- Recherche -->
      <div class="card" style="padding:14px 18px;margin-bottom:16px">
        <input id="users-search" type="text" placeholder="Rechercher par nom, email, role..." class="input" style="background:var(--bg-elevated)" oninput="usersFilterList()" />
      </div>

      <!-- Liste -->
      <div class="card" style="padding:0;overflow:hidden">
        <div id="users-list" style="overflow-x:auto">
          <div style="padding:40px;text-align:center;color:var(--text-secondary)">Chargement...</div>
        </div>
      </div>
    </div>

    <!-- MODAL : Formulaire utilisateur -->
    <div id="users-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:520px">
        <div class="modal-title" id="users-modal-title">Nouvel utilisateur</div>
        <div class="form-grid">
          <div class="full">
            <label class="form-label">Nom complet *</label>
            <input id="uf-display-name" type="text" class="input" placeholder="Ex : Mamadou Diop" />
          </div>
          <div class="full">
            <label class="form-label">Email *</label>
            <input id="uf-email" type="email" class="input" placeholder="Ex : mamadou@utiam.com" />
          </div>
          <div class="full">
            <label class="form-label">Role *</label>
            <select id="uf-role" class="input">
              <option value="caissier">Caissier (acces caisse + clients uniquement)</option>
              <option value="gerant">Gerant (acces complet sauf utilisateurs)</option>
              <option value="admin">Administrateur (acces total)</option>
            </select>
          </div>
          <div class="full" id="uf-password-block">
            <label class="form-label">Mot de passe initial *</label>
            <input id="uf-password" type="password" class="input" placeholder="Min 8 caracteres + 1 chiffre + 1 majuscule" />
            <div style="font-size:11px;color:var(--text-muted);margin-top:6px">
              L'utilisateur devra changer ce mot de passe a sa premiere connexion.
            </div>
          </div>
        </div>
        <div id="users-form-error" class="form-error hidden"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="usersCloseForm()">Annuler</button>
          <button class="btn btn-primary" id="users-submit-btn" onclick="usersSubmitForm()">Enregistrer</button>
        </div>
      </div>
    </div>

    <!-- MODAL : Reinitialisation MdP -->
    <div id="users-reset-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:480px">
        <div class="modal-title">Reinitialiser le mot de passe</div>
        <div style="background:#2A1F05;border:1px solid #4d3d10;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:var(--warning)">
          ⚠ L'utilisateur <strong id="users-reset-name">—</strong> devra utiliser ce nouveau mot de passe lors de sa prochaine connexion et sera invite a en choisir un personnel.
        </div>
        <div>
          <label class="form-label">Nouveau mot de passe temporaire *</label>
          <input id="users-reset-pwd" type="text" class="input" placeholder="Min 8 caracteres + 1 chiffre + 1 majuscule" />
          <div style="font-size:11px;color:var(--text-muted);margin-top:6px">
            Communiquez ce mot de passe a l'utilisateur de facon securisee (SMS, en personne, etc.).
          </div>
        </div>
        <div id="users-reset-error" class="form-error hidden"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('users-reset-modal').classList.add('hidden')">Annuler</button>
          <button class="btn btn-primary" id="users-reset-submit" onclick="usersSubmitReset()">Reinitialiser</button>
        </div>
      </div>
    </div>`;

  await usersLoad();
}

async function usersLoad() {
  usersList = await api('GET', '/api/users') || [];
  const c = document.getElementById('users-count');
  if (c) {
    const active = usersList.filter(u => u.is_active).length;
    c.textContent = active + ' actif' + (active>1?'s':'') + ' sur ' + usersList.length + ' utilisateur' + (usersList.length>1?'s':'');
  }
  usersRenderList(usersList);
}

function usersRenderList(list) {
  const el = document.getElementById('users-list');
  const isAdmin = currentUser && currentUser.role === 'admin';
  if (!el) return;
  if (list.length === 0) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary)">Aucun utilisateur.</div>';
    return;
  }

  el.innerHTML = `<table class="data-table">
    <thead>
      <tr>
        <th>Utilisateur</th>
        <th>Email</th>
        <th>Role</th>
        <th>Statut</th>
        <th style="text-align:right">Ventes</th>
        <th style="text-align:right">CA realise</th>
        ${isAdmin ? '<th style="width:220px">Actions</th>' : ''}
      </tr>
    </thead>
    <tbody>
      ${list.map(u => usersRenderRow(u, isAdmin)).join('')}
    </tbody>
  </table>`;
}

function usersRenderRow(u, isAdmin) {
  const initials = (u.display_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const isSelf = currentUser && currentUser.id === u.id;
  const salesCount = Number(u.sales_count || 0);
  const totalRevenue = Number(u.total_revenue || 0);
  const lastSale = u.last_sale ? new Date(u.last_sale) : null;

  const statusBadge = u.is_active
    ? '<span class="badge badge-success">Actif</span>'
    : '<span class="badge" style="background:#1e1e1e;color:var(--text-muted);border:1px solid var(--border)">Desactive</span>';

  const mustChangeBadge = u.must_change_password
    ? '<div style="font-size:10px;color:var(--warning);margin-top:2px">⚠ Doit changer son MdP</div>'
    : '';

  return `<tr style="${!u.is_active ? 'opacity:0.6' : ''}">
    <td>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;border-radius:50%;background:#2a2000;border:1px solid var(--accent);color:var(--accent);font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${initials}</div>
        <div>
          <div style="font-weight:600">${u.display_name}${isSelf?' <span style="font-size:10px;color:var(--accent);background:#2a2000;padding:1px 6px;border-radius:4px;margin-left:4px">VOUS</span>':''}</div>
          ${mustChangeBadge}
        </div>
      </div>
    </td>
    <td style="color:var(--text-secondary)">${u.email}</td>
    <td><span class="badge ${ROLE_BADGES[u.role]||'badge-info'}">${ROLE_LABELS[u.role] || u.role}</span></td>
    <td>${statusBadge}</td>
    <td style="text-align:right;font-weight:600">${salesCount}</td>
    <td style="text-align:right;color:var(--accent);font-weight:700">${totalRevenue.toLocaleString('fr-FR')} F</td>
    ${isAdmin ? `<td>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="btn btn-edit" onclick="usersOpenFormById(${u.id})" title="Modifier">Modifier</button>
        <button class="btn btn-edit" onclick="usersOpenReset(${u.id},'${(u.display_name||'').replace(/'/g,'')}')" title="Reset MdP">🔑</button>
        ${u.is_active
          ? (isSelf ? '' : `<button class="btn btn-danger" onclick="usersToggleStatus(${u.id}, false, '${(u.display_name||'').replace(/'/g,'')}')" title="Desactiver">⏸</button>`)
          : `<button class="btn btn-edit" onclick="usersToggleStatus(${u.id}, true, '${(u.display_name||'').replace(/'/g,'')}')" title="Reactiver">▶</button>`
        }
      </div>
    </td>` : ''}
  </tr>`;
}

function usersFilterList() {
  const q = (document.getElementById('users-search').value || '').toLowerCase();
  if (!q) { usersRenderList(usersList); return; }
  usersRenderList(usersList.filter(u =>
    (u.display_name || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q) ||
    (u.role || '').toLowerCase().includes(q) ||
    (ROLE_LABELS[u.role] || '').toLowerCase().includes(q)
  ));
}

// ── FORMULAIRE ──
function usersOpenFormById(id) {
  const u = usersList.find(u => u.id === id);
  if (u) usersOpenForm(u);
}

function usersOpenForm(user) {
  usersEditId = user ? user.id : null;
  document.getElementById('users-modal-title').textContent = user ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur';
  document.getElementById('uf-display-name').value = user ? (user.display_name || '') : '';
  document.getElementById('uf-email').value = user ? (user.email || '') : '';
  document.getElementById('uf-role').value = user ? (user.role || 'caissier') : 'caissier';
  document.getElementById('uf-password').value = '';

  // Masquer le bloc mot de passe en modification (utilise reset password a la place)
  document.getElementById('uf-password-block').style.display = user ? 'none' : 'block';

  document.getElementById('users-form-error').classList.add('hidden');
  document.getElementById('users-submit-btn').textContent = user ? 'Mettre a jour' : 'Creer le compte';
  document.getElementById('users-modal').classList.remove('hidden');
}

function usersCloseForm() {
  document.getElementById('users-modal').classList.add('hidden');
  usersEditId = null;
}

async function usersSubmitForm() {
  const display_name = document.getElementById('uf-display-name').value.trim();
  const email = document.getElementById('uf-email').value.trim();
  const role = document.getElementById('uf-role').value;
  const password = document.getElementById('uf-password').value;
  const err = document.getElementById('users-form-error');
  err.classList.add('hidden');

  if (!display_name) { err.textContent = 'Le nom est obligatoire.'; err.classList.remove('hidden'); return; }
  if (!email) { err.textContent = 'L\'email est obligatoire.'; err.classList.remove('hidden'); return; }
  if (!email.includes('@')) { err.textContent = 'Email invalide.'; err.classList.remove('hidden'); return; }

  // Validation MdP uniquement en creation
  if (!usersEditId) {
    if (!password) { err.textContent = 'Le mot de passe initial est obligatoire.'; err.classList.remove('hidden'); return; }
    if (password.length < 8) { err.textContent = 'Le mot de passe doit faire au moins 8 caracteres.'; err.classList.remove('hidden'); return; }
    if (!/[0-9]/.test(password)) { err.textContent = 'Le mot de passe doit contenir au moins 1 chiffre.'; err.classList.remove('hidden'); return; }
    if (!/[A-Z]/.test(password)) { err.textContent = 'Le mot de passe doit contenir au moins 1 majuscule.'; err.classList.remove('hidden'); return; }
  }

  const btn = document.getElementById('users-submit-btn');
  btn.textContent = 'Enregistrement...'; btn.disabled = true;

  let result;
  if (usersEditId) {
    result = await api('PUT', '/api/users/' + usersEditId, { display_name, email, role });
  } else {
    result = await api('POST', '/api/users', { display_name, email, role, password });
  }

  btn.disabled = false;

  if (result && result.id) {
    document.getElementById('users-modal').classList.add('hidden');
    usersEditId = null;
    await usersLoad();
  } else {
    btn.textContent = usersEditId ? 'Mettre a jour' : 'Creer le compte';
    err.textContent = (result && result.error) || 'Erreur lors de l\'enregistrement.';
    err.classList.remove('hidden');
  }
}

// ── ACTIVATION / DESACTIVATION ──
async function usersToggleStatus(id, is_active, name) {
  const action = is_active ? 'reactiver' : 'desactiver';
  if (!confirm(action.charAt(0).toUpperCase() + action.slice(1) + ' "' + name + '" ?')) return;

  try {
    const token = localStorage.getItem('utiam_token');
    const res = await fetch('/api/users/' + id + '/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ is_active }),
    });
    if (res.status === 409) {
      const data = await res.json();
      alert(data.error || 'Action impossible.');
      return;
    }
    if (!res.ok) { alert('Erreur lors du changement de statut.'); return; }
    await usersLoad();
  } catch (e) {
    alert('Erreur reseau : ' + e.message);
  }
}

// ── RESET PASSWORD ──
let usersResetTargetId = null;

function usersOpenReset(id, name) {
  usersResetTargetId = id;
  document.getElementById('users-reset-name').textContent = name;
  document.getElementById('users-reset-pwd').value = '';
  document.getElementById('users-reset-error').classList.add('hidden');
  document.getElementById('users-reset-modal').classList.remove('hidden');
}

async function usersSubmitReset() {
  const newPwd = document.getElementById('users-reset-pwd').value;
  const err = document.getElementById('users-reset-error');
  err.classList.add('hidden');

  if (!newPwd) { err.textContent = 'Le mot de passe est obligatoire.'; err.classList.remove('hidden'); return; }
  if (newPwd.length < 8) { err.textContent = 'Le mot de passe doit faire au moins 8 caracteres.'; err.classList.remove('hidden'); return; }
  if (!/[0-9]/.test(newPwd)) { err.textContent = 'Le mot de passe doit contenir au moins 1 chiffre.'; err.classList.remove('hidden'); return; }
  if (!/[A-Z]/.test(newPwd)) { err.textContent = 'Le mot de passe doit contenir au moins 1 majuscule.'; err.classList.remove('hidden'); return; }

  const btn = document.getElementById('users-reset-submit');
  btn.textContent = 'Reinitialisation...'; btn.disabled = true;

  const result = await api('POST', '/api/users/' + usersResetTargetId + '/reset-password', { new_password: newPwd });

  btn.disabled = false; btn.textContent = 'Reinitialiser';

  if (result && result.success) {
    document.getElementById('users-reset-modal').classList.add('hidden');
    alert('Mot de passe reinitialise.\nCommuniquez-le a l\'utilisateur.');
    usersResetTargetId = null;
    await usersLoad();
  } else {
    err.textContent = (result && result.error) || 'Erreur lors de la reinitialisation.';
    err.classList.remove('hidden');
  }
}
