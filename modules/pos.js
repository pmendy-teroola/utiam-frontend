/**
 * modules/pos.js — U TIAM POS — Module Caisse
 * Charte KANIENE — theme sombre
 *
 * Fonctionnalites :
 * - Recherche / scan code-barres / grille de produits
 * - Panier avec quantites, remise, total live
 * - Selection client (optionnel)
 * - 5 modes de paiement avec rendu de monnaie pour especes
 * - Mise en attente de plusieurs tickets (localStorage)
 * - Ticket final imprimable
 *
 * Dependances : core/api.js, core/scanner.js
 */

let posProducts = [];
let posClients  = [];
let posCart     = [];   // [{ product_id, name, barcode, price, quantity, total, unit, image_url }]
let posDiscount = 0;    // remise totale en FCFA
let posClient   = null;
let posLastSale = null; // pour affichage du ticket
let posCashReceived = '';

const POS_PENDING_KEY = 'utiam_pending_sales';

// ── PAYMENT METHODS ──
const PAYMENT_METHODS = [
  { id: 'especes',        label: 'Especes',       icon: '💵' },
  { id: 'mobile_money',   label: 'Mobile Money',  icon: '📱' },
  { id: 'carte_bancaire', label: 'Carte',          icon: '💳' },
  { id: 'cheque',         label: 'Cheque',         icon: '📝' },
  { id: 'credit_client',  label: 'Credit client',  icon: '🧾' },
];

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

