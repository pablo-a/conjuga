import type { Component } from 'vue'

import FuturEtConditionnel from './futur-et-conditionnel.md'
import Imparfait from './imparfait.md'
import Imperatif from './imperatif.md'
import IndefinidoVsImperfecto from './indefinido-vs-imperfecto.md'
import PasseCompose from './passe-compose.md'
import PasseSimple from './passe-simple.md'
import Presente from './presente.md'
import SubjonctifPresent from './subjonctif-present.md'

/**
 * Le contenu des fiches, séparé de leur catalogue (`index.ts`).
 *
 * Une fiche est un `.md` compilé en composant Vue (voir vite.config.ts) : elle
 * s'écrit comme du texte mais peut appeler `<ConjugationTable>`. Ses tableaux de
 * formation sortent donc du moteur, et ne peuvent pas diverger de ce que l'app
 * corrige — une fiche qui enseignerait `piensamos` pendant que la Pratique le
 * refuse serait pire que pas de fiche du tout.
 *
 * Seul l'écran d'une fiche importe ce module, et il est lui-même chargé à la
 * demande : la théorie ne pèse donc que sur qui la lit. Les imports sont secs et
 * non différés parce que la fiche doit s'afficher d'un coup — la charger en deux
 * temps donnerait un titre suivi d'un vide, pour économiser un aller-retour déjà
 * précaché par le service worker.
 */

const COMPONENTS: Record<string, Component> = {
  present: Presente,
  'passe-compose': PasseCompose,
  'passe-simple': PasseSimple,
  imparfait: Imparfait,
  'indefinido-ou-imperfecto': IndefinidoVsImperfecto,
  'futur-et-conditionnel': FuturEtConditionnel,
  imperatif: Imperatif,
  'subjonctif-present': SubjonctifPresent,
}

/** Le contenu compilé d'une fiche du catalogue. */
export function componentFor(slug: string): Component | undefined {
  return COMPONENTS[slug]
}
