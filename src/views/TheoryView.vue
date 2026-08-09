<script setup lang="ts">
import { onMounted } from 'vue'

import { SHEETS } from '@/content'
import { useTheoryStore } from '@/stores/theory'

const store = useTheoryStore()

onMounted(() => void store.load())

const percent = (rate: number): number => Math.round(rate * 100)
</script>

<template>
  <section>
    <h1 class="text-2xl font-semibold tracking-tight">Théorie</h1>
    <p class="mt-2 text-slate-500 dark:text-slate-400">
      Les irrégularités regroupées par famille, et ce qu’un francophone rate d’abord.
    </p>

    <ul class="mt-6 space-y-3">
      <li v-for="sheet in SHEETS" :key="sheet.slug">
        <RouterLink
          :to="{ name: 'theory-sheet', params: { slug: sheet.slug } }"
          class="block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
        >
          <h2 class="font-semibold tracking-tight">{{ sheet.title }}</h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ sheet.summary }}</p>

          <!-- L'indicateur ne s'affiche qu'une fois assez de formes demandées :
               un taux calculé sur trois réponses désignerait au hasard la fiche
               à relire, ce qui est pire que de ne rien désigner. -->
          <p v-if="store.scoreOf(sheet).meaningful" class="mt-2 text-xs">
            <span class="text-slate-500 dark:text-slate-400">
              {{ percent(store.scoreOf(sheet).rate) }} % de réussite sur
              {{ store.scoreOf(sheet).score.attempts }} formes
            </span>
          </p>
          <p v-else class="mt-2 text-xs text-slate-400 dark:text-slate-500">
            Pas encore assez de révisions pour mesurer.
          </p>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
