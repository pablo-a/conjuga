/**
 * La série : combien de jours d'affilée l'apprenant s'est mis à sa session.
 *
 * Module pur — on lui passe les jours travaillés et la date du moment, il compte.
 * C'est la seule mesure de l'app qui ne récompense pas la performance mais
 * l'assiduité, et c'est délibéré : à vingt minutes par jour, la régularité pèse
 * plus lourd que le score d'une session.
 */

/**
 * Le jour civil **local** d'un instant, au format `AAAA-MM-JJ`.
 *
 * Local et non UTC : une session commencée à 0 h 30 à Paris tombe la veille en
 * UTC, et casserait la série de quelqu'un qui a pourtant révisé deux jours de
 * suite. C'est le calendrier de l'apprenant qui fait foi, pas celui du serveur
 * qu'on n'a d'ailleurs pas.
 */
export function dayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Longueur de la série qui se termine aujourd'hui, ou hier.
 *
 * Ne pas avoir encore révisé aujourd'hui ne casse pas la série : la journée
 * n'est pas finie, et afficher zéro le matin punirait quelqu'un qui n'a rien
 * fait de mal. C'est le lendemain sans révision qui la rompt.
 */
export function streakLength(days: Iterable<string>, today: Date): number {
  const studied = new Set(days)

  const cursor = new Date(today)
  if (!studied.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)

  let length = 0
  while (studied.has(dayKey(cursor))) {
    length += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return length
}
