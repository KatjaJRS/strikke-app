const form = document.getElementById('project-form');
const nameInput = document.getElementById('project-name');
const patternInput = document.getElementById('pattern-name');
const statusInput = document.getElementById('project-status');
const notesInput = document.getElementById('project-notes');
const patternLinkInput = document.getElementById('pattern-link');
const needleInput = document.getElementById('needle-size');
const ratingInput = document.getElementById('project-rating');
const difficultyInput = document.getElementById('project-difficulty');
const imageInput = document.getElementById('project-image');
const list = document.getElementById('project-list');
const countLabel = document.getElementById('project-count');
const searchInput = document.getElementById('project-search');
const statusFilterInput = document.getElementById('project-status-filter');
const ratingFilterInput = document.getElementById('project-rating-filter');
const difficultyFilterInput = document.getElementById('project-difficulty-filter');
const ratingFilterButtons = Array.from(document.querySelectorAll('[data-rating-filter]'));
const difficultyFilterButtons = Array.from(document.querySelectorAll('[data-difficulty-filter]'));
const heroImage = document.getElementById('hero-image');
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
const GROUP_QUERY_PARAM = 'group';

let projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let groups = JSON.parse(localStorage.getItem(GROUPS_STORAGE_KEY) || '[]');
let activeGroupId = null;

normalizeProjects();
normalizeGroups();

const broadcastChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('knitting-groups-chat') : null;

if (broadcastChannel) {
  broadcastChannel.addEventListener('message', (event) => {
    if (event.data?.type === 'sync') {
      groups = event.data.groups || [];
      normalizeGroups();
      renderGroups();
    }
  });
}

function createProjectId(project, index) {
  return project.id || `project-${Date.now()}-${index}`;
}

function normalizeProjects() {
  projects = projects.map((project, index) => ({
    ...project,
    id: createProjectId(project, index),
    lastViewedAt: project.lastViewedAt || 0,
    needleSize: project.needleSize || '',
    patternLink: project.patternLink || '',
    rating: Number(project.rating) || 0,
    difficulty: Number(project.difficulty) || 0,
    image: project.image || '',
  }));

  if (projects.some((project) => project.name === 'Moonlight scarf' && !project.needleSize)) {
    projects = projects.map((project) => {
      if (project.name === 'Moonlight scarf') {
        return {
          ...project,
          needleSize: '4 mm circular',
          patternLink: 'https://example.com/moonlight-scarf',
        };
      }

      if (project.name === 'Weekend hat') {
        return {
          ...project,
          needleSize: '3.5 mm double-pointed',
          patternLink: 'https://example.com/weekend-hat',
        };
      }

      return project;
    });
  }
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
    groups = [
      {
        id: 'group-pattern-circle',
        name: 'Pattern circle',
        invitedPeople: ['Maja', 'Lars'],
        messages: [
          {
            id: 'message-1',
            sender: 'You',
            text: 'Share your favorite shawl pattern here.',
            createdAt: Date.now() - 1000 * 60 * 10,
          },
        ],
      },
    ];
  }

  const params = new URLSearchParams(window.location.search);
  const requestedGroupId = params.get(GROUP_QUERY_PARAM);

  if (requestedGroupId && groups.some((group) => group.id === requestedGroupId)) {
    activeGroupId = requestedGroupId;
  } else if (!groups.some((group) => group.id === activeGroupId)) {
    activeGroupId = groups[0].id;
  }
}

