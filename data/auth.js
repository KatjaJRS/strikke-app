// ── Login og rettigheder — Supabase authentication ────────────────────────

async function loadAllData() {
  await loadProjectsFromSupabase();
  await refreshUserSettings();

  // Gemninger der ikke nåede at blive sendt fra en anden session sendes nu.
  if (deletedProjectIds.size > 0) await saveProjects({ showBusy: false });

  await refreshCommunityData();

  if (typeof migrateLegacyImagesToStorage === 'function') {
    migrateLegacyImagesToStorage().catch((error) => {
      console.error('Image migration failed:', error);
    });
  }
}

function showAuthForm(formId) {
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active-form'));
  document.getElementById(formId).classList.add('active-form');
  document.querySelectorAll('.auth-error').forEach(e => { e.textContent = ''; e.classList.add('hidden'); });
}

function showAuthError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}

function resetLocalProfileState() {
  myProfileName = 'You';
  myProfilePic = '';
  profileMode = 'member';
  localStorage.removeItem(PROFILE_NAME_KEY);
  localStorage.removeItem(PROFILE_PIC_KEY);
  localStorage.removeItem(PROFILE_MODE_KEY);
}

async function forceFreshLoginState() {
  try {
    const { data: { session } = {} } = await sb.auth.getSession();
    if (session) {
      await sb.auth.signOut();
    }
  } catch (error) {
    console.error('Forced pre-login sign-out failed:', error);
  }
  resetLocalProfileState();
}

function isLikelyNetworkAuthError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('cors') ||
    message.includes('gateway') ||
    message.includes('failed to load resource')
  );
}

function withAdminProfileFlags(profileData = {}) {
  const email = String(currentUser?.email || profileData.email || '').trim().toLowerCase();
  const isAdmin = isAdminUser(email, profileData);
  return {
    ...profileData,
    role: isAdmin ? 'admin' : 'member',
    is_admin: isAdmin,
  };
}

async function upsertProfileWithLanguage(profileData) {
  const withLanguage = { ...withAdminProfileFlags(profileData), preferred_language: normalizeLanguage(currentLanguage) };
  const { error } = await sb.from('profiles').upsert(withLanguage);

  if (!error) return;

  const missingLanguageColumn = /preferred_language|column/i.test(String(error.message || ''));
  if (!missingLanguageColumn) throw error;

  const fallback = { ...withAdminProfileFlags(profileData) };
  delete fallback.preferred_language;
  const { error: fallbackError } = await sb.from('profiles').upsert(fallback);
  if (fallbackError) throw fallbackError;
}

async function ensureCurrentUserProfileRow(user, existingProfile = null) {
  if (!user) return;
  if (existingProfile?.id === user.id) return;

  try {
    await upsertProfileWithLanguage({
      id: user.id,
      name: String(myProfileName || user.email || '').trim(),
      profile_pic: myProfilePic || ''
    });
  } catch (error) {
    console.error('Could not ensure profile row for current user:', error);
  }
}

async function syncCurrentUserProfileFromSupabase() {
  if (!currentUser) return null;

  try {
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (error) {
      console.error('Could not sync current user profile from Supabase:', error);
      return null;
    }

    const nextName = String(data?.name || currentUser.email || 'You').trim() || 'You';
    const nextPic = data?.profile_pic || '';

    myProfileName = nextName;
    myProfilePic = nextPic;
    localStorage.setItem(PROFILE_NAME_KEY, nextName);
    localStorage.setItem(PROFILE_PIC_KEY, nextPic);

    if (typeof refreshCurrentUserDisplay === 'function') refreshCurrentUserDisplay();
    if (typeof refreshCurrentProfileModalAvatar === 'function') refreshCurrentProfileModalAvatar();
    if (typeof updateProfilePreview === 'function') updateProfilePreview();

    return data || null;
  } catch (error) {
    console.error('Profile sync failed:', error);
    return null;
  }
}

