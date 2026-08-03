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
    <input type="text" class="yarn-color" placeholder="Colour" value="${colorVal}" />
    <input type="text" class="yarn-amount" placeholder="${translations[currentLanguage].yarnAmountPlaceholder || 'Amount used'}" value="${amountVal}" />
    <button type="button" class="yarn-remove-btn" title="Remove row">✕</button>
  `;
  entry.querySelector('.yarn-remove-btn').addEventListener('click', () => {
    if (yarnRowsContainer.querySelectorAll('.yarn-entry').length > 1) entry.remove();
    autoSaveDraft();
  });
  entry.querySelectorAll('input').forEach(inp => inp.addEventListener('input', autoSaveDraft));
  yarnRowsContainer.appendChild(entry);
}

// Opstart af første garnrække
document.querySelector('#yarn-rows-container .yarn-remove-btn').addEventListener('click', function () {
  if (yarnRowsContainer.querySelectorAll('.yarn-entry').length > 1) this.closest('.yarn-entry').remove();
  autoSaveDraft();
});
document.querySelectorAll('#yarn-rows-container input').forEach(inp => inp.addEventListener('input', autoSaveDraft));
addYarnBtn.addEventListener('click', () => addYarnRow());

// ── Populer formular med eksisterende projekt ─────────────────────────────
function populateFormWithProject(project) {
  if (!project) return;
  currentEditingProjectId = project.id;
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
function renderCurrentProject() {
  const orderedProjects = getOrderedProjects();
  const currentProject = orderedProjects.length > 0 ? orderedProjects[0] : null;

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
      ${currentProject.image ? `<img class="card-img-square" src="${currentProject.image}" alt="${escapeHTML(currentProject.name)}" />` : '<div class="card-img-placeholder"></div>'}
    </div>
    <div class="round-counter current-project-round-counter" data-project-id="${escapeHTML(currentProject.id)}">
      <button type="button" class="round-btn round-minus" data-project-id="${escapeHTML(currentProject.id)}">−</button>
      <span class="round-display">${getRounds(currentProject.id)}</span>
      <span class="round-label">omgange</span>
      <button type="button" class="round-btn round-plus" data-project-id="${escapeHTML(currentProject.id)}">+</button>
      <button type="button" class="round-btn round-reset" data-project-id="${escapeHTML(currentProject.id)}" title="Nulstil">↺</button>
    </div>
  `;
  currentProjectCard.innerHTML = '';
  currentProjectCard.appendChild(card);

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
    if (confirm('Nulstil omgangstælleren til 0?')) {
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

function autoSaveCurrentProject() {
  if (!currentEditingProjectId) return;
  const project = projects.find(p => p.id === currentEditingProjectId);
  if (!project) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
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
  }, 2000);
}

// Gendan kladde ved sideindlæsning
restoreDraft();

// Auto-gem til Supabase hvert 10. sekund
setInterval(async () => {
  if (currentUser && projects.length > 0) await saveProjects({ showBusy: false });
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

  const image = await readImageAsDataURL(imageInput.files[0]);
  let becameFinished = false;

  if (currentEditingProjectId) {
    // Opdater eksisterende projekt
    const previousProject = projects.find(p => p.id === currentEditingProjectId);
    becameFinished = !!previousProject && shouldCelebrateFinishTransition(previousProject.status, statusInput.value);
    projects = projects.map(p => p.id === currentEditingProjectId ? {
      ...p, name, pattern, status: statusInput.value, notes, patternLink,
      needles, rating, difficulty, yarns,
      ...(image ? { image } : {}),
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
        ...(image ? { image } : {}),
      } : p);
    } else {
      // Nyt projekt
      becameFinished = false;
      projects.unshift({
        id: `project-${Date.now()}`,
        name, pattern, status: statusInput.value, notes, patternLink,
        needles, rating, difficulty, yarns, image,
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
