// ── Nuværende projekt — formular, redigering og auto-gem ──────────────────

// ── Garnrækker ────────────────────────────────────────────────────────────
function getYarnInputs() {
  return Array.from(yarnRowsContainer.querySelectorAll('.yarn-entry')).map(entry => ({
    type: entry.querySelector('.yarn-type'),
    group: entry.querySelector('.yarn-group'),
    color: entry.querySelector('.yarn-color'),
    amount: entry.querySelector('.yarn-amount'),
    details: entry.querySelector('.yarn-details'),
  }));
}

function addYarnRow(typeVal = '', groupVal = '', colorVal = '', amountVal = '', detailsVal = '') {
  const entry = document.createElement('div');
  entry.className = 'yarn-entry';
  entry.innerHTML = `
    <input type="text" class="yarn-type" data-i18n-placeholder="yarnTypePlaceholder" placeholder="${escapeHTML(translations[currentLanguage].yarnTypePlaceholder || 'Yarn type')}" value="${escapeHTML(typeVal)}" />
    <input type="text" class="yarn-group" data-i18n-placeholder="yarnGroupPlaceholder" placeholder="${escapeHTML(translations[currentLanguage].yarnGroupPlaceholder)}" value="${escapeHTML(groupVal)}" />
    <input type="text" class="yarn-color" data-i18n-placeholder="yarnColorPlaceholder" placeholder="${escapeHTML(translations[currentLanguage].yarnColorPlaceholder)}" value="${escapeHTML(colorVal)}" />
    <input type="text" class="yarn-amount" data-i18n-placeholder="yarnAmountPlaceholder" placeholder="${escapeHTML(translations[currentLanguage].yarnAmountPlaceholder || 'Amount used')}" value="${escapeHTML(amountVal)}" />
    <input type="text" class="yarn-details" data-i18n-placeholder="scanYarnDetailsLabel" placeholder="${escapeHTML(translations[currentLanguage].scanYarnDetailsLabel)}" value="${escapeHTML(detailsVal)}" />
    <button type="button" class="yarn-remove-btn" data-i18n-title="removeYarnButton" title="${translations[currentLanguage].removeYarnButton}">✕</button>
  `;
  entry.querySelector('.yarn-remove-btn').addEventListener('click', () => {
    if (yarnRowsContainer.querySelectorAll('.yarn-entry').length > 1) entry.remove();
    autoSaveDraft();
    autoSaveCurrentProject();
  });
  entry.querySelectorAll('input').forEach(inp => inp.addEventListener('input', () => {
    autoSaveDraft();
    autoSaveCurrentProject();
  }));
  yarnRowsContainer.appendChild(entry);
}

// Opstart af første garnrække
document.querySelector('#yarn-rows-container .yarn-remove-btn').addEventListener('click', function () {
  if (yarnRowsContainer.querySelectorAll('.yarn-entry').length > 1) this.closest('.yarn-entry').remove();
  autoSaveDraft();
  autoSaveCurrentProject();
});
document.querySelectorAll('#yarn-rows-container input').forEach(inp => inp.addEventListener('input', () => {
  autoSaveDraft();
  autoSaveCurrentProject();
}));
addYarnBtn.addEventListener('click', () => addYarnRow());

// ── Scan garnbanderole med lokal OCR ─────────────────────────────────────
const scanYarnButton = document.getElementById('scan-yarn-btn');
const scanYarnInput = document.getElementById('scan-yarn-input');
const scanYarnStatus = document.getElementById('scan-yarn-status');
const scanYarnReview = document.getElementById('scan-yarn-review');
const scanYarnAddButton = document.getElementById('scan-yarn-add-btn');
let tesseractScriptPromise = null;

function setYarnScanStatus(message, visible = true) {
  if (!scanYarnStatus) return;
  scanYarnStatus.textContent = message;
  scanYarnStatus.classList.toggle('hidden', !visible);
}

