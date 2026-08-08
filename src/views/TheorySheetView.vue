<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { sheetBySlug } from '@/content'
import { MODELS, TENSE_LABELS } from '@/conjugation'
import { successRate } from '@/srs/patterns'
import { useTheoryStore } from '@/stores/theory'

const route = useRoute()
const store = useTheoryStore()

onMounted(() => void store.load())

const sheet = computed(() => sheetBySlug(String(route.params.slug)))

/**
 * Les patrons que l'apprenant rate sur les temps de cette fiche.
 *
 * C'est la raison d'être de l'agrégat `(modèle, temps)` : dire « tu rates 62 %
 * des e→ie au présent » renvoie à une règle, là où « tu rates pensar » ne
 * renvoie qu'à un verbe.
 */
const weaknesses = computed(() =>
  sheet.value === undefined
    ? []
    : store.weaknessesOf(sheet.value).map((pattern) => ({
        key: `${pattern.model}:${pattern.tense}`,
        label: MODELS[pattern.model]?.label ?? pattern.model,
        tense: TENSE_LABELS[pattern.tense as keyof typeof TENSE_LABELS] ?? pattern.tense,
        percent: Math.round((1 - successRate(pattern)) * 100),
        attempts: pattern.attempts,
      })),
)
</script>

<template>
  <section v-if="sheet">
    <RouterLink
      :to="{ name: 'theory' }"
      class="text-sm text-accent-600 hover:underline dark:text-accent-500"
    >
      ← Théorie
    </RouterLink>
    <h1 class="mt-2 text-2xl font-semibold tracking-tight">{{ sheet.title }}</h1>

    <!-- Ce qui est raté vient avant la fiche : c'est ce qui donne une raison de
         la lire, et l'apprenant qui n'a rien raté n'a rien à lire ici. -->
    <div
      v-if="weaknesses.length > 0"
      class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30"
    >
      <h2 class="text-sm font-semibold tracking-tight">Ce que tu rates sur ce temps</h2>
      <ul class="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
        <li v-for="weakness in weaknesses" :key="weakness.key">
          {{ weakness.label }} — {{ weakness.percent }} % d’erreurs sur
          {{ weakness.attempts }} formes ({{ weakness.tense }})
        </li>
      </ul>
    </div>

    <article class="theory mt-6">
      <component :is="sheet.component" />
    </article>

    <RouterLink
      :to="{ name: 'practice' }"
      class="mt-8 inline-block rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700"
    >
      Passer à la pratique
    </RouterLink>
  </section>

  <section v-else>
    <h1 class="text-2xl font-semibold tracking-tight">Fiche introuvable</h1>
    <p class="mt-2 text-slate-500 dark:text-slate-400">Cette fiche n’existe pas — ou pas encore.</p>
    <RouterLink
      :to="{ name: 'theory' }"
      class="mt-4 inline-block text-sm text-accent-600 hover:underline dark:text-accent-500"
    >
      Revenir à la liste
    </RouterLink>
  </section>
</template>

<style scoped>
/*
 * Les fiches sont du markdown : leur HTML n'a aucune classe sur laquelle
 * s'accrocher, et le styler ici plutôt que dans chaque fiche garde la rédaction
 * lisible — une fiche doit rester un texte, pas un gabarit.
 *
 * `@reference` donne à ce bloc isolé le thème du projet (la palette `accent`, la
 * variante `dark`) sans réémettre le CSS de Tailwind : sans lui, `@apply` ne
 * connaît aucune de nos classes. C'est le seul endroit de l'app qui en a besoin,
 * parce que c'est le seul où le HTML n'est pas écrit à la main.
 */
@reference '../style.css';

.theory :deep(h2) {
  @apply mt-8 text-lg font-semibold tracking-tight;
}

.theory :deep(h3) {
  @apply mt-6 text-base font-semibold tracking-tight;
}

.theory :deep(p) {
  @apply mt-3 text-slate-700 dark:text-slate-200;
}

.theory :deep(ul),
.theory :deep(ol) {
  @apply mt-3 list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-200;
}

.theory :deep(blockquote) {
  @apply mt-3 border-l-2 border-accent-500 pl-4 text-slate-700 italic dark:text-slate-200;
}

.theory :deep(code) {
  @apply rounded bg-slate-100 px-1 py-0.5 text-sm dark:bg-slate-800;
}

.theory :deep(strong) {
  @apply font-semibold text-slate-900 dark:text-slate-50;
}

/* Les tableaux de grammaire débordent vite sur un téléphone : ils défilent dans
   leur propre boîte plutôt que d'élargir la page entière. */
.theory :deep(table) {
  @apply mt-4 block w-full overflow-x-auto text-sm;
}

.theory :deep(th) {
  @apply border-b border-slate-200 px-3 py-2 text-left font-semibold dark:border-slate-800;
}

.theory :deep(td) {
  @apply border-b border-slate-100 px-3 py-2 align-top text-slate-700 dark:border-slate-800/60 dark:text-slate-200;
}

.theory :deep(.not-prose) {
  @apply mt-4;
}
</style>
