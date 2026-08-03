// ── Medlemsdata — anmodninger om optagelse ────────────────────────────────

async function saveMembershipRequests() {}

async function acceptMember(id) {
  const req = membershipRequests.find(r => r.id === id);
  if (!req) return;
  if (groups.length > 0) {
    const g = groups[0];
    const newInvited = [...new Set([...g.invitedPeople, req.name])];
    groups = groups.map((gr, i) => i === 0 ? { ...gr, invitedPeople: newInvited } : gr);
    await sb.from('groups').update({ invited_people: newInvited }).eq('id', g.id);
  }
  await sb.from('membership_requests').delete().eq('id', id);
  membershipRequests = membershipRequests.filter(r => r.id !== id);
  renderGroups();
}

async function rejectMember(id) {
  await sb.from('membership_requests').delete().eq('id', id);
  membershipRequests = membershipRequests.filter(r => r.id !== id);
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
