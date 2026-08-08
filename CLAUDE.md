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

Phases livrées : 0 (socle PWA), 1 (moteur de conjugaison), 2 (les 1000 verbes et l'écran
Conjugueur) et 3 — **la boucle quotidienne existe** : l'accueil dit ce qui attend, l'écran
Pratique compose la session, corrige, explique et range la progression dans IndexedDB.

Phase 4 **entamée** : la mécanique de la théorie est complète (fiches en markdown compilé,
écran, indicateur de maîtrise, lien depuis la correction), avec **deux fiches sur huit** —
le présent, et « indefinido ou imperfecto ». Les six autres sont de la rédaction.

Reste à faire sur les données : **relire les traductions**. Les gloses de `verbs.json`
viennent du Wiktionnaire, ce sont des définitions et non des équivalents ; elles ne sont
pas encore embarquées (voir « La chaîne de données »).

`StatsView` et `SettingsView` sont des placeholders « À construire ».

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
les deux fichiers **et** dans `tsconfig.app.json` (`paths`). La compilation du markdown, en
revanche, doit rester **identique** dans les deux : les fiches de théorie sont des
composants, et un test qui ne saurait pas les monter ne vérifierait rien.

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

## La chaîne de données (`scripts/`)

Deux scripts, exécutés à la main et rarement, jamais pendant le build de l'app. Ils sont
typés par `tsconfig.scripts.json` — projet distinct parce qu'ils importent le moteur, écrit
pour un bundler, que `tsconfig.node.json` en `nodenext` refuserait.

| Commande                  | Effet                                                                     |
| ------------------------- | ------------------------------------------------------------------------- |
| `npm run data:wiktionary` | 257 Mo de JSONL kaikki.org → `data/wiktionary/*.json` (940 Ko versionnés) |
| `npm run data:verbs`      | fréquence + Wiktionnaire + moteur → `verbs.json`, `lemmas.json`, rapport  |

### Comment les verbes sont classés

La liste de fréquence ne connaît que des **formes** : `es` y est au rang 8 sans rien qui le
rattache à `ser`. Filtrer les mots en `-ar`/`-er`/`-ir` donnerait le rang de l'infinitif,
qui n'a aucun rapport avec celui du verbe — `ser` ne s'emploie presque jamais à l'infinitif.

On procède donc à l'envers, et c'est un usage du moteur qu'aucune table figée n'aurait
permis : pour chaque verbe connu du Wiktionnaire, le moteur génère le paradigme complet et
l'on somme les occurrences de ses formes. Deux corrections rendent le résultat exploitable —
sans elles, `unir` sortait au rang 6 et `nadar` au rang 23 :

1. **Les formes qui existent hors du verbe ne comptent pour personne.** Entre `nada` « rien »
   et `nada` « il nage », le corpus ne dit rien, et le mot non verbal l'emporte trop souvent
   pour qu'on parie dessus. D'où la liste `es-non-verbs.json`.
2. **Une forme disputée entre deux verbes revient au plus établi**, mesuré sur sa masse
   exclusive. `podría` est le conditionnel de `poder` et l'imparfait de `podrir` ; `siento`
   est `sentir` et `sentar`. Le corpus n'a qu'un jeton, il faut trancher.

Ce que le script ne tranche pas, il le **signale** dans `data/verbs-review.md` : homographes
survivants et gloses trop longues pour servir d'équivalent. Les gloses du Wiktionnaire sont
des définitions, pas des traductions — d'où `reviewed` sur chaque entrée, et le fait que
`verbs.json` n'est **pas livré au navigateur**.

### Deux fichiers, un seul embarqué

`verbs.json` (110 Ko) reste au dépôt ; l'app importe `lemmas.json` (12 Ko), la même liste
réduite aux infinitifs. Le curriculum n'a besoin que de l'**ordre** pour savoir quelles
cartes ouvrir, et embarquer les gloses reviendrait à quadrupler le paquet de l'écran
Pratique pour y expédier des définitions qu'on ne veut justement pas encore afficher.
Les deux sortent de la même exécution ; un test vérifie qu'ils n'ont pas divergé.

`tests/data/verbs.test.ts` garde l'intégrité des fichiers générés. Le test qui compte vérifie
que chaque `model` correspond encore à `resolveModelId` : enrichir `VERB_MODELS` sans
régénérer la liste ferait désigner un modèle périmé. Le correctif est `npm run data:verbs` —
en sachant qu'il **réécrit `reviewed` à `false`** sur toutes les entrées, et efface donc la
relecture humaine déjà faite.

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

