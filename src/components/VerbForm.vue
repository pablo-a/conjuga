<script setup lang="ts">
import { computed } from 'vue'

import { segmentsOf } from '@/conjugation/highlight'
import type { MaybeForm } from '@/conjugation/types'

const props = defineProps<{ form: MaybeForm }>()

const segments = computed(() => (props.form ? segmentsOf(props.form) : []))

/**
 * Les explications de toutes les irrégularités de la forme, dédoublonnées.
 * Deux emplacements différents décrivent souvent le même accident — inutile de
 * le dire deux fois à l'apprenant.
 */
const explanations = computed(() => [
  ...new Set((props.form?.irregularities ?? []).map((irregularity) => irregularity.explanation)),
])
</script>

<template>
  <!-- Une cellule vide n'est pas une absence de réponse : c'est l'information que
       la langue n'a pas ce mot. Elle est donc annoncée, pas seulement laissée vide. -->
  <span v-if="form === null" class="text-slate-300 dark:text-slate-700">
    <span aria-hidden="true">—</span>
    <span class="sr-only">forme inexistante</span>
  </span>

  <span v-else>
    <!-- `data-form` isole la forme elle-même de son explication : c'est ce qui
         permet de l'extraire en test sans dépendre d'une classe de style. -->
    <span data-form class="font-medium">
      <template v-for="(segment, index) in segments" :key="index">
        <span
          v-if="segment.irregularities.length > 0"
          class="text-irregular decoration-irregular/40 underline decoration-2 underline-offset-2"
          >{{ segment.text }}</span
        >
        <template v-else>{{ segment.text }}</template>
      </template>
    </span>

    <span
      v-if="explanations.length > 0"
      class="mt-0.5 block text-xs text-slate-500 dark:text-slate-400"
    >
      {{ explanations.join(' · ') }}
    </span>

    <span
      v-if="form.alternatives.length > 0"
      class="mt-0.5 block text-xs text-slate-400 dark:text-slate-500"
    >
      ou {{ form.alternatives.join(', ') }}
    </span>
  </span>
</template>
