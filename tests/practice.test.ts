import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/db'
import { weakPersons } from '@/db/repository'
import { router } from '@/router'
import { LEVELS, MASTERY_STABILITY_DAYS, parseCardId } from '@/srs/curriculum'
import { newCardState } from '@/srs/scheduler'
import type { Exercise } from '@/exercises/session'
import { useSessionStore } from '@/stores/session'
import PracticeView from '@/views/PracticeView.vue'

/**
 * L'écran est monté sur la vraie chaîne — magasin, moteur, IndexedDB — parce que
 * c'est justement l'assemblage qu'il faut vérifier : chaque pièce est déjà testée
 * seule, et un magasin bouchonné ne dirait rien de leur rencontre.
 *
 * Le hasard est neutralisé (`() => 0`), ce qui rend la session entièrement
 * prévisible : dix nouvelles cartes prises en tête du curriculum, trois personnes
 * chacune. La première cellule est donc toujours `ser` à la deuxième personne —
 * posée d'abord en reconnaissance, puisque la carte est neuve, puis en
 * production.
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
  await useSessionStore().start({ now: AT, random })
  const wrapper = mount(PracticeView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

/**
 * Répond à la question courante, quel que soit son format, et attend la
 * correction. Un QCM se répond en désignant, pas en tapant.
 */
async function answer(wrapper: Wrapper, text: string): Promise<void> {
  if (useSessionStore().current?.kind === 'choice') {
    const option = wrapper
      .findAll('[data-choices] button')
      .find((button) => button.text().trim() === text)
    await option!.trigger('click')
  } else {
    await wrapper.get('#reponse').setValue(text)
    await wrapper.get('form').trigger('submit')
  }
  await flushPromises()
}