function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tesseractScriptPromise) return tesseractScriptPromise;

  tesseractScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.async = true;
    script.onload = () => window.Tesseract
      ? resolve(window.Tesseract)
      : reject(new Error('OCR library loaded without its API.'));
    script.onerror = () => reject(new Error('Could not load the OCR library.'));
    document.head.appendChild(script);
  }).catch((error) => {
    tesseractScriptPromise = null;
    throw error;
  });
  return tesseractScriptPromise;
}

function extractYarnLabelSuggestions(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const amountPattern = /\b\d+(?:[.,]\d+)?\s?(?:g(?:ram)?s?|m(?:eter|etre)?s?)\b/i;
  const amountTokensPattern = /\b\d+(?:[.,]\d+)?\s?(?:g(?:ram)?s?|m(?:eter|metre)?s?)\b/gi;
  const colorPattern = /\b(?:colou?r|farve|farge|shade)\s*(?:no\.?|nr\.?|#|:)?\s*([a-z0-9-]+)/i;
  const amountLine = lines.find((line) => amountPattern.test(line)) || '';
  const colorLine = lines.find((line) => colorPattern.test(line)) || '';
  const amountSuggestions = amountLine.match(amountTokensPattern) || [];
  const typeLine = lines.find((line) =>
    line !== amountLine &&
    line !== colorLine &&
    !/\b(?:machine wash|hand wash|made in|100%|wool|cotton|acrylic|polyamide|polyester|nylon|merino|yarns?|garn|fibres?|fibers?|composition|material|care|washing)\b/i.test(line) &&
    line.length > 2
  ) || lines.find((line) => line !== amountLine && line !== colorLine) || '';
  const remainingLines = lines
    .filter((line) => line !== typeLine)
    .map((line) => line
      .replace(amountTokensPattern, '')
      .replace(colorPattern, '')
      .replace(/[|,;:=\-–—]+/g, ' ')
      .trim())
    .filter(Boolean);

  return {
    type: typeLine,
    color: colorLine ? (colorLine.match(colorPattern)?.[1] || colorLine) : '',
    amount: amountSuggestions.join(' / ') || amountLine,
    details: remainingLines.join(' · '),
  };
}

if (scanYarnButton && scanYarnInput) {
  scanYarnButton.addEventListener('click', () => scanYarnInput.click());
  scanYarnInput.addEventListener('change', async () => {
    const file = scanYarnInput.files?.[0];
    if (!file) return;

    scanYarnButton.disabled = true;
    scanYarnReview.classList.add('hidden');
    setYarnScanStatus(translations[currentLanguage].scanYarnProcessing);

    // AI læser banderolen først; lokal OCR bruges kun hvis AI ikke er tilgængelig.
    try {
      const image = await readImageAsDataURL(file);
      const { data: ai, error } = await sb.functions.invoke('scan-yarn-label', { body: { image } });
      if (error || !ai || ai.error) throw error || new Error(ai?.error || 'No AI answer');
      if (![ai.type, ai.group, ai.color, ai.amount, ai.details].some(Boolean)) {
        setYarnScanStatus(translations[currentLanguage].scanYarnNoText);
        scanYarnButton.disabled = false;
        scanYarnInput.value = '';
        return;
      }
      document.getElementById('scan-yarn-type').value = ai.type || '';
      document.getElementById('scan-yarn-group').value = ai.group || '';
      document.getElementById('scan-yarn-color').value = ai.color || '';
      document.getElementById('scan-yarn-amount').value = ai.amount || '';
      document.getElementById('scan-yarn-details').value = ai.details || '';
      scanYarnReview.classList.remove('hidden');
      setYarnScanStatus(translations[currentLanguage].scanYarnReady);
      scanYarnButton.disabled = false;
      scanYarnInput.value = '';
      return;
    } catch (error) {
      console.warn('AI label scan unavailable, using local OCR:', error);
    }

    let worker;
    try {
      const Tesseract = await loadTesseract();
      worker = await Tesseract.createWorker('eng+dan', 1, {
        workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5',
        langPath: 'https://tessdata.projectnaptha.com/4.0.0',
        logger: (progress) => {
          if (progress.status === 'recognizing text' && Number.isFinite(progress.progress)) {
            const percent = Math.round(progress.progress * 100);
            setYarnScanStatus(`${translations[currentLanguage].scanYarnProcessing} ${percent}%`);
          }
        },
      });
      const { data } = await worker.recognize(file);
      if (!data.text.trim()) {
        setYarnScanStatus(translations[currentLanguage].scanYarnNoText);
        return;
      }

      const suggestions = extractYarnLabelSuggestions(data.text);
      document.getElementById('scan-yarn-type').value = suggestions.type;
      document.getElementById('scan-yarn-group').value = '';
      document.getElementById('scan-yarn-color').value = suggestions.color;
      document.getElementById('scan-yarn-amount').value = suggestions.amount;
      document.getElementById('scan-yarn-details').value = suggestions.details;
      scanYarnReview.classList.remove('hidden');
      setYarnScanStatus(translations[currentLanguage].scanYarnReady);
    } catch (error) {
      console.error('Could not scan yarn label:', error);
      setYarnScanStatus(translations[currentLanguage].scanYarnFailed);
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch (error) {
          console.error('Could not stop the yarn label OCR worker:', error);
        }
      }
      scanYarnButton.disabled = false;
      scanYarnInput.value = '';
    }
  });

  scanYarnAddButton.addEventListener('click', () => {
    addYarnRow(
      document.getElementById('scan-yarn-type').value.trim(),
      document.getElementById('scan-yarn-group').value.trim(),
      document.getElementById('scan-yarn-color').value.trim(),
      document.getElementById('scan-yarn-amount').value.trim(),
      document.getElementById('scan-yarn-details').value.trim()
    );
    autoSaveDraft();
    autoSaveCurrentProject();
    scanYarnReview.classList.add('hidden');
    setYarnScanStatus('', false);
  });
}

