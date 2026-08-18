// ── Projektdata — gem og hent fra Supabase ────────────────────────────────

function createProjectId(project, index) {
  const base = String(project?.name || `project-${index}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `project-${index}`;
  return `legacy-${base}`;
}

function normalizeProjects() {
  projects = projects.map((project, index) => {
    const yarns = (project.yarns || []).slice(0, 3);
    while (yarns.length < 3) yarns.push({ type: '', color: '', amount: '' });
    let needles = project.needles || [];
    if (typeof project.needleSize === 'string' && project.needleSize && needles.length === 0) {
      needles = [project.needleSize];
    }
    return {
      ...project,
      id: project.id || createProjectId(project, index),
      lastViewedAt: project.lastViewedAt || 0,
      status: normalizeProjectStatus(project.status),
      needles,
      patternLink: project.patternLink || '',
      rating: Number(project.rating) || 0,
      difficulty: Number(project.difficulty) || 0,
      yarns: yarns.map(yarn => ({
        type: yarn.type || '',
        color: yarn.color || '',
        amount: yarn.amount || '',
      })),
      image: project.image || '',
    };
  });
}

function projectToRow(project) {
  return {
    id: project.id,
    user_id: currentUser.id,
    name: project.name,
    pattern: project.pattern || '',
    status: normalizeProjectStatus(project.status),
    notes: project.notes || '',
    pattern_link: project.patternLink || '',
    needles: project.needles || [],
    yarns: project.yarns || [],
    rating: project.rating || 0,
    difficulty: project.difficulty || 0,
    image: project.image || '',
    last_viewed_at: project.lastViewedAt || 0
  };
}

function rowToProject(row) {
  return {
    id: row.id,
    name: row.name,
    pattern: row.pattern || '',
    status: row.status || 'Planning',
    notes: row.notes || '',
    patternLink: row.pattern_link || '',
    needles: row.needles || [],
    yarns: row.yarns || [],
    rating: row.rating || 0,
    difficulty: row.difficulty || 0,
    image: row.image || '',
    lastViewedAt: row.last_viewed_at || 0
  };
}

// ── Lokal sikkerhedskopi ─────────────────────────────────────────────────
function cacheProjectsLocally() {
  if (!currentUser) return;
  try {
    localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify({ userId: currentUser.id, projects }));
  } catch (error) {
    console.warn('Could not cache projects locally:', error);
  }
}

function readCachedProjects() {
  try {
    const cached = JSON.parse(localStorage.getItem(PROJECTS_CACHE_KEY) || 'null');
    if (!cached || cached.userId !== currentUser?.id) return null;
    return Array.isArray(cached.projects) ? cached.projects : null;
  } catch {
    return null;
  }
}

// ── Sletning ─────────────────────────────────────────────────────────────
function markProjectDeleted(projectId) {
  if (!projectId) return;
  deletedProjectIds.add(projectId);
  saveDeletedProjectIds();
}

function unmarkProjectDeleted(projectId) {
  if (!projectId) return;
  deletedProjectIds.delete(projectId);
  saveDeletedProjectIds();
}

// ── Gem ──────────────────────────────────────────────────────────────────
let projectsHaveUnsavedChanges = false;
let lastLocalSaveAt = 0;

async function saveProjects(options = {}) {
  const { showBusy = true, busyMessage = 'Gemmer projekter...' } = options;
  if (!currentUser) return true;

  projectsHaveUnsavedChanges = true;
  cacheProjectsLocally();

  const persistTask = async () => {
    try {
      const idsToDelete = [...deletedProjectIds];
      if (idsToDelete.length > 0) {
        const { error: deleteError } = await sb
          .from('projects')
          .delete()
          .eq('user_id', currentUser.id)
          .in('id', idsToDelete);
        if (deleteError) throw deleteError;
        idsToDelete.forEach((id) => deletedProjectIds.delete(id));
        saveDeletedProjectIds();
      }

      if (projects.length > 0) {
        const { error } = await sb
          .from('projects')
          .upsert(projects.map(projectToRow), { onConflict: 'id' });
        if (error) throw error;
      }

      projectsHaveUnsavedChanges = false;
      lastLocalSaveAt = Date.now();

      return true;
    } catch (e) {
      console.error('Error saving projects:', e);
      showSyncToast(
        currentLanguage === 'da'
          ? 'Kunne ikke gemme til skyen. Ændringerne er gemt lokalt og prøves igen.'
          : 'Could not save to the cloud. Changes are stored locally and will retry.'
      );
      return false;
    }
  };

  if (!showBusy) return persistTask();
  return runWithBusy(persistTask, busyMessage);
}

// ── Hent og flet ─────────────────────────────────────────────────────────
function mergeProjectLists(remoteProjects, localProjects) {
  if (!projectsHaveUnsavedChanges) {
    const remoteIds = new Set(remoteProjects.map((p) => p.id));
    const localOnly = localProjects.filter((p) => !remoteIds.has(p.id) && !deletedProjectIds.has(p.id));
    return [...remoteProjects, ...localOnly];
  }

  const localIds = new Set(localProjects.map((p) => p.id));
  const remoteOnly = remoteProjects.filter((p) => !localIds.has(p.id));
  return [...localProjects, ...remoteOnly];
}

async function loadProjectsFromSupabase() {
  if (!currentUser) return false;

  let rows = null;
  try {
    const { data, error } = await sb.from('projects').select('*').eq('user_id', currentUser.id);
    if (error) throw error;
    rows = data || [];
  } catch (error) {
    console.error('Error loading projects:', error);
    const cached = readCachedProjects();
    if (cached && projects.length === 0) {
      projects = cached;
      normalizeProjects();
    }
    return false;
  }

  const remoteProjects = rows
    .map(rowToProject)
    .filter((project) => !deletedProjectIds.has(project.id));

  projects = mergeProjectLists(remoteProjects, projects);

  // Behold nyeste kopi per navn, så gamle dubletter ikke fylder listen.
  const seen = new Map();
  [...projects]
    .sort((a, b) => Number(b.lastViewedAt || 0) - Number(a.lastViewedAt || 0))
    .forEach((project) => {
      const key = String(project.name || '').trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, project);
    });
  projects = [...seen.values()];

  normalizeProjects();
  cacheProjectsLocally();
  return true;
}

// ── Live-synkronisering mellem enheder ───────────────────────────────────
let projectsRealtimeChannel = null;
let projectsPollTimerId = null;
let projectSyncListenersBound = false;
let lastProjectsRefreshAt = 0;
// Realtime står for hurtige opdateringer; opslaget her er kun et sikkerhedsnet.
const PROJECTS_POLL_INTERVAL_MS = 120000;
const PROJECTS_REFRESH_MIN_GAP_MS = 8000;

function renderProjectsAfterSync() {
  if (typeof renderProjects === 'function') renderProjects();
  if (typeof updateHeroImage === 'function') updateHeroImage();
}

async function refreshProjectsFromCloud(options = {}) {
  const { force = false } = options;
  if (!currentUser) return;
  if (projectsHaveUnsavedChanges) return;
  if (!force && Date.now() - lastProjectsRefreshAt < PROJECTS_REFRESH_MIN_GAP_MS) return;
  lastProjectsRefreshAt = Date.now();
  const ok = await loadProjectsFromSupabase();
  if (ok) renderProjectsAfterSync();
}

async function flushPendingProjectSaves() {
  if (!currentUser) return;
  if (typeof window.flushPendingProjectEdits === 'function') {
    await window.flushPendingProjectEdits();
  }
  if (projectsHaveUnsavedChanges || deletedProjectIds.size > 0) {
    await saveProjects({ showBusy: false });
  }
}

let projectsRefreshTimer = null;

function scheduleProjectsRefresh() {
  // Ignorer ekkoet af vores egen gemning, så vi ikke henter alt ned igen.
  if (Date.now() - lastLocalSaveAt < 5000) return;
  if (projectsRefreshTimer) return;
  projectsRefreshTimer = setTimeout(() => {
    projectsRefreshTimer = null;
    refreshProjectsFromCloud({ force: true });
  }, 1500);
}

function ensureProjectsRealtimeSync() {
  if (projectsRealtimeChannel || !sb?.channel || !currentUser) return;

  projectsRealtimeChannel = sb
    .channel('projects-live-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${currentUser.id}` },
      scheduleProjectsRefresh
    )
    .subscribe();
}

function ensureProjectSyncHeartbeat() {
  if (!projectsPollTimerId) {
    projectsPollTimerId = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      refreshProjectsFromCloud();
    }, PROJECTS_POLL_INTERVAL_MS);
  }

  if (projectSyncListenersBound) return;
  projectSyncListenersBound = true;

  // Mobilbrowsere pauser fanen, så der gemmes/hentes når appen skifter tilstand.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden') {
      await flushPendingProjectSaves();
      return;
    }
    await flushPendingProjectSaves();
    await refreshProjectsFromCloud();
    if (typeof refreshUserSettings === 'function') await refreshUserSettings();
  });

  window.addEventListener('pagehide', () => { flushPendingProjectSaves(); });
  window.addEventListener('online', async () => {
    await flushPendingProjectSaves();
    await refreshProjectsFromCloud();
  });
}

