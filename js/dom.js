// ── DOM element references ────────────────────────────────────────────────
// Alle HTML-elementer samlet ét sted, tilgængelige som globale variable

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
