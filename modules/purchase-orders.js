/**
 * modules/purchase-orders.js — U TIAM POS — Module Bons de commande
 * Charte KANIENE — theme sombre
 *
 * Fonctionnalites :
 * - Liste filtrable par statut
 * - Creation BC : fournisseur + produits (qte + prix achat)
 * - Cycle de vie : Brouillon -> Envoye -> Recu/Partiel -> Solde
 * - Telechargement PDF
 * - Bouton "Receptionner ce BC" pour les BC en statut Envoye
 */

let poList = [];
let poFilter = 'all';  // all | draft | sent | received | partial | settled | cancelled
let poProducts = [];    // cache produits pour le formulaire
let poSuppliers = [];   // cache fournisseurs actifs

const PO_STATUS = {
  draft: { label: 'Brouillon', color: 'var(--text-muted)', bg: '#1e1e1e' },
  sent: { label: 'Envoye', color: 'var(--info)', bg: '#0D1F2D' },
  received: { label: 'Recu', color: 'var(--success)', bg: '#102A18' },
  partial: { label: 'Partiel', color: 'var(--warning)', bg: '#2A1F05' },
  settled: { label: 'Solde', color: 'var(--accent)', bg: '#2a2000' },
  cancelled: { label: 'Annule', color: 'var(--danger)', bg: '#2C1414' },
};

async function renderPurchaseOrders(main) {
  main.innerHTML = `
    <div style="max-width:1280px;margin:0 auto">

      <!-- En-tete -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:20px;font-weight:700">Bons de commande</div>
          <div style="color:var(--text-secondary);font-size:13px;margin-top:2px" id="po-count">Chargement...</div>
        </div>
        <button class="btn btn-primary" onclick="poOpenForm()">+ Nouveau bon de commande</button>
      </div>

      <!-- Filtres statut -->
      <div class="card" style="padding:14px 18px;margin-bottom:16px">
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <div style="color:var(--text-muted);font-size:12px;margin-right:6px;text-transform:uppercase;letter-spacing:0.05em">Statut :</div>
          <button class="po-filter-btn" data-filter="all" onclick="poSetFilter('all')">Tous</button>
          <button class="po-filter-btn" data-filter="draft" onclick="poSetFilter('draft')">Brouillons</button>
          <button class="po-filter-btn" data-filter="sent" onclick="poSetFilter('sent')">Envoyes</button>
          <button class="po-filter-btn" data-filter="received" onclick="poSetFilter('received')">Recus</button>
          <button class="po-filter-btn" data-filter="partial" onclick="poSetFilter('partial')">Partiels</button>
          <button class="po-filter-btn" data-filter="settled" onclick="poSetFilter('settled')">Soldes</button>
          <button class="po-filter-btn" data-filter="cancelled" onclick="poSetFilter('cancelled')">Annules</button>
        </div>
      </div>

      <!-- Liste -->
      <div class="card" style="padding:0;overflow:hidden">
        <div id="po-list" style="overflow-x:auto">
          <div style="padding:40px;text-align:center;color:var(--text-secondary)">Chargement...</div>
        </div>
      </div>
    </div>

    <style>
      .po-filter-btn {
        background: transparent;
        color: var(--text-secondary);
        border: 1px solid var(--border);
        padding: 6px 14px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
      }
      .po-filter-btn:hover { background: var(--bg-elevated); color: var(--text-primary); }
      .po-filter-btn.active { background: var(--accent); color: #000; border-color: var(--accent); }
    </style>

    <!-- MODAL : Formulaire BC -->
    <div id="po-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:900px">
        <div class="modal-title">Nouveau bon de commande</div>

        <div class="form-grid">
          <div>
            <label class="form-label">Fournisseur *</label>
            <select id="po-supplier" class="input">
              <option value="">— Choisir un fournisseur —</option>
            </select>
          </div>
          <div>
            <label class="form-label">Date de livraison prevue</label>
            <input id="po-expected-date" type="date" class="input" />
          </div>
          <div class="full">
            <label class="form-label">Notes / Instructions au fournisseur</label>
            <textarea id="po-notes" class="input" rows="2" placeholder="Ex : Livraison matinale, commander en cartons..."></textarea>
          </div>
        </div>

        <!-- Articles -->
        <div style="margin-top:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-size:14px;font-weight:700">Articles a commander</div>
            <button class="btn btn-secondary btn-sm" onclick="poAddItem()">+ Ajouter un produit</button>
          </div>
          <div id="po-items" style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
            <div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">
              Aucun article. Cliquez sur "+ Ajouter un produit" pour commencer.
            </div>
          </div>
        </div>

        <!-- Total -->
        <div style="display:flex;justify-content:flex-end;align-items:center;gap:14px;margin-top:14px;padding:14px;background:var(--bg-elevated);border-radius:8px">
          <div style="font-size:13px;color:var(--text-secondary)">TOTAL :</div>
          <div style="font-size:22px;font-weight:800;color:var(--accent)" id="po-total">0 F</div>
        </div>

        <div id="po-form-error" class="form-error hidden"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="poCloseForm()">Annuler</button>
          <button class="btn btn-primary" id="po-submit-btn" onclick="poSubmitForm()">Creer le brouillon</button>
        </div>
      </div>
    </div>

    <!-- MODAL : Detail BC -->
    <div id="po-detail-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:900px">
        <div id="po-detail-content">
          <div style="text-align:center;padding:40px;color:var(--text-secondary)">Chargement...</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('po-detail-modal').classList.add('hidden')">Fermer</button>
        </div>
      </div>
    </div>`;

  poUpdateFilterButtons();
  await poLoad();
}

