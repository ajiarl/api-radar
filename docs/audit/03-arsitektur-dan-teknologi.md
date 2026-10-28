# LAPORAN ARSITEKTUR DAN TEKNOLOGI: BAGIAN III (Panduan.txt)
**Proyek:** API & Webhook Radar  
**Tolok Ukur Standar:** Panduan.txt Seksi 9-12 (Baris 263-428), MDN Web Docs, Nuxt v4 & Nitro Specs  
**Status:** Baseline Specification

---

## 1. Pilihan Stack & Alasan Arsitektural

| Komponen | Pilihan Teknologi | Alasan Objektif |
|---|---|---|
| **Meta-Framework** | Nuxt 4 (v4.6.2) | Fullstack Vue 3 dengan SSR, Nitro server bawaan, dan auto-imports ergonomis. |
| **Server Engine** | Nitro v2.13.4 | Server runtime mandiri dan agnostic terhadap provider (Node, Vercel, Cloudflare, Bun). |
| **Frontend UI** | `@nuxt/ui` + Tailwind CSS | Komponen berbasis headless Reka UI dengan design tokens yang konsisten. |
| **Storage Layer** | Nitro `unstorage` | Abstraksi key-value bawaan; zero setup database eksternal untuk fase MVP. |
| **Type Safety** | TypeScript 5+ & Zod | Strict schema validation pada network boundary. |

---

## 2. SSR Hydration & Data Fetching Lifecycle

1. **Initial SSR Data Load:**
   - Menggunakan `useFetch('/api/radar/targets')`.
   - Data diserialisasikan di server dan di-hydrate ke client tanpa double-fetch.
2. **Event-Driven Actions:**
   - Tombol "Ping" dan form submit menggunakan `$fetch('/api/radar/ping')`.
3. **State Management:**
   - Menggunakan `useState('radarTargets')` untuk state reaktif yang aman dari kebocoran cross-request di server.
