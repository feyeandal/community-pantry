# 🧺 Community Pantry Map

A serverless, crowdsourced web map for locating and sharing community pantries. Anyone can add a pantry — no account needed. Managers can verify submissions for eventual addition to OpenStreetMap.

**Live map:** https://upri-noah.github.io/community-pantry-ph/

---

## Features

- 📍 Add a community pantry with location, name, contact info, photo, and website/Facebook
- 🗺️ OpenStreetMap basemap with marker clustering
- 📷 Auto-compresses photos before upload (handles large Apple/Android photos)
- ⚡ Real-time updates — new pantries appear on the map instantly
- 🟢 Grey marker = pending verification, Green marker = verified by manager
- 🔒 Manager dashboard to review, approve, and export submissions

---

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS + [Leaflet.js](https://leafletjs.com)
- **Backend:** [Supabase](https://supabase.com) (PostgreSQL + Storage + Realtime)
- **Hosting:** GitHub Pages (fully static, no server needed)

---

## Setup

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of [`supabase-setup.sql`](supabase-setup.sql)
3. Go to **Settings → API** and copy your **Project URL** and **anon/public key**

### 2. Configure

Edit `js/config.js`:

```js
SUPABASE_URL: 'https://your-project.supabase.co',
SUPABASE_ANON_KEY: 'your-anon-key',
DEFAULT_CENTER: [14.5995, 120.9842],  // [lat, lng]
DEFAULT_ZOOM: 6,
MANAGER_PASSWORD: 'your-password',
```

### 3. Deploy

Push to GitHub and enable GitHub Pages:
- Go to repo **Settings → Pages**
- Source: **Deploy from branch → main → / (root)**
- Save — your site will be live at `https://<username>.github.io/<repo>/`

---

## Usage

### For the public

1. Open the map
2. Tap **+** to add a pantry
3. Pick a location (tap on map or use GPS)
4. Fill in name, contact details, photo, and website
5. Submit — the pantry appears on the map immediately

### For managers

Open `data.html` (e.g. `https://your-site/data.html`), enter the manager password, then:

- **Approve** entries to mark them as verified (pin turns green)
- **Export CSV** to download all submissions for OSM import
- **Refresh** to reload latest submissions

> To see pending (unverified) submissions, managers can also use the [Supabase Dashboard](https://supabase.com/dashboard) → Table Editor → pantries.

---

## Database Schema

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Auto-generated primary key |
| `created_at` | timestamptz | Submission timestamp |
| `name` | text | Pantry name |
| `lat` / `lng` | float | Coordinates |
| `contact_name` | text | Contact person |
| `contact_phone` | text | Contact number |
| `url` | text | Website or Facebook page |
| `photo_path` | text | Storage key for the photo |
| `photo_url` | text | Public CDN URL of the photo |
| `approved` | boolean | `false` = pending, `true` = verified by manager |

---

## Contributing

This project is maintained by [UPRI-NOAH](https://github.com/UPRI-NOAH). Pull requests are welcome.