// ── Billeder i formularen ─────────────────────────────────────────────────
let pendingProjectImages = [];

function getFormImages() {
  const project = currentEditingProjectId ? projects.find(p => p.id === currentEditingProjectId) : null;
  return project ? getProjectImages(project) : pendingProjectImages;
}

function renderFormImages() {
  const container = document.getElementById('project-images-preview');
  if (!container) return;
  const images = getFormImages();
  container.innerHTML = images.map((src, i) => `
    <div class="project-image-thumb">
      <img src="${escapeHTML(src)}" alt="${i + 1}" />
      <button type="button" class="project-image-remove" data-index="${i}" aria-label="${escapeHTML(translations[currentLanguage].removeImageButton)}">✕</button>
    </div>`).join('');
}

async function setFormImages(images) {
  if (currentEditingProjectId) {
    projects = projects.map(p => p.id === currentEditingProjectId ? withProjectImages(p, images) : p);
    renderFormImages();
    await saveProjects({ showBusy: false });
    renderProjects();
    updateHeroImage();
  } else {
    pendingProjectImages = images;
    renderFormImages();
  }
}

// ── Populer formular med eksisterende projekt ─────────────────────────────
function populateFormWithProject(project) {
  if (!project) return;
  currentEditingProjectId = project.id;
  pendingProjectImages = [];
  renderFormImages();
  const formHeading = document.getElementById('form-heading');
  if (formHeading) formHeading.textContent = translations[currentLanguage].editProjectHeading;

  nameInput.value = project.name || '';
  patternInput.value = project.pattern || '';
  notesInput.value = project.notes || '';
  patternLinkInput.value = project.patternLink || '';
  statusInput.value = project.status || 'Planning';
  ratingValueInput.value = project.rating || 0;
  difficultyValueInput.value = project.difficulty || 0;

  Array.from(ratingInput.querySelectorAll('.star-btn')).forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.value) <= Number(ratingValueInput.value));
  });
  Array.from(difficultyInput.querySelectorAll('.heart-btn')).forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.value) <= Number(difficultyValueInput.value));
  });

  const yarns = project.yarns || [];
  yarnRowsContainer.innerHTML = '';
  const yarnList = yarns.filter(y => y.type || y.group || y.color || y.amount || y.details);
  if (yarnList.length === 0) yarnList.push({ type: '', color: '', amount: '' });
  yarnList.forEach(yarn => addYarnRow(yarn.type || '', yarn.group || '', yarn.color || '', yarn.amount || '', yarn.details || ''));

  const needles = project.needles || [];
  needleInputs.forEach((needle, index) => { needle.value = needles[index] || ''; });
}

