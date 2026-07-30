const form = document.getElementById('project-form');
const nameInput = document.getElementById('project-name');
const patternInput = document.getElementById('pattern-name');
const statusInput = document.getElementById('project-status');
const notesInput = document.getElementById('project-notes');
const patternLinkInput = document.getElementById('pattern-link');
const needleInputs = [
  document.getElementById('needle-1-type'),
  document.getElementById('needle-2-type'),
  document.getElementById('needle-3-type'),
];
const yarnRowsContainer = document.getElementById('yarn-rows-container');
const addYarnBtn = document.getElementById('add-yarn-btn');

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

// Wire up remove on the initial row
document.querySelector('#yarn-rows-container .yarn-remove-btn').addEventListener('click', function() {
  if (yarnRowsContainer.querySelectorAll('.yarn-entry').length > 1) this.closest('.yarn-entry').remove();
  autoSaveDraft();
});
document.querySelectorAll('#yarn-rows-container input').forEach(inp => inp.addEventListener('input', autoSaveDraft));

addYarnBtn.addEventListener('click', () => addYarnRow());

// Legacy yarnInputs alias for any remaining old references
const yarnInputs = { map: (fn) => getYarnInputs().map(fn), forEach: (fn) => getYarnInputs().forEach(fn) };
const ratingInput = document.getElementById('project-rating');
const ratingValueInput = document.getElementById('project-rating-value');
const difficultyInput = document.getElementById('project-difficulty');
const difficultyValueInput = document.getElementById('project-difficulty-value');
const imageInput = document.getElementById('project-image');
const list = document.getElementById('project-list');
const currentProjectCard = document.getElementById('current-project-card');
const countLabel = document.getElementById('project-count');
const searchInput = document.getElementById('project-search');
const statusFilterInput = document.getElementById('project-status-filter');
const ratingFilterButtons = Array.from(document.querySelectorAll('.filter-star-btn'));
const difficultyFilterButtons = Array.from(document.querySelectorAll('.filter-heart-btn'));
const heroImage = document.getElementById('hero-image');
const langButtons = Array.from(document.querySelectorAll('.lang-btn'));
const navButtons = Array.from(document.querySelectorAll('.nav-btn'));
const sectionViews = document.querySelectorAll('.section-view');
const groupForm = document.getElementById('group-form');
const groupNameInput = document.getElementById('group-name');
const groupInvitesInput = document.getElementById('group-invites');
const groupList = document.getElementById('group-list');
const activeGroupName = document.getElementById('active-group-name');
const groupMembersList = document.getElementById('group-members');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-message');
const copyInviteButton = document.getElementById('copy-invite-link');

// ── Supabase ─────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://ekwslhhhdawzudjwlrss.supabase.co';
const SUPABASE_KEY = 'sb_publishable_aFZ8R-s3cpJgZUTFp_AsKw_eSC3xW0C';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;

const GROUPS_READ_KEY = 'knitting-groups-last-read';
const GROUP_QUERY_PARAM = 'group';
const LANGUAGE_STORAGE_KEY = 'knitting-language';
const PROFILE_PIC_KEY = 'knitting-profile-picture';
const PROFILE_NAME_KEY = 'knitting-profile-name';
const HERO_IMAGE_KEY = 'knitting-hero-image';
const ROUNDS_KEY = 'knitting-rounds';
const ADMIN_EMAIL = 'roldsgaard@gmail.com';

// Round counter (per device, tracks own knitting progress)
let projectRounds = JSON.parse(localStorage.getItem(ROUNDS_KEY) || '{}');

function getRounds(projectId) { return projectRounds[projectId] || 0; }
function saveRounds() { localStorage.setItem(ROUNDS_KEY, JSON.stringify(projectRounds)); }

// Filter state
let filterStatus = 'all';
let filterRating = 'all';
let filterDifficulty = 'all';

// Edit/new mode: null = new project, string = editing existing project id
let currentEditingProjectId = null;

// Undo state
let lastDeletedProject = null;
let undoTimeoutId = null;

let projects = [];
let groups = [];
let membershipRequests = [];
let groupsLastRead = Number(localStorage.getItem(GROUPS_READ_KEY) || '0');
let activeGroupId = null;
let currentLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en';
let myProfilePic = localStorage.getItem(PROFILE_PIC_KEY) || '';
let myProfileName = localStorage.getItem(PROFILE_NAME_KEY) || 'You';

// Sample data added by loadAllData if DB is empty

// Supabase replaces localStorage init — data loaded asynchronously in loadAllData()

const broadcastChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('knitting-groups-chat') : null;

if (broadcastChannel) {
  broadcastChannel.addEventListener('message', (event) => {
    if (event.data?.type === 'sync') {
      groups = event.data.groups || [];
      normalizeGroups();
      renderGroups();
      updateGroupsBadge();
    }
  });
}