function saveGroups() {
  localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'sync', groups });
  }
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

  const activeGroup = getActiveGroup();
  if (!activeGroup) {
    activeGroupName.textContent = 'No group yet';
    groupMembersList.innerHTML = '';
    chatMessages.innerHTML = '<p class="chat-empty">Create a group to start chatting.</p>';
    return;
  }

  activeGroupName.textContent = activeGroup.name;

  groupMembersList.innerHTML = activeGroup.invitedPeople.length
    ? activeGroup.invitedPeople.map((person) => `<li>${escapeHTML(person)}</li>`).join('')
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

        return `
          <article class="chat-bubble">
            <div class="chat-meta">
              <strong>${escapeHTML(message.sender || 'You')}</strong>
              <span>${escapeHTML(timestamp)}</span>
            </div>
            <p>${escapeHTML(message.text)}</p>
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

function updateHeroImage() {
  const featuredProject = getOrderedProjects().find((project) => project.image);

  if (featuredProject) {
    heroImage.src = featuredProject.image;
    heroImage.alt = `Featured project: ${featuredProject.name}`;
  } else {
    heroImage.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='700' viewBox='0 0 1200 700'%3E%3Crect width='1200' height='700' fill='%23f6e7d2'/%3E%3Ccircle cx='900' cy='230' r='140' fill='%23d8a979'/%3E%3Cpath d='M270 570c80-170 220-260 420-260 140 0 240 45 330 120v180H270z' fill='%23a8633a'/%3E%3Cpath d='M320 290c65-120 175-190 315-190 110 0 210 50 265 140' stroke='%236b4d2f' stroke-width='26' fill='none' stroke-linecap='round'/%3E%3C/svg%3E";
    heroImage.alt = 'Featured knitting project';
  }
}

function updateFilterButtons(buttons, selectedValue, dataKey) {
  buttons.forEach((button) => {
    const isActive = button.dataset[dataKey] === selectedValue;
    button.classList.toggle('active', isActive);
  });
}

function getFilteredProjects() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedStatus = statusFilterInput.value;
  const selectedRating = ratingFilterInput.value;
  const selectedDifficulty = difficultyFilterInput.value;
  const orderedProjects = getOrderedProjects();

  return orderedProjects.filter((project) => {
    const matchesStatus = selectedStatus === 'all' || project.status === selectedStatus;
    const matchesRating = selectedRating === 'all' || Number(project.rating) === Number(selectedRating);
    const matchesDifficulty = selectedDifficulty === 'all' || Number(project.difficulty) === Number(selectedDifficulty);

    if (!matchesStatus || !matchesRating || !matchesDifficulty) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchableText = [
      project.name,
      project.pattern,
      project.notes,
      project.patternLink,
      project.needleSize,
      project.status,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchableText.includes(query);
  });
}

function renderProjects() {
  const filteredProjects = getFilteredProjects();
  list.innerHTML = '';
  countLabel.textContent = `${filteredProjects.length} ${filteredProjects.length === 1 ? 'project' : 'projects'}`;

  if (filteredProjects.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No projects yet. Add your first knitting idea.';
    list.appendChild(empty);
    return;
  }

  filteredProjects.forEach((project, index) => {
    const card = document.createElement('article');
    card.className = `project-card${index === 0 ? ' featured' : ''}`;

    card.innerHTML = `
      <div class="card-top">
        <div class="card-main-info">
          <div class="card-title-row">
            <h3>${escapeHTML(project.name)}</h3>
            <span class="rating-display" aria-label="Rating ${project.rating} out of 5">${'★'.repeat(project.rating)}${'☆'.repeat(5 - project.rating)}</span>
          </div>
          <p class="difficulty-display" aria-label="Difficulty ${project.difficulty} out of 5"><span class="difficulty-label">Level</span> ${'❤️'.repeat(project.difficulty)}${'♡'.repeat(5 - project.difficulty)}</p>
          <p class="pattern">${escapeHTML(project.pattern)}</p>
          ${project.needleSize ? `<p class="pattern"><strong>Needles:</strong> ${escapeHTML(project.needleSize)}</p>` : ''}
          <div class="pattern-meta">
            ${project.patternLink ? `<p><strong>Pattern link:</strong> <a href="${escapeHTML(project.patternLink)}" target="_blank" rel="noopener noreferrer">${escapeHTML(project.patternLink)}</a></p>` : ''}
            <p class="notes"><strong>Notes:</strong> ${escapeHTML(project.notes || 'No extra notes yet.')}</p>
          </div>
        </div>
        <span class="status-badge ${escapeHTML(project.status.toLowerCase().replace(/\s+/g, '-'))}">${escapeHTML(project.status)}</span>
      </div>
      ${project.image ? `<img class="project-image" src="${project.image}" alt="${escapeHTML(project.name)}" />` : ''}
    `;

    card.addEventListener('click', () => {
      projects = projects.map((entry) =>
        entry.id === project.id ? { ...entry, lastViewedAt: Date.now() } : entry
      );
      saveProjects();
      renderProjects();
      updateHeroImage();
    });

    const removeButton = document.createElement('button');
    removeButton.className = 'delete-btn';
    removeButton.textContent = 'Delete';
    removeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      projects = projects.filter((entry) => entry.id !== project.id);
      saveProjects();
      renderProjects();
      updateHeroImage();
    });

    card.appendChild(removeButton);
    list.appendChild(card);
  });
}

searchInput.addEventListener('input', renderProjects);
statusFilterInput.addEventListener('change', renderProjects);

ratingFilterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    ratingFilterInput.value = button.dataset.ratingFilter;
    updateFilterButtons(ratingFilterButtons, ratingFilterInput.value, 'ratingFilter');
    renderProjects();
  });
});

difficultyFilterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    difficultyFilterInput.value = button.dataset.difficultyFilter;
    updateFilterButtons(difficultyFilterButtons, difficultyFilterInput.value, 'difficultyFilter');
    renderProjects();
  });
});

groupForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const name = groupNameInput.value.trim();
  const invitedPeople = groupInvitesInput.value
    .split(',')
    .map((person) => person.trim())
    .filter(Boolean);

  if (!name) return;

  groups.unshift({
    id: `group-${Date.now()}`,
    name,
    invitedPeople,
    messages: [],
  });

  saveGroups();
  setActiveGroup(groups[0].id);
  groupForm.reset();
  groupNameInput.focus();
});

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const activeGroup = getActiveGroup();
  const messageText = chatInput.value.trim();

  if (!activeGroup || !messageText) return;

  groups = groups.map((group) =>
    group.id === activeGroup.id
      ? {
          ...group,
          messages: [
            ...group.messages,
            {
              id: `message-${Date.now()}`,
              sender: 'You',
              text: messageText,
              createdAt: Date.now(),
            },
          ],
        }
      : group
  );

  saveGroups();
  renderGroups();
  chatInput.value = '';
});

copyInviteButton.addEventListener('click', async () => {
  const currentGroup = getActiveGroup();
  if (!currentGroup) return;

  const url = new URL(window.location.href);
  url.searchParams.set(GROUP_QUERY_PARAM, currentGroup.id);

  try {
    await navigator.clipboard.writeText(url.toString());
    copyInviteButton.textContent = 'Link copied';
    window.setTimeout(() => {
      copyInviteButton.textContent = 'Copy invite link';
    }, 1600);
  } catch (error) {
    copyInviteButton.textContent = 'Copy failed';
    window.setTimeout(() => {
      copyInviteButton.textContent = 'Copy invite link';
    }, 1600);
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const pattern = patternInput.value.trim();
  const notes = notesInput.value.trim();
  const patternLink = patternLinkInput.value.trim();
  const needleSize = needleInput.value.trim();
  const rating = Number(ratingInput.value) || 0;
  const difficulty = Number(difficultyInput.value) || 0;

  if (!name || !pattern) return;

  const image = await readImageAsDataURL(imageInput.files[0]);

  projects.unshift({
    id: `project-${Date.now()}`,
    name,
    pattern,
    status: statusInput.value,
    notes,
    patternLink,
    needleSize,
    rating,
    difficulty,
    image,
    lastViewedAt: Date.now(),
  });

  saveProjects();
  renderProjects();
  updateHeroImage();
  form.reset();
  nameInput.focus();
});

if (projects.length === 0) {
  projects = [
    {
      id: 'project-moonlight',
      name: 'Moonlight scarf',
      pattern: 'Garter rib',
      status: 'In progress',
      notes: 'Need a second ball of yarn and keep the edges neat.',
      needleSize: '4 mm circular',
      patternLink: 'https://example.com/moonlight-scarf',
      lastViewedAt: Date.now() - 1000,
    },
    {
      id: 'project-weekend',
      name: 'Weekend hat',
      pattern: 'Cable twist',
      status: 'Planning',
      notes: 'Test the gauge before casting on.',
      needleSize: '3.5 mm double-pointed',
      patternLink: 'https://example.com/weekend-hat',
      lastViewedAt: Date.now() - 2000,
    },
  ];
  saveProjects();
}

renderProjects();
renderGroups();