// ── Vis nuværende projekt ─────────────────────────────────────────────────
async function selectCurrentProject(projectId) {
  if (!projects.some((project) => project.id === projectId)) return;
  if (currentEditingProjectId && currentEditingProjectId !== projectId) await commitCurrentProjectEdits();
  currentEditingProjectId = projectId;

  const selectedAt = Math.max(
    Date.now(),
    ...projects.map((project) => Number(project.lastViewedAt) || 0)
  ) + 1;
  projects = projects.map((project) => ({
    ...project,
    lastViewedAt: project.id === projectId ? selectedAt : project.lastViewedAt
  }));

  saveProjects({ showBusy: false });
  renderProjects();
  updateHeroImage();
}

function renderCurrentProjectSelector(orderedProjects, currentProjectId) {
  const wrapper = document.getElementById('current-project-selector-wrapper');
  const selector = document.getElementById('current-project-selector');
  if (!wrapper || !selector) return;

  wrapper.hidden = orderedProjects.length < 2;
  selector.setAttribute('aria-label', translations[currentLanguage].currentProjectPickerLabel);
  selector.innerHTML = '';

  orderedProjects.forEach((project) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'current-project-option';
    button.classList.toggle('active', project.id === currentProjectId);
    button.setAttribute('aria-pressed', project.id === currentProjectId ? 'true' : 'false');
    button.textContent = project.name;
    button.addEventListener('click', () => selectCurrentProject(project.id));
    selector.appendChild(button);
  });
}

function renderCurrentProject() {
  const orderedProjects = getOrderedProjects();
  const currentProject = orderedProjects.length > 0 ? orderedProjects[0] : null;
  renderCurrentProjectSelector(orderedProjects, currentProject?.id);

  if (!currentProject) {
    currentProjectCard.innerHTML = `<p style="color: #a35d70; text-align: center;">${translations[currentLanguage].emptyState}</p>`;
    return;
  }

  if (currentEditingProjectId !== null && currentProject.id === currentEditingProjectId) {
    populateFormWithProject(currentProject);
  }

  const card = document.createElement('article');
  card.className = 'project-card featured';
  const difficultyDisplay = currentProject.difficulty && currentProject.difficulty > 0
    ? `<p class="difficulty"><strong>${translations[currentLanguage].difficultyDisplayLabel}:</strong> ${renderHearts(currentProject.difficulty)}</p>` : '';
  const needlesDisplay = renderNeedles(currentProject.needles || []);
  const yarnsDisplay = renderYarns(currentProject.yarns || []);
  const translatedStatus = translateStatus(currentProject.status);
  const currentLabel = `<div class="current-badge">✏️ ${translations[currentLanguage].currentProjectHeading}</div>`;

  card.innerHTML = `
    <div class="card-header">
      <div class="header-with-rating">
        <div class="title-stars-row">
          <h3>${escapeHTML(currentProject.name)}</h3>
          ${currentProject.rating && currentProject.rating > 0 ? `<span class="stars">${renderStars(currentProject.rating)}</span>` : ''}
        </div>
        ${currentLabel}
        ${difficultyDisplay}
      </div>
      <span class="status-badge">${escapeHTML(translatedStatus)}</span>
    </div>
    <div class="card-layout">
      <div class="card-col">
        <div class="card-col-main">
          ${yarnsDisplay}
          ${needlesDisplay}
        </div>
      </div>
      <div class="card-notes">
        ${currentProject.notes ? `<p><strong>${escapeHTML(translations[currentLanguage].notesLabel)}:</strong> ${escapeHTML(currentProject.notes)}</p>` : ''}
      </div>
      ${renderProjectGallery(currentProject)}
    </div>
    
    ${renderShareToggle(currentProject)}
    <button type="button" class="current-project-edit-btn">${translations[currentLanguage].currentProjectEditButton}</button>
    <div class="round-counter current-project-round-counter" data-project-id="${escapeHTML(currentProject.id)}">
      <button type="button" class="round-btn round-minus" data-project-id="${escapeHTML(currentProject.id)}">−</button>
      <span class="round-display">${getRounds(currentProject.id)}</span>
      <span class="round-label">${translations[currentLanguage].roundsLabel}</span>
      <button type="button" class="round-btn round-plus" data-project-id="${escapeHTML(currentProject.id)}">+</button>
      <button type="button" class="round-btn round-reset" data-project-id="${escapeHTML(currentProject.id)}" title="${translations[currentLanguage].resetRoundsButton}">↺</button>
    </div>
  `;
  currentProjectCard.innerHTML = '';
  currentProjectCard.appendChild(card);

  bindProjectGallery(card);
  bindShareToggle(card, renderProjects);
  card.querySelector('.current-project-edit-btn').addEventListener('click', async () => {
    if (currentEditingProjectId && currentEditingProjectId !== currentProject.id) await commitCurrentProjectEdits();
    populateFormWithProject(currentProject);
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  card.querySelector('.round-minus').addEventListener('click', (e) => {
    e.stopPropagation();
    projectRounds[currentProject.id] = Math.max(0, getRounds(currentProject.id) - 1);
    saveRounds();
    card.querySelector('.round-display').textContent = getRounds(currentProject.id);
  });

  card.querySelector('.round-plus').addEventListener('click', (e) => {
    e.stopPropagation();
    projectRounds[currentProject.id] = getRounds(currentProject.id) + 1;
    saveRounds();
    card.querySelector('.round-display').textContent = getRounds(currentProject.id);
  });

  card.querySelector('.round-reset').addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(translations[currentLanguage].resetRoundsConfirm)) {
      projectRounds[currentProject.id] = 0;
      saveRounds();
      card.querySelector('.round-display').textContent = 0;
    }
  });
}

