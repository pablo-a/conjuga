<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import AccentKeys from '@/components/AccentKeys.vue'
import VerbForm from '@/components/VerbForm.vue'
import { PERSON_LABELS, PERSON_PRONOUNS, TENSE_LABELS, TENSES } from '@/conjugation'
import type { Tense } from '@/conjugation'
import { sheetFor } from '@/content'
import type { IdentityOption } from '@/exercises/identification'
import type { Choice } from '@/exercises/recognition'
import { useSessionStore } from '@/stores/session'

const store = useSessionStore()
const route = useRoute()

/**
 * Les temps auxquels l'URL restreint la session : `/pratique?temps=…`.
 *
 * La session ciblée vit dans l'URL comme la recherche du Conjugueur, et pour la
 * même raison — elle se partage, se met en favori et survit à un rechargement.
 * Les valeurs sont validées contre le moteur : un paramètre trafiqué doit rendre
 * la session ordinaire, pas une session vide.
 */
const focus = computed<Tense[] | undefined>(() => {
  const raw = route.query.temps
  if (typeof raw !== 'string') return undefined
  const tenses = raw.split(',').filter((tense): tense is Tense => TENSES.includes(tense as Tense))
  return tenses.length > 0 ? tenses : undefined
})

/** Ce que la session cible, en toutes lettres. */
const focusLabel = computed(() =>
  (store.focus ?? []).map((tense) => TENSE_LABELS[tense]).join(' et '),
)

/**
 * La fiche qui explique le temps interrogé, quand elle existe.
 *
 * C'est le prolongement naturel du surlignage : l'écran montre *où* est
 * l'irrégularité, la fiche dit *pourquoi*. Tant que tous les temps n'ont pas la
 * leur, le lien s'efface au lieu de mener à une page vide.
 */
const sheet = computed(() => (store.answered ? sheetFor(store.answered.exercise.tense) : undefined))

const text = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const continueEl = ref<HTMLButtonElement | null>(null)

// Revenir sur l'écran ne recompose pas la session : les questions déjà tirées
// restent celles qu'on avait commencées, sinon naviguer vers la théorie au milieu
// d'une session la ferait recommencer.
onMounted(() => {
  if (store.status === 'idle') void begin()
})

/*
 * Changer de cible relance, en revanche. La vue est réutilisée d'une requête à
 * l'autre — arriver ici depuis une fiche pendant une session en cours ne
 * remonterait rien, et l'apprenant se verrait poser les questions qu'il venait
 * précisément de quitter.
 */
watch(
  () => route.query.temps,
  () => void begin(),
)

async function begin(): Promise<void> {
  store.reset()
  text.value = ''
  await store.start(focus.value ? { focus: focus.value } : {})
  await focusInput()
}

const progress = computed(() =>
  store.total > 0 ? Math.round((store.completed / store.total) * 100) : 0,
)

/**
 * Ce que l'apprenant lit après avoir validé.
 *
 * Le sens est porté par la phrase, pas par la couleur : une correction qui ne se
 * distingue qu'au vert et au rouge n'est pas lisible pour tout le monde.
 */
const VERDICTS = {
  correct: { title: 'Exact.', tone: 'text-emerald-700 dark:text-emerald-400' },
  accent: {
    title: 'Presque — c’est l’accent tonique.',
    tone: 'text-amber-700 dark:text-amber-400',
  },
  wrong: { title: 'Non.', tone: 'text-rose-700 dark:text-rose-400' },
} as const

const verdict = computed(() => (store.answered ? VERDICTS[store.answered.grade.verdict] : null))

/**
 * Le champ n'existe qu'en production : sur un QCM il n'y a rien à taper, et
 * viser un élément absent ne ferait que renvoyer le focus en tête de page.
 */
async function focusInput(): Promise<void> {
  await nextTick()
  inputEl.value?.focus()
}

/**
 * Le formulaire porte les deux temps de l'exercice : répondre, puis lire la
 * correction et avancer. Un seul point d'entrée, donc `Entrée` enchaîne les
 * questions sans jamais quitter le clavier.
 */
async function onSubmit(): Promise<void> {
  if (store.answered !== null) {
    store.next()
    text.value = ''
    await focusInput()
    return
  }

  // Sur un QCM, le formulaire ne sert qu'à avancer : la réponse se donne en
  // désignant une proposition, il n'y a rien à valider.
  if (store.current?.kind !== 'drill') return
  if (text.value.trim().length === 0) return
  await answer(text.value)
}

/** Renoncer est une réponse : elle vaut faux, et elle montre la forme. */
async function giveUp(): Promise<void> {
  await answer('')
}