async function poLoad() {
  // Charger les fournisseurs actifs et les produits en parallele
  const [polist, suppliers, products] = await Promise.all([
    api('GET', '/api/purchase-orders'),
    api('GET', '/api/suppliers'),  // actifs uniquement par defaut
    api('GET', '/api/products'),
  ]);

  poList = polist || [];
  poSuppliers = suppliers || [];
  poProducts = products || [];

  const c = document.getElementById('po-count');
  if (c) c.textContent = poList.length + ' bon' + (poList.length>1?'s':'') + ' de commande au total';

  poRenderList();
}

function poSetFilter(filter) {
  poFilter = filter;
  poUpdateFilterButtons();
  poRenderList();
}

function poUpdateFilterButtons() {
  document.querySelectorAll('.po-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === poFilter);
  });
}

function poRenderList() {
  const el = document.getElementById('po-list');
  if (!el) return;
  const filtered = poFilter === 'all' ? poList : poList.filter(p => p.status === poFilter);

  if (filtered.length === 0) {
    el.innerHTML = `<div style="padding:48px;text-align:center;color:var(--text-secondary)">
      ${poFilter === 'all' ? 'Aucun bon de commande.<br><span style="font-size:12px">Cliquez sur "+ Nouveau bon de commande" pour commencer.</span>' : 'Aucun BC dans ce statut.'}
    </div>`;
    return;
  }

  el.innerHTML = `<table class="data-table">
    <thead>
      <tr>
        <th>Reference</th>
        <th>Fournisseur</th>
        <th>Date</th>
        <th>Articles</th>
        <th>Statut</th>
        <th style="text-align:right">Montant</th>
        <th style="width:280px">Actions</th>
      </tr>
    </thead>
    <tbody>
      ${filtered.map(po => poRenderRow(po)).join('')}
    </tbody>
  </table>`;
}

