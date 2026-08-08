<script setup lang="ts">
import { computed, onMounted } from 'vue'

import { useOverviewStore } from '@/stores/overview'

const store = useOverviewStore()

// L'accueil se relit à chaque visite : on y revient après une session, et un état
// figé annoncerait encore les cartes qu'on vient tout juste de réviser.
onMounted(() => void store.load())

/*
 * Les phrases sont composées ici plutôt que dans le gabarit. Le français
 * n'accorde pas qu'un « s » — « une carte t'attend » contre « des cartes
 * t'attendent » — et éclater cet accord en interpolations rend le texte
 * illisible à la relecture, donc faux à la première modification.
 */
const plural = (count: number, one: string, many: string): string =>
  `${count} ${count > 1 ? many : one}`

const streakLabel = computed(() => plural(store.streak, 'jour', 'jours') + ' d’affilée')

const waitingLabel = computed(() =>
  store.waiting > 1 ? `${store.waiting} cartes t’attendent` : `${store.waiting} carte t’attend`,
)

const introducedLabel = computed(() => `dont ${plural(store.introduced, 'nouvelle', 'nouvelles')}.`)

const remainingLabel = computed(() =>
  store.remaining > 1
    ? `${store.remaining} autres cartes échues reviendront les jours suivants.`
    : 'Une autre carte échue reviendra les jours suivants.',
)

const todayLabel = computed(
  () => plural(store.today.cards, 'carte revue', 'cartes revues') + ' aujourd’hui.',
)

const percent = computed(() => Math.round(store.levelMastery * 100))
</script>

<template>
  <section>
    <h1 class="text-2xl font-semibold tracking-tight">Aujourd’hui</h1>

    <p
      v-if="store.status === 'loading' || store.status === 'idle'"
      class="mt-6 text-sm text-slate-500 dark:text-slate-400"
    >
      Chargement de la progression…
    </p>

    <p
      v-else-if="store.status === 'error'"
      class="mt-6 rounded-lg border border-rose-200 bg-white p-4 text-sm text-slate-700 dark:border-rose-900 dark:bg-slate-900 dark:text-slate-200"
    >
      La progression ne peut pas être lue sur cet appareil. Vérifie que le navigateur autorise le
      stockage local — la navigation privée le refuse souvent.
      <span class="mt-2 block text-xs text-slate-500 dark:text-slate-400">{{ store.error }}</span>
    </p>

    <template v-else>
      <!-- La série d'abord : à vingt minutes par jour, c'est l'assiduité qui fait
           progresser, pas le score d'une session. -->
      <p class="mt-4 text-sm text-slate-500 dark:text-slate-400" data-streak>
        <template v-if="store.streak > 0">
          <span class="font-semibold text-accent-600 dark:text-accent-500">{{ streakLabel }}</span>
          <template v-if="!store.practicedToday"> — à toi de jouer pour la garder.</template>
        </template>
        <template v-else>Pas encore de série : elle commence à la première session.</template>
      </p>

      <div
        class="mt-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <template v-if="store.waiting > 0">
          <h2 class="text-lg font-semibold tracking-tight">{{ waitingLabel }}</h2>

          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            <template v-if="store.introduced > 0">{{ introducedLabel }}</template>
            <template v-else-if="store.plan?.paused">
              Aucune nouveauté pour l’instant : {{ store.plan.backlog }} cartes en retard passent
              d’abord.
            </template>
            <template v-else>Que des révisions.</template>
          </p>

          <!-- Le budget de vingt minutes est un plafond : le reste attend demain.
               Le taire laisserait croire qu'une session éponge tout un retard. -->
          <p v-if="store.remaining > 0" class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {{ remainingLabel }}
          </p>

          <p v-if="store.practicedToday" class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Déjà {{ todayLabel }}
          </p>

          <RouterLink
            :to="{ name: 'practice' }"
            class="mt-4 inline-block rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700"
          >
            {{ store.practicedToday ? 'Continuer' : 'Réviser' }}
          </RouterLink>
        </template>

        <!-- Rien à réviser est l'état normal d'un apprenant à jour : c'est un
             résultat, pas un écran vide. -->
        <template v-else>
          <h2 class="text-lg font-semibold tracking-tight">Tout est à jour.</h2>
          <p v-if="store.practicedToday" class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {{ todayLabel }} Les suivantes reviendront quand leur oubli deviendra probable.
          </p>
          <p v-else class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Reviens demain : les cartes réapparaissent quand leur oubli devient probable.
          </p>

          <RouterLink
            :to="{ name: 'conjugator' }"
            class="mt-4 inline-block text-sm text-accent-600 hover:underline dark:text-accent-500"
          >
            En attendant, conjuguer un verbe
          </RouterLink>
        </template>
      </div>

      <div v-if="store.level" class="mt-4">
        <div class="flex items-baseline justify-between">
          <h2 class="text-sm font-medium">{{ store.level.name }}</h2>
          <span class="text-xs text-slate-500 dark:text-slate-400">{{ percent }} %</span>
        </div>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ store.level.goal }}</p>
        <div
          class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          role="progressbar"
          :aria-valuenow="percent"
          :aria-valuemin="0"
          :aria-valuemax="100"
          aria-label="Maîtrise du niveau en cours"
        >
          <div class="h-full bg-accent-500 transition-all" :style="{ width: `${percent}%` }" />
        </div>
        <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Le niveau suivant s’ouvre à 80 % de cartes acquises.
        </p>
      </div>
    </template>
  </section>
</template>
