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

async function refreshCommunityData() {
  if (!currentUser) return;
  try {
    const { data: gData } = await sb.from('groups').select('*, messages(*)');
    groups = (gData || []).map(g => ({
      id: g.id,
      name: g.name,
      invitedPeople: g.invited_people || [],
      messages: (g.messages || [])
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map(m => ({
          id: m.id,
          sender: m.sender_name || 'You',
          text: m.text || '',
          image: m.image || '',
          link: m.link || '',
          linkLabel: m.link_label || '',
          createdAt: new Date(m.created_at).getTime()
        }))
    }));

    if (isAdminUser()) {
      const { data: rData } = await sb.from('membership_requests').select('*');
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
    } else {
      membershipRequests = [];
    }

    const { data: profileData } = await sb.from('profiles').select('id, name, profile_pic');
    memberProfiles = (profileData || [])
      .map((p) => ({
        id: p.id,
        name: String(p.name || '').trim(),
        profile_pic: p.profile_pic || ''
      }))
      .filter((profile) => profile.name)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    memberDirectory = memberProfiles.map((profile) => profile.name);

    const currentProfile = (profileData || []).find((p) => p.id === currentUser.id);
    if (currentProfile) {
      myProfileName = currentProfile.name || myProfileName;
      myProfilePic = currentProfile.profile_pic || myProfilePic;
      localStorage.setItem(PROFILE_NAME_KEY, myProfileName);
      localStorage.setItem(PROFILE_PIC_KEY, myProfilePic);
      if (typeof refreshCurrentUserDisplay === 'function') refreshCurrentUserDisplay();
      if (typeof refreshCurrentProfileModalAvatar === 'function') refreshCurrentProfileModalAvatar();
      if (typeof updateProfilePreview === 'function') updateProfilePreview();
    }

    normalizeGroups();
  } catch (e) {
    console.error('Error refreshing community data:', e);
  }
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
