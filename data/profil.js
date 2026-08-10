// ── Brugerprofil — visning og redigering ──────────────────────────────────

const profileNameInput = document.getElementById('profile-name-input');
const profilePicInput = document.getElementById('profile-pic-input');
const profilePicBtn = document.getElementById('profile-pic-btn');
const profileAvatarPreview = document.getElementById('profile-avatar-preview');

async function saveCurrentProfileToDatabase() {
  if (!currentUser) return;
  await sb.from('profiles').upsert({
    id: currentUser.id,
    name: myProfileName || '',
    profile_pic: myProfilePic || ''
  });
}

function updateProfilePreview() {
  if (myProfilePic) {
    profileAvatarPreview.innerHTML = '';
    profileAvatarPreview.style.backgroundImage = `url(${myProfilePic})`;
    profileAvatarPreview.style.backgroundSize = 'cover';
    profileAvatarPreview.style.backgroundPosition = 'center';
    profileAvatarPreview.textContent = '';
    profileAvatarPreview.className = 'avatar';
  } else {
    profileAvatarPreview.style.backgroundImage = '';
    const name = myProfileName || 'Y';
    const initials = name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
    profileAvatarPreview.className = 'avatar avatar-initials';
    profileAvatarPreview.style.background = `hsl(${hue},55%,65%)`;
    profileAvatarPreview.textContent = initials;
  }
}

if (profileNameInput) {
  profileNameInput.value = myProfileName !== 'You' ? myProfileName : '';
  profileNameInput.addEventListener('input', () => {
    myProfileName = profileNameInput.value.trim() || 'You';
    localStorage.setItem(PROFILE_NAME_KEY, myProfileName);
    saveCurrentProfileToDatabase();
    updateProfilePreview();
    if (typeof refreshCurrentUserDisplay === 'function') refreshCurrentUserDisplay();
    if (typeof refreshCurrentProfileModalAvatar === 'function') refreshCurrentProfileModalAvatar();
    renderGroups();
  });
}

if (profilePicBtn) {
  profilePicBtn.addEventListener('click', () => profilePicInput.click());
}

if (profilePicInput) {
  profilePicInput.addEventListener('change', async () => {
    const file = profilePicInput.files[0];
    if (!file) return;
    const dataUrl = await readImageAsDataURL(file);
    myProfilePic = dataUrl;
    localStorage.setItem(PROFILE_PIC_KEY, dataUrl);
    await saveCurrentProfileToDatabase();
    updateProfilePreview();
    if (typeof refreshCurrentUserDisplay === 'function') refreshCurrentUserDisplay();
    if (typeof refreshCurrentProfileModalAvatar === 'function') refreshCurrentProfileModalAvatar();
    renderGroups();
  });
}

updateProfilePreview();