function poRenderRow(po) {
  const status = PO_STATUS[po.status] || { label: po.status, color: 'var(--text-muted)', bg: '#1e1e1e' };
  const date = new Date(po.created_at);
  const total = Number(po.total || 0);

  // Boutons d'action selon le statut
  let actionButtons = `<button class="btn btn-edit" onclick="poShowDetail(${po.id})">Detail</button>`;
  actionButtons += `<button class="btn btn-edit" onclick="poDownloadPDF(${po.id})">📄 PDF</button>`;

  if (po.status === 'draft') {
    actionButtons += `<button class="btn btn-edit" onclick="poChangeStatus(${po.id}, 'sent', '${po.reference}')">📤 Envoyer</button>`;
    actionButtons += `<button class="btn btn-danger" onclick="poDelete(${po.id}, '${po.reference}')" title="Supprimer">✕</button>`;
  } else if (po.status === 'sent') {
    actionButtons += `<button class="btn btn-edit" onclick="poOpenReception(${po.id}, '${po.reference}')">📦 Receptionner</button>`;
    actionButtons += `<button class="btn btn-danger" onclick="poChangeStatus(${po.id}, 'cancelled', '${po.reference}')" title="Annuler">Annuler</button>`;
  } else if (po.status === 'partial') {
    actionButtons += `<button class="btn btn-edit" onclick="poOpenReception(${po.id}, '${po.reference}')">📦 Receptionner</button>`;
  }

  return `<tr>
    <td><div style="font-weight:700;color:var(--accent)">${po.reference}</div></td>
    <td>
      <div style="font-weight:600">${po.supplier_name}</div>
      <div style="font-size:11px;color:var(--text-muted)">Par ${po.user_name}</div>
    </td>
    <td style="font-size:12px;color:var(--text-secondary)">${date.toLocaleDateString('fr-FR')}</td>
    <td style="font-size:12px">${po.items_count} ligne(s)</td>
    <td><span class="badge" style="background:${status.bg};color:${status.color};border:1px solid ${status.color}">${status.label}</span></td>
    <td style="text-align:right;font-weight:700;color:var(--accent)">${total.toLocaleString('fr-FR')} F</td>
    <td>
      <div style="display:flex;gap:4px;flex-wrap:wrap">${actionButtons}</div>
    </td>
  </tr>`;
}

// ── FORMULAIRE CREATION ──
function poOpenForm() {
  // Remplir le sélecteur fournisseur
  const supSelect = document.getElementById('po-supplier');
  supSelect.innerHTML = '<option value="">— Choisir un fournisseur —</option>' +
    poSuppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

  document.getElementById('po-expected-date').value = '';
  document.getElementById('po-notes').value = '';
  document.getElementById('po-items').innerHTML = `
    <div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">
      Aucun article. Cliquez sur "+ Ajouter un produit" pour commencer.
    </div>`;
  document.getElementById('po-total').textContent = '0 F';
  document.getElementById('po-form-error').classList.add('hidden');
  document.getElementById('po-modal').classList.remove('hidden');
}

function poCloseForm() {
  document.getElementById('po-modal').classList.add('hidden');
}

let poItemCounter = 0;
function poAddItem() {
  const container = document.getElementById('po-items');
  // Vide le placeholder si presence
  if (container.querySelector('div[style*="Aucun article"]')) {
    container.innerHTML = '';
  }
  poItemCounter++;
  const rowId = 'po-item-' + poItemCounter;
  const productOptions = '<option value="">— Choisir un produit —</option>' +
    poProducts.map(p => `<option value="${p.id}" data-name="${p.name}" data-buy-price="${p.buy_price || ''}">${p.name}${p.unit ? ' ('+p.unit+')' : ''}</option>`).join('');

  const row = document.createElement('div');
  row.id = rowId;
  row.style.cssText = 'display:grid;grid-template-columns:2fr 90px 130px 130px 40px;gap:8px;padding:10px;border-bottom:1px solid var(--border);align-items:center';
  row.innerHTML = `
    <select class="input po-item-product" onchange="poOnProductChange(this)">${productOptions}</select>
    <input type="number" class="input po-item-qty" placeholder="Qte" min="1" value="1" onchange="poRecalcTotal()" oninput="poRecalcTotal()" />
    <input type="number" class="input po-item-price" placeholder="Prix unit. (F)" min="0" step="50" onchange="poRecalcTotal()" oninput="poRecalcTotal()" />
    <div class="po-item-line-total" style="text-align:right;font-weight:600;color:var(--accent)">0 F</div>
    <button class="btn btn-danger" style="padding:6px 8px" onclick="document.getElementById('${rowId}').remove(); poRecalcTotal();" title="Retirer">✕</button>
  `;
  container.appendChild(row);
}

function poOnProductChange(select) {
  // Pre-remplir le prix d'achat si disponible
  const opt = select.options[select.selectedIndex];
  if (opt && opt.dataset.buyPrice) {
    const row = select.closest('div');
    const priceInput = row.querySelector('.po-item-price');
    if (priceInput && !priceInput.value) priceInput.value = opt.dataset.buyPrice;
  }
  poRecalcTotal();
}

