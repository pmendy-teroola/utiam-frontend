/**
 * modules/stock.js — U TIAM POS — Module Stock
 * Charte KANIENE — theme sombre
 *
 * Fonctionnalites :
 * - Vue d'ensemble : alertes (rupture / stock bas / expiration)
 * - Liste des produits avec stock actuel
 * - Reception simple (1 produit)
 * - Bon de reception (plusieurs produits) avec selecteur fournisseur + import depuis BC
 * - Ajustement manuel
 * - Historique des mouvements filtrables
 */

let stockProducts = [];
let stockSummary = { out_of_stock: [], low_stock: [], expiring_soon: [], expired: [] };
let stockMovements = [];
let stockTab = 'overview';    // overview | history
let stockMovementFilter = { type: '', product_id: '', from: '', to: '' };

// Etat du bon de reception en cours d'edition
let deliveryItems = [];
let deliverySuppliers = [];     // cache fournisseurs actifs
let deliveryAvailablePOs = [];  // BC eligibles (sent/partial) pour le fournisseur selectionne

async function renderStock(main) {
  main.innerHTML = `
    <div style="max-width:1200px;margin:0 auto">

      <!-- En-tete -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:20px;font-weight:700">Gestion du Stock</div>
          <div style="color:var(--text-secondary);font-size:13px;margin-top:2px">Mouvements, receptions, alertes</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary" onclick="stockOpenAdjust()">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6V4m0 16v-2m6-6h2M4 12h2m11.314-6.314l1.414-1.414M4.272 19.728l1.414-1.414M18.728 19.728l-1.414-1.414M5.686 5.686L4.272 4.272"/></svg>
            Ajustement
          </button>
          <button class="btn btn-secondary" onclick="stockOpenSimpleReceipt()">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            Reception rapide
          </button>
          <button class="btn btn-primary" onclick="stockOpenDeliveryNote()">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Bon de reception
          </button>
        </div>
      </div>

      <!-- Onglets -->
      <div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid var(--border)">
        <button class="stock-tab" data-tab="overview" onclick="stockSetTab('overview')">Vue d'ensemble</button>
        <button class="stock-tab" data-tab="history"  onclick="stockSetTab('history')">Historique</button>
      </div>

      <div id="stock-content"></div>
    </div>

    <!-- MODAL : Mouvement (reception simple / ajustement) -->
    <div id="stock-movement-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:520px">
        <div class="modal-title" id="stock-movement-title">Mouvement de stock</div>
        <div id="stock-movement-content"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('stock-movement-modal').classList.add('hidden')">Annuler</button>
          <button class="btn btn-primary" id="stock-movement-submit" onclick="stockSubmitMovement()">Valider</button>
        </div>
      </div>
    </div>

    <!-- MODAL : Bon de reception -->
    <div id="stock-delivery-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:900px">
        <div class="modal-title">Bon de reception</div>
        <div id="stock-delivery-content"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="stockCloseDelivery()">Annuler</button>
          <button class="btn btn-primary" id="stock-delivery-submit" onclick="stockSubmitDelivery()" disabled>Receptionner</button>
        </div>
      </div>
    </div>

    <style>
      .stock-tab {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        padding: 10px 16px;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
      }
      .stock-tab:hover { color: var(--text-primary); }
      .stock-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

      .stock-alert-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 16px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .stock-alert-card:hover { border-color: var(--accent); }

      .stock-alert-card.danger { border-color: #5a2020; background: #1a0a0a; }
      .stock-alert-card.warning { border-color: #5a4a10; background: #1a1500; }
      .stock-alert-card.info { border-color: #1d3552; background: #0a1a2a; }

      .stock-mov-badge {
        display: inline-flex; align-items: center;
        padding: 3px 8px; border-radius: 6px;
        font-size: 11px; font-weight: 600;
      }
      .mov-sale       { background: #2C1414; color: var(--danger); }
      .mov-restock    { background: #102A18; color: var(--success); }
      .mov-delivery   { background: #102A18; color: var(--success); }
      .mov-adjustment { background: #2A1F05; color: var(--warning); }
      .mov-inventory  { background: #0D1F2D; color: var(--info); }
    </style>`;

  stockUpdateTabButtons();
  await stockLoadData();
}

