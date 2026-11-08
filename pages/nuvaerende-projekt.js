// ── Nuværende projekt — formular, redigering og auto-gem ──────────────────

// ── Garnrækker ────────────────────────────────────────────────────────────
function getYarnInputs() {
  return Array.from(yarnRowsContainer.querySelectorAll('.yarn-entry')).map(entry => ({
    type: entry.querySelector('.yarn-type'),
    group: entry.querySelector('.yarn-group'),
    color: entry.querySelector('.yarn-color'),
    amount: entry.querySelector('.yarn-amount'),
    details: entry.querySelector('.yarn-details'),
    photos: entry.yarnPhotos || [],
  }));
}

function addYarnRow(typeVal = '', groupVal = '', colorVal = '', amountVal = '', detailsVal = '', photos = []) {
  const entry = document.createElement('div');
  entry.className = 'yarn-entry';
  entry.yarnPhotos = Array.isArray(photos) ? [...photos] : [];
  entry.innerHTML = `
    <details class="yarn-details-section" ${typeVal || groupVal || colorVal || amountVal || detailsVal ? 'open' : ''}>
    <summary data-i18n="yarnWriteDetails">${escapeHTML(translations[currentLanguage].yarnWriteDetails)}</summary>
    <div class="yarn-details-fields">
    <input type="text" class="yarn-type" data-i18n-placeholder="yarnTypePlaceholder" placeholder="${escapeHTML(translations[currentLanguage].yarnTypePlaceholder || 'Yarn type')}" value="${escapeHTML(typeVal)}" />
    <input type="text" class="yarn-group" data-i18n-placeholder="yarnGroupPlaceholder" placeholder="${escapeHTML(translations[currentLanguage].yarnGroupPlaceholder)}" value="${escapeHTML(groupVal)}" />
    <input type="text" class="yarn-color" data-i18n-placeholder="yarnColorPlaceholder" placeholder="${escapeHTML(translations[currentLanguage].yarnColorPlaceholder)}" value="${escapeHTML(colorVal)}" />
    <input type="text" class="yarn-amount" data-i18n-placeholder="yarnAmountPlaceholder" placeholder="${escapeHTML(translations[currentLanguage].yarnAmountPlaceholder || 'Amount used')}" value="${escapeHTML(amountVal)}" />
    <input type="text" class="yarn-details" data-i18n-placeholder="scanYarnDetailsLabel" placeholder="${escapeHTML(translations[currentLanguage].scanYarnDetailsLabel)}" value="${escapeHTML(detailsVal)}" />
    </div></details>
    <details class="yarn-photo-section" ${entry.yarnPhotos.length ? 'open' : ''}>
      <summary data-i18n="yarnPhotos">${escapeHTML(translations[currentLanguage].yarnPhotos)}</summary>
      <div class="yarn-photo-actions">
        <button type="button" class="yarn-camera-open" data-i18n="yarnTakePhoto">${escapeHTML(translations[currentLanguage].yarnTakePhoto)}</button>
        <button type="button" class="yarn-photo-choose" data-i18n="yarnChoosePhotos">${escapeHTML(translations[currentLanguage].yarnChoosePhotos)}</button>
        <input type="file" class="yarn-photo-input hidden-file-input" accept="image/jpeg,image/png,image/webp" multiple />
      </div>
      <p class="yarn-photo-privacy" data-i18n="yarnPhotoPrivacy">${escapeHTML(translations[currentLanguage].yarnPhotoPrivacy)}</p>
      <div class="yarn-photo-preview"></div>
    </details>
    <button type="button" class="yarn-remove-btn" data-i18n-title="removeYarnButton" title="${translations[currentLanguage].removeYarnButton}">✕</button>
  `;
  entry.querySelector('.yarn-remove-btn').addEventListener('click', () => {
    if (!confirm(translations[currentLanguage].confirmRemoveYarn)) return;
    entry.remove();
    if (!yarnRowsContainer.querySelector('.yarn-entry')) addYarnRow();
    autoSaveDraft();
    autoSaveCurrentProject();
  });
  entry.querySelectorAll('input[type="text"]').forEach(inp => inp.addEventListener('input', () => {
    autoSaveDraft();
    autoSaveCurrentProject();
  }));
  yarnRowsContainer.appendChild(entry);
  entry.querySelector('.yarn-photo-choose').addEventListener('click', () => entry.querySelector('.yarn-photo-input').click());
  entry.querySelector('.yarn-photo-input').addEventListener('change', async (event) => {
    await uploadYarnPhotos(entry, Array.from(event.target.files || []));
    event.target.value = '';
  });
  entry.querySelector('.yarn-camera-open').addEventListener('click', () => openYarnPhotoCamera(entry));
  renderYarnPhotoPreview(entry);
}

