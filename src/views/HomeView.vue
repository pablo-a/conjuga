<script setup lang="ts">
import { computed, onMounted } from 'vue'

import { MODELS, TENSE_LABELS } from '@/conjugation'
import type { Tense } from '@/conjugation'
import { sheetFor } from '@/content'
import { successRate } from '@/srs/patterns'
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

const repeatsLabel = computed(() => plural(store.repeats, 'carte à repasser', 'cartes à repasser'))

const pendingLabel = computed(() =>
  store.pending > 1 ? `${store.pending} cartes reviendront` : `${store.pending} carte reviendra`,
)

const percent = computed(() => Math.round(store.levelMastery * 100))

/**
 * L'avancement de la journée, en pour cent.
 *
 * Le compte exact (« 12 / 48 ») reste affiché à côté : c'est lui qui informe, la
 * barre ne fait que le rendre saisissable sans lire. Un objectif nul n'arrive que
 * lorsqu'il n'y a rien à faire, et la barre n'est alors pas montrée.
 */
const dayPercent = computed(() =>
  store.goal > 0 ? Math.round((store.done / store.goal) * 100) : 0,
)

/**
 * Ce que l'accueil suggère de reprendre : un patron, sa fiche, et de quoi
 * l'exercer tout de suite.
 *
 * Nommer le patron plutôt que le verbe est tout l'intérêt de l'agrégat
 * `(modèle, temps)` : « tu rates 62 % des e→ie au présent » renvoie à une règle,
 * « tu rates pensar » ne renvoie qu'à un verbe.
 */
