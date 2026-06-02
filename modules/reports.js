/**
 * modules/reports.js — U TIAM POS — Module Rapports
 * Charte KANIENE — theme sombre
 *
 * Fonctionnalites :
 * - Tableau de bord avec selecteur de periode
 * - CA, ventes, panier moyen, marge brute
 * - Top produits, top clients
 * - Ventilation par mode de paiement (camembert)
 * - CA par heure (graphique barres)
 * - CA par caissier
 * - Valeur du stock
 * - Alertes stock
 * - Impression + Export CSV
 *
 * Dependances : Chart.js (charge via CDN au besoin)
 */

let reportsData = null;
let reportsStockValue = null;
let reportsPeriod = 'today';  // today | week | month | custom
let reportsCustomFrom = '';
let reportsCustomTo = '';

// Pour Chart.js
let chartPayment = null;
let chartHourly = null;

const PAYMENT_LABELS = {
  especes: 'Especes',
  mobile_money: 'Mobile Money',
  carte_bancaire: 'Carte',
  cheque: 'Cheque',
  credit_client: 'Credit client',
};

const PAYMENT_COLORS = {
  especes: '#2ecc71',
  mobile_money: '#3498db',
  carte_bancaire: '#d4af37',
  cheque: '#e67e22',
  credit_client: '#9b59b6',
};

async function renderReports(main) {
  main.innerHTML = `
    <div style="max-width:1280px;margin:0 auto">

      <!-- En-tete -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:20px;font-weight:700">Rapports & Tableau de bord</div>
          <div style="color:var(--text-secondary);font-size:13px;margin-top:2px" id="reports-period-label">Chargement...</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary" onclick="reportsPrint()">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            Imprimer
          </button>
          <button class="btn btn-secondary" onclick="reportsExportCSV()">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
            Export CSV
          </button>
        </div>
      </div>

      <!-- Filtres periode -->
      <div class="card" style="padding:14px 18px;margin-bottom:20px">
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <div style="color:var(--text-muted);font-size:12px;margin-right:6px;text-transform:uppercase;letter-spacing:0.05em">Periode :</div>
          <button class="btn-period" data-period="today" onclick="reportsSetPeriod('today')">Aujourd'hui</button>
          <button class="btn-period" data-period="week" onclick="reportsSetPeriod('week')">Cette semaine</button>
          <button class="btn-period" data-period="month" onclick="reportsSetPeriod('month')">Ce mois</button>
          <button class="btn-period" data-period="custom" onclick="reportsSetPeriod('custom')">Personnalise</button>
        </div>
        <div id="reports-custom-range" style="display:none;margin-top:12px;gap:10px;flex-wrap:wrap;align-items:flex-end">
          <div>
            <label class="form-label">Du</label>
            <input type="date" class="input" id="reports-from" />
          </div>
          <div>
            <label class="form-label">Au</label>
            <input type="date" class="input" id="reports-to" />
          </div>
          <button class="btn btn-primary" onclick="reportsApplyCustom()">Appliquer</button>
        </div>
      </div>

      <div id="reports-content">
        <div style="text-align:center;padding:60px;color:var(--text-secondary)">Chargement des donnees...</div>
      </div>
    </div>

    <style>
      .btn-period {
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
      .btn-period:hover { background: var(--bg-elevated); color: var(--text-primary); }
      .btn-period.active { background: var(--accent); color: #000; border-color: var(--accent); }

      .kpi-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 16px 18px;
      }
      .kpi-card .kpi-label {
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 6px;
      }
      .kpi-card .kpi-value {
        font-size: 26px;
        font-weight: 800;
        line-height: 1.1;
      }
      .kpi-card .kpi-sub {
        font-size: 11px;
        color: var(--text-secondary);
        margin-top: 4px;
      }
    </style>`;

  reportsUpdatePeriodButtons();
  await reportsLoadData();
}

function reportsSetPeriod(period) {
  reportsPeriod = period;
  reportsUpdatePeriodButtons();
  const customZone = document.getElementById('reports-custom-range');
  if (period === 'custom') {
    customZone.style.display = 'flex';
  } else {
    customZone.style.display = 'none';
    reportsLoadData();
  }
}

function reportsUpdatePeriodButtons() {
  document.querySelectorAll('.btn-period').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === reportsPeriod);
  });
}

