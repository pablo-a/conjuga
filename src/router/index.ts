import { createRouter, createWebHistory } from 'vue-router'

import HomeView from '@/views/HomeView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { title: 'Accueil' } },
    {
      path: '/pratique',
      name: 'practice',
      component: () => import('@/views/PracticeView.vue'),
      meta: { title: 'Pratique' },
    },
    {
      path: '/theorie',
      name: 'theory',
      component: () => import('@/views/TheoryView.vue'),
      meta: { title: 'Théorie' },
    },
    {
      path: '/conjugueur',
      name: 'conjugator',
      component: () => import('@/views/ConjugatorView.vue'),
      meta: { title: 'Conjugueur' },
    },
    {
      path: '/stats',
      name: 'stats',
      component: () => import('@/views/StatsView.vue'),
      meta: { title: 'Statistiques' },
    },
    {
      path: '/reglages',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: 'Réglages' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} — Conjuga` : 'Conjuga'
})