function stockSetTab(tab) {
  stockTab = tab;
  stockUpdateTabButtons();
  stockRender();
}

function stockUpdateTabButtons() {
  document.querySelectorAll('.stock-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === stockTab);
  });
}

async function stockLoadData() {
  const [products, summary] = await Promise.all([
    api('GET', '/api/products?status=active'),
    api('GET', '/api/stock/summary'),
  ]);
  stockProducts = products || [];
  stockSummary = summary || { out_of_stock: [], low_stock: [], expiring_soon: [], expired: [] };
  if (stockTab === 'history') await stockLoadMovements();
  stockRender();
}

async function stockLoadMovements() {
  const params = [];
  if (stockMovementFilter.type)       params.push('type=' + encodeURIComponent(stockMovementFilter.type));
  if (stockMovementFilter.product_id) params.push('product_id=' + encodeURIComponent(stockMovementFilter.product_id));
  if (stockMovementFilter.from)       params.push('from=' + encodeURIComponent(stockMovementFilter.from));
  if (stockMovementFilter.to)         params.push('to=' + encodeURIComponent(stockMovementFilter.to));
  const qs = params.length ? '?' + params.join('&') : '';
  stockMovements = await api('GET', '/api/stock/movements' + qs) || [];
}

function stockRender() {
  if (stockTab === 'overview') stockRenderOverview();
  else stockRenderHistory();
}

// ── VUE D'ENSEMBLE ──
function stockRenderOverview() {
  const el = document.getElementById('stock-content');

  const totalAlerts = stockSummary.out_of_stock.length + stockSummary.low_stock.length + stockSummary.expired.length + stockSummary.expiring_soon.length;

  el.innerHTML = `
    <!-- Cartes alertes -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:24px">
      <div class="stock-alert-card ${stockSummary.out_of_stock.length>0?'danger':''}">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <div style="font-size:24px">🔴</div>
          <div style="flex:1">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">En rupture</div>
            <div style="font-size:24px;font-weight:800;color:${stockSummary.out_of_stock.length>0?'var(--danger)':'var(--text-muted)'}">${stockSummary.out_of_stock.length}</div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--text-secondary)">Stock = 0</div>
      </div>

      <div class="stock-alert-card ${stockSummary.low_stock.length>0?'warning':''}">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <div style="font-size:24px">🟡</div>
          <div style="flex:1">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Stock bas</div>
            <div style="font-size:24px;font-weight:800;color:${stockSummary.low_stock.length>0?'var(--warning)':'var(--text-muted)'}">${stockSummary.low_stock.length}</div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--text-secondary)">Sous le seuil minimum</div>
      </div>

      <div class="stock-alert-card ${stockSummary.expired.length>0?'danger':''}">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <div style="font-size:24px">⚠</div>
          <div style="flex:1">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Expires</div>
            <div style="font-size:24px;font-weight:800;color:${stockSummary.expired.length>0?'var(--danger)':'var(--text-muted)'}">${stockSummary.expired.length}</div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--text-secondary)">Date depassee</div>
      </div>

      <div class="stock-alert-card ${stockSummary.expiring_soon.length>0?'info':''}">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <div style="font-size:24px">⏰</div>
          <div style="flex:1">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">A surveiller</div>
            <div style="font-size:24px;font-weight:800;color:${stockSummary.expiring_soon.length>0?'var(--info)':'var(--text-muted)'}">${stockSummary.expiring_soon.length}</div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--text-secondary)">Expirent dans 30 jours</div>
      </div>
    </div>

    ${totalAlerts > 0 ? `
      <!-- Sections alertes detaillees -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:16px;margin-bottom:24px">
        ${stockSummary.out_of_stock.length > 0 ? stockRenderAlertSection('🔴 En rupture', stockSummary.out_of_stock, 'danger', p => p.unit||'pcs') : ''}
        ${stockSummary.low_stock.length > 0 ? stockRenderAlertSection('🟡 Stock bas', stockSummary.low_stock, 'warning', p => `${p.stock} ${p.unit||'pcs'} (min ${p.min_stock})`) : ''}
        ${stockSummary.expired.length > 0 ? stockRenderAlertSection('⚠ Expires', stockSummary.expired, 'danger', p => `${p.stock} ${p.unit||'pcs'} · expire le ${new Date(p.expiry_date).toLocaleDateString('fr-FR')}`) : ''}
        ${stockSummary.expiring_soon.length > 0 ? stockRenderAlertSection('⏰ A surveiller', stockSummary.expiring_soon, 'info', p => `${p.stock} ${p.unit||'pcs'} · expire le ${new Date(p.expiry_date).toLocaleDateString('fr-FR')}`) : ''}
      </div>
    ` : '<div class="card" style="text-align:center;padding:30px;color:var(--success);margin-bottom:24px">✓ Aucune alerte de stock — tout va bien !</div>'}

    <!-- Vue stock complete -->
    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:15px;font-weight:700">Stock complet</div>
          <div style="font-size:12px;color:var(--text-muted)">${stockProducts.length} produits actifs</div>
        </div>
        <input type="text" id="stock-search" class="input" placeholder="Rechercher..." style="max-width:280px;padding:6px 12px;font-size:13px" oninput="stockFilterTable()" />
      </div>
      <div style="overflow-x:auto" id="stock-table-wrap">
        ${stockRenderTable(stockProducts)}
      </div>
    </div>`;
}

