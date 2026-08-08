# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

**Conjuga** — PWA d'apprentissage de la conjugaison espagnole pour francophones (niveau A2,
session quotidienne de 20 min). 100 % offline, aucune donnée envoyée nulle part, déployée
en statique sur GitHub Pages.

**[PLAN.md](PLAN.md) est la source de vérité** : objectifs, vocabulaire du domaine (§2),
décisions d'architecture (§3), spécification du moteur (§4), SRS (§6), exercices (§7),
phases de livraison (§10). Le lire avant toute modification structurante ; le mettre à jour
quand une décision change.

**Langue** : tout est en français — interface, théorie, commentaires de code, messages de
commit, noms de routes. Les identifiants du domaine restent en anglais (`lemma`, `tense`,
`person`, `card`) ou en espagnol pour les temps (`indicativo.indefinido`).

Phases livrées : 0 (socle PWA), 1 (moteur de conjugaison), et la moitié de la 2 —
**l'écran Conjugueur fonctionne** sur les ~218 verbes au modèle explicite, plus tout verbe
régulier. Il reste à bâtir `src/data/verbs.json` (les 1000 verbes avec rang de fréquence et
traductions FR), qui demande une liste de fréquence externe.

Les vues autres que `HomeView` et `ConjugatorView` sont des placeholders « À construire ».

## Commandes

| Commande             | Rôle                                                             |
| -------------------- | ---------------------------------------------------------------- |
| `npm run dev`        | Serveur de développement (service worker désactivé)              |
| `npm run build`      | `vue-tsc -b` puis build Vite                                     |
| `npm run preview`    | Sert le build — **seul moyen de tester le comportement offline** |
| `npm test`           | Vitest, une passe                                                |
| `npm run test:watch` | Vitest en watch                                                  |
| `npm run typecheck`  | `vue-tsc -b` seul                                                |
| `npm run lint`       | ESLint (`lint:fix` pour corriger)                                |
| `npm run format`     | Prettier (`format:check` pour vérifier)                          |

Un seul fichier de test : `npx vitest run tests/conjugation/irregular.test.ts`.
Un seul cas : ajouter `-t 'tener'` (filtre sur le nom du `describe`/`it`).

La CI (`.github/workflows/ci.yml`) enchaîne `format:check`, `lint`, `typecheck`, `test`,
`build` — dans cet ordre. Faire tourner la même séquence localement avant de pousser.

### Déploiement

Le même workflow publie sur GitHub Pages après le job `check`, et seulement sur `main` :
`needs` ne traverse pas les fichiers, c'est pourquoi vérification et déploiement cohabitent
dans `ci.yml` plutôt que dans deux workflows qui se déclencheraient en parallèle — un build
cassé pourrait alors être publié.

Deux points sans lesquels le site reste blanc, et qui ne se voient pas en développement :

- **`VITE_BASE`** vaut `/<dépôt>/` en CI (déduit de `github.event.repository.name`). Sans
  lui, assets, manifeste et service worker pointent vers la racine du domaine. Pour
  reproduire le vrai déploiement en local : `VITE_BASE=/conjuga/ npm run build && npm run preview`.
- **`404.html`** est une copie de l'`index.html` construit, produite par le plugin
  `conjuga:404-fallback` (`vite.config.ts`). GitHub Pages ne réécrit rien vers `index.html` :
  sans ce doublon, recharger `/conjuga/conjugueur?v=tener` renverrait la 404 de GitHub. Le
  fichier est copié **après** le build et **avant** VitePWA, pour que Workbox le précache.

Côté interface GitHub, la source des Pages doit être réglée sur « GitHub Actions » — ça ne
se fait pas depuis le dépôt.

`vitest.config.ts` est volontairement séparé de `vite.config.ts` : les tests n'ont besoin
ni du service worker ni de Tailwind. Toute modification d'alias doit être répercutée dans
les deux fichiers **et** dans `tsconfig.app.json` (`paths`).

## Le moteur de conjugaison (`src/conjugation/`)

C'est le cœur du projet : un module **pur**, sans aucune dépendance à Vue, au DOM ou à la
persistance. Ne jamais y importer quoi que ce soit de `src/views`, `src/stores` ou `src/db`.

### Décision fondatrice : règles, pas table

On n'embarque pas les ~108 000 formes. On embarque ~90 **modèles** et on génère les formes
à la volée, parce que le moteur doit pouvoir dire **pourquoi** une forme dévie — c'est ce
qui permet à l'UI de surligner le segment irrégulier et de renvoyer vers la bonne fiche de
théorie. Toute proposition de « simplifier » en pré-calculant un dataset détruit la valeur
pédagogique de l'app.

### Structure de `Model`

Un modèle décrit une **transformation du radical**, pas un verbe. Il ne renseigne que les
`Slot` où il dévie de la règle régulière : `presentStressedStem`, `presentStem`, `yo`,
`subjunctiveStem`, `subjunctiveNosStem`, `imperfectStem`, `preteriteStem`, `strongPreterite`,
`preteriteThirdStem`, `futureStem`, `gerundio`, `participio`, `imperativeTu`, plus `forms`
(formes suppletives, clé `${tense}:${person}`) et `alternativeForms`.

