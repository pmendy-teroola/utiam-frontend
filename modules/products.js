/**
 * modules/products.js — U TIAM POS
 * Charte KANIENE — theme sombre
 * Scan code-barres + galerie multi-images + import CSV
 */
let productsList    = [];
let categoriesList  = [];
let productsEditId  = null;
let productsImages  = [];

// ── IMPORT CSV STATE ──
let importRows = [];       // { data, action, existing_id?, existing_name? }
let importStep = 1;        // 1=upload, 2=preview, 3=done

async function renderProducts(main) {
  main.innerHTML = `
    <div style="max-width:1100px;margin:0 auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:20px;font-weight:700">Gestion des Produits</div>
          <div style="color:var(--text-secondary);font-size:13px;margin-top:2px" id="products-count">Chargement...</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary" onclick="productsOpenImport()">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            Importer CSV
          </button>
          <button class="btn btn-primary" onclick="productsOpenForm()">+ Nouveau produit</button>
        </div>
      </div>
      <div id="products-alerts"></div>
      <div class="card" style="padding:14px 18px;margin-bottom:16px">
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <input id="products-search" type="text" placeholder="Rechercher par nom, marque, code-barres..." class="input" style="background:var(--bg-elevated);flex:1;min-width:200px" oninput="productsFilterList()" />
          <button class="btn btn-secondary" onclick="productsScanCamera()" title="Scanner avec la camera">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Scanner
          </button>
        </div>
        <div style="color:var(--text-muted);font-size:12px;margin-top:8px">
          Astuce : branchez une douchette, le scan remplira automatiquement la recherche.
        </div>
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <div id="products-list" style="overflow-x:auto">
          <div style="padding:40px;text-align:center;color:var(--text-secondary)">Chargement...</div>
        </div>
      </div>
    </div>

    <!-- MODAL FORMULAIRE PRODUIT -->
    <div id="products-modal" class="modal-overlay hidden">
      <div class="modal-box">
        <div class="modal-title" id="products-modal-title">Nouveau produit</div>
        <div id="products-form-step1">
          <div class="form-grid">
            <div class="full"><label class="form-label">Nom *</label><input id="pf-name" type="text" class="input" placeholder="Ex : Riz parfume 1kg" /></div>
            <div class="full">
              <label class="form-label">Code-barres</label>
              <div style="display:flex;gap:8px">
                <input id="pf-barcode" type="text" class="input" placeholder="EAN13 ou interne" style="flex:1" />
                <button class="btn btn-secondary" onclick="productsScanForForm()" title="Scanner avec la camera">📷</button>
              </div>
            </div>
            <div><label class="form-label">Categorie</label><select id="pf-category" class="input"></select></div>
            <div><label class="form-label">Marque</label><input id="pf-brand" type="text" class="input" placeholder="Ex : Nestle" /></div>
            <div><label class="form-label">Prix achat (FCFA)</label><input id="pf-buy-price" type="number" min="0" class="input" placeholder="0" /></div>
            <div><label class="form-label">Prix vente (FCFA) *</label><input id="pf-sell-price" type="number" min="0" class="input" placeholder="0" /></div>
            <div><label class="form-label">Unite</label><select id="pf-unit" class="input"><option value="pcs">Piece (pcs)</option><option value="kg">Kilogramme (kg)</option><option value="g">Gramme (g)</option><option value="L">Litre (L)</option><option value="cl">Centilitre (cl)</option><option value="sachet">Sachet</option><option value="boite">Boite</option><option value="carton">Carton</option></select></div>
            <div><label class="form-label">Stock actuel</label><input id="pf-stock" type="number" min="0" class="input" placeholder="0" /></div>
            <div><label class="form-label">Stock minimum</label><input id="pf-min-stock" type="number" min="0" class="input" placeholder="5" /></div>
            <div><label class="form-label">Date expiration</label><input id="pf-expiry" type="date" class="input" /></div>
          </div>
        </div>
        <div id="products-form-step2" style="margin-top:24px;display:none">
          <div style="font-size:14px;font-weight:700;margin-bottom:12px">Galerie d'images</div>
          <div style="color:var(--text-muted);font-size:12px;margin-bottom:12px">
            Ajoutez plusieurs images pour ce produit. La premiere sera l'image principale.
          </div>
          <div id="products-gallery" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;margin-bottom:16px"></div>
          <input type="file" id="pf-file-input" accept="image/*" capture="environment" style="display:none" onchange="productsUploadImage(event)" />
          <button class="btn btn-secondary" onclick="document.getElementById('pf-file-input').click()">+ Ajouter une image</button>
          <div id="pf-upload-status" style="margin-top:10px;font-size:13px;color:var(--text-secondary)"></div>
        </div>
        <div id="products-form-error" class="form-error hidden"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="productsCloseForm()" id="products-cancel-btn">Annuler</button>
          <button class="btn btn-primary" id="products-submit-btn" onclick="productsSubmitForm()">Enregistrer</button>
        </div>
      </div>
    </div>

    <!-- MODAL IMPORT CSV -->
    <div id="import-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:900px">
        <div class="modal-title">Importer des produits depuis un fichier CSV</div>
        <div id="import-content"></div>
        <div class="modal-footer" id="import-footer"></div>
      </div>
    </div>`;

  scannerStartListening(productsOnScan);
  await productsLoad();
}

