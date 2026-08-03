// ── Hjælpefunktioner ─────────────────────────────────────────────────────
// Bruges på tværs af hele appen

function escapeHTML(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

function readImageAsDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(''); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
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
  const statusMap = {
    'Planning': translations[currentLanguage].statusPlanning,
    'In progress': translations[currentLanguage].statusInProgress,
    'Finished': translations[currentLanguage].statusFinished
  };
  return statusMap[status] || status;
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
