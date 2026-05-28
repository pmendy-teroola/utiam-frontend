/**
 * core/scanner.js — U TIAM POS
 * Module reutilisable de scan code-barres.
 * Mode douchette (clavier rapide) + mode camera (html5-qrcode).
 *
 * Usage :
 *   scannerStartListening(callback)   // demarre l'ecoute douchette globale
 *   scannerStopListening()            // arrete l'ecoute
 *   scannerOpenCamera(callback)       // ouvre la modal camera
 *
 * Le callback recoit le code-barres scanne (string).
 */

let scannerBuffer    = '';
let scannerLastKey   = 0;
let scannerCallback  = null;
let scannerHtml5Qr   = null;

// ── DOUCHETTE (clavier rapide) ──────────────────────────
function scannerStartListening(callback) {
  scannerCallback = callback;
  document.addEventListener('keydown', scannerKeyHandler);
}

function scannerStopListening() {
  scannerCallback = null;
  document.removeEventListener('keydown', scannerKeyHandler);
}

function scannerKeyHandler(e) {
  // Ignore si on tape dans un input ou textarea
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

  const now = Date.now();

  // Si plus de 100ms entre 2 touches, c'est un humain qui tape, on reset
  if (now - scannerLastKey > 100) scannerBuffer = '';
  scannerLastKey = now;

  // Entree = fin du scan
  if (e.key === 'Enter') {
    if (scannerBuffer.length >= 4 && scannerCallback) {
      scannerCallback(scannerBuffer);
    }
    scannerBuffer = '';
    return;
  }

  // Touche imprimable -> on ajoute au buffer
  if (e.key.length === 1) {
    scannerBuffer += e.key;
  }
}

// ── CAMERA (html5-qrcode) ───────────────────────────────
function scannerOpenCamera(callback) {
  // Cree la modal si elle n'existe pas
  let modal = document.getElementById('scanner-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'scanner-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:480px">
        <div class="modal-title">Scanner un code-barres</div>
        <div id="scanner-reader" style="width:100%;background:#000;border-radius:8px;overflow:hidden"></div>
        <div id="scanner-status" style="color:var(--text-secondary);font-size:13px;text-align:center;margin-top:12px">Initialisation de la camera...</div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="scannerCloseCamera()">Fermer</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  modal.classList.remove('hidden');
  modal.style.display = 'flex';

  // Initialise html5-qrcode
  if (typeof Html5Qrcode === 'undefined') {
    document.getElementById('scanner-status').textContent = 'Erreur : bibliotheque non chargee';
    return;
  }

  scannerHtml5Qr = new Html5Qrcode('scanner-reader');
  scannerHtml5Qr.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 150 } },
    (decodedText) => {
      document.getElementById('scanner-status').textContent = 'Code detecte : ' + decodedText;
      scannerCloseCamera();
      if (callback) callback(decodedText);
    },
    () => {}  // erreurs de scan ignorees (normales)
  ).then(() => {
    document.getElementById('scanner-status').textContent = 'Pointez la camera vers le code-barres';
  }).catch(err => {
    document.getElementById('scanner-status').textContent = 'Erreur camera : ' + err;
  });
}

function scannerCloseCamera() {
  const modal = document.getElementById('scanner-modal');
  if (scannerHtml5Qr) {
    scannerHtml5Qr.stop().then(() => {
      scannerHtml5Qr.clear();
      scannerHtml5Qr = null;
    }).catch(() => {});
  }
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}