const translations = {
  en: {
    heroEyebrow: 'Fru Sminge\'s Cozy Crafts Planner',
    heroTitle: 'Knitting My Life Away',
    heroSubtitle: 'Knit as if your life depended on it........ Plans, patterns, notes, etc.',
    changeButton: 'Change',
    currentProjectHeading: 'Current project',
    addProjectHeading: 'Add a project',
    projectNameLabel: 'Project name',
    projectNamePlaceholder: 'e.g. Moonlight scarf',
    patternLabel: 'Pattern',
    patternPlaceholder: 'e.g. Garter rib',
    yarnsLabel: 'Yarns used',
    yarnTypePlaceholder: 'Yarn type',
    yarnAmountPlaceholder: 'Amount used',
    needleLabel: 'Knitting needles',
    needlePlaceholder: 'e.g. 4 mm circular',
    statusLabel: 'Progress',
    statusPlanning: 'Planning',
    statusInProgress: 'In progress',
    statusFinished: 'Finished',
    ratingLabel: 'Pattern rating',
    ratingOption0: 'No rating',
    ratingOption1: '1 star',
    ratingOption2: '2 stars',
    ratingOption3: '3 stars',
    ratingOption4: '4 stars',
    ratingOption5: '5 stars',
    difficultyLabel: 'Difficulty',
    difficultyOption0: 'No difficulty',
    difficultyOption1: '1 heart',
    difficultyOption2: '2 hearts',
    difficultyOption3: '3 hearts',
    difficultyOption4: '4 hearts',
    difficultyOption5: '5 hearts',
    notesLabel: 'Notes',
    notesPlaceholder: 'Add yarn details, gauge, or reminders...',
    patternLinkLabel: 'Pattern link or file',
    patternLinkPlaceholder: 'https://... or file name',
    imageLabel: 'Project photo',
    saveNoteButton: 'Save project',
    searchProjectsPlaceholder: 'Search by name, pattern, or notes',
    filterStatusLabel: 'Status',
    statusFilterAll: 'All statuses',
    ratingFilterLabel: 'Pattern rating',
    ratingFilterAll: 'All',
    difficultyFilterLabel: 'Difficulty',
    difficultyFilterAll: 'All',
    editButton: 'Edit',
    difficultyDisplayLabel: 'Difficulty',
    needlesDisplayLabel: 'Knitting needles',
    yarnsDisplayLabel: 'Yarns',
    groupsHeading: 'Groups and Chats',
    groupNameLabel: 'Group name',
    groupNamePlaceholder: 'e.g. Weekend knit circle',
    groupInvitesLabel: 'Invite people',
    groupInvitesPlaceholder: 'Maja, Lars, Emma',
    createGroupButton: 'Create group',
    invitedPeopleHeading: 'Happy knitters in the group',
    myGroupsHeading: 'My groups',
    allMembersHeading: 'All members',
    pendingRequestsHeading: 'Membership requests',
    requestJoinHeading: 'Request to join',
    requestNameLabel: 'Your name',
    requestNamePlaceholder: 'e.g. Maja',
    requestEmailLabel: 'Your email',
    requestEmailPlaceholder: 'maja@example.com',
    requestJoinButton: 'Send request',
    pendingAccept: 'Accept',
    pendingReject: 'Reject',
    requestSentMsg: 'Your request has been sent to the admin!',
    noPendingRequests: 'No pending requests',
    profileNameLabel: 'Your display name',
    profilePicLabel: 'Profile picture',
    profilePicButton: 'Upload photo',
    chatPlaceholder: 'Share a pattern idea...',
    sendButton: 'Send',
    emptyState: 'No projects yet. Add your first knitting idea.',
    deleteButton: 'Delete',
    loginHeading: 'Sign in',
    registerHeading: 'Create account',
    forgotHeading: 'Reset password',
    authEmailLabel: 'Email',
    authPasswordLabel: 'Password',
    authNameLabel: 'Your name',
    loginButton: 'Sign in',
    registerButton: 'Create account',
    forgotButton: 'Send reset request',
    goToRegister: 'New here? Create account',
    goToForgot: 'Forgot password?',
    goToLogin: 'Already have an account? Sign in',
    forgotHint: "Enter your email and we'll send a reset request to the admin.",
    loginErrorWrong: 'Incorrect email or password.',
    loginErrorNotFound: 'No account found with that email.',
    registerErrorExists: 'An account with this email already exists.',
    registerErrorShort: 'Password must be at least 6 characters.',
    forgotSuccessMsg: 'Reset request sent! The admin will be in touch.',
    forgotNotFound: 'No account found with that email.',
    logoutLabel: 'Sign out',
    profileHeading: 'My profile',
    changePasswordLabel: 'Change password',
    currentPasswordLabel: 'Current password',
    newPasswordLabel: 'New password (min. 6 characters)',
    saveChangesButton: 'Save changes',
    profileSaved: '\u2714 Changes saved!',
    profileErrorWrongPw: 'Current password is incorrect.',
    profileErrorShortPw: 'New password must be at least 6 characters.',
  },
  da: {
    heroEyebrow: 'Fru Sminges hyggelige håndværksplanlægger',
    heroTitle: 'Jeg strikker mit liv væk',
    heroSubtitle: 'Strik som om dit liv afhænger af det........ Planer, mønstre, noter, osv.',
    changeButton: 'Skift',
    currentProjectHeading: 'Nuværende projekt',
    addProjectHeading: 'Tilføj et projekt',
    projectNameLabel: 'Projektnavn',
    projectNamePlaceholder: 'fx. Måneskinsjal',
    patternLabel: 'Mønster',
    patternPlaceholder: 'fx. Garter rib',
    yarnsLabel: 'Garn brugt',
    yarnTypePlaceholder: 'Garntype',
    yarnAmountPlaceholder: 'Mængde brugt',
    needleLabel: 'Strikkepinde',
    needlePlaceholder: 'fx. 4 mm rundpind',
    statusLabel: 'Status',
    statusPlanning: 'Planlægger',
    statusInProgress: 'I gang',
    statusFinished: 'Færdig',
    ratingLabel: 'Mønsterbedømmelse',
    ratingOption0: 'Ingen bedømmelse',
    ratingOption1: '1 stjerne',
    ratingOption2: '2 stjerner',
    ratingOption3: '3 stjerner',
    ratingOption4: '4 stjerner',
    ratingOption5: '5 stjerner',
    difficultyLabel: 'Sværhedsgrad',
    difficultyOption0: 'Ingen sværhedsgrad',
    difficultyOption1: '1 hjerte',
    difficultyOption2: '2 hjerter',
    difficultyOption3: '3 hjerter',
    difficultyOption4: '4 hjerter',
    difficultyOption5: '5 hjerter',
    notesLabel: 'Noter',
    notesPlaceholder: 'Tilføj garnoplysninger, strikkefasthed eller påmindelser...',
    patternLinkLabel: 'Mønsterlink eller fil',
    patternLinkPlaceholder: 'https://... eller filnavn',
    imageLabel: 'Projektfoto',
    saveNoteButton: 'Gem projekt',
    projectsHeading: 'Andre projekter',
    searchProjectsPlaceholder: 'Søg efter navn, mønster eller noter',
    filterStatusLabel: 'Status',
    statusFilterAll: 'Alle statusser',
    ratingFilterLabel: 'Mønsterbedømmelse',
    ratingFilterAll: 'Alt',
    difficultyFilterLabel: 'Sværhedsgrad',
    difficultyFilterAll: 'Alt',
    editButton: 'Rediger',
    difficultyDisplayLabel: 'Sværhedsgrad',
    needlesDisplayLabel: 'Strikkepinde',
    yarnsDisplayLabel: 'Garn',
    groupsHeading: 'Grupper og chats',
    groupNameLabel: 'Gruppenavn',
    groupNamePlaceholder: 'fx. Weekendstrikkecircle',
    groupInvitesLabel: 'Invitér personer',
    groupInvitesPlaceholder: 'Maja, Lars, Emma',
    createGroupButton: 'Opret gruppe',
    invitedPeopleHeading: 'Glade strikkere i gruppen',
    myGroupsHeading: 'Mine grupper',
    allMembersHeading: 'Alle medlemmer',
    pendingRequestsHeading: 'Medlemsanmodninger',
    requestJoinHeading: 'Anmod om at blive medlem',
    requestNameLabel: 'Dit navn',
    requestNamePlaceholder: 'fx. Maja',
    requestEmailLabel: 'Din e-mail',
    requestEmailPlaceholder: 'maja@eksempel.dk',
    requestJoinButton: 'Send anmodning',
    pendingAccept: 'Accepter',
    pendingReject: 'Afvis',
    requestSentMsg: 'Din anmodning er sendt til administratoren!',
    noPendingRequests: 'Ingen ventende anmodninger',
    profileNameLabel: 'Dit visningsnavn',
    profilePicLabel: 'Profilbillede',
    profilePicButton: 'Upload billede',
    chatPlaceholder: 'Del en mønsteridé...',
    sendButton: 'Send',
    emptyState: 'Ingen projekter endnu. Tilføj din første strikkeidé.',
    deleteButton: 'Slet',
    loginHeading: 'Log ind',
    registerHeading: 'Opret konto',
    forgotHeading: 'Nulstil adgangskode',
    authEmailLabel: 'E-mail',
    authPasswordLabel: 'Adgangskode',
    authNameLabel: 'Dit navn',
    loginButton: 'Log ind',
    registerButton: 'Opret konto',
    forgotButton: 'Send nulstillingsanmodning',
    goToRegister: 'Ny her? Opret konto',
    goToForgot: 'Glemt adgangskode?',
    goToLogin: 'Har du allerede en konto? Log ind',
    forgotHint: 'Indtast din e-mail, så sender vi en anmodning til administratoren.',
    loginErrorWrong: 'Forkert e-mail eller adgangskode.',
    loginErrorNotFound: 'Ingen konto fundet med den e-mail.',
    registerErrorExists: 'En konto med denne e-mail findes allerede.',
    registerErrorShort: 'Adgangskoden skal være mindst 6 tegn.',
    forgotSuccessMsg: 'Anmodning sendt! Administratoren vender tilbage til dig.',
    forgotNotFound: 'Ingen konto fundet med den e-mail.',
    logoutLabel: 'Log ud',
    profileHeading: 'Min profil',
    changePasswordLabel: 'Ændr adgangskode',
    currentPasswordLabel: 'Nuværende adgangskode',
    newPasswordLabel: 'Ny adgangskode (min. 6 tegn)',
    saveChangesButton: 'Gem ændringer',
    profileSaved: '\u2714 Ændringer gemt!',
    profileErrorWrongPw: 'Nuværende adgangskode er forkert.',
    profileErrorShortPw: 'Ny adgangskode skal være mindst 6 tegn.',
  },
};

function applyLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  
  // Update all [data-i18n] elements
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    el.textContent = translations[lang][key] || el.textContent;
  });
  
  // Update all [data-i18n-placeholder] elements
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = translations[lang][key] || el.placeholder;
  });
  
  // Update active language button
  langButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  
  renderProjects();
  renderGroups();
}

function switchSection(sectionId) {
  // Hide all sections
  sectionViews.forEach((section) => {
    section.classList.remove('active');
  });
  
  // Show the selected section
  const activeSection = document.getElementById(sectionId);
  if (activeSection) {
    activeSection.classList.add('active');
  }
  
  // Update active button
  navButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.section === sectionId);
  });
}

function updateHeroImage() {
  // Hero image is managed independently - only changed by the 📷 upload button
  // Do NOT auto-change it based on project images
}

function getOrderedProjects() {
  return [...projects].sort((a, b) => {
    const aTime = Number(a.lastViewedAt || 0);
    const bTime = Number(b.lastViewedAt || 0);
    return bTime - aTime;
  });
}

function renderStars(rating) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(i <= rating ? '⭐' : '☆');
  }
  return stars.join('');
}

function renderHearts(difficulty) {
  const hearts = [];
  for (let i = 1; i <= 5; i++) {
    hearts.push(i <= difficulty ? '❤️' : '🤍');
  }
  return hearts.join('');
}

function translateStatus(status) {
  const statusMap = {
    'Planning': translations[currentLanguage].statusPlanning,
    'In progress': translations[currentLanguage].statusInProgress,
    'Finished': translations[currentLanguage].statusFinished
  };
  return statusMap[status] || status;
}

function renderYarns(yarns) {
  const yarnsList = yarns.filter(y => y.type).map(y => {
    const colorDot = y.color ? `<span class="color-swatch" style="background-color: ${escapeHTML(y.color)};"></span>` : '';
    return `${colorDot}${escapeHTML(y.type)}${y.amount ? ` - ${escapeHTML(y.amount)}` : ''}`;
  }).join(' ');
  return yarnsList ? `<p><strong>${translations[currentLanguage].yarnsDisplayLabel}:</strong> ${yarnsList}</p>` : '';
}

function renderNeedles(needles) {
  if (!Array.isArray(needles)) {
    needles = needles ? [needles] : [];
  }
  const needlesList = needles.filter(n => n && n.trim()).map(n => escapeHTML(n)).join(' ');
  return needlesList ? `<p><strong>${translations[currentLanguage].needlesDisplayLabel}:</strong> ${needlesList}</p>` : '';
}

function getAmountUsedString(yarns) {
  const amounts = yarns.filter(y => y.amount).map(y => escapeHTML(y.amount));
  return amounts.length > 0 ? amounts.join(' / ') : '';
}