yarnRowsContainer.innerHTML = '';
addYarnRow();
addYarnBtn.addEventListener('click', () => addYarnRow());

const needleRows = document.getElementById('needle-rows');
function addNeedleRow(value = '') {
  const row = document.createElement('div');
  row.className = 'needle-entry';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'needle-type';
  input.dataset.i18nPlaceholder = 'needleTypePlaceholder';
  input.placeholder = translations[currentLanguage].needleTypePlaceholder;
  input.value = value;
  input.addEventListener('input', () => { autoSaveDraft(); autoSaveCurrentProject(); });
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'needle-remove-btn';
  remove.textContent = '✕';
  remove.setAttribute('aria-label', translations[currentLanguage].removeNeedleButton);
  remove.addEventListener('click', () => {
    if (!confirm(translations[currentLanguage].confirmRemoveNeedle)) return;
    needleInputs.splice(needleInputs.indexOf(input), 1);
    row.remove();
    autoSaveDraft();
    autoSaveCurrentProject();
  });
  row.append(input, remove);
  needleRows.append(row);
  needleInputs.push(input);
}
function setNeedleRows(values) {
  needleRows.replaceChildren();
  needleInputs.length = 0;
  values.filter(Boolean).forEach(addNeedleRow);
}
document.getElementById('add-needle-btn').addEventListener('click', () => addNeedleRow());

async function renderYarnPhotoPreview(entry) {
  const preview = entry.querySelector('.yarn-photo-preview');
  preview.replaceChildren();
  for (const path of entry.yarnPhotos) {
    const item = document.createElement('div');
    item.className = 'yarn-photo-item';
    const link = document.createElement('a');
    link.className = 'yarn-photo-link';
    link.dataset.yarnPhotoPath = path;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const image = document.createElement('img');
    image.alt = translations[currentLanguage].yarnPhotos;
    link.append(image);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'project-image-remove';
    remove.textContent = '✕';
    remove.setAttribute('aria-label', translations[currentLanguage].removeImageButton);
    remove.addEventListener('click', () => {
      if (!confirm(translations[currentLanguage].confirmRemoveYarnPhoto)) return;
      entry.yarnPhotos = entry.yarnPhotos.filter(photo => photo !== path);
      renderYarnPhotoPreview(entry);
      autoSaveDraft();
      autoSaveCurrentProject();
    });
    item.append(link, remove);
    preview.append(item);
  }
  if (currentUser) bindYarnPhotoLinks(preview);
}

let pendingYarnPhotoUploads = 0;
async function uploadYarnPhotos(entry, files) {
  if (!files.length) return;
  if (!currentUser) {
    showSyncToast(translations[currentLanguage].yarnPhotoLoginRequired);
    return;
  }
  const userId = currentUser.id;
  const editingId = currentEditingProjectId;
  const buttons = entry.querySelectorAll('.yarn-photo-actions button');
  const submitButton = form.querySelector('button[type="submit"]');
  pendingYarnPhotoUploads++;
  submitButton.disabled = true;
  buttons.forEach(button => { button.disabled = true; });
  let stage = 'format';
  let storageStatus = '';
  try {
    for (const file of files) {
      stage = 'format';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        throw new Error('Unsupported yarn photo format');
      }
      stage = 'prepare';
      const dataUrl = await readImageAsDataURL(file);
      const blob = dataURLToBlob(dataUrl);
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) || blob.size > 10485760) {
        throw new Error('Invalid or too large yarn photo');
      }
      const path = `${userId}/${crypto.randomUUID()}`;
      stage = 'storage';
      const { error } = await sb.storage.from(YARN_PHOTO_BUCKET).upload(path, blob, {
        contentType: blob.type,
        upsert: false,
      });
      if (error) {
        const status = Number(error.status || error.statusCode);
        if (Number.isInteger(status) && status >= 100 && status <= 599) storageStatus = String(status);
        throw error;
      }
      if (!entry.isConnected || currentEditingProjectId !== editingId || currentUser?.id !== userId) {
        stage = 'project';
        const { error: cleanupError } = await sb.storage.from(YARN_PHOTO_BUCKET).remove([path]);
        if (cleanupError) console.error('Could not remove unused yarn photo:', cleanupError);
        throw new Error('Project changed while uploading yarn photo');
      }
      entry.yarnPhotos.push(path);
      renderYarnPhotoPreview(entry);
      autoSaveDraft();
      autoSaveCurrentProject();
    }
  } catch (error) {
    console.error('Could not save yarn photo:', error);
    const errorKeys = {
      format: 'yarnPhotoFormatFailed',
      prepare: 'yarnPhotoPrepareFailed',
      storage: 'yarnPhotoStorageFailed',
      project: 'yarnPhotoProjectChanged',
    };
    const message = translations[currentLanguage][errorKeys[stage]];
    showSyncToast(storageStatus ? `${message} (${storageStatus})` : message);
  } finally {
    buttons.forEach(button => { button.disabled = false; });
    pendingYarnPhotoUploads--;
    submitButton.disabled = pendingYarnPhotoUploads > 0;
  }
}