async function renderPOS(main) {
  main.innerHTML = `
    <div style="max-width:1400px;margin:0 auto">

      <!-- BARRE DU HAUT -->
      <div class="card" style="padding:14px 18px;margin-bottom:16px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <input id="pos-search" type="text" placeholder="Rechercher un produit (nom, marque, code-barres)..."
                 class="input" style="background:var(--bg-elevated);flex:1;min-width:200px"
                 oninput="posFilterProducts()" />
          <button class="btn btn-secondary" onclick="posScanCamera()" title="Scanner avec la camera">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Scanner
          </button>
          <button class="btn btn-secondary" onclick="posShowPendingList()" id="pos-pending-btn" title="Tickets en attente">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span id="pos-pending-count">En attente</span>
          </button>
        </div>
      </div>

      <!-- LAYOUT 2 COLONNES -->
      <div id="pos-layout" style="display:grid;grid-template-columns:1fr 380px;gap:16px;align-items:start">

        <!-- COLONNE PRODUITS -->
        <div class="card" style="padding:0;overflow:hidden">
          <div id="pos-product-grid" style="padding:16px;max-height:70vh;overflow-y:auto">
            <div style="text-align:center;padding:40px;color:var(--text-secondary)">Chargement...</div>
          </div>
        </div>

        <!-- COLONNE PANIER -->
        <div class="card" style="padding:16px;position:sticky;top:72px;max-height:calc(100vh - 100px);display:flex;flex-direction:column">

          <!-- Client -->
          <div style="margin-bottom:12px">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Client</div>
            <div id="pos-client-zone">
              <button class="btn btn-secondary" onclick="posOpenClientPicker()" style="width:100%;justify-content:flex-start">
                + Selectionner un client (optionnel)
              </button>
            </div>
          </div>

          <!-- En-tete panier -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="font-size:14px;font-weight:700">Panier</div>
            <button class="btn-clear" onclick="posClearCart()" style="background:transparent;border:none;color:var(--text-muted);font-size:12px;cursor:pointer">Vider</button>
          </div>

          <!-- Liste panier -->
          <div id="pos-cart-items" style="flex:1;overflow-y:auto;min-height:120px;margin-bottom:12px"></div>

          <!-- Totaux -->
          <div style="border-top:1px solid var(--border);padding-top:12px;font-size:13px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="color:var(--text-secondary)">Sous-total</span>
              <span id="pos-subtotal" style="font-weight:600">0 F</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="color:var(--text-secondary)">Remise</span>
              <div style="display:flex;align-items:center;gap:6px">
                <input id="pos-discount" type="number" min="0" value="0" class="input" style="width:90px;padding:4px 8px;font-size:13px;text-align:right" oninput="posUpdateDiscount()" />
                <span style="color:var(--text-secondary)">F</span>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;padding-top:10px;border-top:1px solid var(--border);font-size:18px;font-weight:800">
              <span>Total</span>
              <span id="pos-total" style="color:var(--accent)">0 F</span>
            </div>
          </div>

          <!-- Actions -->
          <div style="margin-top:14px;display:flex;gap:8px">
            <button class="btn btn-secondary" onclick="posParkSale()" id="pos-park-btn" style="flex:1" disabled>
              ⏸ Mettre en attente
            </button>
            <button class="btn btn-primary" onclick="posOpenPayment()" id="pos-pay-btn" style="flex:1.5" disabled>
              💰 Encaisser
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- MODAL CLIENT -->
    <div id="pos-client-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:520px">
        <div class="modal-title">Selectionner un client</div>
        <input id="pos-client-search" type="text" placeholder="Rechercher par nom ou telephone..." class="input" oninput="posRenderClientList()" />
        <div id="pos-client-list" style="margin-top:12px;max-height:400px;overflow-y:auto"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('pos-client-modal').classList.add('hidden')">Annuler</button>
        </div>
      </div>
    </div>

    <!-- MODAL PAIEMENT -->
    <div id="pos-payment-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:540px">
        <div class="modal-title">Encaissement</div>
        <div id="pos-payment-content"></div>
      </div>
    </div>

    <!-- MODAL EN ATTENTE -->
    <div id="pos-pending-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:540px">
        <div class="modal-title">Tickets en attente</div>
        <div id="pos-pending-content"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('pos-pending-modal').classList.add('hidden')">Fermer</button>
        </div>
      </div>
    </div>

    <!-- MODAL TICKET FINAL -->
    <div id="pos-ticket-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:420px">
        <div id="pos-ticket-content"></div>
      </div>
    </div>

    <style>
      @media (max-width: 900px) {
        #pos-layout { grid-template-columns: 1fr !important; }
      }
      .pos-prod-card {
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 8px;
        cursor: pointer;
        transition: all 0.15s;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .pos-prod-card:hover {
        border-color: var(--accent);
        transform: translateY(-2px);
      }
      .pos-prod-card:active { transform: translateY(0); }
      .pos-cart-item {
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 8px 10px;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .pos-qty-btn {
        background: var(--bg-main);
        border: 1px solid var(--border);
        color: var(--text-primary);
        width: 24px;
        height: 24px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 700;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .pos-qty-btn:hover { background: var(--accent); color: #000; border-color: var(--accent); }
      .pos-pay-method {
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 14px;
        cursor: pointer;
        transition: all 0.15s;
        text-align: center;
      }
      .pos-pay-method:hover { border-color: var(--accent); }
      .pos-pay-method.selected { border-color: var(--accent); background: #2a2000; }
      .pos-amount-btn {
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        color: var(--text-primary);
        padding: 8px 12px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        font-size: 13px;
      }
      .pos-amount-btn:hover { background: var(--accent); color: #000; border-color: var(--accent); }
    </style>`;

  // Active le scanner (douchette + camera) sur cette page
  scannerStartListening(posOnScan);

  await posLoadData();
  posUpdatePendingCount();
}

// ── SCAN ──
function posOnScan(barcode) {
  // Cherche le produit par code-barres et l'ajoute au panier
  const product = posProducts.find(p => p.barcode === barcode);
  if (product) {
    posAddToCart(product);
  } else {
    alert('Aucun produit avec ce code-barres : ' + barcode);
  }
}
function posScanCamera() { scannerOpenCamera(posOnScan); }

// ── LOAD DATA ──
async function posLoadData() {
  const [products, clients] = await Promise.all([
    api('GET', '/api/products?status=active'),
    api('GET', '/api/clients'),
  ]);
  posProducts = products || [];
  posClients  = clients  || [];
  posRenderProducts(posProducts);
}

