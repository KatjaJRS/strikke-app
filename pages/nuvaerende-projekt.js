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

// ── Scan garnbanderole med AI ─────────────────────────────────────────────
const scanYarnButton = document.getElementById('scan-yarn-btn');
const scanYarnInput = document.getElementById('scan-yarn-input');
const scanYarnStatus = document.getElementById('scan-yarn-status');
const scanYarnReview = document.getElementById('scan-yarn-review');
const scanYarnAddButton = document.getElementById('scan-yarn-add-btn');
const yarnCameraModal = document.getElementById('yarn-camera-modal');
const yarnCameraVideo = document.getElementById('yarn-camera-video');
const yarnCameraError = document.getElementById('yarn-camera-error');
const yarnCameraCaptureButton = document.getElementById('yarn-camera-capture');
let yarnCameraStream = null;
const patternFileInput = document.getElementById('pattern-file-input');
const patternFileName = document.getElementById('pattern-file-name');
const patternFileContentTypes = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
let pendingPatternFile = null;

function setYarnScanStatus(message, visible = true) {
  if (!scanYarnStatus) return;
  scanYarnStatus.textContent = message;
  scanYarnStatus.classList.toggle('hidden', !visible);
}

function setYarnCameraError(message) {
  yarnCameraError.textContent = message;
  yarnCameraError.classList.toggle('hidden', !message);
}

function closeYarnCamera() {
  if (yarnCameraStream) {
    yarnCameraStream.getTracks().forEach((track) => track.stop());
    yarnCameraStream = null;
  }
  if (yarnCameraVideo) yarnCameraVideo.srcObject = null;
  yarnCameraModal?.classList.add('hidden');
  scanYarnButton?.focus();
}

document.getElementById('pattern-file-button')?.addEventListener('click', () => patternFileInput?.click());

function readCompressedYarnImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('This image format is not supported by this browser.'));
      image.onload = () => {
        const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Could not prepare the selected image.'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

async function processYarnLabelImage(file) {
  if (!file) return;
  scanYarnButton.disabled = true;
  scanYarnReview.classList.add('hidden');
  setYarnScanStatus(translations[currentLanguage].scanYarnProcessing);

  try {
    const image = await readCompressedYarnImage(file);
    const { data: ai, error } = await sb.functions.invoke('scan-yarn-label', { body: { image } });
    if (error) throw error;
    if (!ai || typeof ai !== 'object' ||
        !['type', 'group', 'color', 'amount', 'details'].every((key) => typeof ai[key] === 'string')) {
      throw new Error('The AI returned an invalid answer.');
    }
    const suggestions = Object.fromEntries(
      ['type', 'group', 'color', 'amount', 'details'].map((key) => [key, ai[key].trim()])
    );
    if (!Object.values(suggestions).some(Boolean)) {
      setYarnScanStatus(translations[currentLanguage].scanYarnNoText);
    } else {
      document.getElementById('scan-yarn-type').value = suggestions.type;
      document.getElementById('scan-yarn-group').value = suggestions.group;
      document.getElementById('scan-yarn-color').value = suggestions.color;
      document.getElementById('scan-yarn-amount').value = suggestions.amount;
      document.getElementById('scan-yarn-details').value = suggestions.details;
      scanYarnReview.classList.remove('hidden');
      setYarnScanStatus(translations[currentLanguage].scanYarnReady);
    }
  } catch (error) {
    console.error('Could not scan yarn label:', error);
    const status = Number(error?.context?.status || error?.status);
    const message = status === 401
      ? translations[currentLanguage].scanYarnAuthRequired
      : status === 404
        ? translations[currentLanguage].scanYarnFunctionMissing
        : status >= 500
          ? translations[currentLanguage].scanYarnServiceUnavailable
          : translations[currentLanguage].scanYarnFailed;
    setYarnScanStatus(message);
  } finally {
    scanYarnButton.disabled = false;
    scanYarnInput.value = '';
  }
}

async function openYarnCamera() {
  yarnCameraModal.classList.remove('hidden');
  yarnCameraCaptureButton.disabled = true;
  setYarnCameraError('');
  if (!navigator.mediaDevices?.getUserMedia) {
    setYarnCameraError(translations[currentLanguage].scanYarnCameraUnsupported);
    return;
  }

  try {
    yarnCameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' } },
    });
    yarnCameraVideo.srcObject = yarnCameraStream;
    await yarnCameraVideo.play();
    yarnCameraCaptureButton.disabled = false;
  } catch (error) {
    console.error('Could not open the yarn label camera:', error);
    if (yarnCameraStream) {
      yarnCameraStream.getTracks().forEach((track) => track.stop());
      yarnCameraStream = null;
      yarnCameraVideo.srcObject = null;
    }
    const permissionDenied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
    yarnCameraCaptureButton.disabled = true;
    setYarnCameraError(translations[currentLanguage][
      permissionDenied ? 'scanYarnCameraPermissionDenied' : 'scanYarnCameraUnavailable'
    ]);
  }
}

