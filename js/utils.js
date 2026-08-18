// ── Hjælpefunktioner ─────────────────────────────────────────────────────
// Bruges på tværs af hele appen

function escapeHTML(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

const MAX_IMAGE_DIMENSION = 1400;
const IMAGE_QUALITY = 0.82;

// Billeder gemmes som data-URL i databasen, så de komprimeres for at undgå
// at gemninger fejler på store fotos fra mobilkameraet.
function compressDataURL(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
      if (scale === 1 && dataUrl.length < 400000) { resolve(dataUrl); return; }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      try {
        resolve(canvas.toDataURL('image/jpeg', IMAGE_QUALITY));
      } catch {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

function readImageAsDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(''); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(compressDataURL(String(reader.result || '')));
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

let syncToastTimer = null;
function showSyncToast(message, tone = 'error') {
  let toast = document.getElementById('sync-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sync-toast';
    toast.style.cssText = `
      position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
      max-width: 90vw; padding: 12px 18px; border-radius: 10px; color: #fff;
      font-weight: 600; z-index: 2000; box-shadow: 0 6px 18px rgba(0,0,0,0.18);
      text-align: center;
    `;
    document.body.appendChild(toast);
  }
  toast.style.background = tone === 'error' ? '#c0392b' : '#3f8f5f';
  toast.textContent = message;
  toast.style.display = 'block';
  if (syncToastTimer) clearTimeout(syncToastTimer);
  syncToastTimer = setTimeout(() => { toast.style.display = 'none'; }, 4500);
}

function getOrderedProjects() {
  return [...projects].sort((a, b) => {
    const aTime = Number(a.lastViewedAt || 0);
    const bTime = Number(b.lastViewedAt || 0);
    return bTime - aTime;
  });
}

function renderStars(rating) {
  const stars = [];
  for (let i = 1; i <= 5; i++) stars.push(i <= rating ? '⭐' : '☆');
  return stars.join('');
}

function renderHearts(difficulty) {
  const icons = [];
  for (let i = 1; i <= 5; i++) {
    icons.push(`<span class="difficulty-icon${i <= difficulty ? '' : ' is-empty'}">🧶</span>`);
  }
  return `<span class="difficulty-icons" aria-label="Difficulty ${difficulty} of 5">${icons.join('')}</span>`;
}

function translateStatus(status) {
  const normalizedStatus = normalizeProjectStatus(status);
  const statusMap = {
    'Planning': translations[currentLanguage].statusPlanning,
    'In progress': translations[currentLanguage].statusInProgress,
    'Finished': translations[currentLanguage].statusFinished
  };
  return statusMap[normalizedStatus] || normalizedStatus;
}

function renderYarns(yarns) {
  const yarnsList = yarns.filter(y => y.type).map(y => {
    const colorDot = y.color ? `<span class="color-swatch" style="background-color: ${escapeHTML(y.color)};"></span>` : '';
    return `${colorDot}${escapeHTML(y.type)}${y.amount ? ` - ${escapeHTML(y.amount)}` : ''}`;
  }).join(' ');
  return yarnsList ? `<p><strong>${translations[currentLanguage].yarnsDisplayLabel}:</strong> ${yarnsList}</p>` : '';
}

function renderNeedles(needles) {
  if (!Array.isArray(needles)) needles = needles ? [needles] : [];
  const needlesList = needles.filter(n => n && n.trim()).map(n => escapeHTML(n)).join(' ');
  return needlesList ? `<p><strong>${translations[currentLanguage].needlesDisplayLabel}:</strong> ${needlesList}</p>` : '';
}

function normalizeProjectStatus(status) {
  const statusMap = {
    Planning: 'Planning',
    'In progress': 'In progress',
    Finished: 'Finished',
    Planlægger: 'Planning',
    'I gang': 'In progress',
    Færdig: 'Finished',
  };
  return statusMap[status] || status || 'Planning';
}

function getAmountUsedString(yarns) {
  const amounts = yarns.filter(y => y.amount).map(y => escapeHTML(y.amount));
  return amounts.length > 0 ? amounts.join(' / ') : '';
}

function getAvatarHTML(name, picUrl) {
  if (picUrl) return `<img class="avatar" src="${picUrl}" alt="${escapeHTML(name)}" />`;
  const initials = name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return `<span class="avatar avatar-initials" style="background:hsl(${hue},55%,65%)">${escapeHTML(initials)}</span>`;
}

let busyCount = 0;
let busyShowTimer = null;
let busyShownAt = 0;
const BUSY_SHOW_DELAY_MS = 0;
const BUSY_MIN_VISIBLE_MS = 650;

function showBusyOverlay(message = 'Strikker lige...') {
  const overlay = document.getElementById('busy-overlay');
  const text = document.getElementById('busy-text');
  if (!overlay || !text) return;
  text.textContent = message;
  busyCount += 1;
  if (busyCount === 1) {
    busyShowTimer = setTimeout(() => {
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
      busyShownAt = Date.now();
    }, BUSY_SHOW_DELAY_MS);
  }
}

function hideBusyOverlay() {
  const overlay = document.getElementById('busy-overlay');
  if (!overlay) return;
  busyCount = Math.max(0, busyCount - 1);
  if (busyCount === 0) {
    if (busyShowTimer) {
      clearTimeout(busyShowTimer);
      busyShowTimer = null;
    }
    const elapsed = Date.now() - busyShownAt;
    const wait = elapsed < BUSY_MIN_VISIBLE_MS ? (BUSY_MIN_VISIBLE_MS - elapsed) : 0;
    setTimeout(() => {
      if (busyCount > 0) return;
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
    }, wait);
  }
}

async function runWithBusy(task, message) {
  showBusyOverlay(message);
  try {
    return await task();
  } finally {
    hideBusyOverlay();
  }
}

let highfiveTimer = null;
function showHighfiveCelebration() {
  const toast = document.getElementById('highfive-toast');
  if (!toast) return;
  toast.classList.add('active');
  toast.setAttribute('aria-hidden', 'false');
  if (highfiveTimer) clearTimeout(highfiveTimer);
  highfiveTimer = setTimeout(() => {
    toast.classList.remove('active');
    toast.setAttribute('aria-hidden', 'true');
  }, 1700);
}

function shouldCelebrateFinishTransition(previousStatus, nextStatus) {
  const allowedPreviousStatuses = ['Planning', 'In progress'];
  const normalizedPreviousStatus = normalizeProjectStatus(previousStatus);
  const normalizedNextStatus = normalizeProjectStatus(nextStatus);
  return allowedPreviousStatuses.includes(normalizedPreviousStatus) && normalizedNextStatus === 'Finished';
}
