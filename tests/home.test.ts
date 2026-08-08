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
 */
async function seed(cards: readonly string[], due: Date, stability = 0): Promise<string[]> {
  await db.cards.bulkPut(
    cards.map((id) => ({
      id,
      ...parseCardId(id),
      fsrs: { ...newCardState(AT), stability },
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
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('0')
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
    expect(wrapper.text()).toContain('Déjà 1 carte revue aujourd’hui')
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
    expect(wrapper.text()).toContain('Que des révisions')
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