// ── SCAN HANDLERS ──────────────────────────────────────
function productsOnScan(barcode) {
  const modal = document.getElementById('products-modal');
  if (modal && !modal.classList.contains('hidden')) {
    document.getElementById('pf-barcode').value = barcode;
    return;
  }
  const search = document.getElementById('products-search');
  if (search) { search.value = barcode; productsFilterList(); }
}
function productsScanCamera() { scannerOpenCamera(productsOnScan); }
function productsScanForForm() { scannerOpenCamera((b) => { document.getElementById('pf-barcode').value = b; }); }

// ── LOAD & RENDER ──────────────────────────────────────
async function productsLoad() {
  const [products, categories] = await Promise.all([api('GET','/api/products'), api('GET','/api/categories')]);
  productsList   = products   || [];
  categoriesList = categories || [];
  const c = document.getElementById('products-count');
  if (c) c.textContent = productsList.length + ' produit' + (productsList.length>1?'s':'') + ' enregistre' + (productsList.length>1?'s':'');
  productsRenderAlerts();
  productsRenderList(productsList);
}

function productsRenderAlerts() {
  const low = productsList.filter(p => Number(p.stock) <= Number(p.min_stock));
  const el  = document.getElementById('products-alerts');
  if (!el) return;
  if (!low.length) { el.innerHTML=''; return; }
  el.innerHTML = '<div class="alert-danger"><span><strong>' + low.length + ' produit' + (low.length>1?'s':'') + ' en stock bas :</strong> ' + low.map(p=>p.name).join(', ') + '</span></div>';
}