const weakness = computed(() => {
  const pattern = store.weakness
  if (pattern === null) return null

  const tense = pattern.tense as Tense
  const sheet = sheetFor(tense)
  if (sheet === undefined) return null

  return {
    label: MODELS[pattern.model]?.label ?? pattern.model,
    tense: TENSE_LABELS[tense],
    percent: Math.round((1 - successRate(pattern)) * 100),
    sheet,
  }
})
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
        <!-- La séance du jour est un travail borné, et l'écran doit le montrer
             comme tel : un objectif fixe, un avancement qui monte, une fin. Le
             décompte de ce qui reste ne suffisait pas — il ne disait pas de quoi
             il était parti, donc rien ne prouvait qu'il baissait. -->
        <template v-if="store.waiting > 0">
          <h2 class="text-lg font-semibold tracking-tight">Séance du jour</h2>

          <p class="mt-2 text-2xl font-semibold tabular-nums" data-progress>
            {{ store.done
            }}<span class="text-slate-400 dark:text-slate-600"> / {{ store.goal }}</span>
            <span class="ml-1 text-base font-normal text-slate-500 dark:text-slate-400">
              cartes
            </span>
          </p>

          <div
            class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
            role="progressbar"
            data-day-progress
            :aria-valuenow="store.done"
            :aria-valuemin="0"
            :aria-valuemax="store.goal"
            aria-label="Avancement de la séance du jour"
          >
            <div class="h-full bg-accent-500 transition-all" :style="{ width: `${dayPercent}%` }" />
          </div>

          <!-- Le programme peut être fait alors que la session propose encore
               des cartes : ce sont les repasses. Sans ce mot, « 48 / 48 » et
               « dix cartes t'attendent » se contrediraient à l'écran. -->
          <p
            v-if="store.onlyRepeatsLeft"
            class="mt-3 text-sm text-slate-500 dark:text-slate-400"
            data-repeats
          >
            Programme du jour fait. Il reste {{ repeatsLabel }} — la seconde vue d’une carte,
            quelques minutes après la première, et c’est elle qui l’ancre.
          </p>

          <p v-else class="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {{ waitingLabel }} —
            <template v-if="store.introduced > 0">{{ introducedLabel }}</template>
            <template v-else-if="store.plan?.paused">
              aucune nouveauté pour l’instant, {{ store.plan.backlog }} cartes en retard passent
              d’abord.
            </template>
            <template v-else>que des révisions.</template>
            <template v-if="store.repeats > 0">
              S’y ajoutent {{ repeatsLabel }}, hors objectif.
            </template>
          </p>

          <!-- Le budget de vingt minutes est un plafond : le reste attend demain.
               Le taire laisserait croire qu'une session éponge tout un retard. -->
          <p v-if="store.remaining > 0" class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {{ remainingLabel }}
          </p>

          <RouterLink
            :to="{ name: 'practice' }"
            class="mt-4 inline-block rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700"
          >
            {{ store.practicedToday ? 'Continuer' : 'Réviser' }}
          </RouterLink>
        </template>

        <!-- Le programme du jour est fait. C'est la seule chose que l'app
             demande, et elle doit le dire franchement plutôt que de la laisser
             deviner à un compteur tombé à zéro. -->
        <template v-else-if="store.finishedToday">
          <h2 class="text-lg font-semibold tracking-tight" data-finished>
            Séance du jour terminée.
          </h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ todayLabel }}</p>

          <!-- « Terminée » serait faux si dix cartes devaient reparaître dans
               dix minutes : on le dit avant que l'apprenant ne le découvre. -->
          <p v-if="store.pending > 0" class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {{ pendingLabel }} tout à l’heure pour une seconde vue — reviens quand tu veux, elles
            t’attendront.
          </p>
          <p
            v-else-if="store.remaining > 0"
            class="mt-1 text-sm text-slate-500 dark:text-slate-400"
          >
            {{ remainingLabel }}
          </p>
          <p v-else class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Les suivantes reviendront quand leur oubli deviendra probable.
          </p>

          <RouterLink
            :to="{ name: 'conjugator' }"
            class="mt-4 inline-block text-sm text-accent-600 hover:underline dark:text-accent-500"
          >
            En attendant, conjuguer un verbe
          </RouterLink>
        </template>

        <!-- Rien à réviser est l'état normal d'un apprenant à jour : c'est un
             résultat, pas un écran vide. À ne pas confondre avec le précédent —
             ici la journée n'a jamais eu de programme. -->
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

      <!-- La suggestion vient après la session du jour, jamais à sa place : le
           programme passe d'abord, et relire une fiche ne remplace pas de
           réviser. Elle se tait tant que trop peu de formes ont été demandées
           pour que le taux d'échec veuille dire quelque chose. -->
      <div
        v-if="weakness"
        class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30"
        data-weakness
      >
        <h2 class="text-sm font-semibold tracking-tight">Ton point faible du moment</h2>
        <p class="mt-1 text-sm text-slate-700 dark:text-slate-200">
          {{ weakness.label }} — {{ weakness.percent }} % d’erreurs ({{ weakness.tense }}).
        </p>
        <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <RouterLink
            :to="{ name: 'theory-sheet', params: { slug: weakness.sheet.slug } }"
            class="text-accent-600 hover:underline dark:text-accent-500"
          >
            Relire {{ weakness.sheet.title }}
          </RouterLink>
          <RouterLink
            :to="{ name: 'practice', query: { temps: weakness.sheet.tenses.join(',') } }"
            class="text-accent-600 hover:underline dark:text-accent-500"
          >
            S’exercer sur ce temps
          </RouterLink>
        </div>
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
          data-mastery
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

      <!--
        Le mode d'emploi de la mécanique, en toutes lettres.

        Un système de répétition espacée fait des choses que l'apprenant ne
        demande pas : il ramène une carte le jour même, il refuse d'en ouvrir une
        onzième, il met les nouveautés en pause. Chacune de ces décisions est
        bonne et incompréhensible de l'extérieur — non expliquées, elles se lisent
        comme des bugs, et c'est exactement ce qui s'est passé.

        Replié par défaut : il répond à une question, il ne s'impose pas à qui ne
        se la pose pas. `<details>` plutôt qu'un composant, parce que le pliage
        natif est déjà accessible au clavier et aux lecteurs d'écran.
      -->
      <details class="group mt-6" data-how>
        <summary
          class="cursor-pointer list-none text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <span class="underline decoration-dotted underline-offset-4">
            Comment fonctionne la séance ?
          </span>
        </summary>

        <dl class="mt-3 space-y-3 text-sm text-slate-500 dark:text-slate-400">
          <div>
            <dt class="font-medium text-slate-700 dark:text-slate-200">
              Une carte, c’est un verbe à un temps.
            </dt>
            <dd>
              <em>tener</em> au passé simple, par exemple. Elle est posée à deux ou trois personnes
              tirées au sort : savoir un verbe à quatre personnes sur six, ce n’est pas le savoir.
            </dd>
          </div>

          <div>
            <dt class="font-medium text-slate-700 dark:text-slate-200">
              Vingt minutes par jour, pas un nombre de cartes.
            </dt>
            <dd>
              La séance s’arrête sur un budget de temps. Un jour où tu réfléchis plus, tu fais moins
              de cartes — pas vingt minutes de plus. Le budget appartient à la journée : une seconde
              séance reprend là où la première s’est arrêtée.
            </dd>
          </div>

          <div>
            <dt class="font-medium text-slate-700 dark:text-slate-200">
              Dix nouvelles cartes par jour, pas plus.
            </dt>
            <dd>
              C’est le débit que les révisions à venir peuvent absorber durablement. En ouvrir
              davantage aujourd’hui, c’est se préparer une montagne dans trois semaines.
            </dd>
          </div>

          <div>
            <dt class="font-medium text-slate-700 dark:text-slate-200">
              Une carte revient quand tu es sur le point de l’oublier.
            </dt>
            <dd>
              C’est tout l’intérêt : réviser ce qu’on sait déjà n’apprend rien. À chaque réussite
              l’écart s’allonge — trois jours, puis deux semaines, puis deux mois.
            </dd>
          </div>

          <div>
            <dt class="font-medium text-slate-700 dark:text-slate-200">
              Une carte neuve ou ratée repasse dans la journée.
            </dt>
            <dd>
              Quelques minutes après la première vue, le temps de l’ancrer. C’est normal de la
              revoir, et ce passage <strong>ne compte pas</strong> dans l’objectif du jour : c’est
              pour cela que le compteur peut afficher 48 / 48 alors qu’il reste des cartes à
              repasser.
            </dd>
          </div>

          <div>
            <dt class="font-medium text-slate-700 dark:text-slate-200">
              En retard n’est pas perdu.
            </dt>
            <dd>
              Les cartes échues qui débordent des vingt minutes reviennent les jours suivants, les
              plus anciennes d’abord. Au-delà de soixante en attente, l’ouverture de nouveautés se
              met en pause le temps de rattraper.
            </dd>
          </div>

          <div>
            <dt class="font-medium text-slate-700 dark:text-slate-200">
              La série compte les jours.
            </dt>
            <dd>
              Un jour où tu as révisé au moins une carte. Ne pas avoir commencé aujourd’hui ne la
              rompt pas — la journée n’est pas finie ; c’est un lendemain sans séance qui la rompt.
            </dd>
          </div>
        </dl>
      </details>
    </template>
  </section>
</template>