function poRecalcTotal() {
  let total = 0;
  document.querySelectorAll('#po-items > div').forEach(row => {
    const qty = Number(row.querySelector('.po-item-qty')?.value || 0);
    const price = Number(row.querySelector('.po-item-price')?.value || 0);
    const lineTotal = qty * price;
    const lineTotalEl = row.querySelector('.po-item-line-total');
    if (lineTotalEl) lineTotalEl.textContent = lineTotal.toLocaleString('fr-FR') + ' F';
    total += lineTotal;
  });
  document.getElementById('po-total').textContent = total.toLocaleString('fr-FR') + ' F';
}

async function poSubmitForm() {
  const supplier_id = document.getElementById('po-supplier').value;
  const expected_date = document.getElementById('po-expected-date').value || null;
  const notes = document.getElementById('po-notes').value.trim() || null;
  const err = document.getElementById('po-form-error');
  err.classList.add('hidden');

  if (!supplier_id) { err.textContent = 'Veuillez choisir un fournisseur.'; err.classList.remove('hidden'); return; }

  // Collecter les items
  const items = [];
  document.querySelectorAll('#po-items > div').forEach(row => {
    const productId = row.querySelector('.po-item-product')?.value;
    const qty = Number(row.querySelector('.po-item-qty')?.value || 0);
    const price = Number(row.querySelector('.po-item-price')?.value || 0);
    if (productId && qty > 0) {
      items.push({ product_id: Number(productId), quantity_ordered: qty, unit_price: price });
    }
  });

  if (items.length === 0) { err.textContent = 'Veuillez ajouter au moins un article valide.'; err.classList.remove('hidden'); return; }

  const btn = document.getElementById('po-submit-btn');
  btn.textContent = 'Creation...'; btn.disabled = true;

  const result = await api('POST', '/api/purchase-orders', {
    supplier_id: Number(supplier_id),
    items,
    expected_date,
    notes,
  });

  btn.disabled = false; btn.textContent = 'Creer le brouillon';

  if (result && result.id) {
    document.getElementById('po-modal').classList.add('hidden');
    alert('Bon de commande ' + result.reference + ' cree en brouillon.');
    await poLoad();
  } else {
    err.textContent = (result && result.error) || 'Erreur lors de la creation.';
    err.classList.remove('hidden');
  }
}

// ── DETAIL ──
async function poShowDetail(id) {
  document.getElementById('po-detail-modal').classList.remove('hidden');
  document.getElementById('po-detail-content').innerHTML =
    '<div style="text-align:center;padding:40px;color:var(--text-secondary)">Chargement...</div>';

  const po = await api('GET', '/api/purchase-orders/' + id);
  if (!po) {
    document.getElementById('po-detail-content').innerHTML =
      '<div style="color:var(--danger);padding:20px">Erreur : BC introuvable.</div>';
    return;
  }
  poRenderDetail(po);
}