function productsRenderList(list) {
  const el = document.getElementById('products-list');
  if (!el) return;
  if (!list.length) { el.innerHTML='<div style="padding:48px;text-align:center;color:var(--text-secondary)">Aucun produit trouve.</div>'; return; }
  let rows = list.map(p => productsRenderRow(p)).join('');
  el.innerHTML = '<table class="data-table"><thead><tr><th style="width:56px">Image</th><th>Produit</th><th>Categorie</th><th>Prix vente</th><th>Prix achat</th><th>Stock</th><th>Etat</th><th style="width:130px">Actions</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

function productsRenderRow(p) {
  const stock = Number(p.stock), min = Number(p.min_stock);
  let bc, bl;
  if (stock===0)      { bc='badge-danger';  bl='Rupture'; }
  else if(stock<=min) { bc='badge-warning'; bl='Stock bas'; }
  else                { bc='badge-success'; bl='En stock'; }
  const imageSrc = p.primary_image_url || p.image_url;
  const img = imageSrc
    ? '<img src="'+imageSrc+'" style="width:36px;height:36px;border-radius:8px;object-fit:cover;border:1px solid var(--border)" onerror="this.style.display=\'none\'" />'
    : '<div style="width:36px;height:36px;border-radius:8px;background:var(--bg-elevated);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:var(--accent)">'+(p.name?p.name[0].toUpperCase():'?')+'</div>';
  return '<tr>'
    +'<td>'+img+'</td>'
    +'<td><div style="font-weight:600">'+p.name+'</div><div style="font-size:12px;color:var(--text-muted)">'+(p.barcode||'')+(p.brand?' · '+p.brand:'')+'</div></td>'
    +'<td style="color:var(--text-secondary)">'+(p.category_name||'—')+'</td>'
    +'<td style="font-weight:700;color:var(--accent)">'+Number(p.sell_price).toLocaleString('fr-FR')+' F</td>'
    +'<td style="color:var(--text-secondary)">'+(p.buy_price?Number(p.buy_price).toLocaleString('fr-FR')+' F':'—')+'</td>'
    +'<td style="font-weight:600">'+p.stock+' <span style="color:var(--text-muted);font-weight:400">'+(p.unit||'pcs')+'</span></td>'
    +'<td><span class="badge '+bc+'">'+bl+'</span></td>'
    +'<td><div style="display:flex;gap:6px"><button class="btn btn-edit" onclick="productsOpenFormById('+p.id+')">Modifier</button><button class="btn btn-danger" onclick="productsDelete('+p.id+',\''+(p.name||'').replace(/'/g,'')+'\')">✕</button></div></td>'
    +'</tr>';
}

function productsFilterList() {
  const q = (document.getElementById('products-search').value||'').toLowerCase();
  if (!q) { productsRenderList(productsList); return; }
  productsRenderList(productsList.filter(p =>
    (p.name||'').toLowerCase().includes(q)||(p.barcode||'').toLowerCase().includes(q)||
    (p.brand||'').toLowerCase().includes(q)||(p.category_name||'').toLowerCase().includes(q)
  ));
}

function productsOpenFormById(id) { const p=productsList.find(p=>p.id===id); if(p) productsOpenForm(p); }

function productsOpenForm(product) {
  productsEditId = product ? product.id : null;
  document.getElementById('products-modal-title').textContent = product ? 'Modifier le produit' : 'Nouveau produit';
  document.getElementById('pf-category').innerHTML = '<option value="">- Aucune -</option>' +
    categoriesList.map(c=>'<option value="'+c.id+'"'+(product&&product.category_id==c.id?' selected':'')+'>'+c.name+'</option>').join('');
  document.getElementById('pf-name').value       = product?(product.name||''):'';
  document.getElementById('pf-barcode').value    = product?(product.barcode||''):'';
  document.getElementById('pf-buy-price').value  = product?(product.buy_price||''):'';
  document.getElementById('pf-sell-price').value = product?(product.sell_price||''):'';
  document.getElementById('pf-brand').value      = product?(product.brand||''):'';
  document.getElementById('pf-unit').value       = product?(product.unit||'pcs'):'pcs';
  document.getElementById('pf-stock').value      = product?(product.stock??0):0;
  document.getElementById('pf-min-stock').value  = product?(product.min_stock??5):5;
  document.getElementById('pf-expiry').value     = product&&product.expiry_date?product.expiry_date.split('T')[0]:'';
  document.getElementById('products-form-error').classList.add('hidden');
  if (product) {
    document.getElementById('products-form-step2').style.display = 'block';
    document.getElementById('products-submit-btn').textContent = 'Mettre a jour';
    document.getElementById('products-cancel-btn').textContent = 'Fermer';
    productsLoadGallery(product.id);
  } else {
    document.getElementById('products-form-step2').style.display = 'none';
    document.getElementById('products-submit-btn').textContent = 'Enregistrer';
    document.getElementById('products-cancel-btn').textContent = 'Annuler';
    productsImages = [];
  }
  document.getElementById('products-modal').classList.remove('hidden');
}

function productsCloseForm() {
  document.getElementById('products-modal').classList.add('hidden');
  productsEditId = null;
  productsImages = [];
  productsLoad();
}

// ── GALERIE ────────────────────────────────────────────
async function productsLoadGallery(productId) {
  productsImages = await api('GET', '/api/products/' + productId + '/images') || [];
  productsRenderGallery();
}

function productsRenderGallery() {
  const el = document.getElementById('products-gallery');
  if (!el) return;
  if (productsImages.length === 0) {
    el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--text-muted);font-size:13px;border:1px dashed var(--border);border-radius:8px">Aucune image. Cliquez sur "Ajouter une image" ci-dessous.</div>';
    return;
  }
  el.innerHTML = productsImages.map(img => `
    <div style="position:relative;border:2px solid ${img.is_primary ? 'var(--accent)' : 'var(--border)'};border-radius:8px;overflow:hidden;background:var(--bg-elevated);aspect-ratio:1">
      <img src="${img.url}" style="width:100%;height:100%;object-fit:cover" />
      ${img.is_primary ? '<div style="position:absolute;top:6px;left:6px;background:var(--accent);color:#000;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px">PRINCIPALE</div>' : ''}
      <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.85));padding:8px 6px;display:flex;gap:4px;justify-content:center">
        ${!img.is_primary ? `<button onclick="productsSetPrimary(${img.id})" title="Definir principale" style="background:rgba(212,175,55,0.9);color:#000;border:none;border-radius:4px;padding:3px 6px;cursor:pointer;font-size:11px;font-weight:600">★</button>` : ''}
        <button onclick="productsDeleteImage(${img.id})" title="Supprimer" style="background:rgba(231,76,60,0.9);color:#fff;border:none;border-radius:4px;padding:3px 6px;cursor:pointer;font-size:11px;font-weight:600">✕</button>
      </div>
    </div>
  `).join('');
}

async function productsUploadImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!productsEditId) { alert("Veuillez d'abord enregistrer le produit."); return; }
  const status = document.getElementById('pf-upload-status');
  status.textContent = 'Envoi en cours...'; status.style.color = 'var(--text-secondary)';
  const formData = new FormData();
  formData.append('file', file);
  try {
    const token = localStorage.getItem('utiam_token');
    const res = await fetch('/api/products/' + productsEditId + '/images', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData
    });
    if (res.ok) {
      status.textContent = 'Image ajoutee avec succes'; status.style.color = 'var(--success)';
      setTimeout(() => { status.textContent = ''; }, 2000);
      await productsLoadGallery(productsEditId);
    } else {
      const err = await res.json();
      status.textContent = 'Erreur : ' + (err.error || 'echec de l\'envoi'); status.style.color = 'var(--danger)';
    }
  } catch (e) {
    status.textContent = 'Erreur reseau : ' + e.message; status.style.color = 'var(--danger)';
  }
  event.target.value = '';
}

