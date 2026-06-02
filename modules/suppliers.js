/**
 * modules/suppliers.js — U TIAM POS — Module Fournisseurs
 * Charte KANIENE — theme sombre
 *
 * Fonctionnalites :
 * - Liste avec recherche et stats (produits, achats, solde du)
 * - CRUD (creation / modification / activation)
 * - Detail complet : produits livres, BC, paiements, solde
 * - Conditions de paiement (comptant / 30j / 60j)
 */

let suppliersList = [];
let suppliersEditId = null;
let suppliersDetailId = null;

const PAYMENT_TERMS_LABELS = {
  comptant: 'Comptant',
  '30j': '30 jours',
  '60j': '60 jours',
  '90j': '90 jours',
};

async function renderSuppliers(main) {
  main.innerHTML = `
    <div style="max-width:1200px;margin:0 auto">

      <!-- En-tete -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:20px;font-weight:700">Gestion des Fournisseurs</div>
          <div style="color:var(--text-secondary);font-size:13px;margin-top:2px" id="suppliers-count">Chargement...</div>
        </div>
        <button class="btn btn-primary" onclick="suppliersOpenForm()">+ Nouveau fournisseur</button>
      </div>

      <!-- Recherche -->
      <div class="card" style="padding:14px 18px;margin-bottom:16px">
        <input id="suppliers-search" type="text" placeholder="Rechercher par nom, telephone, email..." class="input" style="background:var(--bg-elevated)" oninput="suppliersFilterList()" />
      </div>

      <!-- Liste -->
      <div class="card" style="padding:0;overflow:hidden">
        <div id="suppliers-list" style="overflow-x:auto">
          <div style="padding:40px;text-align:center;color:var(--text-secondary)">Chargement...</div>
        </div>
      </div>
    </div>

    <!-- MODAL : Formulaire fournisseur -->
    <div id="suppliers-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:600px">
        <div class="modal-title" id="suppliers-modal-title">Nouveau fournisseur</div>
        <div class="form-grid">
          <div class="full">
            <label class="form-label">Nom *</label>
            <input id="sf-name" type="text" class="input" placeholder="Ex : SAGAM SA" />
          </div>
          <div>
            <label class="form-label">Telephone</label>
            <input id="sf-phone" type="tel" class="input" placeholder="Ex : 33 822 12 34" />
          </div>
          <div>
            <label class="form-label">Email</label>
            <input id="sf-email" type="email" class="input" placeholder="contact@sagam.sn" />
          </div>
          <div class="full">
            <label class="form-label">Adresse</label>
            <textarea id="sf-address" class="input" rows="2" placeholder="Adresse complete"></textarea>
          </div>
          <div>
            <label class="form-label">Conditions de paiement</label>
            <select id="sf-payment-terms" class="input">
              <option value="comptant">Comptant</option>
              <option value="30j">30 jours</option>
              <option value="60j">60 jours</option>
              <option value="90j">90 jours</option>
            </select>
          </div>
          <div></div>
          <div class="full">
            <label class="form-label">Notes</label>
            <textarea id="sf-notes" class="input" rows="2" placeholder="Notes internes"></textarea>
          </div>
        </div>
        <div id="suppliers-form-error" class="form-error hidden"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="suppliersCloseForm()">Annuler</button>
          <button class="btn btn-primary" id="suppliers-submit-btn" onclick="suppliersSubmitForm()">Enregistrer</button>
        </div>
      </div>
    </div>

    <!-- MODAL : Detail fournisseur -->
    <div id="suppliers-detail-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:960px">
        <div id="suppliers-detail-content">
          <div style="text-align:center;padding:40px;color:var(--text-secondary)">Chargement...</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('suppliers-detail-modal').classList.add('hidden')">Fermer</button>
        </div>
      </div>
    </div>

    <!-- MODAL : Enregistrer un paiement -->
    <div id="suppliers-payment-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:520px">
        <div class="modal-title">Enregistrer un paiement</div>
        <div style="background:#0D1F2D;border:1px solid #1d3552;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:var(--info)">
          Fournisseur : <strong id="suppliers-payment-name">—</strong>
        </div>
        <div class="form-grid">
          <div>
            <label class="form-label">Montant (F) *</label>
            <input id="sp-amount" type="number" min="0" step="100" class="input" />
          </div>
          <div>
            <label class="form-label">Mode de paiement *</label>
            <select id="sp-method" class="input">
              <option value="especes">Especes</option>
              <option value="virement">Virement</option>
              <option value="cheque">Cheque</option>
              <option value="mobile_money">Mobile Money</option>
            </select>
          </div>
          <div class="full">
            <label class="form-label">Bon de commande (optionnel)</label>
            <select id="sp-po" class="input">
              <option value="">— Aucun BC —</option>
            </select>
          </div>
          <div class="full">
            <label class="form-label">Reference (optionnelle)</label>
            <input id="sp-reference" type="text" class="input" placeholder="Ex : VIR-2026-001 ou N° de cheque" />
          </div>
          <div class="full">
            <label class="form-label">Notes</label>
            <textarea id="sp-notes" class="input" rows="2"></textarea>
          </div>
        </div>
        <div id="suppliers-payment-error" class="form-error hidden"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('suppliers-payment-modal').classList.add('hidden')">Annuler</button>
          <button class="btn btn-primary" id="sp-submit" onclick="suppliersSubmitPayment()">Enregistrer le paiement</button>
        </div>
      </div>
    </div>`;

  await suppliersLoad();
}