function populateFormWithProject(project) {
  if (!project) return;
  currentEditingProjectId = project.id;
  const formHeading = document.getElementById('form-heading');
  if (formHeading) formHeading.textContent = translations[currentLanguage].addProjectHeading || 'Add a project';
  
  // Populate basic fields
  nameInput.value = project.name || '';
  patternInput.value = project.pattern || '';
  notesInput.value = project.notes || '';
  patternLinkInput.value = project.patternLink || '';
  statusInput.value = project.status || 'Planning';
  
  // Populate rating and difficulty
  ratingValueInput.value = project.rating || 0;
  difficultyValueInput.value = project.difficulty || 0;
  
  // Update rating stars
  const starButtons = Array.from(ratingInput.querySelectorAll('.star-btn'));
  starButtons.forEach((btn) => {
    const isActive = Number(btn.dataset.value) <= Number(ratingValueInput.value);
    btn.classList.toggle('active', isActive);
  });
  
  // Update difficulty hearts
  const heartButtons = Array.from(difficultyInput.querySelectorAll('.heart-btn'));
  heartButtons.forEach((btn) => {
    const isActive = Number(btn.dataset.value) <= Number(difficultyValueInput.value);
    btn.classList.toggle('active', isActive);
  });
  
  // Populate yarns — rebuild rows dynamically
  const yarns = project.yarns || [];
  yarnRowsContainer.innerHTML = '';
  const yarnList = yarns.filter(y => y.type || y.color || y.amount);
  if (yarnList.length === 0) yarnList.push({ type: '', color: '', amount: '' });
  yarnList.forEach(yarn => addYarnRow(yarn.type || '', yarn.color || '', yarn.amount || ''));
  
  // Populate needles
  const needles = project.needles || [];
  needleInputs.forEach((needle, index) => {
    needle.value = needles[index] || '';
  });
}

function renderCurrentProject() {
  const orderedProjects = getOrderedProjects();
  const currentProject = orderedProjects.length > 0 ? orderedProjects[0] : null;

  if (!currentProject) {
    currentProjectCard.innerHTML = `<p style="color: #a35d70; text-align: center;">${translations[currentLanguage].emptyState}</p>`;
    return;
  }
  
  // Only populate form when editing the EXACT project that was opened for editing
  if (currentEditingProjectId !== null && currentProject.id === currentEditingProjectId) {
    populateFormWithProject(currentProject);
  }

  const card = document.createElement('article');
  card.className = 'project-card featured';
  const difficultyDisplay = currentProject.difficulty && currentProject.difficulty > 0 ? `<p class="difficulty"><strong>${translations[currentLanguage].difficultyDisplayLabel}:</strong> ${renderHearts(currentProject.difficulty)}</p>` : '';
  const needlesDisplay = renderNeedles(currentProject.needles || []);
  const yarnsDisplay = renderYarns(currentProject.yarns || []);
  const amountUsed = getAmountUsedString(currentProject.yarns || []);
  const translatedStatus = translateStatus(currentProject.status);
  
  card.innerHTML = `
    <div class="card-layout">
      <div class="card-text">
        <div class="card-top">
          <div class="card-main-info">
            <div class="header-with-rating">
              <h3>${escapeHTML(currentProject.name)}</h3>
              ${currentProject.rating && currentProject.rating > 0 ? `<span class="stars">${renderStars(currentProject.rating)}</span>` : ''}
            </div>
            ${difficultyDisplay}
            ${yarnsDisplay}
            ${needlesDisplay}
            ${currentProject.notes ? `<p><strong>${escapeHTML(translations[currentLanguage].notesLabel)}:</strong> ${escapeHTML(currentProject.notes)}</p>` : ''}
          </div>
          <span class="status-badge">${escapeHTML(translatedStatus)}</span>
        </div>
      </div>
      ${currentProject.image ? `<img class="card-img-square" src="${currentProject.image}" alt="${escapeHTML(currentProject.name)}" />` : ''}
    </div>
  `;
  currentProjectCard.innerHTML = '';
  currentProjectCard.appendChild(card);
}