async function productsSetPrimary(imageId) {
  await api('PUT', '/api/products/' + productsEditId + '/images/' + imageId + '/primary');
  await productsLoadGallery(productsEditId);
}
async function productsDeleteImage(imageId) {
  if (!confirm('Supprimer cette image ?')) return;
  await api('DELETE', '/api/images/' + imageId);
  await productsLoadGallery(productsEditId);
}

// ── ENREGISTREMENT PRODUIT ─────────────────────────────
async function productsSubmitForm() {
  const name=document.getElementById('pf-name').value.trim();
  const sellPrice=document.getElementById('pf-sell-price').value;
  const err=document.getElementById('products-form-error');
  err.classList.add('hidden');
  if(!name){err.textContent='Le nom est obligatoire.';err.classList.remove('hidden');return;}
  if(!sellPrice){err.textContent='Le prix de vente est obligatoire.';err.classList.remove('hidden');return;}
  const payload={
    name, barcode:document.getElementById('pf-barcode').value.trim()||null,
    buy_price:document.getElementById('pf-buy-price').value||null,
    sell_price:sellPrice, category_id:document.getElementById('pf-category').value||null,
    brand:document.getElementById('pf-brand').value.trim()||null,
    unit:document.getElementById('pf-unit').value,
    stock:Number(document.getElementById('pf-stock').value)||0,
    min_stock:Number(document.getElementById('pf-min-stock').value)||5,
    expiry_date:document.getElementById('pf-expiry').value||null,
    image_url:null,
  };
  const btn=document.getElementById('products-submit-btn');
  btn.textContent='Enregistrement...'; btn.disabled=true;
  const result=productsEditId
    ? await api('PUT','/api/products/'+productsEditId,payload)
    : await api('POST','/api/products',payload);
  btn.disabled=false;
  if(result&&result.id){
    if (!productsEditId) {
      productsEditId = result.id;
      document.getElementById('products-modal-title').textContent = 'Produit cree — ajoutez des images';
      document.getElementById('products-form-step2').style.display = 'block';
      btn.textContent = 'Mettre a jour';
      document.getElementById('products-cancel-btn').textContent = 'Fermer';
      productsImages = []; productsRenderGallery();
      const status = document.getElementById('pf-upload-status');
      if (status) {
        status.textContent = 'Produit enregistre. Vous pouvez maintenant ajouter des images.';
        status.style.color = 'var(--success)';
        setTimeout(() => { status.textContent = ''; }, 3000);
      }
    } else {
      btn.textContent = 'Mettre a jour';
      const status = document.getElementById('pf-upload-status');
      if (status) {
        status.textContent = 'Modifications enregistrees';
        status.style.color = 'var(--success)';
        setTimeout(() => { status.textContent = ''; }, 2000);
      }
    }
  } else {
    btn.textContent='Enregistrer';
    err.textContent='Erreur enregistrement.';err.classList.remove('hidden');
  }
}

