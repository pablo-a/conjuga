<script setup lang="ts">
import ConjugationTable from '@/components/ConjugationTable.vue'
</script>

## Formation

`haber` conjugué au présent, suivi du **participe passé**. C'est le premier des temps
composés, et le seul qu'il faut vraiment installer : les six autres se construisent
exactement pareil, en changeant simplement le temps de `haber`.

<div class="not-prose grid gap-3 sm:grid-cols-3">
  <ConjugationTable infinitive="hablar" tense="indicativo.perfecto" />
  <ConjugationTable infinitive="comer" tense="indicativo.perfecto" />
  <ConjugationTable infinitive="vivir" tense="indicativo.perfecto" />
</div>

Le participe régulier se fabrique en une ligne :

| Infinitif en | Participe en | Exemple          |
| ------------ | ------------ | ---------------- |
| `-ar`        | `-ado`       | hablar → hablado |
| `-er`        | `-ido`       | comer → comido   |
| `-ir`        | `-ido`       | vivir → vivido   |

Une seule adaptation : si le radical d'un verbe en `-er`/`-ir` finit par une voyelle, le
`i` du participe porte un accent écrit, parce qu'il forme une syllabe à lui seul —
`leído`, `creído`, `caído`, `oído`, `traído`. Sans l'accent, `leido` se lirait en une
syllabe.

## Les participes irréguliers

Ils sont peu nombreux, mais ce sont des verbes qu'on emploie tous les jours. Il n'y a pas
de règle : cette liste s'apprend telle quelle.

| Verbe      | Participe | Verbe      | Participe |
| ---------- | --------- | ---------- | --------- |
| `abrir`    | abierto   | `poner`    | puesto    |
| `cubrir`   | cubierto  | `resolver` | resuelto  |
| `decir`    | dicho     | `romper`   | roto      |
| `escribir` | escrito   | `ver`      | visto     |
| `hacer`    | hecho     | `volver`   | vuelto    |
| `morir`    | muerto    |            |           |

**Les dérivés suivent leur base**, et c'est ce qui rend la liste rentable : `descubrir` →
descubierto, `devolver` → devuelto, `componer` → compuesto, `describir` → descrito,
`satisfacer` → satisfecho. Onze participes appris en couvrent une centaine.

<div class="not-prose grid gap-3 sm:grid-cols-2">
  <ConjugationTable infinitive="ver" tense="indicativo.perfecto" />
  <ConjugationTable infinitive="decir" tense="indicativo.perfecto" />
</div>

## Emploi

Le `pretérito perfecto` est le passé **rattaché au présent** : la période dans laquelle
l'action s'inscrit n'est pas close au moment où l'on parle.

- La période court encore : `hoy`, `esta mañana`, `esta semana`, `este mes`, `este año`.
  _Esta semana **he trabajado** mucho._
- Le bilan tient jusqu'à maintenant : `ya`, `todavía no`, `nunca`, `alguna vez`,
  `siempre`, `dos veces`. _¿**Has estado** alguna vez en Sevilla?_
- Le passé très récent, sans marqueur : _**He perdido** las llaves._ — l'ennui dure.

Dès que la période est fermée — `ayer`, `el año pasado`, `en 2019` — on bascule sur
l'`indefinido`. Le partage est traité en détail dans
<RouterLink :to="{ name: 'theory-sheet', params: { slug: 'indefinido-ou-imperfecto' } }">Indefinido ou imperfecto</RouterLink>.

C'est un usage d'Espagne. En Amérique latine, l'`indefinido` occupe très largement le
terrain du `perfecto`, y compris pour aujourd'hui : _Hoy **comí** paella._

## Le piège pour francophones

### Le participe ne s'accorde jamais

En français, le participe employé avec _avoir_ s'accorde avec le complément d'objet direct
placé avant lui : « la lettre que j'ai **écrite** ». Cette règle n'a aucun équivalent
espagnol. Dans un temps composé, le participe est **invariable**, quoi qu'il arrive.

> _**He escrito** una carta._ — jamais _he escrita_.
> _Las cartas que **he escrito**._ — jamais _que he escritas_.

Le participe s'accorde en espagnol, mais seulement quand il est adjectif, hors de tout
temps composé : _La carta está **escrita**._ Là, il ne suit plus `haber` : il qualifie.

### Un seul auxiliaire, et ce n'est pas `tener`

Le français a deux auxiliaires — _avoir_ et _être_ — répartis par type de verbe. L'espagnol
n'en a qu'un, `haber`, pour **tous** les verbes : de mouvement, pronominaux, sans exception.

> _**He ido** al médico._ — « je suis allé », mais avec `haber`.
> _**Me he levantado** temprano._ — jamais _soy levantado_.

Et `haber` n'est pas `tener`. Le français emploie « avoir » pour les deux, ce qui pousse à
écrire _tengo hablado_. `haber` ne sert qu'à composer les temps ; `tener` veut dire
posséder.

### Rien ne se glisse entre `haber` et le participe

Le bloc est soudé. Les adverbes se placent avant ou après, jamais au milieu, et les
pronoms compléments passent **devant `haber`**.

> _Siempre **he dicho** lo mismo._ — jamais _he siempre dicho_.
> _**Lo he visto** esta mañana._ — jamais _he lo visto_.

C'est l'inverse du réflexe français, qui autorise « j'ai toujours dit ».

### `Hay` a aussi son passé composé

La forme impersonnelle `hay` (« il y a ») est un `haber`, et son passé composé est
`ha habido` — au singulier, quel que soit le nombre.

> _**Ha habido** muchos problemas._ — jamais _han habido_.
