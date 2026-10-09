// ── Gruppedata — gem og hent fra Supabase ─────────────────────────────────

const COMMUNITY_GROUP_ID = 'group-community';
const COMMUNITY_GROUP_NAME = 'Knitting community';
const POST_COMMENTS_TABLE = 'post_comments';
const POST_NOTIFICATIONS_TABLE = 'post_notifications';

function normalizeGroups() {
  const community = (Array.isArray(groups) ? groups : []).find((group) => group.id === COMMUNITY_GROUP_ID);
  groups = [{
    id: COMMUNITY_GROUP_ID,
    name: COMMUNITY_GROUP_NAME,
    invitedPeople: Array.isArray(community?.invitedPeople) ? community.invitedPeople : [],
    messages: Array.isArray(community?.messages) ? community.messages : []
  }];
  activeGroupId = COMMUNITY_GROUP_ID;
}

async function ensureCommunityGroup() {
  const { data, error } = await sb
    .from('groups')
    .select('id')
    .eq('id', COMMUNITY_GROUP_ID)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('The shared community group has not been created. Run supabase/post-comments.sql in the Supabase SQL Editor.');
}

function updateGroupsBadge() {
  const wallButton = document.querySelector('.nav-btn[data-section="groups-chats"]');
  const notificationButton = document.getElementById('community-notifications-button');
  if (!wallButton || !notificationButton) return;

  const postCount = Number(notificationButton.dataset.postUnread || 0);
  const interactionCount = Number(notificationButton.dataset.interactionUnread || 0);
  wallButton.dataset.postUnread = String(postCount);
  wallButton.dataset.interactionUnread = String(interactionCount);
  wallButton.setAttribute('aria-label', `${translations[currentLanguage].groupsHeading}. ${postCount} ${translations[currentLanguage].unreadPostsLabel}, ${interactionCount} ${translations[currentLanguage].unreadInteractionsLabel}`);
  wallButton.title = wallButton.getAttribute('aria-label');

  const total = postCount + interactionCount;
  notificationButton.dataset.unread = String(total);
  notificationButton.setAttribute('aria-label', `${translations[currentLanguage].notificationsHeading}${total ? ` (${total})` : ''}`);
  notificationButton.title = notificationButton.getAttribute('aria-label');
}

function markGroupsAsRead() {
  groupsLastRead = Date.now();
  localStorage.setItem(GROUPS_READ_KEY, String(groupsLastRead));
}