const yarnPhotoCamera = document.getElementById('yarn-photo-camera');
const yarnPhotoVideo = document.getElementById('yarn-photo-video');
const yarnPhotoCapture = document.getElementById('yarn-photo-capture');
const yarnPhotoCameraError = document.getElementById('yarn-photo-camera-error');
let yarnPhotoStream = null;
let yarnPhotoCameraEntry = null;
let yarnPhotoCameraSession = 0;

function closeYarnPhotoCamera() {
  yarnPhotoCameraSession++;
  if (yarnPhotoStream) yarnPhotoStream.getTracks().forEach(track => track.stop());
  yarnPhotoStream = null;
  yarnPhotoVideo.srcObject = null;
  yarnPhotoCamera.classList.add('hidden');
  yarnPhotoCameraEntry = null;
}

async function openYarnPhotoCamera(entry) {
  const session = ++yarnPhotoCameraSession;
  yarnPhotoCameraEntry = entry;
  yarnPhotoCamera.classList.remove('hidden');
  yarnPhotoCapture.disabled = true;
  yarnPhotoCameraError.textContent = '';
  if (!navigator.mediaDevices?.getUserMedia) {
    yarnPhotoCameraError.textContent = translations[currentLanguage].scanYarnCameraUnsupported;
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
    if (session !== yarnPhotoCameraSession) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    yarnPhotoStream = stream;
    yarnPhotoVideo.srcObject = stream;
    await yarnPhotoVideo.play();
    if (session === yarnPhotoCameraSession) yarnPhotoCapture.disabled = false;
  } catch (error) {
    console.error('Could not open yarn photo camera:', error);
    if (session !== yarnPhotoCameraSession) return;
    if (yarnPhotoStream) yarnPhotoStream.getTracks().forEach(track => track.stop());
    yarnPhotoStream = null;
    yarnPhotoVideo.srcObject = null;
    yarnPhotoCameraError.textContent = translations[currentLanguage][
      error?.name === 'NotAllowedError' || error?.name === 'SecurityError'
        ? 'scanYarnCameraPermissionDenied' : 'scanYarnCameraUnavailable'
    ];
  }
}