function reportsApplyCustom() {
  reportsCustomFrom = document.getElementById('reports-from').value;
  reportsCustomTo = document.getElementById('reports-to').value;
  if (!reportsCustomFrom || !reportsCustomTo) {
    alert('Veuillez choisir une date de debut et de fin.');
    return;
  }
  reportsLoadData();
}

function reportsGetDateRange() {
  const today = new Date();
  const fmt = (d) => d.toISOString().split('T')[0];
  if (reportsPeriod === 'today') return { from: fmt(today), to: fmt(today) };
  if (reportsPeriod === 'week') {
    const start = new Date(today);
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;  // lundi
    start.setDate(start.getDate() - diff);
    return { from: fmt(start), to: fmt(today) };
  }
  if (reportsPeriod === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: fmt(start), to: fmt(today) };
  }
  if (reportsPeriod === 'custom') return { from: reportsCustomFrom, to: reportsCustomTo };
  return { from: fmt(today), to: fmt(today) };
}

async function reportsLoadData() {
  const range = reportsGetDateRange();
  document.getElementById('reports-content').innerHTML =
    '<div style="text-align:center;padding:60px;color:var(--text-secondary)">Chargement...</div>';

  const [summary, stockValue] = await Promise.all([
    api('GET', `/api/reports/summary?from=${range.from}&to=${range.to}`),
    api('GET', '/api/reports/stock-value'),
  ]);

  reportsData = summary;
  reportsStockValue = stockValue;

  // Update label periode
  const fmt = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const periodLabels = {
    today: "Aujourd'hui — " + fmt(range.from),
    week: "Cette semaine — du " + fmt(range.from) + " au " + fmt(range.to),
    month: "Ce mois — du " + fmt(range.from) + " au " + fmt(range.to),
    custom: "Du " + fmt(range.from) + " au " + fmt(range.to),
  };
  document.getElementById('reports-period-label').textContent = periodLabels[reportsPeriod] || '';

  reportsRender();
}