// ── Ryd formular til nyt projekt ──────────────────────────────────────────
function clearFormForNew() {
  currentEditingProjectId = null;
  const formHeading = document.getElementById('form-heading');
  if (formHeading) formHeading.textContent = translations[currentLanguage].addProjectHeading;
  nameInput.value = '';
  patternInput.value = '';
  notesInput.value = '';
  patternLinkInput.value = '';
  statusInput.value = 'Planning';
  ratingValueInput.value = 0;
  difficultyValueInput.value = 0;
  Array.from(ratingInput.querySelectorAll('.star-btn')).forEach(btn => btn.classList.remove('active'));
  Array.from(difficultyInput.querySelectorAll('.heart-btn')).forEach(btn => btn.classList.remove('active'));
  yarnRowsContainer.innerHTML = '';
  addYarnRow();
  needleInputs.forEach(n => n.value = '');
  pendingProjectImages = [];
  if (imageInput) imageInput.value = '';
  renderFormImages();
  clearDraft();
}

// ── Auto-gem kladde til localStorage ─────────────────────────────────────
function autoSaveDraft() {
  const draft = {
    name: nameInput.value,
    pattern: patternInput.value,
    notes: notesInput.value,
    patternLink: patternLinkInput.value,
    status: statusInput.value,
    rating: ratingValueInput.value,
    difficulty: difficultyValueInput.value,
    yarns: getYarnInputs().map(y => ({
      type: y.type.value,
      group: y.group.value,
      color: y.color.value,
      amount: y.amount.value,
      details: y.details.value,
    })),
    needles: needleInputs.map(n => n.value),
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function restoreDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    nameInput.value = draft.name || '';
    patternInput.value = draft.pattern || '';
    notesInput.value = draft.notes || '';
    patternLinkInput.value = draft.patternLink || '';
    statusInput.value = draft.status || 'Planning';
    ratingValueInput.value = draft.rating || 0;
    difficultyValueInput.value = draft.difficulty || 0;

    Array.from(ratingInput.querySelectorAll('.star-btn')).forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.value) <= Number(draft.rating));
    });
    Array.from(difficultyInput.querySelectorAll('.heart-btn')).forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.value) <= Number(draft.difficulty));
    });

    yarnRowsContainer.innerHTML = '';
    const yarnList = (draft.yarns || []).filter(y => y.type || y.group || y.color || y.amount || y.details);
    if (yarnList.length === 0) yarnList.push({ type: '', color: '', amount: '' });
    yarnList.forEach(y => addYarnRow(y.type, y.group || '', y.color, y.amount, y.details || ''));
    (draft.needles || []).forEach((val, i) => { if (needleInputs[i]) needleInputs[i].value = val; });
  } catch (e) {}
}