if (scanYarnButton && scanYarnInput && yarnCameraModal && yarnCameraVideo) {
  scanYarnButton.addEventListener('click', openYarnCamera);
  scanYarnInput.addEventListener('change', () => processYarnLabelImage(scanYarnInput.files?.[0]));
  document.getElementById('yarn-camera-cancel').addEventListener('click', closeYarnCamera);
  document.getElementById('yarn-camera-choose-file').addEventListener('click', () => {
    closeYarnCamera();
    scanYarnInput.click();
  });
  yarnCameraModal.addEventListener('click', (event) => {
    if (event.target === yarnCameraModal) closeYarnCamera();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !yarnCameraModal.classList.contains('hidden')) closeYarnCamera();
  });
  yarnCameraCaptureButton.addEventListener('click', async () => {
    if (!yarnCameraVideo.videoWidth || !yarnCameraVideo.videoHeight) {
      setYarnCameraError(translations[currentLanguage].scanYarnCameraUnavailable);
      return;
    }
    const scale = Math.min(1, 1400 / Math.max(yarnCameraVideo.videoWidth, yarnCameraVideo.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(yarnCameraVideo.videoWidth * scale);
    canvas.height = Math.round(yarnCameraVideo.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      setYarnCameraError(translations[currentLanguage].scanYarnCameraUnavailable);
      return;
    }
    context.drawImage(yarnCameraVideo, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob) {
      setYarnCameraError(translations[currentLanguage].scanYarnCameraUnavailable);
      return;
    }
    const photo = new File([blob], 'yarn-label.jpg', { type: 'image/jpeg' });
    closeYarnCamera();
    await processYarnLabelImage(photo);
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

if (patternFileInput && patternFileName) {
  patternFileInput.addEventListener('change', () => {
    const file = patternFileInput.files?.[0] || null;
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (file.size > 20 * 1024 * 1024 || !patternFileContentTypes[extension] ||
        (file.type && file.type !== 'application/octet-stream' &&
          patternFileContentTypes[extension] !== file.type)) {
      showSyncToast(translations[currentLanguage].patternFileInvalid);
      patternFileInput.value = '';
      pendingPatternFile = null;
      patternFileName.textContent = '';
      return;
    }
    pendingPatternFile = file;
    patternFileName.textContent = file.name;
  });
}

async function uploadPatternFile(projectId) {
  if (!pendingPatternFile) return '';
  if (!currentUser) throw new Error('You must be signed in to upload a pattern file.');

  const extension = pendingPatternFile.name.split('.').pop()?.toLowerCase() || '';
  const safeName = pendingPatternFile.name.replace(/[^\w.-]+/g, '_').slice(-100) || `pattern.${extension}`;
  const path = `${currentUser.id}/${projectId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await sb.storage.from(PATTERN_STORAGE_BUCKET).upload(path, pendingPatternFile, {
    cacheControl: '3600',
    contentType: pendingPatternFile.type && pendingPatternFile.type !== 'application/octet-stream'
      ? pendingPatternFile.type
      : patternFileContentTypes[extension],
    upsert: false,
  });
  if (error) throw error;
  return `${PATTERN_STORAGE_PREFIX}${path}`;
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
  patternLinkInput.value = String(project.patternLink || '').startsWith(PATTERN_STORAGE_PREFIX) ? '' : project.patternLink || '';
  patternFileName.textContent = getPatternFileName(project.patternLink);
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
  const patternDisplay = renderProjectPatternLink(currentProject);
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
        ${patternDisplay}
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
  bindProjectPatternLinks(card);
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
  pendingPatternFile = null;
  patternFileInput.value = '';
  patternFileName.textContent = '';
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
  let patternLink = patternLinkInput.value.trim();
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

  const existingByName = currentEditingProjectId
    ? null
    : projects.find(p => p.name.trim().toLowerCase() === name.toLowerCase());
  const projectId = currentEditingProjectId || existingByName?.id || `project-${Date.now()}`;
  const previousProject = projects.find(project => project.id === projectId);
  if (!pendingPatternFile && !patternLink && String(previousProject?.patternLink || '').startsWith(PATTERN_STORAGE_PREFIX)) {
    patternLink = previousProject.patternLink;
  }
  if (pendingPatternFile) {
    try {
      patternLink = await uploadPatternFile(projectId);
    } catch (error) {
      console.error('Could not upload pattern file:', error);
      showSyncToast(translations[currentLanguage].patternFileUploadFailed);
      return;
    }
  }

  const newImages = pendingProjectImages;
  let becameFinished = false;

  if (currentEditingProjectId) {
    // Opdater eksisterende projekt
    becameFinished = !!previousProject && shouldCelebrateFinishTransition(previousProject.status, statusInput.value);
    projects = projects.map(p => p.id === currentEditingProjectId ? {
      ...p, name, pattern, status: statusInput.value, notes, patternLink,
      needles, rating, difficulty, yarns,
      ...(newImages.length ? withProjectImages({}, [...getProjectImages(p), ...newImages]) : {}),
    } : p);
  } else {
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
        id: projectId,
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