// ── RENDU GRILLE PRODUITS ──
function posRenderProducts(list) {
  const el = document.getElementById('pos-product-grid');
  if (!el) return;
  if (list.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)">Aucun produit trouve.</div>';
    return;
  }
  el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">' +
    list.map(p => {
      const imageSrc = p.primary_image_url || p.image_url;
      const img = imageSrc
        ? `<img src="${imageSrc}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px" onerror="this.style.display='none'" />`
        : `<div style="width:100%;aspect-ratio:1;background:var(--bg-main);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;color:var(--accent)">${(p.name||'?')[0].toUpperCase()}</div>`;
      const stockBadge = Number(p.stock) === 0
        ? '<span class="badge badge-danger" style="font-size:9px">Rupture</span>'
        : Number(p.stock) <= Number(p.min_stock)
          ? '<span class="badge badge-warning" style="font-size:9px">' + p.stock + ' ' + (p.unit||'pcs') + '</span>'
          : '<span style="color:var(--text-muted);font-size:11px">' + p.stock + ' ' + (p.unit||'pcs') + '</span>';
      const disabled = Number(p.stock) === 0;
      return `
        <div class="pos-prod-card" ${disabled ? 'style="opacity:0.5;cursor:not-allowed"' : 'onclick="posAddToCartById('+p.id+')"'}>
          ${img}
          <div style="font-size:12px;font-weight:600;line-height:1.3;height:32px;overflow:hidden">${p.name}</div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="color:var(--accent);font-weight:700;font-size:13px">${Number(p.sell_price).toLocaleString('fr-FR')} F</span>
            ${stockBadge}
          </div>
        </div>`;
    }).join('') + '</div>';
}

function posFilterProducts() {
  const q = (document.getElementById('pos-search').value || '').toLowerCase();
  if (!q) { posRenderProducts(posProducts); return; }
  posRenderProducts(posProducts.filter(p =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.barcode || '').toLowerCase().includes(q) ||
    (p.brand || '').toLowerCase().includes(q)
  ));
}

// ── PANIER ──
function posAddToCartById(id) {
  const p = posProducts.find(p => p.id === id);
  if (p) posAddToCart(p);
}

function posAddToCart(product) {
  if (Number(product.stock) === 0) {
    alert('Ce produit est en rupture de stock.');
    return;
  }
  const existing = posCart.find(c => c.product_id === product.id);
  if (existing) {
    if (existing.quantity + 1 > Number(product.stock)) {
      alert('Stock insuffisant. Stock disponible : ' + product.stock);
      return;
    }
    existing.quantity++;
    existing.total = existing.price * existing.quantity;
  } else {
    posCart.push({
      product_id: product.id,
      name: product.name,
      barcode: product.barcode,
      price: Number(product.sell_price),
      quantity: 1,
      total: Number(product.sell_price),
      unit: product.unit || 'pcs',
      image_url: product.primary_image_url || product.image_url,
      stock_available: Number(product.stock),
    });
  }
  posRenderCart();
}

function posUpdateQuantity(productId, delta) {
  const item = posCart.find(c => c.product_id === productId);
  if (!item) return;
  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    posRemoveItem(productId);
    return;
  }
  if (newQty > item.stock_available) {
    alert('Stock insuffisant. Stock disponible : ' + item.stock_available);
    return;
  }
  item.quantity = newQty;
  item.total = item.price * newQty;
  posRenderCart();
}

function posSetQuantity(productId, qty) {
  const item = posCart.find(c => c.product_id === productId);
  if (!item) return;
  qty = Number(qty) || 1;
  if (qty <= 0) { posRemoveItem(productId); return; }
  if (qty > item.stock_available) {
    alert('Stock insuffisant. Stock disponible : ' + item.stock_available);
    qty = item.stock_available;
  }
  item.quantity = qty;
  item.total = item.price * qty;
  posRenderCart();
}

function posRemoveItem(productId) {
  posCart = posCart.filter(c => c.product_id !== productId);
  posRenderCart();
}

function posClearCart() {
  if (posCart.length === 0) return;
  if (!confirm('Vider le panier ?')) return;
  posCart = [];
  posDiscount = 0;
  posClient = null;
  document.getElementById('pos-discount').value = 0;
  posUpdateClientZone();
  posRenderCart();
}

function posUpdateDiscount() {
  posDiscount = Number(document.getElementById('pos-discount').value) || 0;
  posRenderTotals();
}

