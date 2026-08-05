// ── Supabase ─────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://ekwslhhhdawzudjwlrss.supabase.co';
const SUPABASE_KEY = 'sb_publishable_aFZ8R-s3cpJgZUTFp_AsKw_eSC3xW0C';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;

// ── Storage keys ─────────────────────────────────────────────────────────
const GROUPS_READ_KEY = 'knitting-groups-last-read';
const GROUP_QUERY_PARAM = 'group';
const LANGUAGE_STORAGE_KEY = 'knitting-language';
const PROFILE_PIC_KEY = 'knitting-profile-picture';
const PROFILE_NAME_KEY = 'knitting-profile-name';
const HERO_IMAGE_KEY = 'knitting-hero-image';
const ROUNDS_KEY = 'knitting-rounds';
const ADMIN_EMAIL = 'roldsgaard@gmail.com';
const DRAFT_KEY = 'knitting-form-draft';
const HERO_PAN_KEY = 'knitting-hero-pan';

// ── Global state ─────────────────────────────────────────────────────────
let projectRounds = JSON.parse(localStorage.getItem(ROUNDS_KEY) || '{}');

function getRounds(projectId) { return projectRounds[projectId] || 0; }
function saveRounds() { localStorage.setItem(ROUNDS_KEY, JSON.stringify(projectRounds)); }

let filterStatus = 'all';
let filterRating = 'all';
let filterDifficulty = 'all';

let currentEditingProjectId = null;
const APP_BASE_URL = 'https://katjajrs.github.io/strikke-app/';
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
    showPassword: 'Show',
    hidePassword: 'Hide',
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
    showPassword: 'Vis',
    hidePassword: 'Skjul',
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
