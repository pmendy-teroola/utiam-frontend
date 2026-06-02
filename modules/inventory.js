/**
 * modules/inventory.js — U TIAM POS — Module Inventaire
 * Charte KANIENE — theme sombre
 *
 * Fonctionnalites :
 * - Inventaire physique guide (etape par etape)
 * - Filtrage par categorie pour faire des inventaires partiels
 * - Saisie de la quantite physique constatee
 * - Calcul automatique des ecarts
 * - Recap avant validation
 * - Ajustement automatique du stock + traces dans utiam_stock_movements
 */

let inventoryProducts = [];   // produits actifs a inventorier
let inventoryCategories = [];
let inventoryCounted = {};    // { product_id: counted_quantity }
let inventoryCategoryFilter = '';  // categorie selectionnee (ou '')
let inventorySearch = '';

async function renderInventory(main) {
  main.innerHTML = `
    <div style="max-width:1100px;margin:0 auto">

      <!-- En-tete -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:20px;font-weight:700">Inventaire physique</div>
          <div style="color:var(--text-secondary);font-size:13px;margin-top:2px">Saisissez les quantites physiques constatees</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary" onclick="inventoryReset()">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Reinitialiser
          </button>
          <button class="btn btn-primary" id="inv-submit-btn" onclick="inventoryPreviewSubmit()" disabled>
            Valider l'inventaire
          </button>
        </div>
      </div>

      <!-- Bandeau info -->
      <div style="background:#0D1F2D;border:1px solid #1d3552;border-radius:10px;padding:14px 18px;margin-bottom:16px;font-size:13px">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="font-size:18px">ℹ</div>
          <div>
            Pour chaque produit, saisissez la <strong>quantite physique reelle</strong> que vous avez comptee.
            Les ecarts avec le stock systeme seront calcules et appliques apres validation.
            Vous pouvez filtrer par categorie pour faire des inventaires partiels (rayon par rayon).
          </div>
        </div>
      </div>

      <!-- Filtres -->
      <div class="card" style="padding:14px 18px;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:1fr 280px;gap:10px;align-items:end">
          <div>
            <label class="form-label">Recherche</label>
            <input type="text" class="input" id="inv-search" placeholder="Nom, code-barres, marque..." oninput="inventorySearchChange(this.value)" />
          </div>
          <div>
            <label class="form-label">Categorie</label>
            <select class="input" id="inv-category" onchange="inventoryCategoryChange(this.value)">
              <option value="">Toutes les categories</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div id="inv-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:16px"></div>

      <!-- Tableau de saisie -->
      <div class="card" style="padding:0;overflow:hidden">
        <div id="inv-table-wrap" style="overflow-x:auto">
          <div style="padding:40px;text-align:center;color:var(--text-secondary)">Chargement...</div>
        </div>
      </div>
    </div>

    <!-- MODAL : Recap avant validation -->
    <div id="inv-preview-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:800px">
        <div class="modal-title">Recapitulatif de l'inventaire</div>
        <div id="inv-preview-content"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('inv-preview-modal').classList.add('hidden')">Retour</button>
          <button class="btn btn-primary" id="inv-confirm-btn" onclick="inventoryConfirmSubmit()">Confirmer et appliquer</button>
        </div>
      </div>
    </div>

    <!-- MODAL : Resultat final -->
    <div id="inv-result-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:700px">
        <div class="modal-title">Inventaire enregistre</div>
        <div id="inv-result-content"></div>
        <div class="modal-footer">
          <button class="btn btn-primary" onclick="inventoryFinishSession()">Terminer</button>
        </div>
      </div>
    </div>

    <style>
      .inv-row-counted { background: #102A18; }
      .inv-row-counted td { background: #102A18 !important; }
      .inv-input-counted {
        background: var(--bg-main);
        border: 1px solid var(--border);
        color: var(--text-primary);
        border-radius: 6px;
        padding: 6px 10px;
        width: 100px;
        font-size: 13px;
        text-align: right;
      }
      .inv-input-counted:focus { outline: none; border-color: var(--accent); }
      .inv-diff-pos { color: var(--success); font-weight: 700; }
      .inv-diff-neg { color: var(--danger); font-weight: 700; }
      .inv-diff-zero { color: var(--text-muted); }
    </style>`;

  await inventoryLoadData();
}