function renderProjects() {
  renderCurrentProject();
  
  const orderedProjects = getOrderedProjects();
  const currentId = orderedProjects[0]?.id;
  // Show ALL projects in the list (current one is highlighted)
  let previousProjects = [...orderedProjects];
  
  // Apply filters
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
    const difficultyDisplay = project.difficulty && project.difficulty > 0 ? `<p class="difficulty"><strong>${translations[currentLanguage].difficultyDisplayLabel}:</strong> ${renderHearts(project.difficulty)}</p>` : '';
    const needlesDisplay = renderNeedles(project.needles || []);
    const yarnsDisplay = renderYarns(project.yarns || []);
    const amountUsed = getAmountUsedString(project.yarns || []);
    const translatedStatus = translateStatus(project.status);
    const currentLabel = isCurrent ? `<span class="current-badge">✏️ ${translations[currentLanguage].currentProjectHeading}</span>` : '';
    
    card.innerHTML = `
      <div class="card-layout">
        <div class="card-text">
          <div class="card-top">
            <div class="card-main-info">
              <div class="header-with-rating">
                <h3>${escapeHTML(project.name)}</h3>
                ${project.rating && project.rating > 0 ? `<span class="stars">${renderStars(project.rating)}</span>` : ''}
                ${currentLabel}
              </div>
              ${difficultyDisplay}
              ${yarnsDisplay}
              ${needlesDisplay}
              ${project.notes ? `<p><strong>${escapeHTML(translations[currentLanguage].notesLabel)}:</strong> ${escapeHTML(project.notes)}</p>` : ''}
            </div>
            <span class="status-badge">${escapeHTML(translatedStatus)}</span>
          </div>
        </div>
        ${project.image ? `<img class="card-img-square" src="${project.image}" alt="${escapeHTML(project.name)}" />` : ''}
      </div>
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
    `;

    function openProjectForEditing() {
      currentEditingProjectId = project.id; // ← must be set BEFORE renderProjects
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

    // Click anywhere on card to open for editing
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
        // Store the deleted project for undo
        lastDeletedProject = project;
        
        // Clear any existing undo timeout
        if (undoTimeoutId) {
          clearTimeout(undoTimeoutId);
        }
        
        // Delete the project
        projects = projects.filter((p) => p.id !== project.id);
        saveProjects();
        renderProjects();
        updateHeroImage();
        
        // Show undo notification and auto-delete after 5 seconds if not undone
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

function escapeHTML(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

async function readImageAsDataURL(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

function createProjectId(project, index) {
  return project.id || `project-${Date.now()}-${index}`;
}

function normalizeProjects() {
  projects = projects.map((project, index) => {
    const yarns = (project.yarns || []).slice(0, 3);
    while (yarns.length < 3) {
      yarns.push({ type: '', color: '', amount: '' });
    }
    // Handle both old needleSize format and new needles array format
    let needles = project.needles || [];
    if (typeof project.needleSize === 'string' && project.needleSize && needles.length === 0) {
      needles = [project.needleSize];
    }
    return {
      ...project,
      id: project.id || createProjectId(project, index),
      lastViewedAt: project.lastViewedAt || 0,
      needles: needles,
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

async function saveProjects() {
  if (!currentUser) return true;
  try {
    // Ensure profile row exists before saving (avoids FK constraint failures)
    await sb.from('profiles').upsert({
      id: currentUser.id,
      name: myProfileName || currentUser.email || 'User',
      profile_pic: myProfilePic || ''
    });

    const { error } = await sb.from('projects').upsert(
      projects.map(p => ({
        id: p.id,
        user_id: currentUser.id,
        name: p.name,
        pattern: p.pattern || '',
        status: p.status || 'Planning',
        notes: p.notes || '',
        pattern_link: p.patternLink || '',
        needles: p.needles || [],
        yarns: p.yarns || [],
        rating: p.rating || 0,
        difficulty: p.difficulty || 0,
        image: p.image || '',
        last_viewed_at: p.lastViewedAt || 0
      }))
    );
    if (error) console.warn('Projects upsert warning:', error.message);
    return true;
  } catch (e) { console.error('Error saving projects:', e); return false; }
}

function normalizeGroups() {
  groups = (Array.isArray(groups) ? groups : []).map((group) => ({
    id: group.id || `group-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: group.name || 'Pattern circle',
    invitedPeople: Array.isArray(group.invitedPeople) ? group.invitedPeople : [],
    messages: Array.isArray(group.messages) ? group.messages : [],
  }));

  if (groups.length === 0) {
    groups = [];
    activeGroupId = null;
  }

  const params = new URLSearchParams(window.location.search);
  const requestedGroupId = params.get(GROUP_QUERY_PARAM);

  if (requestedGroupId && groups.some((group) => group.id === requestedGroupId)) {
    activeGroupId = requestedGroupId;
  } else if (groups.length > 0 && !groups.some((group) => group.id === activeGroupId)) {
    activeGroupId = groups[0].id;
  } else if (groups.length === 0) {
    activeGroupId = null;
  }
}

function updateGroupsBadge() {
  const groupsNavBtn = document.querySelector('.nav-btn[data-section="groups-chats"]');
  if (!groupsNavBtn) return;

  let unread = 0;
  groups.forEach((group) => {
    group.messages.forEach((msg) => {
      if (msg.createdAt > groupsLastRead) unread++;
    });
  });

  let badge = groupsNavBtn.querySelector('.notif-badge');
  if (unread > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'notif-badge';
      groupsNavBtn.appendChild(badge);
    }
    badge.textContent = unread;
  } else if (badge) {
    badge.remove();
  }
}

function markGroupsAsRead() {
  groupsLastRead = Date.now();
  localStorage.setItem(GROUPS_READ_KEY, groupsLastRead);
  updateGroupsBadge();
}

async function saveGroups() {
  try {
    await sb.from('groups').upsert(
      groups.map(g => ({ id: g.id, name: g.name, invited_people: g.invitedPeople || [] }))
    );
    updateGroupsBadge();
  } catch (e) { console.error('Error saving groups:', e); }
}

async function saveNewMessage(groupId, message) {
  try {
    await sb.from('messages').insert({
      id: message.id,
      group_id: groupId,
      sender_name: message.sender || 'You',
      text: message.text || '',
      image: message.image || '',
      link: message.link || '',
      link_label: message.linkLabel || '',
      created_at: new Date(message.createdAt).toISOString()
    });
  } catch (e) { console.error('Error saving message:', e); }
}

function setActiveGroup(groupId) {
  activeGroupId = groupId;
  const params = new URLSearchParams(window.location.search);
  params.set(GROUP_QUERY_PARAM, groupId);
  const nextUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', nextUrl);
  renderGroups();
}

function getActiveGroup() {
  return groups.find((group) => group.id === activeGroupId) || groups[0] || null;
}

function getAvatarHTML(name, picUrl) {
  if (picUrl) {
    return `<img class="avatar" src="${picUrl}" alt="${escapeHTML(name)}" />`;
  }
  const initials = name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return `<span class="avatar avatar-initials" style="background:hsl(${hue},55%,65%)">${escapeHTML(initials)}</span>`;
}

function renderGroups() {
  groupList.innerHTML = '';

  groups.forEach((group) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `group-pill${group.id === activeGroupId ? ' active' : ''}`;
    button.textContent = group.name;
    button.addEventListener('click', () => setActiveGroup(group.id));
    groupList.appendChild(button);
  });

  // Render pending requests in sidebar
  const pendingList = document.getElementById('pending-requests-list');
  if (pendingList) {
    if (membershipRequests.length === 0) {
      pendingList.innerHTML = `<li class="no-pending">${translations[currentLanguage].noPendingRequests}</li>`;
    } else {
      pendingList.innerHTML = membershipRequests.map((req) => `
        <li class="pending-request-item">
          <div class="pending-info">
            ${getAvatarHTML(req.name, '')}
            <div>
              <strong>${escapeHTML(req.name)}</strong>
              ${req.email ? `<span class="pending-email">${escapeHTML(req.email)}</span>` : ''}
            </div>
          </div>
          <div class="pending-actions">
            <button class="accept-btn" data-id="${escapeHTML(req.id)}">${translations[currentLanguage].pendingAccept}</button>
            <button class="reject-btn" data-id="${escapeHTML(req.id)}">${translations[currentLanguage].pendingReject}</button>
          </div>
        </li>
      `).join('');

      pendingList.querySelectorAll('.accept-btn').forEach(btn => {
        btn.addEventListener('click', () => acceptMember(btn.dataset.id));
      });
      pendingList.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', () => rejectMember(btn.dataset.id));
      });
    }
  }

  // Render all unique members alphabetically
  const allMembersList = document.getElementById('all-members-list');
  if (allMembersList) {
    const allMembers = [...new Set(groups.flatMap(g => g.invitedPeople))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
    allMembersList.innerHTML = allMembers.length
      ? allMembers.map(person => `<li>${getAvatarHTML(person, '')} ${escapeHTML(person)}</li>`).join('')
      : '';
  }

  const activeGroup = getActiveGroup();
  if (!activeGroup) {
    activeGroupName.textContent = 'No group yet';
    groupMembersList.innerHTML = '';
    chatMessages.innerHTML = '<p class="chat-empty">Create a group to start chatting.</p>';
    return;
  }

  activeGroupName.textContent = activeGroup.name;

  groupMembersList.innerHTML = activeGroup.invitedPeople.length
    ? activeGroup.invitedPeople.map((person) => `<li>${getAvatarHTML(person, '')} ${escapeHTML(person)}</li>`).join('')
    : '<li>No invites yet</li>';

  if (activeGroup.messages.length === 0) {
    chatMessages.innerHTML = '<p class="chat-empty">No messages yet. Start the conversation.</p>';
  } else {
    chatMessages.innerHTML = activeGroup.messages
      .map((message) => {
        const timestamp = new Date(message.createdAt).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        });
        const isMe = !message.sender || message.sender === 'You' || message.sender === myProfileName;
        const senderName = isMe ? myProfileName : message.sender;
        const pic = isMe ? myProfilePic : '';

        let contentHTML = '';
        if (message.image) {
          contentHTML += `<img class="chat-img" src="${message.image}" alt="shared image" />`;
        }
        if (message.link && isMe) {
          const label = escapeHTML(message.linkLabel || message.link);
          contentHTML += `<a class="chat-link" href="${escapeHTML(message.link)}" target="_blank" rel="noopener noreferrer">🔗 ${label}</a>`;
        }
        if (message.text) {
          contentHTML += `<p>${escapeHTML(message.text)}</p>`;
        }

        return `
          <article class="chat-bubble${isMe ? ' chat-bubble-me' : ''}">
            <div class="chat-bubble-inner">
              ${getAvatarHTML(senderName, pic)}
              <div class="chat-content">
                <div class="chat-meta">
                  <strong>${escapeHTML(senderName)}</strong>
                  <span>${escapeHTML(timestamp)}</span>
                </div>
                ${contentHTML}
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }
}

function getOrderedProjects() {
  return [...projects].sort((a, b) => {
    const aTime = Number(a.lastViewedAt || 0);
    const bTime = Number(b.lastViewedAt || 0);

    if (aTime !== bTime) {
      return bTime - aTime;
    }

    return 0;
  });
}

function escapeHTML(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readImageAsDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

if (projects.length === 0) {
  projects = [
    {
      id: 'project-moonlight',
      name: 'Moonlight scarf',
      pattern: 'Garter rib',
      status: 'In progress',
      notes: 'Need a second ball of yarn and keep the edges neat.',
      needles: ['4 mm circular'],
      patternLink: 'https://example.com/moonlight-scarf',
      lastViewedAt: Date.now() - 1000,
    },
    {
      id: 'project-weekend',
      name: 'Weekend hat',
      pattern: 'Cable twist',
      status: 'Planning',
      notes: 'Test the gauge before casting on.',
      needles: ['3.5 mm double-pointed'],
      patternLink: 'https://example.com/weekend-hat',
      lastViewedAt: Date.now() - 2000,
    },
  ];
  saveProjects();
}

renderProjects();
renderGroups();

// Undo notification functions
function showUndoNotification() {
  let notification = document.getElementById('undo-notification');
  
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'undo-notification';
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #e35c86;
      color: white;
      padding: 14px 18px;
      border-radius: 8px;
      font-weight: 600;
      display: flex;
      gap: 12px;
      align-items: center;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
      #undo-notification.hide {
        animation: slideOut 0.3s ease forwards;
      }
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
    setTimeout(() => {
      notification.style.display = 'none';
    }, 300);
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
    
    // Clear the timeout
    if (undoTimeoutId) {
      clearTimeout(undoTimeoutId);
      undoTimeoutId = null;
    }
  }
}

// ── Auto-save draft ──────────────────────────────────────────────────────────
const DRAFT_KEY = 'knitting-form-draft';

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

// Wire auto-save to all static form inputs
[nameInput, patternInput, notesInput, patternLinkInput].forEach(el => el.addEventListener('input', () => { autoSaveDraft(); autoSaveCurrentProject(); }));
statusInput.addEventListener('change', () => { autoSaveDraft(); autoSaveCurrentProject(); });
needleInputs.forEach(n => n.addEventListener('input', () => { autoSaveDraft(); autoSaveCurrentProject(); }));

let autoSaveTimer = null;
function autoSaveCurrentProject() {
  // Only auto-save when the user is actively editing an EXISTING project
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
      yarns: getYarnInputs().map(y => ({ type: y.type.value.trim(), color: y.color.value.trim(), amount: y.amount.value.trim() })),
    };
    projects = projects.map(p => p.id === currentEditingProjectId ? updatedProject : p);
    await saveProjects();
  }, 2000);
}

// Restore draft on load
restoreDraft();

// Auto-save every 10 seconds
setInterval(async () => {
  if (currentUser && projects.length > 0) {
    await saveProjects();
  }
}, 10000);

// Language button event listeners
langButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyLanguage(button.dataset.lang);
  });
});

// Navigation button event listeners
navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    switchSection(button.dataset.section);
    if (button.dataset.section === 'groups-chats') {
      markGroupsAsRead();
    }
  });
});