async function refreshCommunityNotifications() {
  if (!currentUser) return;
  const button = document.getElementById('community-notifications-button');
  if (!button) return;
  const [postsResult, interactionsResult] = await Promise.all([
    sb
      .from(POST_NOTIFICATIONS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', currentUser.id)
      .eq('notification_type', 'new_post')
      .is('read_at', null),
    sb
      .from(POST_NOTIFICATIONS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', currentUser.id)
      .in('notification_type', ['new_comment', 'mention'])
      .is('read_at', null)
  ]);
  const error = postsResult.error || interactionsResult.error;
  if (error) {
    console.error('Could not load unread community notifications. Run supabase/post-comments.sql:', error);
    button.dataset.postUnread = '0';
    button.dataset.interactionUnread = '0';
    button.disabled = true;
  } else {
    button.dataset.postUnread = String(postsResult.count || 0);
    button.dataset.interactionUnread = String(interactionsResult.count || 0);
    button.disabled = false;
  }
  updateGroupsBadge();
}

async function showCommunityNotifications() {
  const panel = document.getElementById('community-notifications');
  if (!panel || !currentUser) return;
  panel.classList.toggle('hidden');
  if (panel.classList.contains('hidden')) return;

  panel.innerHTML = `<p>${escapeHTML(translations[currentLanguage].notificationsLoading)}</p>`;
  const { data, error } = await sb
    .from(POST_NOTIFICATIONS_TABLE)
    .select('id, post_id, notification_type, actor_name, message_preview, created_at, read_at')
    .eq('recipient_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    console.error('Could not load community notifications:', error);
    panel.innerHTML = `<p class="post-error" role="alert">${escapeHTML(translations[currentLanguage].notificationsLoadFailed)}</p>`;
    return;
  }

  if (!data?.length) {
    panel.innerHTML = `<p>${escapeHTML(translations[currentLanguage].notificationsEmpty)}</p>`;
    return;
  }

  panel.innerHTML = data.map((notification) => `
    <button type="button" class="community-notification${notification.read_at ? '' : ' is-unread'}" data-notification-id="${escapeHTML(notification.id)}" data-post-id="${escapeHTML(notification.post_id)}">
      <strong>${escapeHTML(notification.actor_name)}</strong>
      <span>${escapeHTML(translations[currentLanguage][notification.notification_type === 'new_post' ? 'notificationPost' : notification.notification_type === 'mention' ? 'notificationMention' : 'notificationComment'])}</span>
      ${notification.message_preview ? `<span>${escapeHTML(notification.message_preview)}</span>` : ''}
      <time>${escapeHTML(new Date(notification.created_at).toLocaleString(currentLanguage === 'da' ? 'da-DK' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }))}</time>
    </button>
  `).join('');

  panel.querySelectorAll('.community-notification').forEach((notificationButton) => {
    notificationButton.addEventListener('click', async () => {
      const { error: updateError } = await sb
        .from(POST_NOTIFICATIONS_TABLE)
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationButton.dataset.notificationId)
        .eq('recipient_id', currentUser.id);
      if (updateError) {
        console.error('Could not mark community notification as read:', updateError);
        return;
      }
      panel.classList.add('hidden');
      const post = document.querySelector(`.community-post[data-post-id="${CSS.escape(notificationButton.dataset.postId)}"]`);
      post?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await refreshCommunityNotifications();
      panel.innerHTML = '';
    });
  });
}

const communityNotificationsButton = document.getElementById('community-notifications-button');
if (communityNotificationsButton) {
  communityNotificationsButton.addEventListener('click', showCommunityNotifications);
}

let profileRealtimeChannel = null;
let profileSyncHeartbeatId = null;
let communityRealtimeChannel = null;
let cleanupRunning = false;

async function cleanupDeletedProfilesFromGroups(profileData) {
  if (cleanupRunning) return;
  if (!Array.isArray(profileData)) return;

  const validNames = new Set(
    profileData
      .map((profile) => String(profile.name || '').trim().toLowerCase())
      .filter(Boolean)
  );

  cleanupRunning = true;
  try {
    for (const group of groups) {
      const currentInvited = Array.isArray(group.invitedPeople) ? group.invitedPeople : [];
      const filteredInvited = currentInvited.filter((name) => validNames.has(String(name || '').trim().toLowerCase()));
      if (filteredInvited.length === currentInvited.length) continue;

      group.invitedPeople = filteredInvited;
      await sb.from('groups').update({ invited_people: filteredInvited }).eq('id', group.id);
    }
  } catch (error) {
    console.error('Error cleaning deleted profiles from groups:', error);
  } finally {
    cleanupRunning = false;
  }
}

function mergeKnownMembers(profileData = [], groupData = [], messageData = [], includeFallbackNames = true) {
  const membersByName = new Map();
  const upsertMember = (name, profilePic = '', id = '') => {
    const normalizedName = String(name || '').trim();
    if (!normalizedName) return;
    const key = normalizedName.toLowerCase();
    const existing = membersByName.get(key);

    if (!existing) {
      membersByName.set(key, {
        id: id || '',
        name: normalizedName,
        profile_pic: profilePic || ''
      });
      return;
    }

    if (!existing.id && id) existing.id = id;
    if (!existing.profile_pic && profilePic) existing.profile_pic = profilePic;
  };

  (Array.isArray(profileData) ? profileData : []).forEach((profile) => {
    upsertMember(profile.name, profile.profile_pic || '', profile.id || '');
  });

  if (includeFallbackNames) {
    (Array.isArray(groupData) ? groupData : []).forEach((group) => {
      (Array.isArray(group.invited_people) ? group.invited_people : []).forEach((person) => {
        upsertMember(person);
      });
    });

    (Array.isArray(messageData) ? messageData : []).forEach((message) => {
      upsertMember(message.sender_name || '');
    });
  }

  upsertMember(myProfileName || currentUser?.email || '');

  return [...membersByName.values()]
    .filter((profile) => profile.name)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

let lastProfilesRefreshAt = 0;

async function refreshProfilesDirectoryOnly(force = false) {
  if (!currentUser) return false;
  if (!force && Date.now() - lastProfilesRefreshAt < 5000) return false;
  lastProfilesRefreshAt = Date.now();

  let profileData = [];
  try {
    const { data: rawProfiles, error: profilesError } = await sb.from('profiles').select('id, name, profile_pic');
    if (profilesError) {
      console.error('Error loading profiles:', profilesError);
      return false;
    }
    profileData = rawProfiles || [];
  } catch (error) {
    console.error('Error loading profiles:', error);
    return false;
  }

  const groupData = Array.isArray(groups) ? groups : [];
  const messageData = groupData.flatMap((group) => Array.isArray(group.messages) ? group.messages : []);

  memberProfiles = mergeKnownMembers(profileData, groupData, messageData, true);
  memberDirectory = memberProfiles.map((profile) => profile.name);

  const currentProfile = profileData.find((profile) => profile.id === currentUser.id);
  if (currentProfile) {
    myProfileName = currentProfile.name || currentUser.email || 'You';
    myProfilePic = currentProfile.profile_pic || '';
    localStorage.setItem(PROFILE_NAME_KEY, myProfileName);
    localStorage.setItem(PROFILE_PIC_KEY, myProfilePic);
  } else {
    myProfileName = currentUser.email || 'You';
    myProfilePic = '';
    localStorage.setItem(PROFILE_NAME_KEY, myProfileName);
    localStorage.setItem(PROFILE_PIC_KEY, myProfilePic);
  }

  if (typeof refreshCurrentUserDisplay === 'function') refreshCurrentUserDisplay();
  if (typeof refreshCurrentProfileModalAvatar === 'function') refreshCurrentProfileModalAvatar();
  if (typeof updateProfilePreview === 'function') updateProfilePreview();

  return true;
}

function ensureProfileRealtimeSync() {
  if (profileRealtimeChannel || !sb?.channel) return;

  profileRealtimeChannel = sb
    .channel('profiles-live-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      async () => {
        const ok = await refreshProfilesDirectoryOnly();
        if (!ok) return;
        if (typeof renderGroups === 'function') renderGroups();
      }
    )
    .subscribe();
}

function ensureProfileSyncHeartbeat() {
  if (profileSyncHeartbeatId) return;

  // Realtime dækker det meste; opslaget her er kun en sikkerhedsnet-opdatering.
  profileSyncHeartbeatId = setInterval(async () => {
    if (!currentUser) return;
    if (document.visibilityState !== 'visible') return;
    const ok = await refreshProfilesDirectoryOnly();
    if (!ok) return;
    if (typeof renderGroups === 'function') renderGroups();
  }, 300000);
}

let communityRefreshTimer = null;
let lastCommunityRefreshAt = 0;
const COMMUNITY_REFRESH_MIN_GAP_MS = 4000;

function scheduleCommunityRefresh() {
  if (communityRefreshTimer) return;
  const elapsed = Date.now() - lastCommunityRefreshAt;
  const wait = Math.max(500, COMMUNITY_REFRESH_MIN_GAP_MS - elapsed);
  communityRefreshTimer = setTimeout(async () => {
    communityRefreshTimer = null;
    await refreshCommunityData();
    if (typeof renderGroups === 'function') renderGroups();
    if (typeof updateGroupsBadge === 'function') updateGroupsBadge();
  }, wait);
}

function ensureCommunityRealtimeSync() {
  if (communityRealtimeChannel || !sb?.channel) return;

  communityRealtimeChannel = sb
    .channel('community-live-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, scheduleCommunityRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, scheduleCommunityRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: POST_COMMENTS_TABLE }, scheduleCommunityRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: POST_NOTIFICATIONS_TABLE }, scheduleCommunityRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'membership_requests' }, scheduleCommunityRefresh)
    .subscribe();
}

let communityRefreshInFlight = null;

async function refreshCommunityData() {
  if (!currentUser) return;
  if (communityRefreshInFlight) return communityRefreshInFlight;
  communityRefreshInFlight = performCommunityRefresh().finally(() => {
    communityRefreshInFlight = null;
    lastCommunityRefreshAt = Date.now();
  });
  return communityRefreshInFlight;
}

let postCommentsLoadError = null;
let communityPostsLoadError = null;

async function performCommunityRefresh() {
  let profileData = [];
  let profilesLoaded = false;
  let groupsData = [];
  let messagesData = [];
  communityPostsLoadError = null;

  try {
    await ensureCommunityGroup();
    const { data, error } = await sb
      .from('groups')
      .select('id, name, invited_people')
      .eq('id', COMMUNITY_GROUP_ID);
    if (error) {
      console.error('Error loading groups:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        raw: error
      });
    } else {
      groupsData = data || [];
    }
  } catch (error) {
    console.error('Error loading community group:', error);
  }

  try {
    const { data, error } = await sb
      .from('messages')
      .select('id, group_id, sender_name, author_id, text, image, link, link_label, created_at')
      .eq('group_id', COMMUNITY_GROUP_ID)
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) {
      communityPostsLoadError = error;
      console.error('Error loading messages:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        raw: error
      });
    } else {
      messagesData = data || [];
    }
  } catch (error) {
    communityPostsLoadError = error;
    console.error('Error loading messages:', {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
      raw: error
    });
  }

  const postIds = messagesData.map((message) => message.id).filter(Boolean);
  let commentsByPost = new Map();
  postCommentsLoadError = null;
  if (postIds.length > 0) {
    try {
      const { data, error } = await sb
        .from(POST_COMMENTS_TABLE)
        .select('id, post_id, user_id, sender_name, text, created_at')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });
      if (error) throw error;
      (data || []).forEach((comment) => {
        if (!commentsByPost.has(comment.post_id)) commentsByPost.set(comment.post_id, []);
        commentsByPost.get(comment.post_id).push({
          id: comment.id,
          userId: comment.user_id,
          sender: comment.sender_name || 'You',
          text: comment.text || '',
          createdAt: new Date(comment.created_at).getTime()
        });
      });
    } catch (error) {
      postCommentsLoadError = error;
      console.error('Error loading post comments. Run the Supabase setup in supabase/post-comments.sql:', error);
    }
  }

  const messagesByGroup = new Map();
  messagesData.forEach((message) => {
    const key = message.group_id;
    if (!messagesByGroup.has(key)) messagesByGroup.set(key, []);
    messagesByGroup.get(key).push({
      id: message.id,
      authorId: message.author_id || '',
      sender: message.sender_name || 'You',
      text: message.text || '',
      image: message.image || '',
      link: message.link || '',
      linkLabel: message.link_label || '',
      createdAt: new Date(message.created_at).getTime(),
      comments: commentsByPost.get(message.id) || []
    });
  });

  const communityGroup = groupsData.find((group) => group.id === COMMUNITY_GROUP_ID);
  groups = [{
    id: COMMUNITY_GROUP_ID,
    name: COMMUNITY_GROUP_NAME,
    invitedPeople: communityGroup?.invited_people || [],
    messages: messagesByGroup.get(COMMUNITY_GROUP_ID) || []
  }];

  if (isAdminUser()) {
    try {
      const { data: rData, error: requestsError } = await sb.from('membership_requests').select('*');
      if (requestsError) {
        console.error('Error loading membership requests:', {
          message: requestsError?.message,
          details: requestsError?.details,
          hint: requestsError?.hint,
          code: requestsError?.code,
          raw: requestsError
        });
        membershipRequests = [];
      } else {
        const approvedNames = new Set(
          groups
            .flatMap((group) => group.invitedPeople || [])
            .map((name) => String(name || '').trim().toLowerCase())
            .filter(Boolean)
        );
        membershipRequests = (rData || []).map(r => ({
          id: r.id,
          name: r.name,
          email: r.email || '',
          createdAt: new Date(r.created_at).getTime()
        })).filter((request) => {
          const normalizedName = String(request.name || '').trim().toLowerCase();
          return normalizedName && !approvedNames.has(normalizedName);
        });
      }
    } catch (error) {
      console.error('Error loading membership requests:', error);
      membershipRequests = [];
    }
  } else {
    membershipRequests = [];
  }

  await refreshCommunityNotifications();

  try {
    const { data: rawProfiles, error: profilesError } = await sb.from('profiles').select('id, name, profile_pic');
    if (profilesError) {
      console.error('Error loading profiles:', {
        message: profilesError?.message,
        details: profilesError?.details,
        hint: profilesError?.hint,
        code: profilesError?.code,
        raw: profilesError
      });
    } else {
      profileData = rawProfiles || [];
      profilesLoaded = true;
    }
  } catch (error) {
    console.error('Error loading profiles:', {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
      raw: error
    });
  }

  memberProfiles = mergeKnownMembers(profileData, groupsData, messagesData, true);
  memberDirectory = memberProfiles.map((profile) => profile.name);

  const currentProfile = profileData.find((profile) => profile.id === currentUser.id);
  if (currentProfile) {
    myProfileName = currentProfile.name || currentUser.email || 'You';
    myProfilePic = currentProfile.profile_pic || '';
    localStorage.setItem(PROFILE_NAME_KEY, myProfileName);
    localStorage.setItem(PROFILE_PIC_KEY, myProfilePic);
  } else {
    myProfileName = currentUser.email || 'You';
    myProfilePic = '';
    localStorage.setItem(PROFILE_NAME_KEY, myProfileName);
    localStorage.setItem(PROFILE_PIC_KEY, myProfilePic);
  }

  if (typeof refreshCurrentUserDisplay === 'function') refreshCurrentUserDisplay();
  if (typeof refreshCurrentProfileModalAvatar === 'function') refreshCurrentProfileModalAvatar();
  if (typeof updateProfilePreview === 'function') updateProfilePreview();

  if (profilesLoaded && canManageAdminProfile()) {
    await cleanupDeletedProfilesFromGroups(profileData);
  }

  normalizeGroups();
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
    if (!currentUser?.id) throw new Error('You must be signed in to publish a community post.');
    const { data, error } = await sb.from('messages').insert({
      id: message.id,
      group_id: COMMUNITY_GROUP_ID,
      author_id: currentUser.id,
      sender_name: message.sender || 'You',
      text: message.text || '',
      image: message.image || '',
      link: message.link || '',
      link_label: message.linkLabel || '',
      created_at: new Date(message.createdAt).toISOString()
    }).select('id').single();
    if (error) throw error;
    if (!data?.id) throw new Error('Supabase did not confirm that the community post was saved.');
    return true;
  } catch (error) {
    console.error('Error saving community post:', error);
    return false;
  }
}