function reportsRender() {
  const d = reportsData;
  const sv = reportsStockValue;
  if (!d) return;

  const fmtMoney = (n) => Number(n || 0).toLocaleString('fr-FR') + ' F';
  const fmtNum = (n) => Number(n || 0).toLocaleString('fr-FR');

  document.getElementById('reports-content').innerHTML = `
    <!-- KPI principaux -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px" id="reports-kpis">
      <div class="kpi-card">
        <div class="kpi-label">💰 Chiffre d'affaires</div>
        <div class="kpi-value" style="color:var(--accent)">${fmtMoney(d.revenue.total)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">🛒 Ventes</div>
        <div class="kpi-value">${fmtNum(d.revenue.count)}</div>
        <div class="kpi-sub">tickets encaisses</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">📊 Panier moyen</div>
        <div class="kpi-value">${fmtMoney(d.revenue.avg_basket)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">💵 Marge brute</div>
        <div class="kpi-value" style="color:${d.margin.gross >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmtMoney(d.margin.gross)}</div>
        <div class="kpi-sub">${d.margin.rate.toFixed(1)}% du CA</div>
      </div>
    </div>

    ${d.revenue.count === 0 ? `
      <div class="card" style="text-align:center;padding:50px;color:var(--text-secondary)">
        <div style="font-size:48px;margin-bottom:12px">📭</div>
        <div style="font-size:16px;font-weight:600">Aucune vente sur la periode selectionnee</div>
        <div style="font-size:13px;margin-top:6px">Selectionnez une autre periode ou commencez a vendre en caisse.</div>
      </div>
    ` : `

    <!-- Graphiques : paiements + horaire -->
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:16px;margin-bottom:20px" id="reports-charts">
      <div class="card">
        <div style="font-size:14px;font-weight:700;margin-bottom:14px">Modes de paiement</div>
        ${d.payment_methods.length === 0 ? '<div style="color:var(--text-muted);text-align:center;padding:30px">Aucune donnee</div>' : `
          <div style="position:relative;height:240px"><canvas id="chart-payment"></canvas></div>
          <div style="margin-top:14px;font-size:12px">
            ${d.payment_methods.map(p => `
              <div style="display:flex;justify-content:space-between;padding:4px 0">
                <span style="display:flex;align-items:center;gap:6px">
                  <span style="width:10px;height:10px;border-radius:50%;background:${PAYMENT_COLORS[p.payment_method]||'#666'}"></span>
                  ${PAYMENT_LABELS[p.payment_method] || p.payment_method}
                </span>
                <span style="font-weight:600">${fmtMoney(p.total)} <span style="color:var(--text-muted)">(${p.count})</span></span>
              </div>`).join('')}
          </div>
        `}
      </div>

      <div class="card">
        <div style="font-size:14px;font-weight:700;margin-bottom:14px">CA par heure</div>
        ${d.hourly_sales.length === 0 ? '<div style="color:var(--text-muted);text-align:center;padding:30px">Aucune donnee</div>' : `
          <div style="position:relative;height:280px"><canvas id="chart-hourly"></canvas></div>
        `}
      </div>
    </div>

    <!-- Top produits + Top clients -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:14px 18px;border-bottom:1px solid var(--border);font-size:14px;font-weight:700">🏆 Top produits</div>
        ${d.top_products.length === 0 ? '<div style="padding:30px;text-align:center;color:var(--text-muted)">Aucune vente</div>' : `
          <table class="data-table">
            <thead><tr><th>Produit</th><th style="text-align:right">Qte</th><th style="text-align:right">CA</th></tr></thead>
            <tbody>
              ${d.top_products.map((p, i) => `
                <tr>
                  <td><span style="color:var(--accent);font-weight:700">${i+1}.</span> ${p.name}</td>
                  <td style="text-align:right;font-weight:600">${fmtNum(p.qty)}</td>
                  <td style="text-align:right;color:var(--accent);font-weight:700">${fmtMoney(p.revenue)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        `}
      </div>

      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:14px 18px;border-bottom:1px solid var(--border);font-size:14px;font-weight:700">👥 Top clients</div>
        ${d.top_clients.length === 0 ? `<div style="padding:30px;text-align:center;color:var(--text-muted)">Aucune vente avec client.<br><span style="font-size:12px">Selectionnez un client lors des ventes pour suivre leur activite.</span></div>` : `
          <table class="data-table">
            <thead><tr><th>Client</th><th style="text-align:right">Visites</th><th style="text-align:right">CA</th></tr></thead>
            <tbody>
              ${d.top_clients.map((c, i) => `
                <tr>
                  <td><span style="color:var(--accent);font-weight:700">${i+1}.</span> ${c.name}<div style="font-size:11px;color:var(--text-muted)">${c.phone||''}</div></td>
                  <td style="text-align:right;font-weight:600">${fmtNum(c.visits)}</td>
                  <td style="text-align:right;color:var(--accent);font-weight:700">${fmtMoney(c.revenue)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>

    <!-- Caissiers + Marge detail -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:20px">
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:14px 18px;border-bottom:1px solid var(--border);font-size:14px;font-weight:700">🧑‍💼 Performance par caissier</div>
        ${d.cashiers.length === 0 ? '<div style="padding:30px;text-align:center;color:var(--text-muted)">Aucune donnee</div>' : `
          <table class="data-table">
            <thead><tr><th>Caissier</th><th>Role</th><th style="text-align:right">Ventes</th><th style="text-align:right">Panier moyen</th><th style="text-align:right">CA</th></tr></thead>
            <tbody>
              ${d.cashiers.map(c => `
                <tr>
                  <td style="font-weight:600">${c.display_name}</td>
                  <td><span class="badge badge-info">${c.role}</span></td>
                  <td style="text-align:right">${fmtNum(c.count)}</td>
                  <td style="text-align:right">${fmtMoney(c.avg_basket)}</td>
                  <td style="text-align:right;color:var(--accent);font-weight:700">${fmtMoney(c.total)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        `}
      </div>

      <div class="card">
        <div style="font-size:14px;font-weight:700;margin-bottom:14px">📈 Detail marge brute</div>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:13px">
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
            <span style="color:var(--text-secondary)">CA total</span>
            <span style="font-weight:700">${fmtMoney(d.margin.revenue)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
            <span style="color:var(--text-secondary)">Cout marchandises</span>
            <span style="font-weight:700;color:var(--danger)">−${fmtMoney(d.margin.cost)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:15px">
            <span style="font-weight:700">Marge brute</span>
            <span style="font-weight:800;color:${d.margin.gross >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmtMoney(d.margin.gross)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-elevated);padding:10px 12px;border-radius:8px;margin-top:4px">
            <span style="color:var(--text-secondary);font-size:12px">Taux de marge</span>
            <span style="font-weight:800;font-size:18px;color:${d.margin.rate >= 30 ? 'var(--success)' : d.margin.rate >= 10 ? 'var(--warning)' : 'var(--danger)'}">${d.margin.rate.toFixed(1)}%</span>
          </div>
          ${d.margin.cost === 0 ? '<div style="font-size:11px;color:var(--text-muted);margin-top:6px;text-align:center">⚠ Aucun prix d\'achat renseigne — marge non calculee</div>' : ''}
        </div>
      </div>
    </div>
    `}

    <!-- Valeur du stock + Alertes -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">

      <div class="card">
        <div style="font-size:14px;font-weight:700;margin-bottom:14px">📦 Valeur du stock actuel</div>
        ${sv ? `
          <div style="display:flex;flex-direction:column;gap:10px;font-size:13px">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
              <span style="color:var(--text-secondary)">Produits actifs en stock</span>
              <span style="font-weight:700">${fmtNum(sv.product_count)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
              <span style="color:var(--text-secondary)">Unites totales</span>
              <span style="font-weight:700">${fmtNum(sv.total_units)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
              <span style="color:var(--text-secondary)">Valeur a prix d'achat</span>
              <span style="font-weight:700">${fmtMoney(sv.value_buy)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
              <span style="color:var(--text-secondary)">Valeur a prix de vente</span>
              <span style="font-weight:700;color:var(--accent)">${fmtMoney(sv.value_sell)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-elevated);padding:10px 12px;border-radius:8px;margin-top:4px">
              <span style="color:var(--text-secondary);font-size:12px">Marge potentielle</span>
              <span style="font-weight:800;color:var(--success)">${fmtMoney(sv.potential_margin)}</span>
            </div>
          </div>
        ` : '<div style="color:var(--text-muted)">Chargement...</div>'}
      </div>

      <div class="card">
        <div style="font-size:14px;font-weight:700;margin-bottom:14px">⚠ Alertes stock</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div style="background:var(--bg-elevated);border:1px solid ${d.out_of_stock.length>0?'var(--danger)':'var(--border)'};border-radius:8px;padding:12px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">En rupture</div>
            <div style="font-size:24px;font-weight:800;color:${d.out_of_stock.length>0?'var(--danger)':'var(--text-muted)'}">${d.out_of_stock.length}</div>
          </div>
          <div style="background:var(--bg-elevated);border:1px solid ${d.low_stock.length>0?'var(--warning)':'var(--border)'};border-radius:8px;padding:12px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Stock bas</div>
            <div style="font-size:24px;font-weight:800;color:${d.low_stock.length>0?'var(--warning)':'var(--text-muted)'}">${d.low_stock.length}</div>
          </div>
        </div>
        ${d.low_stock.length === 0 && d.out_of_stock.length === 0 ? `
          <div style="text-align:center;color:var(--success);font-size:13px;padding:10px">✓ Tout va bien !</div>
        ` : `
          <div style="font-size:12px;max-height:140px;overflow-y:auto">
            ${d.out_of_stock.slice(0,5).map(p => `<div style="padding:4px 0;color:var(--danger)">🔴 ${p.name}</div>`).join('')}
            ${d.low_stock.slice(0,5).map(p => `<div style="padding:4px 0;color:var(--warning)">🟡 ${p.name} (${p.stock}/${p.min_stock})</div>`).join('')}
          </div>
        `}
      </div>

    </div>`;

  // Charge Chart.js si necessaire et dessine les graphiques
  if (d.revenue.count > 0) {
    reportsLoadChartJS().then(() => reportsDrawCharts());
  }
}

// Charge Chart.js depuis CDN (une seule fois)
function reportsLoadChartJS() {
  return new Promise((resolve) => {
    if (window.Chart) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    script.onload = () => resolve();
    script.onerror = () => resolve();  // continue meme si echec
    document.head.appendChild(script);
  });
}

function reportsDrawCharts() {
  if (!window.Chart || !reportsData) return;
  const d = reportsData;

  // Detruire les anciens graphiques pour eviter les fuites
  if (chartPayment) { chartPayment.destroy(); chartPayment = null; }
  if (chartHourly) { chartHourly.destroy(); chartHourly = null; }

  // Mode paiement (donut)
  const paymentCanvas = document.getElementById('chart-payment');
  if (paymentCanvas && d.payment_methods.length > 0) {
    const labels = d.payment_methods.map(p => PAYMENT_LABELS[p.payment_method] || p.payment_method);
    const data = d.payment_methods.map(p => Number(p.total));
    const colors = d.payment_methods.map(p => PAYMENT_COLORS[p.payment_method] || '#666');

    chartPayment = new Chart(paymentCanvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#161616', borderWidth: 2 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        cutout: '60%',
      }
    });
  }

  // CA par heure (barres)
  const hourlyCanvas = document.getElementById('chart-hourly');
  if (hourlyCanvas && d.hourly_sales.length > 0) {
    // Construire un tableau complet 0-23h
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const map = {};
    for (const h of d.hourly_sales) map[Number(h.hour)] = Number(h.total);
    const data = hours.map(h => map[h] || 0);
    // Ne pas afficher les heures sans activite au debut/fin
    let firstNonZero = data.findIndex(v => v > 0);
    let lastNonZero = data.length - 1 - [...data].reverse().findIndex(v => v > 0);
    if (firstNonZero === -1) { firstNonZero = 8; lastNonZero = 20; }
    firstNonZero = Math.max(0, firstNonZero - 1);
    lastNonZero = Math.min(23, lastNonZero + 1);
    const slicedHours = hours.slice(firstNonZero, lastNonZero + 1);
    const slicedData = data.slice(firstNonZero, lastNonZero + 1);

    chartHourly = new Chart(hourlyCanvas, {
      type: 'bar',
      data: {
        labels: slicedHours.map(h => h + 'h'),
        datasets: [{
          label: 'CA',
          data: slicedData,
          backgroundColor: '#d4af37',
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => Number(ctx.parsed.y).toLocaleString('fr-FR') + ' F' } }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: '#a0a0a0', callback: (v) => Number(v).toLocaleString('fr-FR') + ' F' },
            grid: { color: '#222' },
          },
          x: {
            ticks: { color: '#a0a0a0' },
            grid: { display: false },
          }
        }
      }
    });
  }
}

// ── IMPRESSION ──
function reportsPrint() {
  if (!reportsData) return;
  window.print();
}

// ── EXPORT CSV ──
function reportsExportCSV() {
  if (!reportsData) return;
  const d = reportsData;
  const range = reportsGetDateRange();

  const lines = [];
  lines.push('RAPPORT U TIAM');
  lines.push(`Periode,du ${range.from},au ${range.to}`);
  lines.push('');

  // KPI
  lines.push('INDICATEURS');
  lines.push(`Chiffre d'affaires,${d.revenue.total}`);
  lines.push(`Nombre de ventes,${d.revenue.count}`);
  lines.push(`Panier moyen,${d.revenue.avg_basket.toFixed(2)}`);
  lines.push(`Marge brute,${d.margin.gross}`);
  lines.push(`Taux de marge,${d.margin.rate.toFixed(2)}%`);
  lines.push('');

  // Modes de paiement
  if (d.payment_methods.length > 0) {
    lines.push('MODES DE PAIEMENT');
    lines.push('Mode,Nombre,Montant');
    for (const p of d.payment_methods) {
      lines.push(`${PAYMENT_LABELS[p.payment_method] || p.payment_method},${p.count},${p.total}`);
    }
    lines.push('');
  }

  // Top produits
  if (d.top_products.length > 0) {
    lines.push('TOP PRODUITS');
    lines.push('Rang,Produit,Quantite,Chiffre d\'affaires');
    d.top_products.forEach((p, i) => {
      lines.push(`${i+1},"${p.name.replace(/"/g,'""')}",${p.qty},${p.revenue}`);
    });
    lines.push('');
  }

  // Top clients
  if (d.top_clients.length > 0) {
    lines.push('TOP CLIENTS');
    lines.push('Rang,Client,Telephone,Visites,Chiffre d\'affaires');
    d.top_clients.forEach((c, i) => {
      lines.push(`${i+1},"${c.name.replace(/"/g,'""')}",${c.phone||''},${c.visits},${c.revenue}`);
    });
    lines.push('');
  }

  // Caissiers
  if (d.cashiers.length > 0) {
    lines.push('PERFORMANCE PAR CAISSIER');
    lines.push('Caissier,Role,Ventes,Panier moyen,Chiffre d\'affaires');
    for (const c of d.cashiers) {
      lines.push(`"${c.display_name.replace(/"/g,'""')}",${c.role},${c.count},${Number(c.avg_basket).toFixed(2)},${c.total}`);
    }
    lines.push('');
  }

  // CA par heure
  if (d.hourly_sales.length > 0) {
    lines.push('CA PAR HEURE');
    lines.push('Heure,Nombre de ventes,Chiffre d\'affaires');
    for (const h of d.hourly_sales) {
      lines.push(`${h.hour}h,${h.count},${h.total}`);
    }
    lines.push('');
  }

  const csv = '\ufeff' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rapport_utiam_${range.from}_${range.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