async function inventoryLoadData() {
  const [products, categories] = await Promise.all([
    api('GET', '/api/products?status=active'),
    api('GET', '/api/categories'),
  ]);
  inventoryProducts = products || [];
  inventoryCategories = categories || [];

  // Remplit le selecteur de categories
  const sel = document.getElementById('inv-category');
  if (sel) {
    sel.innerHTML = '<option value="">Toutes les categories</option>' +
      inventoryCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }

  inventoryRender();
}

function inventoryGetFilteredProducts() {
  return inventoryProducts.filter(p => {
    if (inventoryCategoryFilter && p.category_id != inventoryCategoryFilter) return false;
    if (inventorySearch) {
      const q = inventorySearch.toLowerCase();
      if (!(p.name||'').toLowerCase().includes(q) &&
          !(p.barcode||'').toLowerCase().includes(q) &&
          !(p.brand||'').toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function inventorySearchChange(v) {
  inventorySearch = v;
  inventoryRender();
}

function inventoryCategoryChange(v) {
  inventoryCategoryFilter = v;
  inventoryRender();
}

function inventoryRender() {
  const filtered = inventoryGetFilteredProducts();

  // Stats
  const countedIds = Object.keys(inventoryCounted).map(Number);
  const countedInFilter = filtered.filter(p => countedIds.includes(p.id)).length;
  const totalEcart = countedIds.reduce((sum, pid) => {
    const p = inventoryProducts.find(pp => pp.id === pid);
    if (!p) return sum;
    const counted = Number(inventoryCounted[pid]);
    return sum + (counted - Number(p.stock));
  }, 0);

  const ecartCount = countedIds.filter(pid => {
    const p = inventoryProducts.find(pp => pp.id === pid);
    if (!p) return false;
    return Number(inventoryCounted[pid]) !== Number(p.stock);
  }).length;

  document.getElementById('inv-stats').innerHTML = `
    <div class="card" style="padding:14px 16px">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Produits affiches</div>
      <div style="font-size:22px;font-weight:800;margin-top:2px">${filtered.length}</div>
    </div>
    <div class="card" style="padding:14px 16px">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Comptes</div>
      <div style="font-size:22px;font-weight:800;margin-top:2px;color:var(--info)">${countedInFilter} / ${filtered.length}</div>
    </div>
    <div class="card" style="padding:14px 16px">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Ecarts detectes</div>
      <div style="font-size:22px;font-weight:800;margin-top:2px;color:${ecartCount>0?'var(--warning)':'var(--text-muted)'}">${ecartCount}</div>
    </div>
    <div class="card" style="padding:14px 16px">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Ecart total</div>
      <div style="font-size:22px;font-weight:800;margin-top:2px;color:${totalEcart>0?'var(--success)':totalEcart<0?'var(--danger)':'var(--text-muted)'}">${totalEcart>0?'+':''}${totalEcart}</div>
    </div>`;

  // Tableau
  const wrap = document.getElementById('inv-table-wrap');
  if (filtered.length === 0) {
    wrap.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary)">Aucun produit pour ce filtre.</div>';
    document.getElementById('inv-submit-btn').disabled = true;
    return;
  }

  wrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Produit</th>
          <th>Categorie</th>
          <th style="text-align:right">Stock systeme</th>
          <th style="text-align:right">Stock compte</th>
          <th style="text-align:right">Ecart</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(p => inventoryRenderRow(p)).join('')}
      </tbody>
    </table>`;

  // Active le bouton si au moins un produit a ete compte
  document.getElementById('inv-submit-btn').disabled = countedIds.length === 0;
  document.getElementById('inv-submit-btn').textContent =
    countedIds.length === 0 ? 'Valider l\'inventaire' : `Valider l'inventaire (${countedIds.length} produit${countedIds.length>1?'s':''})`;
}

function inventoryRenderRow(p) {
  const systemStock = Number(p.stock);
  const counted = inventoryCounted[p.id];
  const hasCount = counted !== undefined && counted !== '';
  const countedNum = hasCount ? Number(counted) : null;
  const diff = hasCount ? countedNum - systemStock : null;

  let diffDisplay = '';
  if (hasCount) {
    if (diff > 0) diffDisplay = `<span class="inv-diff-pos">+${diff}</span>`;
    else if (diff < 0) diffDisplay = `<span class="inv-diff-neg">${diff}</span>`;
    else diffDisplay = `<span class="inv-diff-zero">0 (OK)</span>`;
  } else {
    diffDisplay = '<span style="color:var(--text-muted)">—</span>';
  }

  return `
    <tr class="${hasCount?'inv-row-counted':''}">
      <td>
        <div style="font-weight:600">${p.name}</div>
        <div style="font-size:11px;color:var(--text-muted)">${p.barcode||''}${p.brand?' · '+p.brand:''}</div>
      </td>
      <td style="color:var(--text-secondary)">${p.category_name||'—'}</td>
      <td style="text-align:right;font-weight:600">${systemStock} <span style="color:var(--text-muted);font-weight:400">${p.unit||'pcs'}</span></td>
      <td style="text-align:right">
        <input type="number" min="0" class="inv-input-counted"
               value="${hasCount ? counted : ''}"
               placeholder="—"
               oninput="inventorySetCount(${p.id}, this.value)" />
      </td>
      <td style="text-align:right;font-size:15px">${diffDisplay}</td>
    </tr>`;
}

function inventorySetCount(productId, value) {
  if (value === '' || value === null) {
    delete inventoryCounted[productId];
  } else {
    inventoryCounted[productId] = value;
  }
  // Update only stats and current row pour eviter de re-render tout le tableau (perte focus)
  inventoryUpdateStatsAndRow(productId);
}

function inventoryUpdateStatsAndRow(productId) {
  // Update stats
  const filtered = inventoryGetFilteredProducts();
  const countedIds = Object.keys(inventoryCounted).map(Number);
  const countedInFilter = filtered.filter(p => countedIds.includes(p.id)).length;
  const totalEcart = countedIds.reduce((sum, pid) => {
    const p = inventoryProducts.find(pp => pp.id === pid);
    if (!p) return sum;
    return sum + (Number(inventoryCounted[pid]) - Number(p.stock));
  }, 0);
  const ecartCount = countedIds.filter(pid => {
    const p = inventoryProducts.find(pp => pp.id === pid);
    if (!p) return false;
    return Number(inventoryCounted[pid]) !== Number(p.stock);
  }).length;

  document.getElementById('inv-stats').innerHTML = `
    <div class="card" style="padding:14px 16px">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Produits affiches</div>
      <div style="font-size:22px;font-weight:800;margin-top:2px">${filtered.length}</div>
    </div>
    <div class="card" style="padding:14px 16px">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Comptes</div>
      <div style="font-size:22px;font-weight:800;margin-top:2px;color:var(--info)">${countedInFilter} / ${filtered.length}</div>
    </div>
    <div class="card" style="padding:14px 16px">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Ecarts detectes</div>
      <div style="font-size:22px;font-weight:800;margin-top:2px;color:${ecartCount>0?'var(--warning)':'var(--text-muted)'}">${ecartCount}</div>
    </div>
    <div class="card" style="padding:14px 16px">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Ecart total</div>
      <div style="font-size:22px;font-weight:800;margin-top:2px;color:${totalEcart>0?'var(--success)':totalEcart<0?'var(--danger)':'var(--text-muted)'}">${totalEcart>0?'+':''}${totalEcart}</div>
    </div>`;

  document.getElementById('inv-submit-btn').disabled = countedIds.length === 0;
  document.getElementById('inv-submit-btn').textContent =
    countedIds.length === 0 ? 'Valider l\'inventaire' : `Valider l'inventaire (${countedIds.length} produit${countedIds.length>1?'s':''})`;

  // Update la ligne courante (pour le badge ecart)
  const p = inventoryProducts.find(pp => pp.id === productId);
  if (!p) return;
  const counted = inventoryCounted[productId];
  const hasCount = counted !== undefined && counted !== '';
  const countedNum = hasCount ? Number(counted) : null;
  const diff = hasCount ? countedNum - Number(p.stock) : null;

  // Trouve l'input dans la ligne et update la classe de la <tr>
  const inputs = document.querySelectorAll('.inv-input-counted');
  for (const inp of inputs) {
    const onclick = inp.getAttribute('oninput') || '';
    if (onclick.includes(`(${productId},`)) {
      const tr = inp.closest('tr');
      if (tr) tr.classList.toggle('inv-row-counted', hasCount);
      // Update la cellule ecart (derniere td)
      const tds = tr.querySelectorAll('td');
      const lastTd = tds[tds.length - 1];
      if (lastTd) {
        if (!hasCount) {
          lastTd.innerHTML = '<span style="color:var(--text-muted)">—</span>';
        } else if (diff > 0) {
          lastTd.innerHTML = `<span class="inv-diff-pos">+${diff}</span>`;
        } else if (diff < 0) {
          lastTd.innerHTML = `<span class="inv-diff-neg">${diff}</span>`;
        } else {
          lastTd.innerHTML = `<span class="inv-diff-zero">0 (OK)</span>`;
        }
      }
      break;
    }
  }
}

function inventoryReset() {
  if (Object.keys(inventoryCounted).length === 0) return;
  if (!confirm('Reinitialiser toutes les quantites comptees ? Les saisies non validees seront perdues.')) return;
  inventoryCounted = {};
  inventoryRender();
}

// ── ETAPE 2 : Recap avant validation ──
function inventoryPreviewSubmit() {
  const countedIds = Object.keys(inventoryCounted).map(Number);
  if (countedIds.length === 0) return;

  // Calcul des ajustements
  const adjustments = countedIds.map(pid => {
    const p = inventoryProducts.find(pp => pp.id === pid);
    if (!p) return null;
    const before = Number(p.stock);
    const after = Number(inventoryCounted[pid]);
    return { product_id: pid, name: p.name, unit: p.unit, before, after, delta: after - before };
  }).filter(a => a);

  const withDiff = adjustments.filter(a => a.delta !== 0);
  const noDiff = adjustments.filter(a => a.delta === 0);
  const losses = withDiff.filter(a => a.delta < 0);
  const gains = withDiff.filter(a => a.delta > 0);

  document.getElementById('inv-preview-content').innerHTML = `
    <!-- Summary -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px">
      <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Total comptes</div>
        <div style="font-size:24px;font-weight:800">${adjustments.length}</div>
      </div>
      <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Sans ecart</div>
        <div style="font-size:24px;font-weight:800;color:var(--success)">${noDiff.length}</div>
      </div>
      <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Pertes</div>
        <div style="font-size:24px;font-weight:800;color:var(--danger)">${losses.length}</div>
      </div>
      <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Gains</div>
        <div style="font-size:24px;font-weight:800;color:var(--success)">${gains.length}</div>
      </div>
    </div>

    ${withDiff.length === 0 ? `
      <div style="background:#102A18;border:1px solid #1d4d2d;border-radius:8px;padding:14px;color:var(--success);font-size:13px;text-align:center">
        ✓ Aucun ecart detecte. Le stock systeme correspond parfaitement au stock physique.
        <div style="margin-top:6px;color:var(--text-secondary)">Aucun ajustement ne sera applique.</div>
      </div>
    ` : `
      <div style="background:#2A1F05;border:1px solid #4d3d10;border-radius:8px;padding:10px 14px;color:var(--warning);font-size:12px;margin-bottom:12px">
        ⚠ ${withDiff.length} ajustement${withDiff.length>1?'s seront appliques':' sera applique'} au stock.
      </div>
      <div style="max-height:400px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">
        <table class="data-table" style="font-size:13px">
          <thead style="position:sticky;top:0;background:var(--bg-surface);z-index:2">
            <tr><th>Produit</th><th style="text-align:right">Avant</th><th style="text-align:right">Apres</th><th style="text-align:right">Ecart</th></tr>
          </thead>
          <tbody>
            ${withDiff.map(a => `
              <tr>
                <td style="font-weight:600">${a.name}</td>
                <td style="text-align:right;color:var(--text-secondary)">${a.before} ${a.unit||''}</td>
                <td style="text-align:right;font-weight:700">${a.after} ${a.unit||''}</td>
                <td style="text-align:right;font-weight:800;color:${a.delta>0?'var(--success)':'var(--danger)'}">${a.delta>0?'+':''}${a.delta}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `}

    <!-- Motif global -->
    <div style="margin-top:16px">
      <label class="form-label">Motif de l'inventaire (optionnel)</label>
      <input type="text" class="input" id="inv-global-reason" placeholder="Ex : Inventaire mensuel mai 2026" />
    </div>`;

  document.getElementById('inv-preview-modal').classList.remove('hidden');
}

let inventoryResultData = null;

async function inventoryConfirmSubmit() {
  const reason = document.getElementById('inv-global-reason').value.trim() || null;
  const items = Object.keys(inventoryCounted).map(pid => ({
    product_id: Number(pid),
    counted_quantity: Number(inventoryCounted[pid]),
  }));

  if (items.length === 0) return;

  const btn = document.getElementById('inv-confirm-btn');
  btn.textContent = 'Enregistrement...'; btn.disabled = true;

  const result = await api('POST', '/api/stock/inventory', { items, reason });

  btn.textContent = 'Confirmer et appliquer'; btn.disabled = false;

  if (result && result.success) {
    inventoryResultData = result;
    document.getElementById('inv-preview-modal').classList.add('hidden');
    inventoryShowResult(result);
  } else {
    alert('Erreur lors de l\'enregistrement.');
  }
}

function inventoryShowResult(result) {
  const adjustments = result.adjustments || [];
  document.getElementById('inv-result-content').innerHTML = `
    <div style="text-align:center;padding:10px 0 20px">
      <div style="font-size:48px;margin-bottom:8px">✓</div>
      <div style="font-size:18px;font-weight:700;color:var(--success);margin-bottom:6px">
        Inventaire enregistre
      </div>
      <div style="font-size:13px;color:var(--text-secondary)">
        Reference : <span style="font-family:monospace">${result.batch_ref}</span>
      </div>
    </div>

    ${adjustments.length === 0 ? `
      <div style="background:#102A18;border:1px solid #1d4d2d;border-radius:8px;padding:14px;color:var(--success);text-align:center;font-size:13px">
        Aucun ajustement n'a ete necessaire — votre stock est juste !
      </div>
    ` : `
      <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:12px;text-align:center;font-size:13px">
        <strong>${adjustments.length} ajustement${adjustments.length>1?'s':''}</strong> applique${adjustments.length>1?'s':''} au stock.
      </div>
      <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">
        <table class="data-table" style="font-size:12px">
          <thead style="position:sticky;top:0;background:var(--bg-surface);z-index:2">
            <tr><th>Produit</th><th>Avant</th><th>Apres</th><th>Ecart</th></tr>
          </thead>
          <tbody>
            ${adjustments.map(a => `
              <tr>
                <td>${a.name}</td>
                <td style="color:var(--text-secondary)">${a.before}</td>
                <td style="font-weight:700">${a.after}</td>
                <td style="font-weight:800;color:${a.delta>0?'var(--success)':'var(--danger)'}">${a.delta>0?'+':''}${a.delta}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `}`;
  document.getElementById('inv-result-modal').classList.remove('hidden');
}

async function inventoryFinishSession() {
  inventoryCounted = {};
  inventoryResultData = null;
  document.getElementById('inv-result-modal').classList.add('hidden');
  await inventoryLoadData();
}
