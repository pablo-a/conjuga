<script setup lang="ts">
import ConjugationTable from '@/components/ConjugationTable.vue'
</script>

## Formation

On retire la terminaison de l'infinitif et on ajoute celle de la personne. Comme au
présent, les `-er` et les `-ir` partagent la même série — ici, **exactement** la même, sur
les six personnes.

<div class="not-prose grid gap-3 sm:grid-cols-3">
  <ConjugationTable infinitive="hablar" tense="indicativo.indefinido" />
  <ConjugationTable infinitive="comer" tense="indicativo.indefinido" />
  <ConjugationTable infinitive="vivir" tense="indicativo.indefinido" />
</div>

Deux choses à remarquer tout de suite, parce qu'elles décident de la moitié des fautes :

- **`yo` et `él` portent un accent écrit** : `hablé`/`habló`, `comí`/`comió`. L'accent
  n'est pas décoratif, c'est lui qui porte le temps. `hablo` est un présent, `habló` un
  passé — un seul signe les sépare.
- **Deux formes se confondent avec le présent** : `hablamos` et `vivimos` sont les mêmes
  aux deux temps. Le contexte tranche, et c'est normal. En revanche `comemos` (présent) et
  `comimos` (passé) se distinguent bien : la confusion ne touche que les `-ar` et les `-ir`.

## Les irrégularités, par famille

### Les prétérits forts

C'est la grande famille du temps, et de loin la plus rentable : une quinzaine de radicaux
couvrent, avec leurs dérivés, la quasi-totalité des verbes fréquents. Un prétérit fort a
deux propriétés, toujours ensemble :

1. un **radical modifié**, le même aux six personnes ;
2. des terminaisons **sans accent écrit** : `-e`, `-iste`, `-o`, `-imos`, `-isteis`,
   `-ieron` — et non `-í`/`-ió`.

<div class="not-prose grid gap-3 sm:grid-cols-3">
  <ConjugationTable infinitive="tener" tense="indicativo.indefinido" />
  <ConjugationTable infinitive="hacer" tense="indicativo.indefinido" />
  <ConjugationTable infinitive="decir" tense="indicativo.indefinido" />
</div>

| Verbe   | Radical | Verbe      | Radical |
| ------- | ------- | ---------- | ------- |
| `tener` | tuv-    | `venir`    | vin-    |
| `estar` | estuv-  | `hacer`    | hic-    |
| `andar` | anduv-  | `querer`   | quis-   |
| `poder` | pud-    | `decir`    | dij-    |
| `poner` | pus-    | `traer`    | traj-   |
| `saber` | sup-    | `conducir` | conduj- |
| `haber` | hub-    | `caber`    | cup-    |

Deux détails à l'intérieur de la famille :

- **Les radicaux en `j` avalent le `i` de la 3ᵉ personne du pluriel** : `dijeron`,
  `trajeron`, `condujeron` — jamais _dijieron_. C'est vrai de tous les verbes en `-ducir`,
  qui sont légion : `producir`, `traducir`, `reducir`, `introducir`.
- **`hacer` écrit `hizo`** et non _hico_ : le `c` deviendrait dur devant le `o`, et le son
  serait perdu. Même logique que `busqué` plus bas.

### `ser` et `ir` ont le même prétérit

`fui`, `fuiste`, `fue`, `fuimos`, `fuisteis`, `fueron` — pour les deux verbes. Rien ne les
distingue, et rien n'a besoin de les distinguer : _**Fui** al cine_ ne peut être qu'« aller »,
_**Fue** difícil_ ne peut être qu'« être ».

<div class="not-prose grid gap-3 sm:grid-cols-2">
  <ConjugationTable infinitive="ser" tense="indicativo.indefinido" />
  <ConjugationTable infinitive="dar" tense="indicativo.indefinido" />
</div>

`dar` et `ver` sont l'autre curiosité : ce sont des verbes courts qui prennent les
terminaisons des `-er`/`-ir`, **sans accent écrit** parce que le résultat est un
monosyllabe — `di`, `dio`, `vi`, `vio`.

### La troisième personne des verbes en `-ir`

Les verbes en `-ir` qui changent de voyelle au présent la changent aussi à
l'`indefinido`, mais **seulement à la 3ᵉ personne**, singulier et pluriel. Partout ailleurs
le radical reste celui de l'infinitif.

