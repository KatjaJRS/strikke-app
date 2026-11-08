const feedbackOpen = document.getElementById('feedback-open');
const feedbackModal = document.getElementById('feedback-modal');
const feedbackForm = document.getElementById('feedback-form');
const feedbackMessage = document.getElementById('feedback-message');
const feedbackError = document.getElementById('feedback-error');
const feedbackSuccess = document.getElementById('feedback-success');
const feedbackSection = document.getElementById('admin-feedback-section');
const feedbackList = document.getElementById('admin-feedback-list');
let feedbackItems = [];
let feedbackLoadError = false;
let feedbackTimer = null;
let feedbackLoading = false;

function renderFeedback() {
  const isAdmin = currentUser && isAdminUser();
  const unread = isAdmin ? feedbackItems.filter(item => !item.read_at).length : 0;
  feedbackOpen.dataset.feedbackUnread = unread ? 'true' : 'false';
  const feedbackLabel = translations[currentLanguage].feedbackButton;
  feedbackOpen.setAttribute('aria-label', unread
    ? `${feedbackLabel}: ${unread} ${translations[currentLanguage].feedbackUnread}`
    : feedbackLabel);
  feedbackOpen.title = unread ? `${unread} ${translations[currentLanguage].feedbackUnread}` : feedbackLabel;
  const adminButton = document.getElementById('profile-mode-admin');
  const communityButton = document.querySelector('.nav-btn[data-section="groups-chats"]');
  [adminButton, communityButton].forEach(button => {
    if (button) button.dataset.feedbackUnread = isAdmin && feedbackLoadError ? '?' : unread ? String(unread) : '';
  });
  if (communityButton) {
    communityButton.querySelector('.feedback-nav-badge')?.remove();
    if (communityButton.dataset.feedbackUnread) {
      const badge = document.createElement('span');
      badge.className = 'feedback-nav-badge';
      badge.textContent = communityButton.dataset.feedbackUnread;
      badge.setAttribute('aria-hidden', 'true');
      communityButton.append(badge);
    }
  }
  if (adminButton) {
    adminButton.title = feedbackLoadError && isAdmin ? translations[currentLanguage].feedbackLoadFailed : unread ? `${unread} ${translations[currentLanguage].feedbackUnread}` : 'Admin';
    adminButton.setAttribute('aria-label', adminButton.title);
  }
  if (typeof updateGroupsBadge === 'function') updateGroupsBadge();
  if (!feedbackSection || !feedbackList) return;
  feedbackSection.classList.toggle('hidden', !canManageAdminProfile());
  if (!canManageAdminProfile()) {
    feedbackList.replaceChildren();
    return;
  }
  feedbackList.replaceChildren();
  if (feedbackLoadError) {
    const error = document.createElement('p');
    error.textContent = translations[currentLanguage].feedbackLoadFailed;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = translations[currentLanguage].feedbackRetry;
    retry.addEventListener('click', refreshFeedback);
    feedbackList.append(error, retry);
    return;
  }
  if (!feedbackItems.length) {
    const empty = document.createElement('p');
    empty.textContent = translations[currentLanguage].feedbackEmpty;
    feedbackList.append(empty);
    return;
  }
  feedbackItems.forEach(item => {
    const card = document.createElement('article');
    card.className = 'feedback-item';
    const name = document.createElement('strong');
    name.textContent = item.sender_name;
    const date = document.createElement('time');
    date.dateTime = item.created_at;
    date.textContent = new Date(item.created_at).toLocaleString(currentLanguage === 'da' ? 'da-DK' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    const message = document.createElement('p');
    message.textContent = item.message;
    card.append(name, date, message);
    if (!item.read_at) {
      const markRead = document.createElement('button');
      markRead.type = 'button';
      markRead.textContent = translations[currentLanguage].feedbackMarkRead;
      markRead.addEventListener('click', async () => {
        markRead.disabled = true;
        const { error } = await sb.from('feedback').update({ read_at: new Date().toISOString() }).eq('id', item.id).is('read_at', null);
        if (error) {
          console.error('Could not mark feedback as read:', error);
          alert(translations[currentLanguage].feedbackMarkFailed);
          markRead.disabled = false;
          return;
        }
        await refreshFeedback();
      });
      card.append(markRead);
    }
    feedbackList.append(card);
  });
}

async function refreshFeedback() {
  if (!currentUser || !isAdminUser() || feedbackLoading) return;
  const userId = currentUser.id;
  feedbackLoading = true;
  try {
    const { data, error } = await sb.from('feedback').select('id, sender_name, message, created_at, read_at').order('created_at', { ascending: false });
    if (error) throw error;
    if (currentUser?.id !== userId) return;
    feedbackItems = data;
    feedbackLoadError = false;
  } catch (error) {
    console.error('Could not load feedback:', error);
    feedbackLoadError = true;
  } finally {
    feedbackLoading = false;
    renderFeedback();
  }
}

function startFeedback() {
  feedbackOpen.classList.remove('hidden');
  feedbackItems = [];
  feedbackLoadError = false;
  renderFeedback();
  if (isAdminUser()) refreshFeedback();
  if (!feedbackTimer) feedbackTimer = setInterval(refreshFeedback, 30000);
}

feedbackOpen.addEventListener('click', () => {
  feedbackModal.classList.remove('hidden');
  feedbackError.classList.add('hidden');
  feedbackSuccess.classList.add('hidden');
  feedbackMessage.focus();
});
document.getElementById('feedback-close').addEventListener('click', () => {
  feedbackModal.classList.add('hidden');
  feedbackOpen.focus();
});
feedbackForm.addEventListener('submit', async event => {
  event.preventDefault();
  feedbackError.classList.add('hidden');
  feedbackSuccess.classList.add('hidden');
  const message = feedbackMessage.value.trim();
  if (!message) {
    feedbackError.textContent = translations[currentLanguage].feedbackEmptyMessage;
    feedbackError.classList.remove('hidden');
    return;
  }
  const submit = feedbackForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const { error } = await sb.from('feedback').insert({
      user_id: currentUser.id,
      sender_name: (myProfileName || currentUser.email || 'Member').trim().slice(0, 200),
      message
    });
    if (error) throw error;
    feedbackMessage.value = '';
    feedbackSuccess.classList.remove('hidden');
    if (isAdminUser()) refreshFeedback();
  } catch (error) {
    console.error('Could not send feedback:', error);
    feedbackError.textContent = translations[currentLanguage].feedbackSendFailed;
    feedbackError.classList.remove('hidden');
  } finally {
    submit.disabled = false;
  }
});
