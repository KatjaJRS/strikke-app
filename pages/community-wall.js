// ── Fælles opslagstavle ───────────────────────────────────────────────────

function isOwnMessage(message) {
  if (message?.authorId && currentUser?.id) return message.authorId === currentUser.id;
  return !message?.sender || message.sender === 'You' || message.sender === myProfileName;
}

const chatEditModal = document.getElementById('chat-edit-modal');
const chatEditText = document.getElementById('chat-edit-text');
const chatEditSaveBtn = document.getElementById('chat-edit-save');
const chatEditCancelBtn = document.getElementById('chat-edit-cancel');
const communityFeed = document.getElementById('chat-messages');
const communityForm = document.getElementById('chat-form');
const communityPostInput = document.getElementById('chat-message');
const postFormError = document.getElementById('post-form-error');
const communityImageInput = document.getElementById('chat-image-input');
const communityImagePreviewRow = document.getElementById('chat-image-preview-row');
const communityImagePreview = document.getElementById('chat-image-preview');
const communityImageClearBtn = document.getElementById('chat-image-clear-btn');
let editingPostContext = null;
let pendingPostImage = '';
const openCommentPosts = new Set();
const expandedPosts = new Set();
const notifiedMembershipRequestIds = new Set();

function formatCommunityDate(timestamp) {
  return new Date(timestamp).toLocaleString(currentLanguage === 'da' ? 'da-DK' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function getMemberPicture(name) {
  const normalizedName = String(name || '').trim().toLowerCase();
  return memberProfiles.find((profile) => String(profile.name || '').trim().toLowerCase() === normalizedName)?.profile_pic || '';
}

function renderCommunityMembers() {
  const allMembersList = document.getElementById('all-members-list');
  if (!allMembersList) return;

  const adminRequestsSection = document.getElementById('admin-membership-requests-section');
  const canSeeRequests = canManageAdminProfile();
  if (adminRequestsSection) adminRequestsSection.classList.toggle('hidden', !canSeeRequests);

  const pendingList = document.getElementById('pending-requests-list');
  if (pendingList && canSeeRequests) {
    const visibleRequests = membershipRequests.filter((request) => !reviewedMembershipRequestIds.has(request.id));
    const pendingCount = visibleRequests.length;
    const pendingBadge = document.getElementById('pending-request-count');
    if (pendingBadge) {
      pendingBadge.textContent = pendingCount ? String(pendingCount) : '';
      pendingBadge.classList.toggle('hidden', pendingCount === 0);
      pendingBadge.setAttribute('aria-label', `${pendingCount} ${translations[currentLanguage].newMembershipRequests}`);
    }
    pendingList.innerHTML = visibleRequests.length
      ? visibleRequests.map((request) => `
        <li class="pending-request-item">
          <div class="pending-info">
            ${getAvatarHTML(request.name, '')}
            <div>
              <strong>${escapeHTML(request.name)}</strong>
              ${request.email ? `<span class="pending-email">${escapeHTML(request.email)}</span>` : ''}
            </div>
          </div>
          <div class="pending-actions">
            <button class="accept-btn" data-id="${escapeHTML(request.id)}">${translations[currentLanguage].pendingAccept}</button>
            <button class="reject-btn" data-id="${escapeHTML(request.id)}">${translations[currentLanguage].pendingReject}</button>
          </div>
        </li>
      `).join('')
      : `<li class="no-pending">${translations[currentLanguage].noPendingRequests}</li>`;

    pendingList.querySelectorAll('.accept-btn').forEach((button) => {
      button.addEventListener('click', () => acceptMember(button.dataset.id));
    });
    pendingList.querySelectorAll('.reject-btn').forEach((button) => {
      button.addEventListener('click', () => rejectMember(button.dataset.id));
    });
  }

  const membersByName = new Map();
  (Array.isArray(memberProfiles) ? memberProfiles : []).forEach((profile) => {
    const name = String(profile.name || '').trim();
    if (name && !membersByName.has(name.toLowerCase())) membersByName.set(name.toLowerCase(), profile);
  });
  membersByName.set(String(myProfileName || '').trim().toLowerCase(), {
    id: currentUser?.id || '',
    name: myProfileName,
    profile_pic: myProfilePic
  });

  const members = [...membersByName.values()]
    .filter((profile) => String(profile.name || '').trim())
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const membersCount = document.getElementById('members-toggle-count');
  const membersLabel = document.getElementById('members-toggle-label');
  if (membersCount) membersCount.textContent = `(${members.length})`;
  if (membersLabel) membersLabel.textContent = translations[currentLanguage].allMembersHeading;

  allMembersList.innerHTML = members.length
    ? members.map((member) => `
      <li class="community-member">
        ${member.id
          ? `<button type="button" class="community-member-btn" data-user-id="${escapeHTML(member.id)}" data-name="${escapeHTML(member.name)}" title="${escapeHTML(translations[currentLanguage].viewProfileHint)}">
              ${getAvatarHTML(member.name, member.profile_pic || '')}
              <span class="community-member-name">${escapeHTML(member.name)}</span>
            </button>`
          : `${getAvatarHTML(member.name, member.profile_pic || '')}
              <span class="community-member-name">${escapeHTML(member.name)}</span>`}
      </li>
    `).join('')
    : `<li class="community-empty-members">${translations[currentLanguage].noCommunityMembers}</li>`;

  allMembersList.querySelectorAll('.community-member-btn').forEach((button) => {
    button.addEventListener('click', () => openMemberProjects(button.dataset.userId, button.dataset.name));
  });
}

function showMembershipRequestNotice(request) {
  if (!isAdminUser() || !request?.id || notifiedMembershipRequestIds.has(request.id)) return;
  notifiedMembershipRequestIds.add(request.id);

  const notice = document.createElement('div');
  notice.className = 'membership-request-notice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  const message = document.createElement('span');
  message.textContent = `${request.name || translations[currentLanguage].communityMemberFallback} — ${translations[currentLanguage].newMembershipRequestNotification}`;
  const reviewButton = document.createElement('button');
  reviewButton.type = 'button';
  reviewButton.className = 'membership-request-review';
  reviewButton.textContent = translations[currentLanguage].reviewMembershipRequests;
  reviewButton.addEventListener('click', () => {
    notice.remove();
    switchSection('groups-chats');
    setProfileMode('admin');
    document.getElementById('admin-membership-requests-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.className = 'membership-request-dismiss';
  dismissButton.setAttribute('aria-label', translations[currentLanguage].dismissMembershipRequestNotification);
  dismissButton.textContent = '×';
  dismissButton.addEventListener('click', () => notice.remove());
  notice.append(message, reviewButton, dismissButton);
  document.body.appendChild(notice);
  setTimeout(() => notice.remove(), 12000);
}

// ── Medlemmers delte projekter ───────────────────────────────────────────
function getMemberProjectsModal() {
  let modal = document.getElementById('member-projects-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'member-projects-modal';
  modal.className = 'member-projects-modal hidden';
  modal.innerHTML = `
    <div class="member-projects-dialog" role="dialog" aria-modal="true" aria-labelledby="member-projects-title">
      <button type="button" class="member-projects-close" aria-label="Close">✕</button>
      <h2 id="member-projects-title"></h2>
      <div id="member-projects-body"></div>
    </div>`;
  document.body.appendChild(modal);
  const close = () => modal.classList.add('hidden');
  modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
  modal.querySelector('.member-projects-close').addEventListener('click', close);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  return modal;
}

function renderMemberProjectCard(project) {
  const t = translations[currentLanguage];
  const rating = project.rating > 0 ? `<span class="stars">${renderStars(project.rating)}</span>` : '';
  return `
    <article class="member-project-card">
      <div class="member-project-info">
        <div class="title-stars-row"><h3>${escapeHTML(project.name)}</h3>${rating}</div>
        <span class="status-badge">${escapeHTML(translateStatus(project.status))}</span>
        ${project.difficulty ? renderHearts(project.difficulty) : ''}
        ${renderYarns(project.yarns || [])}
        ${renderNeedles(project.needles)}
        ${project.notes ? `<p><strong>${escapeHTML(t.notesLabel)}:</strong> ${escapeHTML(project.notes)}</p>` : ''}
      </div>
      ${renderProjectGallery(project)}
    </article>`;
}

async function openMemberProjects(userId, name) {
  const modal = getMemberProjectsModal();
  const t = translations[currentLanguage];
  const title = modal.querySelector('#member-projects-title');
  const body = modal.querySelector('#member-projects-body');
  title.textContent = `${name} – ${t.sharedProjectsTitle}`;
  body.innerHTML = '<p class="chat-empty">…</p>';
  modal.classList.remove('hidden');
  try {
    const shared = await loadSharedProjectsForUser(userId);
    body.innerHTML = shared.length
      ? shared.map(renderMemberProjectCard).join('')
      : `<p class="chat-empty">${escapeHTML(t.noSharedProjects)}</p>`;
    body.querySelectorAll('.member-project-card').forEach(bindProjectGallery);
  } catch (error) {
    console.error('Could not load shared projects:', error);
    body.innerHTML = `<p class="post-error" role="alert">${escapeHTML(t.sharedProjectsLoadFailed)}</p>`;
  }
}

function renderCommunityFeed() {
  if (!communityFeed) return;
  const activeGroup = getActiveGroup();
  const posts = activeGroup?.messages || [];
  if (communityPostsLoadError) {
    communityFeed.innerHTML = `<p class="post-error" role="alert">${translations[currentLanguage].postsLoadFailed}</p>`;
    return;
  }
  const commentSetupNotice = postCommentsLoadError
    ? `<p class="post-error" role="alert">${translations[currentLanguage].commentSetupRequired}</p>`
    : '';
  if (posts.length === 0) {
    communityFeed.innerHTML = `${commentSetupNotice}<p class="chat-empty">${translations[currentLanguage].noCommunityPosts}</p>`;
    return;
  }

  communityFeed.innerHTML = commentSetupNotice + posts.map((post) => {
    const sender = post.sender || translations[currentLanguage].communityMemberFallback;
    const isMine = isOwnMessage(post);
    const projectTitleMatch = String(post.text || '').match(/^🧶 (.+)$/);
    const projectTitle = projectTitleMatch?.[1] || '';
    const postBody = projectTitle ? post.text.slice(projectTitleMatch[0].length).trimStart() : post.text;
    const comments = Array.isArray(post.comments) ? post.comments : [];
    const commentsHTML = comments.map((comment) => `
      <li class="post-comment">
        ${getAvatarHTML(comment.sender, getMemberPicture(comment.sender))}
        <div class="post-comment-content">
          <div class="post-comment-meta">
            <strong>${escapeHTML(comment.sender)}</strong>
            <time>${escapeHTML(formatCommunityDate(comment.createdAt))}</time>
          </div>
          <p>${escapeHTML(comment.text)}</p>
        </div>
      </li>
    `).join('');
    const imageHTML = post.image
      ? `<img class="community-post-image" src="${escapeHTML(post.image)}" alt="${escapeHTML(translations[currentLanguage].communityPostImageAlt)}" loading="lazy" />`
      : '';
    const linkHTML = post.link
      ? `<a class="chat-link" href="${escapeHTML(post.link)}" target="_blank" rel="noopener noreferrer">🔗 ${escapeHTML(post.linkLabel || post.link)}</a>`
      : '';
    const ownActions = isMine
      ? `<div class="chat-actions">
          <button type="button" class="chat-action-btn post-edit-btn" data-post-id="${escapeHTML(post.id)}">${translations[currentLanguage].chatEditButton}</button>
          <button type="button" class="chat-action-btn post-delete-btn" data-post-id="${escapeHTML(post.id)}">${translations[currentLanguage].chatDeleteButton}</button>
        </div>`
      : '';

    return `
      <article class="community-post" data-post-id="${escapeHTML(post.id)}">
        <header class="community-post-header">
          ${getAvatarHTML(sender, isMine ? myProfilePic : getMemberPicture(sender))}
          <div class="community-post-byline">
            <strong>${escapeHTML(sender)}</strong>
            <time>${escapeHTML(formatCommunityDate(post.createdAt))}</time>
          </div>
        </header>
        ${projectTitle ? `<h3 class="community-project-title">🧶 ${escapeHTML(projectTitle)}</h3>` : ''}
        ${postBody ? `<p class="community-post-text clamped" data-post-id="${escapeHTML(post.id)}">${escapeHTML(postBody)}</p>` : ''}
        ${imageHTML}
        ${linkHTML}
        ${ownActions}
        <button type="button" class="comment-toggle" data-post-id="${escapeHTML(post.id)}" aria-expanded="${openCommentPosts.has(post.id)}" aria-label="${escapeHTML(translations[currentLanguage].commentsHeading)}">
          <span class="comment-bubble" aria-hidden="true">💬</span>
          <span class="comment-count">${comments.length}</span>
        </button>
        <section class="post-comments${openCommentPosts.has(post.id) ? '' : ' hidden'}">
          <ul class="post-comment-list">${commentsHTML}</ul>
          <form class="post-comment-form" data-post-id="${escapeHTML(post.id)}">
            <label class="sr-only" for="comment-${escapeHTML(post.id)}">${translations[currentLanguage].commentLabel}</label>
            <input id="comment-${escapeHTML(post.id)}" name="comment" type="text" maxlength="2000" required placeholder="${escapeHTML(translations[currentLanguage].commentPlaceholder)}" ${postCommentsLoadError ? 'disabled' : ''} />
            <button type="submit" ${postCommentsLoadError ? 'disabled' : ''}>${translations[currentLanguage].commentButton}</button>
          </form>
          <p class="post-comment-error hidden" role="alert"></p>
        </section>
      </article>
    `;
  }).join('');

  communityFeed.querySelectorAll('.post-comment-form').forEach((commentForm) => {
    commentForm.addEventListener('submit', submitPostComment);
  });
  communityFeed.querySelectorAll('.community-post-text').forEach((paragraph) => {
    const postId = paragraph.dataset.postId;
    if (expandedPosts.has(postId)) paragraph.classList.remove('clamped');
    if (!expandedPosts.has(postId) && paragraph.scrollHeight <= paragraph.clientHeight + 1) return;
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'read-more-btn';
    const setLabel = () => {
      more.textContent = paragraph.classList.contains('clamped')
        ? translations[currentLanguage].readMore
        : translations[currentLanguage].readLess;
    };
    setLabel();
    more.addEventListener('click', () => {
      const clamped = paragraph.classList.toggle('clamped');
      if (clamped) expandedPosts.delete(postId); else expandedPosts.add(postId);
      setLabel();
    });
    paragraph.after(more);
  });
  communityFeed.querySelectorAll('.community-post-image').forEach((image) => {
    image.addEventListener('click', () => image.classList.toggle('enlarged'));
  });
  communityFeed.querySelectorAll('.comment-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const postId = button.dataset.postId;
      const isOpen = !openCommentPosts.has(postId);
      if (isOpen) openCommentPosts.add(postId); else openCommentPosts.delete(postId);
      button.setAttribute('aria-expanded', String(isOpen));
      button.nextElementSibling.classList.toggle('hidden', !isOpen);
      if (isOpen) button.nextElementSibling.querySelector('input')?.focus();
    });
  });
  communityFeed.querySelectorAll('.post-edit-btn').forEach((button) => {
    button.addEventListener('click', () => editOwnPost(button.dataset.postId));
  });
  communityFeed.querySelectorAll('.post-delete-btn').forEach((button) => {
    button.addEventListener('click', () => deleteOwnPost(button.dataset.postId));
  });
}

function renderGroups() {
  renderCommunityMembers();
  renderCommunityFeed();
  updateGroupsBadge();
}

function openPostEditModal(post) {
  if (!chatEditModal || !chatEditText || !post?.id) return;
  editingPostContext = { postId: post.id };
  chatEditText.value = post.text || '';
  chatEditModal.classList.remove('hidden');
  chatEditText.focus();
  chatEditText.setSelectionRange(chatEditText.value.length, chatEditText.value.length);
}

function closePostEditModal() {
  if (!chatEditModal) return;
  chatEditModal.classList.add('hidden');
  editingPostContext = null;
}

function editOwnPost(postId) {
  const post = getActiveGroup()?.messages.find((item) => item.id === postId);
  if (post && isOwnMessage(post)) openPostEditModal(post);
}

async function deleteOwnPost(postId) {
  const post = getActiveGroup()?.messages.find((item) => item.id === postId);
  if (!post || !isOwnMessage(post)) return;
  if (!confirm(translations[currentLanguage].chatDeleteConfirm)) return;

  const success = await deleteMessageById(postId);
  if (!success) {
    alert(translations[currentLanguage].chatDeleteFailed);
    return;
  }
  await refreshCommunityData();
  renderGroups();
}

async function saveEditedPost() {
  if (!editingPostContext || !chatEditText) return;
  const post = getActiveGroup()?.messages.find((item) => item.id === editingPostContext.postId);
  const nextText = chatEditText.value.trim();
  if (!post || !isOwnMessage(post)) {
    closePostEditModal();
    return;
  }
  if (!nextText && !post.image && !post.link) {
    alert(translations[currentLanguage].chatEditEmpty);
    return;
  }

  const success = await updateMessageById(post.id, { text: nextText });
  if (!success) {
    alert(translations[currentLanguage].chatUpdateFailed);
    return;
  }
  closePostEditModal();
  await refreshCommunityData();
  renderGroups();
}

if (chatEditSaveBtn) chatEditSaveBtn.addEventListener('click', saveEditedPost);
if (chatEditCancelBtn) chatEditCancelBtn.addEventListener('click', closePostEditModal);
if (chatEditModal) {
  chatEditModal.addEventListener('click', (event) => {
    if (event.target === chatEditModal) closePostEditModal();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !chatEditModal.classList.contains('hidden')) closePostEditModal();
  });
}

async function submitPostComment(event) {
  event.preventDefault();
  const commentForm = event.currentTarget;
  const input = commentForm.elements.namedItem('comment');
  const text = input.value.trim();
  if (!text) return;

  const submitButton = commentForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const savedComment = await savePostComment(commentForm.dataset.postId, text);
    openCommentPosts.add(commentForm.dataset.postId);
    groups = groups.map((group) => ({
      ...group,
      messages: group.messages.map((post) => post.id === commentForm.dataset.postId
        ? { ...post, comments: [...(post.comments || []), savedComment] }
        : post)
    }));
    renderGroups();
  } catch (error) {
    console.error('Could not save comment. Check the post_comments table and RLS policies:', error);
    postCommentsLoadError = error;
    openCommentPosts.add(commentForm.dataset.postId);
    renderGroups();
    const refreshedError = communityFeed.querySelector(
      `.community-post[data-post-id="${CSS.escape(commentForm.dataset.postId)}"] .post-comment-error`
    );
    if (refreshedError) {
      refreshedError.textContent = translations[currentLanguage].commentSaveFailed;
      refreshedError.classList.remove('hidden');
    }
  } finally {
    submitButton.disabled = false;
  }
}

if (communityForm) {
  communityForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = communityPostInput.value.trim();
    if (!text && !pendingPostImage) return;

    postFormError.classList.add('hidden');
    const submitButton = communityForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    const post = {
      id: `post-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      authorId: currentUser.id,
      sender: myProfileName,
      text,
      image: pendingPostImage,
      createdAt: Date.now(),
      comments: []
    };

    groups = groups.map((group) => ({ ...group, messages: [post, ...group.messages] }));
    renderGroups();
    try {
      const saved = await saveNewMessage(COMMUNITY_GROUP_ID, post);
      if (!saved) throw new Error('Supabase did not save the post.');
      communityPostInput.value = '';
      pendingPostImage = '';
      communityImageInput.value = '';
      communityImagePreviewRow.classList.add('hidden');
      communityImagePreview.src = '';
    } catch (error) {
      console.error('Could not publish community post:', error);
      groups = groups.map((group) => ({
        ...group,
        messages: group.messages.filter((item) => item.id !== post.id)
      }));
      postFormError.textContent = translations[currentLanguage].postSaveFailed;
      postFormError.classList.remove('hidden');
      renderGroups();
    } finally {
      submitButton.disabled = false;
    }
    await refreshCommunityData();
    renderGroups();
  });
}

if (communityImageInput) {
  communityImageInput.addEventListener('change', async () => {
    const file = communityImageInput.files[0];
    if (!file) return;
    try {
      pendingPostImage = await storeImageFile(file, 'community');
      if (!pendingPostImage) throw new Error('The selected image could not be read.');
      communityImagePreview.src = pendingPostImage;
      communityImagePreviewRow.classList.remove('hidden');
    } catch (error) {
      console.error('Could not prepare community post image:', error);
      postFormError.textContent = translations[currentLanguage].imageUploadFailed;
      postFormError.classList.remove('hidden');
    }
  });
}

if (communityImageClearBtn) {
  communityImageClearBtn.addEventListener('click', () => {
    pendingPostImage = '';
    communityImageInput.value = '';
    communityImagePreviewRow.classList.add('hidden');
    communityImagePreview.src = '';
  });
}

setInterval(async () => {
  if (!currentUser || document.visibilityState !== 'visible') return;
  const section = document.getElementById('groups-chats');
  if (!section?.classList.contains('active')) return;
  await refreshCommunityData();
  renderGroups();
}, 45000);

// ── Del et projekt som opslag på fællesskabsvæggen ──────────────────────
async function shareProjectToCommunity(projectId) {
  const project = projects.find((item) => item.id === projectId);
  const t = translations[currentLanguage];
  if (!project || !currentUser) return;
  if (!confirm(t.shareToCommunityConfirm.replace('{name}', project.name))) return;

  const lines = [`🧶 ${project.name}`, translateStatus(project.status)];
  const yarns = (project.yarns || []).filter((yarn) => yarn.type)
    .map((yarn) => [yarn.type, yarn.color].filter(Boolean).join(' – ')).join(', ');
  if (yarns) lines.push(`${t.yarnsDisplayLabel}: ${yarns}`);
  const needles = (project.needles || []).filter(Boolean).join(', ');
  if (needles) lines.push(`${t.needlesDisplayLabel}: ${needles}`);
  if (project.notes) lines.push(project.notes);

  const post = {
    id: `post-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    authorId: currentUser.id,
    sender: myProfileName,
    text: lines.join('\n'),
    image: getProjectImages(project)[0] || '',
    createdAt: Date.now(),
    comments: []
  };
  const saved = await saveNewMessage(COMMUNITY_GROUP_ID, post);
  if (!saved) {
    showSyncToast(t.postSaveFailed);
    return;
  }
  showSyncToast(t.shareToCommunityDone, 'success');
  await refreshCommunityData();
  renderGroups();
}

// ── Kompakt layout: medlemsliste og skriveboks ──────────────────────────
(function setupCompactCommunity() {
  const toggle = document.getElementById('members-toggle');
  const list = document.getElementById('all-members-list');
  if (toggle && list) {
    toggle.addEventListener('click', () => {
      const open = list.classList.toggle('members-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }
  const composer = document.getElementById('chat-form');
  if (composer) {
    composer.addEventListener('focusin', () => composer.classList.remove('collapsed'));
    composer.addEventListener('focusout', () => {
      setTimeout(() => {
        const hasContent = communityPostInput.value.trim() || pendingPostImage;
        if (!composer.contains(document.activeElement) && !hasContent) composer.classList.add('collapsed');
      }, 0);
    });
  }
})();
