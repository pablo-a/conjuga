import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db'
import { weakPersons } from '@/db/repository'
import { router } from '@/router'
import { hidesItsInfinitive } from '@/exercises/identification'
import { LEVELS, MASTERY_STABILITY_DAYS, cardId, parseCardId } from '@/srs/curriculum'
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

afterEach(() => {
  vi.restoreAllMocks()
})

type Wrapper = ReturnType<typeof mount<typeof PracticeView>>

/**
 * Un état FSRS de carte acquise, et **valide**.
 *
 * `newCardState` laisse `difficulty` à zéro, que `ts-fsrs` refuse dès qu'on lui
 * repasse la carte : forcer la stabilité sans la difficulté produit un état
 * qu'aucune révision n'aurait pu créer, et l'écriture suivante échoue en
 * silence — l'erreur n'interrompant pas la session, elle ne se voit nulle part.
 */
const mastered = () => ({ ...newCardState(AT), stability: MASTERY_STABILITY_DAYS, difficulty: 5 })

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
  const current = useSessionStore().current
  if (current?.kind === 'choice') {
    const option = wrapper
      .findAll('[data-choices] button')
      .find((button) => button.text().trim() === text)
    await option!.trigger('click')
  } else if (current?.kind === 'identify') {
    // Les propositions ne montrent pas leur clé : on désigne par sa position.
    const index = current.options.findIndex((option) => option.value === text)
    await wrapper.findAll('[data-options] button')[index]!.trigger('click')
  } else {
    await wrapper.get('#reponse').setValue(text)
    await wrapper.get('form').trigger('submit')
  }
  await flushPromises()
}

/**
 * Laisse la transaction Dexie de fin de carte aboutir.
 *
 * `saveReview` est lancée depuis `submit` sans être attendue par l'appelant : un
 * seul tour de boucle ne suffit pas à la voir arriver en base.
 */
async function written(): Promise<void> {
  for (let tries = 0; tries < 5; tries++) await flushPromises()
}

/** La bonne réponse à un exercice, dans la monnaie que sa correction attend. */
const rightAnswer = (exercise: Exercise): string =>
  exercise.kind === 'identify' ? exercise.expected : exercise.form.value

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
  for (
    let guard = 0;
    guard < 60 && store.status === 'running' && store.current && wanted(store.current);
    guard++
  ) {
    await answer(wrapper, rightAnswer(store.current))
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
      await answer(wrapper, rightAnswer(store.current!))
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
        fsrs: mastered(),
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
      await answer(wrapper, rightAnswer(store.current!))
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

/**
 * L'exercice inverse. Il ferme les cartes déjà connues dont la forme cache son
 * infinitif — la seule compétence, la lecture, que le reste de l'app n'exerce
 * jamais.
 */
describe('identification', () => {
  const FUI = cardId('ser', 'indicativo.indefinido')

  /**
   * Une carte revue, pas découverte : `ser` au passé simple, dont `fui` ne
   * laisse rien deviner de l'infinitif. Le premier niveau est déclaré acquis
   * pour ouvrir le second, seul à porter cette carte.
   */
  async function reviewing(): Promise<Wrapper> {
    await db.cards.bulkPut(
      LEVELS[0]!.cards.map((id) => ({
        id,
        ...parseCardId(id),
        fsrs: mastered(),
        due: new Date(AT.getTime() + 7 * 86_400_000),
        reps: 1,
        lapses: 0,
      })),
    )
    await db.cards.put({
      id: FUI,
      ...parseCardId(FUI),
      fsrs: mastered(),
      due: new Date(AT.getTime() - 86_400_000),
      reps: 3,
      lapses: 0,
    })
    return practice()
  }

  it('ferme une carte connue en demandant de nommer la forme', async () => {
    const wrapper = await reviewing()
    const store = useSessionStore()

    const mine = store.exercises.filter((exercise) => exercise.card === FUI)
    expect(mine.at(-1)!.kind).toBe('identify')
    // En clôture : on ne fait nommer qu'après avoir fait écrire.
    expect(mine.filter((exercise) => exercise.kind === 'drill').length).toBeGreaterThan(0)

    await advanceWhile(wrapper, (exercise) => exercise.kind !== 'identify')

    // Ni le verbe ni le temps ne sont affichés : ils sont la réponse.
    expect(wrapper.get('[data-form-asked]').text()).toBe(store.current!.form.value)
    expect(wrapper.find('[data-lemma]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Quel verbe, quel temps, quelle personne ?')
    expect(wrapper.findAll('[data-options] button').length).toBeGreaterThanOrEqual(3)
  })

  it('ne la pose que sur les formes qui cachent leur infinitif', async () => {
    // Demander à quel verbe appartient `hablaron` n'apprendrait rien.
    const wrapper = await reviewing()
    await advanceWhile(wrapper, () => true)

    for (const exercise of useSessionStore().exercises) {
      if (exercise.kind !== 'identify') continue
      expect(
        hidesItsInfinitive(exercise.lemma, exercise.tense, exercise.form.value),
        exercise.form.value,
      ).toBe(true)
    }
  })

  it('ne compte ni dans la note ni dans les statistiques de patron', async () => {
    const wrapper = await reviewing()
    const store = useSessionStore()

    const drills = store.exercises.filter(
      (exercise) => exercise.card === FUI && exercise.kind === 'drill',
    ).length

    // Toutes les productions justes, puis une identification ratée.
    await advanceWhile(wrapper, (exercise) => exercise.kind !== 'identify')
    const current = store.current!
    expect(current.kind).toBe('identify')

    const wrongIndex =
      current.kind === 'identify' ? current.options.findIndex((option) => !option.correct) : -1
    await wrapper.findAll('[data-options] button')[wrongIndex]!.trigger('click')
    await written()
    expect(store.answered!.grade.verdict).toBe('wrong')
    await next(wrapper)
    // La carte reste acquise : ne pas savoir lire `fui` ne dit rien de la
    // capacité à l'écrire, qui est ce que l'échéance mesure.
    expect((await db.cards.get(FUI))!.due.getTime()).toBeGreaterThan(AT.getTime())

    const preterite = (await db.patternStats.toArray()).find(
      (entry) => entry.tense === 'indicativo.indefinido',
    )!
    expect(preterite.attempts).toBe(drills)
    expect(preterite.errors).toBe(0)

    // Rangée pour autant, et elle sait dire d'où elle vient.
    const stored = await db.answers.where('cardId').equals(FUI).toArray()
    expect(stored.filter((given) => given.kind === 'identify')).toHaveLength(1)
  })
})

describe('écriture en échec', () => {
  it('le signale sans interrompre la session', async () => {
    // Ne pas interrompre est délibéré : ce qui est rangé l'est, et recommencer
    // ne servirait à rien. Se taire ne l'est pas — l'apprenant travaillerait
    // vingt minutes pour rien sans jamais l'apprendre.
    const wrapper = await practice()
    const store = useSessionStore()
    vi.spyOn(db.cards, 'get').mockRejectedValue(new Error('quota dépassé'))

    await advanceWhile(wrapper, (exercise) => exercise.card === store.exercises[0]!.card)
    await written()

    expect(store.error).toContain('quota')
    expect(store.status).toBe('running')
    expect(wrapper.get('[data-save-warning]').text()).toContain('n’a pas pu être enregistrée')
  })
})