async function suppliersLoad() {
  suppliersList = await api('GET', '/api/suppliers') || [];
  const c = document.getElementById('suppliers-count');
  if (c) {
    const active = suppliersList.filter(s => s.is_active).length;
    c.textContent = active + ' actif' + (active>1?'s':'') + ' sur ' + suppliersList.length + ' fournisseur' + (suppliersList.length>1?'s':'');
  }
  suppliersRenderList(suppliersList);
}

function suppliersRenderList(list) {
  const el = document.getElementById('suppliers-list');
  if (!el) return;
  if (list.length === 0) {
    el.innerHTML = '<div style="padding:48px;text-align:center;color:var(--text-secondary)">Aucun fournisseur enregistre.<br><span style="font-size:12px">Cliquez sur "+ Nouveau fournisseur" pour commencer.</span></div>';
    return;
  }
  el.innerHTML = `<table class="data-table">
    <thead>
      <tr>
        <th>Fournisseur</th>
        <th>Contact</th>
        <th>Paiement</th>
        <th style="text-align:right">Produits</th>
        <th style="text-align:right">Total achete</th>
        <th style="text-align:right">Solde du</th>
        <th>Statut</th>
        <th style="width:240px">Actions</th>
      </tr>
    </thead>
    <tbody>
      ${list.map(s => suppliersRenderRow(s)).join('')}
    </tbody>
  </table>`;
}