async function deleteMyMembershipData(profile) {
  if (!currentUser) return;
  const firstConfirm = confirm(translations[currentLanguage].deleteMembershipDataConfirm);
  if (!firstConfirm) return;
  const secondConfirm = confirm(translations[currentLanguage].deleteMembershipDataConfirm);
  if (!secondConfirm) return;

  const email = String(currentUser.email || '').trim().toLowerCase();
  const profileName = String(profile?.name || myProfileName || '').trim();

  await sb.from('projects').delete().eq('user_id', currentUser.id);
  await sb.from('membership_requests').delete().eq('email', email);
  await sb.from('profiles').delete().eq('id', currentUser.id);

  if (profileName) {
    await sb.from('messages').delete().eq('sender_name', profileName);
  }

  const { data: groupsData } = await sb.from('groups').select('id, invited_people');
  for (const group of groupsData || []) {
    const invitedPeople = Array.isArray(group.invited_people) ? group.invited_people : [];
    const filteredPeople = invitedPeople.filter((person) => person !== profileName);
    if (filteredPeople.length !== invitedPeople.length) {
      await sb.from('groups').update({ invited_people: filteredPeople }).eq('id', group.id);
    }
  }

  localStorage.removeItem(PROFILE_NAME_KEY);
  localStorage.removeItem(PROFILE_PIC_KEY);
  localStorage.removeItem(DRAFT_KEY);
  localStorage.removeItem(HERO_IMAGE_KEY);
  localStorage.removeItem(HERO_PAN_KEY);
  localStorage.removeItem(ROUNDS_KEY);
  localStorage.removeItem(PROJECTS_CACHE_KEY);
  localStorage.removeItem(DELETED_PROJECTS_KEY);
  localStorage.removeItem(SETTINGS_UPDATED_KEY);
  await sb.from(SETTINGS_TABLE).delete().eq('user_id', currentUser.id).then(() => {}, () => {});
  await sb.auth.signOut();
  location.reload();
}

async function signInAndLaunch(email, password, loginErrorId) {
  return runWithBusy(async () => {
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const trimmedPassword = String(password || '').trim();

    if (!trimmedEmail || !trimmedPassword) {
      showAuthError(loginErrorId, translations[currentLanguage].loginErrorWrong);
      return false;
    }

    try {
      const { data: { session } = {} } = await sb.auth.getSession();
      if (session) {
        await sb.auth.signOut();
      }
    } catch (error) {
      console.warn('Session cleanup before login failed:', error);
    }

    let authResult;
    try {
      authResult = await sb.auth.signInWithPassword({ email: trimmedEmail, password: trimmedPassword });
    } catch (authError) {
      showAuthError(loginErrorId, translations[currentLanguage].loginErrorNetwork);
      console.error('Login request failed:', authError);
      return false;
    }

    const { data, error } = authResult;
    if (error) {
      const authMessage = isLikelyNetworkAuthError(error)
        ? translations[currentLanguage].loginErrorNetwork
        : translations[currentLanguage].loginErrorWrong;
      showAuthError(loginErrorId, authMessage);
      return false;
    }

    currentUser = data.user;
    myProfileName = currentUser.email || trimmedEmail || 'You';
    myProfilePic = '';
    localStorage.setItem(PROFILE_NAME_KEY, myProfileName);
    localStorage.setItem(PROFILE_PIC_KEY, myProfilePic);

    let profile = null;
    try {
      const profileResult = await sb.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
      profile = profileResult.data || null;
    } catch (profileError) {
      console.error('Profile read failed during login:', profileError);
    }

    await ensureCurrentUserProfileRow(currentUser, profile);
    const preferredLanguage = normalizeLanguage(
      profile?.preferred_language || getSavedLanguageForEmail(email) || currentLanguage
    );
    applyLanguage(preferredLanguage);
    saveLanguageForEmail(email, preferredLanguage);

    if (profile) {
      myProfileName = profile.name || currentUser.email || trimmedEmail;
      myProfilePic = profile.profile_pic || '';
      localStorage.setItem(PROFILE_NAME_KEY, myProfileName);
      localStorage.setItem(PROFILE_PIC_KEY, myProfilePic);
    }

    launchApp(currentUser, profile || { name: currentUser.email || email, profile_pic: '' });

    try {
      await loadAllData();
      renderProjects();
      renderGroups();
      updateGroupsBadge();
    } catch (loadError) {
      console.error('Background load failed after login:', loadError);
    }
    return true;
  }, translations[currentLanguage].loginHeading);
}

