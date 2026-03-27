/**
 * SETUP INSTRUCTIONS
 * ------------------
 * 1. Create a free project at https://supabase.com
 * 2. Run supabase-setup.sql in your project's SQL Editor
 * 3. Copy your Project URL and anon key from Settings > API
 * 4. Fill in the values below
 * 5. Deploy to GitHub Pages
 */

const CONFIG = Object.freeze({
  // --- Supabase credentials (safe to expose — protected by Row Level Security) ---
  SUPABASE_URL: 'https://twdrdmxpapucraosgayf.supabase.co',          // e.g. https://abcdefgh.supabase.co
  SUPABASE_ANON_KEY: 'sb_publishable_g1rLoiRa4GzhQfG-nidepA_h_mhYtGG', // starts with "eyJh..."

  // --- Map defaults ---
  DEFAULT_CENTER: [12.8797, 121.7740],  // [lat, lng] center on first load
  DEFAULT_ZOOM: 6,

  // --- Photo settings ---
  PHOTO_MAX_PX: 1200,     // resize longest edge to this many pixels
  PHOTO_QUALITY: 0.82,    // JPEG compression quality (0–1)
  PHOTO_MAX_BYTES: 25 * 1024 * 1024,  // reject originals > 25 MB before compression

  // --- Storage ---
  BUCKET: 'pantry-photos',

  // --- Moderation ---
  // false = submissions are held for manager approval (recommended)
  // true  = submissions appear on map immediately
  AUTO_APPROVE: false,

  // --- Manager dashboard (data.html) ---
  // This is client-side only — not a security boundary, just a lightweight gate.
  // Real data protection is handled by Supabase RLS.
  MANAGER_PASSWORD: 'weloveosm123',
});
