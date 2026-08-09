<script setup lang="ts">
import ConjugationTable from '@/components/ConjugationTable.vue'
</script>

Le subjonctif n'est pas un temps de plus : c'est un **mode**, et c'est le point où
l'espagnol et le français ont le plus divergé. Le français a laissé le sien s'éteindre dans
la conversation ; l'espagnol l'emploie tous les jours, et son absence s'entend
immédiatement.

## Formation

La règle est celle de l'échange des voyelles : on part de la forme `yo` du **présent de
l'indicatif**, on retire le `-o`, et on ajoute les terminaisons de l'autre groupe — un
verbe en `-ar` prend des terminaisons en `e`, un verbe en `-er`/`-ir` des terminaisons
en `a`.

<div class="not-prose grid gap-3 sm:grid-cols-3">
  <ConjugationTable infinitive="hablar" tense="subjuntivo.presente" />
  <ConjugationTable infinitive="comer" tense="subjuntivo.presente" />
  <ConjugationTable infinitive="vivir" tense="subjuntivo.presente" />
</div>

Passer par le `yo` plutôt que par l'infinitif n'est pas un détour : c'est ce qui rend
gratuite la plus grande partie des irrégularités. Tout ce qui déforme le `yo` du présent se
retrouve au subjonctif, aux six personnes.

| Présent `yo` | Subjonctif                                      |
| ------------ | ----------------------------------------------- |
| tengo        | tenga, tengas, tenga, tengamos, tengáis, tengan |
| hago         | haga, hagas, haga, hagamos, hagáis, hagan       |
| digo         | diga, digas, diga, digamos, digáis, digan       |
| pongo        | ponga…                                          |
| salgo        | salga…                                          |
| vengo        | venga…                                          |
| traigo       | traiga…                                         |
| conozco      | conozca…                                        |
| quepo        | quepa…                                          |

<div class="not-prose grid gap-3 sm:grid-cols-2">
  <ConjugationTable infinitive="tener" tense="subjuntivo.presente" />
  <ConjugationTable infinitive="conocer" tense="subjuntivo.presente" />
</div>

## Les irrégularités qui restent

### La botte, comme au présent

Les verbes à diphtongue la gardent aux quatre personnes toniques et la perdent à
`nosotros` et `vosotros` — même dessin qu'au présent de l'indicatif.

<div class="not-prose grid gap-3 sm:grid-cols-2">
  <ConjugationTable infinitive="pensar" tense="subjuntivo.presente" />
  <ConjugationTable infinitive="contar" tense="subjuntivo.presente" />
</div>

**Les verbes en `-ir` font exception**, et c'est le seul endroit où le subjonctif exige
davantage que le présent : leurs formes de `nosotros` et `vosotros` ne reviennent pas au
radical de l'infinitif, elles prennent la voyelle affaiblie — celle du gérondif et de la
3ᵉ personne du prétérit.

<div class="not-prose grid gap-3 sm:grid-cols-3">
  <ConjugationTable infinitive="pedir" tense="subjuntivo.presente" />
  <ConjugationTable infinitive="dormir" tense="subjuntivo.presente" />
  <ConjugationTable infinitive="sentir" tense="subjuntivo.presente" />
</div>

> `pensemos` mais **`pidamos`**, **`durmamos`**, **`sintamos`**.

### Les six que la règle ne donne pas

Leur `yo` du présent ne finit pas par `-o` : la dérivation n'a rien à mordre, et la forme
s'apprend telle quelle.

| Verbe   | Subjonctif                                |
| ------- | ----------------------------------------- |
| `ser`   | sea, seas, sea, seamos, seáis, sean       |
| `estar` | esté, estés, esté, estemos, estéis, estén |
| `ir`    | vaya, vayas, vaya, vayamos, vayáis, vayan |
| `haber` | haya, hayas, haya, hayamos, hayáis, hayan |
| `saber` | sepa, sepas, sepa, sepamos, sepáis, sepan |
| `dar`   | dé, des, dé, demos, deis, den             |

