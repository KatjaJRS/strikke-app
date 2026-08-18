// ── Personlige indstillinger — synkroniseres mellem computer og mobil ─────
// Gemmer omgangstællere, hero-billede, hero-position og sprog i Supabase,
// så de følger brugeren på tværs af enheder.

const SETTINGS_UPDATED_KEY = 'knitting-settings-updated-at';
const SETTINGS_SYNC_DEBOUNCE_MS = 1200;

let settingsTableAvailable = true;
let settingsSyncTimer = null;
let settingsRealtimeChannel = null;
let settingsWarningShown = false;

function isMissingSettingsTableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || code.startsWith('PGRST2') || message.includes('does not exist') || message.includes('schema cache');
}

function handleMissingSettingsTable(error) {
  settingsTableAvailable = false;
  if (settingsWarningShown) return;
  settingsWarningShown = true;
  console.warn(
    `Tabellen "${SETTINGS_TABLE}" mangler i Supabase. Omgangstællere, hero-billede og sprog synkroniseres derfor kun lokalt.`,
    error
  );
}

function getLocalSettingsUpdatedAt() {
  return Number(localStorage.getItem(SETTINGS_UPDATED_KEY) || 0);
}

function touchLocalSettings() {
  localStorage.setItem(SETTINGS_UPDATED_KEY, String(Date.now()));
}

function collectLocalSettings() {
  let heroPan = { x: 50, y: 50 };
  try {
    const parsed = JSON.parse(localStorage.getItem(HERO_PAN_KEY) || 'null');
    if (parsed && typeof parsed === 'object') heroPan = parsed;
  } catch { /* bruger standardposition */ }

  return {
    rounds: projectRounds || {},
    heroImage: localStorage.getItem(HERO_IMAGE_KEY) || '',
    heroPan,
    language: normalizeLanguage(currentLanguage),
    updatedAt: getLocalSettingsUpdatedAt()
  };
}

function applyRemoteSettings(remoteSettings) {
  if (!remoteSettings || typeof remoteSettings !== 'object') return;

  if (remoteSettings.rounds && typeof remoteSettings.rounds === 'object') {
    projectRounds = remoteSettings.rounds;
    localStorage.setItem(ROUNDS_KEY, JSON.stringify(projectRounds));
  }

  if (typeof remoteSettings.heroImage === 'string' && remoteSettings.heroImage) {
    localStorage.setItem(HERO_IMAGE_KEY, remoteSettings.heroImage);
  }

  if (remoteSettings.heroPan && typeof remoteSettings.heroPan === 'object') {
    localStorage.setItem(HERO_PAN_KEY, JSON.stringify(remoteSettings.heroPan));
  }

  localStorage.setItem(SETTINGS_UPDATED_KEY, String(Number(remoteSettings.updatedAt) || Date.now()));

  if (typeof applyHeroImageFromStorage === 'function') applyHeroImageFromStorage();
  if (typeof renderProjects === 'function') renderProjects();

  const remoteLanguage = normalizeLanguage(remoteSettings.language);
  if (remoteSettings.language && remoteLanguage !== currentLanguage && typeof applyLanguage === 'function') {
    applyLanguage(remoteLanguage);
  }
}

async function saveUserSettings() {
  if (!currentUser || !settingsTableAvailable) return false;

  const payload = collectLocalSettings();
  try {
    const { error } = await sb.from(SETTINGS_TABLE).upsert(
      {
        user_id: currentUser.id,
        data: payload,
        updated_at: new Date(payload.updatedAt || Date.now()).toISOString()
      },
      { onConflict: 'user_id' }
    );
    if (error) throw error;
    return true;
  } catch (error) {
    if (isMissingSettingsTableError(error)) {
      handleMissingSettingsTable(error);
      return false;
    }
    console.error('Error saving user settings:', error);
    return false;
  }
}

function queueSettingsSync() {
  touchLocalSettings();
  if (settingsSyncTimer) clearTimeout(settingsSyncTimer);
  settingsSyncTimer = setTimeout(() => {
    settingsSyncTimer = null;
    saveUserSettings();
  }, SETTINGS_SYNC_DEBOUNCE_MS);
}

async function refreshUserSettings() {
  if (!currentUser || !settingsTableAvailable) return false;

  try {
    const { data, error } = await sb
      .from(SETTINGS_TABLE)
      .select('data, updated_at')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (error) throw error;

    const remoteSettings = data?.data || null;
    const remoteUpdatedAt = Number(remoteSettings?.updatedAt) || (data?.updated_at ? new Date(data.updated_at).getTime() : 0);

    if (!remoteSettings) {
      // Første gang: send enhedens nuværende indstillinger op i skyen.
      touchLocalSettings();
      await saveUserSettings();
      return true;
    }

    if (remoteUpdatedAt <= getLocalSettingsUpdatedAt()) {
      // Lokale data er nyest — send dem videre til de andre enheder.
      await saveUserSettings();
      return true;
    }

    applyRemoteSettings({ ...remoteSettings, updatedAt: remoteUpdatedAt });
    return true;
  } catch (error) {
    if (isMissingSettingsTableError(error)) {
      handleMissingSettingsTable(error);
      return false;
    }
    console.error('Error loading user settings:', error);
    return false;
  }
}

function ensureSettingsRealtimeSync() {
  if (settingsRealtimeChannel || !sb?.channel || !currentUser || !settingsTableAvailable) return;

  settingsRealtimeChannel = sb
    .channel('settings-live-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: SETTINGS_TABLE, filter: `user_id=eq.${currentUser.id}` },
      () => { refreshUserSettings(); }
    )
    .subscribe();
}
