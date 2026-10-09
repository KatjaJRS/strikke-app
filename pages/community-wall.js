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
    name: myProfileName,
    profile_pic: myProfilePic
  });

  const members = [...membersByName.values()]
    .filter((profile) => String(profile.name || '').trim())
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  allMembersList.innerHTML = members.length
    ? members.map((member) => `
      <li class="community-member">
        ${getAvatarHTML(member.name, member.profile_pic || '')}
        <span>${escapeHTML(member.name)}</span>
      </li>
    `).join('')
    : `<li class="community-empty-members">${translations[currentLanguage].noCommunityMembers}</li>`;
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
        ${post.text ? `<p class="community-post-text">${escapeHTML(post.text)}</p>` : ''}
        ${imageHTML}
        ${linkHTML}
        ${ownActions}
        <section class="post-comments">
          <h3>${translations[currentLanguage].commentsHeading} <span>(${comments.length})</span></h3>
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
