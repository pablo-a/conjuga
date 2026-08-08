import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/db'
import { router } from '@/router'
import { LEVELS, parseCardId } from '@/srs/curriculum'
import { newCardState } from '@/srs/scheduler'
import { useSessionStore } from '@/stores/session'
import PracticeView from '@/views/PracticeView.vue'

/**
 * L'écran est monté sur la vraie chaîne — magasin, moteur, IndexedDB — parce que
 * c'est justement l'assemblage qu'il faut vérifier : chaque pièce est déjà testée
 * seule, et un magasin bouchonné ne dirait rien de leur rencontre.
 *
 * Le hasard est neutralisé (`() => 0`), ce qui rend la session entièrement
 * prévisible : dix nouvelles cartes prises en tête du curriculum, trois personnes
 * chacune. La première question est donc toujours `ser` à la deuxième personne.
 */

const AT = new Date('2026-08-08T09:00:00Z')

beforeEach(async () => {
  await db.delete()
  await db.open()
  setActivePinia(createPinia())
  await router.push('/pratique')
  await router.isReady()
})

type Wrapper = ReturnType<typeof mount<typeof PracticeView>>

/**
 * Compose la session avant le montage : l'écran ne démarre que s'il trouve le
 * magasin au repos, ce qui laisse le test choisir la graine.
 */
async function practice(random: () => number = () => 0): Promise<Wrapper> {
  await useSessionStore().start(AT, random)
  const wrapper = mount(PracticeView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

/** Répond à la question courante et attend la correction. */
async function answer(wrapper: Wrapper, text: string): Promise<void> {
  await wrapper.get('#reponse').setValue(text)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

/** Passe à la question suivante, une fois la correction lue. */
async function next(wrapper: Wrapper): Promise<void> {
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

/** Enchaîne `count` bonnes réponses, pour atteindre une question précise. */
async function advance(wrapper: Wrapper, count: number): Promise<void> {
  const store = useSessionStore()
  for (let done = 0; done < count; done++) {
    await answer(wrapper, store.current!.form.value)
    await next(wrapper)
  }
}

describe('écran Pratique', () => {
  it('pose une question de la session du jour', async () => {
    const wrapper = await practice()
    const store = useSessionStore()

    expect(store.status).toBe('running')
    expect(wrapper.get('[data-lemma]').text()).toBe('ser')
    // La consigne doit dire le temps *et* la personne : sans les deux, la
    // question n'a pas de réponse unique.
    expect(wrapper.text()).toContain('présent de l’indicatif')
    expect(wrapper.get('label[for="reponse"]').text()).toBe('tú')
  })

  it('valide une forme exacte, et montre quand même la forme', async () => {
    const wrapper = await practice()

    await answer(wrapper, 'eres')

    expect(wrapper.text()).toContain('Exact.')
    // Même juste, la forme est réaffichée : c'est là que le segment irrégulier
    // se voit, et l'apprenant qui a deviné apprend la règle.
    expect(wrapper.get('[data-form]').text()).toBe('eres')
  })

  it('distingue la faute d’accent d’une forme fausse', async () => {
    // Quatrième question de la session : `estar` à la deuxième personne, où
    // l'accent est le seul écart possible.
    const wrapper = await practice()
    await advance(wrapper, 3)
    expect(useSessionStore().current!.form.value).toBe('estás')

    await answer(wrapper, 'estas')

    expect(wrapper.text()).toContain('accent tonique')
    expect(wrapper.text()).not.toContain('Non.')
  })

  it('traite « je ne sais pas » comme une réponse fausse qui enseigne', async () => {
    const wrapper = await practice()
    const store = useSessionStore()

    const give = wrapper.findAll('button').find((button) => button.text() === 'Je ne sais pas')
    await give!.trigger('click')
    await flushPromises()

    expect(store.answered!.grade.verdict).toBe('wrong')
    expect(wrapper.text()).toContain('Non.')
    expect(wrapper.get('[data-form]').text()).toBe('eres')
  })

  it('renvoie vers le tableau complet du verbe interrogé', async () => {
    const wrapper = await practice()
    await answer(wrapper, 'eres')

    expect(wrapper.get('a[href*="conjugueur"]').attributes('href')).toContain('v=ser')
  })

  it('range la carte dès sa dernière personne, pas en fin de session', async () => {
    // Une session de vingt minutes interrompue ne doit pas perdre ce qui a été
    // révisé : c'est la raison d'être de l'écriture carte par carte.
    const wrapper = await practice()
    const store = useSessionStore()

    const card = store.current!.card
    const questions = store.drills.filter((drill) => drill.card === card).length
    expect(questions).toBe(3)

    for (let asked = 0; asked < questions; asked++) {
      expect(await db.cards.count(), `avant la question ${asked + 1}`).toBe(0)
      await answer(wrapper, store.current!.form.value)
      await next(wrapper)
    }

    expect(await db.cards.count()).toBe(1)
    expect((await db.cards.get(card))!.reps).toBe(1)
    expect(await db.answers.count()).toBe(questions)
  })

  it('avance la progression une question à la fois', async () => {
    const wrapper = await practice()
    const store = useSessionStore()
    const bar = () => wrapper.get('[role="progressbar"]')

    expect(bar().attributes('aria-valuenow')).toBe('0')
    expect(bar().attributes('aria-valuemax')).toBe(String(store.total))

    await answer(wrapper, 'eres')
    expect(bar().attributes('aria-valuenow')).toBe('1')
  })

  it('ne note pas deux fois une question validée deux fois', async () => {
    // Le formulaire sert à répondre puis à continuer : sans garde, un envoi
    // répété corrigerait la même question plusieurs fois.
    const wrapper = await practice()
    const store = useSessionStore()

    await answer(wrapper, 'eres')
    await answer(wrapper, 'eres')

    expect(
      store.answers.filter((given) => given.drill.card === store.drills[0]!.card),
    ).toHaveLength(1)
  })

  it('annonce une session vide plutôt qu’un écran blanc', async () => {
    // Toutes les cartes ouvertes déjà vues et aucune échue : c'est l'état normal
    // d'un apprenant à jour, pas une anomalie.
    const later = new Date(AT.getTime() + 7 * 86_400_000)
    await db.cards.bulkPut(
      LEVELS[0]!.cards.map((id) => ({
        id,
        ...parseCardId(id),
        fsrs: newCardState(AT),
        due: later,
        reps: 1,
        lapses: 0,
      })),
    )

    const wrapper = await practice()

    expect(useSessionStore().empty).toBe(true)
    expect(wrapper.text()).toContain('tout est à jour')
  })
})
