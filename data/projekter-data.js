// ── Projektdata — gem og hent fra Supabase ────────────────────────────────

function createProjectId() {
  return `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeProjects() {
  projects = projects.map((project, index) => {
    const yarns = (project.yarns || []).slice(0, 3);
    while (yarns.length < 3) yarns.push({ type: '', color: '', amount: '' });
    let needles = project.needles || [];
    if (typeof project.needleSize === 'string' && project.needleSize && needles.length === 0) {
      needles = [project.needleSize];
    }
    return {
      ...project,
      id: project.id || createProjectId(),
      lastViewedAt: project.lastViewedAt || 0,
      needles,
      patternLink: project.patternLink || '',
      rating: Number(project.rating) || 0,
      difficulty: Number(project.difficulty) || 0,
      yarns: yarns.map(yarn => ({
        type: yarn.type || '',
        color: yarn.color || '',
        amount: yarn.amount || '',
      })),
      image: project.image || '',
    };
  });
}

async function saveProjects() {
  if (!currentUser) return true;
  try {
    await sb.from('profiles').upsert({
      id: currentUser.id,
      name: myProfileName || currentUser.email || 'User',
      profile_pic: myProfilePic || ''
    });

    const { error } = await sb.from('projects').upsert(
      projects.map(p => ({
        id: p.id,
        user_id: currentUser.id,
        name: p.name,
        pattern: p.pattern || '',
        status: p.status || 'Planning',
        notes: p.notes || '',
        pattern_link: p.patternLink || '',
        needles: p.needles || [],
        yarns: p.yarns || [],
        rating: p.rating || 0,
        difficulty: p.difficulty || 0,
        image: p.image || '',
        last_viewed_at: p.lastViewedAt || 0
      }))
    );
    if (error) console.warn('Projects upsert warning:', error.message);
    return true;
  } catch (e) {
    console.error('Error saving projects:', e);
    return false;
  }
}
