import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db'
import { saveReview } from '@/db/repository'
import { router } from '@/router'
import { LEVELS, MASTERY_STABILITY_DAYS, parseCardId } from '@/srs/curriculum'
import { newCardState } from '@/srs/scheduler'
import { useOverviewStore } from '@/stores/overview'
import HomeView from '@/views/HomeView.vue'

/**
 * L'accueil est monté sur la vraie chaîne — magasin, curriculum, sélecteur,
 * IndexedDB — parce que ce qu'il annonce doit être exactement ce que la session
 * posera. Un magasin bouchonné vérifierait la mise en page et rien d'autre.
 *
 * Seul `Date` est simulé (`toFake: ['Date']`) : la série est une propriété du
 * calendrier, donc le test doit choisir le jour, mais figer les minuteries
 * bloquerait Dexie, qui s'en sert pour ses transactions.
 */

const AT = new Date('2026-08-08T09:00:00Z')
const A_DAY = 86_400_000

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AT)
  await db.delete()
  await db.open()
  setActivePinia(createPinia())
  await router.push('/')
  await router.isReady()
})

afterEach(() => {
  vi.useRealTimers()
})

async function home() {
  const wrapper = mount(HomeView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

/**
 * Range des cartes déjà vues, échues à la date donnée.
 *
 * `stability` n'est pas décoratif : c'est lui que le curriculum compare à
 * `MASTERY_STABILITY_DAYS` pour ouvrir le niveau suivant. Le laisser à zéro
 * garde le programme fermé au premier niveau, quoi qu'on écrive par ailleurs.
 *
 * `difficulty` va avec : `ts-fsrs` refuse une stabilité sans difficulté, et une
 * carte semée ainsi ferait échouer en silence la première révision qu'on lui
 * ferait passer.
 */
async function seed(cards: readonly string[], due: Date, stability = 0): Promise<string[]> {
  await db.cards.bulkPut(
    cards.map((id) => ({
      id,
      ...parseCardId(id),
      fsrs: { ...newCardState(AT), stability, ...(stability > 0 ? { difficulty: 5 } : {}) },
      due,
      reps: 1,
      lapses: 0,
    })),
  )
  return [...cards]
}

describe('écran d’accueil', () => {
  it('ouvre le programme à qui n’a jamais rien fait', async () => {
    const wrapper = await home()
    const store = useOverviewStore()

    expect(store.status).toBe('ready')
    // Rien en base : la session ne peut être faite que de nouveautés, plafonnées
    // à dix par jour.
    expect(store.waiting).toBe(10)
    expect(store.introduced).toBe(10)
    expect(store.goal).toBe(10)
    expect(wrapper.get('[data-progress]').text()).toContain('0 / 10')
    expect(wrapper.text()).toContain('10 cartes t’attendent')
    expect(wrapper.text()).toContain('dont 10 nouvelles')
  })

  it('mène à la session', async () => {
    const wrapper = await home()

    const start = wrapper.get('a[href*="pratique"]')
    expect(start.text()).toBe('Réviser')
  })

  it('nomme le niveau en cours et ce qu’il apprend', async () => {
    const wrapper = await home()

    expect(wrapper.text()).toContain('Le présent')
    expect(wrapper.text()).toContain('les plus fréquents au présent')
    expect(wrapper.get('[data-mastery]').attributes('aria-valuenow')).toBe('0')
  })

  it('annonce l’absence de série plutôt qu’un zéro', async () => {
    const wrapper = await home()
    expect(wrapper.get('[data-streak]').text()).toContain('Pas encore de série')
  })

  it('compte la série et propose de reprendre une fois la journée entamée', async () => {
    await saveReview({
      card: LEVELS[0]!.cards[0]!,
      grade: 'good',
      at: new Date(AT.getTime() - A_DAY),
      answers: [],
    })
    await saveReview({
      card: LEVELS[0]!.cards[1]!,
      grade: 'good',
      at: AT,
      answers: [],
    })

    const wrapper = await home()

    expect(useOverviewStore().streak).toBe(2)
    expect(wrapper.get('[data-streak]').text()).toContain('2 jours d’affilée')
    // Déjà commencé aujourd'hui : on reprend, on ne recommence pas.
    expect(wrapper.get('a[href*="pratique"]').text()).toBe('Continuer')
  })

  it('garde la série intacte tant que la journée n’est pas finie', async () => {
    await saveReview({
      card: LEVELS[0]!.cards[0]!,
      grade: 'good',
      at: new Date(AT.getTime() - A_DAY),
      answers: [],
    })

    const wrapper = await home()

    expect(wrapper.get('[data-streak]').text()).toContain('1 jour d’affilée')
    expect(wrapper.get('[data-streak]').text()).toContain('pour la garder')
  })

  /*
   * Le défaut que ces trois tests ferment : le décompte annoncé ne bougeait pas
   * quand on révisait. Deux causes, indépendantes — FSRS reposait la carte le jour
   * même, et le budget étant celui d'une *session*, chaque retour sur l'accueil
   * recomposait une séance entière, dix nouveautés comprises.
   */
  describe('séance du jour', () => {
    /** Révise les `count` premières cartes du programme, comme une séance le ferait. */
    async function revise(count: number, at = AT): Promise<void> {
      for (const card of LEVELS[0]!.cards.slice(0, count)) {
        await saveReview({ card, grade: 'good', at, answers: [] })
      }
    }

    it('avance à mesure qu’on révise', async () => {
      const before = await home()
      expect(before.get('[data-progress]').text()).toContain('0 / 10')
      expect(useOverviewStore().waiting).toBe(10)

      await revise(4)
      const after = await home()
      const store = useOverviewStore()

      expect(store.done).toBe(4)
      expect(store.waiting).toBe(6)
      // L'objectif, lui, ne bouge pas : c'est ce qui rend le compte crédible.
      expect(store.goal).toBe(10)
      expect(after.get('[data-progress]').text()).toContain('4 / 10')
      expect(after.get('[data-day-progress]').attributes('aria-valuenow')).toBe('4')
    })

    it('annonce la journée terminée quand elle l’est', async () => {
      await revise(10)

      const wrapper = await home()
      const store = useOverviewStore()

      expect(store.waiting).toBe(0)
      expect(store.finishedToday).toBe(true)
      expect(wrapper.get('[data-finished]').text()).toContain('Séance du jour terminée')
      expect(wrapper.text()).toContain('10 cartes revues aujourd’hui')
      // La séance est faite : on ne propose plus d'y retourner.
      expect(wrapper.find('a[href*="pratique"]').exists()).toBe(false)
    })

    it('ne confond pas la journée finie avec un programme vide', async () => {
      // « Tout est à jour » est l'état de qui n'avait rien à faire ; « terminée »
      // récompense un travail fait. Les confondre efface l'un des deux.
      await revise(10)
      expect((await home()).find('[data-finished]').exists()).toBe(true)

      await db.days.clear()
      await db.cards.clear()
      const fresh = await home()

      expect(useOverviewStore().finishedToday).toBe(false)
      expect(fresh.find('[data-finished]').exists()).toBe(false)
    })

    it('rouvre le programme le lendemain', async () => {
      // Le plafond de nouveautés est journalier : sans cela, il n'y aurait plus
      // jamais rien à découvrir après la première séance.
      await revise(10)
      vi.setSystemTime(new Date(AT.getTime() + A_DAY))

      const wrapper = await home()
      const store = useOverviewStore()

      expect(store.done).toBe(0)
      expect(store.introduced).toBe(10)
      // Vingt et non dix : les dix d'hier n'ont pas eu leur repasse, elles sont
      // restées au pas d'apprentissage et sont dues aujourd'hui. Elles ne sont
      // plus des repasses pour autant — un jour a passé.
      expect(store.repeats).toBe(0)
      expect(wrapper.get('[data-progress]').text()).toContain('0 / 20')
    })

    it('sort les repasses de l’objectif au lieu de le faire enfler', async () => {
      /*
       * Le symptôme d'origine, vu par le bon bout : FSRS ramène chaque nouveauté
       * dans les dix minutes. Si ces secondes vues comptaient, l'objectif
       * passerait de 10 à 20 pendant qu'on le remplit — le décompte paraîtrait
       * ne pas bouger, ce qui est précisément ce qu'on corrige.
       */
      await revise(10)
      // Les repasses sont dues dix minutes plus tard : avant cela, l'accueil
      // annonce qu'elles arrivent (`pending`) plutôt qu'une journée close.
      expect(useOverviewStore().pending).toBe(0)
      const justAfter = await home()
      expect(justAfter.get('[data-finished]').text()).toContain('Séance du jour terminée')
      expect(justAfter.text()).toContain('10 cartes reviendront tout à l’heure')

      vi.setSystemTime(new Date(AT.getTime() + 11 * 60_000))
      const wrapper = await home()
      const store = useOverviewStore()

      expect(store.done).toBe(10)
      expect(store.goal).toBe(10)
      expect(store.repeats).toBe(10)
      expect(store.onlyRepeatsLeft).toBe(true)
      expect(wrapper.get('[data-progress]').text()).toContain('10 / 10')
      expect(wrapper.get('[data-repeats]').text()).toContain('Programme du jour fait')
      expect(wrapper.get('[data-repeats]').text()).toContain('10 cartes à repasser')
    })

    it('explique la mécanique sans qu’on ait à la deviner', async () => {
      // Un SRS fait des choses qu'on ne lui demande pas — ramener une carte le
      // jour même, refuser d'en ouvrir une onzième. Non expliquées, elles se
      // lisent comme des bugs, et c'est ce qui s'est produit.
      const explainer = (await home()).get('[data-how]')

      expect(explainer.text()).toContain('Comment fonctionne la séance ?')
      expect(explainer.text()).toContain('repasse dans la journée')
      expect(explainer.text()).toContain('ne compte pas')
    })
  })

  it('dit que tout est à jour plutôt que de montrer un écran vide', async () => {
    // Toutes les cartes ouvertes vues, aucune échue : l'état normal d'un
    // apprenant à jour, pas une anomalie.
    await seed(LEVELS[0]!.cards, new Date(AT.getTime() + 7 * A_DAY))

    const wrapper = await home()

    expect(useOverviewStore().waiting).toBe(0)
    expect(wrapper.text()).toContain('Tout est à jour')
    expect(wrapper.find('a[href*="pratique"]').exists()).toBe(false)
    expect(wrapper.find('a[href*="conjugueur"]').exists()).toBe(true)
  })

  it('ne promet que ce que le budget de vingt minutes permet', async () => {
    // Le retard dépasse la capacité d'une session : annoncer les cartes échues
    // laisserait croire qu'une session éponge tout.
    const due = await seed(LEVELS[0]!.cards, new Date(AT.getTime() - A_DAY))
    const store = useOverviewStore()

    const wrapper = await home()

    expect(store.plan!.backlog).toBe(due.length)
    expect(store.waiting).toBeLessThan(due.length)
    expect(store.remaining).toBe(due.length - store.waiting)
    expect(wrapper.text()).toContain('que des révisions')
    expect(wrapper.text()).toContain(`${store.remaining} autres cartes échues`)
  })

  it('signale la pause des nouveautés au lieu de la subir en silence', async () => {
    const late = new Date(AT.getTime() - A_DAY)
    // Le retard doit dépasser `BACKLOG_PAUSE`, et les cartes du premier niveau
    // n'y suffisent pas : on le déclare acquis pour ouvrir le second, dont les
    // cartes en retard s'ajoutent alors au décompte.
    await seed(LEVELS[0]!.cards, late, MASTERY_STABILITY_DAYS)
    await seed(LEVELS[1]!.cards.slice(0, 30), late, MASTERY_STABILITY_DAYS)

    const wrapper = await home()
    const store = useOverviewStore()

    expect(store.plan!.paused).toBe(true)
    expect(store.introduced).toBe(0)
    expect(wrapper.text()).toContain('cartes en retard passent d’abord')
  })

  /*
   * `patternStats` mesure des patrons, pas des verbes : c'est ce qui permet à
   * l'accueil de renvoyer vers une règle et vers la fiche qui l'explique, au
   * lieu de désigner un verbe dont on ne tirerait rien.
   */
  it('désigne le patron le plus raté, et de quoi le reprendre', async () => {
    await db.patternStats.bulkPut([
      {
        id: 'pensar:indicativo.presente',
        model: 'pensar',
        tense: 'indicativo.presente',
        attempts: 20,
        errors: 13,
      },
      {
        id: 'hablar:indicativo.presente',
        model: 'hablar',
        tense: 'indicativo.presente',
        attempts: 40,
        errors: 1,
      },
    ])

    const wrapper = await home()
    const suggestion = wrapper.get('[data-weakness]')

    expect(suggestion.text()).toContain('65 %')
    expect(suggestion.get('a[href*="theorie"]').attributes('href')).toContain('present')
    // Relire ne suffit pas : la suggestion doit aussi mener au drill du temps.
    expect(suggestion.get('a[href*="pratique"]').attributes('href')).toContain(
      'indicativo.presente',
    )
  })

  it('se tait tant que trop peu de formes ont été demandées pour conclure', async () => {
    // Une forme ratée une fois donne 100 % d'échec : ce n'est pas une faiblesse,
    // c'est un manque de données, et désigner une fiche là-dessus serait du bruit.
    await db.patternStats.put({
      id: 'pensar:indicativo.presente',
      model: 'pensar',
      tense: 'indicativo.presente',
      attempts: 1,
      errors: 1,
    })

    const wrapper = await home()

    expect(useOverviewStore().weakness).toBeNull()
    expect(wrapper.find('[data-weakness]').exists()).toBe(false)
  })

  it('dit son impuissance quand le stockage est indisponible', async () => {
    // Afficher une série à zéro et un programme neuf serait indiscernable d'un
    // compte vierge : l'apprenant croirait avoir tout perdu.
    await db.close()
    vi.spyOn(db, 'open').mockRejectedValueOnce(new Error('stockage refusé'))

    const wrapper = await home()

    expect(useOverviewStore().status).toBe('error')
    expect(wrapper.text()).toContain('stockage local')
  })
})
