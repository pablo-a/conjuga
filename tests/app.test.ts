import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import AppNav from '@/components/AppNav.vue'
import { router } from '@/router'

describe('router', () => {
  it('expose les six écrans prévus', () => {
    const names = router.getRoutes().map((route) => route.name)
    expect(names).toEqual(
      expect.arrayContaining(['home', 'practice', 'theory', 'conjugator', 'stats', 'settings']),
    )
  })

  it('renvoie les URL inconnues vers l’accueil', async () => {
    // `resolve()` n'applique pas les redirections : il faut réellement naviguer.
    await router.push('/nimporte-quoi')
    expect(router.currentRoute.value.name).toBe('home')
  })
})

describe('AppNav', () => {
  beforeEach(async () => {
    await router.push('/')
    await router.isReady()
  })

  const mountNav = () => mount(AppNav, { global: { plugins: [router] } })

  it('rend un lien par section principale', () => {
    const wrapper = mountNav()
    expect(wrapper.findAll('a')).toHaveLength(5)
    expect(wrapper.text()).toContain('Conjugueur')
  })

  it('marque la section courante et une seule', async () => {
    await router.push('/conjugueur')
    const wrapper = mountNav()

    const current = wrapper.findAll('a[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0]!.text()).toBe('Conjugueur')
  })

  it('n’applique jamais couleur active et couleur inactive au même lien', async () => {
    // Garde-fou : deux utilitaires de couleur simultanés seraient départagés par
    // l'ordre du CSS généré, donc silencieusement faux. Voir AppNav.vue.
    await router.push('/conjugueur')
    const wrapper = mountNav()

    for (const link of wrapper.findAll('a')) {
      const classes = link.classes()
      const active = classes.includes('text-accent-600')
      const inactive = classes.includes('text-slate-500')
      expect(active).not.toBe(inactive)
    }
  })

  it('ne marque pas l’accueil comme actif sur une autre section', async () => {
    // Le chemin `/` est un préfixe de tous les autres : sans correspondance exacte,
    // le lien Accueil resterait allumé partout.
    await router.push('/stats')
    const wrapper = mountNav()

    const home = wrapper.findAll('a').find((link) => link.text() === 'Accueil')
    expect(home!.attributes('aria-current')).toBeUndefined()
  })
})