## La boucle quotidienne : l'écran Pratique

Une chaîne à quatre étages, chacun ignorant celui du dessus. Ce cloisonnement est ce qui
permet de tester les règles d'apprentissage sans monter d'interface ni ouvrir de base.

| Étage                    | Rôle                                                    | Dépendances      |
| ------------------------ | ------------------------------------------------------- | ---------------- |
| `srs/`, `exercises/`     | Quoi poser, comment corriger, quand une carte est close | pur              |
| `db/repository.ts`       | Le seul module qui écrit dans IndexedDB                 | Dexie            |
| `stores/session.ts`      | Enchaîne, chronomètre, range                            | Pinia + les deux |
| `views/PracticeView.vue` | Pose la question, montre la correction                  | le magasin       |

**Le magasin ne décide de rien.** Il appelle `planSession`, `questionsFor`, `grade`,
`rateReview` et `saveReview` dans cet ordre. Une règle d'apprentissage écrite dans
`stores/session.ts` est au mauvais endroit — elle appartient à un module pur, où elle est
testable.

### `exercises/session.ts` — quand une carte est close

Les questions d'une même carte se suivent, parce que `questionsFor` les produit carte par
carte : un changement de carte marque donc la fin de la précédente. C'est ce moment qui
déclenche la note FSRS **et l'écriture**. La progression est ainsi rangée au fil de la
session, et fermer l'onglet au milieu ne perd que la carte en cours — une session de vingt
minutes interrompue par un appel ne doit pas s'effacer.

### `db/repository.ts` — l'écriture, en un seul endroit

`saveReview` écrit la carte, ses réponses et l'agrégat `(modèle, temps)` dans **une seule
transaction**. Une carte repoussée dont les réponses n'auraient pas été écrites ferait
disparaître une faiblesse sans laisser de trace, et l'app proposerait la théorie d'un patron
que l'apprenant maîtrise.

Deux règles de comptage, opposées par nature :

- **La faute d'accent ne compte pas comme un échec du patron.** L'apprenant a appliqué la
  règle et manqué la syllabe tonique ; la compter gonflerait le taux d'échec des modèles les
  plus accentués et enverrait vers la mauvaise fiche.
- **Elle compte comme une personne à revoir.** `weakPersons` ne regarde que la **dernière**
  réponse connue de chaque couple (carte, personne) : une personne ratée puis retrouvée
  trois fois n'est plus une faiblesse, et la traiter comme telle condamnerait le tirage à
  repasser éternellement sur les mêmes cases.

### Ce que l'écran doit à l'apprenant

- **La forme est toujours réaffichée, même quand la réponse est juste** : c'est là que le
  segment irrégulier se voit (`VerbForm`, partagé avec le Conjugueur) et que la règle
  s'apprend. Une bonne réponse devinée n'enseigne rien sans son explication.
- **Le verdict est une phrase, pas une couleur.** « Presque — c'est l'accent tonique » dit
  ce que le vert et le rouge ne disent pas, et reste lisible pour tout le monde.
- **La barre `á é í ó ú ü ñ`** n'est pas un confort : la correction note l'accent, et sur un
  téléphone l'apprenant qui doit rester appuyé sur `a` finit par écrire `hablo` en pensant
  `habló`.
- **Une session vide est un message**, pas un écran blanc : c'est l'état normal d'un
  apprenant à jour. De même, un stockage indisponible interrompt la session au lieu de poser
  des questions dont le résultat serait jeté.

`tests/practice.test.ts` monte l'écran sur la vraie chaîne — magasin, moteur, IndexedDB via
`fake-indexeddb` — parce que c'est l'assemblage qu'il faut vérifier ; chaque pièce est déjà
testée seule. Le hasard y est neutralisé (`() => 0`), ce qui rend la session prévisible :
dix nouvelles cartes en tête du curriculum, et `ser` à la deuxième personne en ouverture.

## L'écran d'accueil

C'est lui qui transforme l'app en habitude : sans un endroit qui dise « il y a quelque
chose à faire aujourd'hui », la session ne se lance que si l'on y pense. Même cloisonnement
que la Pratique — `stores/overview.ts` lit et enchaîne, il ne décide de rien.

