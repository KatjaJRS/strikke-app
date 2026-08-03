// ── Andre projekter — projektkort, filtre og fortryd-sletning ─────────────

function renderProjects() {
  renderCurrentProject();

  const orderedProjects = getOrderedProjects();
  const currentId = orderedProjects[0]?.id;
  let previousProjects = [...orderedProjects];

  // Anvend filtre
  previousProjects = previousProjects.filter((project) => {
    const statusMatch = filterStatus === 'all' || project.status === filterStatus;
    const ratingMatch = filterRating === 'all' || project.rating === Number(filterRating);
    const difficultyMatch = filterDifficulty === 'all' || project.difficulty === Number(filterDifficulty);
    return statusMatch && ratingMatch && difficultyMatch;
  });

  list.innerHTML = '';

  if (previousProjects.length === 0) {
    list.innerHTML = `<p style="color: #a35d70; text-align: center;">${translations[currentLanguage].emptyState}</p>`;
    return;
  }

  previousProjects.forEach((project) => {
    const isCurrent = project.id === currentId;
    const card = document.createElement('article');
    card.className = isCurrent ? 'project-card project-card-current' : 'project-card';
    const difficultyDisplay = project.difficulty && project.difficulty > 0
      ? `<p class="difficulty"><strong>${translations[currentLanguage].difficultyDisplayLabel}:</strong> ${renderHearts(project.difficulty)}</p>` : '';
    const needlesDisplay = renderNeedles(project.needles || []);
    const yarnsDisplay = renderYarns(project.yarns || []);
    const translatedStatus = translateStatus(project.status);
    const currentLabel = isCurrent
      ? `<div class="current-badge">✏️ ${translations[currentLanguage].currentProjectHeading}</div>`
      : '';

    card.innerHTML = `
      <div class="card-header">
        <div class="header-with-rating">
          <div class="title-stars-row">
            <h3>${escapeHTML(project.name)}</h3>
            ${project.rating && project.rating > 0 ? `<span class="stars">${renderStars(project.rating)}</span>` : ''}
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
          <div class="card-actions-stack">
            <div class="card-buttons">
              <button class="edit-btn" data-project-id="${escapeHTML(project.id)}">${translations[currentLanguage].editButton}</button>
              <button class="delete-btn" data-project-id="${escapeHTML(project.id)}">${translations[currentLanguage].deleteButton}</button>
            </div>
            <div class="round-counter" data-project-id="${escapeHTML(project.id)}">
              <button type="button" class="round-btn round-minus" data-project-id="${escapeHTML(project.id)}">−</button>
              <span class="round-display">${getRounds(project.id)}</span>
              <span class="round-label">omgange</span>
              <button type="button" class="round-btn round-plus" data-project-id="${escapeHTML(project.id)}">+</button>
              <button type="button" class="round-btn round-reset" data-project-id="${escapeHTML(project.id)}" title="Nulstil">↺</button>
            </div>
          </div>
        </div>
        <div class="card-notes">
          ${project.notes ? `<p><strong>${escapeHTML(translations[currentLanguage].notesLabel)}:</strong> ${escapeHTML(project.notes)}</p>` : ''}
        </div>
        ${project.image ? `<img class="card-img-square" src="${project.image}" alt="${escapeHTML(project.name)}" />` : '<div class="card-img-placeholder"></div>'}
      </div>
    `;

    function openProjectForEditing() {
      currentEditingProjectId = project.id;
      projects = projects.map((p) => ({
        ...p,
        lastViewedAt: p.id === project.id ? Date.now() : p.lastViewedAt
      }));
      populateFormWithProject(project);
      saveProjects();
      renderProjects();
      updateHeroImage();
      switchSection('current-project');
    }

    card.addEventListener('click', openProjectForEditing);

    card.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openProjectForEditing();
    });

    card.querySelector('.round-minus').addEventListener('click', (e) => {
      e.stopPropagation();
      projectRounds[project.id] = Math.max(0, getRounds(project.id) - 1);
      saveRounds();
      card.querySelector('.round-display').textContent = getRounds(project.id);
    });

    card.querySelector('.round-plus').addEventListener('click', (e) => {
      e.stopPropagation();
      projectRounds[project.id] = getRounds(project.id) + 1;
      saveRounds();
      card.querySelector('.round-display').textContent = getRounds(project.id);
    });

    card.querySelector('.round-reset').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Nulstil omgangstælleren til 0?')) {
        projectRounds[project.id] = 0;
        saveRounds();
        card.querySelector('.round-display').textContent = 0;
      }
    });

    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const confirmDelete = confirm(`Are you sure you want to delete "${escapeHTML(project.name)}"? You can undo this action.`);
      if (confirmDelete) {
        lastDeletedProject = project;
        if (undoTimeoutId) clearTimeout(undoTimeoutId);
        projects = projects.filter((p) => p.id !== project.id);
        saveProjects();
        renderProjects();
        updateHeroImage();
        showUndoNotification();
        undoTimeoutId = setTimeout(() => {
          lastDeletedProject = null;
          hideUndoNotification();
        }, 5000);
      }
    });

    list.appendChild(card);
  });
}

// ── Fortryd sletning ──────────────────────────────────────────────────────
function showUndoNotification() {
  let notification = document.getElementById('undo-notification');
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'undo-notification';
    notification.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; background: #e35c86;
      color: white; padding: 14px 18px; border-radius: 8px; font-weight: 600;
      display: flex; gap: 12px; align-items: center; z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: slideIn 0.3s ease;
    `;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(400px); opacity: 0; } }
      #undo-notification.hide { animation: slideOut 0.3s ease forwards; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(notification);
  }
  notification.innerHTML = `
    <span>Project deleted</span>
    <button id="undo-btn" style="background: white; color: #e35c86; border: 0; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 0.9rem;">Undo</button>
  `;
  notification.classList.remove('hide');
  notification.style.display = 'flex';
  document.getElementById('undo-btn').addEventListener('click', undoDeleteProject);
}

function hideUndoNotification() {
  const notification = document.getElementById('undo-notification');
  if (notification) {
    notification.classList.add('hide');
    setTimeout(() => { notification.style.display = 'none'; }, 300);
  }
}

function undoDeleteProject() {
  if (lastDeletedProject) {
    projects.push(lastDeletedProject);
    saveProjects();
    renderProjects();
    updateHeroImage();
    lastDeletedProject = null;
    hideUndoNotification();
    if (undoTimeoutId) { clearTimeout(undoTimeoutId); undoTimeoutId = null; }
  }
}

// ── Filtre ────────────────────────────────────────────────────────────────
statusFilterInput.addEventListener('change', (e) => {
  filterStatus = e.target.value;
  renderProjects();
});

ratingFilterButtons.forEach((button) => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    filterRating = button.dataset.rating;
    ratingFilterButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.rating === filterRating));
    renderProjects();
  });
});

difficultyFilterButtons.forEach((button) => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    filterDifficulty = button.dataset.difficulty;
    difficultyFilterButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.difficulty === filterDifficulty));
    renderProjects();
  });
});
