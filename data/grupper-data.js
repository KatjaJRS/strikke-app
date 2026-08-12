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
  if (!isAdminUser() || cleanupRunning) return;
  if (!Array.isArray(profileData) || profileData.length < 2) return;

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

async function refreshProfilesDirectoryOnly() {
  if (!currentUser) return false;

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

  const membersByName = new Map();
  const upsertMember = (name, profilePic = '', id = '') => {
    const normalizedName = String(name || '').trim();
    if (!normalizedName) return;
    const key = normalizedName.toLowerCase();
    if (!membersByName.has(key)) {
      membersByName.set(key, { id: id || '', name: normalizedName, profile_pic: profilePic || '' });
      return;
    }

    const existing = membersByName.get(key);
    if (!existing.id && id) existing.id = id;
    if (!existing.profile_pic && profilePic) existing.profile_pic = profilePic;
  };

  profileData.forEach((profile) => {
    upsertMember(profile.name, profile.profile_pic || '', profile.id || '');
  });

  upsertMember(myProfileName || currentUser?.email || '');

  memberProfiles = [...membersByName.values()]
    .filter((profile) => profile.name)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  memberDirectory = memberProfiles.map((profile) => profile.name);

  const currentProfile = profileData.find((profile) => profile.id === currentUser.id);
  if (currentProfile) {
    myProfileName = currentProfile.name || myProfileName;
    myProfilePic = currentProfile.profile_pic || myProfilePic;
    localStorage.setItem(PROFILE_NAME_KEY, myProfileName);
    localStorage.setItem(PROFILE_PIC_KEY, myProfilePic);
    if (typeof refreshCurrentUserDisplay === 'function') refreshCurrentUserDisplay();
    if (typeof refreshCurrentProfileModalAvatar === 'function') refreshCurrentProfileModalAvatar();
    if (typeof updateProfilePreview === 'function') updateProfilePreview();
  }

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

  profileSyncHeartbeatId = setInterval(async () => {
    if (!currentUser) return;
    const ok = await refreshProfilesDirectoryOnly();
    if (!ok) return;
    if (typeof renderGroups === 'function') renderGroups();
  }, 15000);
}

function ensureCommunityRealtimeSync() {
  if (communityRealtimeChannel || !sb?.channel) return;

  communityRealtimeChannel = sb
    .channel('community-live-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, async () => {
      await refreshCommunityData();
      if (typeof renderGroups === 'function') renderGroups();
      if (typeof updateGroupsBadge === 'function') updateGroupsBadge();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async () => {
      await refreshCommunityData();
      if (typeof renderGroups === 'function') renderGroups();
      if (typeof updateGroupsBadge === 'function') updateGroupsBadge();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'membership_requests' }, async () => {
      await refreshCommunityData();
      if (typeof renderGroups === 'function') renderGroups();
    })
    .subscribe();
}

async function refreshCommunityData() {
  if (!currentUser) return;
  let profileData = [];
  let profilesLoaded = false;
  let groupsData = [];
  let messagesData = [];

  try {
    const { data, error } = await sb.from('groups').select('id, name, invited_people');
    if (error) {
      console.error('Error loading groups:', error);
    } else {
      groupsData = data || [];
    }
  } catch (error) {
    console.error('Error loading groups:', error);
  }

  try {
    const { data, error } = await sb
      .from('messages')
      .select('id, group_id, sender_name, text, image, link, link_label, created_at')
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error loading messages:', error);
    } else {
      messagesData = data || [];
    }
  } catch (error) {
    console.error('Error loading messages:', error);
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
        console.error('Error loading membership requests:', requestsError);
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
      console.error('Error loading profiles:', profilesError);
    } else {
      profileData = rawProfiles || [];
      profilesLoaded = true;
    }
  } catch (error) {
    console.error('Error loading profiles:', error);
  }

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

  profileData.forEach((profile) => {
    upsertMember(profile.name, profile.profile_pic || '', profile.id || '');
  });

  // Only fall back to group/message names if profiles cannot be loaded at all.
  if (!profilesLoaded) {
    groupsData.forEach((group) => {
      (group.invited_people || []).forEach((name) => upsertMember(name));
    });

    messagesData.forEach((message) => {
      upsertMember(message.sender_name || '');
    });
  }

  upsertMember(myProfileName || currentUser?.email || '');

  memberProfiles = [...membersByName.values()]
    .filter((profile) => profile.name)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  memberDirectory = memberProfiles.map((profile) => profile.name);

  const currentProfile = profileData.find((profile) => profile.id === currentUser.id);
  if (currentProfile) {
    myProfileName = currentProfile.name || myProfileName;
    myProfilePic = currentProfile.profile_pic || myProfilePic;
    localStorage.setItem(PROFILE_NAME_KEY, myProfileName);
    localStorage.setItem(PROFILE_PIC_KEY, myProfilePic);
    if (typeof refreshCurrentUserDisplay === 'function') refreshCurrentUserDisplay();
    if (typeof refreshCurrentProfileModalAvatar === 'function') refreshCurrentProfileModalAvatar();
    if (typeof updateProfilePreview === 'function') updateProfilePreview();
  }

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
