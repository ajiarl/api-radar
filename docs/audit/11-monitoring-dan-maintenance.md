# LAPORAN MONITORING DAN MAINTENANCE: BAGIAN XI (Panduan.txt)
**Proyek:** API & Webhook Radar  
**Tolok Ukur Standar:** Panduan.txt Seksi 41-44 (Baris 978-1024), SRE Observability  
**Status:** Baseline Specification

---

## 1. Synthetic Health Probe (`/api/health`)

Menyediakan route khusus untuk di-ping oleh layanan monitoring uptime eksternal (seperti UptimeRobot atau BetterStack):
- **Path:** `GET /api/health`
- **Payload Respons:**
  ```json
  {
    "status": "ok",
    "service": "api-radar",
    "uptime": 1284.2,
    "timestamp": "2026-10-28T13:10:00.000Z"
  }
  ```

---

## 2. Maintenance & Storage Pruning
- Log probe yang tersimpan di `unstorage` otomatis dirotasi atau dipangkas saat melewati batas 100 entri per channel untuk menjaga konsumsi RAM dan storage tetap stabil di bawah 50 MB.