Ces emplacements ne sont pas un découpage arbitraire : chacun correspond à une articulation
réelle de la conjugaison espagnole. C'est pour cela qu'un modèle tient en trois lignes.
Avant d'ajouter un slot, vérifier qu'aucune combinaison des existants ne suffit.

`reasons` associe à chaque slot une `Reason` (`kind`, `explanation` en français, `segment`
optionnel). Le `segment` élargit le surlignage au motif complet : entre `penso` et `pienso`
la comparaison brute n'isole que le `i` ajouté, alors que le patron à montrer est `ie`.

### Chaînes de dérivation à respecter

Le moteur dérive plutôt qu'il ne tabule ; ces règles couvrent l'essentiel des « irréguliers » :

- **Subjonctif présent** = forme `yo` du présent privée de son `-o` (`hago` → `haga`,
  `conozco` → `conozca`). La dérivation se fait avec `orthography: false`, car les
  adaptations graphiques dépendent de la terminaison qui suit.
- **Subjonctif imparfait et futur** = 3ᵉ personne du pluriel du prétérit privée de `-ron`,
  sans aucune exception. L'accent de `nosotros` remonte d'une syllabe (`accentLastVowel`).
- **Futur et conditionnel** sont toujours solidaires : un seul `futureStem`.
- **Impératif** n'a pas de terminaisons propres : présent `él` pour `tú`, subjonctif pour
  les formes de politesse et `nosotros`, infinitif pour `vosotros`.
- **Temps composés** = `haber` conjugué + participe. L'irrégularité de `haber` n'est
  **pas** comptée dans les écarts signalés à l'apprenant.
- **Diphtongaison** : uniquement hors `nosotros`/`vosotros` (terminaisons atones), et sur
  la **dernière** voyelle du radical, la seule tonique (`comenzar` → `comienzo`).

### Comment naît une `Irregularity`

`conjugate()` construit la forme réelle en accumulant une `Trace` (slots touchés + règles
graphiques déclenchées), puis reconstruit la **forme régulière de référence** avec le même
moteur, le modèle régulier du groupe et `orthography: false`. Toute divergence est donc
imputable au verbe et explicable. `differenceSpan()` localise l'écart, `locate()` l'étend
au `segment` du modèle quand il y en a un.

Conséquence : ne jamais court-circuiter ce passage par la trace en écrivant une forme en
dur si un slot peut l'exprimer — la forme serait juste, mais l'explication serait perdue.

### Résolution du modèle d'un verbe (`resolveDerivation`)

Ordre strict, premier gagnant. Le résultat est un couple `{ modelId, prefix }` :

1. `VERB_MODELS` — table explicite. Elle fait autorité ; c'est là qu'on tranche un cas
   douteux, pas en élargissant une heuristique.
2. `SUFFIX_FAMILIES` — familles définies par le suffixe (`-ducir`, `-uir` hors `-guir`/`-quir`,
   `-ecer`/`-ocer`, `-ucir`), sauf si le verbe est dans `NOT_A_FAMILY` (`mecer`, `escocer`…).
3. `DERIVABLE` — dérivés préfixés, par **suffixe le plus long** (`devolver` → `volver`,
   surtout pas `ver`), à deux conditions : la base fait au moins `MIN_BASE_LENGTH` lettres,
   et ce qui la précède se découpe entièrement en préfixes connus (`isPrefixChain`). Sans
   cette garde, `vivir` deviendrait un dérivé de `ir` et se conjuguerait `voy`.
4. Sinon : régulier.

