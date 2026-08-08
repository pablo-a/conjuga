<script setup lang="ts">
import { computed } from 'vue'

import VerbForm from '@/components/VerbForm.vue'
import { conjugateAll } from '@/conjugation'
import { PERSONS, PERSON_LABELS, TENSE_LABELS } from '@/conjugation/types'
import type { Tense } from '@/conjugation/types'

const props = defineProps<{ infinitive: string; tense: Tense }>()

const rows = computed(() =>
  conjugateAll(props.infinitive, props.tense).map((form, index) => {
    const person = PERSONS[index]!
    return { person, label: PERSON_LABELS[person], form }
  }),
)

/** Un temps entièrement vide est un temps que le verbe n'a pas : on le dit. */
const missing = computed(() => rows.value.every((row) => row.form === null))
</script>

<template>
  <section
    class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
  >
    <h3 class="text-sm font-semibold tracking-tight">{{ TENSE_LABELS[tense] }}</h3>

    <p v-if="missing" class="mt-2 text-sm text-slate-500 dark:text-slate-400">
      Ce verbe n’a pas ce temps.
    </p>

    <dl v-else class="mt-2 space-y-1.5">
      <div v-for="row in rows" :key="row.person" class="flex gap-3 text-sm">
        <dt class="w-28 shrink-0 text-slate-500 dark:text-slate-400">{{ row.label }}</dt>
        <dd class="min-w-0"><VerbForm :form="row.form" /></dd>
      </div>
    </dl>
  </section>
</template>