function poRenderDetail(po) {
  const status = PO_STATUS[po.status] || { label: po.status, color: 'var(--text-muted)', bg: '#1e1e1e' };
  const PAYMENT_TERMS = { comptant: 'Comptant', '30j': '30 jours', '60j': '60 jours', '90j': '90 jours' };
  const total = Number(po.total || 0);

  document.getElementById('po-detail-content').innerHTML = `
    <!-- En-tete -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:14px">
      <div>
        <div style="font-size:22px;font-weight:800;color:var(--accent)">${po.reference}</div>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">
          Cree le ${new Date(po.created_at).toLocaleString('fr-FR')} par ${po.user_name}
        </div>
        ${po.sent_at ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">Envoye le ${new Date(po.sent_at).toLocaleString('fr-FR')}</div>` : ''}
        ${po.received_at ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">Receptionne le ${new Date(po.received_at).toLocaleString('fr-FR')}</div>` : ''}
      </div>
      <div style="text-align:right">
        <span class="badge" style="background:${status.bg};color:${status.color};border:1px solid ${status.color};font-size:13px;padding:6px 14px">${status.label}</span>
      </div>
    </div>

    <!-- Bloc fournisseur + livraison -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
      <div class="card" style="padding:14px 18px">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Fournisseur</div>
        <div style="font-weight:700;font-size:15px">${po.supplier_name}</div>
        ${po.supplier_phone ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">📞 ${po.supplier_phone}</div>` : ''}
        ${po.supplier_email ? `<div style="font-size:12px;color:var(--text-secondary)">✉ ${po.supplier_email}</div>` : ''}
        ${po.supplier_address ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">📍 ${po.supplier_address}</div>` : ''}
        <div style="margin-top:8px"><span class="badge badge-info">${PAYMENT_TERMS[po.payment_terms] || po.payment_terms}</span></div>
      </div>
      <div class="card" style="padding:14px 18px">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Livraison prevue</div>
        <div style="font-weight:700;font-size:15px">${po.expected_date ? new Date(po.expected_date).toLocaleDateString('fr-FR') : '— non precise —'}</div>
        ${po.notes ? `<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-top:14px;margin-bottom:6px">Notes</div><div style="font-size:13px">${po.notes}</div>` : ''}
      </div>
    </div>

    <!-- Articles -->
    <div style="font-size:14px;font-weight:700;margin-bottom:10px">Articles (${po.items.length})</div>
    <table class="data-table" style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <thead>
        <tr>
          <th>Produit</th>
          <th style="text-align:right">Qte commandee</th>
          <th style="text-align:right">Qte recue</th>
          <th style="text-align:right">Prix unit.</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${po.items.map(item => {
          const qOrdered = Number(item.quantity_ordered);
          const qReceived = Number(item.quantity_received || 0);
          const recColor = qReceived === 0 ? 'var(--text-muted)' : (qReceived >= qOrdered ? 'var(--success)' : 'var(--warning)');
          return `<tr>
            <td>${item.product_name}</td>
            <td style="text-align:right;font-weight:600">${qOrdered} ${item.unit || ''}</td>
            <td style="text-align:right;font-weight:600;color:${recColor}">${qReceived} ${item.unit || ''}</td>
            <td style="text-align:right">${Number(item.unit_price || 0).toLocaleString('fr-FR')} F</td>
            <td style="text-align:right;font-weight:700">${Number(item.total).toLocaleString('fr-FR')} F</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>

    <!-- Total -->
    <div style="display:flex;justify-content:flex-end;align-items:center;gap:14px;margin-top:14px;padding:14px;background:var(--bg-elevated);border-radius:8px">
      <div style="font-size:13px;color:var(--text-secondary)">TOTAL :</div>
      <div style="font-size:22px;font-weight:800;color:var(--accent)">${total.toLocaleString('fr-FR')} F</div>
    </div>

    <!-- Actions -->
    <div style="display:flex;gap:8px;margin-top:20px;flex-wrap:wrap;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="poDownloadPDF(${po.id})">📄 Telecharger PDF</button>
      ${po.status === 'draft' ? `<button class="btn btn-primary" onclick="poChangeStatus(${po.id}, 'sent', '${po.reference}'); document.getElementById('po-detail-modal').classList.add('hidden')">📤 Marquer comme envoye</button>` : ''}
      ${po.status === 'sent' || po.status === 'partial' ? `<button class="btn btn-primary" onclick="document.getElementById('po-detail-modal').classList.add('hidden'); poOpenReception(${po.id}, '${po.reference}')">📦 Receptionner</button>` : ''}
    </div>
  `;
}

// ── PDF ──
async function poDownloadPDF(id) {
  const token = localStorage.getItem('utiam_token');
  try {
    const res = await fetch('/api/purchase-orders/' + id + '/pdf', {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (!res.ok) { alert('Erreur lors du telechargement du PDF.'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Récupérer la référence depuis la liste
    const po = poList.find(p => p.id === id);
    a.download = (po?.reference || 'BC') + '.pdf';
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('Erreur reseau : ' + e.message);
  }
}

// ── CHANGEMENT STATUT ──
async function poChangeStatus(id, status, reference) {
  const STATUS_LABELS = { sent: 'envoyer', cancelled: 'annuler' };
  const verb = STATUS_LABELS[status] || 'changer le statut de';
  if (!confirm('Voulez-vous vraiment ' + verb + ' "' + reference + '" ?')) return;

  const result = await api('PUT', '/api/purchase-orders/' + id + '/status', { status });
  if (result && result.id) {
    await poLoad();
  } else {
    alert((result && result.error) || 'Erreur lors du changement de statut.');
  }
}

// ── SUPPRESSION (brouillons uniquement) ──
async function poDelete(id, reference) {
  if (!confirm('Supprimer le brouillon "' + reference + '" ?\nAction irreversible.')) return;

  try {
    const token = localStorage.getItem('utiam_token');
    const res = await fetch('/api/purchase-orders/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (res.status === 409) {
      const data = await res.json();
      alert(data.error || 'Suppression impossible.');
      return;
    }
    if (!res.ok) { alert('Erreur lors de la suppression.'); return; }
    await poLoad();
  } catch (e) {
    alert('Erreur reseau : ' + e.message);
  }
}

// ── RECEPTION D'UN BC ──
async function poOpenReception(poId, reference) {
  // Charger le detail complet du BC
  const po = await api('GET', '/api/purchase-orders/' + poId);
  if (!po) { alert('BC introuvable.'); return; }

  // Construire une modal de reception (similaire au bon de réception classique mais lié au BC)
  let modal = document.getElementById('po-reception-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'po-reception-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:900px">
      <div class="modal-title">Reception du BC ${po.reference}</div>

      <div style="background:#0D1F2D;border:1px solid #1d3552;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:var(--info)">
        Fournisseur : <strong>${po.supplier_name}</strong> · Saisissez les quantites effectivement recues.
      </div>

      <table class="data-table" style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <thead>
          <tr>
            <th>Produit</th>
            <th style="text-align:right">Commande</th>
            <th style="text-align:right">Deja recu</th>
            <th style="text-align:right;width:130px">Recu aujourd'hui</th>
            <th style="text-align:right;width:130px">Prix d'achat</th>
          </tr>
        </thead>
        <tbody id="po-reception-items">
          ${po.items.map(item => {
            const qOrdered = Number(item.quantity_ordered);
            const qReceived = Number(item.quantity_received || 0);
            const qRemaining = Math.max(0, qOrdered - qReceived);
            return `<tr data-product-id="${item.product_id}">
              <td>${item.product_name}</td>
              <td style="text-align:right">${qOrdered} ${item.unit || ''}</td>
              <td style="text-align:right;color:${qReceived>0?'var(--success)':'var(--text-muted)'}">${qReceived} ${item.unit || ''}</td>
              <td style="text-align:right">
                <input type="number" class="input po-rec-qty" min="0" max="${qOrdered}" value="${qRemaining}" style="text-align:right" />
              </td>
              <td style="text-align:right">
                <input type="number" class="input po-rec-price" min="0" step="50" value="${item.unit_price || ''}" style="text-align:right" />
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>

      <div style="margin-top:16px">
        <label class="form-label">Note (optionnelle)</label>
        <input id="po-rec-note" type="text" class="input" placeholder="Ex : Livraison partielle, manque 2 caisses..." />
      </div>

      <div id="po-rec-error" class="form-error hidden"></div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="document.getElementById('po-reception-modal').remove()">Annuler</button>
        <button class="btn btn-primary" id="po-rec-submit" onclick="poSubmitReception(${po.id}, ${po.supplier_id})">Valider la reception</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function poSubmitReception(poId, supplierId) {
  const err = document.getElementById('po-rec-error');
  err.classList.add('hidden');

  // Collecter les items
  const items = [];
  document.querySelectorAll('#po-reception-items tr').forEach(row => {
    const productId = Number(row.dataset.productId);
    const qty = Number(row.querySelector('.po-rec-qty').value || 0);
    const price = Number(row.querySelector('.po-rec-price').value || 0);
    if (productId && qty > 0) {
      items.push({ product_id: productId, quantity: qty, unit_price: price || null });
    }
  });

  if (items.length === 0) {
    err.textContent = 'Aucun article a receptionner. Veuillez saisir au moins une quantite > 0.';
    err.classList.remove('hidden');
    return;
  }

  const reason = document.getElementById('po-rec-note').value.trim() || null;

  const btn = document.getElementById('po-rec-submit');
  btn.textContent = 'Reception en cours...'; btn.disabled = true;

  const result = await api('POST', '/api/stock/deliveries', {
    items, reason,
    supplier_id: supplierId,
    purchase_order_id: poId,
  });

  btn.disabled = false; btn.textContent = 'Valider la reception';

  if (result && result.success) {
    document.getElementById('po-reception-modal').remove();
    alert('Reception enregistree.\nReference : ' + result.batch_ref + '\nLe statut du BC a ete mis a jour.');
    await poLoad();
  } else {
    err.textContent = (result && result.error) || 'Erreur lors de la reception.';
    err.classList.remove('hidden');
  }
}