const HERO_PAN_KEY = 'knitting-hero-pan';

// Hero image click to cycle projects + drag to pan
if (heroImage) {
  const savedHeroImage = localStorage.getItem(HERO_IMAGE_KEY);
  if (savedHeroImage) heroImage.src = savedHeroImage;

  const savedPan = JSON.parse(localStorage.getItem(HERO_PAN_KEY) || '{"x":50,"y":50}');
  heroImage.style.objectPosition = `${savedPan.x}% ${savedPan.y}%`;

  let isDragging = false, dragStartX = 0, dragStartY = 0, panX = savedPan.x, panY = savedPan.y;

  heroImage.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    heroImage.style.cursor = 'grabbing';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = (e.clientX - dragStartX) / heroImage.offsetWidth * -100;
    const dy = (e.clientY - dragStartY) / heroImage.offsetHeight * -100;
    panX = Math.max(0, Math.min(100, savedPan.x + dx));
    panY = Math.max(0, Math.min(100, savedPan.y + dy));
    heroImage.style.objectPosition = `${panX}% ${panY}%`;
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    heroImage.style.cursor = 'grab';
    savedPan.x = panX;
    savedPan.y = panY;
    localStorage.setItem(HERO_PAN_KEY, JSON.stringify({ x: panX, y: panY }));
  });

  heroImage.style.cursor = 'grab';

  heroImage.addEventListener('click', (e) => {
    if (Math.abs(e.clientX - dragStartX) > 5 || Math.abs(e.clientY - dragStartY) > 5) return;
    const orderedProjects = getOrderedProjects();
    if (orderedProjects.length > 1) {
      projects = projects.map((p) => ({
        ...p,
        lastViewedAt: p.id === orderedProjects[1].id ? Date.now() : p.lastViewedAt
      }));
      saveProjects();
      renderProjects();
      updateHeroImage();
    }
  });
}