document.getElementById('yarn-photo-cancel').addEventListener('click', closeYarnPhotoCamera);
yarnPhotoCamera.addEventListener('click', event => { if (event.target === yarnPhotoCamera) closeYarnPhotoCamera(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !yarnPhotoCamera.classList.contains('hidden')) closeYarnPhotoCamera();
});
yarnPhotoCapture.addEventListener('click', async () => {
  if (!yarnPhotoVideo.videoWidth || !yarnPhotoVideo.videoHeight || !yarnPhotoCameraEntry) {
    yarnPhotoCameraError.textContent = translations[currentLanguage].scanYarnCameraUnavailable;
    return;
  }
  yarnPhotoCapture.disabled = true;
  const entry = yarnPhotoCameraEntry;
  const session = yarnPhotoCameraSession;
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1800 / Math.max(yarnPhotoVideo.videoWidth, yarnPhotoVideo.videoHeight));
  canvas.width = Math.round(yarnPhotoVideo.videoWidth * scale);
  canvas.height = Math.round(yarnPhotoVideo.videoHeight * scale);
  const context = canvas.getContext('2d');
  if (!context) {
    yarnPhotoCameraError.textContent = translations[currentLanguage].scanYarnCameraUnavailable;
    yarnPhotoCapture.disabled = false;
    return;
  }
  context.drawImage(yarnPhotoVideo, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (session !== yarnPhotoCameraSession) return;
  if (!blob) {
    yarnPhotoCameraError.textContent = translations[currentLanguage].scanYarnCameraUnavailable;
    yarnPhotoCapture.disabled = false;
    return;
  }
  closeYarnPhotoCamera();
  await uploadYarnPhotos(entry, [new File([blob], 'yarn-label.jpg', { type: 'image/jpeg' })]);
});

const patternFileInput = document.getElementById('pattern-file-input');
const patternFileName = document.getElementById('pattern-file-name');
const patternFileContentTypes = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png', webp: 'image/webp',
};
let pendingPatternFile = null;
document.getElementById('pattern-file-button')?.addEventListener('click', () => patternFileInput?.click());

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
  const yarnList = yarns.filter(y => y.type || y.group || y.color || y.amount || y.details || y.photos?.length);
  if (yarnList.length === 0) yarnList.push({ type: '', color: '', amount: '' });
  yarnList.forEach(yarn => addYarnRow(yarn.type || '', yarn.group || '', yarn.color || '', yarn.amount || '', yarn.details || '', yarn.photos));

  const needles = project.needles || [];
  setNeedleRows(needles);
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

  if (pendingYarnPhotoUploads === 0 && currentEditingProjectId !== null && currentProject.id === currentEditingProjectId) {
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
          ${renderYarnPhotoGallery(currentProject.yarns)}
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
  bindYarnPhotoLinks(card);
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
function confirmStartNewProject() {
  if (pendingYarnPhotoUploads) {
    alert(translations[currentLanguage].waitForYarnPhotos);
    return false;
  }
  if (currentEditingProjectId) {
    return !pendingPatternFile || confirm(translations[currentLanguage].confirmDiscardPatternFile);
  }
  const hasDraft = nameInput.value.trim() || patternInput.value.trim() || notesInput.value.trim() ||
    patternLinkInput.value.trim() || statusInput.value !== 'Planning' ||
    Number(ratingValueInput.value) || Number(difficultyValueInput.value) ||
    needleInputs.some(input => input.value.trim()) ||
    getYarnInputs().some(yarn => yarn.type.value.trim() || yarn.group.value.trim() ||
      yarn.color.value.trim() || yarn.amount.value.trim() || yarn.details.value.trim() || yarn.photos.length) ||
    pendingProjectImages.length || pendingPatternFile;
  return !hasDraft || confirm(translations[currentLanguage].confirmDiscardDraft);
}

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
  setNeedleRows([]);
  form.querySelectorAll('.project-form-section').forEach(section => { section.open = false; });
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
      photos: y.photos,
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
    const yarnList = (draft.yarns || []).filter(y => y.type || y.group || y.color || y.amount || y.details || y.photos?.length);
    if (yarnList.length === 0) yarnList.push({ type: '', color: '', amount: '' });
    yarnList.forEach(y => addYarnRow(y.type, y.group || '', y.color, y.amount, y.details || '', y.photos));
    setNeedleRows(draft.needles || []);
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
    patternLink: patternLinkInput.value.trim() || (String(project.patternLink || '').startsWith(PATTERN_STORAGE_PREFIX) ? project.patternLink : ''),
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
      photos: y.photos,
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
    if (!confirm(translations[currentLanguage].confirmRemoveProjectPhoto)) return;
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
    photos: yarn.photos,
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

  const saved = await saveProjects();
  if (!saved) {
    currentEditingProjectId = projectId;
    pendingProjectImages = [];
    pendingPatternFile = null;
    return;
  }
  if (becameFinished) showHighfiveCelebration();
  renderProjects();
  updateHeroImage();
  clearDraft();
  clearFormForNew();
  switchSection('previous-projects');
  nameInput.focus();
});