async function productsDelete(id,name) {
  if(!confirm('Supprimer "'+name+'" ?\nAction irreversible.')) return;
  await api('DELETE','/api/products/'+id);
  await productsLoad();
}

// ═════════════════════════════════════════════════════════
// ─── IMPORT CSV ─────────────────────────────────────────
// ═════════════════════════════════════════════════════════

function productsOpenImport() {
  importRows = [];
  importStep = 1;
  document.getElementById('import-modal').classList.remove('hidden');
  importRenderStep1();
}

function productsCloseImport() {
  document.getElementById('import-modal').classList.add('hidden');
  importRows = [];
  importStep = 1;
  productsLoad();
}

// ── ETAPE 1 : Upload ──
function importRenderStep1() {
  document.getElementById('import-content').innerHTML = `
    <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:20px">
      <div style="font-weight:700;margin-bottom:8px">1. Telechargez le modele CSV</div>
      <div style="color:var(--text-secondary);font-size:13px;margin-bottom:12px">
        Le fichier doit contenir les colonnes suivantes (les colonnes Nom et Prix de vente sont obligatoires) :
      </div>
      <div style="color:var(--text-muted);font-size:12px;font-family:monospace;background:var(--bg-main);padding:10px;border-radius:6px;overflow-x:auto;white-space:nowrap">
        Nom, Code-barres, Categorie, Marque, Prix d'achat, Prix de vente, Unite, Stock, Stock minimum, Date expiration
      </div>
      <button class="btn btn-secondary" style="margin-top:12px" onclick="importDownloadTemplate()">
        Telecharger le modele CSV
      </button>
    </div>

    <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:16px">
      <div style="font-weight:700;margin-bottom:8px">2. Importez votre fichier rempli</div>
      <input type="file" id="csv-file-input" accept=".csv" style="display:none" onchange="importParseCSV(event)" />
      <button class="btn btn-primary" onclick="document.getElementById('csv-file-input').click()">
        Choisir un fichier CSV
      </button>
      <div id="csv-status" style="margin-top:12px;font-size:13px;color:var(--text-secondary)"></div>
    </div>`;

  document.getElementById('import-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="productsCloseImport()">Annuler</button>`;
}

function importDownloadTemplate() {
  const headers = ['Nom', 'Code-barres', 'Categorie', 'Marque', "Prix d'achat", 'Prix de vente', 'Unite', 'Stock', 'Stock minimum', 'Date expiration'];
  const example = ['Riz parfume 1kg', '5000204758153', 'Epicerie', 'Aroma', '650', '850', 'pcs', '50', '10', '2027-12-31'];
  const csv = headers.join(',') + '\n' + example.join(',') + '\n';
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modele_produits_utiam.csv';
  a.click();
  URL.revokeObjectURL(url);
}

async function importParseCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const status = document.getElementById('csv-status');
  status.textContent = 'Lecture du fichier...'; status.style.color = 'var(--text-secondary)';

  try {
    const text = await file.text();
    const rows = importParseCSVText(text);

    if (rows.length === 0) {
      status.textContent = 'Fichier vide ou format invalide.'; status.style.color = 'var(--danger)';
      return;
    }

    // Detecter doublons via barcode
    const barcodes = rows.map(r => r.barcode).filter(b => b);
    let duplicates = {};
    if (barcodes.length > 0) {
      duplicates = await api('POST', '/api/products/check-duplicates', { barcodes }) || {};
    }

    // Preparer importRows
    importRows = rows.map(data => {
      const dup = data.barcode ? duplicates[data.barcode] : null;
      return {
        data,
        action: dup ? 'skip' : 'create',
        existing_id: dup ? dup.id : null,
        existing_name: dup ? dup.name : null,
        isDuplicate: !!dup,
      };
    });

    importStep = 2;
    importRenderStep2();
  } catch (e) {
    status.textContent = 'Erreur de lecture : ' + e.message;
    status.style.color = 'var(--danger)';
  }
}