// ── Auto-gem eksisterende projekt ─────────────────────────────────────────
let autoSaveTimer = null;

async function commitCurrentProjectEdits() {
  if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
  if (!currentEditingProjectId) return;
  const project = projects.find(p => p.id === currentEditingProjectId);
  if (!project) return;

  const updatedProject = {
    ...project,
    name: nameInput.value.trim() || project.name,
    pattern: patternInput.value.trim(),
    notes: notesInput.value.trim(),
    patternLink: patternLinkInput.value.trim(),
    status: statusInput.value,
    rating: Number(ratingValueInput.value) || project.rating,
    difficulty: Number(difficultyValueInput.value) || project.difficulty,
    needles: needleInputs.map(n => n.value.trim()).filter(Boolean),
    yarns: getYarnInputs().map(y => ({
      type: y.type.value.trim(),
      group: y.group.value.trim(),
      color: y.color.value.trim(),
      amount: y.amount.value.trim(),
      details: y.details.value.trim(),
    })),
  };
  const becameFinished = shouldCelebrateFinishTransition(project.status, updatedProject.status);
  projects = projects.map(p => p.id === currentEditingProjectId ? updatedProject : p);
  await saveProjects({ showBusy: false });
  if (becameFinished) showHighfiveCelebration();
}

// Gør ventende ændringer tilgængelige for synkroniseringen (fx når mobilen låses).
window.flushPendingProjectEdits = commitCurrentProjectEdits;

function autoSaveCurrentProject() {
  if (!currentEditingProjectId) return;
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(commitCurrentProjectEdits, 1200);
}

// Gendan kladde ved sideindlæsning
restoreDraft();

// Auto-gem til Supabase hvert 10. sekund
setInterval(async () => {
  if (!currentUser) return;
  if (!projectsHaveUnsavedChanges && deletedProjectIds.size === 0) return;
  await saveProjects({ showBusy: false });
}, 10000);

// ── Kobl auto-gem til formfelter ──────────────────────────────────────────
[nameInput, patternInput, notesInput, patternLinkInput].forEach(el =>
  el.addEventListener('input', () => { autoSaveDraft(); autoSaveCurrentProject(); })
);
statusInput.addEventListener('change', () => { autoSaveDraft(); autoSaveCurrentProject(); });
needleInputs.forEach(n => n.addEventListener('input', () => { autoSaveDraft(); autoSaveCurrentProject(); }));

// ── Stjernebedømmelse ─────────────────────────────────────────────────────
const starButtons = Array.from(ratingInput.querySelectorAll('.star-btn'));
starButtons.forEach((button) => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const value = button.dataset.value;
    ratingValueInput.value = value;
    starButtons.forEach((btn) => btn.classList.toggle('active', Number(btn.dataset.value) <= Number(value)));
    autoSaveDraft();
    autoSaveCurrentProject();
  });
});

// ── Hjertesværhedsgrad ────────────────────────────────────────────────────
const heartButtons = Array.from(difficultyInput.querySelectorAll('.heart-btn'));
heartButtons.forEach((button) => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const value = button.dataset.value;
    difficultyValueInput.value = value;
    heartButtons.forEach((btn) => btn.classList.toggle('active', Number(btn.dataset.value) <= Number(value)));
    autoSaveDraft();
    autoSaveCurrentProject();
  });
});