// Hero image upload
const heroImageInput = document.getElementById('hero-image-input');
if (heroImageInput) {
  heroImageInput.addEventListener('change', async () => {
    const file = heroImageInput.files[0];
    if (!file) return;
    const dataUrl = await readImageAsDataURL(file);
    heroImage.src = dataUrl;
    localStorage.setItem(HERO_IMAGE_KEY, dataUrl);
    heroImageInput.value = '';
  });
}

// Copy invite button
if (copyInviteButton) {
  copyInviteButton.addEventListener('click', async () => {
    const currentGroup = getActiveGroup();
    if (!currentGroup) return;
    const url = new URL(window.location.href);
    url.searchParams.set(GROUP_QUERY_PARAM, currentGroup.id);
    try {
      await navigator.clipboard.writeText(url.toString());
      copyInviteButton.textContent = 'Link copied';
      setTimeout(() => {
        copyInviteButton.textContent = 'Copy invite link';
      }, 1600);
    } catch (error) {
      copyInviteButton.textContent = 'Copy failed';
      setTimeout(() => {
        copyInviteButton.textContent = 'Copy invite link';
      }, 1600);
    }
  });
}

function clearFormForNew() {
  currentEditingProjectId = null;
  nameInput.value = '';
  patternInput.value = '';
  notesInput.value = '';
  patternLinkInput.value = '';
  statusInput.value = 'Planning';
  ratingValueInput.value = 0;
  difficultyValueInput.value = 0;
  starButtons.forEach(btn => btn.classList.remove('active'));
  heartButtons.forEach(btn => btn.classList.remove('active'));
  yarnRowsContainer.innerHTML = '';
  addYarnRow();
  needleInputs.forEach(n => n.value = '');
  clearDraft();
}

// New project button
const newProjectBtn = document.getElementById('new-project-btn');
if (newProjectBtn) {
  newProjectBtn.addEventListener('click', () => {
    clearFormForNew();
    nameInput.focus();
  });
}

// Star rating buttons
const starButtons = Array.from(ratingInput.querySelectorAll('.star-btn'));
starButtons.forEach((button) => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const value = button.dataset.value;
    ratingValueInput.value = value;
    starButtons.forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.value) <= Number(value));
    });
  });
});

// Heart rating buttons
const heartButtons = Array.from(difficultyInput.querySelectorAll('.heart-btn'));
heartButtons.forEach((button) => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const value = button.dataset.value;
    difficultyValueInput.value = value;
    heartButtons.forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.value) <= Number(value));
    });
  });
});

// Filter buttons for previous projects
statusFilterInput.addEventListener('change', (e) => {
  filterStatus = e.target.value;
  renderProjects();
});

ratingFilterButtons.forEach((button) => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const value = button.dataset.rating;
    filterRating = value;
    ratingFilterButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.rating === value);
    });
    renderProjects();
  });
});

difficultyFilterButtons.forEach((button) => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const value = button.dataset.difficulty;
    filterDifficulty = value;
    difficultyFilterButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.difficulty === value);
    });
    renderProjects();
  });
});

// Form submission
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const pattern = patternInput.value.trim();
  const notes = notesInput.value.trim();
  const patternLink = patternLinkInput.value.trim();
  const needles = needleInputs.map(needle => needle.value.trim()).filter(Boolean);
  const rating = Number(ratingValueInput.value) || 0;
  const difficulty = Number(difficultyValueInput.value) || 0;
  const yarns = yarnInputs.map(yarn => ({
    type: yarn.type.value.trim(),
    color: yarn.color.value.trim(),
    amount: yarn.amount.value.trim(),
  }));

  if (!name || !pattern) return;

  const image = await readImageAsDataURL(imageInput.files[0]);

  if (currentEditingProjectId) {
    // Update existing project
    projects = projects.map(p => p.id === currentEditingProjectId ? {
      ...p, name, pattern, status: statusInput.value, notes, patternLink,
      needles, rating, difficulty, yarns,
      ...(image ? { image } : {}),
    } : p);
  } else {
    // Check if a project with this exact name already exists → update it instead of duplicating
    const existingByName = projects.find(p => p.name.trim().toLowerCase() === name.toLowerCase());
    if (existingByName) {
      currentEditingProjectId = existingByName.id;
      projects = projects.map(p => p.id === existingByName.id ? {
        ...p, name, pattern, status: statusInput.value, notes, patternLink,
        needles, rating, difficulty, yarns,
        ...(image ? { image } : {}),
      } : p);
    } else {
      // Genuinely new project
      projects.unshift({
        id: `project-${Date.now()}`,
        name, pattern, status: statusInput.value, notes, patternLink,
        needles, rating, difficulty, yarns, image,
        lastViewedAt: Date.now(),
      });
    }
  }

  await saveProjects();
  renderProjects();
  updateHeroImage();
  // After saving, always clear form and show Other projects
  clearDraft();
  clearFormForNew();
  switchSection('previous-projects');
  nameInput.focus();
});

async function saveMembershipRequests() {}

async function acceptMember(id) {
  const req = membershipRequests.find(r => r.id === id);
  if (!req) return;
  if (groups.length > 0) {
    const g = groups[0];
    const newInvited = [...new Set([...g.invitedPeople, req.name])];
    groups = groups.map((gr, i) => i === 0 ? { ...gr, invitedPeople: newInvited } : gr);
    await sb.from('groups').update({ invited_people: newInvited }).eq('id', g.id);
  }
  await sb.from('membership_requests').delete().eq('id', id);
  membershipRequests = membershipRequests.filter(r => r.id !== id);
  renderGroups();
}

async function rejectMember(id) {
  await sb.from('membership_requests').delete().eq('id', id);
  membershipRequests = membershipRequests.filter(r => r.id !== id);
  renderGroups();
}

// Profile setup
const profileNameInput = document.getElementById('profile-name-input');
const profilePicInput = document.getElementById('profile-pic-input');
const profilePicBtn = document.getElementById('profile-pic-btn');
const profileAvatarPreview = document.getElementById('profile-avatar-preview');

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
    updateProfilePreview();
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
    updateProfilePreview();
    renderGroups();
  });
}

updateProfilePreview();

// Join request form
const joinRequestForm = document.getElementById('join-request-form');
const requestNameInput = document.getElementById('request-name-input');
const requestEmailInput = document.getElementById('request-email-input');

joinRequestForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = requestNameInput.value.trim();
  const email = requestEmailInput.value.trim();
  if (!name) return;

  const newRequest = { id: `req-${Date.now()}`, name, email, createdAt: Date.now() };
  try {
    await sb.from('membership_requests').insert({
      id: newRequest.id, name: newRequest.name,
      email: newRequest.email || '',
      created_at: new Date(newRequest.createdAt).toISOString()
    });
    membershipRequests.push(newRequest);
  } catch (e) { console.error('Error saving request:', e); }
  renderGroups();

  const subject = encodeURIComponent(`New membership request: ${name}`);
  const body = encodeURIComponent(`Hi,\n\nA new person wants to join Knitting My Life Away:\n\nName: ${name}\nEmail: ${email || '(not provided)'}\n\nPlease open the app to accept or reject this request.\n\nKnitting My Life Away`);
  window.location.href = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;

  joinRequestForm.reset();
  alert(translations[currentLanguage].requestSentMsg);
});

// Group form
groupForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = groupNameInput.value.trim();
  const invites = groupInvitesInput.value
    .split(',')
    .map((invite) => invite.trim())
    .filter(Boolean);

  if (!name) return;

  const newGroup = { id: `group-${Date.now()}`, name, invitedPeople: invites, messages: [] };

  try {
    await sb.from('groups').insert({ id: newGroup.id, name: newGroup.name, invited_people: invites });
    groups.push(newGroup);
    activeGroupId = newGroup.id;
    renderGroups();
    groupNameInput.value = '';
    groupInvitesInput.value = '';
  } catch (e) { console.error('Error creating group:', e); }
});

// Chat attachments
const chatImageInput = document.getElementById('chat-image-input');
const chatImagePreviewRow = document.getElementById('chat-image-preview-row');
const chatImagePreview = document.getElementById('chat-image-preview');
const chatImageClearBtn = document.getElementById('chat-image-clear-btn');
const chatLinkBtn = document.getElementById('chat-link-btn');
const chatLinkRow = document.getElementById('chat-link-row');
const chatLinkInput = document.getElementById('chat-link-input');
const chatLinkLabelInput = document.getElementById('chat-link-label-input');
let pendingChatImage = '';

chatImageInput.addEventListener('change', async () => {
  const file = chatImageInput.files[0];
  if (!file) return;
  pendingChatImage = await readImageAsDataURL(file);
  chatImagePreview.src = pendingChatImage;
  chatImagePreviewRow.classList.remove('hidden');
});

chatImageClearBtn.addEventListener('click', () => {
  pendingChatImage = '';
  chatImageInput.value = '';
  chatImagePreviewRow.classList.add('hidden');
  chatImagePreview.src = '';
});

chatLinkBtn.addEventListener('click', () => {
  chatLinkRow.classList.toggle('hidden');
  if (!chatLinkRow.classList.contains('hidden')) chatLinkInput.focus();
});

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const messageText = chatInput.value.trim();
  const link = chatLinkInput ? chatLinkInput.value.trim() : '';
  const linkLabel = chatLinkLabelInput ? chatLinkLabelInput.value.trim() : '';
  const activeGroup = getActiveGroup();

  if (!activeGroup || (!messageText && !pendingChatImage && !link)) return;

  const newMsg = {
    id: `message-${Date.now()}`,
    sender: myProfileName,
    text: messageText,
    image: pendingChatImage || '',
    link: link || '',
    linkLabel: linkLabel || '',
    createdAt: Date.now(),
  };

  groups = groups.map((group) =>
    group.id === activeGroup.id
      ? { ...group, messages: [...group.messages, newMsg] }
      : group
  );

  await saveNewMessage(activeGroup.id, newMsg);
  renderGroups();
  chatInput.value = '';
  pendingChatImage = '';
  chatImageInput.value = '';
  chatImagePreviewRow.classList.add('hidden');
  chatImagePreview.src = '';
  if (chatLinkInput) chatLinkInput.value = '';
  if (chatLinkLabelInput) chatLinkLabelInput.value = '';
  chatLinkRow.classList.add('hidden');
});

// ── Authentication (Supabase) ─────────────────────────────────────────────

async function loadAllData() {
  // Projects
  const { data: pData } = await sb.from('projects').select('*').eq('user_id', currentUser.id);
  const allProjects = (pData || []).map(p => ({
    id: p.id, name: p.name, pattern: p.pattern || '',
    status: p.status || 'Planning', notes: p.notes || '',
    patternLink: p.pattern_link || '', needles: p.needles || [],
    yarns: p.yarns || [], rating: p.rating || 0, difficulty: p.difficulty || 0,
    image: p.image || '', lastViewedAt: p.last_viewed_at || 0
  }));

  // Deduplicate: keep only the most recently viewed project per name
  const seen = new Map();
  const toDelete = [];
  allProjects.sort((a, b) => b.lastViewedAt - a.lastViewedAt); // newest first
  for (const p of allProjects) {
    const key = p.name.trim().toLowerCase();
    if (seen.has(key)) {
      toDelete.push(p.id); // duplicate — delete older one
    } else {
      seen.set(key, p);
    }
  }
  if (toDelete.length > 0) {
    await sb.from('projects').delete().in('id', toDelete);
  }
  projects = [...seen.values()];
  normalizeProjects();

  // Groups + messages
  const { data: gData } = await sb.from('groups').select('*, messages(*)');
  groups = (gData || []).map(g => ({
    id: g.id, name: g.name,
    invitedPeople: g.invited_people || [],
    messages: ((g.messages || [])
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map(m => ({
        id: m.id, sender: m.sender_name || 'You',
        text: m.text || '', image: m.image || '',
        link: m.link || '', linkLabel: m.link_label || '',
        createdAt: new Date(m.created_at).getTime()
      })))
  }));
  if (groups.length > 0 && !groups.some(g => g.id === activeGroupId)) activeGroupId = groups[0].id;
  else if (groups.length === 0) activeGroupId = null;

  // Membership requests
  const { data: rData } = await sb.from('membership_requests').select('*');
  membershipRequests = (rData || []).map(r => ({
    id: r.id, name: r.name, email: r.email || '',
    createdAt: new Date(r.created_at).getTime()
  }));
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
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.href });
    if (error) { showAuthError('forgot-error', error.message); return; }
    alert(translations[currentLanguage].forgotSuccessMsg);
    showAuthForm('login-form');
  });
}

// -- Initialize --
applyLanguage(currentLanguage);
initAuth();