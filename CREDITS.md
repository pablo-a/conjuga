# Sources et licences

Ce fichier recense les données externes utilisées et leurs conditions d'attribution.
Il est mis à jour au fur et à mesure de l'intégration de chaque source.

## Vérification de la conjugaison

- **[an-array-of-spanish-words](https://github.com/words/an-array-of-spanish-words)** — MIT.
  Liste de 636 000 mots espagnols. Utilisée **uniquement en développement** : la CI vérifie que
  chaque forme produite par le moteur est un mot attesté. Aucun code ni donnée de ce paquet n'est
  embarqué dans l'app.

### Piste écartée

- **[spanish-verbs](https://github.com/RosaeNLG/rosaenlg)** — Apache-2.0. Envisagé comme oracle de
  conjugaison, puis retiré : sur 88 verbes testés il divergeait sur 60, et l'erreur était presque
  toujours de son côté (conditionnel diphtongué, prétérits forts ignorés, formes d'un verbe
  renvoyées pour un autre). Voir PLAN.md §3.

## À intégrer

Les sources ci-dessous sont prévues par le plan mais pas encore intégrées. L'attribution exacte
sera complétée au moment de l'intégration.

- **Liste de fréquence des verbes** — Subtlex-ESP ou CREA (RAE). Licence à vérifier avant usage.
- **Traductions françaises** — Wiktionnaire FR/ES, CC-BY-SA 3.0. Attribution et partage à
  l'identique requis pour les données dérivées.
- **Corpus de phrases** (enrichissement optionnel des exercices de traduction) —
  [Tatoeba](https://tatoeba.org), CC-BY 2.0 FR. Attribution requise.
