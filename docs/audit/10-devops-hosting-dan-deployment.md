# LAPORAN DEVOPS, HOSTING, DAN DEPLOYMENT: BAGIAN X (Panduan.txt)
**Proyek:** API & Webhook Radar  
**Tolok Ukur Standar:** Panduan.txt Seksi 37-40 (Baris 862-977), Cloud Native & CI/CD  
**Status:** Baseline Specification

---

## 1. Multi-Provider Deployment Support

Karena dibangun di atas Nitro Engine, aplikasi ini secara native dapat di-deploy ke berbagai platform tanpa rewrite kode:

| Platform | Nitro Preset | Karakteristik |
|---|---|---|
| **Vercel** | `vercel` / `auto` | Serverless Function, zero cost, global edge caching. |
| **Cloudflare Pages** | `cloudflare-pages` | Cloudflare Workers runtime, sub-millisecond cold start. |
| **Railway / VPS** | `node-server` | Standalone Node.js process di belakang Nginx/Caddy proxy. |

---

## 2. Environment Variables & Runtime Config
- `NITRO_PORT`: Port listen server (default: 3000).
- `RADAR_ALLOW_LOCAL_GLOBAL`: Flag environment untuk mengizinkan local network probing di staging server.
