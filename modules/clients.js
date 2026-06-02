/**
 * modules/clients.js — U TIAM POS — Module Clients
 * Charte KANIENE — theme sombre
 *
 * Fonctionnalites :
 * - Liste avec recherche
 * - CRUD (creation / modification / suppression avec verification FK)
 * - Statistiques par client (visites, total depense, derniere visite)
 * - Historique d'achats detaille avec items
 */

let clientsList = [];
let clientsEditId = null;
let clientsDetailId = null;

async function renderClients(main) {
  main.innerHTML = `
    <div style="max-width:1200px;margin:0 auto">

      <!-- En-tete -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:20px;font-weight:700">Gestion des Clients</div>
          <div style="color:var(--text-secondary);font-size:13px;margin-top:2px" id="clients-count">Chargement...</div>
        </div>
        <button class="btn btn-primary" onclick="clientsOpenForm()">+ Nouveau client</button>
      </div>

      <!-- Recherche -->
      <div class="card" style="padding:14px 18px;margin-bottom:16px">
        <input id="clients-search" type="text" placeholder="Rechercher par nom, telephone, email..." class="input" style="background:var(--bg-elevated)" oninput="clientsFilterList()" />
      </div>

      <!-- Liste -->
      <div class="card" style="padding:0;overflow:hidden">
        <div id="clients-list" style="overflow-x:auto">
          <div style="padding:40px;text-align:center;color:var(--text-secondary)">Chargement...</div>
        </div>
      </div>
    </div>

    <!-- MODAL : Formulaire client -->
    <div id="clients-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:520px">
        <div class="modal-title" id="clients-modal-title">Nouveau client</div>
        <div class="form-grid">
          <div class="full">
            <label class="form-label">Nom *</label>
            <input id="cf-name" type="text" class="input" placeholder="Ex : Mme Diallo" />
          </div>
          <div class="full">
            <label class="form-label">Telephone</label>
            <input id="cf-phone" type="tel" class="input" placeholder="Ex : 77 123 45 67" />
          </div>
          <div class="full">
            <label class="form-label">Email</label>
            <input id="cf-email" type="email" class="input" placeholder="Ex : client@exemple.com" />
          </div>
        </div>
        <div id="clients-form-error" class="form-error hidden"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="clientsCloseForm()">Annuler</button>
          <button class="btn btn-primary" id="clients-submit-btn" onclick="clientsSubmitForm()">Enregistrer</button>
        </div>
      </div>
    </div>

    <!-- MODAL : Detail client + historique -->
    <div id="clients-detail-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:900px">
        <div id="clients-detail-content">
          <div style="text-align:center;padding:40px;color:var(--text-secondary)">Chargement...</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('clients-detail-modal').classList.add('hidden')">Fermer</button>
        </div>
      </div>
    </div>`;

  await clientsLoad();
}

async function clientsLoad() {
  clientsList = await api('GET', '/api/clients') || [];
  const c = document.getElementById('clients-count');
  if (c) c.textContent = clientsList.length + ' client' + (clientsList.length>1?'s':'') + ' enregistre' + (clientsList.length>1?'s':'');
  clientsRenderList(clientsList);
}

function clientsRenderList(list) {
  const el = document.getElementById('clients-list');
  if (!el) return;
  if (list.length === 0) {
    el.innerHTML = '<div style="padding:48px;text-align:center;color:var(--text-secondary)">Aucun client enregistre.<br><span style="font-size:12px">Cliquez sur "+ Nouveau client" pour commencer.</span></div>';
    return;
  }

  el.innerHTML = `<table class="data-table">
    <thead>
      <tr>
        <th>Client</th>
        <th>Telephone</th>
        <th style="text-align:right">Visites</th>
        <th style="text-align:right">Total depense</th>
        <th>Derniere visite</th>
        <th style="width:200px">Actions</th>
      </tr>
    </thead>
    <tbody>
      ${list.map(c => clientsRenderRow(c)).join('')}
    </tbody>
  </table>`;
}

