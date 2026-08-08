import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { MODELS, TENSES, conjugate } from '@/conjugation'
import { SHEETS, sheetBySlug, sheetFor } from '@/content'
import { db } from '@/db'
import { router } from '@/router'
import { MIN_ATTEMPTS } from '@/srs/patterns'
import TheorySheetView from '@/views/TheorySheetView.vue'
import TheoryView from '@/views/TheoryView.vue'

/**
 * Les fiches sont montées pour de vrai, avec le moteur derrière : c'est le seul
 * moyen de vérifier ce qui fait leur valeur — que leurs tableaux de conjugaison
 * sortent du moteur et non d'une recopie qui pourrait dériver.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
  setActivePinia(createPinia())
})

/** Range un agrégat `(modèle, temps)` comme le ferait une session. */
async function stat(model: string, tense: string, attempts: number, errors: number): Promise<void> {
  await db.patternStats.put({ id: `${model}:${tense}`, model, tense, attempts, errors })
}

async function list() {
  await router.push('/theorie')
  await router.isReady()
  const wrapper = mount(TheoryView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

async function sheet(slug: string) {
  await router.push(`/theorie/${slug}`)
  await router.isReady()
  const wrapper = mount(TheorySheetView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('le catalogue de fiches', () => {
  it('n’annonce que des temps que le moteur connaît', () => {
    for (const entry of SHEETS) {
      for (const tense of entry.tenses) {
        expect(TENSES, entry.slug).toContain(tense)
      }
    }
  })

  it('donne un slug unique à chaque fiche', () => {
    const slugs = SHEETS.map((entry) => entry.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('résout chaque slug annoncé', () => {
    for (const entry of SHEETS) expect(sheetBySlug(entry.slug)).toBe(entry)
    expect(sheetBySlug('inexistant')).toBeUndefined()
  })

  it('rattache un temps à la fiche qui en traite', () => {
    expect(sheetFor('indicativo.presente')?.slug).toBe('present')
    // Tant que `indefinido` n'a pas sa fiche dédiée, c'est la transversale qui
    // répond — et le jour où elle existera, elle passera devant sans rien casser.
    expect(sheetFor('indicativo.indefinido')?.slug).toBe('indefinido-ou-imperfecto')
    // Un temps sans fiche ne renvoie nulle part plutôt que vers une page vide.
    expect(sheetFor('subjuntivo.imperfecto')).toBeUndefined()
  })
})

describe('la liste des fiches', () => {
  it('mène à chaque fiche', async () => {
    const wrapper = await list()

    for (const entry of SHEETS) {
      expect(wrapper.find(`a[href*="${entry.slug}"]`).exists(), entry.slug).toBe(true)
    }
  })

  it('ne mesure rien tant que trop peu de formes ont été demandées', async () => {
    await stat('pensar', 'indicativo.presente', MIN_ATTEMPTS - 1, 3)

    const wrapper = await list()

    expect(wrapper.text()).toContain('Pas encore assez de révisions')
    expect(wrapper.text()).not.toContain('% de réussite')
  })

  it('affiche le taux de réussite du temps couvert', async () => {
    await stat('pensar', 'indicativo.presente', 40, 10)

    const wrapper = await list()

    expect(wrapper.text()).toContain('75 % de réussite sur 40 formes')
  })
})

describe('une fiche', () => {
  it('tire ses tableaux du moteur plutôt que d’une recopie', async () => {
    // C'est la raison d'être du markdown compilé en composant : la fiche du
    // présent doit montrer exactement ce que la Pratique corrigera.
    const wrapper = await sheet('present')

    expect(wrapper.text()).toContain('Le présent de l’indicatif')
    const forms = wrapper.findAll('[data-form]').map((form) => form.text())
    expect(forms).toContain(conjugate('hablar', 'indicativo.presente', 'yo')!.value)
    expect(forms).toContain(conjugate('pensar', 'indicativo.presente', 'nosotros')!.value)
    // La botte : la diphtongue s'arrête à `nosotros`, et le tableau le montre.
    expect(forms).toContain('pienso')
    expect(forms).toContain('pensamos')
  })

  it('nomme les patrons ratés avant de dérouler la théorie', async () => {
    await stat('pensar', 'indicativo.presente', 20, 12)

    const wrapper = await sheet('present')

    expect(wrapper.text()).toContain(MODELS['pensar']!.label)
    expect(wrapper.text()).toContain('60 % d’erreurs sur 20 formes')
  })

  it('ne reproche rien à qui n’a rien raté', async () => {
    await stat('pensar', 'indicativo.presente', 20, 0)

    const wrapper = await sheet('present')

    expect(wrapper.text()).not.toContain('Ce que tu rates')
  })

  it('mène à la pratique', async () => {
    const wrapper = await sheet('present')
    expect(wrapper.find('a[href*="pratique"]').exists()).toBe(true)
  })

  it('annonce une fiche inconnue plutôt que d’afficher une page vide', async () => {
    const wrapper = await sheet('futur-anterieur-du-klingon')

    expect(wrapper.text()).toContain('Fiche introuvable')
    expect(wrapper.find('a[href*="theorie"]').exists()).toBe(true)
  })
})