async function answer(given: string): Promise<void> {
  await store.submit(given)
  await nextTick()
  continueEl.value?.focus()
}

/** Insère un caractère à la position du curseur, pas en fin de champ. */
function insert(character: string): void {
  const el = inputEl.value
  if (!el) {
    text.value += character
    return
  }

  const start = el.selectionStart ?? text.value.length
  const end = el.selectionEnd ?? start
  text.value = text.value.slice(0, start) + character + text.value.slice(end)

  void nextTick(() => {
    el.focus()
    const caret = start + character.length
    el.setSelectionRange(caret, caret)
  })
}

/**
 * L'habillage d'une proposition, avant et après la réponse.
 *
 * Une fois corrigé, la bonne forme se marque **toujours**, y compris quand elle
 * a été trouvée : c'est elle qu'il faut retenir, et la laisser se confondre avec
 * les trois autres perdrait la seule ligne qui vaille la peine d'être relue.
 */
function toneOf(option: Choice | IdentityOption): string {
  if (store.answered === null) {
    return 'border-slate-300 hover:border-accent-500 dark:border-slate-700'
  }
  if (option.correct) {
    return 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
  }
  return store.answered.grade.given === option.value
    ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/30'
    : 'border-slate-200 opacity-60 dark:border-slate-800'
}

/** Relancer garde la cible : on enchaîne le drill qu'on était venu faire. */
const restart = begin
</script>