function importParseCSVText(text) {
  // Detection separateur (, ; ou tabulation)
  const firstLine = text.split(/\r?\n/)[0];
  let sep = ',';
  const counts = { ',': (firstLine.match(/,/g)||[]).length, ';': (firstLine.match(/;/g)||[]).length, '\t': (firstLine.match(/\t/g)||[]).length };
  if (counts[';'] > counts[',']) sep = ';';
  if (counts['\t'] > Math.max(counts[','], counts[';'])) sep = '\t';

  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Header
  const headers = importSplitCSVLine(lines[0], sep).map(h => h.trim().toLowerCase().replace(/^\ufeff/, ''));

  // Mapping des colonnes francaises vers les champs internes
  const headerMap = {
    'nom': 'name',
    'code-barres': 'barcode', 'code barres': 'barcode', 'codebarres': 'barcode',
    'categorie': 'category', 'catégorie': 'category',
    'marque': 'brand',
    "prix d'achat": 'buy_price', 'prix achat': 'buy_price', 'prix d achat': 'buy_price',
    'prix de vente': 'sell_price', 'prix vente': 'sell_price',
    'unite': 'unit', 'unité': 'unit',
    'stock': 'stock', 'stock actuel': 'stock',
    'stock minimum': 'min_stock', 'stock min': 'min_stock',
    'date expiration': 'expiry_date', "date d'expiration": 'expiry_date', 'expiration': 'expiry_date',
  };

  const fieldIndex = {};
  headers.forEach((h, i) => {
    const field = headerMap[h];
    if (field) fieldIndex[field] = i;
  });

  // Parser lignes
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = importSplitCSVLine(lines[i], sep);
    const row = {};
    for (const field of Object.keys(fieldIndex)) {
      const v = cells[fieldIndex[field]];
      if (v !== undefined) row[field] = v.trim();
    }
    if (row.name) result.push(row);  // ignorer lignes vides
  }
  return result;
}

// Parser une ligne CSV en respectant les guillemets
function importSplitCSVLine(line, sep) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === sep && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

