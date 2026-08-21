// ── Supabase ─────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://ekwslhhhdawzudjwlrss.supabase.co';
const SUPABASE_KEY = 'sb_publishable_aFZ8R-s3cpJgZUTFp_AsKw_eSC3xW0C';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;

// ── Storage keys ─────────────────────────────────────────────────────────
const GROUPS_READ_KEY = 'knitting-groups-last-read';
const GROUP_QUERY_PARAM = 'group';
const LANGUAGE_STORAGE_KEY = 'knitting-language';
const LANGUAGE_BY_EMAIL_KEY = 'knitting-language-by-email';
const PROFILE_PIC_KEY = 'knitting-profile-picture';
const PROFILE_NAME_KEY = 'knitting-profile-name';
const PROFILE_MODE_KEY = 'knitting-profile-mode';
const HERO_IMAGE_KEY = 'knitting-hero-image';
const ROUNDS_KEY = 'knitting-rounds';
const ADMIN_EMAIL = 'roldsgaardkatja@gmail.com';
const ADMIN_EMAILS = ['roldsgaardkatja@gmail.com', 'roldsgaard@gmail.com'];
const DRAFT_KEY = 'knitting-form-draft';
const HERO_PAN_KEY = 'knitting-hero-pan';
const PROJECTS_CACHE_KEY = 'knitting-projects-cache';
const DELETED_PROJECTS_KEY = 'knitting-deleted-projects';
const SETTINGS_TABLE = 'user_settings';

// ── Global state ─────────────────────────────────────────────────────────
let projectRounds = JSON.parse(localStorage.getItem(ROUNDS_KEY) || '{}');

// Projekter slettet lokalt, men endnu ikke slettet i Supabase.
let deletedProjectIds = new Set(JSON.parse(localStorage.getItem(DELETED_PROJECTS_KEY) || '[]'));

function saveDeletedProjectIds() {
  localStorage.setItem(DELETED_PROJECTS_KEY, JSON.stringify([...deletedProjectIds]));
}

function getRounds(projectId) { return projectRounds[projectId] || 0; }

function saveRounds() {
  localStorage.setItem(ROUNDS_KEY, JSON.stringify(projectRounds));
  if (typeof queueSettingsSync === 'function') queueSettingsSync();
}

let filterStatus = 'all';
let filterRating = 'all';
let filterDifficulty = 'all';

let currentEditingProjectId = null;
const APP_BASE_URL = 'https://katjajrs.github.io/strikke-app/';
let lastDeletedProject = null;
let undoTimeoutId = null;

function isAdminUser(email = currentUser?.email, profile = null) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (ADMIN_EMAILS.includes(normalizedEmail)) return true;
  if (!profile) return false;
  return Boolean(profile.is_admin || profile.role === 'admin');
}

function canManageAdminProfile() {
  return isAdminUser() && getProfileMode() === 'admin';
}

function applyProfileModeUI() {
  const adminToggle = document.getElementById('profile-mode-toggle');
  const memberBtn = document.getElementById('profile-mode-member');
  const adminBtn = document.getElementById('profile-mode-admin');
  const adminSection = document.getElementById('admin-profile-section');
  const createNavBtn = document.getElementById('group-nav-create');
  const joinNavBtn = document.getElementById('group-nav-join');
  const groupsMainBtn = document.getElementById('group-main-groups');
  const membersMainBtn = document.getElementById('group-main-members');
  const groupsSubnav = document.getElementById('group-subnav-groups');
  const createPanel = document.getElementById('group-panel-create');
  const joinPanel = document.getElementById('group-panel-join');
  const membersPanel = document.getElementById('group-panel-members');
  const adminRequestsSection = document.getElementById('admin-membership-requests-section');

  const isAdmin = isAdminUser();
  const activeMode = isAdmin ? getProfileMode() : 'member';
  const isAdminMode = isAdmin && activeMode === 'admin';

  if (adminToggle) adminToggle.classList.toggle('hidden', !isAdmin);
  if (memberBtn) memberBtn.classList.toggle('active', activeMode === 'member');
  if (adminBtn) adminBtn.classList.toggle('active', activeMode === 'admin');

  if (adminSection) adminSection.classList.toggle('hidden', !isAdminMode);
  if (createNavBtn) createNavBtn.classList.toggle('hidden', isAdminMode);
  if (joinNavBtn) joinNavBtn.classList.toggle('hidden', isAdminMode);
  if (createPanel) createPanel.classList.toggle('hidden', isAdminMode);
  if (joinPanel) joinPanel.classList.toggle('hidden', isAdminMode);
  if (groupsMainBtn) groupsMainBtn.classList.toggle('hidden', false);
  if (membersMainBtn) membersMainBtn.classList.toggle('hidden', false);
  if (groupsSubnav && isAdminMode) groupsSubnav.classList.remove('hidden');
  if (membersPanel) membersPanel.classList.toggle('hidden', false);
  if (adminRequestsSection) adminRequestsSection.classList.toggle('hidden', !isAdminMode);

  if (typeof setActiveGroupPanel === 'function') {
    const activePanel = document.querySelector('#group-subnav-groups .group-nav-btn.active')?.dataset.groupPanel;
    if (!activePanel || document.getElementById(`group-panel-${activePanel}`)?.classList.contains('hidden')) {
      setActiveGroupPanel(isAdminMode ? 'groups' : 'create');
    }
  }
  if (typeof setActiveGroupMain === 'function') {
    const activeMain = document.querySelector('.group-main-btn.active')?.dataset.groupMain;
    if (!activeMain) {
      setActiveGroupMain(isAdminMode ? 'groups' : 'groups', { autoPanel: false });
    }
  }
  if (typeof renderGroups === 'function') renderGroups();
}