// ── Nyt projekt-knap ──────────────────────────────────────────────────────
const newProjectBtn = document.getElementById('new-project-btn');
if (newProjectBtn) {
  newProjectBtn.addEventListener('click', () => {
    clearFormForNew();
    nameInput.focus();
  });
}

// Gem straks når der vælges et nyt foto til et eksisterende projekt.
if (imageInput) {
  imageInput.addEventListener('change', async () => {
    const files = Array.from(imageInput.files || []);
    if (files.length === 0) return;
    const uploaded = [];
    for (const file of files) {
      try {
        const url = await storeImageFile(file, 'projects');
        if (url) uploaded.push(url);
      } catch (error) {
        console.error('Could not prepare project image:', error);
        showSyncToast(translations[currentLanguage].imageUploadFailed);
      }
    }
    imageInput.value = '';
    if (uploaded.length === 0) return;
    if (currentEditingProjectId) await commitCurrentProjectEdits();
    await setFormImages([...getFormImages(), ...uploaded]);
  });
}

const projectImagesPreview = document.getElementById('project-images-preview');
if (projectImagesPreview) {
  projectImagesPreview.addEventListener('click', async (event) => {
    const button = event.target.closest('.project-image-remove');
    if (!button) return;
    if (currentEditingProjectId) await commitCurrentProjectEdits();
    const index = Number(button.dataset.index);
    await setFormImages(getFormImages().filter((_, i) => i !== index));
  });
}

// ── Formularindsendelse ───────────────────────────────────────────────────
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const pattern = patternInput.value.trim();
  const notes = notesInput.value.trim();
  const patternLink = patternLinkInput.value.trim();
  const needles = needleInputs.map(needle => needle.value.trim()).filter(Boolean);
  const rating = Number(ratingValueInput.value) || 0;
  const difficulty = Number(difficultyValueInput.value) || 0;
  const yarns = getYarnInputs().map(yarn => ({
    type: yarn.type.value.trim(),
    group: yarn.group.value.trim(),
    color: yarn.color.value.trim(),
    amount: yarn.amount.value.trim(),
    details: yarn.details.value.trim(),
  }));

  if (!name || !pattern) return;

  const newImages = pendingProjectImages;
  let becameFinished = false;

  if (currentEditingProjectId) {
    // Opdater eksisterende projekt
    const previousProject = projects.find(p => p.id === currentEditingProjectId);
    becameFinished = !!previousProject && shouldCelebrateFinishTransition(previousProject.status, statusInput.value);
    projects = projects.map(p => p.id === currentEditingProjectId ? {
      ...p, name, pattern, status: statusInput.value, notes, patternLink,
      needles, rating, difficulty, yarns,
      ...(newImages.length ? withProjectImages({}, [...getProjectImages(p), ...newImages]) : {}),
    } : p);
  } else {
    // Tjek om projektnavn allerede eksisterer
    const existingByName = projects.find(p => p.name.trim().toLowerCase() === name.toLowerCase());
    if (existingByName) {
      becameFinished = shouldCelebrateFinishTransition(existingByName.status, statusInput.value);
      currentEditingProjectId = existingByName.id;
      projects = projects.map(p => p.id === existingByName.id ? {
        ...p, name, pattern, status: statusInput.value, notes, patternLink,
        needles, rating, difficulty, yarns,
        ...(newImages.length ? withProjectImages({}, [...getProjectImages(p), ...newImages]) : {}),
      } : p);
    } else {
      // Nyt projekt
      becameFinished = false;
      projects.unshift({
        id: `project-${Date.now()}`,
        name, pattern, status: statusInput.value, notes, patternLink,
        needles, rating, difficulty, yarns, images: newImages, image: newImages[0] || '',
        lastViewedAt: Date.now(),
      });
    }
  }

  await saveProjects();
  if (becameFinished) showHighfiveCelebration();
  renderProjects();
  updateHeroImage();
  clearDraft();
  clearFormForNew();
  switchSection('previous-projects');
  nameInput.focus();
});