function clientsRenderRow(c) {
  const visits = Number(c.visits || 0);
  const totalSpent = Number(c.total_spent || 0);
  const lastVisit = c.last_visit ? new Date(c.last_visit) : null;
  const credit = Number(c.credit || 0);

  const initials = (c.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return `<tr>
    <td>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;border-radius:50%;background:#2a2000;border:1px solid var(--accent);color:var(--accent);font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${initials}</div>
        <div>
          <div style="font-weight:600">${c.name}</div>
          ${c.email ? `<div style="font-size:11px;color:var(--text-muted)">${c.email}</div>` : ''}
          ${credit > 0 ? `<div style="font-size:11px;color:var(--warning);margin-top:2px">Credit : ${credit.toLocaleString('fr-FR')} F</div>` : ''}
        </div>
      </div>
    </td>
    <td style="color:var(--text-secondary)">${c.phone || '—'}</td>
    <td style="text-align:right;font-weight:600">${visits}</td>
    <td style="text-align:right;color:var(--accent);font-weight:700">${totalSpent.toLocaleString('fr-FR')} F</td>
    <td style="color:var(--text-secondary);font-size:12px">${lastVisit ? lastVisit.toLocaleDateString('fr-FR') : '—'}</td>
    <td>
      <div style="display:flex;gap:6px">
        <button class="btn btn-edit" onclick="clientsShowDetail(${c.id})">Historique</button>
        <button class="btn btn-edit" onclick="clientsOpenFormById(${c.id})">Modifier</button>
        <button class="btn btn-danger" onclick="clientsDelete(${c.id},'${(c.name||'').replace(/'/g,'')}',${visits})">✕</button>
      </div>
    </td>
  </tr>`;
}

function clientsFilterList() {
  const q = (document.getElementById('clients-search').value || '').toLowerCase();
  if (!q) { clientsRenderList(clientsList); return; }
  clientsRenderList(clientsList.filter(c =>
    (c.name || '').toLowerCase().includes(q) ||
    (c.phone || '').toLowerCase().includes(q) ||
    (c.email || '').toLowerCase().includes(q)
  ));
}

// ── FORMULAIRE ──
function clientsOpenFormById(id) {
  const c = clientsList.find(c => c.id === id);
  if (c) clientsOpenForm(c);
}

function clientsOpenForm(client) {
  clientsEditId = client ? client.id : null;
  document.getElementById('clients-modal-title').textContent = client ? 'Modifier le client' : 'Nouveau client';
  document.getElementById('cf-name').value = client ? (client.name || '') : '';
  document.getElementById('cf-phone').value = client ? (client.phone || '') : '';
  document.getElementById('cf-email').value = client ? (client.email || '') : '';
  document.getElementById('clients-form-error').classList.add('hidden');
  document.getElementById('clients-submit-btn').textContent = client ? 'Mettre a jour' : 'Enregistrer';
  document.getElementById('clients-modal').classList.remove('hidden');
}

function clientsCloseForm() {
  document.getElementById('clients-modal').classList.add('hidden');
  clientsEditId = null;
}

async function clientsSubmitForm() {
  const name = document.getElementById('cf-name').value.trim();
  const phone = document.getElementById('cf-phone').value.trim();
  const email = document.getElementById('cf-email').value.trim();
  const err = document.getElementById('clients-form-error');
  err.classList.add('hidden');

  if (!name) { err.textContent = 'Le nom est obligatoire.'; err.classList.remove('hidden'); return; }

  const payload = { name, phone: phone || null, email: email || null };
  const btn = document.getElementById('clients-submit-btn');
  btn.textContent = 'Enregistrement...'; btn.disabled = true;

  const result = clientsEditId
    ? await api('PUT', '/api/clients/' + clientsEditId, payload)
    : await api('POST', '/api/clients', payload);

  btn.disabled = false;

  if (result && result.id) {
    document.getElementById('clients-modal').classList.add('hidden');
    clientsEditId = null;
    await clientsLoad();
  } else {
    btn.textContent = clientsEditId ? 'Mettre a jour' : 'Enregistrer';
    err.textContent = 'Erreur enregistrement.';
    err.classList.remove('hidden');
  }
}

// ── SUPPRESSION ──
async function clientsDelete(id, name, visits) {
  if (visits > 0) {
    alert('Impossible de supprimer "' + name + '" : ce client a ' + visits + ' vente(s) liee(s).\n\nSi vous voulez le rendre invisible, modifiez-le simplement.');
    return;
  }
  if (!confirm('Supprimer "' + name + '" ?\nAction irreversible.')) return;

  try {
    const token = localStorage.getItem('utiam_token');
    const res = await fetch('/api/clients/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token },
    });

    if (res.status === 409) {
      const data = await res.json();
      alert(data.error || 'Suppression impossible.');
      return;
    }

    if (!res.ok) {
      alert('Erreur lors de la suppression.');
      return;
    }

    await clientsLoad();
  } catch (e) {
    alert('Erreur reseau : ' + e.message);
  }
}

// ── DETAIL + HISTORIQUE ──
async function clientsShowDetail(id) {
  clientsDetailId = id;
  document.getElementById('clients-detail-modal').classList.remove('hidden');
  document.getElementById('clients-detail-content').innerHTML =
    '<div style="text-align:center;padding:40px;color:var(--text-secondary)">Chargement...</div>';

  const [detail, history] = await Promise.all([
    api('GET', '/api/clients/' + id),
    api('GET', '/api/clients/' + id + '/history'),
  ]);

  if (!detail) {
    document.getElementById('clients-detail-content').innerHTML =
      '<div style="color:var(--danger);padding:20px">Erreur : client introuvable.</div>';
    return;
  }

  clientsRenderDetail(detail, history || []);
}

