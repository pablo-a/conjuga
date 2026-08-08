import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db'
import { router } from '@/router'
import { useSessionStore } from '@/stores/session'
import PracticeView from '@/views/PracticeView.vue'

/**
 * Ce qui n'est pas visible depuis un déroulé nominal : la panne de stockage et
 * la remise à zéro. Le reste du magasin est vérifié à travers l'écran, là où il
 * sert (`tests/practice.test.ts`).
 */

const AT = new Date('2026-08-08T09:00:00Z')

beforeEach(async () => {
  await db.delete()
  await db.open()
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('session sans stockage', () => {
  /** Navigation privée, quota atteint, base verrouillée par un autre onglet. */
  const breakStorage = () =>
    vi.spyOn(db.cards, 'toArray').mockRejectedValue(new Error('IndexedDB indisponible'))

  it('ne compose aucune question quand la progression ne peut pas être lue', async () => {
    breakStorage()
    const store = useSessionStore()

    await store.start(AT)

    // Poser des questions dont le résultat serait jeté ferait croire à une
    // progression qui n'existe pas.
    expect(store.status).toBe('error')
    expect(store.total).toBe(0)
    expect(store.error).toContain('IndexedDB')
  })

  it('l’explique à l’écran au lieu d’afficher une session vide', async () => {
    breakStorage()
    await router.push('/pratique')

    const wrapper = mount(PracticeView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('stockage local')
    expect(wrapper.text()).not.toContain('tout est à jour')
  })
})

describe('reset', () => {
  it('rend le magasin au repos, pour relancer une session', async () => {
    const store = useSessionStore()
    await store.start(AT, () => 0)
    await store.submit(store.current!.form.value)
    expect(store.completed).toBe(1)

    store.reset()

    expect(store.status).toBe('idle')
    expect(store.total).toBe(0)
    expect(store.completed).toBe(0)
    expect(store.level).toBeNull()
  })
})
