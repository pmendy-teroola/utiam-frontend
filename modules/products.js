/**
 * modules/products.js — U TIAM POS
 * Charte KANIENE — theme sombre
 * Avec scan code-barres (douchette + camera) + galerie multi-images
 */
let productsList    = [];
let categoriesList  = [];
let productsEditId  = null;
let productsImages  = [];   // images du produit en cours d'edition

async function renderProducts(main) {
  main.innerHTML = `
    <div style="max-width:1100px;margin:0 auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:20px;font-weight:700">Gestion des Produits</div>
          <div style="color:var(--text-secondary);font-size:13px;margin-top:2px" id="products-count">Chargement...</div>
        </div>
        <button class="btn btn-primary" onclick="productsOpenForm()">+ Nouveau produit</button>
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

    <div id="products-modal" class="modal-overlay hidden">
      <div class="modal-box">
        <div class="modal-title" id="products-modal-title">Nouveau produit</div>

        <!-- ETAPE 1 : Champs du produit -->
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

        <!-- ETAPE 2 : Galerie d'images (visible apres enregistrement) -->
        <div id="products-form-step2" style="margin-top:24px;display:none">
          <div style="font-size:14px;font-weight:700;margin-bottom:12px;color:var(--text-primary)">
            Galerie d'images
          </div>
          <div style="color:var(--text-muted);font-size:12px;margin-bottom:12px">
            Ajoutez plusieurs images pour ce produit. La premiere sera l'image principale.
          </div>
          <div id="products-gallery" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;margin-bottom:16px"></div>
          <input type="file" id="pf-file-input" accept="image/*" capture="environment" style="display:none" onchange="productsUploadImage(event)" />
          <button class="btn btn-secondary" onclick="document.getElementById('pf-file-input').click()">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
            Ajouter une image
          </button>
          <div id="pf-upload-status" style="margin-top:10px;font-size:13px;color:var(--text-secondary)"></div>
        </div>

        <div id="products-form-error" class="form-error hidden"></div>

        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="productsCloseForm()" id="products-cancel-btn">Annuler</button>
          <button class="btn btn-primary" id="products-submit-btn" onclick="productsSubmitForm()">Enregistrer</button>
        </div>
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
  if (search) {
    search.value = barcode;
    productsFilterList();
  }
}

function productsScanCamera() { scannerOpenCamera(productsOnScan); }
function productsScanForForm() {
  scannerOpenCamera((barcode) => { document.getElementById('pf-barcode').value = barcode; });
}

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
  const img = p.image_url
    ? '<img src="'+p.image_url+'" style="width:36px;height:36px;border-radius:8px;object-fit:cover;border:1px solid var(--border)" onerror="this.style.display=\'none\'" />'
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
  document.getElementById('products-submit-btn').textContent = product ? 'Mettre a jour' : 'Enregistrer';

  // Si modification, afficher la galerie immediatement
  if (product) {
    document.getElementById('products-form-step2').style.display = 'block';
    productsLoadGallery(product.id);
  } else {
    document.getElementById('products-form-step2').style.display = 'none';
    productsImages = [];
  }

  document.getElementById('products-modal').classList.remove('hidden');
}

function productsCloseForm() {
  document.getElementById('products-modal').classList.add('hidden');
  productsEditId = null;
  productsImages = [];
  productsLoad();  // recharge la liste pour voir les nouvelles images
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
    el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--text-muted);font-size:13px;border:1px dashed var(--border);border-radius:8px">Aucune image. Cliquez sur \"Ajouter une image\" ci-dessous.</div>';
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
  if (!productsEditId) {
    alert('Veuillez d\'abord enregistrer le produit.');
    return;
  }

  const status = document.getElementById('pf-upload-status');
  status.textContent = 'Envoi en cours...';
  status.style.color = 'var(--text-secondary)';

  const formData = new FormData();
  formData.append('file', file);

  try {
    const token = localStorage.getItem('utiam_token');
    const res = await fetch('/api/products/' + productsEditId + '/images', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: formData
    });

    if (res.ok) {
      status.textContent = 'Image ajoutee avec succes';
      status.style.color = 'var(--success)';
      setTimeout(() => { status.textContent = ''; }, 2000);
      await productsLoadGallery(productsEditId);
    } else {
      const err = await res.json();
      status.textContent = 'Erreur : ' + (err.error || 'echec de l\'envoi');
      status.style.color = 'var(--danger)';
    }
  } catch (e) {
    status.textContent = 'Erreur reseau : ' + e.message;
    status.style.color = 'var(--danger)';
  }

  event.target.value = '';  // reset input pour permettre le re-upload du meme fichier
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

// ── ENREGISTREMENT ─────────────────────────────────────
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
    image_url:null,  // gere par la galerie maintenant
  };

  const btn=document.getElementById('products-submit-btn');
  btn.textContent='Enregistrement...'; btn.disabled=true;

  const result=productsEditId
    ? await api('PUT','/api/products/'+productsEditId,payload)
    : await api('POST','/api/products',payload);

  btn.disabled=false;

  if(result&&result.id){
    // Si c'etait une creation, on bascule en mode edition + on affiche la galerie
    if (!productsEditId) {
      productsEditId = result.id;
      document.getElementById('products-modal-title').textContent = 'Produit cree — ajoutez des images';
      document.getElementById('products-form-step2').style.display = 'block';
      btn.textContent = 'Mettre a jour';
      document.getElementById('products-cancel-btn').textContent = 'Terminer';
      productsImages = [];
      productsRenderGallery();

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
