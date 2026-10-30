# API & Webhook Radar

[![CI Quality Gates](https://github.com/ajiarl/api-radar/actions/workflows/ci.yml/badge.svg)](https://github.com/ajiarl/api-radar/actions)
[![Vitest](https://img.shields.io/badge/Vitest-101%20Passed-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev)
[![Nuxt 4](https://img.shields.io/badge/Nuxt-4.6.2-00DC82?logo=nuxt.js&logoColor=white)](https://nuxt.com)
[![Nitro Engine](https://img.shields.io/badge/Nitro-2.13.4-F43F5E?logo=nitro&logoColor=white)](https://nitro.unjs.io)
[![Nuxt UI](https://img.shields.io/badge/Nuxt%20UI-4.12.0-00DC82?logo=nuxt.js&logoColor=white)](https://ui.nuxt.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4.3-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> A high-density developer cockpit for real-time outbound endpoint telemetry, SSRF-guarded probing, and multi-channel webhook ingress debugging.

---

## Executive Overview & Problem Statement

### The Problem
Modern distributed systems and third-party webhook integrations frequently suffer from fragmented debugging workflows:
- **Context Fragmentation**: Developers jump between terminal curl invocations, raw log aggregators, and browser developer tools to verify external service availability and incoming payload contracts.
- **SSRF and Rebinding Risks**: Probing user-supplied or dynamic microservice endpoints from backend servers opens attack vectors to loopback interfaces, cloud metadata endpoints (e.g., AWS IMDS `169.254.169.254`), and internal subnets.
- **Worker Hangs and Memory Bloat**: Unresponsive upstream targets without strict circuit breakers exhaust server connection pools and memory buffers through unbounded responses.
- **Credential Leakage**: Ingress webhook logs frequently capture sensitive Bearer tokens, API keys, and session cookies in plaintext.

### The Solution
**API & Webhook Radar** delivers a production-grade diagnostic cockpit built on Nuxt 4 and the Nitro Engine:
- **Hardened Outbound Probing**: Low-latency HTTP client backed by `performance.now()` precision, non-blocking 5,000ms `AbortSignal` circuit breakers, 50KB response truncation, and comprehensive SSRF/DNS-rebinding perimeter protection.
- **Secure Webhook Collector**: Catch-all multi-channel ingress collector (`/api/webhook/:channelId`) with stream-level 100KB payload enforcement, sliding-window IP rate limiting (300 requests/minute), and automated zero-trust credential masking.
- **High-Density Cockpit Interface**: Responsive, light-theme dashboard constructed with Nuxt UI v4 and Tailwind CSS v4, providing instant telemetry metrics, target inspection drawers, quick cURL generation, and reactive polling via `@vueuse/core`.

---

## System Architecture

```text
+-------------------------------------------------------------------------+
|                           CLIENT BROWSER                                |
|  [ Dashboard UI / Targets Cockpit / Ingress Viewer / Inspector Drawer ]  |
+--------------------+--------------------------------+-------------------+
                     |                                ^
         HTTP Events | Auto-Refresh Polling           | Server-Rendered
         (POST/GET)  | (@vueuse/core)                 | State & SSE
                     v                                |
+-----------------------------------------------------+-------------------+
|                        NUXT 4 FULLSTACK RUNTIME                         |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                     NITRO SERVER ENGINE (v2.13)                   |  |
|  |                                                                   |  |
|  |   [ Ingress Collector ]       [ Outbound Probing Engine ]         |  |
|  |   ALL /api/webhook/:channel   POST /api/radar/ping                |  |
|  |            |                              |                       |  |
|  |            v                              v                       |  |
|  |   +-------------------+          +-----------------------+        |  |
|  |   | In-Memory Limiter |          | SSRF Perimeter Guard  |        |  |
|  |   | (300 req/min/IP)  |          | - RFC 1918 / Loopback |        |  |
|  |   +--------+----------+          | - Cloud Metadata / DNS|        |  |
|  |            |                     +-----------+-----------+        |  |
|  |            v                                 |                    |  |
|  |   +-------------------+                      v                    |  |
|  |   | Stream Cap & Mask |          +-----------------------+        |  |
|  |   | (100KB + Masking) |          | 5000ms Abort Signal   |        |  |
|  |   +--------+----------+          | + 50KB Payload Limiter|        |  |
|  |            |                     +-----------+-----------+        |  |
|  |   +-------------------+          +-----------------------+        |  |
|  |   | Fail-Closed Auth  |          | Fail-Closed Admin     |        |  |
|  |   | (x-radar-key)     |          | (Targets CRUD Guard)  |        |  |
|  |   +--------+----------+          +-----------------------+        |  |
|  +------------|---------------------------------|--------------------+  |
+---------------|---------------------------------|-----------------------+
                |                                 | Outbound Fetch
                v                                 v
+-------------------------------+ +---------------------------------------+
|     LOCAL NITRO STORAGE       | |         TARGET SERVICES               |
|  useStorage('webhook')        | |  - Remote APIs (GitHub, Stripe, etc.) |
|  useStorage('radar')          | |  - Local Gateways (9Router port 20128)|
+-------------------------------+ +---------------------------------------+
```

---

## Architectural Disclosures & Operational Boundaries

### In-Memory Rate Limiting Architecture
Rate limiting in API Radar is implemented using a single-process JavaScript `Map` store in Node.js process memory (`server/utils/rateLimit.ts`).
- **Single Process Bound**: Sliding-window hit counts are tracked in memory per IP address. It is not backed by an external distributed store like Redis.
- **Serverless / Multi-Instance Consequence**: When deployed on multi-container clusters, auto-scaling instances, or serverless edge platforms (e.g. AWS Lambda, Vercel Serverless), each process maintains its own independent rate counter. For unified distributed rate limiting in enterprise multi-node environments, an external Redis or KV backing store should be configured.

### Client-Driven Active Polling
Target health probing and telemetry collection are driven by active client browser dashboard sessions:
- **Browser-Initiated Heartbeat**: Telemetry updates are triggered reactively via `@vueuse/core` (`useIntervalFn`) running inside the client browser.
- **Tab Inactivity Pause**: When the browser dashboard tab is closed or put into sleep/background state by the operating system, automated target ping requests pause.
- **No Background Daemon**: The server runtime does not host a standalone background cron worker or long-running OS daemon. Probing occurs strictly upon manual user trigger or while an active cockpit browser session is open.

### Payload & Sanitization Boundaries
- **Webhook Ingress Stream Limit (100KB)**: Webhook ingress enforces a strict 100KB boundary (`100 * 1024` bytes). Requests with a `Content-Length` exceeding 100KB are rejected immediately before reading request streams. For chunked streams without length headers, incoming chunks are counted in real-time; exceeding 100KB immediately destroys the socket and yields HTTP 413.
- **Probe Ping Truncation (50KB)**: Outbound probe ping response bodies are truncated at 50KB to protect server memory buffers from oversized payloads.
- **Recursive Payload Masking**: Ingress webhook headers (`Authorization`, `Cookie`, `X-Api-Key`, etc.) are masked to `***MASKED***`. Query parameters and JSON bodies are recursively parsed up to depth 5 with sensitive keys matching `/password|secret|token|api_?key|auth|cred|private/i` replaced with `[MASKED]`.

---

## Feature Highlights

### Outbound HTTP Probe Engine
- **Sub-millisecond Timing Resolution**: Latency calculated via high-resolution `performance.now()`.
- **Worker Starvation Circuit Breaker**: Explicit 5,000ms timeout with `AbortSignal.timeout(5000)` prevents hanging sockets from holding event loop resources.
- **Memory Buffer Protection**: Response bodies automatically truncated at 50KB to shield application memory from oversized payloads.
- **Resilient Error Categorization**: Converts network timeouts and target failures into structured responses (504 Gateway Timeout or 502 Bad Gateway) without crashing the runtime.

### SSRF Perimeter and DNS Rebinding Defense
- **Protocol Whitelisting**: Strict protocol validation limiting outbound calls exclusively to `http:` and `https:`.
- **IP Blocklist Range Verification**: Comprehensive subnet inspection rejecting loopback addresses (`127.0.0.0/8`, `::1`), RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), Cloud Metadata services (`169.254.169.254`), CGNAT (`100.64.0.0/10`), IPv4-mapped IPv6 ranges, and octal or hexadecimal IP encodings.
- **Asynchronous DNS Resolution**: Validates hostname targets via `dns.promises.lookup` to prevent time-of-check to time-of-use (TOCTOU) DNS rebinding attacks at the socket boundary.
- **Environment-Gated Local Bypass**: Development testing against local endpoints (such as local gateway instances) requires both target-level approval (`allowLocal: true`) and an explicit server environment variable (`ALLOW_LOCAL_BYPASS=true`).

### Multi-Channel Webhook Ingress
- **Dynamic Catch-All Ingress**: Capture incoming HTTP webhooks from external providers on any channel path (`/api/webhook/:channelId`).
- **IP-Based Sliding Window Rate Limiting**: Built-in rate limiter caps ingress traffic at 300 requests per minute per IP to protect backend storage.
- **Stream-Level 100KB Boundary**: Early `Content-Length` verification and chunked stream socket aborts reject requests exceeding 100KB with HTTP 413 (Payload Too Large).
- **Automated Zero-Trust Credential Redaction**: Automatically sanitizes sensitive authentication headers (`Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`, `Token`, `Secret`) replacing values with `***MASKED***`, and recursively masks query parameters and JSON payload keys with `[MASKED]`.

### Administrative Security & Fail-Closed Guard
- **Constant-Time Token Comparison**: Admin validation employs `crypto.timingSafeEqual` via `validateAdminAuth` to prevent timing side-channel attacks.
- **Fail-Closed Production Security**: Protected endpoints (`GET /api/webhook/logs`, `POST /api/radar/targets`, `DELETE /api/radar/targets/:id`) fail closed in production if `RADAR_ADMIN_TOKEN` or `RADAR_API_KEY` is not configured.
- **Flexible Token Delivery**: Tokens are accepted via `x-radar-key` header or standard `Authorization: Bearer <token>`.

### High-Density Cockpit UI
- **Refined Light Architecture**: Purpose-built high-contrast UI leveraging Nuxt UI v4 primitives and Tailwind CSS v4.
- **Real-Time Telemetry Metrics**: Immediate overview cards displaying Total Endpoints, Mean Round-Trip Latency, and System Availability Rate.
- **Detailed Inspector Slideover**: Inspect status codes, timing metrics, formatted response payloads, and generate copy-ready cURL commands.
- **Adaptive Auto-Refresh**: Configurable reactive polling intervals (Off, 5s, 10s, 30s) powered by `@vueuse/core`.

### Target Management and Nitro Storage
- **Unstorage Engine Integration**: Monitored endpoints persisted through Nitro's unified unstorage driver.
- **Seeded Defaults**: Pre-configured targets (e.g., GitHub API Status) allow immediate onboarding without manual setup.
- **Probe History Retention**: Stores historical latency measurements per target for trend observation.

---

## REST API Reference

| Method | Endpoint | Description | Request Body / Parameters | Response |
|---|---|---|---|---|
| `GET` | `/api/health` | Synthetic uptime health check | None | `200 OK`: `{ status: 'ok', service: 'api-radar', uptime: number, timestamp: string }` |
| `GET` | `/api/radar/targets` | List all registered target endpoints | None | `200 OK`: `{ targets: RadarTarget[] }` |
| `POST` | `/api/radar/targets` | Register or update target endpoint (Admin) | Header: `x-radar-key` or `Authorization: Bearer`<br>JSON: `{ name, url, method, allowLocal?, headers? }` | `200 OK`: `{ success: true, target: RadarTarget }`<br>`400`: Validation error<br>`401`: Unauthorized<br>`403`: SSRF or unpermitted local bypass |
| `DELETE` | `/api/radar/targets/:id` | Remove target endpoint by ID (Admin) | Header: `x-radar-key` or `Authorization: Bearer`<br>URL param: `id` | `200 OK`: `{ success: true }`<br>`400`: Invalid ID<br>`401`: Unauthorized<br>`404`: Target not found |
| `POST` | `/api/radar/ping` | Execute outbound probe and capture metrics | JSON: `{ id?, url, method, allowLocal?, headers?, body? }` | `200 OK`: `{ url, method, status, statusText, latencyMs, headers, body, timestamp }`<br>`400`: Invalid schema<br>`403`: SSRF blocked<br>`429`: Rate limit exceeded |
| `GET` | `/api/radar/history/:id` | Retrieve recent probe history for target | URL param: `id` | `200 OK`: `{ id: string, history: PingResult[] }`<br>`400`: Invalid target ID |
| `ALL` | `/api/webhook/:channelId` | Catch-all webhook ingress collector | URL param: `channelId`<br>Body: JSON, text, or binary (max 100KB) | `200 OK`: `{ success: true, channelId, message }`<br>`400`: Invalid channel ID<br>`413`: Payload too large<br>`429`: Rate limit exceeded |
| `GET` | `/api/webhook/logs` | Fetch received webhook logs (Admin) | Header: `x-radar-key: <TOKEN>` or `Authorization: Bearer <TOKEN>` | `200 OK`: `{ logs: WebhookLogItem[] }`<br>`401`: Unauthorized |

---

## Environment Variables Configuration

| Variable | Type | Default | Description |
|---|---|---|---|
| `ALLOW_LOCAL_BYPASS` | `boolean` (`"true"` / `"false"`) | `"false"` | When set to `"true"`, permits outbound pings to local loopback (`127.0.0.1`) and private subnets when targets specify `allowLocal: true`. In production environments, keep unset or set to `"false"`. |
| `RADAR_ADMIN_TOKEN` | `string` | Unset (dev fallback) | Primary administrative secret token. Secures `GET /api/webhook/logs`, `POST /api/radar/targets`, and `DELETE /api/radar/targets/:id`. Required in production; unauthenticated requests fail closed with HTTP 401. |
| `RADAR_API_KEY` | `string` | Unset | Alternate legacy secret token variable accepted interchangeably with `RADAR_ADMIN_TOKEN`. |
| `PORT` | `number` | `3000` | Port on which the standalone Nitro Node.js server listens. |
| `HOST` | `string` | `"0.0.0.0"` | Network host address binding for the standalone Nitro server. |

---

## Local Setup & Testing Commands

### Prerequisites
- **Node.js**: `>= 22.0.0`
- **Package Manager**: `pnpm` (version 10 or higher recommended)

### 1. Clone & Installation
```bash
git clone https://github.com/ajiarl/api-radar.git
cd api-radar
pnpm install
```

### 2. Development Server
```bash
pnpm dev
```
Navigate to `http://localhost:3000` to access the developer cockpit.

### 3. Quality Gates Verification Commands
Run the full quality assurance pipeline locally:

```bash
# Run Vitest test suite (101 tests covering SSRF, targets, webhooks, sanitization, auth, and rate limiting)
pnpm test

# Run ESLint validation
pnpm run lint

# Run TypeScript strict typecheck
npx nuxi typecheck

# Compile production bundle
pnpm run build
```

---

## Deployment Guide

### Vercel (Serverless Edge)
The application deploys automatically with zero configuration using the standard Nuxt Vercel preset:
1. Connect repository in the Vercel dashboard.
2. Ensure the build command is configured as `pnpm run build`.
3. Set the output directory to `.output`.
4. Configure optional production environment variables (`RADAR_ADMIN_TOKEN`, `ALLOW_LOCAL_BYPASS=false`).

### Node.js Standalone (Docker, VPS, Coolify)
The compiled Nitro server in `.output/` is self-contained and operates without external dependencies:

```bash
# Compile bundle
pnpm run build

# Start production server
node .output/server/index.mjs
```

Example systemd or container start configuration:
```bash
HOST=0.0.0.0 PORT=3000 node .output/server/index.mjs
```

---

## License

This project is licensed under the [MIT License](LICENSE).
