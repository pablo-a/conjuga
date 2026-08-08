import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import ConjugationTable from '@/components/ConjugationTable.vue'
import VerbForm from '@/components/VerbForm.vue'
import { TENSES, conjugate } from '@/conjugation'
import { canonicalInfinitive, suggestions } from '@/conjugation/lookup'
import { router } from '@/router'
import ConjugatorView from '@/views/ConjugatorView.vue'
import { MOODS } from '@/views/conjugator'

describe('ordre d’affichage des temps', () => {
  const displayed = MOODS.flatMap((mood) => mood.tenses)

  it('couvre exactement les temps du moteur', () => {
    // Un temps ajouté au moteur mais oublié ici disparaîtrait de l'écran sans
    // que rien ne le signale.
    expect([...displayed].sort()).toEqual([...TENSES].sort())
  })

  it('ne montre aucun temps deux fois', () => {
    expect(new Set(displayed).size).toBe(displayed.length)
  })

  it('fait suivre chaque temps simple de son composé', () => {
    // `haber` au présent plus le participe donne le `perfecto` : les mettre côte
    // à côte est la seule façon de rendre la règle visible.
    const indicatif = MOODS.find((mood) => mood.name === 'Indicatif')!.tenses
    expect(indicatif.slice(0, 4)).toEqual([
      'indicativo.presente',
      'indicativo.perfecto',
      'indicativo.imperfecto',
      'indicativo.pluscuamperfecto',
    ])
  })
})

describe('recherche d’un verbe', () => {
  it('rétablit les accents que personne ne tape', () => {
    // Sans cela, `reir` serait conjugué comme un -ir régulier et donnerait `reo`.
    expect(canonicalInfinitive('reir')).toBe('reír')
    expect(canonicalInfinitive('oir')).toBe('oír')
    expect(canonicalInfinitive('  TENER  ')).toBe('tener')
  })

  it('laisse passer un verbe inconnu du moteur', () => {
    // Le moteur sait conjuguer n'importe quel infinitif : la recherche ne doit
    // pas se transformer en liste blanche.
    expect(canonicalInfinitive('zapatear')).toBe('zapatear')
  })

  it('propose d’abord les verbes qui commencent par la saisie', () => {
    const found = suggestions('ten')
    expect(found[0]).toBe('tender')
    expect(found).toContain('tentar')
  })

  it('ne se propose pas elle-même', () => {
    expect(suggestions('tener')).not.toContain('tener')
  })
})

describe('VerbForm', () => {
  it('surligne le segment irrégulier et l’explique', () => {
    const wrapper = mount(VerbForm, {
      props: { form: conjugate('pensar', 'indicativo.presente', 'yo') },
    })

    const highlighted = wrapper.findAll('.text-irregular')
    expect(highlighted).toHaveLength(1)
    expect(highlighted[0]!.text()).toBe('ie')
    expect(wrapper.text()).toContain('diphtongaison e → ie')
  })

  it('ne surligne rien sur une forme régulière', () => {
    const wrapper = mount(VerbForm, {
      props: { form: conjugate('hablar', 'indicativo.presente', 'yo') },
    })

    expect(wrapper.findAll('.text-irregular')).toHaveLength(0)
    expect(wrapper.text()).toBe('hablo')
  })

  it('annonce une case inexistante autrement que par du vide', () => {
    const wrapper = mount(VerbForm, { props: { form: null } })
    expect(wrapper.text()).toContain('forme inexistante')
  })

  it('montre les variantes également correctes', () => {
    const wrapper = mount(VerbForm, {
      props: { form: conjugate('hablar', 'subjuntivo.imperfecto', 'yo') },
    })
    expect(wrapper.text()).toContain('hablase')
  })
})

describe('ConjugationTable', () => {
  it('rend les six personnes dans l’ordre', () => {
    const wrapper = mount(ConjugationTable, {
      props: { infinitive: 'obtener', tense: 'indicativo.presente' },
    })

    const forms = wrapper.findAll('[data-form]').map((cell) => cell.text())
    expect(forms).toEqual(['obtengo', 'obtienes', 'obtiene', 'obtenemos', 'obtenéis', 'obtienen'])
  })

  it('dit qu’un temps manque plutôt que d’afficher six tirets', () => {
    const wrapper = mount(ConjugationTable, {
      props: { infinitive: 'soler', tense: 'indicativo.futuro' },
    })
    expect(wrapper.text()).toContain('n’a pas ce temps')
    expect(wrapper.findAll('dd')).toHaveLength(0)
  })
})

describe('ConjugatorView', () => {
  const mountView = () => mount(ConjugatorView, { global: { plugins: [router] } })

  beforeEach(async () => {
    await router.push('/conjugueur')
    await router.isReady()
  })

  it('n’affiche aucun tableau tant que rien n’est saisi', () => {
    const wrapper = mountView()
    expect(wrapper.findComponent(ConjugationTable).exists()).toBe(false)
    expect(wrapper.text()).toContain('Tape un infinitif')
  })

  it('conjugue le verbe passé dans l’URL', async () => {
    await router.push('/conjugueur?v=tener')
    const wrapper = mountView()

    expect(wrapper.text()).toContain('tengo')
    expect(wrapper.text()).toContain('tuve')
    expect(wrapper.findAllComponents(ConjugationTable)).toHaveLength(TENSES.length)
  })

  it('refuse ce qui n’est pas un infinitif, sans afficher de tableau', async () => {
    await router.push('/conjugueur?v=casa')
    const wrapper = mountView()

    expect(wrapper.text()).toContain('n’est pas un infinitif conjugable')
    expect(wrapper.findComponent(ConjugationTable).exists()).toBe(false)
  })

  it('signale qu’il a corrigé l’orthographe saisie', async () => {
    await router.push('/conjugueur?v=reir')
    const wrapper = mountView()

    expect(wrapper.text()).toContain('Orthographe corrigée')
    expect(wrapper.text()).toContain('río')
  })

  it('affiche le modèle suivi, y compris pour un verbe régulier', async () => {
    await router.push('/conjugueur?v=hablar')
    const wrapper = mountView()
    expect(wrapper.text()).toContain('réguliers')
  })

  it('écrit la recherche dans l’URL', async () => {
    const wrapper = mountView()
    await wrapper.find('input').setValue('volver')
    await flushPromises()

    expect(router.currentRoute.value.query.v).toBe('volver')
  })
})
