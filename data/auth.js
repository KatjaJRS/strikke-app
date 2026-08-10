// ── Login og rettigheder — Supabase authentication ────────────────────────

async function loadAllData() {
  // Projekter
  const { data: pData } = await sb.from('projects').select('*').eq('user_id', currentUser.id);
  const allLoaded = (pData || []).map(p => ({
    id: p.id, name: p.name, pattern: p.pattern || '',
    status: p.status || 'Planning', notes: p.notes || '',
    patternLink: p.pattern_link || '', needles: p.needles || [],
    yarns: p.yarns || [], rating: p.rating || 0, difficulty: p.difficulty || 0,
    image: p.image || '', lastViewedAt: p.last_viewed_at || 0
  }));

  // Dedupliker i hukommelsen: behold nyeste per navn
  const seen = new Map();
  allLoaded.sort((a, b) => b.lastViewedAt - a.lastViewedAt);
  for (const p of allLoaded) {
    const key = p.name.trim().toLowerCase();
    if (!seen.has(key)) seen.set(key, p);
  }
  projects = [...seen.values()];
  normalizeProjects();

  await refreshCommunityData();
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

async function upsertProfileWithLanguage(profileData) {
  const withLanguage = { ...profileData, preferred_language: normalizeLanguage(currentLanguage) };
  const { error } = await sb.from('profiles').upsert(withLanguage);

  if (!error) return;

  const missingLanguageColumn = /preferred_language|column/i.test(String(error.message || ''));
  if (!missingLanguageColumn) throw error;

  const fallback = { ...profileData };
  delete fallback.preferred_language;
  const { error: fallbackError } = await sb.from('profiles').upsert(fallback);
  if (fallbackError) throw fallbackError;
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
  await sb.auth.signOut();
  location.reload();
}

async function signInAndLaunch(email, password, loginErrorId) {
  return runWithBusy(async () => {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      showAuthError(loginErrorId, translations[currentLanguage].loginErrorWrong);
      return false;
    }

    currentUser = data.user;
    const { data: profile } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
    const preferredLanguage = normalizeLanguage(
      profile?.preferred_language || getSavedLanguageForEmail(email) || currentLanguage
    );
    applyLanguage(preferredLanguage);
    saveLanguageForEmail(email, preferredLanguage);

    if (profile) {
      myProfileName = profile.name || email;
      myProfilePic = profile.profile_pic || '';
      localStorage.setItem(PROFILE_NAME_KEY, myProfileName);
      localStorage.setItem(PROFILE_PIC_KEY, myProfilePic);
    }

    await loadAllData();
    launchApp(currentUser, profile);
    return true;
  }, translations[currentLanguage].loginHeading);
}

function launchApp(user, profile) {
  document.getElementById('auth-overlay').classList.add('hidden');
  document.getElementById('app-shell-wrapper').classList.remove('hidden');

  const userBarSlot = document.getElementById('user-bar-slot');
  let userBar = document.getElementById('user-bar');
  if (!userBar) {
    userBar = document.createElement('div');
    userBar.id = 'user-bar';
    userBar.className = 'user-bar';
    userBarSlot.appendChild(userBar);
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
      await sb.auth.signOut();
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
    myProfilePic = await readImageAsDataURL(file);
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
  renderProjects();
  updateHeroImage();
  renderGroups();
  updateGroupsBadge();
}

async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();

  if (session) {
    currentUser = session.user;
    const { data: profile } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
    myProfileName = profile?.name || currentUser.email || 'You';
    myProfilePic = profile?.profile_pic || '';
    localStorage.setItem(PROFILE_NAME_KEY, myProfileName);
    localStorage.setItem(PROFILE_PIC_KEY, myProfilePic);
    const preferredLanguage = normalizeLanguage(
      profile?.preferred_language || getSavedLanguageForEmail(currentUser.email) || currentLanguage
    );
    applyLanguage(preferredLanguage);
    saveLanguageForEmail(currentUser.email, preferredLanguage);

    if (profile) {
      myProfileName = profile.name || currentUser.email;
      myProfilePic = profile.profile_pic || '';
      localStorage.setItem(PROFILE_NAME_KEY, myProfileName);
      localStorage.setItem(PROFILE_PIC_KEY, myProfilePic);
    }
    await loadAllData();
    launchApp(currentUser, profile);
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
    const password = document.getElementById('login-password').value;
    await signInAndLaunch(email, password, 'login-error');
  });

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim().toLowerCase();
    const password = document.getElementById('register-password').value;
    if (password.length < 6) { showAuthError('register-error', translations[currentLanguage].registerErrorShort); return; }
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) { showAuthError('register-error', error.message); return; }
    if (!data?.user) {
      showAuthError('register-error', translations[currentLanguage].registerNeedEmailConfirm);
      return;
    }

    currentUser = data.user;
    if (!data.session) {
      const autoLogin = await sb.auth.signInWithPassword({ email, password });
      if (autoLogin.error || !autoLogin.data?.user) {
        showAuthError('register-error', translations[currentLanguage].registerNeedEmailConfirm);
        return;
      }
      currentUser = autoLogin.data.user;
    }

    await upsertProfileWithLanguage({ id: currentUser.id, name, profile_pic: '' });
    saveLanguageForEmail(email, currentLanguage);

    if (!isAdminUser(email)) {
      await sb.from('membership_requests').upsert({
        id: `req-${currentUser.id}`,
        name,
        email,
        created_at: new Date().toISOString()
      });
    }

    myProfileName = name;
    localStorage.setItem(PROFILE_NAME_KEY, name);
    await runWithBusy(async () => {
      await loadAllData();
      launchApp(currentUser, { name, profile_pic: '' });
    }, translations[currentLanguage].registerHeading);
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