let projects = [];
let groups = [];
let membershipRequests = [];
let memberDirectory = [];
let memberProfiles = [];
let groupsLastRead = Number(localStorage.getItem(GROUPS_READ_KEY) || '0');
let activeGroupId = null;
let currentLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en';
let myProfilePic = localStorage.getItem(PROFILE_PIC_KEY) || '';
let myProfileName = localStorage.getItem(PROFILE_NAME_KEY) || 'You';
let profileMode = 'member';

function normalizeProfileMode(mode) {
  return mode === 'admin' ? 'admin' : 'member';
}

function getProfileMode() {
  if (!isAdminUser()) return 'member';
  const savedMode = localStorage.getItem(PROFILE_MODE_KEY);
  return normalizeProfileMode(savedMode === 'admin' ? 'admin' : 'member');
}

function setProfileMode(mode) {
  profileMode = normalizeProfileMode(mode);
  localStorage.setItem(PROFILE_MODE_KEY, profileMode);
  if (typeof applyProfileModeUI === 'function') applyProfileModeUI();
}

function normalizeLanguage(language) {
  return language === 'da' ? 'da' : 'en';
}

function getSavedLanguageMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LANGUAGE_BY_EMAIL_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getSavedLanguageForEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return '';
  const languageMap = getSavedLanguageMap();
  return normalizeLanguage(languageMap[normalizedEmail]);
}

function saveLanguageForEmail(email, language) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return;
  const languageMap = getSavedLanguageMap();
  languageMap[normalizedEmail] = normalizeLanguage(language);
  localStorage.setItem(LANGUAGE_BY_EMAIL_KEY, JSON.stringify(languageMap));
}

// ── BroadcastChannel ─────────────────────────────────────────────────────
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

