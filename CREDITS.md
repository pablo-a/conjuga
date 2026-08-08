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

## Fréquence des verbes

- **[FrequencyWords](https://github.com/hermitdave/FrequencyWords)** — MIT, © 2016 Hermit Dave.
  Fichier `content/2018/es/es_50k.txt`, les 50 000 formes espagnoles les plus fréquentes,
  copié dans `data/frequency/`. Dérivé du corpus
  [OpenSubtitles2018](http://opus.nlpl.eu/OpenSubtitles2018.php) du projet OPUS.
  Utilisé **uniquement à la construction**, pour classer les verbes par fréquence : la liste
  brute n'est pas embarquée dans l'app, seul `src/data/verbs.json` l'est.
  Détail de la provenance et des limites dans `data/frequency/README.md`.

### Pistes écartées pour la fréquence

- **Subtlex-ESP** — bon corpus, mais diffusé « pour la recherche » sans licence ouverte
  explicite. Prévu par le premier jet du plan, remplacé par FrequencyWords dont la licence
  est nette.
- **CREA (RAE)** — aucune licence ouverte de redistribution. Écarté pour un dépôt public.
- **Leipzig Corpora Collection** — CC BY-NC. La clause non commerciale contraindrait l'app
  sans contrepartie.

## À intégrer

Les sources ci-dessous sont prévues par le plan mais pas encore intégrées. L'attribution exacte
sera complétée au moment de l'intégration.

- **Catégorie grammaticale des lemmes** —
  [UD_Spanish-AnCora](https://github.com/UniversalDependencies/UD_Spanish-AnCora), CC BY 4.0.
  Sert à décider ce qui est un verbe, là où la liste de fréquence ne donne que des formes.
  `UD_Spanish-GSD` couvre le même besoin mais en CC BY-SA, dont le partage à l'identique se
  propagerait aux données dérivées.
- **Traductions françaises** — Wiktionnaire FR/ES, CC-BY-SA 3.0. Attribution et partage à
  l'identique requis pour les données dérivées. Il n'existe pas de paire Apertium
  `fra-spa` : la piste d'un dictionnaire bilingue tout fait est fermée.
- **Corpus de phrases** (enrichissement optionnel des exercices de traduction) —
  [Tatoeba](https://tatoeba.org), CC-BY 2.0 FR. Attribution requise.
