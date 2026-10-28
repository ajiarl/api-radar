<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'id'
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
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <NuxtLink
          to="/"
          class="flex items-center gap-2 font-bold text-lg tracking-tight focus-visible:outline-2 outline-primary rounded-md p-1 -ms-1"
        >
          <div class="flex items-center justify-center size-8 rounded-lg bg-emerald-500/10 text-emerald-500">
            <UIcon
              name="i-lucide-activity"
              class="size-5"
            />
          </div>
          <span class="font-bold text-highlighted">API Radar</span>
        </NuxtLink>
      </template>

      <div class="hidden md:flex items-center gap-1">
        <UButton
          to="/"
          variant="ghost"
          color="neutral"
          class="font-medium"
        >
          Endpoints
        </UButton>
        <UButton
          to="/#webhooks"
          variant="ghost"
          color="neutral"
          class="font-medium text-muted hover:text-highlighted"
        >
          Webhooks
        </UButton>
        <UButton
          to="/#logs"
          variant="ghost"
          color="neutral"
          class="font-medium text-muted hover:text-highlighted"
        >
          Logs
        </UButton>
      </div>

      <template #right>
        <div class="flex items-center gap-3">
          <div class="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <span class="relative flex size-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span class="relative inline-flex rounded-full size-2 bg-emerald-500" />
            </span>
            <span>All systems healthy</span>
          </div>

          <UColorModeButton />
        </div>
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>

    <USeparator />

    <UFooter>
      <template #left>
        <p class="text-xs text-muted">
          API &amp; Webhook Radar &mdash; Nuxt 4 &amp; Nitro Engine &mdash; Zero-Cost Self-Hosted
        </p>
      </template>

      <template #right>
        <div class="flex items-center gap-2 text-xs text-muted">
          <span class="inline-block size-2 rounded-full bg-emerald-500" />
          <span>Nitro v2.13.4 Engine</span>
        </div>
      </template>
    </UFooter>
  </UApp>
</template>