<div class="not-prose grid gap-3 sm:grid-cols-3">
  <ConjugationTable infinitive="pedir" tense="indicativo.indefinido" />
  <ConjugationTable infinitive="dormir" tense="indicativo.indefinido" />
  <ConjugationTable infinitive="sentir" tense="indicativo.indefinido" />
</div>

| Patron  | Exemples                                                             |
| ------- | -------------------------------------------------------------------- |
| `e → i` | pedir → pidió, sentir → sintió, preferir → prefirió, seguir → siguió |
| `o → u` | dormir → durmió, morir → murió                                       |

**C'est exactement la voyelle du gérondif** : `pidiendo`, `durmiendo`, `sintiendo`. Les
deux formes se tiennent, et savoir l'une donne l'autre.

### `i → y` entre deux voyelles

Quand le radical finit par une voyelle, le `i` de la terminaison se retrouverait coincé
entre deux voyelles : il devient `y`. Aux autres personnes, il porte un accent écrit.

| Verbe       | 3ᵉ personne             | Autres personnes       |
| ----------- | ----------------------- | ---------------------- |
| `leer`      | leyó, leyeron           | leí, leíste, leímos    |
| `creer`     | creyó, creyeron         | creí, creíste, creímos |
| `caer`      | cayó, cayeron           | caí, caíste, caímos    |
| `oír`       | oyó, oyeron             | oí, oíste, oímos       |
| `construir` | construyó, construyeron | construí, construiste  |

### Les adaptations graphiques du `yo`

Elles ne sont **pas** des irrégularités : la prononciation ne change pas, c'est
l'orthographe qui s'ajuste pour la conserver devant le `-é`.

| Infinitif en | Devient | Exemple          |
| ------------ | ------- | ---------------- |
| `-car`       | `qu`    | buscar → busqué  |
| `-gar`       | `gu`    | llegar → llegué  |
| `-zar`       | `c`     | empezar → empecé |

Sans elles, _buscé_ se prononcerait avec le `c` de `cerca`, et _llegé_ avec une jota. Une
seule personne est touchée — les cinq autres sont parfaitement régulières.

## Emploi

L'`indefinido` raconte un fait passé, achevé, dans une période fermée : _Ayer **comí**
paella_, _La guerra **duró** cinco años_. C'est le temps du récit.

Sa vraie difficulté n'est pas sa formation mais sa frontière avec l'`imperfecto`, qui a sa
fiche :
<RouterLink :to="{ name: 'theory-sheet', params: { slug: 'indefinido-ou-imperfecto' } }">Indefinido ou imperfecto</RouterLink>.

## Le piège pour francophones

### Ce n'est pas un temps littéraire

Le passé simple français ne se parle plus : « je mangeai » sonne comme un roman du
XIXᵉ siècle. L'`indefinido` espagnol, lui, est le temps ordinaire de la conversation. On le
dit au café, on l'écrit dans un message.

> _Ayer **comí** paella._ — « Hier, j'ai mangé de la paella. »

Le réflexe de le réserver à l'écrit soutenu, ou de le remplacer par un `perfecto`, produit
un espagnol faux. C'est l'inverse du français : ici, le temps « du récit » est aussi celui
du quotidien.

### Les prétérits forts ne portent pas d'accent — et ça s'entend

C'est la faute d'accent la plus fréquente du temps, parce qu'elle vient d'une régularité
bien apprise. `hablé` a l'accent sur la finale ; `tuve` l'a sur la première syllabe.

> `hablé`, `comí`, `viví` — mais **`tuve`**, **`pude`**, **`dije`**, **`hice`**.

L'absence d'accent écrit n'est pas un oubli : elle dit que la syllabe tonique a bougé.
Écrire _tuvé_ déplace l'accent de la voix, pas seulement un signe.

### Un seul signe sépare le présent du passé

`hablo` / `habló`, `hablo` / `hablé`, `cambio` / `cambió`. Sur ces verbes, l'accent écrit
n'est pas un ornement : c'est la marque du temps, et l'omettre change ce qu'on dit.

> _**Trabajo** mucho_ — je travaille beaucoup.
> _**Trabajó** mucho_ — il a beaucoup travaillé.