async function registerAndLaunch(name, email, password, registerErrorId) {
  return runWithBusy(async () => {
    let signUpResult;
    try {
      signUpResult = await sb.auth.signUp({ email, password });
    } catch (signUpError) {
      showAuthError(registerErrorId, translations[currentLanguage].registerErrorNetwork);
      console.error('Sign up request failed:', signUpError);
      return false;
    }

    const { data, error } = signUpResult;
    if (error) {
      const signUpMessage = isLikelyNetworkAuthError(error)
        ? translations[currentLanguage].registerErrorNetwork
        : (error.message || translations[currentLanguage].registerErrorExists);
      showAuthError(registerErrorId, signUpMessage);
      return false;
    }

    if (!data?.user) {
      showAuthError(registerErrorId, translations[currentLanguage].registerNeedEmailConfirm);
      return false;
    }

    currentUser = data.user;

    if (!data.session) {
      let autoLogin;
      try {
        autoLogin = await sb.auth.signInWithPassword({ email, password });
      } catch (autoLoginError) {
        showAuthError(registerErrorId, translations[currentLanguage].registerErrorNetwork);
        console.error('Auto-login failed after sign up:', autoLoginError);
        return false;
      }

      if (autoLogin.error || !autoLogin.data?.user) {
        showAuthError(registerErrorId, translations[currentLanguage].registerNeedEmailConfirm);
        return false;
      }
      currentUser = autoLogin.data.user;
    }

    try {
      await upsertProfileWithLanguage({ id: currentUser.id, name, profile_pic: '' });
    } catch (profileUpsertError) {
      console.error('Profile upsert failed during register:', profileUpsertError);
    }

    saveLanguageForEmail(email, currentLanguage);

    if (!isAdminUser(email)) {
      try {
        await sb.from('membership_requests').upsert({
          id: `req-${currentUser.id}`,
          name,
          email,
          created_at: new Date().toISOString()
        });
      } catch (requestError) {
        console.error('Membership request upsert failed during register:', requestError);
      }
    }

    myProfileName = name;
    myProfilePic = '';
    localStorage.setItem(PROFILE_NAME_KEY, name);
    localStorage.setItem(PROFILE_PIC_KEY, '');

    launchApp(currentUser, { name, profile_pic: '' });
    try {
      await loadAllData();
      renderProjects();
      renderGroups();
      updateGroupsBadge();
    } catch (loadError) {
      console.error('Background load failed after register:', loadError);
    }
    return true;
  }, translations[currentLanguage].registerHeading);
}

