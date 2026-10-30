<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'color-scheme', content: 'light' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' },
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap' }
  ],
  htmlAttrs: {
    lang: 'id',
    class: 'light'
  },
  bodyAttrs: {
    class: 'bg-slate-50 text-slate-900 antialiased'
  }
})

const title = 'API & Webhook Radar — Realtime Endpoint Watcher'
const description = 'Pantau status, latency, dan ketersediaan service API dan gateway secara real-time.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
})

if (import.meta.client) {
  document.documentElement.classList.remove('dark')
  document.documentElement.classList.add('light')
  try {
    if (localStorage.getItem('nuxt-color-mode') === 'dark') {
      localStorage.setItem('nuxt-color-mode', 'light')
    }
  } catch {
    // Ignore localStorage access issues in restricted environments
  }
}

const isSettingsOpen = ref(false)
</script>

<template>
  <UApp>
    <div class="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
      <!-- Top Simple Navbar (Clean White) -->
      <header class="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <NuxtLink
            to="/"
            class="flex items-center gap-2.5 font-bold text-base text-slate-900"
          >
            <div class="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-lg font-bold">
              <UIcon
                name="i-lucide-activity"
                class="size-5"
              />
            </div>
            <span class="tracking-tight">API Radar</span>
          </NuxtLink>

          <nav class="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <NuxtLink
              to="/"
              class="text-emerald-600 font-semibold"
            >
              Endpoints
            </NuxtLink>
            <NuxtLink
              to="/#webhooks"
              class="hover:text-slate-900 transition"
            >
              Webhooks
            </NuxtLink>
            <NuxtLink
              to="/#logs"
              class="hover:text-slate-900 transition"
            >
              History Logs
            </NuxtLink>
          </nav>

          <div class="flex items-center gap-3">
            <button
              class="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition"
              title="Pengaturan"
              @click="isSettingsOpen = true"
            >
              <UIcon
                name="i-lucide-settings"
                class="size-4"
              />
            </button>
            <div class="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All systems healthy</span>
            </div>
          </div>
        </div>
      </header>

      <main class="flex-1">
        <NuxtPage />
      </main>

      <!-- Clean Footer -->
      <footer class="border-t border-slate-200 bg-white py-6 text-xs text-slate-400">
        <div class="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>API &amp; Webhook Radar &middot; Dibangun di atas Nuxt 4 + Tailwind CSS</p>
          <p class="font-mono">
            Status: SSR Active &middot; Zero-Cost Self-Hosted
          </p>
        </div>
      </footer>
    </div>
    <SettingsModal v-model:open="isSettingsOpen" />
  </UApp>
</template>