// ── Translations ──────────────────────────────────────────────────────────
const translations = {
  en: {
    heroEyebrow: 'Fru Sminge\'s Cozy Crafts Planner',
    heroTitle: 'Knitting My Day Away',
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
    difficultyOption1: '1 yarn skein',
    difficultyOption2: '2 yarn skeins',
    difficultyOption3: '3 yarn skeins',
    difficultyOption4: '4 yarn skeins',
    difficultyOption5: '5 yarn skeins',
    notesLabel: 'Notes',
    notesPlaceholder: 'Add yarn details, gauge, or reminders...',
    patternLinkLabel: 'Pattern link or file',
    patternLinkPlaceholder: 'https://... or file name',
    imageLabel: 'Project photo',
    saveNoteButton: 'Save project',
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
    deleteGroupButton: 'Delete group',
    deleteGroupConfirmFirst: 'Delete this group? This cannot be undone.',
    deleteGroupConfirmSecond: 'Are you absolutely sure you want to delete this group?',
    deleteGroupFailed: 'Could not delete the group. Try again.',
    deleteGroupBusy: 'Deleting group...',
    invitedPeopleHeading: 'Happy knitters in the group',
    myGroupsHeading: 'My groups',
    allMembersHeading: 'All members',
    pendingRequestsHeading: 'Membership requests',
    requestJoinHeading: 'Request to join',
    groupQuickCreate: 'Create',
    groupQuickJoin: 'Join',
    groupQuickGroups: 'Groups',
    groupQuickRequests: 'Requests',
    groupQuickMembers: 'Members',
    requestNameLabel: 'Your name',
    requestNamePlaceholder: 'e.g. Maja',
    requestEmailLabel: 'Your email',
    requestEmailPlaceholder: 'maja@example.com',
    requestJoinButton: 'Send request',
    pendingAccept: 'Accept',
    pendingReject: 'Reject',
    requestSentMsg: 'Your request has been sent to the admin!',
    noPendingRequests: 'No pending requests',
    noGroupYet: 'No group yet',
    createGroupToStartChat: 'Create a group to start chatting.',
    noInvitesYet: 'No invites yet',
    noMessagesYet: 'No messages yet. Start the conversation.',
    linkCopied: 'Link copied',
    copyInviteLink: 'Copy invite link',
    copyFailed: 'Copy failed',
    profileNameLabel: 'Your display name',
    profilePicLabel: 'Profile picture',
    profilePicButton: 'Upload photo',
    chatPlaceholder: 'Share a pattern idea...',
    sendButton: 'Send',
    chatEditButton: 'Edit',
    chatDeleteButton: 'Delete',
    chatEditTitle: 'Edit message',
    chatEditSave: 'Save',
    chatEditCancel: 'Cancel',
    chatEditPrompt: 'Edit your message',
    chatEditEmpty: 'A message without text must still include an image or link.',
    chatDeleteConfirm: 'Delete this message for everyone in the group?',
    chatUpdateFailed: 'Could not update the message. Try again.',
    chatDeleteFailed: 'Could not delete the message. Try again.',
    emptyState: 'No projects yet. Add your first knitting idea.',
    deleteButton: 'Delete',
    loginHeading: 'Sign in',
    registerHeading: 'Create account',
    forgotHeading: 'Reset password',
    authWelcomeText: "A warm welcome to Fru Sminge's knitting app! 🧶✨ Here you can keep track of your own projects and get inspired by others. To respect designers' copyrights, we cannot share direct links to full patterns in the app, but you can always view your own saved patterns and show your beautiful knitting results to the others. Grab your knitting, get comfy, and let's enjoy it together!",
    authEmailLabel: 'Email',
    authPasswordLabel: 'Password',
    authNameLabel: 'Your name',
    loginButton: 'Sign in',
    registerButton: 'Create account',
    forgotButton: 'Send reset request',
    showPassword: 'Show',
    hidePassword: 'Hide',
    goToRegister: 'New here? Create account',
    goToForgot: 'Forgot password?',
    goToLogin: 'Already have an account? Sign in',
    forgotHint: "Enter your email and we'll send a reset request to the admin.",
    loginErrorWrong: 'Incorrect email or password.',
    loginErrorNetwork: 'Could not contact login service right now. Check your connection and try again.',
    loginErrorNotFound: 'No account found with that email.',
    registerErrorExists: 'An account with this email already exists.',
    registerErrorNetwork: 'Could not contact sign-up service right now. Check your connection and try again.',
    registerErrorShort: 'Password must be at least 6 characters.',
    registerNeedEmailConfirm: 'Account created. If sign-in does not continue automatically, check your email and confirm the account before logging in again.',
    forgotSuccessMsg: 'Reset request sent! The admin will be in touch.',
    forgotNotFound: 'No account found with that email.',
    logoutLabel: 'Sign out',
    profileHeading: 'My profile',
    changePasswordLabel: 'Change password',
    currentPasswordLabel: 'Current password',
    newPasswordLabel: 'New password (min. 6 characters)',
    saveChangesButton: 'Save changes',
    deleteMembershipDataButton: 'Delete my membership data',
    deleteMembershipDataConfirm: 'Delete your saved membership data from the app? This removes your profile, projects, messages, and membership request data.',
    profileSaved: '\u2714 Changes saved!',
    profileErrorWrongPw: 'Current password is incorrect.',
    profileErrorShortPw: 'New password must be at least 6 characters.',
  },
  da: {
    heroEyebrow: 'Fru Sminges hyggelige håndværksplanlægger',
    heroTitle: 'Strikker min dag væk',
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
    difficultyOption1: '1 garnnøgle',
    difficultyOption2: '2 garnnøgler',
    difficultyOption3: '3 garnnøgler',
    difficultyOption4: '4 garnnøgler',
    difficultyOption5: '5 garnnøgler',
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
    deleteGroupButton: 'Slet gruppe',
    deleteGroupConfirmFirst: 'Slet denne gruppe? Det kan ikke fortrydes.',
    deleteGroupConfirmSecond: 'Er du helt sikker på, at du vil slette denne gruppe?',
    deleteGroupFailed: 'Kunne ikke slette gruppen. Prøv igen.',
    deleteGroupBusy: 'Sletter gruppe...',
    invitedPeopleHeading: 'Glade strikkere i gruppen',
    myGroupsHeading: 'Mine grupper',
    allMembersHeading: 'Alle medlemmer',
    pendingRequestsHeading: 'Anmodninger fra medlemmer',
    requestJoinHeading: 'Anmod om at blive medlem',
    groupQuickCreate: 'Opret',
    groupQuickJoin: 'Bliv medlem',
    groupQuickGroups: 'Grupper',
    groupQuickRequests: 'Anmodninger',
    groupQuickMembers: 'Medlemmer',
    requestNameLabel: 'Dit navn',
    requestNamePlaceholder: 'fx. Maja',
    requestEmailLabel: 'Din e-mail',
    requestEmailPlaceholder: 'maja@eksempel.dk',
    requestJoinButton: 'Send anmodning',
    pendingAccept: 'Accepter',
    pendingReject: 'Afvis',
    requestSentMsg: 'Din anmodning er sendt til administratoren!',
    noPendingRequests: 'Ingen ventende anmodninger',
    noGroupYet: 'Ingen gruppe endnu',
    createGroupToStartChat: 'Opret en gruppe for at starte chatten.',
    noInvitesYet: 'Ingen inviterede endnu',
    noMessagesYet: 'Ingen beskeder endnu. Start samtalen.',
    linkCopied: 'Link kopieret',
    copyInviteLink: 'Kopiér invitationslink',
    copyFailed: 'Kopiering mislykkedes',
    profileNameLabel: 'Dit visningsnavn',
    profilePicLabel: 'Profilbillede',
    profilePicButton: 'Upload billede',
    chatPlaceholder: 'Del en mønsteridé...',
    sendButton: 'Send',
    chatEditButton: 'Rediger',
    chatDeleteButton: 'Slet',
    chatEditTitle: 'Rediger besked',
    chatEditSave: 'Gem',
    chatEditCancel: 'Annuller',
    chatEditPrompt: 'Rediger din besked',
    chatEditEmpty: 'En besked uden tekst skal stadig have billede eller link.',
    chatDeleteConfirm: 'Vil du slette denne besked for alle i gruppen?',
    chatUpdateFailed: 'Kunne ikke opdatere beskeden. Prøv igen.',
    chatDeleteFailed: 'Kunne ikke slette beskeden. Prøv igen.',
    emptyState: 'Ingen projekter endnu. Tilføj din første strikkeidé.',
    deleteButton: 'Slet',
    loginHeading: 'Log ind',
    registerHeading: 'Opret konto',
    forgotHeading: 'Nulstil adgangskode',
    authWelcomeText: 'Hjertelig velkommen til Fru Sminges strikkeapp! 🧶✨ Her kan du holde styr på dine egne projekter og lade dig inspirere af andre. Af hensyn til designernes ophavsret kan vi ikke dele direkte links til hele opskrifter her i appen, men du kan altid se dine egne gemte opskrifter og vise dine flotte strikkeresultater frem for de andre. Find strikketøjet frem, slå dig ned - og lad os hygge!',
    authEmailLabel: 'E-mail',
    authPasswordLabel: 'Adgangskode',
    authNameLabel: 'Dit navn',
    loginButton: 'Log ind',
    registerButton: 'Opret konto',
    forgotButton: 'Send nulstillingsanmodning',
    showPassword: 'Vis',
    hidePassword: 'Skjul',
    goToRegister: 'Ny her? Opret konto',
    goToForgot: 'Glemt adgangskode?',
    goToLogin: 'Har du allerede en konto? Log ind',
    forgotHint: 'Indtast din e-mail, så sender vi en anmodning til administratoren.',
    loginErrorWrong: 'Forkert e-mail eller adgangskode.',
    loginErrorNetwork: 'Kunne ikke kontakte login-tjenesten lige nu. Tjek din forbindelse og prøv igen.',
    loginErrorNotFound: 'Ingen konto fundet med den e-mail.',
    registerErrorExists: 'En konto med denne e-mail findes allerede.',
    registerErrorNetwork: 'Kunne ikke kontakte oprettelses-tjenesten lige nu. Tjek din forbindelse og prøv igen.',
    registerErrorShort: 'Adgangskoden skal være mindst 6 tegn.',
    registerNeedEmailConfirm: 'Kontoen er oprettet. Hvis du ikke kommer videre automatisk, så tjek din e-mail og bekræft kontoen, før du logger ind igen.',
    forgotSuccessMsg: 'Anmodning sendt! Administratoren vender tilbage til dig.',
    forgotNotFound: 'Ingen konto fundet med den e-mail.',
    logoutLabel: 'Log ud',
    profileHeading: 'Min profil',
    changePasswordLabel: 'Ændr adgangskode',
    currentPasswordLabel: 'Nuværende adgangskode',
    newPasswordLabel: 'Ny adgangskode (min. 6 tegn)',
    saveChangesButton: 'Gem ændringer',
    deleteMembershipDataButton: 'Slet mine medlemsdata',
    deleteMembershipDataConfirm: 'Vil du slette dine gemte medlemsdata fra appen? Det fjerner din profil, dine projekter, dine beskeder og dine medlemsanmodninger.',
    profileSaved: '\u2714 Ændringer gemt!',
    profileErrorWrongPw: 'Nuværende adgangskode er forkert.',
    profileErrorShortPw: 'Ny adgangskode skal være mindst 6 tegn.',
  },
};