/** Passe à la question suivante, une fois la correction lue. */
async function next(wrapper: Wrapper): Promise<void> {
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

/** Enchaîne des bonnes réponses tant que la condition tient. */
async function advanceWhile(
  wrapper: Wrapper,
  wanted: (exercise: Exercise) => boolean,
): Promise<void> {
  const store = useSessionStore()
  for (let guard = 0; guard < 50 && store.current && wanted(store.current); guard++) {
    await answer(wrapper, store.current.form.value)
    await next(wrapper)
  }
}

/**
 * Amène l'écran à la première production.
 *
 * Une carte neuve s'ouvre par une reconnaissance : la plupart des tests portent
 * sur la production, et la traverser à la main dans chacun d'eux masquerait leur
 * objet. La reconnaissance a ses propres tests, plus bas.
 */
async function toDrill(wrapper: Wrapper): Promise<void> {
  await advanceWhile(wrapper, (exercise) => exercise.kind !== 'drill')
}

describe('écran Pratique', () => {
  it('pose une question de la session du jour', async () => {
    const wrapper = await practice()
    const store = useSessionStore()
    await toDrill(wrapper)

    expect(store.status).toBe('running')
    expect(wrapper.get('[data-lemma]').text()).toBe('ser')
    // La consigne doit dire le temps *et* la personne : sans les deux, la
    // question n'a pas de réponse unique.
    expect(wrapper.text()).toContain('présent de l’indicatif')
    expect(wrapper.get('label[for="reponse"]').text()).toBe('tú')
  })

  it('valide une forme exacte, et montre quand même la forme', async () => {
    const wrapper = await practice()
    await toDrill(wrapper)

    await answer(wrapper, 'eres')

    expect(wrapper.text()).toContain('Exact.')
    // Même juste, la forme est réaffichée : c'est là que le segment irrégulier
    // se voit, et l'apprenant qui a deviné apprend la règle.
    expect(wrapper.get('[data-form]').text()).toBe('eres')
  })

  it('distingue la faute d’accent d’une forme fausse', async () => {
    // On avance jusqu'à `estar` à la deuxième personne, où l'accent est le seul
    // écart possible.
    const wrapper = await practice()
    await advanceWhile(
      wrapper,
      (exercise) => !(exercise.kind === 'drill' && exercise.form.value === 'estás'),
    )
    expect(useSessionStore().current!.form.value).toBe('estás')

    await answer(wrapper, 'estas')

    expect(wrapper.text()).toContain('accent tonique')
    expect(wrapper.text()).not.toContain('Non.')
  })

  it('traite « je ne sais pas » comme une réponse fausse qui enseigne', async () => {
    const wrapper = await practice()
    const store = useSessionStore()
    await toDrill(wrapper)

    const give = wrapper.findAll('button').find((button) => button.text() === 'Je ne sais pas')
    await give!.trigger('click')
    await flushPromises()

    expect(store.answered!.grade.verdict).toBe('wrong')
    expect(wrapper.text()).toContain('Non.')
    expect(wrapper.get('[data-form]').text()).toBe('eres')
  })

  it('renvoie vers le tableau complet du verbe interrogé', async () => {
    const wrapper = await practice()
    await toDrill(wrapper)
    await answer(wrapper, 'eres')

    expect(wrapper.get('a[href*="conjugueur"]').attributes('href')).toContain('v=ser')
  })

  it('renvoie vers la fiche qui explique le temps interrogé', async () => {
    // Le surlignage montre *où* est l'irrégularité ; la fiche dit *pourquoi*.
    // Sans ce lien, la correction s'arrête à l'endroit le plus intéressant.
    const wrapper = await practice()
    await toDrill(wrapper)
    await answer(wrapper, 'eres')

    expect(wrapper.get('a[href*="theorie"]').attributes('href')).toContain('present')
  })

  it('range la carte dès sa dernière personne, pas en fin de session', async () => {
    // Une session de vingt minutes interrompue ne doit pas perdre ce qui a été
    // révisé : c'est la raison d'être de l'écriture carte par carte.
    const wrapper = await practice()
    const store = useSessionStore()

    const card = store.current!.card
    const questions = store.exercises.filter((exercise) => exercise.card === card).length
    // Une carte neuve : une reconnaissance d'ouverture, puis trois productions.
    expect(questions).toBe(4)

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
    await toDrill(wrapper)

    const asked = store.current!
    await answer(wrapper, 'eres')
    await answer(wrapper, 'eres')

    expect(store.answers.filter((given) => given.exercise === asked)).toHaveLength(1)
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

/**
 * Le drill lancé depuis une fiche de théorie. Le magasin est laissé au repos :
 * c'est l'écran qui doit lire l'URL et composer la session, comme il le fera
 * quand on arrivera ici par le lien d'une fiche.
 */
describe('session ciblée', () => {
  /**
   * Ici l'écran compose lui-même, à partir de l'URL : il faut donc attendre que
   * la lecture d'IndexedDB aboutisse, ce qu'un seul tour de boucle ne garantit
   * pas.
   */
  async function settle(): Promise<void> {
    const store = useSessionStore()
    for (
      let tries = 0;
      tries < 20 && (store.status === 'idle' || store.status === 'loading');
      tries++
    ) {
      await flushPromises()
    }
  }

  async function focused(temps: string): Promise<Wrapper> {
    await router.push(`/pratique?temps=${encodeURIComponent(temps)}`)
    const wrapper = mount(PracticeView, { global: { plugins: [router] } })
    await settle()
    return wrapper
  }

  /**
   * Déclare le premier niveau acquis, ce qui ouvre le second — les quatre
   * piliers à tous les temps de l'indicatif. Sans lui, seul le présent existe,
   * et cibler un autre temps ne prouverait rien.
   */
  async function unlockEssentials(): Promise<void> {
    await db.cards.bulkPut(
      LEVELS[0]!.cards.map((id) => ({
        id,
        ...parseCardId(id),
        fsrs: { ...newCardState(AT), stability: MASTERY_STABILITY_DAYS },
        due: new Date(AT.getTime() + 7 * 86_400_000),
        reps: 1,
        lapses: 0,
      })),
    )
  }

  it('ne pose que le temps demandé, et le dit', async () => {
    await unlockEssentials()
    const wrapper = await focused('indicativo.imperfecto')
    const store = useSessionStore()

    expect(store.status).toBe('running')
    expect(store.exercises.every((exercise) => exercise.tense === 'indicativo.imperfecto')).toBe(
      true,
    )
    expect(wrapper.get('[data-focus]').text()).toContain('imparfait')
  })

  it('mêle les deux temps d’une fiche qui en couvre deux', async () => {
    await unlockEssentials()
    const wrapper = await focused('indicativo.futuro,indicativo.condicional')
    const tenses = new Set(useSessionStore().exercises.map((exercise) => exercise.tense))

    expect(tenses).toEqual(new Set(['indicativo.futuro', 'indicativo.condicional']))
    expect(wrapper.get('[data-focus]').text()).toContain('et')
  })

  it('dit que le temps n’est pas ouvert plutôt que « tout est à jour »', async () => {
    // Le subjonctif clôt le programme : au premier niveau, ses cartes n'existent
    // pas encore. Répondre « à jour » laisserait croire à une avance imaginaire.
    const wrapper = await focused('subjuntivo.presente')

    expect(useSessionStore().empty).toBe(true)
    expect(wrapper.text()).toContain('pas encore ouvert')
    expect(wrapper.text()).not.toContain('tout est à jour')
  })

  it('ignore un paramètre qui ne désigne aucun temps', async () => {
    // Une URL trafiquée doit rendre la session ordinaire, pas une session vide.
    const wrapper = await focused('n’importe quoi')

    expect(useSessionStore().focus).toBeNull()
    expect(wrapper.find('[data-focus]').exists()).toBe(false)
    expect(wrapper.get('[data-lemma]').text()).toBe('ser')
  })

  it('recompose la session quand la cible change sous la même vue', async () => {
    await unlockEssentials()
    const wrapper = await focused('indicativo.imperfecto')

    await router.push('/pratique?temps=indicativo.futuro')
    await settle()

    expect(
      useSessionStore().exercises.every((exercise) => exercise.tense === 'indicativo.futuro'),
    ).toBe(true)
    expect(wrapper.get('[data-focus]').text()).toContain('futur')
  })
})

/**
 * La reconnaissance ouvre les cartes neuves. Ce qui est vérifié ici, ce n'est pas
 * qu'un QCM s'affiche, mais qu'il pèse dans la progression exactement ce qu'il
 * vaut : moins qu'une production.
 */
describe('reconnaissance', () => {
  const options = () => useSessionStore().current

  it('ouvre une carte neuve par un QCM, pas par une page blanche à remplir', async () => {
    // Demander d'écrire une forme jamais vue ne fait que constater qu'on ne la
    // sait pas. On montre d'abord, on fait produire ensuite — même cellule.
    const wrapper = await practice()
    const store = useSessionStore()

    expect(store.current!.kind).toBe('choice')
    expect(wrapper.findAll('[data-choices] button')).toHaveLength(4)
    expect(wrapper.text()).toContain('Laquelle est la forme de tú ?')

    await answer(wrapper, 'eres')
    await next(wrapper)

    // La production suit, sur la même case.
    expect(store.current!.kind).toBe('drill')
    expect(store.current!.person).toBe('tu')
    expect(store.current!.form.value).toBe('eres')
  })

  it('ne tolère pas l’accent sur une forme désignée', async () => {
    // On ne clique pas sur un accent par mégarde : la tolérance de la production
    // récompense un geste de frappe, pas un choix fait après lecture.
    const wrapper = await practice()
    const store = useSessionStore()
    await advanceWhile(
      wrapper,
      (exercise) => !(exercise.kind === 'choice' && exercise.form.value === 'estás'),
    )
    expect(options()!.kind).toBe('choice')

    // `estar` régularisé donne `estas` : le distracteur qui ne diffère que par
    // l'accent, et donc le seul cas où la tolérance de la production se poserait.
    const wrong = wrapper
      .findAll('[data-choices] button')
      .find((button) => button.text().trim() === 'estas')

    await wrong!.trigger('click')
    await flushPromises()

    expect(store.answered!.grade.verdict).toBe('wrong')
    expect(wrapper.text()).not.toContain('accent tonique')
  })

  it('marque la bonne forme même quand elle a été trouvée', async () => {
    // C'est la seule ligne qui vaille d'être relue : la laisser se confondre avec
    // les trois autres perdrait tout ce que la correction avait à apprendre.
    const wrapper = await practice()

    await answer(wrapper, 'eres')

    const right = wrapper
      .findAll('[data-choices] button')
      .find((button) => button.text().startsWith('eres'))
    expect(right!.classes().join(' ')).toContain('emerald')
  })

  it('dit ce qu’était chaque mauvaise proposition', async () => {
    const wrapper = await practice()

    await answer(wrapper, 'eres')

    // Une croix rouge n'apprend rien ; « la forme de yo » situe l'erreur.
    expect(wrapper.get('[data-choices]').text()).toContain('la forme de')
  })

  it('n’allonge pas une échéance et n’entre pas dans les statistiques de patron', async () => {
    const wrapper = await practice()
    const store = useSessionStore()

    const card = store.current!.card
    const questions = store.exercises.filter((exercise) => exercise.card === card).length

    // Toute la carte en bonnes réponses : une reconnaissance, trois productions.
    for (let asked = 0; asked < questions; asked++) {
      await answer(wrapper, store.current!.form.value)
      await next(wrapper)
    }

    const stat = await db.patternStats.toArray()
    expect(stat).toHaveLength(1)
    // Trois productions comptées, la reconnaissance écartée : le taux d'échec
    // d'un patron doit rester comparable dans le temps, quel que soit le mélange
    // d'exercices du moment.
    expect(stat[0]!.attempts).toBe(questions - 1)

    // Elle est rangée pour autant, et sait dire d'où elle vient.
    const answers = await db.answers.toArray()
    expect(answers).toHaveLength(questions)
    expect(answers.filter((given) => given.kind === 'choice')).toHaveLength(1)
  })

  it('ne laisse pas une reconnaissance réussie effacer une faiblesse de production', async () => {
    // `weakPersons` retient la dernière réponse : si la reconnaissance comptait,
    // le QCM d'ouverture blanchirait la personne que la production vient de rater.
    await db.answers.bulkAdd([
      {
        cardId: LEVELS[0]!.cards[0]!,
        answeredAt: AT,
        person: 'tu',
        kind: 'drill',
        expected: 'eres',
        given: 'ers',
        correct: false,
        accentOnly: false,
        elapsedMs: 5000,
      },
      {
        cardId: LEVELS[0]!.cards[0]!,
        answeredAt: AT,
        person: 'tu',
        kind: 'choice',
        expected: 'eres',
        given: 'eres',
        correct: true,
        accentOnly: false,
        elapsedMs: 2000,
      },
    ])

    const weak = await weakPersons([LEVELS[0]!.cards[0]!])
    expect(weak.get(LEVELS[0]!.cards[0]!)).toEqual(['tu'])
  })
})
