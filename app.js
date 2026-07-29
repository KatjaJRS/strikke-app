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
const yarnInputs = [
  { type: document.getElementById('yarn-1-type'), color: document.getElementById('yarn-1-color'), amount: document.getElementById('yarn-1-amount') },
  { type: document.getElementById('yarn-2-type'), color: document.getElementById('yarn-2-color'), amount: document.getElementById('yarn-2-amount') },
  { type: document.getElementById('yarn-3-type'), color: document.getElementById('yarn-3-color'), amount: document.getElementById('yarn-3-amount') },
];
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

const STORAGE_KEY = 'knitting-notes-projects';
const GROUPS_STORAGE_KEY = 'knitting-groups-chat';
const GROUPS_READ_KEY = 'knitting-groups-last-read';
const GROUP_QUERY_PARAM = 'group';
const LANGUAGE_STORAGE_KEY = 'knitting-language';
const PROFILE_PIC_KEY = 'knitting-profile-picture';
const PROFILE_NAME_KEY = 'knitting-profile-name';
const MEMBERSHIP_REQUESTS_KEY = 'knitting-membership-requests';
const USERS_KEY = 'knitting-users';
const SESSION_KEY = 'knitting-session';
const ADMIN_EMAIL = 'roldsgaard@gmail.com';

// Filter state
let filterStatus = 'all';
let filterRating = 'all';
let filterDifficulty = 'all';

// Undo state
let lastDeletedProject = null;
let undoTimeoutId = null;

let projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let groups = JSON.parse(localStorage.getItem(GROUPS_STORAGE_KEY) || '[]');
let membershipRequests = JSON.parse(localStorage.getItem(MEMBERSHIP_REQUESTS_KEY) || '[]');
let groupsLastRead = Number(localStorage.getItem(GROUPS_READ_KEY) || '0');
let activeGroupId = null;
let currentLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en';
let myProfilePic = localStorage.getItem(PROFILE_PIC_KEY) || '';
let myProfileName = localStorage.getItem(PROFILE_NAME_KEY) || 'You';

// Initialize with sample data if empty
if (projects.length === 0) {
  projects = [
    {
      id: 'project-moonlight-scarf',
      name: 'Moonlight scarf',
      pattern: 'Garter rib',
      needles: ['4 mm circular'],
      status: 'In progress',
      notes: 'Need a second ball of yarn and keep the edges neat.',
      patternLink: 'https://example.com/moonlight-scarf',
      rating: 5,
      difficulty: 2,
      yarns: [
        { type: 'Merino wool', color: '#4a4a4a', amount: '50g used' },
        { type: 'Silk blend', color: '#daa520', amount: '30g used' },
        { type: '', color: '', amount: '' },
      ],
      image: '',
      lastViewedAt: Date.now(),
    },
    {
      id: 'project-weekend-hat',
      name: 'Weekend hat',
      pattern: 'Cable twist',
      needles: ['3.5 mm double-pointed'],
      status: 'Planning',
      notes: 'Test the gauge before casting on.',
      patternLink: 'https://example.com/weekend-hat',
      rating: 4,
      difficulty: 3,
      yarns: [
        { type: 'Cotton', color: '#f5f5dc', amount: '100g' },
        { type: '', color: '', amount: '' },
        { type: '', color: '', amount: '' },
      ],
      image: '',
      lastViewedAt: Date.now() - 86400000,
    },
  ];
}

normalizeProjects();
saveProjects();
normalizeGroups();

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
    saveNoteButton: 'Save note',
    projectsHeading: 'Other projects',
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
    saveNoteButton: 'Gem note',
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
  const orderedProjects = getOrderedProjects();
  if (orderedProjects.length > 0 && orderedProjects[0].image) {
    heroImage.src = orderedProjects[0].image;
  }
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
  
  // Populate yarns
  const yarns = project.yarns || [];
  yarnInputs.forEach((yarnGroup, index) => {
    const yarn = yarns[index] || { type: '', color: '', amount: '' };
    yarnGroup.type.value = yarn.type || '';
    yarnGroup.color.value = yarn.color || '';
    yarnGroup.amount.value = yarn.amount || '';
  });
  
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
  
  // Populate the form with the current project
  populateFormWithProject(currentProject);

  const card = document.createElement('article');
  card.className = 'project-card featured';
  const difficultyDisplay = currentProject.difficulty && currentProject.difficulty > 0 ? `<p class="difficulty"><strong>${translations[currentLanguage].difficultyDisplayLabel}:</strong> ${renderHearts(currentProject.difficulty)}</p>` : '';
  const needlesDisplay = renderNeedles(currentProject.needles || []);
  const yarnsDisplay = renderYarns(currentProject.yarns || []);
  const amountUsed = getAmountUsedString(currentProject.yarns || []);
  const translatedStatus = translateStatus(currentProject.status);
  
  card.innerHTML = `
    <div class="card-top">
      <div class="card-main-info">
        <div class="header-with-rating">
          <h3>${escapeHTML(currentProject.name)}</h3>
          ${currentProject.rating && currentProject.rating > 0 ? `<span class="stars">${renderStars(currentProject.rating)}</span>` : ''}
        </div>
        ${difficultyDisplay}
        ${needlesDisplay}
        ${yarnsDisplay}
        <p><strong>${escapeHTML(translations[currentLanguage].notesLabel)}:</strong> ${escapeHTML(currentProject.notes || '')}</p>
      </div>
      <span class="status-badge">${escapeHTML(translatedStatus)}</span>
    </div>
    ${currentProject.image ? `<img class="project-image" src="${currentProject.image}" alt="${escapeHTML(currentProject.name)}" />` : ''}
  `;
  currentProjectCard.innerHTML = '';
  currentProjectCard.appendChild(card);
}

