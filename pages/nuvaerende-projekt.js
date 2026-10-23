// ── Nuværende projekt — formular, redigering og auto-gem ──────────────────

// ── Garnrækker ────────────────────────────────────────────────────────────
function getYarnInputs() {
  return Array.from(yarnRowsContainer.querySelectorAll('.yarn-entry')).map(entry => ({
    type: entry.querySelector('.yarn-type'),
    color: entry.querySelector('.yarn-color'),
    amount: entry.querySelector('.yarn-amount'),
  }));
}

function addYarnRow(typeVal = '', colorVal = '', amountVal = '') {
  const entry = document.createElement('div');
  entry.className = 'yarn-entry';
  entry.innerHTML = `
    <input type="text" class="yarn-type" placeholder="${translations[currentLanguage].yarnTypePlaceholder || 'Yarn type'}" value="${typeVal}" />
    <input type="text" class="yarn-color" data-i18n-placeholder="yarnColorPlaceholder" placeholder="${translations[currentLanguage].yarnColorPlaceholder}" value="${colorVal}" />
    <input type="text" class="yarn-amount" placeholder="${translations[currentLanguage].yarnAmountPlaceholder || 'Amount used'}" value="${amountVal}" />
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
  if (formHeading) formHeading.textContent = translations[currentLanguage].addProjectHeading || 'Add a project';

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
  const yarnList = yarns.filter(y => y.type || y.color || y.amount);
  if (yarnList.length === 0) yarnList.push({ type: '', color: '', amount: '' });
  yarnList.forEach(yarn => addYarnRow(yarn.type || '', yarn.color || '', yarn.amount || ''));

  const needles = project.needles || [];
  needleInputs.forEach((needle, index) => { needle.value = needles[index] || ''; });
}

// ── Vis nuværende projekt ─────────────────────────────────────────────────
function selectCurrentProject(projectId) {
  if (!projects.some((project) => project.id === projectId)) return;

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
    yarns: getYarnInputs().map(y => ({ type: y.type.value, color: y.color.value, amount: y.amount.value })),
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
    const yarnList = (draft.yarns || []).filter(y => y.type || y.color || y.amount);
    if (yarnList.length === 0) yarnList.push({ type: '', color: '', amount: '' });
    yarnList.forEach(y => addYarnRow(y.type, y.color, y.amount));
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
      color: y.color.value.trim(),
      amount: y.amount.value.trim()
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
    await setFormImages([...getFormImages(), ...uploaded]);
  });
}

const projectImagesPreview = document.getElementById('project-images-preview');
if (projectImagesPreview) {
  projectImagesPreview.addEventListener('click', async (event) => {
    const button = event.target.closest('.project-image-remove');
    if (!button) return;
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
    color: yarn.color.value.trim(),
    amount: yarn.amount.value.trim(),
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
