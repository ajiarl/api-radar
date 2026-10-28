# DESIGN.md — API & Webhook Radar

## 1. Aesthetic Identity: Developer Cockpit & Utilitarian Modernism
Inspirasi estetika: Linear App, BetterStack Uptime, dan Cloudflare Dashboard.
Menghindari AI-slop (tanpa gradient ungu/pink neon murahan, tanpa rounded-pill berlebihan, tanpa animasi lambat yang menghambat kerja). Tampilan data-dense, crisp, dan high-contrast.

## 2. Palette & Semantic Color Tokens
- **Background Base**: `#090A0F` (Dark Obsidian Void)
- **Surface / Card / Table**: `#12131A` (Card Elevation 1), `#181A24` (Hover/Border Active)
- **Borders & Dividers**: `#262938` (Subtle Hairline Border 1px)
- **Text Primary**: `#F4F5F8` (High Contrast White)
- **Text Secondary / Muted**: `#8E95A5` (Neutral Gray)
- **Accent / Interactive**: `#0284C7` (Sky 600 / Focus Ring)
- **Semantic Status Signals**:
  - `Online / Healthy`: `#10B981` (Emerald 500)
  - `Degraded / Slow (>800ms)`: `#F59E0B` (Amber 500)
  - `Down / Timeout / Error`: `#EF4444` (Rose 500)
  - `Method GET`: Nuxt UI Badge Blue / Sky
  - `Method POST`: Nuxt UI Badge Emerald / Green
  - `Method HEAD / DELETE`: Nuxt UI Badge Purple / Amber

## 3. Typography & Hierarchy
- **Primary Font**: Public Sans / Inter (UI text, table labels, headers)
- **Code & Numbers Font**: JetBrains Mono / Fira Code / ui-monospace (latensi `142ms`, status `200 OK`, URL endpoint, dan JSON payload viewer)

## 4. UI Components Guidelines (Nuxt UI)
- `UTable`: Gunakan slot kustom untuk kolom Method (`#method-data`), Latency (`#latency-data`), dan Status (`#status-data`).
- `USlideover`: Slideover kanan lebar (`w-full sm:max-w-xl`) dengan tombol close cepat (`Esc` atau icon close) untuk inspeksi mendalam tanpa reload halaman.
- `UBadge`: Variant subtle (`variant="subtle"`), font mono, tracking tight.
- `UModal`: Form modal minimalis untuk menambah endpoint baru.
- `useToast`: Non-blocking bottom-right notification saat ping gagal atau endpoint down.