<template>
  <section>
    <h1 class="text-2xl font-semibold tracking-tight">Pratique</h1>

    <!-- Une session ciblée ne suit pas le programme : le dire évite de croire
         que la progression du jour avance pendant qu'on répète un seul temps. -->
    <p v-if="store.focus" class="mt-2 text-sm text-slate-500 dark:text-slate-400" data-focus>
      Session ciblée sur {{ focusLabel }}.
      <RouterLink
        :to="{ name: 'practice' }"
        class="text-accent-600 hover:underline dark:text-accent-500"
      >
        Revenir à la session du jour
      </RouterLink>
    </p>

    <p
      v-if="store.status === 'loading' || store.status === 'idle'"
      class="mt-6 text-sm text-slate-500 dark:text-slate-400"
    >
      Préparation de la session…
    </p>

    <p
      v-else-if="store.status === 'error'"
      class="mt-6 rounded-lg border border-rose-200 bg-white p-4 text-sm text-slate-700 dark:border-rose-900 dark:bg-slate-900 dark:text-slate-200"
    >
      La progression ne peut pas être enregistrée sur cet appareil, et une session dont le résultat
      serait perdu n’apprend rien. Vérifie que le navigateur autorise le stockage local — la
      navigation privée le refuse souvent.
      <span class="mt-2 block text-xs text-slate-500 dark:text-slate-400">{{ store.error }}</span>
    </p>

    <!-- Rien à réviser n'est pas un écran vide : c'est le résultat normal d'un
         système de répétition espacée à jour, et il faut le dire ainsi. -->
    <div v-else-if="store.empty" class="mt-6">
      <!-- Une session ciblée vide ne veut pas dire « à jour » : elle veut dire
           que le programme n'a pas encore ouvert ce temps, puisqu'elle accepte
           même les cartes en avance sur leur échéance. -->
      <template v-if="store.focus">
        <p class="text-slate-700 dark:text-slate-200">
          Ce temps n’est pas encore ouvert dans ton programme.
        </p>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Les niveaux le débloqueront le moment venu. En attendant, la fiche se lit, et le
          Conjugueur montre n’importe quel verbe à ce temps.
        </p>
        <RouterLink
          :to="{ name: 'practice' }"
          class="mt-4 inline-block text-sm text-accent-600 hover:underline dark:text-accent-500"
        >
          Faire la session du jour
        </RouterLink>
      </template>

      <!-- Le budget est celui de la journée : une session vide après une séance
           faite ne veut pas dire « tout est à jour », elle veut dire « c'est fait
           pour aujourd'hui ». Les confondre effacerait le travail accompli. -->
      <template v-else-if="(store.plan?.goal ?? 0) > 0">
        <p class="text-slate-700 dark:text-slate-200" data-finished>
          La séance du jour est terminée — {{ store.plan!.goal }} cartes revues, repasses comprises.
        </p>
        <p v-if="store.plan?.paused" class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          L’introduction de nouvelles cartes reste en pause : {{ store.plan.backlog }} cartes en
          retard. Elles reviendront d’abord.
        </p>
        <p v-else class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          À demain : c’est l’espacement qui fait tenir, pas la quantité.
        </p>
        <RouterLink
          :to="{ name: 'home' }"
          class="mt-4 inline-block text-sm text-accent-600 hover:underline dark:text-accent-500"
        >
          Retour à l’accueil
        </RouterLink>
      </template>

      <!-- Le dernier cas est celui de qui n'avait rien à faire du tout : ni carte
           échue, ni nouveauté à ouvrir, ni journée entamée. -->
      <template v-else>
        <p class="text-slate-700 dark:text-slate-200">
          Rien à réviser pour l’instant — tout est à jour.
        </p>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Reviens demain : les cartes réapparaissent quand leur oubli devient probable.
        </p>
      </template>
    </div>

    <div v-else-if="store.status === 'done'" class="mt-6">
      <h2 class="text-lg font-semibold tracking-tight">Session terminée</h2>
      <p class="mt-1 text-slate-700 dark:text-slate-200">
        {{ store.summary.cards }} cartes revues, {{ store.total }} formes demandées.
      </p>
      <dl class="mt-4 grid grid-cols-3 gap-3 text-center">
        <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <dt class="text-xs text-slate-500 dark:text-slate-400">Exactes</dt>
          <dd class="text-xl font-semibold text-emerald-700 dark:text-emerald-400">
            {{ store.summary.correct }}
          </dd>
        </div>
        <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <dt class="text-xs text-slate-500 dark:text-slate-400">Accent</dt>
          <dd class="text-xl font-semibold text-amber-700 dark:text-amber-400">
            {{ store.summary.accent }}
          </dd>
        </div>
        <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <dt class="text-xs text-slate-500 dark:text-slate-400">Fausses</dt>
          <dd class="text-xl font-semibold text-rose-700 dark:text-rose-400">
            {{ store.summary.wrong }}
          </dd>
        </div>
      </dl>
      <button
        type="button"
        class="mt-4 rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700"
        @click="restart"
      >
        Nouvelle session
      </button>
    </div>

    <template v-else-if="store.current">
      <div class="mt-4">
        <div class="flex items-baseline justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{{ store.level?.name }}</span>
          <span>{{ store.completed }} / {{ store.total }}</span>
        </div>
        <div
          class="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          role="progressbar"
          :aria-valuenow="store.completed"
          :aria-valuemin="0"
          :aria-valuemax="store.total"
          aria-label="Progression de la session"
        >
          <div class="h-full bg-accent-500 transition-all" :style="{ width: `${progress}%` }" />
        </div>
      </div>

      <!-- Une écriture ratée n'interrompt pas la session — ce qui est rangé
           l'est, et recommencer ne servirait à rien. Mais la taire laisserait
           travailler vingt minutes pour rien : on le dit, discrètement. -->
      <p
        v-if="store.error"
        class="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-slate-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-slate-200"
        role="status"
        data-save-warning
      >
        La progression de la dernière carte n’a pas pu être enregistrée. Tu peux continuer, mais
        vérifie que le navigateur autorise le stockage local.
      </p>

      <div
        class="mt-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <!-- L'identification ne peut pas afficher son en-tête habituel : le temps
             et le verbe *sont* la réponse. C'est la forme qu'on montre, et rien
             d'autre. -->
        <template v-if="store.current.kind === 'identify'">
          <p class="text-xs tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Cette forme, c’est…
          </p>
          <h2 class="mt-1 text-2xl font-semibold tracking-tight" data-form-asked>
            {{ store.current.form.value }}
          </h2>
        </template>

        <template v-else>
          <p class="text-xs tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {{ TENSE_LABELS[store.current.tense] }}
          </p>
          <h2 class="mt-1 text-2xl font-semibold tracking-tight" data-lemma>
            {{ store.current.lemma }}
          </h2>
        </template>

        <form class="mt-4" @submit.prevent="onSubmit">
          <template v-if="store.current.kind === 'drill'">
            <label for="reponse" class="text-sm text-slate-500 dark:text-slate-400">
              {{ PERSON_LABELS[store.current.person] }}
            </label>
            <input
              id="reponse"
              ref="inputEl"
              v-model="text"
              type="text"
              :readonly="store.answered !== null"
              autocomplete="off"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
              enterkeyhint="done"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-lg outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 read-only:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:read-only:bg-slate-950"
            />

            <AccentKeys v-if="store.answered === null" class="mt-2" @insert="insert" />
          </template>

          <!-- L'exercice inverse : trois choses à nommer d'un coup, chaque leurre
               n'en déviant qu'une. C'est ce qui oblige à les vérifier toutes. -->
          <template v-else-if="store.current.kind === 'identify'">
            <p id="consigne" class="text-sm text-slate-500 dark:text-slate-400">
              Quel verbe, quel temps, quelle personne ?
            </p>
            <ul class="mt-2 space-y-2" aria-labelledby="consigne" data-options>
              <li v-for="option in store.current.options" :key="option.value">
                <button
                  type="button"
                  :disabled="store.answered !== null"
                  class="w-full rounded-lg border px-3 py-2 text-left disabled:cursor-default"
                  :class="toneOf(option)"
                  @click="answer(option.value)"
                >
                  <span class="font-medium">{{ option.lemma }}</span>
                  <span class="text-slate-500 dark:text-slate-400">
                    · {{ TENSE_LABELS[option.tense] }} · {{ PERSON_PRONOUNS[option.person] }}
                  </span>
                  <span
                    v-if="store.answered && option.label"
                    class="block text-xs text-slate-500 dark:text-slate-400"
                  >
                    {{ option.label }}
                  </span>
                </button>
              </li>
            </ul>
          </template>

          <!-- La reconnaissance ouvre les cartes neuves : on montre la forme
               avant de demander de l'écrire. La consigne dit donc la personne,
               comme au drill — c'est la même case qu'on interroge. -->
          <template v-else>
            <p id="consigne" class="text-sm text-slate-500 dark:text-slate-400">
              Laquelle est la forme de {{ PERSON_LABELS[store.current.person] }} ?
            </p>
            <ul class="mt-2 space-y-2" aria-labelledby="consigne" data-choices>
              <li v-for="choice in store.current.choices" :key="choice.value">
                <button
                  type="button"
                  :disabled="store.answered !== null"
                  class="w-full rounded-lg border px-3 py-2 text-left text-lg disabled:cursor-default"
                  :class="toneOf(choice)"
                  @click="answer(choice.value)"
                >
                  {{ choice.value }}
                  <!-- Après coup, chaque proposition dit ce qu'elle était : une
                       croix rouge n'apprend rien, « c'était le présent » situe
                       l'erreur. -->
                  <span
                    v-if="store.answered && choice.label"
                    class="block text-xs text-slate-500 dark:text-slate-400"
                  >
                    {{ choice.label
                    }}<template v-if="choice.reason"> — {{ choice.reason }}</template>
                  </span>
                </button>
              </li>
            </ul>
          </template>

          <div class="mt-4 flex gap-2">
            <button
              v-if="store.answered === null && store.current.kind === 'drill'"
              type="submit"
              :disabled="text.trim().length === 0"
              class="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-40"
            >
              Valider
            </button>
            <button
              v-if="store.answered === null && store.current.kind === 'drill'"
              type="button"
              class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300"
              @click="giveUp"
            >
              Je ne sais pas
            </button>
            <button
              v-if="store.answered !== null"
              ref="continueEl"
              type="submit"
              class="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700"
            >
              Continuer
            </button>
          </div>
        </form>
      </div>

      <!-- La correction est annoncée : sur mobile elle apparaît sous le clavier,
           et un lecteur d'écran doit l'entendre sans avoir à la chercher. -->
      <div
        v-if="store.answered && verdict"
        aria-live="polite"
        class="mt-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <p class="font-medium" :class="verdict.tone">{{ verdict.title }}</p>

        <p
          v-if="store.answered.grade.verdict !== 'correct' && store.answered.grade.given.length > 0"
          class="mt-1 text-sm text-slate-500 dark:text-slate-400"
        >
          {{ store.answered.exercise.kind === 'drill' ? 'Tu as écrit' : 'Tu as choisi' }}
          « {{ store.answered.grade.given }} ».
        </p>

        <!-- Toujours la forme complète, même quand la réponse est juste : c'est
             là que le segment irrégulier se voit et que la règle s'apprend. -->
        <p class="mt-2 text-lg"><VerbForm :form="store.answered.exercise.form" /></p>

        <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <RouterLink
            v-if="sheet"
            :to="{ name: 'theory-sheet', params: { slug: sheet.slug } }"
            class="text-accent-600 hover:underline dark:text-accent-500"
          >
            {{ sheet.title }}
          </RouterLink>
          <RouterLink
            :to="{ name: 'conjugator', query: { v: store.answered.exercise.lemma } }"
            class="text-accent-600 hover:underline dark:text-accent-500"
          >
            Tout le tableau de {{ store.answered.exercise.lemma }}
          </RouterLink>
        </div>
      </div>
    </template>
  </section>
</template>
