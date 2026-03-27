/* ================================================================
   Community Pantry Map — App Logic
================================================================ */

'use strict';

// ---- Module state ----
// "db" holds the Supabase client instance.
// window.supabase is the CDN global (the library itself).
let db, map, markerLayer;
let pendingLat = null, pendingLng = null;
let pendingMarker = null;
let pendingPhotoBlob = null;
let pendingPickHandler = null;   // stored so we can remove it on cancel
let toastTimer = null;

// ---- Entry point ----
document.addEventListener('DOMContentLoaded', () => {
  if (!validateConfig()) return;

  const { createClient } = window.supabase;
  db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

  initMap();
  loadPantries();
  subscribeRealtime();
  setupUI();
});

// ---- Config guard ----
function validateConfig() {
  if (
    CONFIG.SUPABASE_URL.startsWith('YOUR_') ||
    CONFIG.SUPABASE_ANON_KEY.startsWith('YOUR_')
  ) {
    document.body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  height:100vh;font-family:sans-serif;text-align:center;padding:24px;">
        <div style="font-size:48px;margin-bottom:16px;">🧺</div>
        <h2 style="margin-bottom:8px;">Setup required</h2>
        <p style="color:#666;max-width:380px;">
          Open <strong>js/config.js</strong> and fill in your
          <strong>SUPABASE_URL</strong> and <strong>SUPABASE_ANON_KEY</strong>.
          Then run <strong>supabase-setup.sql</strong> in your Supabase SQL editor.
        </p>
      </div>`;
    return false;
  }
  return true;
}

// ================================================================
//  MAP
// ================================================================

function initMap() {
  map = L.map('map', {
    center: CONFIG.DEFAULT_CENTER,
    zoom: CONFIG.DEFAULT_ZOOM,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  markerLayer = L.markerClusterGroup({ maxClusterRadius: 40 }).addTo(map);
}

async function loadPantries() {
  const { data, error } = await db
    .from('pantries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load pantries:', error.message);
    showToast('Could not load pantry data.', 'error');
    return;
  }

  data.forEach(addPantryMarker);
}

function addPantryMarker(pantry) {
  const pinClass = pantry.approved ? 'pantry-pin verified' : 'pantry-pin pending-pin';
  const icon = L.divIcon({
    html: `<div class="${pinClass}">🧺</div>`,
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -22],
  });

  const marker = L.marker([pantry.lat, pantry.lng], { icon });
  marker.bindPopup(() => buildPopup(pantry), {
    maxWidth: 280,
    className: 'pantry-popup',
  });
  markerLayer.addLayer(marker);
}

function buildPopup(pantry) {
  const wrap = document.createElement('div');

  if (pantry.photo_url) {
    const img = document.createElement('img');
    img.className = 'popup-photo';
    img.src = pantry.photo_url;
    img.alt = pantry.name;
    img.loading = 'lazy';
    wrap.appendChild(img);
  }

  const body = document.createElement('div');
  body.className = 'popup-body';

  const h3 = document.createElement('h3');
  h3.className = 'popup-name';
  h3.textContent = pantry.name;  // textContent prevents XSS
  body.appendChild(h3);

  if (pantry.contact_name) {
    const p = document.createElement('p');
    p.className = 'popup-row';
    p.textContent = '👤 ' + pantry.contact_name;
    body.appendChild(p);
  }

  if (pantry.contact_phone) {
    const p = document.createElement('p');
    p.className = 'popup-row';
    const a = document.createElement('a');
    a.href = 'tel:' + pantry.contact_phone;
    a.textContent = pantry.contact_phone;
    p.appendChild(document.createTextNode('📞 '));
    p.appendChild(a);
    body.appendChild(p);
  }

  if (pantry.url) {
    const safeUrl = /^https?:\/\//i.test(pantry.url)
      ? pantry.url
      : 'https://' + pantry.url;
    const p = document.createElement('p');
    p.className = 'popup-row';
    const a = document.createElement('a');
    a.href = safeUrl;
    a.textContent = 'Visit page';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    p.appendChild(document.createTextNode('🔗 '));
    p.appendChild(a);
    body.appendChild(p);
  }

  const statusRow = document.createElement('p');
  statusRow.className = 'popup-row';
  const badge = document.createElement('span');
  badge.className = pantry.approved ? 'popup-badge verified' : 'popup-badge pending-badge';
  badge.textContent = pantry.approved ? '✓ Verified' : '⏳ Pending verification';
  statusRow.appendChild(badge);
  body.appendChild(statusRow);

  const date = document.createElement('p');
  date.className = 'popup-date';
  date.textContent = 'Added ' + formatDate(pantry.created_at);
  body.appendChild(date);

  wrap.appendChild(body);
  return wrap;
}

// ================================================================
//  REALTIME
// ================================================================

function subscribeRealtime() {
  db
    .channel('pantries-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'pantries' },
      (payload) => {
        // Only add to map if approved (or auto-approve is on)
        if (payload.new && (payload.new.approved || CONFIG.AUTO_APPROVE)) {
          addPantryMarker(payload.new);
        }
      }
    )
    .subscribe();
}

// ================================================================
//  UI — panels, buttons, form
// ================================================================

function setupUI() {
  // FAB
  document.getElementById('btn-add').addEventListener('click', openPanel);

  // Panel close buttons
  document.getElementById('btn-close-panel').addEventListener('click', closePanel);
  document.getElementById('btn-cancel').addEventListener('click', closePanel);

  // Location buttons
  document.getElementById('btn-pick-map').addEventListener('click', startPickMode);
  document.getElementById('btn-pick-cancel').addEventListener('click', cancelPickMode);
  document.getElementById('btn-gps').addEventListener('click', useGPS);

  // Photo
  document.getElementById('f-photo').addEventListener('change', handlePhotoChange);
  document.getElementById('btn-clear-photo').addEventListener('click', clearPhoto);

  // Form submit
  document.getElementById('pantry-form').addEventListener('submit', handleSubmit);

  // Swipe-to-dismiss (mobile bottom sheet)
  setupSwipeToDismiss();
}

// ---- Panel open / close ----

function openPanel() {
  const panel = document.getElementById('panel');
  panel.classList.remove('hidden');
  // Small delay so the CSS transition fires after display:block kicks in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      panel.classList.add('open');
      document.body.classList.add('panel-open');
    });
  });
}

function closePanel() {
  const panel = document.getElementById('panel');
  panel.classList.remove('open');
  document.body.classList.remove('panel-open');
  resetForm();
  setTimeout(() => panel.classList.add('hidden'), 320);
}

function resetForm() {
  document.getElementById('pantry-form').reset();
  pendingLat = null;
  pendingLng = null;
  pendingPhotoBlob = null;

  if (pendingMarker) {
    map.removeLayer(pendingMarker);
    pendingMarker = null;
  }

  const locDisplay = document.getElementById('location-display');
  locDisplay.textContent = 'No location set';
  locDisplay.classList.remove('has-location');

  document.getElementById('photo-preview-wrap').classList.add('hidden');
  document.getElementById('photo-preview').src = '';
  hideFormError();
}

// ---- Pick mode ----

function startPickMode() {
  // Hide the panel while user picks on map
  const panel = document.getElementById('panel');
  panel.classList.remove('open');
  document.body.classList.remove('panel-open');

  // Show crosshair + instruction
  document.getElementById('crosshair').classList.remove('hidden');
  map.getContainer().classList.add('picking-mode');

  // Register a named handler so we can remove it on cancel
  pendingPickHandler = (e) => {
    setLocation(e.latlng.lat, e.latlng.lng);
    exitPickMode();
    openPanel();
  };
  map.once('click', pendingPickHandler);
}

function cancelPickMode() {
  // Remove the listener if user cancels without picking
  if (pendingPickHandler) {
    map.off('click', pendingPickHandler);
    pendingPickHandler = null;
  }
  exitPickMode();
}

function exitPickMode() {
  document.getElementById('crosshair').classList.add('hidden');
  map.getContainer().classList.remove('picking-mode');
}

// ---- GPS ----

function useGPS() {
  if (!navigator.geolocation) {
    showFormError('Geolocation is not supported by your browser.');
    return;
  }

  const btn = document.getElementById('btn-gps');
  btn.disabled = true;
  btn.textContent = '⏳ Getting location…';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setLocation(pos.coords.latitude, pos.coords.longitude);
      map.setView([pos.coords.latitude, pos.coords.longitude], 16);
      btn.disabled = false;
      btn.textContent = '📍 Use GPS';
    },
    () => {
      showFormError('Could not get your location. Try "Pick on map" instead.');
      btn.disabled = false;
      btn.textContent = '📍 Use GPS';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// ---- Set location ----

function setLocation(lat, lng) {
  pendingLat = lat;
  pendingLng = lng;

  const locDisplay = document.getElementById('location-display');
  locDisplay.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  locDisplay.classList.add('has-location');

  // Drop a visual pin on the map
  if (pendingMarker) map.removeLayer(pendingMarker);

  const icon = L.divIcon({
    html: '<div class="pantry-pin pending">📍</div>',
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -36],
  });

  pendingMarker = L.marker([lat, lng], { icon }).addTo(map);
}

// ================================================================
//  PHOTO
// ================================================================

function handlePhotoChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > CONFIG.PHOTO_MAX_BYTES) {
    showFormError(`Photo is too large (max ${CONFIG.PHOTO_MAX_BYTES / 1024 / 1024} MB). Please choose a smaller image.`);
    e.target.value = '';
    return;
  }

  hideFormError();
  compressImage(file).then((blob) => {
    pendingPhotoBlob = blob;
    const url = URL.createObjectURL(blob);
    const preview = document.getElementById('photo-preview');
    preview.onload = () => URL.revokeObjectURL(url);
    preview.src = url;
    document.getElementById('photo-preview-wrap').classList.remove('hidden');
    document.getElementById('photo-label').style.display = 'none';
  });
}

function clearPhoto() {
  pendingPhotoBlob = null;
  document.getElementById('f-photo').value = '';
  document.getElementById('photo-preview').src = '';
  document.getElementById('photo-preview-wrap').classList.add('hidden');
  document.getElementById('photo-label').style.display = '';
}

async function compressImage(file) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const maxPx = CONFIG.PHOTO_MAX_PX;
      const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);

      const quality = CONFIG.PHOTO_QUALITY;

      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob(resolve, 'image/jpeg', quality);
      } else {
        // Fallback for older Android WebViews
        resolve(dataURLtoBlob(canvas.toDataURL('image/jpeg', quality)));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // upload original if compression fails
    };

    img.src = objectUrl;
  });
}

function dataURLtoBlob(dataURL) {
  const [header, data] = dataURL.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(data);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ================================================================
//  SUBMIT
// ================================================================

async function handleSubmit(e) {
  e.preventDefault();
  hideFormError();

  const form = document.getElementById('pantry-form');
  const name = form.elements['name'].value.trim();

  // Validate
  if (!pendingLat || !pendingLng) {
    showFormError('Please set a location first — tap "Pick on map" or "Use GPS".');
    return;
  }
  if (!name) {
    showFormError('Pantry name is required.');
    form.elements['name'].focus();
    return;
  }

  const btn = document.getElementById('btn-submit');
  btn.disabled = true;
  btn.textContent = 'Submitting…';

  let photoPath = null;
  let photoUrl = null;

  try {
    // 1. Upload photo (if selected)
    if (pendingPhotoBlob) {
      photoPath = crypto.randomUUID() + '/photo.jpg';

      const { error: uploadErr } = await db.storage
        .from(CONFIG.BUCKET)
        .upload(photoPath, pendingPhotoBlob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = db.storage
        .from(CONFIG.BUCKET)
        .getPublicUrl(photoPath);
      photoUrl = urlData.publicUrl;
    }

    // 2. Insert row
    const row = {
      name,
      lat: pendingLat,
      lng: pendingLng,
      contact_name:  form.elements['contact_name'].value.trim() || null,
      contact_phone: form.elements['contact_phone'].value.trim() || null,
      url:           form.elements['url'].value.trim() || null,
      photo_path:    photoPath,
      photo_url:     photoUrl,
      approved:      CONFIG.AUTO_APPROVE,
    };

    const { error: insertErr } = await db.from('pantries').insert(row);

    if (insertErr) {
      // Rollback: delete orphaned photo if insert failed
      if (photoPath) {
        await db.storage.from(CONFIG.BUCKET).remove([photoPath]);
      }
      throw insertErr;
    }

    // 3. Success
    closePanel();
    showToast(
      '🎉 Pantry added to the map!',
      'success'
    );

  } catch (err) {
    console.error('Submit failed:', err);
    showFormError('Submission failed. Please check your connection and try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Pantry';
  }
}

// ================================================================
//  SWIPE TO DISMISS (mobile bottom sheet)
// ================================================================

function setupSwipeToDismiss() {
  const panel  = document.getElementById('panel');
  const handle = document.getElementById('panel-handle');
  let startY = 0;
  let dragging = false;

  handle.addEventListener('touchstart', (e) => {
    startY   = e.touches[0].clientY;
    dragging = true;
    panel.style.transition = 'none';  // disable transition while dragging
  }, { passive: true });

  handle.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) panel.style.transform = `translateY(${dy}px)`;
  }, { passive: true });

  handle.addEventListener('touchend', (e) => {
    if (!dragging) return;
    dragging = false;
    panel.style.transition = '';  // re-enable transition

    const dy = e.changedTouches[0].clientY - startY;
    if (dy > 80) {
      panel.style.transform = '';
      closePanel();
    } else {
      panel.style.transform = '';  // snap back
    }
  }, { passive: true });
}

// ================================================================
//  HELPERS
// ================================================================

function showFormError(msg) {
  const el = document.getElementById('form-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideFormError() {
  document.getElementById('form-error').classList.add('hidden');
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast toast-${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = 'toast hidden';
  }, 4500);
}

function formatDate(str) {
  return new Date(str).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
