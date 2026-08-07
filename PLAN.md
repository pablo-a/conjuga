# Plan — PWA d'apprentissage de la conjugaison espagnole

## 1. Objectif

Une PWA installable, **100 % offline**, en français, centrée sur la conjugaison des
1000 verbes espagnols les plus fréquents. Elle combine :

- une **théorie** par temps (formation, familles d'irréguliers, emplois, pièges pour francophones) ;
- des **exercices** interactifs pilotés par répétition espacée ;
- un **suivi de progression** qui cible automatiquement les faiblesses.

### Hypothèses retenues

| Sujet                                  | Choix                                                        |
| -------------------------------------- | ------------------------------------------------------------ |
| Niveau de départ                       | A2 — indicatif d'abord, subjonctif en phase 2                |
| Langue de l'interface et de la théorie | Français, avec comparaisons explicites FR↔ES                 |
| Architecture                           | Local-only, offline-first, déployable en statique            |
| Variante d'espagnol                    | Espagne (le `vosotros` est enseigné et exigé) — à confirmer  |
| Exercices MVP                          | Drill, QCM/reconnaissance, traduction FR→ES à trous, théorie |

## 2. Domaine métier (vocabulaire du projet)

Ces termes sont utilisés tels quels dans le code, en anglais, et documentés ici.

| Terme                           | Définition                                                                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lemma**                       | Un verbe à l'infinitif (`hablar`). Unité du dictionnaire.                                                                                                              |
| **Model** (modèle)              | Patron de conjugaison. `hablar` est le modèle des -ar réguliers ; `pensar` celui des `e→ie`. ~90 modèles couvrent tout l'espagnol. Chaque lemma pointe vers un modèle. |
| **Tense** (temps)               | Un couple mode + temps : `indicativo/presente`, `indicativo/indefinido`…                                                                                               |
| **Person** (personne)           | `yo, tú, él, nosotros, vosotros, ellos` — 6 slots.                                                                                                                     |
| **Form** (forme)                | Le résultat : `(lemma, tense, person) → "hablo"`.                                                                                                                      |
| **Cell** (cellule)              | Une case du tableau de conjugaison, c'est-à-dire un couple `(tense, person)`.                                                                                          |
| **Irregularity** (irrégularité) | Écart annoté entre la forme réelle et la forme régulière attendue. C'est ce qui permet de **surligner** la partie irrégulière dans l'UI.                               |
| **Card** (carte)                | Unité de répétition espacée : un couple `(lemma, tense)`. La personne est tirée au sort à chaque révision.                                                             |
| **Review** (révision)           | Une session de questions sur une carte, notée par FSRS.                                                                                                                |
| **Deck / Level**                | Un lot de cartes débloqué par la progression (ex. « 50 verbes les plus fréquents au présent »).                                                                        |
| **Drill**                       | Exercice de production : on donne verbe + temps + personne, on tape la forme.                                                                                          |
| **Recognition**                 | Exercice inverse : on donne une forme, on identifie temps + personne.                                                                                                  |
| **Cloze**                       | Traduction FR→ES à trou : la phrase espagnole est affichée avec le verbe manquant.                                                                                     |

## 3. Architecture technique

### Stack

| Couche      | Choix                                                     | Justification                                      |
| ----------- | --------------------------------------------------------- | -------------------------------------------------- |
| Build       | Vite 8                                                    | Standard Vue, HMR rapide, build statique           |
| Framework   | Vue 3.5 + `<script setup>` + TypeScript strict            | Demandé, et le typage est critique pour le moteur  |
| État        | Pinia 4                                                   | Stores `session`, `progress`, `settings`           |
| Routage     | Vue Router 5 (history mode)                               |                                                    |
| UI          | Tailwind v4 + Reka UI 2                                   | Voir la note ci-dessous                            |
| Persistance | Dexie 4 (IndexedDB)                                       | Progression, historique, cartes SRS                |
| SRS         | `ts-fsrs` 5                                               | FSRS moderne, 0 dépendance, bien meilleur que SM-2 |
| PWA         | `vite-plugin-pwa` 1.3 (Workbox)                           | Precache total → l'app marche dans l'avion         |
| Tests       | Vitest 4 + `@vue/test-utils`                              | Le moteur de conjugaison est testé exhaustivement  |
| Qualité     | ESLint 10 (flat config) + Prettier + `vue-tsc`            |                                                    |
| CI          | GitHub Actions : format + lint + typecheck + test + build |                                                    |
| Déploiement | GitHub Pages (statique)                                   | Rien à héberger                                    |

**Note sur l'UI — Reka UI plutôt que Nuxt UI.** Le premier jet de ce plan prévoyait Nuxt UI v4.
Vérification faite, il embarque 65 dépendances et une API orientée Nuxt, pour une surface de
composants ici très réduite : boutons, champ de saisie, barre de progression, tableaux, onglets,
une boîte de dialogue. Reka UI est la brique _headless_ sur laquelle Nuxt UI est lui-même construit :
on garde l'accessibilité (gestion du focus, ARIA, navigation clavier) là où elle est réellement
difficile — dialogue, select, onglets — sans traîner le framework complet. Le reste est du Tailwind
sur des composants maison, entièrement sous contrôle et sans risque de compatibilité de version.

### Décision structurante : moteur de règles, pas de table figée

Deux options existaient :

1. **Embarquer un dataset complet** — 1000 verbes × 18 temps × 6 personnes ≈ 108 000 formes,
   soit ~1,5 Mo. Simple, mais opaque : impossible d'expliquer _pourquoi_ une forme est ainsi.
2. **Un moteur de règles piloté par les modèles** — on embarque ~90 modèles (~30 Ko) et la liste
   des 1000 verbes avec leur modèle (~50 Ko), et on génère les formes à la volée.

**On prend l'option 2.** Elle est ~20× plus légère, mais surtout elle est _pédagogique_ : le moteur
sait dire « cette forme suit le modèle `pensar`, diphtongaison `e→ie` sur la syllabe tonique », et
l'UI peut surligner le segment irrégulier en couleur. C'est exactement ce dont on a besoin pour
apprendre les patrons plutôt que 108 000 formes isolées.

Le dataset complet est quand même **généré au build** — mais uniquement comme _golden file_ de test,
comparé forme par forme au paquet `spanish-verbs` (Apache-2.0) utilisé en `devDependency` comme
oracle indépendant. Toute divergence casse la CI. On a ainsi la légèreté du moteur avec la
garantie d'exactitude d'une table.

### Structure du dépôt

```
src/
  conjugation/            # Moteur pur, zéro dépendance UI — le coeur du projet
    types.ts              # Tense, Person, Mood, Form, Irregularity
    models.ts             # Les ~90 modèles de conjugaison
    orthography.ts        # Règles orthographiques (-car/-gar/-zar, -ger, -guir, i→y…)
    accents.ts            # Placement de l'accent tonique et des accents écrits
    engine.ts             # conjugate(lemma, tense, person) → Form
    diff.ts               # Comparaison forme régulière vs réelle → Irregularity[]
    index.ts
  data/
    verbs.json            # 1000 lemmas : { es, fr, rank, model, tags, cefr }
    models.json           # Généré depuis models.ts au build
  content/                # Théorie en Markdown, compilée au build
    presente.md  indefinido.md  imperfecto.md  ...
    indefinido-vs-imperfecto.md
  srs/
    scheduler.ts          # Wrapper ts-fsrs : Card ↔ état FSRS
    selector.ts           # Quelle carte, quelle personne, quel type d'exercice
    curriculum.ts         # Déblocage progressif des niveaux
  exercises/
    drill/  recognition/  cloze/     # Un composant + une logique de correction par type
    grading.ts            # Normalisation et correction tolérante des réponses
  db/                     # Schéma Dexie, migrations, export/import JSON
  stores/                 # Pinia
  views/                  # Home, Practice, Theory, Conjugator, Stats, Settings
  components/
scripts/
  build-verb-list.ts      # Fréquence + traductions FR → verbs.json
  verify-against-oracle.ts# Diff moteur ↔ spanish-verbs, exécuté en CI
tests/
  conjugation/            # Tests exhaustifs par modèle
```

## 4. Le moteur de conjugaison — détail

C'est la pièce sur laquelle tout repose ; elle est développée en TDD avant toute UI.

### Ce que couvrent les modèles

- **Réguliers** : `hablar`, `comer`, `vivir`.
- **Diphtongaison** : `e→ie` (`pensar`, `entender`, `sentir`), `o→ue` (`contar`, `volver`, `dormir`),
  `u→ue` (`jugar`), `i→ie` (`adquirir`) — uniquement sur syllabe tonique.
- **Affaiblissement** : `e→i` (`pedir`), et le double jeu de `sentir`/`dormir` au subjonctif et au gérondif.
- **Incohatifs** : `c→zc` (`conocer`, `conducir`, `traducir`).
- **Modification orthographique** : `-car→qu`, `-gar→gu`, `-zar→c`, `-ger/-gir→j`, `-guir→g`,
  `-uir→y` (`construir`), `-eer/-oír→y` (`leer→leyó`, `oír→oyó`).
- **Accentuation** : `-iar`/`-uar` accentués (`enviar→envío`, `actuar→actúo`) vs non (`cambiar→cambio`).
- **Prétérits forts** : `tener/estar/andar/poder/poner/saber/querer/hacer/venir/decir/traer/conducir`
  → radical propre + terminaisons atones (`tuve`, `dijo`, `trajeron`).
- **Futurs/conditionnels irréguliers** : radicaux syncopés (`tendr-`, `podr-`, `dir-`, `har-`).
- **Participes et gérondifs irréguliers** : `escrito`, `visto`, `hecho`, `puesto`, `diciendo`, `yendo`.
- **Ultra-irréguliers** : `ser, ir, haber, estar, dar, ver, saber, caber, oír, decir`.
- **Défectifs** : `llover`, `nevar`, `soler`, `abolir` (formes manquantes explicitement marquées).

### API

```ts
conjugate('pensar', 'indicativo.presente', 'yo')
// → { form: 'pienso', regular: 'penso', irregularities: [
//     { type: 'diphthong', rule: 'e→ie tonique', span: [1, 3] } ] }
```

Le champ `span` permet de surligner `ie` dans l'UI. C'est ce détail qui transforme un drill en
apprentissage de patron.

### Validation

- Un test par modèle, sur toutes les cellules, avec formes de référence écrites à la main.
- Un test de propriété : pour les 1000 verbes × tous les temps × toutes les personnes,
  la sortie du moteur doit être **identique** à celle de `spanish-verbs`. Toute divergence est
  investiguée manuellement (l'oracle peut se tromper), puis figée dans le golden file.

## 5. Les données : les 1000 verbes

Chaque entrée : `{ es, fr, rank, model, cefr, tags }`.

- **Fréquence** : classement issu d'une liste de fréquence espagnole ouverte
  (Subtlex-ESP ou la liste RAE/CREA), filtrée sur les verbes.
- **Traduction FR** : c'est le point de travail manuel. Base auto (Wiktionnaire FR/ES,
  licence CC-BY-SA) puis **relecture humaine des 300 premiers**, qui sont ceux réellement drillés
  les premiers mois. Un verbe peut avoir plusieurs traductions FR (`llevar` → porter / emmener /
  emporter) : le champ est une liste, et l'exercice de traduction accepte toutes les variantes.
- **Attribution des modèles** : automatique par suffixe pour les réguliers, table explicite pour les
  ~250 irréguliers.
- **CEFR** : niveau indicatif, sert au curriculum.

## 6. Le système de répétition espacée

- **Carte = `(lemma, tense)`**. 1000 verbes × 8 temps A2 = 8000 cartes potentielles, débloquées
  progressivement — jamais toutes actives.
- Une révision pose **2 à 3 personnes** tirées au sort sur cette carte, avec un biais vers les
  personnes déjà ratées. Note FSRS : `Again` si une erreur, `Good` si tout juste, `Easy` si tout
  juste et rapide.
- **Statistiques transverses** : on agrège aussi les erreurs par `(model, tense)`. Cela permet à
  l'app de dire « tu rates 62 % des `e→ie` au subjonctif présent » et de proposer la fiche de théorie
  correspondante. C'est la fonctionnalité qui différencie l'app d'un simple paquet Anki.

### Calibrage sur 20 minutes par jour

C'est l'objectif retenu, et il détermine tout le dimensionnement du curriculum.

| Grandeur                                         | Valeur                         |
| ------------------------------------------------ | ------------------------------ |
| Temps par question (réponse + lecture du retour) | ~10 s                          |
| Questions par session de 20 min                  | ~110                           |
| Questions par carte (2 à 3 personnes tirées)     | 2,5 en moyenne                 |
| **Cartes par jour**                              | **~45**, dont **10 nouvelles** |

Dix nouvelles cartes par jour est le débit qu'un volume de 35 révisions quotidiennes peut absorber
durablement avec FSRS. À ce rythme, les **300 verbes les plus fréquents × 8 temps** (2400 cartes,
soit la vraie cible utile) sont couverts en **~8 mois**. Les 700 verbes restants viennent ensuite,
et beaucoup seront de toute façon réguliers donc rapides.

Deux conséquences dans le code :

- la session s'arrête sur un **budget temps**, pas sur un compte de cartes fixe — si tu es lent un
  jour, tu fais moins de cartes, pas 20 minutes de plus ;
- le ratio nouvelles/révisions s'adapte : si le retard de révisions dépasse ~60 cartes, l'introduction
  de nouvelles cartes se met en pause automatiquement. C'est ce qui évite la spirale d'abandon
  classique d'Anki.

- **Curriculum** : les niveaux se débloquent à 80 % de maîtrise du précédent.
  1. 50 verbes les plus fréquents au présent → 2. + `ser/estar/ir/haber` tous temps →
  2. Perfecto → 4. Indefinido → 5. Imperfecto → 6. Indefinido **vs** Imperfecto (mixte) →
  3. Futur/conditionnel → 8. Impératif → 9. Introduction au subjonctif.

## 7. Les exercices

### Drill (production)

Verbe + temps + personne → on tape la forme. Correction tolérante :

- normalisation : trim, minuscules, espaces multiples ;
- **les accents comptent** (`hablo` ≠ `habló`), mais une erreur d'accent seul donne un retour
  spécifique « presque — accent tonique » plutôt qu'un rejet sec ;
- réponses multiples acceptées (subjonctif imparfait `-ra`/`-se`) ;
- après correction, la forme correcte est affichée **avec le segment irrégulier surligné** et un lien
  vers la fiche du modèle.
- Clavier : boutons d'accès rapide `á é í ó ú ñ` pour le mobile.

### Recognition (QCM et inverse)

- QCM classique avec distracteurs **intelligents** : les mauvaises réponses sont générées par le
  moteur (forme régulière attendue, bonne forme mais mauvaise personne, bon radical mauvais temps).
  Un distracteur pertinent enseigne ; un distracteur aléatoire ne sert à rien.
- Inverse : on donne `tuvieron`, il faut identifier verbe + temps + personne. Format rapide,
  parfait pour le mobile.

### Cloze FR→ES (traduction)

Écrire un correcteur de traduction libre hors ligne est impossible. On fait donc du **texte à trou** :

> Hier, je **suis allé** au marché.
> Ayer **\______** al mercado.

C'est traduisible de façon déterministe, ça travaille le **choix du temps** en plus de la forme
(l'objectif réel : `indefinido` vs `imperfecto`, le piège n°1 du francophone), et c'est corrigeable
exactement. Un « mode difficile » optionnel demande la phrase espagnole complète, corrigée par diff
tolérant contre la référence, avec la forme verbale comme seul élément noté.

**Banque de phrases** : ~250 patrons rédigés à la main (`{sujet} {verbe} {complément}` avec marqueurs
temporels obligatoires — `ayer`, `siempre`, `mañana`), combinés aux verbes → plusieurs milliers de
phrases dont le temps attendu est garanti correct par construction. Enrichissement possible plus tard
avec le corpus Tatoeba fr-es (CC-BY 2.0 FR, attribution requise).

## 8. La théorie

Fiches Markdown compilées au build, une par temps, structurées identiquement :

1. **Formation** — tableau des trois conjugaisons régulières.
2. **Irrégularités** — regroupées **par famille**, pas par verbe. On n'apprend pas 40 verbes
   irréguliers au prétérit, on apprend un patron de prétérits forts qui en couvre 40.
3. **Emploi** — quand utiliser ce temps.
4. **Piège pour francophones** — la section la plus importante. Exemples :
   - `pretérito perfecto` vs `indefinido` : la ligne de partage n'est **pas** celle du passé composé
     et du passé simple français ;
   - `ser` vs `estar` ;
   - le subjonctif espagnol est vivant et obligatoire là où le français l'a abandonné ;
   - `imperfecto` là où le français met un passé composé (`quería` = « je voulais » / « j'ai voulu »).
5. **Lien direct** vers un drill ciblé sur ce temps.

Fiche transversale majeure : **indefinido vs imperfecto**, avec un exercice dédié de choix binaire.

## 9. Écrans

| Écran          | Contenu                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| **Accueil**    | Cartes dues aujourd'hui, série en cours, bouton « Réviser », suggestion ciblée sur la faiblesse du moment |
| **Practice**   | La session : type d'exercice alterné, barre de progression, retour immédiat                               |
| **Théorie**    | Liste des fiches, avec un indicateur de maîtrise par temps                                                |
| **Conjugueur** | Recherche libre : n'importe quel verbe, tableau complet, irrégularités surlignées, TTS                    |
| **Stats**      | Heatmap temps × maîtrise, courbe de rétention, verbes les plus ratés, cartes apprises                     |
| **Réglages**   | Vosotros oui/non, temps actifs, objectif quotidien, export/import JSON, thème                             |

Détails PWA : installable (manifest + icônes), `display: standalone`, offline total après première
visite, Web Speech API pour la prononciation `es-ES` (dégradation silencieuse si absente),
notification locale optionnelle de rappel quotidien.

## 10. Phases de livraison

Chaque phase est livrable et testable indépendamment.

| Phase                    | Contenu                                                                    | Résultat visible                                                                                   |
| ------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **0 — Fondations**       | Vite + Vue + TS + Tailwind/Nuxt UI, PWA, Dexie, ESLint/Prettier/Vitest, CI | App vide installable et offline                                                                    |
| **1 — Moteur**           | `src/conjugation/*` en TDD, tous les modèles, vérification contre l'oracle | Tests verts sur 108 000 formes                                                                     |
| **2 — Données**          | Liste des 1000 verbes, modèles assignés, traductions FR des 300 premiers   | **Écran Conjugueur fonctionnel** : n'importe quel verbe, tableau complet, irrégularités surlignées |
| **3 — Drill + SRS**      | Cartes, FSRS, sélecteur, curriculum, exercice drill, persistance           | La boucle d'apprentissage quotidienne existe                                                       |
| **4 — Théorie**          | Fiches Markdown des temps A2, indicateurs de maîtrise, liens vers drills   | Le « pourquoi » derrière le drill                                                                  |
| **5 — Reconnaissance**   | QCM à distracteurs intelligents, exercice inverse                          | Sessions variées, format mobile                                                                    |
| **6 — Traduction FR→ES** | Patrons de phrases, exercice cloze, exercice indefinido/imperfecto         | Le point faible n°1 est travaillé                                                                  |
| **7 — Finition**         | Stats, séries, TTS, export/import, rappels, accessibilité, Lighthouse      | Version quotidiennement utilisable                                                                 |

Le jalon important est la **phase 2** : dès qu'elle est finie, l'app est déjà utile comme conjugueur
de référence hors ligne, avant même le premier exercice.

## 11. Risques et points à trancher

| Risque                                                                                   | Mitigation                                                                                         |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Exactitude de la conjugaison — une app qui enseigne une forme fausse est pire qu'inutile | Double source : moteur maison + oracle indépendant, divergence = CI rouge                          |
| Qualité des traductions FR automatiques                                                  | Relecture manuelle des 300 verbes les plus fréquents ; les suivants sont marqués « non relu »      |
| Volume de rédaction du contenu théorique                                                 | 8 fiches pour le scope A2, rédigées en phase 4, pas avant                                          |
| Licences des données                                                                     | Fréquence et Wiktionnaire en CC-BY-SA, Tatoeba en CC-BY : attribution dans un fichier `CREDITS.md` |
| Sur-ingénierie du SRS                                                                    | On part de FSRS avec ses paramètres par défaut, sans optimisation personnalisée                    |

**Tranché :**

- **Hébergement** — dépôt Git initialisé en local, destination GitHub. Déploiement via GitHub Pages
  et GitHub Actions.
- **Rythme** — 20 minutes par jour, soit ~45 cartes dont 10 nouvelles (voir le calibrage en §6).

**Reste à confirmer :**

1. **Vosotros** — on l'enseigne (Espagne) ou on l'ignore (Amérique latine) ? Par défaut : on l'enseigne,
   avec une option pour le désactiver dans les réglages.