function renderProjects() {
  renderCurrentProject();
  
  const orderedProjects = getOrderedProjects();
  let previousProjects = orderedProjects.slice(1);
  
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
    const card = document.createElement('article');
    card.className = 'project-card';
    const difficultyDisplay = project.difficulty && project.difficulty > 0 ? `<p class="difficulty"><strong>${translations[currentLanguage].difficultyDisplayLabel}:</strong> ${renderHearts(project.difficulty)}</p>` : '';
    const needlesDisplay = renderNeedles(project.needles || []);
    const yarnsDisplay = renderYarns(project.yarns || []);
    const amountUsed = getAmountUsedString(project.yarns || []);
    const translatedStatus = translateStatus(project.status);
    
    card.innerHTML = `
      <div class="card-top">
        <div class="card-main-info">
          <div class="header-with-rating">
            <h3>${escapeHTML(project.name)}</h3>
            ${project.rating && project.rating > 0 ? `<span class="stars">${renderStars(project.rating)}</span>` : ''}
          </div>
          ${difficultyDisplay}
          ${needlesDisplay}
          ${yarnsDisplay}
          ${project.notes ? `<p><strong>${escapeHTML(translations[currentLanguage].notesLabel)}:</strong> ${escapeHTML(project.notes)}</p>` : ''}
        </div>
        <span class="status-badge">${escapeHTML(translatedStatus)}</span>
      </div>
      <div class="card-buttons">
        <button class="edit-btn" data-project-id="${escapeHTML(project.id)}">${translations[currentLanguage].editButton}</button>
        <button class="delete-btn" data-project-id="${escapeHTML(project.id)}">${translations[currentLanguage].deleteButton}</button>
      </div>
    `;

    card.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      projects = projects.map((p) => ({
        ...p,
        lastViewedAt: p.id === project.id ? Date.now() : p.lastViewedAt
      }));
      saveProjects();
      renderProjects();
      updateHeroImage();
      switchSection('current-project');
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

function saveProjects() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
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

function saveGroups() {
  localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'sync', groups });
  }
  updateGroupsBadge();
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
        if (message.link) {
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

// Hero image click to cycle projects
if (heroImage) {
  heroImage.addEventListener('click', () => {
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

  projects.unshift({
    id: `project-${Date.now()}`,
    name,
    pattern,
    status: statusInput.value,
    notes,
    patternLink,
    needles,
    rating,
    difficulty,
    yarns,
    image,
    lastViewedAt: Date.now(),
  });

  saveProjects();
  renderProjects();
  updateHeroImage();
  form.reset();
  nameInput.focus();
});

function saveMembershipRequests() {
  localStorage.setItem(MEMBERSHIP_REQUESTS_KEY, JSON.stringify(membershipRequests));
}

function acceptMember(id) {
  const req = membershipRequests.find(r => r.id === id);
  if (!req) return;
  // Add to first group's invitedPeople (or create a global members concept)
  if (groups.length > 0) {
    groups = groups.map((g, i) => i === 0 ? { ...g, invitedPeople: [...new Set([...g.invitedPeople, req.name])] } : g);
    saveGroups();
  }
  membershipRequests = membershipRequests.filter(r => r.id !== id);
  saveMembershipRequests();
  renderGroups();
}

function rejectMember(id) {
  membershipRequests = membershipRequests.filter(r => r.id !== id);
  saveMembershipRequests();
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

joinRequestForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = requestNameInput.value.trim();
  const email = requestEmailInput.value.trim();
  if (!name) return;

  const newRequest = { id: `req-${Date.now()}`, name, email, createdAt: Date.now() };
  membershipRequests.push(newRequest);
  saveMembershipRequests();
  renderGroups();

  // Open mailto to notify admin
  const subject = encodeURIComponent(`New membership request: ${name}`);
  const body = encodeURIComponent(`Hi,\n\nA new person wants to join Knitting My Life Away:\n\nName: ${name}\nEmail: ${email || '(not provided)'}\n\nPlease open the app to accept or reject this request.\n\nKnitting My Life Away`);
  window.location.href = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;

  joinRequestForm.reset();
  alert(translations[currentLanguage].requestSentMsg);
});

// Group form
groupForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const name = groupNameInput.value.trim();
  const invites = groupInvitesInput.value
    .split(',')
    .map((invite) => invite.trim())
    .filter(Boolean);

  if (!name) return;

  const newGroup = {
    id: `group-${Date.now()}`,
    name,
    invitedPeople: invites,
    messages: [],
  };

  groups.push(newGroup);
  saveGroups();
  activeGroupId = newGroup.id;
  renderGroups();
  groupNameInput.value = '';
  groupInvitesInput.value = '';
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

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const messageText = chatInput.value.trim();
  const link = chatLinkInput ? chatLinkInput.value.trim() : '';
  const linkLabel = chatLinkLabelInput ? chatLinkLabelInput.value.trim() : '';
  const activeGroup = getActiveGroup();

  if (!activeGroup || (!messageText && !pendingChatImage && !link)) return;

  groups = groups.map((group) =>
    group.id === activeGroup.id
      ? {
          ...group,
          messages: [
            ...group.messages,
            {
              id: `message-${Date.now()}`,
              sender: myProfileName,
              text: messageText,
              image: pendingChatImage || '',
              link: link || '',
              linkLabel: linkLabel || '',
              createdAt: Date.now(),
            },
          ],
        }
      : group
  );

  saveGroups();
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

// ── Authentication ──────────────────────────────────────────────────────────

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'knitting-salt-2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getUsers() {
  return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getSession() {
  return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
}

function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
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

function launchApp(user) {
  document.getElementById('auth-overlay').classList.add('hidden');
  document.getElementById('app-shell-wrapper').classList.remove('hidden');

  // Show logged-in user name + logout button in lang switcher area
  let userBar = document.getElementById('user-bar');
  if (!userBar) {
    userBar = document.createElement('div');
    userBar.id = 'user-bar';
    userBar.className = 'user-bar';
    document.body.prepend(userBar);
  }

  function refreshUserBar() {
    const initials = user.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const hue = [...user.name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
    const pic = myProfilePic;
    const avatarHTML = pic
      ? `<img src="${pic}" class="avatar user-bar-avatar" alt="${escapeHTML(user.name)}" />`
      : `<span class="avatar avatar-initials user-bar-avatar" style="background:hsl(${hue},55%,65%)">${escapeHTML(initials)}</span>`;

    userBar.innerHTML = `
      <button type="button" id="open-profile-btn" class="user-bar-profile-btn" title="Edit profile">
        ${avatarHTML}
        <span class="user-bar-name">${escapeHTML(user.name)}</span>
      </button>
      <button type="button" id="logout-btn" class="user-bar-logout" data-i18n="logoutLabel">Sign out</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', () => { clearSession(); location.reload(); });
    document.getElementById('open-profile-btn').addEventListener('click', () => openProfileModal(user));
  }

  refreshUserBar();

  // Profile modal logic
  function openProfileModal(u) {
    const modal = document.getElementById('profile-modal');
    modal.classList.remove('hidden');

    // Fill current values
    document.getElementById('profile-edit-name').value = u.name;
    document.getElementById('profile-edit-email').value = u.email;
    document.getElementById('profile-current-password').value = '';
    document.getElementById('profile-new-password').value = '';
    document.getElementById('profile-edit-error').classList.add('hidden');
    document.getElementById('profile-edit-success').classList.add('hidden');

    // Avatar preview in modal
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
      const initials = user.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
      const hue = [...user.name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
      av.className = 'avatar avatar-initials profile-modal-avatar';
      av.style.background = `hsl(${hue},55%,65%)`;
      av.textContent = initials;
    }
  }

  document.getElementById('profile-modal-close').addEventListener('click', () => {
    document.getElementById('profile-modal').classList.add('hidden');
  });

  document.getElementById('profile-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('profile-modal')) {
      document.getElementById('profile-modal').classList.add('hidden');
    }
  });

  document.getElementById('profile-modal-pic-btn').addEventListener('click', () => {
    document.getElementById('profile-modal-pic-input').click();
  });

  document.getElementById('profile-modal-pic-input').addEventListener('change', async () => {
    const file = document.getElementById('profile-modal-pic-input').files[0];
    if (!file) return;
    myProfilePic = await readImageAsDataURL(file);
    localStorage.setItem(PROFILE_PIC_KEY, myProfilePic);
    updateModalAvatar();
    refreshUserBar();
    renderGroups();
    // Sync with groups profile setup if visible
    if (typeof updateProfilePreview === 'function') updateProfilePreview();
  });

  document.getElementById('profile-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = document.getElementById('profile-edit-name').value.trim();
    const newEmail = document.getElementById('profile-edit-email').value.trim().toLowerCase();
    const currentPw = document.getElementById('profile-current-password').value;
    const newPw = document.getElementById('profile-new-password').value;
    const errEl = document.getElementById('profile-edit-error');
    const successEl = document.getElementById('profile-edit-success');
    errEl.classList.add('hidden');
    successEl.classList.add('hidden');

    const users = getUsers();
    let updatedUser = { ...user, name: newName, email: newEmail };

    // Handle password change if requested
    if (currentPw || newPw) {
      const currentHash = await hashPassword(currentPw);
      if (currentHash !== user.passwordHash) {
        errEl.textContent = translations[currentLanguage].profileErrorWrongPw;
        errEl.classList.remove('hidden');
        return;
      }
      if (newPw.length < 6) {
        errEl.textContent = translations[currentLanguage].profileErrorShortPw;
        errEl.classList.remove('hidden');
        return;
      }
      updatedUser.passwordHash = await hashPassword(newPw);
    }

    const newUsers = users.map(u => u.id === user.id ? updatedUser : u);
    saveUsers(newUsers);
    Object.assign(user, updatedUser);

    // Update display name in groups profile too
    myProfileName = newName;
    localStorage.setItem(PROFILE_NAME_KEY, newName);

    refreshUserBar();
    renderGroups();
    successEl.classList.remove('hidden');
    document.getElementById('profile-current-password').value = '';
    document.getElementById('profile-new-password').value = '';
  });

  applyLanguage(currentLanguage);
  renderProjects();
  updateHeroImage();
  renderGroups();
  updateGroupsBadge();
}

async function initAuth() {
  const session = getSession();
  if (session) {
    const users = getUsers();
    const user = users.find(u => u.id === session.userId);
    if (user) { launchApp(user); return; }
  }

  // Show auth overlay
  document.getElementById('auth-overlay').classList.remove('hidden');

  // Wire up form toggles
  document.getElementById('show-register').addEventListener('click', () => showAuthForm('register-form'));
  document.getElementById('show-login').addEventListener('click', () => showAuthForm('login-form'));
  document.getElementById('show-forgot').addEventListener('click', () => showAuthForm('forgot-form'));
  document.getElementById('show-login-from-forgot').addEventListener('click', () => showAuthForm('login-form'));

  // Login
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const users = getUsers();
    const user = users.find(u => u.email === email);
    if (!user) { showAuthError('login-error', translations[currentLanguage].loginErrorNotFound); return; }
    const hash = await hashPassword(password);
    if (hash !== user.passwordHash) { showAuthError('login-error', translations[currentLanguage].loginErrorWrong); return; }
    saveSession({ userId: user.id, loggedInAt: Date.now() });
    launchApp(user);
  });

  // Register
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim().toLowerCase();
    const password = document.getElementById('register-password').value;
    if (password.length < 6) { showAuthError('register-error', translations[currentLanguage].registerErrorShort); return; }
    const users = getUsers();
    if (users.find(u => u.email === email)) { showAuthError('register-error', translations[currentLanguage].registerErrorExists); return; }
    const hash = await hashPassword(password);
    const newUser = { id: `user-${Date.now()}`, name, email, passwordHash: hash, createdAt: Date.now() };
    users.push(newUser);
    saveUsers(users);
    saveSession({ userId: newUser.id, loggedInAt: Date.now() });
    launchApp(newUser);
  });

  // Forgot password
  document.getElementById('forgot-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim().toLowerCase();
    const users = getUsers();
    const user = users.find(u => u.email === email);
    if (!user) { showAuthError('forgot-error', translations[currentLanguage].forgotNotFound); return; }
    const subject = encodeURIComponent(`Password reset request: ${user.name}`);
    const body = encodeURIComponent(`Hi,\n\n${user.name} (${user.email}) has requested a password reset for Knitting My Life Away.\n\nPlease open the app admin panel to reset their password.\n\nKnitting My Life Away`);
    window.location.href = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;
    alert(translations[currentLanguage].forgotSuccessMsg);
  });
}

// ── Initialize ───────────────────────────────────────────────────────────────
applyLanguage(currentLanguage);
initAuth();
updateGroupsBadge();