**Il compose la même session que la Pratique lancera**, par le même `planSession`. Compter
les cartes dues autrement — une requête d'index sur les échéances, qui serait moins chère —
donnerait un nombre qui n'est pas celui qu'on va poser : l'accueil promettrait 60 cartes là
où la session en pose 48, et la promesse est justement ce qui fait revenir. C'est aussi
pourquoi `remaining` est affiché : le budget de vingt minutes est un plafond, et taire les
cartes échues qui débordent laisserait croire qu'une session éponge tout un retard.

### La série (`srs/streak.ts` et la table `days`)

La série est la seule mesure de l'app qui récompense l'assiduité plutôt que la performance,
et c'est délibéré : à vingt minutes par jour, la régularité pèse plus lourd qu'un score.

- **Le jour est civil et local**, jamais UTC (`dayKey`). Une session commencée à 0 h 30 à
  Paris tombe la veille en UTC et casserait la série de quelqu'un qui a pourtant révisé deux
  jours de suite. C'est le calendrier de l'apprenant qui fait foi.
- **Ne pas avoir encore révisé aujourd'hui ne rompt pas la série** : la journée n'est pas
  finie, et afficher zéro le matin punirait quelqu'un qui n'a rien fait de mal. C'est le
  lendemain sans session qui la rompt.
- **`days` est un agrégat, pas un cache.** L'accueil se lit à chaque ouverture de l'app ;
  recalculer la série depuis le journal des réponses ferait de la requête la plus fréquente
  la plus coûteuse — une année de sessions pèse ~40 000 réponses pour 365 jours. La table
  est écrite par `saveReview`, **dans sa transaction**, donc un jour marqué correspond
  toujours à une carte réellement révisée : ouvrir l'app et fermer l'onglet ne fait pas une
  journée. La version 2 du schéma la reconstruit depuis les réponses existantes, pour qu'une
  base déjà remplie ne perde pas sa série à la migration.

`tests/home.test.ts` monte l'écran sur la vraie chaîne, comme celui de la Pratique. Seul
`Date` y est simulé (`vi.useFakeTimers({ toFake: ['Date'] })`) : la série est une propriété
du calendrier, donc le test doit choisir le jour, mais figer les minuteries bloquerait Dexie.

## La théorie (`src/content/`)

Une fiche est un `.md` **compilé en composant Vue** par `unplugin-vue-markdown`. Elle
s'écrit comme un texte, mais peut appeler `<ConjugationTable>` : ses tableaux de formation
sortent donc du moteur au lieu d'être recopiés. C'est la raison du choix — une fiche qui
enseignerait `piensamos` pendant que la Pratique le refuse serait pire que pas de fiche.

Trois pièges de câblage, tous rencontrés :

- **`Markdown()` prend un `include: /\.md$/` explicite.** Son filtre par défaut couvre aussi
  les sous-requêtes `.md?vue&type=script`, que le plugin Vue émet **après** avoir compilé le
  bloc : le markdown s'appliquerait alors au JavaScript déjà produit, qui repartirait
  enveloppé dans un `<p>`. L'erreur qui en sort ne désigne rien de compréhensible.
- **`vue()` doit recevoir `include: [/\.vue$/, /\.md$/]`**, dans `vite.config.ts` **et** dans
  `vitest.config.ts`.
- **Le `<style scoped>` de `TheorySheetView` commence par `@reference '../style.css'`.** Le
  HTML issu du markdown n'a aucune classe à cibler, il est donc stylé là au `@apply` — et en
  Tailwind v4 un bloc isolé ne connaît le thème que par cette directive. C'est le seul
  endroit de l'app dans ce cas, parce que c'est le seul où le HTML n'est pas écrit à la main.

`src/content/index.ts` est le catalogue. L'ordre y compte : `sheetFor` retient la
**première** fiche qui couvre un temps, donc les fiches dédiées passent avant les
transversales. Aujourd'hui « indefinido ou imperfecto » répond pour les deux temps ; le jour
où chacun aura la sienne, elles se glisseront au-dessus sans que rien d'autre ne bouge.

### `srs/patterns.ts` — ce que les erreurs disent des patrons

C'est ici que `patternStats`, écrit depuis la phase 3, trouve enfin un lecteur. Savoir qu'on
rate `pensar` n'apprend rien ; savoir qu'on rate les `e→ie` renvoie à une règle et à la
fiche qui l'explique.

**`MIN_ATTEMPTS` (10) est le garde-fou** : une forme ratée une fois donne 100 % d'échec, ce
qui n'est pas une faiblesse mais un manque de données. En deçà, l'écran dit qu'il ne sait
pas, au lieu de désigner au hasard une fiche à relire.

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
