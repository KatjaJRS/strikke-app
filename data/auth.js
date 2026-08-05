// ── Login og rettigheder — Supabase authentication ────────────────────────

async function loadAllData() {
  await runWithBusy(async () => {
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

    // Grupper + beskeder
    const { data: gData } = await sb.from('groups').select('*, messages(*)');
    groups = (gData || []).map(g => ({
      id: g.id, name: g.name,
      invitedPeople: g.invited_people || [],
      messages: (g.messages || [])
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map(m => ({
          id: m.id, sender: m.sender_name || 'You',
          text: m.text || '', image: m.image || '',
          link: m.link || '', linkLabel: m.link_label || '',
          createdAt: new Date(m.created_at).getTime()
        }))
    }));
    if (groups.length > 0 && !groups.some(g => g.id === activeGroupId)) activeGroupId = groups[0].id;
    else if (groups.length === 0) activeGroupId = null;

    // Medlemsanmodninger
    const { data: rData } = await sb.from('membership_requests').select('*');
    membershipRequests = (rData || []).map(r => ({
      id: r.id, name: r.name, email: r.email || '',
      createdAt: new Date(r.created_at).getTime()
    }));
  }, 'Henter dine projekter...');
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
    const displayName = profile?.name || user.email;
    const initials = displayName.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const hue = [...displayName].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
    const pic = myProfilePic;
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

  function openProfileModal() {
    const modal = document.getElementById('profile-modal');
    modal.classList.remove('hidden');
    document.getElementById('profile-edit-name').value = profile?.name || '';
    document.getElementById('profile-edit-email').value = user.email || '';
    document.getElementById('profile-current-password').value = '';
    document.getElementById('profile-new-password').value = '';
    document.getElementById('profile-edit-error').classList.add('hidden');
    document.getElementById('profile-edit-success').classList.add('hidden');
    updateModalAvatar();
  }

  function updateModalAvatar() {
    const av = document.getElementById('profile-modal-avatar');
    if (myProfilePic) {
      av.innerHTML = '';
      av.style.backgroundImage = `url(${myProfilePic})`;
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
    await sb.from('profiles').upsert({ id: currentUser.id, name: profile?.name || '', profile_pic: myProfilePic });
    updateModalAvatar();
    refreshUserBar();
    renderGroups();
    if (typeof updateProfilePreview === 'function') updateProfilePreview();
  });

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
      await sb.from('profiles').upsert({ id: currentUser.id, name: newName, profile_pic: myProfilePic || '' });
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

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { showAuthError('login-error', translations[currentLanguage].loginErrorWrong); return; }
    currentUser = data.user;
    const { data: profile } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
    if (profile) {
      myProfileName = profile.name || email;
      myProfilePic = profile.profile_pic || '';
      localStorage.setItem(PROFILE_NAME_KEY, myProfileName);
      localStorage.setItem(PROFILE_PIC_KEY, myProfilePic);
    }
    await loadAllData();
    launchApp(currentUser, profile);
  });

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim().toLowerCase();
    const password = document.getElementById('register-password').value;
    if (password.length < 6) { showAuthError('register-error', translations[currentLanguage].registerErrorShort); return; }
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) { showAuthError('register-error', error.message); return; }
    currentUser = data.user;
    await sb.from('profiles').upsert({ id: currentUser.id, name, profile_pic: '' });
    myProfileName = name;
    localStorage.setItem(PROFILE_NAME_KEY, name);
    await loadAllData();
    launchApp(currentUser, { name, profile_pic: '' });
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
