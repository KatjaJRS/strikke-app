// ── Medlemsdata — anmodninger om optagelse ────────────────────────────────

const REVIEWED_MEMBERSHIP_REQUESTS_KEY = 'knitting-reviewed-membership-requests';
const COMMUNITY_GROUP_ID = 'group-community';
let reviewedMembershipRequestIds = new Set(JSON.parse(localStorage.getItem(REVIEWED_MEMBERSHIP_REQUESTS_KEY) || '[]'));

function saveReviewedMembershipRequests() {
  localStorage.setItem(REVIEWED_MEMBERSHIP_REQUESTS_KEY, JSON.stringify([...reviewedMembershipRequestIds]));
}

async function saveMembershipRequests() {}

async function acceptMember(id) {
  const req = membershipRequests.find(r => r.id === id);
  if (!req) return;
  const approvedName = String(req.name || '').trim();
  if (!approvedName) return;

  let communityGroup = groups.find((group) => group.id === COMMUNITY_GROUP_ID);
  if (!communityGroup) {
    communityGroup = {
      id: COMMUNITY_GROUP_ID,
      name: 'Fællesskab',
      invitedPeople: [],
      messages: []
    };
    groups = [...groups, communityGroup];
  }

  groups = groups.map((group) => {
    const invitedPeople = [...new Set([...(group.invitedPeople || []), approvedName])];
    return { ...group, invitedPeople };
  });

  for (const group of groups) {
    await sb.from('groups').upsert({
      id: group.id,
      name: group.name,
      invited_people: group.invitedPeople || []
    });
  }

  // Mark request as handled globally so admins do not need to re-approve.
  await sb.from('membership_requests').delete().eq('id', id);
  membershipRequests = membershipRequests.filter((request) => request.id !== id);

  reviewedMembershipRequestIds.add(id);
  saveReviewedMembershipRequests();
  await refreshCommunityData();
  renderGroups();
}

async function rejectMember(id) {
  await sb.from('membership_requests').delete().eq('id', id);
  membershipRequests = membershipRequests.filter((request) => request.id !== id);
  reviewedMembershipRequestIds.add(id);
  saveReviewedMembershipRequests();
  await refreshCommunityData();
  renderGroups();
}

// ── Anmodningsskema ───────────────────────────────────────────────────────
const joinRequestForm = document.getElementById('join-request-form');
const requestNameInput = document.getElementById('request-name-input');
const requestEmailInput = document.getElementById('request-email-input');

joinRequestForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = requestNameInput.value.trim();
  const email = requestEmailInput.value.trim();
  if (!name) return;

  const newRequest = { id: `req-${Date.now()}`, name, email, createdAt: Date.now() };
  try {
    await sb.from('membership_requests').insert({
      id: newRequest.id,
      name: newRequest.name,
      email: newRequest.email || '',
      created_at: new Date(newRequest.createdAt).toISOString()
    });
    membershipRequests.push(newRequest);
  } catch (e) { console.error('Error saving request:', e); }
  renderGroups();

  const subject = encodeURIComponent(`New membership request: ${name}`);
  const body = encodeURIComponent(`Hi,\n\nA new person wants to join Knitting My Day Away:\n\nName: ${name}\nEmail: ${email || '(not provided)'}\n\nPlease open the app to accept or reject this request.\n\nKnitting My Day Away`);
  window.location.href = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;

  joinRequestForm.reset();
  alert(translations[currentLanguage].requestSentMsg);
});
