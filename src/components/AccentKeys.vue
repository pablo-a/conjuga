<script setup lang="ts">
/**
 * Les caractères espagnols qu'un clavier français ne donne pas d'une touche.
 *
 * Ce n'est pas un confort : la correction note l'accent, et sur un téléphone
 * l'apprenant qui doit rester appuyé sur `a` pour obtenir `á` finit par écrire
 * `hablo` en pensant `habló`. La barre supprime cette raison de se tromper.
 *
 * Le `ñ` n'est pas un accent mais une lettre de l'alphabet espagnol : il est là
 * pour la même raison pratique, pas par assimilation.
 */
const KEYS = ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ'] as const

defineEmits<{ insert: [character: string] }>()
</script>

<template>
  <ul class="flex flex-wrap gap-1.5" aria-label="Caractères espagnols">
    <li v-for="key in KEYS" :key="key">
      <!-- `mousedown.prevent` garde le curseur dans le champ : sans lui, chaque
           caractère inséré ferait perdre le focus et la position de saisie. -->
      <button
        type="button"
        class="w-9 rounded-md border border-slate-300 bg-white py-1.5 text-base leading-none hover:border-accent-500 dark:border-slate-700 dark:bg-slate-900"
        @mousedown.prevent
        @click="$emit('insert', key)"
      >
        {{ key }}
      </button>
    </li>
  </ul>
</template>