// ── ETAPE 2 : Apercu + resolution doublons ──
function importRenderStep2() {
  const nbCreate = importRows.filter(r => r.action === 'create').length;
  const nbUpdate = importRows.filter(r => r.action === 'update').length;
  const nbSkip = importRows.filter(r => r.action === 'skip').length;
  const nbDup = importRows.filter(r => r.isDuplicate).length;

  document.getElementById('import-content').innerHTML = `
    <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:16px">
      <div style="display:flex;gap:24px;flex-wrap:wrap;font-size:13px">
        <div><strong style="color:var(--accent)">${importRows.length}</strong> lignes lues</div>
        <div><strong style="color:var(--success)">${nbCreate}</strong> a creer</div>
        <div><strong style="color:var(--info)">${nbUpdate}</strong> a mettre a jour</div>
        <div><strong style="color:var(--text-muted)">${nbSkip}</strong> ignorees</div>
        ${nbDup > 0 ? `<div><strong style="color:var(--warning)">${nbDup}</strong> doublons detectes</div>` : ''}
      </div>
    </div>

    <div style="max-height:500px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">
      <table class="data-table" style="font-size:12px">
        <thead style="position:sticky;top:0;background:var(--bg-surface);z-index:2">
          <tr>
            <th style="width:32px">#</th>
            <th>Nom</th>
            <th>Code-barres</th>
            <th>Prix vente</th>
            <th>Stock</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${importRows.map((r, i) => importRenderRowPreview(r, i)).join('')}
        </tbody>
      </table>
    </div>`;

  document.getElementById('import-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="importRenderStep1()">Retour</button>
    <button class="btn btn-secondary" onclick="productsCloseImport()">Annuler</button>
    <button class="btn btn-primary" onclick="importDoImport()">Importer ${nbCreate + nbUpdate} produit${(nbCreate+nbUpdate)>1?'s':''}</button>`;
}

function importRenderRowPreview(r, i) {
  const dup = r.isDuplicate;
  const actionCell = dup
    ? `
      <select class="input" style="padding:4px 8px;font-size:12px" onchange="importChangeAction(${i}, this.value)">
        <option value="skip" ${r.action==='skip'?'selected':''}>Ignorer</option>
        <option value="update" ${r.action==='update'?'selected':''}>Mettre a jour</option>
        <option value="create" ${r.action==='create'?'selected':''}>Creer quand meme</option>
      </select>
      <div style="font-size:11px;color:var(--warning);margin-top:4px">Doublon: ${r.existing_name||''}</div>`
    : `<span style="color:var(--success);font-size:12px;font-weight:600">Creer</span>`;

  return `
    <tr style="${dup ? 'background:#2A1F05' : ''}">
      <td>${i+1}</td>
      <td><div style="font-weight:600">${r.data.name||'—'}</div><div style="font-size:11px;color:var(--text-muted)">${r.data.category||''}${r.data.brand?' · '+r.data.brand:''}</div></td>
      <td style="font-family:monospace;font-size:11px">${r.data.barcode||'—'}</td>
      <td style="color:var(--accent);font-weight:600">${r.data.sell_price ? Number(r.data.sell_price).toLocaleString('fr-FR') + ' F' : '—'}</td>
      <td>${r.data.stock||0}</td>
      <td>${actionCell}</td>
    </tr>`;
}

function importChangeAction(index, action) {
  importRows[index].action = action;
  importRenderStep2();
}

// ── ETAPE 3 : Lancer import ──
async function importDoImport() {
  const payload = importRows
    .filter(r => r.action !== 'skip')
    .map(r => ({ data: r.data, action: r.action, existing_id: r.existing_id }));

  document.getElementById('import-content').innerHTML = `
    <div style="text-align:center;padding:40px">
      <div style="font-size:18px;font-weight:700;margin-bottom:12px">Import en cours...</div>
      <div style="color:var(--text-secondary);font-size:13px">Veuillez patienter, ne fermez pas cette fenetre.</div>
    </div>`;
  document.getElementById('import-footer').innerHTML = '';

  const report = await api('POST', '/api/products/import', { rows: payload });
  importRenderStep3(report);
}

function importRenderStep3(report) {
  const errs = report.errors || [];
  document.getElementById('import-content').innerHTML = `
    <div style="text-align:center;padding:20px 0 30px">
      <div style="font-size:48px;margin-bottom:8px">${errs.length === 0 ? '✓' : '⚠'}</div>
      <div style="font-size:20px;font-weight:700;margin-bottom:24px;color:${errs.length === 0 ? 'var(--success)' : 'var(--warning)'}">
        Import termine
      </div>

      <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:20px">
        <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:14px 24px;min-width:120px">
          <div style="font-size:28px;font-weight:800;color:var(--success)">${report.created||0}</div>
          <div style="font-size:11px;color:var(--text-secondary);text-transform:uppercase">Crees</div>
        </div>
        <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:14px 24px;min-width:120px">
          <div style="font-size:28px;font-weight:800;color:var(--info)">${report.updated||0}</div>
          <div style="font-size:11px;color:var(--text-secondary);text-transform:uppercase">Mis a jour</div>
        </div>
        <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:14px 24px;min-width:120px">
          <div style="font-size:28px;font-weight:800;color:var(--text-muted)">${report.skipped||0}</div>
          <div style="font-size:11px;color:var(--text-secondary);text-transform:uppercase">Ignores</div>
        </div>
        ${errs.length > 0 ? `
        <div style="background:var(--bg-elevated);border:1px solid var(--danger);border-radius:8px;padding:14px 24px;min-width:120px">
          <div style="font-size:28px;font-weight:800;color:var(--danger)">${errs.length}</div>
          <div style="font-size:11px;color:var(--text-secondary);text-transform:uppercase">Erreurs</div>
        </div>` : ''}
      </div>

      ${errs.length > 0 ? `
      <div style="text-align:left;background:#2C1414;border:1px solid #5a2020;border-radius:8px;padding:12px 16px;max-height:200px;overflow-y:auto">
        <div style="font-weight:700;color:var(--danger);margin-bottom:8px">Erreurs detectees :</div>
        ${errs.map(e => `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">Ligne ${e.line} : ${e.error}</div>`).join('')}
      </div>` : ''}
    </div>`;

  document.getElementById('import-footer').innerHTML = `
    <button class="btn btn-primary" onclick="productsCloseImport()">Terminer</button>`;
}
