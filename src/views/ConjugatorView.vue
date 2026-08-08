<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ConjugationTable from '@/components/ConjugationTable.vue'
import { MOODS } from '@/views/conjugator'
import {
  NotAVerbError,
  canonicalInfinitive,
  conjugationOf,
  modelFor,
  nonFinite,
  normalizeQuery,
  suggestions,
} from '@/conjugation'
import type { Model, NonFiniteForms } from '@/conjugation'

const route = useRoute()
const router = useRouter()

/** La saisie vit dans l'URL : un tableau de conjugaison se partage et se recharge. */
const queryParam = computed(() => {
  const value = route.query.v
  return typeof value === 'string' ? value : ''
})

const input = ref(queryParam.value)
watch(queryParam, (value) => {
  if (normalizeQuery(value) !== normalizeQuery(input.value)) input.value = value
})

function search(verb: string) {
  input.value = verb
  const v = normalizeQuery(verb)
  void router.replace({ query: v.length > 0 ? { v } : {} })
}

const infinitive = computed(() => canonicalInfinitive(input.value))
const proposals = computed(() => suggestions(input.value))

/**
 * Ce que le moteur sait du verbe saisi, ou la raison pour laquelle il ne sait rien.
 *
 * `conjugationOf` ne reconnaît que les trois terminaisons d'infinitif : tout le
 * reste — un nom, une forme déjà conjuguée — est refusé ici plutôt que de produire
 * un tableau absurde.
 */
type Lookup =
  | { kind: 'vide' }
  | { kind: 'refus'; message: string }
  | { kind: 'verbe'; infinitive: string; model: Model; forms: NonFiniteForms }

const verb = computed<Lookup>(() => {
  const value = infinitive.value
  if (value.length === 0) return { kind: 'vide' }

  const conjugation = conjugationOf(value)
  if (!conjugation) return { kind: 'refus', message: new NotAVerbError(value).message }

  return {
    kind: 'verbe',
    infinitive: value,
    model: modelFor(value, conjugation),
    forms: nonFinite(value),
  }
})

/** Le verbe saisi a-t-il été corrigé en cours de route ? On le signale. */
const corrected = computed(
  () => infinitive.value.length > 0 && infinitive.value !== normalizeQuery(input.value),
)
</script>

<template>
  <section>
    <h1 class="text-2xl font-semibold tracking-tight">Conjugueur</h1>
    <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
      N’importe quel verbe à l’infinitif. Le segment irrégulier est
      <span class="text-irregular font-medium">surligné</span>, avec la règle qui l’explique.
    </p>

    <form class="mt-4" role="search" @submit.prevent="search(input)">
      <label for="verbe" class="sr-only">Verbe à conjuguer</label>
      <input
        id="verbe"
        v-model="input"
        type="text"
        name="v"
        placeholder="hablar, tener, volver…"
        autocomplete="off"
        autocapitalize="none"
        autocorrect="off"
        spellcheck="false"
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 dark:border-slate-700 dark:bg-slate-900"
        @input="search(input)"
      />
    </form>

    <ul v-if="proposals.length > 0" class="mt-2 flex flex-wrap gap-1.5">
      <li v-for="proposal in proposals" :key="proposal">
        <button
          type="button"
          class="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-accent-500 hover:text-accent-600 dark:border-slate-700 dark:text-slate-300 dark:hover:text-accent-500"
          @click="search(proposal)"
        >
          {{ proposal }}
        </button>
      </li>
    </ul>

    <p
      v-if="verb.kind === 'refus'"
      class="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
    >
      {{ verb.message }}
    </p>

    <template v-else-if="verb.kind === 'verbe'">
      <header
        class="mt-6 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 class="text-xl font-semibold tracking-tight">{{ verb.infinitive }}</h2>
        <p v-if="corrected" class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Orthographe corrigée depuis « {{ normalizeQuery(input) }} ».
        </p>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ verb.model.label }}</p>
        <dl class="mt-3 flex gap-6 text-sm">
          <div>
            <dt class="text-xs text-slate-500 dark:text-slate-400">Gérondif</dt>
            <dd class="font-medium">{{ verb.forms.gerundio }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500 dark:text-slate-400">Participe</dt>
            <dd class="font-medium">{{ verb.forms.participio }}</dd>
          </div>
        </dl>
      </header>

      <div v-for="mood in MOODS" :key="mood.name" class="mt-6">
        <h2 class="text-lg font-semibold tracking-tight">{{ mood.name }}</h2>
        <div class="mt-2 grid gap-3 sm:grid-cols-2">
          <ConjugationTable
            v-for="tense in mood.tenses"
            :key="tense"
            :infinitive="verb.infinitive"
            :tense="tense"
          />
        </div>
      </div>
    </template>

    <p v-else class="mt-6 text-sm text-slate-500 dark:text-slate-400">
      Tape un infinitif pour voir son tableau complet.
    </p>
  </section>
</template>