`NOT_A_DERIVATIVE` liste les verbes qui ressemblent à un dérivé sans en être un
(`presentar` n'est pas un `sentar` préfixé, `conjugar` pas un `jugar`).

### Le préfixe, et l'accent qu'il fait apparaître

Un modèle écrit ses formes figées pour **son verbe de base** (`tengo`, `puso`, `visto`).
`prefix` est ce qui permet de les rendre à ses dérivés sans les réécrire : c'est toute la
rentabilité de la dérivation. Une entrée explicite de `VERB_MODELS` obtient elle aussi son
préfixe, déduit du verbe qui donne son nom au modèle (`prefixAgainst`) — sans quoi
`prever: 'ver'` rendrait `veo` au lieu de `preveo`.

L'accentuation écrite qu'un préfixe fait apparaître (`ves` → `prevés`, `ten` → `obtén`,
`rio` → `sonrió`) est décidée **en un seul endroit**, dans le moteur et sur la forme finie :
`accentIfBaseIsMonosyllable`. Préfixer ne déplace pas l'accent tonique ; c'est seulement
qu'un monosyllabe ne l'écrit jamais, alors que le mot plus long qu'il forme doit le faire.
Ne pas remettre cette logique dans les modèles : appliquée à un radical, elle donnait
`propúso`.

La règle ne joue que si le dérivé est exactement `prefix + forme de base` — quand un modèle
refait la forme du dérivé (`decir` fait `di`, mais `contradice`), il n'y a rien à marquer.

### Verbes défectifs

`Model.defective(tense, person)` renvoie `true` pour une case qui **n'existe pas**. Ce n'est
pas de l'irrégularité : la forme n'est pas fautive, elle est inusitée. Le moteur saurait
construire `soleré` ou `llovemos`, et c'est précisément ce qu'il ne faut pas montrer — une
case vide enseigne, une forme inventée désapprend. Prédicats disponibles : `impersonal`
(`llover`, `nevar`), `thirdPersonOnly` (`concernir`), `onlyTenses` (`soler`).

### `orthography.ts` n'est pas de l'irrégularité

Les adaptations graphiques (`buscar` → `busqué`, `coger` → `cojo`) ne changent pas le son :
ce sont des règles, pas des exceptions, et elles sont présentées comme telles. Elles ne
s'appliquent que si la consonne **vient de l'infinitif** (`inheritedFromInfinitive`) — sans
cette garde, le `g` ajouté par `tener` (`teng-`) donnerait `tenja`.

## L'écran Conjugueur

`ConjugatorView` ne consulte aucune base : elle conjugue à la demande, ce qui est la
conséquence directe de la décision « règles plutôt que table ».

- `lookup.ts` aide à écrire le verbe, sans jamais restreindre la saisie. Les accents sont
  rétablis depuis la table des modèles (`reir` → `reír`), parce que sans cela le moteur
  conjuguerait `reir` comme un `-ir` régulier et afficherait `reo` avec aplomb. Un verbe
  inconnu reste conjugable — il est simplement traité comme régulier.
- `highlight.ts` traduit les `span` en segments rendus. Module pur, testé comme le moteur.
  Invariant : la concaténation des segments **est** la forme, sinon l'écran affiche un mot
  faux.
- `views/conjugator.ts` fixe l'ordre d'affichage : chaque temps composé suit le temps simple
  qui lui donne son auxiliaire. Un test vérifie que la liste couvre exactement `TENSES`, pour
  qu'un temps ajouté au moteur ne disparaisse pas de l'écran en silence.
- La recherche vit dans l'URL (`/conjugueur?v=tener`) : un tableau se partage et se recharge.
- Une case vide est **annoncée** (`forme inexistante`), jamais laissée vide : c'est une
  information pédagogique, pas une absence de réponse.

## Politique de vérification (non négociable)

Une app qui enseigne une forme fausse est pire qu'inutile. Deux dispositifs complémentaires :

1. **Tables de référence écrites à la main**, une par famille de modèles, dans
   `tests/conjugation/`. Elles ne sont dérivées d'aucun code — c'est le point fixe contre
   lequel le moteur est jugé. **Ne jamais les régénérer depuis la sortie du moteur.**
2. **Contrôle lexical** (`tests/conjugation/lexicon.test.ts`) : chaque forme produite doit
   être un mot attesté dans `an-array-of-spanish-words` (636 000 mots, MIT, dev uniquement).
   Ce test attrape le vrai risque de la phase 2 : une mauvaise affectation de modèle produit
   presque toujours un mot inexistant. Il ne voit ni la place de la forme ni l'accentuation.

Toute forme correcte mais absente du lexique doit être ajoutée à `ATTESTED_BUT_ABSENT`
**avec sa justification écrite**. Deux entrées aujourd'hui (`habed`, `arrepentid`). Si un
verbe rare demande plus d'une ou deux justifications, le retirer de `VERB_MODELS` coûte
moins cher que de diluer le garde-fou.

Les deux dispositifs sont complémentaires et il faut les deux : c'est le contrôle lexical
qui a attrapé que `concernir` était donné à toutes les personnes, et une table écrite à la
main qui a attrapé `riñiendo` au lieu de `riñendo` — un mot que le lexique ignorait de
toute façon.

Le paquet `spanish-verbs`, initialement prévu comme oracle, a été **mesuré puis abandonné** :
sur 88 verbes il divergeait sur 60, presque toujours à tort. Ne pas le réintroduire (voir
PLAN.md §3 et CREDITS.md).

Toute source de données externe ajoutée doit être inscrite dans `CREDITS.md` avec sa licence.

## Conventions

- TypeScript strict, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `erasableSyntaxOnly`, `noUnusedLocals/Parameters`. L'accès indexé renvoie `T | undefined` :
  le `!` explicite est utilisé là où l'invariant est démontré par construction.
- Alias `@/` → `src/`. Imports de type via `import type`.
- Vue 3 `<script setup>` + TypeScript, Tailwind v4, Reka UI pour les composants où
  l'accessibilité est difficile (dialogue, select, onglets) — le reste est fait maison.
- Les commentaires expliquent **pourquoi**, pas quoi. Le moteur en est dense par nécessité :
  garder ce niveau, chaque règle de conjugaison mérite sa justification linguistique.
- `dist/` et `dist-test/` sont des sorties de build ignorées par git — ne rien y modifier.