function launchApp(user, profile) {
  document.getElementById('auth-overlay').classList.add('hidden');
  document.getElementById('app-shell-wrapper').classList.remove('hidden');

  if (typeof ensureProfileRealtimeSync === 'function') ensureProfileRealtimeSync();
  if (typeof ensureProfileSyncHeartbeat === 'function') ensureProfileSyncHeartbeat();
  if (typeof ensureCommunityRealtimeSync === 'function') ensureCommunityRealtimeSync();
  if (typeof ensureProjectsRealtimeSync === 'function') ensureProjectsRealtimeSync();
  if (typeof ensureProjectSyncHeartbeat === 'function') ensureProjectSyncHeartbeat();
  if (typeof ensureSettingsRealtimeSync === 'function') ensureSettingsRealtimeSync();

  const userBarSlot = document.getElementById('user-bar-slot');
  let userBar = document.getElementById('user-bar');
  if (!userBar) {
    userBar = document.createElement('div');
    userBar.id = 'user-bar';
    userBar.className = 'user-bar';
    userBarSlot.appendChild(userBar);
  }

  const memberToggle = document.getElementById('profile-mode-member');
  const adminToggle = document.getElementById('profile-mode-admin');
  if (memberToggle && !memberToggle.dataset.bound) {
    memberToggle.dataset.bound = 'true';
    memberToggle.addEventListener('click', () => setProfileMode('member'));
  }
  if (adminToggle && !adminToggle.dataset.bound) {
    adminToggle.dataset.bound = 'true';
    adminToggle.addEventListener('click', () => setProfileMode('admin'));
  }

  function refreshUserBar() {
    const displayName = myProfileName || profile?.name || user.email;
    const initials = displayName.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const hue = [...displayName].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
    const pic = myProfilePic || profile?.profile_pic || '';
    const avatarHTML = pic
      ? `<img src="${pic}" class="avatar user-bar-avatar" alt="${escapeHTML(displayName)}" />`
      : `<span class="avatar avatar-initials user-bar-avatar" style="background:hsl(${hue},55%,65%)">${escapeHTML(initials)}</span>`;
    userBar.innerHTML = `
      <button type="button" id="open-profile-btn" class="user-bar-profile-btn" title="Edit profile">
        ${avatarHTML}
        <span class="user-bar-name">${escapeHTML(displayName)}</span>
      </button>
      <button type="button" id="logout-btn" class="user-bar-logout" data-i18n="logoutLabel">Sign out</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', async () => {
      if (typeof flushPendingProjectSaves === 'function') await flushPendingProjectSaves();
      await sb.auth.signOut();
      resetLocalProfileState();
      location.reload();
    });
    document.getElementById('open-profile-btn').addEventListener('click', () => openProfileModal());
  }

  refreshUserBar();
  window.refreshCurrentUserDisplay = refreshUserBar;

  function openProfileModal() {
    const modal = document.getElementById('profile-modal');
    modal.classList.remove('hidden');
    document.getElementById('profile-edit-name').value = myProfileName !== 'You' ? myProfileName : (profile?.name || '');
    document.getElementById('profile-edit-email').value = user.email || '';
    document.getElementById('profile-current-password').value = '';
    document.getElementById('profile-new-password').value = '';
    document.getElementById('profile-edit-error').classList.add('hidden');
    document.getElementById('profile-edit-success').classList.add('hidden');
    updateModalAvatar();
  }

  function updateModalAvatar() {
    const av = document.getElementById('profile-modal-avatar');
    const currentPic = myProfilePic || profile?.profile_pic || '';
    if (currentPic) {
      av.innerHTML = '';
      av.style.backgroundImage = `url(${currentPic})`;
      av.style.backgroundSize = 'cover';
      av.style.backgroundPosition = 'center';
      av.className = 'avatar profile-modal-avatar';
    } else {
      av.style.backgroundImage = '';
      const name = profile?.name || user.email || 'U';
      const initials = name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
      const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
      av.className = 'avatar avatar-initials profile-modal-avatar';
      av.style.background = `hsl(${hue},55%,65%)`;
      av.textContent = initials;
    }
  }

  window.refreshCurrentProfileModalAvatar = updateModalAvatar;

  document.getElementById('profile-modal-close').addEventListener('click', () =>
    document.getElementById('profile-modal').classList.add('hidden'));
  document.getElementById('profile-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('profile-modal'))
      document.getElementById('profile-modal').classList.add('hidden');
  });
  document.getElementById('profile-modal-pic-btn').addEventListener('click', () =>
    document.getElementById('profile-modal-pic-input').click());
  document.getElementById('profile-modal-pic-input').addEventListener('change', async () => {
    const file = document.getElementById('profile-modal-pic-input').files[0];
    if (!file) return;
    myProfilePic = await storeImageFile(file, 'profile');
    localStorage.setItem(PROFILE_PIC_KEY, myProfilePic);
    await sb.from('profiles').upsert({ id: currentUser.id, name: myProfileName || profile?.name || '', profile_pic: myProfilePic });
    updateModalAvatar();
    refreshUserBar();
    renderGroups();
    if (typeof updateProfilePreview === 'function') updateProfilePreview();
  });

  const deleteMembershipDataBtn = document.getElementById('delete-membership-data-btn');
  if (deleteMembershipDataBtn && !deleteMembershipDataBtn.dataset.bound) {
    deleteMembershipDataBtn.dataset.bound = 'true';
    deleteMembershipDataBtn.addEventListener('click', async () => {
      await deleteMyMembershipData(profile);
    });
  }

  document.getElementById('profile-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = document.getElementById('profile-edit-name').value.trim();
    const newEmail = document.getElementById('profile-edit-email').value.trim().toLowerCase();
    const newPw = document.getElementById('profile-new-password').value;
    const errEl = document.getElementById('profile-edit-error');
    const successEl = document.getElementById('profile-edit-success');
    errEl.classList.add('hidden');
    successEl.classList.add('hidden');

    try {
      if (newPw) {
        if (newPw.length < 6) {
          errEl.textContent = translations[currentLanguage].profileErrorShortPw;
          errEl.classList.remove('hidden');
          return;
        }
        await sb.auth.updateUser({ password: newPw });
      }
      if (newEmail !== user.email) await sb.auth.updateUser({ email: newEmail });
      await sb.from('profiles').upsert({ id: currentUser.id, name: newName, profile_pic: myProfilePic || profile?.profile_pic || '' });
      if (profile) profile.name = newName;
      else profile = { name: newName, profile_pic: myProfilePic || '' };
      myProfileName = newName;
      localStorage.setItem(PROFILE_NAME_KEY, newName);
      refreshUserBar();
      renderGroups();
      successEl.classList.remove('hidden');
      document.getElementById('profile-current-password').value = '';
      document.getElementById('profile-new-password').value = '';
    } catch (err) {
      errEl.textContent = err.message || 'Error saving changes.';
      errEl.classList.remove('hidden');
    }
  });

  applyLanguage(currentLanguage);
  profileMode = getProfileMode();
  applyProfileModeUI();
  renderProjects();
  updateHeroImage();
  renderGroups();
  updateGroupsBadge();
}

async function initAuth() {
  let session = null;
  try {
    const result = await sb.auth.getSession();
    session = result?.data?.session || null;
  } catch (sessionError) {
    console.error('Failed to restore session:', sessionError);
    session = null;
  }

  if (session) {
    currentUser = session.user;
    myProfileName = currentUser.email || 'You';
    myProfilePic = '';

    let profile = null;
    try {
      const profileResult = await sb.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
      profile = profileResult.data || null;
    } catch (profileError) {
      console.error('Failed to load profile on session restore:', profileError);
    }

    await ensureCurrentUserProfileRow(currentUser, profile);

    myProfileName = profile?.name || currentUser.email || 'You';
    myProfilePic = profile?.profile_pic || '';
    localStorage.setItem(PROFILE_NAME_KEY, myProfileName);
    localStorage.setItem(PROFILE_PIC_KEY, myProfilePic);
    const preferredLanguage = normalizeLanguage(
      profile?.preferred_language || getSavedLanguageForEmail(currentUser.email) || currentLanguage
    );
    applyLanguage(preferredLanguage);
    saveLanguageForEmail(currentUser.email, preferredLanguage);

    launchApp(currentUser, profile);
    loadAllData().catch((loadError) => {
      console.error('Background load failed on session restore:', loadError);
    });
    return;
  }

  document.getElementById('auth-overlay').classList.remove('hidden');

  document.getElementById('show-register').addEventListener('click', () => showAuthForm('register-form'));
  document.getElementById('show-login').addEventListener('click', () => showAuthForm('login-form'));
  document.getElementById('show-forgot').addEventListener('click', () => showAuthForm('forgot-form'));
  document.getElementById('show-login-from-forgot').addEventListener('click', () => showAuthForm('login-form'));

  const loginEmailInput = document.getElementById('login-email');
  loginEmailInput.addEventListener('input', () => {
    const savedLanguage = getSavedLanguageForEmail(loginEmailInput.value);
    if (savedLanguage && savedLanguage !== currentLanguage) {
      applyLanguage(savedLanguage);
    }
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value.trim();
    await signInAndLaunch(email, password, 'login-error');
  });

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim().toLowerCase();
    const password = document.getElementById('register-password').value;
    if (password.length < 6) { showAuthError('register-error', translations[currentLanguage].registerErrorShort); return; }
    await registerAndLaunch(name, email, password, 'register-error');
  });

  document.getElementById('forgot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim().toLowerCase();
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${APP_BASE_URL}?reset=1` });
    if (error) { showAuthError('forgot-error', error.message); return; }
    alert(translations[currentLanguage].forgotSuccessMsg);
    showAuthForm('login-form');
  });
}
