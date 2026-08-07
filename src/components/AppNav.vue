<script setup lang="ts">
// Barre de navigation basse : c'est la cible principale sur mobile, et l'app est
// pensée pour une session quotidienne de 20 minutes au téléphone.
const links = [
  { to: '/', label: 'Accueil' },
  { to: '/pratique', label: 'Pratique' },
  { to: '/theorie', label: 'Théorie' },
  { to: '/conjugueur', label: 'Conjugueur' },
  { to: '/stats', label: 'Stats' },
] as const

// Actif et inactif s'excluent : on ne pose jamais les deux jeux de classes de couleur
// en même temps. Deux utilitaires Tailwind de même spécificité seraient départagés par
// l'ordre du CSS généré, ce qui est fragile et invisible à la relecture.
const ACTIVE = 'text-accent-600 dark:text-accent-500'
const INACTIVE = 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90"
    aria-label="Navigation principale"
  >
    <ul class="mx-auto flex max-w-2xl">
      <li v-for="link in links" :key="link.to" class="flex-1">
        <RouterLink v-slot="{ href, navigate, isExactActive }" :to="link.to" custom>
          <a
            :href="href"
            :class="[
              'flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
              isExactActive ? ACTIVE : INACTIVE,
            ]"
            :aria-current="isExactActive ? 'page' : undefined"
            @click="navigate"
          >
            {{ link.label }}
          </a>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
