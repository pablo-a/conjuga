<script setup lang="ts">
import ConjugationTable from '@/components/ConjugationTable.vue'
</script>

L'impératif espagnol n'a pas de terminaisons à lui. Il emprunte ses formes à trois endroits
déjà connus — c'est ce qui le rend rapide à installer, et ce qui explique sa seule vraie
difficulté : **l'affirmatif et le négatif ne sont pas la même conjugaison**.

## Formation

### À l'affirmatif

| Personne           | D'où vient la forme                 | Exemple              |
| ------------------ | ----------------------------------- | -------------------- |
| `tú`               | 3ᵉ personne du singulier du présent | habla, come, vive    |
| `vosotros`         | l'infinitif, `-r` remplacé par `-d` | hablad, comed, vivid |
| `usted`, `ustedes` | le subjonctif présent               | hable, hablen        |
| `nosotros`         | le subjonctif présent               | hablemos             |

<div class="not-prose grid gap-3 sm:grid-cols-3">
  <ConjugationTable infinitive="hablar" tense="imperativo.afirmativo" />
  <ConjugationTable infinitive="comer" tense="imperativo.afirmativo" />
  <ConjugationTable infinitive="vivir" tense="imperativo.afirmativo" />
</div>

La forme de `vosotros` n'a **aucune exception** dans toute la langue : `hablad`, `comed`,
`id`, `sed`, `haced`, `decid`. C'est la seule case de tout l'espagnol dont on puisse dire
ça.

Comme la forme de `tú` est celle du présent, elle en hérite tout, diphtongue comprise :
`pensar` → `piensa`, `volver` → `vuelve`, `pedir` → `pide`. Et comme les formes de
politesse sont du subjonctif, elles héritent du `yo` du présent : `hacer` → `haga`,
`conocer` → `conozca`.

<div class="not-prose grid gap-3 sm:grid-cols-2">
  <ConjugationTable infinitive="pensar" tense="imperativo.afirmativo" />
  <ConjugationTable infinitive="hacer" tense="imperativo.afirmativo" />
</div>

### Au négatif

**Tout le négatif est du subjonctif présent**, aux six personnes, précédé de `no`. Deux
cases sur six changent donc de forme par rapport à l'affirmatif — précisément celles qui
n'étaient pas déjà du subjonctif, `tú` et `vosotros`.

<div class="not-prose grid gap-3 sm:grid-cols-2">
  <ConjugationTable infinitive="hablar" tense="imperativo.negativo" />
  <ConjugationTable infinitive="hacer" tense="imperativo.negativo" />
</div>

| Affirmatif  | Négatif        |
| ----------- | -------------- |
| habla       | no **hables**  |
| hablad      | no **habléis** |
| haz         | no **hagas**   |
| ven         | no **vengas**  |
| hable usted | no hable usted |

Les tableaux ci-dessus donnent la forme seule : à l'usage, elle est toujours précédée de
`no`.

## Les huit impératifs irréguliers de `tú`

Ce sont les seules formes à apprendre par cœur, et ce sont des verbes du quotidien. Toutes
sont des monosyllabes.

| Verbe   | `tú` | Verbe   | `tú` |
| ------- | ---- | ------- | ---- |
| `decir` | di   | `salir` | sal  |
| `hacer` | haz  | `ser`   | sé   |
| `ir`    | ve   | `tener` | ten  |
| `poner` | pon  | `venir` | ven  |

`ve` sert à la fois pour `ir` et pour `ver` — le contexte tranche, comme au prétérit de
`ser` et `ir`.

Leurs dérivés suivent, et l'allongement fait apparaître un accent écrit là où le
monosyllabe n'en portait pas : `tener` → **ten**, mais `obtener` → **obtén** ;
`poner` → **pon**, mais `componer` → **compón**. Le mot est plus long, il doit écrire
l'accent que le monosyllabe gardait implicite.

## Les pronoms changent de place

C'est indissociable de l'impératif, parce que la plupart des ordres en contiennent un.

- **À l'affirmatif, le pronom se soude à la fin du verbe** : `dímelo`, `levántate`,
  `hazlo`, `dáselo`. Le mot s'allonge, donc il prend souvent un accent écrit — `dime` n'en
  a pas, `dímelo` en a un.
- **Au négatif, le pronom repasse devant** : `no me lo digas`, `no te levantes`,
  `no lo hagas`.

Le français fait exactement la même bascule — « donne-le-moi » / « ne me le donne pas ».
C'est un des rares points où le réflexe français aide.

Une dernière irrégularité, minuscule mais visible : à l'affirmatif de `vosotros`, un verbe
pronominal **perd son `-d`** — `levantad` + `os` donne `levantaos`, pas _levantados_.
Une seule exception, `irse` → `idos`.

## Emploi

L'ordre, bien sûr, mais aussi tout ce qui se donne à faire : instructions, recettes, modes
d'emploi, invitations, conseils. `Oye`, `mira`, `venga`, `perdona` sont des impératifs
devenus des mots de la conversation courante.

Deux points de registre :

- L'impératif espagnol est **beaucoup moins brusque** que son équivalent français. _Dame
  un café_ n'est pas impoli ; l'espagnol ne ressent pas le besoin d'emballer chaque demande
  dans un conditionnel.
- Pour vouvoyer, on emploie la forme de `usted`, qui est une **3ᵉ personne** :
  _**Pase** usted_, _**Siéntese**_. Ce n'est pas la forme de `vosotros`, qui tutoie
  plusieurs personnes à la fois.

## Le piège pour francophones

### Le négatif n'est pas l'affirmatif précédé de `no`

C'est l'erreur numéro un du temps, et elle vient directement du français : « parle » et
« ne parle pas » ont la même forme, seule la négation s'ajoute. En espagnol, la forme
elle-même change.

> _**Habla** más despacio_ → _**No hables** tan rápido._ — jamais _no habla_.
> _**Haz** los deberes_ → _**No hagas** ruido._ — jamais _no haz_.

Le raccourci qui marche : dès qu'il y a `no`, on conjugue au subjonctif présent, et on
oublie l'impératif.

### `Vosotros` finit par `-d`, pas par `-s`

`hablad`, jamais _hablas_ ni _hablades_. Et au négatif, cette forme disparaît au profit du
subjonctif : `no habléis`.

### La forme de `tú` n'a pas de `-s`

`habla` (ordre) contre `hablas` (« tu parles »). Un `-s` de trop transforme l'ordre en
constat.