function posRenderCart() {
  const el = document.getElementById('pos-cart-items');
  if (posCart.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:30px 12px;color:var(--text-muted);font-size:13px">Panier vide.<br>Scannez ou cliquez un produit.</div>';
  } else {
    el.innerHTML = posCart.map(item => `
      <div class="pos-cart-item">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.name}</div>
          <div style="font-size:11px;color:var(--text-muted)">${item.price.toLocaleString('fr-FR')} F / ${item.unit}</div>
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <button class="pos-qty-btn" onclick="posUpdateQuantity(${item.product_id}, -1)">−</button>
          <input type="number" value="${item.quantity}" onchange="posSetQuantity(${item.product_id}, this.value)" style="width:40px;text-align:center;background:var(--bg-main);border:1px solid var(--border);color:var(--text-primary);border-radius:4px;padding:2px;font-size:12px" />
          <button class="pos-qty-btn" onclick="posUpdateQuantity(${item.product_id}, 1)">+</button>
        </div>
        <div style="min-width:70px;text-align:right;font-weight:700;font-size:13px;color:var(--accent)">${item.total.toLocaleString('fr-FR')} F</div>
        <button onclick="posRemoveItem(${item.product_id})" style="background:transparent;border:none;color:var(--danger);cursor:pointer;font-size:14px;padding:2px 4px">✕</button>
      </div>`).join('');
  }
  posRenderTotals();
}

function posRenderTotals() {
  const subtotal = posCart.reduce((s, i) => s + i.total, 0);
  const total = Math.max(0, subtotal - posDiscount);
  document.getElementById('pos-subtotal').textContent = subtotal.toLocaleString('fr-FR') + ' F';
  document.getElementById('pos-total').textContent = total.toLocaleString('fr-FR') + ' F';
  document.getElementById('pos-pay-btn').disabled = posCart.length === 0;
  document.getElementById('pos-park-btn').disabled = posCart.length === 0;
}

// ── CLIENT ──
function posOpenClientPicker() {
  document.getElementById('pos-client-modal').classList.remove('hidden');
  document.getElementById('pos-client-search').value = '';
  posRenderClientList();
}

function posRenderClientList() {
  const q = (document.getElementById('pos-client-search').value || '').toLowerCase();
  const filtered = q
    ? posClients.filter(c => (c.name||'').toLowerCase().includes(q) || (c.phone||'').toLowerCase().includes(q))
    : posClients;

  const el = document.getElementById('pos-client-list');
  if (filtered.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">Aucun client.</div>';
    return;
  }
  el.innerHTML = `
    <div onclick="posSelectClient(null)" style="padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;color:var(--text-muted)">
      — Aucun client (vente anonyme) —
    </div>` +
    filtered.map(c => `
      <div onclick="posSelectClient(${c.id})" style="padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600">${c.name}</div>
          <div style="font-size:12px;color:var(--text-muted)">${c.phone||''}</div>
        </div>
        ${c.credit ? '<div style="font-size:11px;color:var(--warning)">Credit : ' + Number(c.credit).toLocaleString('fr-FR') + ' F</div>' : ''}
      </div>`).join('');
}

function posSelectClient(id) {
  posClient = id ? posClients.find(c => c.id === id) : null;
  posUpdateClientZone();
  document.getElementById('pos-client-modal').classList.add('hidden');
}

