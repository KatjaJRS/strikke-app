// ── Forside — hero-billede, sprog og navigation ───────────────────────────

function updateHeroImage() {
  // Hero-billedet styres uafhængigt — skiftes kun via 📷 knappen
}

function applyLanguage(lang) {
  currentLanguage = normalizeLanguage(lang);
  localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
  document.documentElement.lang = currentLanguage;
  if (currentUser?.email) {
    saveLanguageForEmail(currentUser.email, currentLanguage);
  }

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    el.textContent = translations[currentLanguage][key] || el.textContent;
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = translations[currentLanguage][key] || el.placeholder;
  });

  langButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === currentLanguage);
  });

  if (typeof syncPasswordToggleButtons === 'function') syncPasswordToggleButtons();

  renderProjects();
  renderGroups();
}

function switchSection(sectionId) {
  sectionViews.forEach((section) => section.classList.remove('active'));
  const activeSection = document.getElementById(sectionId);
  if (activeSection) activeSection.classList.add('active');
  navButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.section === sectionId);
  });
}

// ── Sprogknapper ──────────────────────────────────────────────────────────
langButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyLanguage(button.dataset.lang);
    queueSettingsSync();
  });
});

// ── Navigationsknapper ────────────────────────────────────────────────────
navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    switchSection(button.dataset.section);
    if (button.dataset.section === 'groups-chats') markGroupsAsRead();
  });
});

// ── Hero-billede: træk/pan og upload ─────────────────────────────────────
function applyHeroImageFromStorage() {
  if (!heroImage) return;
  const savedHeroImage = localStorage.getItem(HERO_IMAGE_KEY);
  if (savedHeroImage) heroImage.src = savedHeroImage;
  try {
    const pan = JSON.parse(localStorage.getItem(HERO_PAN_KEY) || '{"x":50,"y":50}');
    heroImage.style.objectPosition = `${pan.x}% ${pan.y}%`;
  } catch { /* beholder nuværende position */ }
}

if (heroImage) {
  const savedHeroImage = localStorage.getItem(HERO_IMAGE_KEY);
  if (savedHeroImage) heroImage.src = savedHeroImage;

  const savedPan = JSON.parse(localStorage.getItem(HERO_PAN_KEY) || '{"x":50,"y":50}');
  heroImage.style.objectPosition = `${savedPan.x}% ${savedPan.y}%`;

  let isDragging = false, dragStartX = 0, dragStartY = 0, panX = savedPan.x, panY = savedPan.y;

  heroImage.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    heroImage.style.cursor = 'grabbing';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = (e.clientX - dragStartX) / heroImage.offsetWidth * -100;
    const dy = (e.clientY - dragStartY) / heroImage.offsetHeight * -100;
    panX = Math.max(0, Math.min(100, savedPan.x + dx));
    panY = Math.max(0, Math.min(100, savedPan.y + dy));
    heroImage.style.objectPosition = `${panX}% ${panY}%`;
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    heroImage.style.cursor = 'grab';
    savedPan.x = panX;
    savedPan.y = panY;
    localStorage.setItem(HERO_PAN_KEY, JSON.stringify({ x: panX, y: panY }));
    queueSettingsSync();
  });

  heroImage.style.cursor = 'grab';

  heroImage.addEventListener('click', (e) => {
    if (Math.abs(e.clientX - dragStartX) > 5 || Math.abs(e.clientY - dragStartY) > 5) return;
    const orderedProjects = getOrderedProjects();
    if (orderedProjects.length > 1) {
      projects = projects.map((p) => ({
        ...p,
        lastViewedAt: p.id === orderedProjects[1].id ? Date.now() : p.lastViewedAt
      }));
      saveProjects({ showBusy: false });
      renderProjects();
      updateHeroImage();
    }
  });
}

const heroImageInput = document.getElementById('hero-image-input');
if (heroImageInput) {
  heroImageInput.addEventListener('change', async () => {
    const file = heroImageInput.files[0];
    if (!file) return;
    const dataUrl = await storeImageFile(file, 'hero');
    if (!dataUrl) return;
    heroImage.src = dataUrl;
    localStorage.setItem(HERO_IMAGE_KEY, dataUrl);
    queueSettingsSync();
    heroImageInput.value = '';
  });
}
