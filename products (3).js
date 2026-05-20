/**
 * modules/products.js — U TIAM POS — Charte KANIENE dark
 */
let productsList   = [];
let categoriesList = [];
let productsEditId = null;

async function renderProducts(main) {
  main.innerHTML = `
    <div style="max-width:1100px;margin:0 auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div>
          <div style="font-size:20px;font-weight:700">Gestion des Produits</div>
          <div style="color:var(--text-secondary);font-size:13px;margin-top:2px" id="products-count">Chargement...</div>
        </div>
        <button class="btn btn-primary" onclick="productsOpenForm()">+ Nouveau produit</button>
      </div>
      <div id="products-alerts"></div>
      <div class="card" style="padding:14px 18px;margin-bottom:16px">
        <input id="products-search" type="text" placeholder="Rechercher par nom, marque, code-barres..." class="input" style="background:var(--bg-elevated)" oninput="productsFilterList()" />
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
        <div class="form-grid">
          <div class="full"><label class="form-label">Nom *</label><input id="pf-name" type="text" class="input" placeholder="Ex : Riz parfume 1kg" /></div>
          <div><label class="form-label">Code-barres</label><input id="pf-barcode" type="text" class="input" placeholder="EAN13 ou interne" /></div>
          <div><label class="form-label">Categorie</label><select id="pf-category" class="input"></select></div>
          <div><label class="form-label">Prix achat (FCFA)</label><input id="pf-buy-price" type="number" min="0" class="input" placeholder="0" /></div>
          <div><label class="form-label">Prix vente (FCFA) *</label><input id="pf-sell-price" type="number" min="0" class="input" placeholder="0" /></div>
          <div><label class="form-label">Marque</label><input id="pf-brand" type="text" class="input" placeholder="Ex : Nestle" /></div>
          <div><label class="form-label">Unite</label><select id="pf-unit" class="input"><option value="pcs">Piece (pcs)</option><option value="kg">Kilogramme (kg)</option><option value="g">Gramme (g)</option><option value="L">Litre (L)</option><option value="cl">Centilitre (cl)</option><option value="sachet">Sachet</option><option value="boite">Boite</option><option value="carton">Carton</option></select></div>
          <div><label class="form-label">Stock actuel</label><input id="pf-stock" type="number" min="0" class="input" placeholder="0" /></div>
          <div><label class="form-label">Stock minimum</label><input id="pf-min-stock" type="number" min="0" class="input" placeholder="5" /></div>
          <div><label class="form-label">Date expiration</label><input id="pf-expiry" type="date" class="input" /></div>
          <div class="full"><label class="form-label">Image (URL)</label><input id="pf-image" type="url" class="input" placeholder="https://..." oninput="productsPreviewImage()" /><div id="pf-image-preview" style="margin-top:10px;display:none"><img id="pf-image-img" src="" style="width:64px;height:64px;border-radius:8px;object-fit:cover;border:1px solid var(--border)" /></div></div>
        </div>
        <div id="products-form-error" class="form-error hidden"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="productsCloseForm()">Annuler</button>
          <button class="btn btn-primary" id="products-submit-btn" onclick="productsSubmitForm()">Enregistrer</button>
        </div>
      </div>
    </div>`;
  await productsLoad();
}

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
  document.getElementById('pf-category').innerHTML = '<option value="">— Aucune —</option>' +
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
  document.getElementById('pf-image').value      = product?(product.image_url||''):'';
  productsPreviewImage();
  document.getElementById('products-form-error').classList.add('hidden');
  document.getElementById('products-modal').classList.remove('hidden');
}

function productsCloseForm() { document.getElementById('products-modal').classList.add('hidden'); productsEditId=null; }

function productsPreviewImage() {
  const url=document.getElementById('pf-image').value;
  const preview=document.getElementById('pf-image-preview');
  const img=document.getElementById('pf-image-img');
  if(url){img.src=url;preview.style.display='block';} else{preview.style.display='none';}
}

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
    image_url:document.getElementById('pf-image').value.trim()||null,
  };
  const btn=document.getElementById('products-submit-btn');
  btn.textContent='Enregistrement...'; btn.disabled=true;
  const result=productsEditId?await api('PUT','/api/products/'+productsEditId,payload):await api('POST','/api/products',payload);
  btn.textContent='Enregistrer'; btn.disabled=false;
  if(result&&result.id){productsCloseForm();await productsLoad();}
  else{err.textContent='Erreur enregistrement.';err.classList.remove('hidden');}
}

async function productsDelete(id,name) {
  if(!confirm('Supprimer "'+name+'" ?\nAction irreversible.')) return;
  await api('DELETE','/api/products/'+id);
  await productsLoad();
}
