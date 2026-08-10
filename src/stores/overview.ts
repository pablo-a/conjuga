import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { COVERED_TENSES } from '@/content'
import { loadPatternStats, loadSnapshot, loadStudyDays } from '@/db/repository'
import { currentLevel, mastery, unlockedCards } from '@/srs/curriculum'
import type { Level } from '@/srs/curriculum'
import { weakest } from '@/srs/patterns'
import type { PatternCount } from '@/srs/patterns'
import { planSession } from '@/srs/selector'
import type { SessionPlan } from '@/srs/selector'
import { dayKey, streakLength } from '@/srs/streak'

/**
 * L'état de l'accueil : ce qui attend l'apprenant aujourd'hui, et où il en est.
 *
 * Il compose **la même session** que l'écran Pratique lancera, par le même
 * `planSession`. Compter les cartes dues autrement — une requête d'index sur les
 * échéances, par exemple — serait moins cher mais donnerait un nombre qui n'est
 * pas celui qu'on va poser : l'accueil promettrait 60 cartes là où la session en
 * pose 48, et la promesse est justement ce qui fait revenir.
 *
 * Comme le magasin de session, il ne décide de rien : il lit, il enchaîne des
 * modules purs, il expose.
 */

export type OverviewStatus = 'idle' | 'loading' | 'ready' | 'error'

/** Ce qui a déjà été fait dans la journée en cours. Voir `StudyDay`. */
export interface TodayTotals {
  cards: number
  answers: number
  planned: number
  introduced: number
}

export const useOverviewStore = defineStore('overview', () => {
  const status = ref<OverviewStatus>('idle')
  const error = ref<string | null>(null)

  const plan = shallowRef<SessionPlan | null>(null)
  const level = shallowRef<Level | null>(null)
  const levelMastery = ref(0)
  const streak = ref(0)
  const today = ref<TodayTotals>({ cards: 0, answers: 0, planned: 0, introduced: 0 })

  /**
   * Le patron le plus raté, quand il y en a un dont on puisse répondre.
   *
   * `weakest` applique le seuil de significativité : sous dix formes demandées,
   * un taux d'échec ne mesure rien, et l'accueil se tait plutôt que d'envoyer
   * relire une fiche au hasard. La recherche est bornée aux temps couverts par
   * une fiche pour que la suggestion mène toujours quelque part.
   */
  const weakness = shallowRef<PatternCount | null>(null)

  /** Combien de cartes la session posera, et combien seront nouvelles. */
  const waiting = computed(() => plan.value?.cards.length ?? 0)
  const introduced = computed(() => plan.value?.introduced ?? 0)

  /**
   * La journée, en deux nombres : ce qu'elle demande et ce qui en est fait.
   *
   * `done + waiting === goal` par construction, et c'est tout l'intérêt : ce que
   * l'apprenant révise passe d'un compte à l'autre au lieu de disparaître d'un
   * côté sans apparaître de l'autre. Un objectif qui bougerait en cours de route
   * ne serait pas un objectif.
   */
  const goal = computed(() => plan.value?.goal ?? 0)
  const done = computed(() => today.value.planned)

  /**
   * Les cartes que FSRS ramène avant ce soir : la seconde vue d'une nouveauté, ou
   * la reprise d'une carte ratée.
   *
   * Elles sont comptées à part parce qu'elles ne sont pas de l'objectif — les
   * additionner ferait grossir le dénominateur à mesure qu'on avance — mais elles
   * sont bel et bien à faire, et l'écran doit le dire au lieu de les laisser
   * apparaître comme un travail qui ne diminue pas.
   */
  const repeats = computed(() => plan.value?.repeats ?? 0)

  /** Les repasses encore à venir : dues plus tard dans la journée. */
  const pending = computed(() => plan.value?.pending ?? 0)

  /**
   * Les cartes échues que la session ne prendra pas : le budget de vingt minutes
   * est un plafond, et le reste attend demain. Le dire évite de laisser croire
   * qu'une session suffira à éponger un retard de trois semaines.
   */
  const remaining = computed(() => {
    if (plan.value === null) return 0
    const reviews = plan.value.cards.length - plan.value.introduced
    return Math.max(0, plan.value.backlog - reviews)
  })

  /** Vrai quand l'apprenant a déjà révisé au moins une carte aujourd'hui. */
  const practicedToday = computed(() => today.value.cards > 0)

  /**
   * La séance du jour est faite : il y avait un programme, il ne reste rien.
   *
   * À distinguer de « tout est à jour », qui est l'état de qui n'avait rien à
   * faire du tout. Les confondre priverait de sa récompense la seule chose que
   * l'app demande — revenir tous les jours — et laisserait croire à un écran vide.
   */
  const finishedToday = computed(() => waiting.value === 0 && done.value > 0)

  /**
   * Le programme du jour est fait, et il ne reste que des repasses.
   *
   * C'est un état à part entière, et le taire serait cruel : le compteur affiche
   * « 48 / 48 » pendant que la session propose encore dix cartes, et sans un mot
   * d'explication cela se lit comme un compteur qui ment.
   */
  const onlyRepeatsLeft = computed(() => waiting.value > 0 && waiting.value === repeats.value)

  async function load(now: Date = new Date()): Promise<void> {
    status.value = 'loading'
    error.value = null

    try {
      const [{ deck, progress }, days, stats] = await Promise.all([
        loadSnapshot(),
        loadStudyDays(),
        loadPatternStats(),
      ])

      const key = dayKey(now)
      const stamp = days.find((day) => day.id === key)
      today.value = {
        cards: stamp?.cards ?? 0,
        answers: stamp?.answers ?? 0,
        planned: stamp?.planned ?? 0,
        introduced: stamp?.introduced ?? 0,
      }

      const current = currentLevel(progress)
      // La journée doit être lue avant d'être planifiée : c'est ce qui en a déjà
      // été fait qui dit ce qu'il en reste.
      plan.value = planSession(deck, unlockedCards(progress), now, {
        today: { planned: today.value.planned, introduced: today.value.introduced },
      })
      level.value = current
      levelMastery.value = mastery(current, progress)

      streak.value = streakLength(
        days.map((day) => day.id),
        now,
      )
      weakness.value = weakest(stats, COVERED_TENSES, 1)[0] ?? null

      status.value = 'ready'
    } catch (cause) {
      // Sans persistance, l'accueil ne peut rien promettre d'exact : mieux vaut
      // le dire que d'afficher une série à zéro et un programme vide, qui
      // ressemblent à s'y méprendre à un compte neuf.
      error.value = cause instanceof Error ? cause.message : String(cause)
      status.value = 'error'
    }
  }

  return {
    status,
    error,
    plan,
    level,
    levelMastery,
    streak,
    today,
    weakness,
    waiting,
    introduced,
    goal,
    done,
    repeats,
    pending,
    remaining,
    practicedToday,
    finishedToday,
    onlyRepeatsLeft,
    load,
  }
})