function posUpdateClientZone() {
  const zone = document.getElementById('pos-client-zone');
  if (!zone) return;
  if (posClient) {
    zone.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg-elevated);border:1px solid var(--accent);border-radius:8px">
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px">${posClient.name}</div>
          <div style="font-size:11px;color:var(--text-muted)">${posClient.phone || ''}</div>
        </div>
        <button onclick="posSelectClient(null)" style="background:transparent;border:none;color:var(--danger);cursor:pointer;font-size:14px">✕</button>
      </div>`;
  } else {
    zone.innerHTML = `<button class="btn btn-secondary" onclick="posOpenClientPicker()" style="width:100%;justify-content:flex-start">+ Selectionner un client (optionnel)</button>`;
  }
}

// ═════════════════════════════════════════════════════════
// ── PAIEMENT ──
// ═════════════════════════════════════════════════════════

let posSelectedPayment = 'especes';

function posOpenPayment() {
  if (posCart.length === 0) return;
  posSelectedPayment = 'especes';
  posCashReceived = '';
  posRenderPaymentModal();
  document.getElementById('pos-payment-modal').classList.remove('hidden');
}

function posRenderPaymentModal() {
  const total = posCart.reduce((s, i) => s + i.total, 0) - posDiscount;
  const isCash = posSelectedPayment === 'especes';
  const isCredit = posSelectedPayment === 'credit_client';

  const cashReceived = Number(posCashReceived) || 0;
  const change = isCash ? Math.max(0, cashReceived - total) : 0;
  const missing = isCash ? Math.max(0, total - cashReceived) : 0;

  document.getElementById('pos-payment-content').innerHTML = `
    <!-- Total -->
    <div style="background:var(--bg-elevated);border:1px solid var(--accent);border-radius:10px;padding:14px;margin-bottom:16px;text-align:center">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Montant a payer</div>
      <div style="font-size:32px;font-weight:800;color:var(--accent);margin-top:4px">${total.toLocaleString('fr-FR')} F</div>
    </div>

    <!-- Modes de paiement -->
    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Mode de paiement</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:8px;margin-bottom:16px">
      ${PAYMENT_METHODS.map(m => `
        <div class="pos-pay-method ${posSelectedPayment===m.id?'selected':''}" onclick="posSelectPayment('${m.id}')">
          <div style="font-size:24px">${m.icon}</div>
          <div style="font-size:11px;font-weight:600;margin-top:4px">${m.label}</div>
        </div>`).join('')}
    </div>

    ${isCredit ? `
      <!-- Avertissement credit -->
      <div style="background:#0D1F2D;border:1px solid var(--info);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:var(--info)">
        ⚠ Mode credit : un client doit etre selectionne. Le montant sera ajoute a son compte.
        ${!posClient ? '<div style="margin-top:6px;color:var(--danger)"><strong>Aucun client selectionne !</strong></div>' : ''}
      </div>
    ` : ''}

    ${isCash ? `
      <!-- Saisie montant recu (especes) -->
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Montant recu</div>
      <input type="number" id="pos-cash-received" class="input" placeholder="0"
             value="${posCashReceived}" oninput="posCashChange(this.value)"
             style="font-size:20px;font-weight:700;text-align:center;background:var(--bg-elevated)" />

      <!-- Boutons d'appoint -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
        <button class="pos-amount-btn" onclick="posCashChange(${total})" style="background:var(--accent);color:#000;border-color:var(--accent)">Exact</button>
        ${QUICK_AMOUNTS.filter(a => a >= total).map(a => `
          <button class="pos-amount-btn" onclick="posCashChange(${a})">${a.toLocaleString('fr-FR')} F</button>
        `).join('')}
      </div>

      <!-- Rendu -->
      ${cashReceived > 0 ? `
        <div style="margin-top:14px;background:${missing > 0 ? '#2C1414' : '#102A18'};border:1px solid ${missing > 0 ? 'var(--danger)' : 'var(--success)'};border-radius:10px;padding:12px;text-align:center">
          ${missing > 0
            ? `<div style="font-size:11px;color:var(--danger);text-transform:uppercase">Manque</div>
               <div style="font-size:22px;font-weight:800;color:var(--danger)">${missing.toLocaleString('fr-FR')} F</div>`
            : `<div style="font-size:11px;color:var(--success);text-transform:uppercase">Rendu de monnaie</div>
               <div style="font-size:28px;font-weight:800;color:var(--success)">${change.toLocaleString('fr-FR')} F</div>`
          }
        </div>` : ''
      }
    ` : ''}

    <!-- Footer paiement -->
    <div style="display:flex;gap:8px;margin-top:20px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="document.getElementById('pos-payment-modal').classList.add('hidden')">Annuler</button>
      <button class="btn btn-primary" onclick="posConfirmPayment()" id="pos-confirm-pay-btn" ${posCanConfirm(isCash, isCredit, missing) ? '' : 'disabled'}>
        Valider la vente
      </button>
    </div>`;
}

function posCanConfirm(isCash, isCredit, missing) {
  if (isCredit && !posClient) return false;
  if (isCash && missing > 0) return false;
  return true;
}

function posSelectPayment(id) {
  posSelectedPayment = id;
  posRenderPaymentModal();
}

function posCashChange(value) {
  posCashReceived = String(value);
  posRenderPaymentModal();
}

async function posConfirmPayment() {
  const total = posCart.reduce((s, i) => s + i.total, 0) - posDiscount;
  const btn = document.getElementById('pos-confirm-pay-btn');
  btn.textContent = 'Enregistrement...';
  btn.disabled = true;

  const payload = {
    items: posCart.map(c => ({
      product_id: c.product_id,
      product_name: c.name,
      price: c.price,
      quantity: c.quantity,
      total: c.total,
    })),
    total,
    discount: posDiscount,
    payment_method: posSelectedPayment,
    client_id: posClient ? posClient.id : null,
  };

  const result = await api('POST', '/api/sales', payload);

  if (result && result.id) {
    posLastSale = {
      ...result,
      items: posCart.slice(),
      discount: posDiscount,
      client: posClient,
      payment_method: posSelectedPayment,
      cash_received: posSelectedPayment === 'especes' ? Number(posCashReceived) : null,
      change: posSelectedPayment === 'especes' ? Math.max(0, Number(posCashReceived) - total) : null,
    };
    document.getElementById('pos-payment-modal').classList.add('hidden');
    posShowTicket();
    // Reset
    posCart = [];
    posDiscount = 0;
    posClient = null;
    posCashReceived = '';
    document.getElementById('pos-discount').value = 0;
    posUpdateClientZone();
    await posLoadData();  // recharge les stocks
    posRenderCart();
  } else {
    btn.textContent = 'Valider la vente';
    btn.disabled = false;
    alert('Erreur lors de l\'enregistrement de la vente.');
  }
}

// ── TICKET FINAL ──
function posShowTicket() {
  if (!posLastSale) return;
  const total = posLastSale.items.reduce((s, i) => s + i.total, 0) - (posLastSale.discount || 0);
  const methodLabel = PAYMENT_METHODS.find(m => m.id === posLastSale.payment_method)?.label || posLastSale.payment_method;
  const date = new Date(posLastSale.created_at || Date.now());

  document.getElementById('pos-ticket-content').innerHTML = `
    <div id="pos-ticket-printable" style="background:#fff;color:#000;padding:20px;border-radius:8px;font-family:monospace;font-size:13px;line-height:1.5">
      <div style="text-align:center;margin-bottom:12px">
        <div style="font-size:18px;font-weight:800">U TIAM</div>
        <div style="font-size:11px">Point de Vente</div>
        <div style="font-size:11px;margin-top:4px">${date.toLocaleString('fr-FR')}</div>
        <div style="font-size:11px">Ticket #${posLastSale.id}</div>
      </div>
      <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:8px 0;margin-bottom:8px">
        ${posLastSale.items.map(i => `
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <div style="flex:1">
              <div>${i.name}</div>
              <div style="font-size:11px;color:#666">${i.quantity} x ${i.price.toLocaleString('fr-FR')} F</div>
            </div>
            <div style="font-weight:700">${i.total.toLocaleString('fr-FR')} F</div>
          </div>`).join('')}
      </div>
      ${posLastSale.discount > 0 ? `
        <div style="display:flex;justify-content:space-between">
          <span>Remise</span>
          <span>− ${Number(posLastSale.discount).toLocaleString('fr-FR')} F</span>
        </div>` : ''}
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;border-top:1px dashed #000;padding-top:6px;margin-top:6px">
        <span>TOTAL</span>
        <span>${total.toLocaleString('fr-FR')} F</span>
      </div>
      <div style="margin-top:8px;font-size:12px">
        <div>Paiement : ${methodLabel}</div>
        ${posLastSale.cash_received !== null ? `
          <div>Recu : ${Number(posLastSale.cash_received).toLocaleString('fr-FR')} F</div>
          <div>Rendu : ${Number(posLastSale.change).toLocaleString('fr-FR')} F</div>` : ''}
        ${posLastSale.client ? `<div>Client : ${posLastSale.client.name}</div>` : ''}
      </div>
      <div style="text-align:center;margin-top:12px;font-size:11px">
        Merci de votre visite !
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="window.print()">🖨 Imprimer</button>
      <button class="btn btn-primary" onclick="document.getElementById('pos-ticket-modal').classList.add('hidden')">Nouvelle vente</button>
    </div>
    <style>
      @media print {
        body * { visibility: hidden; }
        #pos-ticket-printable, #pos-ticket-printable * { visibility: visible; }
        #pos-ticket-printable { position: absolute; left: 0; top: 0; width: 100%; }
      }
    </style>`;

  document.getElementById('pos-ticket-modal').classList.remove('hidden');
}

// ═════════════════════════════════════════════════════════
// ── MISE EN ATTENTE ──
// ═════════════════════════════════════════════════════════

function posLoadPending() {
  try { return JSON.parse(localStorage.getItem(POS_PENDING_KEY) || '[]'); }
  catch { return []; }
}

function posSavePending(list) {
  localStorage.setItem(POS_PENDING_KEY, JSON.stringify(list));
  posUpdatePendingCount();
}

function posUpdatePendingCount() {
  const list = posLoadPending();
  const el = document.getElementById('pos-pending-count');
  if (el) el.textContent = list.length > 0 ? 'En attente (' + list.length + ')' : 'En attente';
}

function posParkSale() {
  if (posCart.length === 0) return;
  const name = prompt('Nom du ticket en attente :\n(Ex : "Madame robe rouge", "Client #3")', '');
  if (name === null) return;  // annule
  const label = (name || '').trim() || ('Ticket ' + new Date().toLocaleTimeString('fr-FR'));

  const list = posLoadPending();
  list.push({
    id: Date.now(),
    label,
    cart: posCart.slice(),
    discount: posDiscount,
    client_id: posClient ? posClient.id : null,
    parked_at: new Date().toISOString(),
  });
  posSavePending(list);

  // Reset le panier
  posCart = [];
  posDiscount = 0;
  posClient = null;
  document.getElementById('pos-discount').value = 0;
  posUpdateClientZone();
  posRenderCart();

  alert('Ticket "' + label + '" mis en attente.');
}

function posShowPendingList() {
  const list = posLoadPending();
  const el = document.getElementById('pos-pending-content');
  if (list.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">Aucun ticket en attente.</div>';
  } else {
    el.innerHTML = list.map(p => {
      const total = p.cart.reduce((s, i) => s + i.total, 0) - (p.discount || 0);
      const dt = new Date(p.parked_at);
      return `
        <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div style="font-weight:700">${p.label}</div>
            <div style="color:var(--accent);font-weight:700">${total.toLocaleString('fr-FR')} F</div>
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">
            ${p.cart.length} article${p.cart.length>1?'s':''} · Mis en attente a ${dt.toLocaleTimeString('fr-FR')}
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-primary" onclick="posResumeSale(${p.id})" style="flex:1;font-size:12px;padding:6px 10px">▶ Reprendre</button>
            <button class="btn btn-danger" onclick="posDeletePending(${p.id})" style="font-size:12px;padding:6px 10px">✕</button>
          </div>
        </div>`;
    }).join('');
  }
  document.getElementById('pos-pending-modal').classList.remove('hidden');
}

function posResumeSale(id) {
  const list = posLoadPending();
  const sale = list.find(s => s.id === id);
  if (!sale) return;

  if (posCart.length > 0) {
    if (!confirm('Un panier est en cours. Le mettre de cote et reprendre ce ticket ?')) return;
    // On park le panier actuel automatiquement
    const newList = list.filter(s => s.id !== id);
    newList.push({
      id: Date.now(),
      label: 'Ticket auto ' + new Date().toLocaleTimeString('fr-FR'),
      cart: posCart.slice(),
      discount: posDiscount,
      client_id: posClient ? posClient.id : null,
      parked_at: new Date().toISOString(),
    });
    posSavePending(newList);
  } else {
    posSavePending(list.filter(s => s.id !== id));
  }

  // Restaure le ticket
  posCart = sale.cart.slice();
  posDiscount = sale.discount || 0;
  posClient = sale.client_id ? posClients.find(c => c.id === sale.client_id) : null;
  document.getElementById('pos-discount').value = posDiscount;
  posUpdateClientZone();
  posRenderCart();
  document.getElementById('pos-pending-modal').classList.add('hidden');
}

function posDeletePending(id) {
  if (!confirm('Supprimer ce ticket en attente ? Le panier sera perdu.')) return;
  const list = posLoadPending().filter(s => s.id !== id);
  posSavePending(list);
  posShowPendingList();
}