function suppliersRenderRow(s) {
  const productsCount = Number(s.products_count || 0);
  const totalReceived = Number(s.total_received || 0);
  const totalPaid = Number(s.total_paid || 0);
  const balance = totalReceived - totalPaid;
  const initials = (s.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const balanceColor = balance > 0 ? 'var(--warning)' : (balance < 0 ? 'var(--info)' : 'var(--text-muted)');
  const balanceLabel = balance > 0 ? balance.toLocaleString('fr-FR') + ' F' : (balance < 0 ? 'Avance ' + Math.abs(balance).toLocaleString('fr-FR') + ' F' : '—');

  const statusBadge = s.is_active
    ? '<span class="badge badge-success">Actif</span>'
    : '<span class="badge" style="background:#1e1e1e;color:var(--text-muted);border:1px solid var(--border)">Inactif</span>';

  return `<tr style="${!s.is_active ? 'opacity:0.6' : ''}">
    <td>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;border-radius:50%;background:#2a2000;border:1px solid var(--accent);color:var(--accent);font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${initials}</div>
        <div>
          <div style="font-weight:600">${s.name}</div>
          ${s.email ? `<div style="font-size:11px;color:var(--text-muted)">${s.email}</div>` : ''}
        </div>
      </div>
    </td>
    <td style="color:var(--text-secondary);font-size:12px">${s.phone || '—'}</td>
    <td><span class="badge badge-info">${PAYMENT_TERMS_LABELS[s.payment_terms] || s.payment_terms}</span></td>
    <td style="text-align:right;font-weight:600">${productsCount}</td>
    <td style="text-align:right;color:var(--accent);font-weight:700">${totalReceived.toLocaleString('fr-FR')} F</td>
    <td style="text-align:right;color:${balanceColor};font-weight:700">${balanceLabel}</td>
    <td>${statusBadge}</td>
    <td>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="btn btn-edit" onclick="suppliersShowDetail(${s.id})">Detail</button>
        <button class="btn btn-edit" onclick="suppliersOpenFormById(${s.id})">Modifier</button>
        <button class="btn btn-edit" onclick="suppliersOpenPayment(${s.id},'${(s.name||'').replace(/'/g,'')}')">💰 Paiement</button>
        ${s.is_active
          ? `<button class="btn btn-danger" onclick="suppliersToggleStatus(${s.id}, false, '${(s.name||'').replace(/'/g,'')}')" title="Desactiver">⏸</button>`
          : `<button class="btn btn-edit" onclick="suppliersToggleStatus(${s.id}, true, '${(s.name||'').replace(/'/g,'')}')" title="Reactiver">▶</button>`
        }
      </div>
    </td>
  </tr>`;
}

function suppliersFilterList() {
  const q = (document.getElementById('suppliers-search').value || '').toLowerCase();
  if (!q) { suppliersRenderList(suppliersList); return; }
  suppliersRenderList(suppliersList.filter(s =>
    (s.name || '').toLowerCase().includes(q) ||
    (s.phone || '').toLowerCase().includes(q) ||
    (s.email || '').toLowerCase().includes(q)
  ));
}

// ── FORMULAIRE ──
function suppliersOpenFormById(id) {
  const s = suppliersList.find(s => s.id === id);
  if (s) suppliersOpenForm(s);
}

function suppliersOpenForm(supplier) {
  suppliersEditId = supplier ? supplier.id : null;
  document.getElementById('suppliers-modal-title').textContent = supplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur';
  document.getElementById('sf-name').value = supplier ? (supplier.name || '') : '';
  document.getElementById('sf-phone').value = supplier ? (supplier.phone || '') : '';
  document.getElementById('sf-email').value = supplier ? (supplier.email || '') : '';
  document.getElementById('sf-address').value = supplier ? (supplier.address || '') : '';
  document.getElementById('sf-payment-terms').value = supplier ? (supplier.payment_terms || 'comptant') : 'comptant';
  document.getElementById('sf-notes').value = supplier ? (supplier.notes || '') : '';
  document.getElementById('suppliers-form-error').classList.add('hidden');
  document.getElementById('suppliers-submit-btn').textContent = supplier ? 'Mettre a jour' : 'Enregistrer';
  document.getElementById('suppliers-modal').classList.remove('hidden');
}

function suppliersCloseForm() {
  document.getElementById('suppliers-modal').classList.add('hidden');
  suppliersEditId = null;
}

async function suppliersSubmitForm() {
  const name = document.getElementById('sf-name').value.trim();
  const phone = document.getElementById('sf-phone').value.trim();
  const email = document.getElementById('sf-email').value.trim();
  const address = document.getElementById('sf-address').value.trim();
  const payment_terms = document.getElementById('sf-payment-terms').value;
  const notes = document.getElementById('sf-notes').value.trim();
  const err = document.getElementById('suppliers-form-error');
  err.classList.add('hidden');

  if (!name) { err.textContent = 'Le nom est obligatoire.'; err.classList.remove('hidden'); return; }

  const payload = { name, phone: phone || null, email: email || null, address: address || null, payment_terms, notes: notes || null };
  const btn = document.getElementById('suppliers-submit-btn');
  btn.textContent = 'Enregistrement...'; btn.disabled = true;

  const result = suppliersEditId
    ? await api('PUT', '/api/suppliers/' + suppliersEditId, payload)
    : await api('POST', '/api/suppliers', payload);

  btn.disabled = false;

  if (result && result.id) {
    document.getElementById('suppliers-modal').classList.add('hidden');
    suppliersEditId = null;
    await suppliersLoad();
  } else {
    btn.textContent = suppliersEditId ? 'Mettre a jour' : 'Enregistrer';
    err.textContent = (result && result.error) || 'Erreur lors de l\'enregistrement.';
    err.classList.remove('hidden');
  }
}

// ── ACTIVATION / DESACTIVATION ──
async function suppliersToggleStatus(id, is_active, name) {
  const action = is_active ? 'reactiver' : 'desactiver';
  if (!confirm(action.charAt(0).toUpperCase() + action.slice(1) + ' "' + name + '" ?')) return;
  const result = await api('PUT', '/api/suppliers/' + id + '/status', { is_active });
  if (result && result.id) await suppliersLoad();
  else alert('Erreur lors du changement de statut.');
}

// ── DETAIL ──
async function suppliersShowDetail(id) {
  suppliersDetailId = id;
  document.getElementById('suppliers-detail-modal').classList.remove('hidden');
  document.getElementById('suppliers-detail-content').innerHTML =
    '<div style="text-align:center;padding:40px;color:var(--text-secondary)">Chargement...</div>';

  const detail = await api('GET', '/api/suppliers/' + id);

  if (!detail) {
    document.getElementById('suppliers-detail-content').innerHTML =
      '<div style="color:var(--danger);padding:20px">Erreur : fournisseur introuvable.</div>';
    return;
  }
  suppliersRenderDetail(detail);
}

function suppliersRenderDetail(s) {
  const initials = (s.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const balance = Number(s.balance || 0);
  const balanceColor = balance > 0 ? 'var(--warning)' : (balance < 0 ? 'var(--info)' : 'var(--success)');
  const balanceLabel = balance > 0 ? 'Vous lui devez' : (balance < 0 ? 'Avance versee' : 'Solde a jour');

  const PO_STATUS = {
    draft: { label: 'Brouillon', color: 'var(--text-muted)' },
    sent: { label: 'Envoye', color: 'var(--info)' },
    received: { label: 'Recu', color: 'var(--success)' },
    partial: { label: 'Partiel', color: 'var(--warning)' },
    settled: { label: 'Solde', color: 'var(--accent)' },
    cancelled: { label: 'Annule', color: 'var(--danger)' },
  };

  document.getElementById('suppliers-detail-content').innerHTML = `
    <!-- En-tete -->
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
      <div style="width:56px;height:56px;border-radius:50%;background:#2a2000;border:1px solid var(--accent);color:var(--accent);font-weight:700;font-size:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${initials}</div>
      <div>
        <div style="font-size:20px;font-weight:800">${s.name}</div>
        <div style="font-size:13px;color:var(--text-secondary)">
          ${s.phone ? '📞 ' + s.phone : ''}
          ${s.email ? ' · ✉ ' + s.email : ''}
        </div>
        ${s.address ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">📍 ${s.address}</div>` : ''}
      </div>
    </div>

    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:20px">
      <div class="card" style="padding:12px 14px">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Total achete</div>
        <div style="font-size:20px;font-weight:800;color:var(--accent)">${Number(s.total_received).toLocaleString('fr-FR')} F</div>
      </div>
      <div class="card" style="padding:12px 14px">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Total paye</div>
        <div style="font-size:20px;font-weight:800;color:var(--success)">${Number(s.total_paid).toLocaleString('fr-FR')} F</div>
      </div>
      <div class="card" style="padding:12px 14px;border-color:${balanceColor}">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">${balanceLabel}</div>
        <div style="font-size:20px;font-weight:800;color:${balanceColor}">${Math.abs(balance).toLocaleString('fr-FR')} F</div>
      </div>
      <div class="card" style="padding:12px 14px">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Paiement</div>
        <div style="font-size:14px;font-weight:600;margin-top:6px">${PAYMENT_TERMS_LABELS[s.payment_terms]||s.payment_terms}</div>
      </div>
    </div>

    ${s.notes ? `
      <div style="background:#1a1500;border:1px solid #3a3000;border-radius:8px;padding:10px 14px;margin-bottom:20px;font-size:13px;color:var(--text-secondary)">
        📝 ${s.notes}
      </div>
    ` : ''}

    <!-- Onglets -->
    <div style="display:flex;gap:6px;border-bottom:1px solid var(--border);margin-bottom:16px;flex-wrap:wrap">
      <button class="sup-tab active" data-tab="products" onclick="suppliersDetailTab('products')">📦 Produits (${s.products.length})</button>
      <button class="sup-tab" data-tab="orders" onclick="suppliersDetailTab('orders')">📋 Bons de commande (${s.purchase_orders.length})</button>
      <button class="sup-tab" data-tab="payments" onclick="suppliersDetailTab('payments')">💰 Paiements (${s.payments.length})</button>
    </div>

    <style>
      .sup-tab { background:none;border:none;padding:8px 14px;color:var(--text-secondary);font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px }
      .sup-tab:hover { color:var(--text-primary) }
      .sup-tab.active { color:var(--accent);border-bottom-color:var(--accent) }
    </style>

    <!-- Onglet PRODUITS -->
    <div id="sup-tab-products">
      ${s.products.length === 0 ? `<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:13px">Aucun produit reference chez ce fournisseur.<br><span style="font-size:11px">Ajoutez ce fournisseur depuis la fiche produit ou via un bon de reception.</span></div>` : `
        <table class="data-table">
          <thead><tr><th>Produit</th><th style="text-align:right">Prix d'achat</th><th>Notes</th><th style="text-align:center">Principal</th></tr></thead>
          <tbody>
            ${s.products.map(p => `
              <tr>
                <td><div style="font-weight:600">${p.product_name}</div><div style="font-size:11px;color:var(--text-muted)">Stock actuel : ${p.stock} ${p.unit||''}</div></td>
                <td style="text-align:right;font-weight:600">${p.unit_price ? Number(p.unit_price).toLocaleString('fr-FR') + ' F' : '—'}</td>
                <td style="color:var(--text-secondary);font-size:12px">${p.notes || '—'}</td>
                <td style="text-align:center">${p.is_primary ? '⭐' : ''}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      `}
    </div>

    <!-- Onglet BC -->
    <div id="sup-tab-orders" style="display:none">
      ${s.purchase_orders.length === 0 ? `<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:13px">Aucun bon de commande pour ce fournisseur.</div>` : `
        <table class="data-table">
          <thead><tr><th>Reference</th><th>Date</th><th>Articles</th><th>Statut</th><th style="text-align:right">Montant</th></tr></thead>
          <tbody>
            ${s.purchase_orders.map(po => {
              const status = PO_STATUS[po.status] || { label: po.status, color: 'var(--text-muted)' };
              return `<tr>
                <td style="font-weight:600;color:var(--accent)">${po.reference}</td>
                <td style="font-size:12px;color:var(--text-secondary)">${new Date(po.created_at).toLocaleDateString('fr-FR')}</td>
                <td style="font-size:12px">${po.items_count} ligne(s)</td>
                <td><span class="badge" style="background:rgba(255,255,255,0.05);color:${status.color};border:1px solid ${status.color}">${status.label}</span></td>
                <td style="text-align:right;font-weight:700">${Number(po.total).toLocaleString('fr-FR')} F</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `}
    </div>

    <!-- Onglet PAIEMENTS -->
    <div id="sup-tab-payments" style="display:none">
      ${s.payments.length === 0 ? `<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:13px">Aucun paiement enregistre.<br><span style="font-size:11px">Cliquez sur "Paiement" dans la liste des fournisseurs pour en ajouter un.</span></div>` : `
        <table class="data-table">
          <thead><tr><th>Date</th><th>Mode</th><th>Reference</th><th>BC lie</th><th style="text-align:right">Montant</th></tr></thead>
          <tbody>
            ${s.payments.map(p => `
              <tr>
                <td style="font-size:12px">${new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
                <td><span class="badge badge-info">${p.payment_method}</span></td>
                <td style="font-size:12px;color:var(--text-secondary)">${p.reference || '—'}</td>
                <td style="font-size:12px;color:var(--accent)">${p.po_reference || '—'}</td>
                <td style="text-align:right;font-weight:700;color:var(--success)">${Number(p.amount).toLocaleString('fr-FR')} F</td>
              </tr>`).join('')}
          </tbody>
        </table>
      `}
    </div>`;
}

function suppliersDetailTab(tab) {
  document.querySelectorAll('.sup-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('sup-tab-products').style.display = tab === 'products' ? 'block' : 'none';
  document.getElementById('sup-tab-orders').style.display = tab === 'orders' ? 'block' : 'none';
  document.getElementById('sup-tab-payments').style.display = tab === 'payments' ? 'block' : 'none';
}

// ── PAIEMENT ──
let suppliersPaymentTargetId = null;

async function suppliersOpenPayment(id, name) {
  suppliersPaymentTargetId = id;
  document.getElementById('suppliers-payment-name').textContent = name;
  document.getElementById('sp-amount').value = '';
  document.getElementById('sp-method').value = 'especes';
  document.getElementById('sp-reference').value = '';
  document.getElementById('sp-notes').value = '';
  document.getElementById('suppliers-payment-error').classList.add('hidden');

  // Charger les BC du fournisseur (statut received ou partial)
  const pos = await api('GET', '/api/purchase-orders?supplier_id=' + id) || [];
  const eligible = pos.filter(po => ['received', 'partial'].includes(po.status));
  const select = document.getElementById('sp-po');
  select.innerHTML = '<option value="">— Aucun BC —</option>' +
    eligible.map(po => `<option value="${po.id}">${po.reference} — ${Number(po.total).toLocaleString('fr-FR')} F</option>`).join('');

  document.getElementById('suppliers-payment-modal').classList.remove('hidden');
}

async function suppliersSubmitPayment() {
  const amount = Number(document.getElementById('sp-amount').value);
  const payment_method = document.getElementById('sp-method').value;
  const purchase_order_id = document.getElementById('sp-po').value || null;
  const reference = document.getElementById('sp-reference').value.trim();
  const notes = document.getElementById('sp-notes').value.trim();
  const err = document.getElementById('suppliers-payment-error');
  err.classList.add('hidden');

  if (!amount || amount <= 0) { err.textContent = 'Montant invalide.'; err.classList.remove('hidden'); return; }

  const btn = document.getElementById('sp-submit');
  btn.textContent = 'Enregistrement...'; btn.disabled = true;

  const result = await api('POST', '/api/supplier-payments', {
    supplier_id: suppliersPaymentTargetId,
    purchase_order_id: purchase_order_id ? Number(purchase_order_id) : null,
    amount, payment_method,
    reference: reference || null,
    notes: notes || null,
  });

  btn.disabled = false; btn.textContent = 'Enregistrer le paiement';

  if (result && result.id) {
    document.getElementById('suppliers-payment-modal').classList.add('hidden');
    alert('Paiement enregistre.');
    suppliersPaymentTargetId = null;
    await suppliersLoad();
  } else {
    err.textContent = (result && result.error) || 'Erreur lors de l\'enregistrement.';
    err.classList.remove('hidden');
  }
}
