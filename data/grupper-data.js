// ── Gruppedata — gem og hent fra Supabase ─────────────────────────────────

function normalizeGroups() {
  groups = (Array.isArray(groups) ? groups : []).map((group) => ({
    id: group.id || `group-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: group.name || 'Pattern circle',
    invitedPeople: Array.isArray(group.invitedPeople) ? group.invitedPeople : [],
    messages: Array.isArray(group.messages) ? group.messages : [],
  }));

  if (groups.length === 0) { groups = []; activeGroupId = null; }

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
    group.messages.forEach((msg) => { if (msg.createdAt > groupsLastRead) unread++; });
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

async function refreshProfilesDirectoryOnly() {
  if (!currentUser) return false;
  if (Date.now() - lastProfilesRefreshAt < 5000) return false;
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

  memberProfiles = mergeKnownMembers(profileData, groupData, messageData, false);
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

async function performCommunityRefresh() {
  let profileData = [];
  let profilesLoaded = false;
  let groupsData = [];
  let messagesData = [];

  try {
    const { data, error } = await sb.from('groups').select('id, name, invited_people');
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
    console.error('Error loading groups:', {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
      raw: error
    });
  }

  try {
    const { data, error } = await sb
      .from('messages')
      .select('id, group_id, sender_name, text, image, link, link_label, created_at')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) {
      console.error('Error loading messages:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        raw: error
      });
    } else {
      messagesData = (data || []).slice().reverse();
    }
  } catch (error) {
    console.error('Error loading messages:', {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
      raw: error
    });
  }

  const messagesByGroup = new Map();
  messagesData.forEach((message) => {
    const key = message.group_id;
    if (!messagesByGroup.has(key)) messagesByGroup.set(key, []);
    messagesByGroup.get(key).push({
      id: message.id,
      sender: message.sender_name || 'You',
      text: message.text || '',
      image: message.image || '',
      link: message.link || '',
      linkLabel: message.link_label || '',
      createdAt: new Date(message.created_at).getTime()
    });
  });

  if (groupsData.length > 0) {
    groups = groupsData.map((group) => ({
      id: group.id,
      name: group.name,
      invitedPeople: group.invited_people || [],
      messages: messagesByGroup.get(group.id) || []
    }));
  }

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

  memberProfiles = mergeKnownMembers(profileData, groupsData, messagesData, !profilesLoaded);
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

  if (profilesLoaded) {
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
    await sb.from('messages').insert({
      id: message.id,
      group_id: groupId,
      sender_name: message.sender || 'You',
      text: message.text || '',
      image: message.image || '',
      link: message.link || '',
      link_label: message.linkLabel || '',
      created_at: new Date(message.createdAt).toISOString()
    });
  } catch (e) { console.error('Error saving message:', e); }
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
  activeGroupId = groupId;
  const params = new URLSearchParams(window.location.search);
  params.set(GROUP_QUERY_PARAM, groupId);
  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  renderGroups();
}

function getActiveGroup() {
  return groups.find((group) => group.id === activeGroupId) || groups[0] || null;
}