async function savePostComment(postId, text) {
  const { data, error } = await sb
    .from(POST_COMMENTS_TABLE)
    .insert({
      post_id: postId,
      user_id: currentUser.id,
      sender_name: myProfileName || currentUser.email || 'You',
      text: text.trim()
    })
    .select('id, post_id, user_id, sender_name, text, created_at')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    userId: data.user_id,
    sender: data.sender_name || 'You',
    text: data.text,
    createdAt: new Date(data.created_at).getTime()
  };
}

async function updateMessageById(messageId, payload) {
  try {
    const { error } = await sb.from('messages').update(payload).eq('id', messageId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Error updating message:', e);
    return false;
  }
}

async function deleteMessageById(messageId) {
  try {
    const { error } = await sb.from('messages').delete().eq('id', messageId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Error deleting message:', e);
    return false;
  }
}

async function deleteGroupById(groupId) {
  try {
    const { error: messagesError } = await sb.from('messages').delete().eq('group_id', groupId);
    if (messagesError) throw messagesError;

    const { error: groupError } = await sb.from('groups').delete().eq('id', groupId);
    if (groupError) throw groupError;

    return true;
  } catch (error) {
    console.error('Error deleting group:', error);
    return false;
  }
}

function setActiveGroup(groupId) {
  activeGroupId = COMMUNITY_GROUP_ID;
  renderGroups();
}

function getActiveGroup() {
  return groups.find((group) => group.id === COMMUNITY_GROUP_ID) || null;
}