`dé` porte un accent écrit pour ne pas se confondre avec la préposition `de` — c'est un
accent de distinction, pas de prononciation. `ver` n'est pas dans la liste : son `yo` est
`veo`, donc la règle générale donne `vea` sans aide.

### Les adaptations graphiques

Comme partout, la consonne finale du radical s'ajuste pour garder son
son : `buscar` → `busque`, `llegar` → `llegue`, `empezar` → `empiece`, `coger` → `coja`.
Ce ne sont pas des irrégularités, et elles touchent ici les six personnes puisque toutes
les terminaisons commencent par la voyelle qui les déclenche.

## Emploi

Le subjonctif vit presque toujours dans une **subordonnée introduite par `que`**, et la
proposition principale décide de son apparition. Cinq déclencheurs couvrent l'essentiel.

| Ce que dit la principale   | Exemples de verbes                    | Exemple                             |
| -------------------------- | ------------------------------------- | ----------------------------------- |
| Volonté, influence         | querer, pedir, decir (ordre), esperar | _Quiero que **vengas**._            |
| Émotion, jugement          | alegrarse, es una pena, es importante | _Me alegro de que **estés** aquí._  |
| Doute, opinion niée        | dudar, no creer, es posible           | _No creo que **sea** verdad._       |
| But, condition, concession | para que, sin que, aunque             | _Te lo digo para que lo **sepas**._ |
| Souhait                    | ojalá                                 | _**Ojalá llueva**._                 |

Deux emplois de plus, très fréquents :

- **L'avenir dans les subordonnées de temps.** Après `cuando`, `en cuanto`, `hasta que`,
  `mientras`, `antes de que`, l'espagnol ne met jamais de futur : il met le subjonctif.
  _**Cuando llegues**, llámame._
- **Les relatives à antécédent indéterminé** : on cherche quelqu'un qui n'existe
  peut-être pas. _Busco a alguien que **hable** francés._ — mais _Conozco a alguien que
  **habla** francés._

## Le piège pour francophones

### Le français a lâché son subjonctif, pas l'espagnol

C'est le cœur du problème. Là où le français s'accommode d'un indicatif, l'espagnol exige
le subjonctif, et l'indicatif y sonne franchement faux.

| Français                           | Espagnol                |
| ---------------------------------- | ----------------------- |
| J'espère que tu **viendras**       | Espero que **vengas**   |
| Je veux que tu **viennes**         | Quiero que **vengas**   |
| Je ne pense pas que ce **soit** ça | No creo que **sea** eso |
| Dis-lui qu'il **vienne**           | Dile que **venga**      |

### `Creo que` prend l'indicatif, `no creo que` le subjonctif

La négation de l'opinion suffit à faire basculer le mode. C'est une bascule mécanique, et
elle est très visible à l'oral.

> _Creo que **tiene** razón._ — _No creo que **tenga** razón._

Même chose avec `es verdad que` / `no es verdad que`, `está claro que` / `no está claro
que`.

### `Cuando` + avenir n'est jamais un futur

Le réflexe français « quand j'aurai le temps » produit _cuando tendré_, qui est
impossible.

> _**Cuando tenga** tiempo, te llamo._

Le repère est simple : si l'action est encore à venir, `cuando` appelle le subjonctif. Si
elle est habituelle ou passée, il appelle l'indicatif — _Cuando **tengo** tiempo, leo._

### Même sujet, pas de `que`

Si les deux verbes ont le même sujet, l'espagnol passe à l'infinitif, exactement comme le
français.

> _Quiero **salir**._ — et non _quiero que salga_.
> _Quiero que **salgas**._ — deux sujets, donc `que` et subjonctif.

### Ce n'est pas un temps du futur

`vengas` ne veut pas dire « tu viendras ». Le subjonctif ne situe rien dans le temps : il
dit que le fait est visé, souhaité, redouté ou nié, pas qu'il a lieu. C'est la principale
raison pour laquelle on l'oublie — on cherche un temps là où il faut un mode.
