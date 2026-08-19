// ── Billeder — uploades til Supabase Storage i stedet for databasen ───────
// Tidligere blev billeder gemt som base64 direkte i tabellerne, hvilket gjorde
// hver hentning meget tung. Nu gemmes kun en URL.

const IMAGE_BUCKET = 'app-images';
let imageStorageAvailable = true;
let storageWarningShown = false;

function isStorageUnavailableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('bucket not found') || message.includes('not found') || message.includes('404');
}

function handleStorageUnavailable(error) {
  imageStorageAvailable = false;
  if (storageWarningShown) return;
  storageWarningShown = true;
  console.warn(
    `Storage-bucket "${IMAGE_BUCKET}" mangler i Supabase. Billeder gemmes derfor stadig direkte i databasen.`,
    error
  );
}

function dataURLToBlob(dataUrl) {
  const [header, base64] = String(dataUrl).split(',');
  const contentType = (header.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const binary = atob(base64 || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

async function uploadImageDataURL(dataUrl, folder) {
  if (!dataUrl || !String(dataUrl).startsWith('data:')) return dataUrl || '';
  if (!currentUser || !imageStorageAvailable) return dataUrl;

  try {
    const blob = dataURLToBlob(dataUrl);
    const extension = blob.type === 'image/png' ? 'png' : 'jpg';
    const path = `${currentUser.id}/${folder}/${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`;

    const { error } = await sb.storage
      .from(IMAGE_BUCKET)
      .upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
    if (error) throw error;

    const { data } = sb.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    return data?.publicUrl || dataUrl;
  } catch (error) {
    if (isStorageUnavailableError(error)) handleStorageUnavailable(error);
    else console.error('Image upload failed:', error);
    return dataUrl;
  }
}

// Læser, komprimerer og uploader en valgt fil. Returnerer en URL.
async function storeImageFile(file, folder) {
  if (!file) return '';
  const dataUrl = await readImageAsDataURL(file);
  if (!dataUrl) return '';
  return uploadImageDataURL(dataUrl, folder);
}

// ── Flyt gamle base64-billeder op i Storage ──────────────────────────────
let legacyImageMigrationDone = false;

async function migrateLegacyImagesToStorage() {
  if (!currentUser || !imageStorageAvailable || legacyImageMigrationDone) return;
  legacyImageMigrationDone = true;

  let projectsChanged = false;
  for (const project of projects) {
    if (typeof project.image === 'string' && project.image.startsWith('data:')) {
      const url = await uploadImageDataURL(project.image, 'projects');
      if (url && url !== project.image) {
        project.image = url;
        projectsChanged = true;
      }
    }
  }
  if (projectsChanged) await saveProjects({ showBusy: false });

  if (typeof myProfilePic === 'string' && myProfilePic.startsWith('data:')) {
    const url = await uploadImageDataURL(myProfilePic, 'profile');
    if (url && url !== myProfilePic) {
      myProfilePic = url;
      localStorage.setItem(PROFILE_PIC_KEY, url);
      try {
        await sb.from('profiles').upsert({ id: currentUser.id, name: myProfileName || '', profile_pic: url });
      } catch (error) {
        console.error('Could not save migrated profile picture:', error);
      }
      if (typeof refreshCurrentUserDisplay === 'function') refreshCurrentUserDisplay();
      if (typeof updateProfilePreview === 'function') updateProfilePreview();
    }
  }

  const heroImageValue = localStorage.getItem(HERO_IMAGE_KEY) || '';
  if (heroImageValue.startsWith('data:')) {
    const url = await uploadImageDataURL(heroImageValue, 'hero');
    if (url && url !== heroImageValue) {
      localStorage.setItem(HERO_IMAGE_KEY, url);
      if (typeof applyHeroImageFromStorage === 'function') applyHeroImageFromStorage();
      if (typeof queueSettingsSync === 'function') queueSettingsSync();
    }
  }
}