function stockRenderAlertSection(title, items, variant, valueFn) {
  return `
    <div class="card stock-alert-card ${variant}" style="padding:14px 16px">
      <div style="font-weight:700;margin-bottom:10px;font-size:14px">${title} (${items.length})</div>
      <div style="max-height:200px;overflow-y:auto">
        ${items.slice(0, 50).map(p => `
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
            <div style="font-weight:600">${p.name}</div>
            <div style="color:var(--text-secondary);font-size:12px">${valueFn(p)}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function stockRenderTable(list) {
  if (list.length === 0) return '<div style="padding:30px;text-align:center;color:var(--text-secondary)">Aucun produit.</div>';
  return `<table class="data-table">
    <thead>
      <tr><th>Produit</th><th>Categorie</th><th>Stock</th><th>Seuil min</th><th>Valeur stock</th><th style="width:120px">Actions</th></tr>
    </thead>
    <tbody>
      ${list.map(p => {
        const stock = Number(p.stock);
        const min = Number(p.min_stock);
        const valeur = stock * Number(p.buy_price || p.sell_price || 0);
        let bc, bl;
        if (stock === 0) { bc='badge-danger'; bl='Rupture'; }
        else if (stock <= min) { bc='badge-warning'; bl='Stock bas'; }
        else { bc='badge-success'; bl='OK'; }
        return `<tr>
          <td><div style="font-weight:600">${p.name}</div><div style="font-size:11px;color:var(--text-muted)">${p.barcode||''}</div></td>
          <td style="color:var(--text-secondary)">${p.category_name||'—'}</td>
          <td><span class="badge ${bc}" style="margin-right:6px">${bl}</span><strong>${stock}</strong> <span style="color:var(--text-muted)">${p.unit||'pcs'}</span></td>
          <td style="color:var(--text-secondary)">${min} ${p.unit||'pcs'}</td>
          <td style="color:var(--accent);font-weight:600">${valeur.toLocaleString('fr-FR')} F</td>
          <td>
            <button class="btn btn-edit" onclick="stockOpenSimpleReceiptFor(${p.id})" title="Reception">+ Recevoir</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

function stockFilterTable() {
  const q = (document.getElementById('stock-search').value || '').toLowerCase();
  const filtered = q ? stockProducts.filter(p =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.barcode || '').toLowerCase().includes(q) ||
    (p.brand || '').toLowerCase().includes(q) ||
    (p.category_name || '').toLowerCase().includes(q)
  ) : stockProducts;
  document.getElementById('stock-table-wrap').innerHTML = stockRenderTable(filtered);
}

// ── HISTORIQUE ──
async function stockRenderHistory() {
  if (stockMovements.length === 0) {
    await stockLoadMovements();
  }
  const el = document.getElementById('stock-content');

  el.innerHTML = `
    <!-- Filtres -->
    <div class="card" style="padding:14px 18px;margin-bottom:16px">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
        <div>
          <label class="form-label">Type</label>
          <select class="input" id="filter-type" onchange="stockApplyFilter()">
            <option value="">Tous</option>
            <option value="sale" ${stockMovementFilter.type==='sale'?'selected':''}>Ventes</option>
            <option value="restock" ${stockMovementFilter.type==='restock'?'selected':''}>Receptions rapides</option>
            <option value="delivery" ${stockMovementFilter.type==='delivery'?'selected':''}>Bons de reception</option>
            <option value="adjustment" ${stockMovementFilter.type==='adjustment'?'selected':''}>Ajustements</option>
            <option value="inventory" ${stockMovementFilter.type==='inventory'?'selected':''}>Inventaires</option>
          </select>
        </div>
        <div>
          <label class="form-label">Produit</label>
          <select class="input" id="filter-product" onchange="stockApplyFilter()">
            <option value="">Tous</option>
            ${stockProducts.map(p => `<option value="${p.id}" ${stockMovementFilter.product_id==p.id?'selected':''}>${p.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Du</label>
          <input type="date" class="input" id="filter-from" value="${stockMovementFilter.from}" onchange="stockApplyFilter()" />
        </div>
        <div>
          <label class="form-label">Au</label>
          <input type="date" class="input" id="filter-to" value="${stockMovementFilter.to}" onchange="stockApplyFilter()" />
        </div>
      </div>
      ${(stockMovementFilter.type || stockMovementFilter.product_id || stockMovementFilter.from || stockMovementFilter.to) ? `
        <button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="stockResetFilter()">Reinitialiser</button>
      ` : ''}
    </div>

    <!-- Liste -->
    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:14px 20px;border-bottom:1px solid var(--border)">
        <div style="font-size:14px;font-weight:700">${stockMovements.length} mouvement${stockMovements.length>1?'s':''}</div>
      </div>
      <div style="overflow-x:auto">
        ${stockMovements.length === 0 ? '<div style="padding:30px;text-align:center;color:var(--text-secondary)">Aucun mouvement.</div>' : `
        <table class="data-table">
          <thead>
            <tr><th>Date</th><th>Type</th><th>Produit</th><th>Quantite</th><th>Prix unit.</th><th>Reference</th><th>Motif</th><th>Utilisateur</th></tr>
          </thead>
          <tbody>
            ${stockMovements.map(m => {
              const date = new Date(m.created_at);
              const typeLabels = { sale: 'Vente', restock: 'Reception', delivery: 'Bon recep.', adjustment: 'Ajust.', inventory: 'Inventaire' };
              const qty = Number(m.quantity);
              const qtyStr = (qty > 0 ? '+' : '') + qty;
              const qtyColor = qty > 0 ? 'var(--success)' : 'var(--danger)';
              return `<tr>
                <td style="font-size:12px;color:var(--text-secondary)">${date.toLocaleDateString('fr-FR')}<br>${date.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</td>
                <td><span class="stock-mov-badge mov-${m.type}">${typeLabels[m.type] || m.type}</span></td>
                <td style="font-weight:600">${m.product_name}</td>
                <td style="font-weight:700;color:${qtyColor}">${qtyStr} ${m.unit||''}</td>
                <td style="color:var(--text-secondary)">${m.unit_price ? Number(m.unit_price).toLocaleString('fr-FR')+' F' : '—'}</td>
                <td style="font-family:monospace;font-size:11px;color:var(--text-muted)">${m.batch_ref || '—'}</td>
                <td style="font-size:12px;color:var(--text-secondary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${m.reason||''}">${m.reason || '—'}</td>
                <td style="font-size:12px;color:var(--text-secondary)">${m.user_name}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`}
      </div>
    </div>`;
}

async function stockApplyFilter() {
  stockMovementFilter = {
    type: document.getElementById('filter-type').value,
    product_id: document.getElementById('filter-product').value,
    from: document.getElementById('filter-from').value,
    to: document.getElementById('filter-to').value,
  };
  await stockLoadMovements();
  stockRenderHistory();
}

function stockResetFilter() {
  stockMovementFilter = { type: '', product_id: '', from: '', to: '' };
  stockLoadMovements().then(() => stockRenderHistory());
}

// ═════════════════════════════════════════════════════════
// ── MOUVEMENT SIMPLE (reception rapide + ajustement) ──
// ═════════════════════════════════════════════════════════

let stockMovementType = 'restock';
let stockMovementProductId = null;

function stockOpenSimpleReceipt() {
  stockMovementType = 'restock';
  stockMovementProductId = null;
  stockRenderMovementForm();
  document.getElementById('stock-movement-modal').classList.remove('hidden');
}

function stockOpenSimpleReceiptFor(productId) {
  stockMovementType = 'restock';
  stockMovementProductId = productId;
  stockRenderMovementForm();
  document.getElementById('stock-movement-modal').classList.remove('hidden');
}

function stockOpenAdjust() {
  stockMovementType = 'adjustment';
  stockMovementProductId = null;
  stockRenderMovementForm();
  document.getElementById('stock-movement-modal').classList.remove('hidden');
}

function stockRenderMovementForm() {
  document.getElementById('stock-movement-title').textContent =
    stockMovementType === 'restock' ? 'Reception rapide' : 'Ajustement de stock';

  const isRestock = stockMovementType === 'restock';

  document.getElementById('stock-movement-content').innerHTML = `
    <div style="background:${isRestock?'#102A18':'#2A1F05'};border:1px solid ${isRestock?'#1d4d2d':'#4d3d10'};border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px">
      ${isRestock
        ? '✓ La reception rapide <strong>ajoute</strong> du stock pour un seul produit.'
        : '⚠ L\'ajustement <strong>modifie</strong> directement le stock (positif ou negatif). Utilisez un motif clair.'}
    </div>

    <div class="form-grid">
      <div class="full">
        <label class="form-label">Produit *</label>
        <select class="input" id="mov-product">
          <option value="">— Selectionner —</option>
          ${stockProducts.map(p => `<option value="${p.id}" ${stockMovementProductId==p.id?'selected':''}>${p.name} (stock actuel : ${p.stock} ${p.unit||'pcs'})</option>`).join('')}
        </select>
      </div>

      <div>
        <label class="form-label">Quantite ${isRestock?'(positive)':'(+/-)'}</label>
        <input type="number" id="mov-qty" class="input" placeholder="0" value="${isRestock?'1':''}" />
        ${isRestock?'':'<div style="font-size:11px;color:var(--text-muted);margin-top:4px">Negatif = perte/casse, positif = ajout</div>'}
      </div>

      ${isRestock ? `
        <div>
          <label class="form-label">Prix d'achat (optionnel)</label>
          <input type="number" id="mov-price" class="input" placeholder="0" />
        </div>` : '<div></div>'}

      <div class="full">
        <label class="form-label">Motif ${isRestock?'(optionnel)':'*'}</label>
        <input type="text" id="mov-reason" class="input" placeholder="${isRestock?'Ex : Reapprovisionnement':'Ex : Casse, Perimes, Inventaire...'}" />
      </div>
    </div>
    <div id="mov-error" class="form-error hidden"></div>`;
}

async function stockSubmitMovement() {
  const productId = document.getElementById('mov-product').value;
  const qty = Number(document.getElementById('mov-qty').value);
  const reason = document.getElementById('mov-reason').value.trim();
  const priceEl = document.getElementById('mov-price');
  const unitPrice = priceEl ? Number(priceEl.value) || null : null;
  const err = document.getElementById('mov-error');
  err.classList.add('hidden');

  if (!productId) { err.textContent = 'Veuillez selectionner un produit.'; err.classList.remove('hidden'); return; }
  if (!qty || isNaN(qty)) { err.textContent = 'Quantite invalide.'; err.classList.remove('hidden'); return; }
  if (stockMovementType === 'restock' && qty <= 0) { err.textContent = 'La quantite doit etre positive.'; err.classList.remove('hidden'); return; }
  if (stockMovementType === 'adjustment' && !reason) { err.textContent = 'Le motif est obligatoire pour un ajustement.'; err.classList.remove('hidden'); return; }

  const btn = document.getElementById('stock-movement-submit');
  btn.textContent = 'Enregistrement...'; btn.disabled = true;

  await api('POST', '/api/stock/movements', {
    product_id: Number(productId),
    type: stockMovementType,
    quantity: qty,
    reason: reason || null,
    unit_price: unitPrice,
  });

  btn.textContent = 'Valider'; btn.disabled = false;
  document.getElementById('stock-movement-modal').classList.add('hidden');
  await stockLoadData();
}

// ═════════════════════════════════════════════════════════
// ── BON DE RECEPTION (multi-produits) ──
// ═════════════════════════════════════════════════════════

// Etat lie au BC importe
let deliveryLinkedPO = null;        // BC entier { id, reference, ... }
let deliverySelectedSupplierId = null;

async function stockOpenDeliveryNote() {
  deliveryItems = [];
  deliveryLinkedPO = null;
  deliverySelectedSupplierId = null;
  deliveryAvailablePOs = [];

  // Charger les fournisseurs actifs en cache
  deliverySuppliers = await api('GET', '/api/suppliers') || [];

  stockRenderDeliveryForm();
  document.getElementById('stock-delivery-modal').classList.remove('hidden');
}

function stockCloseDelivery() {
  if (deliveryItems.length > 0) {
    if (!confirm('Annuler ce bon de reception ? Les lignes saisies seront perdues.')) return;
  }
  deliveryItems = [];
  deliveryLinkedPO = null;
  deliverySelectedSupplierId = null;
  document.getElementById('stock-delivery-modal').classList.add('hidden');
}

function stockRenderDeliveryForm() {
  const totalQty = deliveryItems.reduce((s, i) => s + Number(i.quantity || 0), 0);
  const totalValue = deliveryItems.reduce((s, i) => s + (Number(i.quantity || 0) * Number(i.unit_price || 0)), 0);

  // Banner BC lie (si import depuis BC)
  const bcBanner = deliveryLinkedPO ? `
    <div style="background:#0D1F2D;border:1px solid #1d3552;border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div style="font-size:13px;color:var(--info)">
        📋 Reception liee au BC <strong style="color:var(--accent)">${deliveryLinkedPO.reference}</strong>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="stockUnlinkPO()" style="font-size:11px">Retirer le lien</button>
    </div>` : '';

  document.getElementById('stock-delivery-content').innerHTML = `
    ${bcBanner}

    <!-- Selecteur fournisseur + import BC -->
    <div class="form-grid" style="margin-bottom:16px">
      <div>
        <label class="form-label">Fournisseur</label>
        <select class="input" id="delivery-supplier" onchange="stockOnSupplierChange()">
          <option value="">— Aucun fournisseur —</option>
          ${deliverySuppliers.map(s => `<option value="${s.id}" ${deliverySelectedSupplierId==s.id?'selected':''}>${s.name}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="form-label">Motif (optionnel)</label>
        <input type="text" id="delivery-reason" class="input" placeholder="Ex : Livraison semaine 22" />
      </div>
    </div>

    <!-- Zone d'import depuis BC (visible si fournisseur selectionne et BCs disponibles) -->
    ${deliverySelectedSupplierId && deliveryAvailablePOs.length > 0 && !deliveryLinkedPO ? `
      <div style="background:var(--bg-elevated);border:1px solid var(--accent);border-radius:8px;padding:12px;margin-bottom:16px">
        <div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--accent)">
          💡 Bons de commande disponibles pour ce fournisseur (${deliveryAvailablePOs.length})
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${deliveryAvailablePOs.map(po => `
            <button class="btn btn-edit" onclick="stockLoadFromPO(${po.id})" style="padding:6px 12px;font-size:12px">
              ${po.reference} — ${Number(po.total).toLocaleString('fr-FR')} F
              <span style="font-size:10px;color:var(--text-muted);margin-left:4px">(${po.status === 'partial' ? 'partiel' : 'envoye'})</span>
            </button>`).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Ajout de produit -->
    <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px">
      <div style="font-weight:700;font-size:13px;margin-bottom:10px">Ajouter un produit</div>
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;align-items:end">
        <div>
          <label class="form-label">Produit</label>
          <select class="input" id="delivery-product" style="padding:8px 12px;font-size:13px">
            <option value="">— Selectionner —</option>
            ${stockProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Quantite</label>
          <input type="number" id="delivery-qty" class="input" min="1" placeholder="1" style="padding:8px 12px;font-size:13px" />
        </div>
        <div>
          <label class="form-label">Prix d'achat</label>
          <input type="number" id="delivery-price" class="input" min="0" placeholder="0" style="padding:8px 12px;font-size:13px" />
        </div>
        <button class="btn btn-primary btn-sm" onclick="stockAddDeliveryItem()" style="padding:8px 16px">+ Ajouter</button>
      </div>
    </div>

    <!-- Liste lignes -->
    ${deliveryItems.length === 0 ? `
      <div style="text-align:center;padding:30px;color:var(--text-muted);font-size:13px;border:1px dashed var(--border);border-radius:8px">
        Aucun produit ajoute. Selectionnez un produit ci-dessus et cliquez "Ajouter".
      </div>
    ` : `
      <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;max-height:300px;overflow-y:auto">
        <table class="data-table" style="font-size:13px">
          <thead style="position:sticky;top:0;background:var(--bg-surface);z-index:2">
            <tr><th>Produit</th><th>Quantite</th><th>Prix unit.</th><th>Total</th><th style="width:40px"></th></tr>
          </thead>
          <tbody>
            ${deliveryItems.map((item, i) => `
              <tr>
                <td>${item.product_name}</td>
                <td>${item.quantity} ${item.unit||'pcs'}</td>
                <td style="color:var(--text-secondary)">${item.unit_price ? Number(item.unit_price).toLocaleString('fr-FR')+' F' : '—'}</td>
                <td style="font-weight:600;color:var(--accent)">${item.unit_price ? (Number(item.quantity)*Number(item.unit_price)).toLocaleString('fr-FR')+' F' : '—'}</td>
                <td><button onclick="stockRemoveDeliveryItem(${i})" style="background:transparent;border:none;color:var(--danger);cursor:pointer;font-size:14px">✕</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);font-size:14px">
        <div>
          <strong>${deliveryItems.length}</strong> ligne${deliveryItems.length>1?'s':''} ·
          <strong>${totalQty}</strong> unite${totalQty>1?'s':''}
        </div>
        <div style="font-size:18px;font-weight:800;color:var(--accent)">
          ${totalValue > 0 ? 'Total achat : ' + totalValue.toLocaleString('fr-FR') + ' F' : ''}
        </div>
      </div>
    `}`;

  document.getElementById('stock-delivery-submit').disabled = deliveryItems.length === 0;
  document.getElementById('stock-delivery-submit').textContent =
    deliveryItems.length === 0 ? 'Receptionner' : `Receptionner ${deliveryItems.length} produit${deliveryItems.length>1?'s':''}`;
}

// Quand on change de fournisseur, charger ses BC en cours
async function stockOnSupplierChange() {
  const supplierId = document.getElementById('delivery-supplier').value;
  deliverySelectedSupplierId = supplierId ? Number(supplierId) : null;

  // Si un BC etait deja lie, on alerte avant de changer
  if (deliveryLinkedPO && deliveryItems.length > 0) {
    if (!confirm('Changer de fournisseur va vider la liste actuelle. Continuer ?')) {
      // Restaurer la valeur precedente
      document.getElementById('delivery-supplier').value = deliveryLinkedPO ? deliveryLinkedPO.supplier_id : '';
      return;
    }
    deliveryItems = [];
    deliveryLinkedPO = null;
  }

  // Charger les BC du fournisseur
  if (supplierId) {
    const pos = await api('GET', '/api/purchase-orders?supplier_id=' + supplierId) || [];
    deliveryAvailablePOs = pos.filter(p => p.status === 'sent' || p.status === 'partial');
  } else {
    deliveryAvailablePOs = [];
  }

  stockRenderDeliveryForm();
}

// Charger les articles d'un BC dans le formulaire
async function stockLoadFromPO(poId) {
  if (deliveryItems.length > 0) {
    if (!confirm('Charger ce BC va remplacer les lignes actuelles. Continuer ?')) return;
  }
  const po = await api('GET', '/api/purchase-orders/' + poId);
  if (!po) { alert('Erreur lors du chargement du BC.'); return; }

  deliveryLinkedPO = po;
  // Construire les items a partir du BC (quantite restante a recevoir)
  deliveryItems = po.items.map(item => {
    const qOrdered = Number(item.quantity_ordered);
    const qReceived = Number(item.quantity_received || 0);
    const qRemaining = Math.max(0, qOrdered - qReceived);
    const product = stockProducts.find(p => p.id === item.product_id);
    return {
      product_id: item.product_id,
      product_name: item.product_name,
      unit: product ? product.unit : (item.unit || 'pcs'),
      quantity: qRemaining,
      unit_price: item.unit_price,
    };
  }).filter(i => i.quantity > 0);

  stockRenderDeliveryForm();
}

function stockUnlinkPO() {
  if (!confirm('Retirer le lien avec le BC ? Les lignes actuelles seront conservees.')) return;
  deliveryLinkedPO = null;
  stockRenderDeliveryForm();
}

function stockAddDeliveryItem() {
  const productId = document.getElementById('delivery-product').value;
  const qty = Number(document.getElementById('delivery-qty').value);
  const price = Number(document.getElementById('delivery-price').value) || null;

  if (!productId) { alert('Selectionnez un produit.'); return; }
  if (!qty || qty <= 0) { alert('Quantite invalide.'); return; }

  const product = stockProducts.find(p => p.id == productId);
  if (!product) return;

  // Si le produit est deja dans la liste, on additionne
  const existing = deliveryItems.find(i => i.product_id == productId);
  if (existing) {
    existing.quantity = Number(existing.quantity) + qty;
    if (price) existing.unit_price = price;  // on met a jour le prix si fourni
  } else {
    deliveryItems.push({
      product_id: Number(productId),
      product_name: product.name,
      unit: product.unit,
      quantity: qty,
      unit_price: price,
    });
  }

  // Reset les champs
  document.getElementById('delivery-product').value = '';
  document.getElementById('delivery-qty').value = '';
  document.getElementById('delivery-price').value = '';
  stockRenderDeliveryForm();
}

function stockRemoveDeliveryItem(index) {
  deliveryItems.splice(index, 1);
  stockRenderDeliveryForm();
}

async function stockSubmitDelivery() {
  if (deliveryItems.length === 0) return;
  const supplierId = document.getElementById('delivery-supplier').value;
  const reason = document.getElementById('delivery-reason').value.trim();

  if (!confirm(`Confirmer la reception de ${deliveryItems.length} produit${deliveryItems.length>1?'s':''} ?`)) return;

  const btn = document.getElementById('stock-delivery-submit');
  btn.textContent = 'Enregistrement...'; btn.disabled = true;

  const payload = {
    items: deliveryItems.map(i => ({
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
    })),
    reason: reason || null,
  };
  if (supplierId) payload.supplier_id = Number(supplierId);
  if (deliveryLinkedPO) payload.purchase_order_id = deliveryLinkedPO.id;

  const result = await api('POST', '/api/stock/deliveries', payload);

  if (result && result.success) {
    alert('Bon de reception enregistre.\nReference : ' + result.batch_ref + (deliveryLinkedPO ? '\nLe statut du BC ' + deliveryLinkedPO.reference + ' a ete mis a jour.' : ''));
    deliveryItems = [];
    deliveryLinkedPO = null;
    deliverySelectedSupplierId = null;
    document.getElementById('stock-delivery-modal').classList.add('hidden');
    await stockLoadData();
  } else {
    btn.textContent = 'Receptionner'; btn.disabled = false;
    alert((result && result.error) || 'Erreur lors de l\'enregistrement.');
  }
}