function clientsRenderDetail(client, history) {
  const stats = client.stats || {};
  const visits = Number(stats.visits || 0);
  const totalSpent = Number(stats.total_spent || 0);
  const avgBasket = Number(stats.avg_basket || 0);
  const firstVisit = stats.first_visit ? new Date(stats.first_visit) : null;
  const lastVisit = stats.last_visit ? new Date(stats.last_visit) : null;
  const credit = Number(client.credit || 0);

  const initials = (client.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  document.getElementById('clients-detail-content').innerHTML = `
    <!-- En-tete -->
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
      <div style="width:56px;height:56px;border-radius:50%;background:#2a2000;border:1px solid var(--accent);color:var(--accent);font-weight:700;font-size:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${initials}</div>
      <div>
        <div style="font-size:20px;font-weight:800">${client.name}</div>
        <div style="font-size:13px;color:var(--text-secondary)">
          ${client.phone ? '📞 ' + client.phone : ''}
          ${client.email ? '<br>✉ ' + client.email : ''}
        </div>
      </div>
    </div>

    ${credit > 0 ? `
      <div style="background:#2A1F05;border:1px solid #4d3d10;border-radius:8px;padding:10px 14px;margin-bottom:16px;color:var(--warning);font-size:13px">
        ⚠ Solde credit : <strong>${credit.toLocaleString('fr-FR')} F</strong>
      </div>
    ` : ''}

    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:20px">
      <div class="card" style="padding:12px 14px">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Visites</div>
        <div style="font-size:22px;font-weight:800">${visits}</div>
      </div>
      <div class="card" style="padding:12px 14px">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Total depense</div>
        <div style="font-size:22px;font-weight:800;color:var(--accent)">${totalSpent.toLocaleString('fr-FR')} F</div>
      </div>
      <div class="card" style="padding:12px 14px">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Panier moyen</div>
        <div style="font-size:22px;font-weight:800">${avgBasket.toLocaleString('fr-FR', {maximumFractionDigits: 0})} F</div>
      </div>
      <div class="card" style="padding:12px 14px">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Premiere visite</div>
        <div style="font-size:14px;font-weight:600;margin-top:6px">${firstVisit ? firstVisit.toLocaleDateString('fr-FR') : '—'}</div>
        <div style="font-size:11px;color:var(--text-secondary)">Derniere : ${lastVisit ? lastVisit.toLocaleDateString('fr-FR') : '—'}</div>
      </div>
    </div>

    <!-- Historique -->
    <div style="font-size:14px;font-weight:700;margin-bottom:10px">📋 Historique des ventes (${history.length})</div>
    ${history.length === 0 ? `
      <div style="text-align:center;padding:30px;color:var(--text-muted);font-size:13px;border:1px dashed var(--border);border-radius:8px">
        Aucune vente enregistree pour ce client.
      </div>
    ` : `
      <div style="max-height:400px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">
        ${history.map(sale => clientsRenderSale(sale)).join('')}
      </div>
    `}`;
}

function clientsRenderSale(sale) {
  const date = new Date(sale.created_at);
  const total = Number(sale.total);
  const discount = Number(sale.discount || 0);
  const items = (sale.items || []).filter(i => i.product_name);
  const paymentLabels = {
    especes: '💵 Especes',
    mobile_money: '📱 Mobile Money',
    carte_bancaire: '💳 Carte',
    cheque: '📝 Cheque',
    credit_client: '🧾 Credit client',
  };

  return `
    <div style="padding:12px 14px;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-weight:700">
          Ticket #${sale.id}
          <span style="font-size:11px;color:var(--text-muted);font-weight:400;margin-left:8px">${date.toLocaleString('fr-FR')}</span>
        </div>
        <div style="color:var(--accent);font-weight:800;font-size:15px">${total.toLocaleString('fr-FR')} F</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--text-secondary);margin-bottom:6px">
        <span>${paymentLabels[sale.payment_method] || sale.payment_method}</span>
        ${sale.cashier_name ? `<span>· Caisse : ${sale.cashier_name}</span>` : ''}
        ${discount > 0 ? `<span>· Remise : ${discount.toLocaleString('fr-FR')} F</span>` : ''}
      </div>
      ${items.length > 0 ? `
        <div style="background:var(--bg-elevated);border-radius:6px;padding:8px 10px;font-size:12px">
          ${items.map(i => `
            <div style="display:flex;justify-content:space-between;padding:2px 0">
              <span>${i.quantity} × ${i.product_name}</span>
              <span style="color:var(--text-secondary)">${Number(i.total).toLocaleString('fr-FR')} F</span>
            </div>`).join('')}
        </div>
      ` : ''}
    </div>`;
}
