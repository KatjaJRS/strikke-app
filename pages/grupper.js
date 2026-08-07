// ── Grupper og chats ──────────────────────────────────────────────────────

function renderGroups() {
  groupList.innerHTML = '';

  const adminRequestsSection = document.getElementById('admin-membership-requests-section');
  if (adminRequestsSection) {
    adminRequestsSection.classList.toggle('hidden', !isAdminUser());
  }

  groups.forEach((group) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `group-pill${group.id === activeGroupId ? ' active' : ''}`;
    button.textContent = group.name;
    button.addEventListener('click', () => setActiveGroup(group.id));
    groupList.appendChild(button);
  });

  // Vis ventende anmodninger
  const pendingList = document.getElementById('pending-requests-list');
  if (pendingList && isAdminUser()) {
    const visibleRequests = membershipRequests.filter((req) => !reviewedMembershipRequestIds.has(req.id));
    if (visibleRequests.length === 0) {
      pendingList.innerHTML = `<li class="no-pending">${translations[currentLanguage].noPendingRequests}</li>`;
    } else {
      pendingList.innerHTML = visibleRequests.map((req) => `
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
  } else if (pendingList) {
    pendingList.innerHTML = '';
  }

  // Vis alle unikke medlemmer
  const allMembersList = document.getElementById('all-members-list');
  if (allMembersList) {
    const allMembers = [...new Set(memberDirectory)].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
    allMembersList.innerHTML = allMembers.length
      ? allMembers.map(person => `<li>${getAvatarHTML(person, '')} ${escapeHTML(person)}</li>`).join('')
      : '';
  }

  const activeGroup = getActiveGroup();
  if (!activeGroup) {
    activeGroupName.textContent = translations[currentLanguage].noGroupYet;
    groupMembersList.innerHTML = '';
    chatMessages.innerHTML = `<p class="chat-empty">${translations[currentLanguage].createGroupToStartChat}</p>`;
    return;
  }

  activeGroupName.textContent = activeGroup.name;
  groupMembersList.innerHTML = activeGroup.invitedPeople.length
    ? activeGroup.invitedPeople.map((person) => `<li>${getAvatarHTML(person, '')} ${escapeHTML(person)}</li>`).join('')
    : `<li>${translations[currentLanguage].noInvitesYet}</li>`;

  if (activeGroup.messages.length === 0) {
    chatMessages.innerHTML = `<p class="chat-empty">${translations[currentLanguage].noMessagesYet}</p>`;
  } else {
    chatMessages.innerHTML = activeGroup.messages.map((message) => {
      const timestamp = new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const isMe = !message.sender || message.sender === 'You' || message.sender === myProfileName;
      const senderName = isMe ? myProfileName : message.sender;
      const pic = isMe ? myProfilePic : '';

      let contentHTML = '';
      if (message.image) contentHTML += `<img class="chat-img" src="${message.image}" alt="shared image" />`;
      if (message.link && isMe) {
        const label = escapeHTML(message.linkLabel || message.link);
        contentHTML += `<a class="chat-link" href="${escapeHTML(message.link)}" target="_blank" rel="noopener noreferrer">🔗 ${label}</a>`;
      }
      if (message.text) contentHTML += `<p>${escapeHTML(message.text)}</p>`;

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
    }).join('');
  }
}

// ── Opret gruppe ──────────────────────────────────────────────────────────
groupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = groupNameInput.value.trim();
  const invites = groupInvitesInput.value.split(',').map(i => i.trim()).filter(Boolean);
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

// ── Chat-vedhæftninger ────────────────────────────────────────────────────
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

// ── Send chatbesked ───────────────────────────────────────────────────────
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

// ── Kopiér invite-link ────────────────────────────────────────────────────
if (copyInviteButton) {
  copyInviteButton.addEventListener('click', async () => {
    const currentGroup = getActiveGroup();
    if (!currentGroup) return;
    const url = new URL(window.location.href);
    url.searchParams.set(GROUP_QUERY_PARAM, currentGroup.id);
    try {
      await navigator.clipboard.writeText(url.toString());
      copyInviteButton.textContent = translations[currentLanguage].linkCopied;
      setTimeout(() => { copyInviteButton.textContent = translations[currentLanguage].copyInviteLink; }, 1600);
    } catch (error) {
      copyInviteButton.textContent = translations[currentLanguage].copyFailed;
      setTimeout(() => { copyInviteButton.textContent = translations[currentLanguage].copyInviteLink; }, 1600);
    }
  });
}

// Hold community data in sync across devices while Groups and Chats is open.
setInterval(async () => {
  const groupsSection = document.getElementById('groups-chats');
  if (!currentUser || !groupsSection || !groupsSection.classList.contains('active')) return;
  await refreshCommunityData();
  renderGroups();
  updateGroupsBadge();
}, 12000);
