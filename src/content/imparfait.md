<script setup lang="ts">
import ConjugationTable from '@/components/ConjugationTable.vue'
</script>

## Formation

C'est le temps le plus régulier de l'espagnol, et de très loin. Deux séries de
terminaisons, aucune diphtongue, aucun radical modifié : le radical est celui de
l'infinitif, du premier au dernier verbe.

<div class="not-prose grid gap-3 sm:grid-cols-3">
  <ConjugationTable infinitive="hablar" tense="indicativo.imperfecto" />
  <ConjugationTable infinitive="comer" tense="indicativo.imperfecto" />
  <ConjugationTable infinitive="vivir" tense="indicativo.imperfecto" />
</div>

Les verbes qui donnent du fil à retordre partout ailleurs sont ici sans histoire :
`tener` → `tenía`, `hacer` → `hacía`, `decir` → `decía`, `poder` → `podía`,
`querer` → `quería`, `poner` → `ponía`. Aucune botte, aucun prétérit fort. C'est le seul
temps dont on peut dire : si vous connaissez l'infinitif, vous savez le conjuguer.

L'accent écrit, en revanche, est partout, et il n'est pas négociable :

- **`-er` et `-ir` : les six formes portent un accent** sur le `í`, parce que le `ía` est
  un hiatus — deux syllabes, pas une. Sans l'accent, `comia` se lirait en deux syllabes
  avec l'accent sur le `mi`.
- **`-ar` : seul `nosotros` en porte un**, `hablábamos`. L'accent y tombe sur
  l'antépénultième syllabe, et une forme accentuée si haut s'écrit toujours avec l'accent.

## Les trois irréguliers

Ils sont trois. Pas trois familles : trois verbes, dans tout l'espagnol.

<div class="not-prose grid gap-3 sm:grid-cols-3">
  <ConjugationTable infinitive="ser" tense="indicativo.imperfecto" />
  <ConjugationTable infinitive="ir" tense="indicativo.imperfecto" />
  <ConjugationTable infinitive="ver" tense="indicativo.imperfecto" />
</div>

`ver` mérite un mot : `veía` n'est irrégulier que parce qu'il garde le `e` du radical
ancien (`veer`). Une fois ce `e` accepté, les terminaisons sont celles de tout le monde.
`ser` et `ir` ne se raccrochent à rien : `era` et `iba` s'apprennent tels quels — et se
retiennent vite, car on ne peut pas parler du passé sans eux.

## Emploi

L'`imperfecto` **décrit** au lieu de raconter. Il pose un cadre sans en marquer les bords.

- **La description** : décor, âge, heure, météo, état physique ou moral.
  _**Era** de noche y **llovía**._
- **L'habitude passée** : ce qu'on faisait régulièrement, l'équivalent de « avant, je… ».
  _De pequeño **jugaba** al fútbol todos los domingos._
- **L'action en cours**, souvent interrompue par un `indefinido`.
  _**Comía** cuando **sonó** el teléfono._
- **La politesse**, au présent malgré les apparences : _**Quería** pedirte un favor._
  L'imparfait adoucit la demande, exactement comme le français « je voulais te demander ».

Sa vraie difficulté est de savoir quand lui préférer l'`indefinido` — c'est le sujet de la
fiche
<RouterLink :to="{ name: 'theory-sheet', params: { slug: 'indefinido-ou-imperfecto' } }">Indefinido ou imperfecto</RouterLink>,
et le point sur lequel un francophone se trompe le plus.

## Le piège pour francophones

### `yo` et `él` sont identiques

C'est le seul temps de l'indicatif où deux personnes se confondent : `hablaba` vaut pour
« je parlais » et « il parlait ». Le présent, lui, distingue tout.

La conséquence prend à revers ce qu'on a appris ailleurs : **ici, le pronom sujet
redevient parfois nécessaire**. Le principe reste qu'on ne l'écrit pas, mais si le
contexte ne dit pas de qui l'on parle, `yo` ou `él` lève l'ambiguïté — et sur ce temps, ce
n'est plus une lourdeur, c'est de l'information.

> _**Yo** vivía en Madrid, **él** vivía en Sevilla._

### `Había` ne se met jamais au pluriel

`Hay` (« il y a ») a pour imparfait `había`, et cette forme est **impersonnelle** : elle
n'a pas de sujet, donc rien avec quoi s'accorder. Le nom qui suit est un complément, pas un
sujet.

> _**Había** mucha gente._ — _**Había** muchos coches._ — jamais _habían muchos coches_.

Le français dit « il y avait » sans jamais accorder non plus ; la faute vient de ce que
l'espagnol n'a pas de « il » visible pour rappeler que la forme est figée.

### « Il y a trois ans » se dit avec `hacía` dans le passé

Le `hace` des durées suit le récit : au présent `hace tres años`, dans un récit au passé
`hacía tres años`.

> _**Hacía** tres años que **vivía** allí._ — Cela faisait trois ans qu'il y habitait.

### L'imparfait français ne le recouvre pas

Beaucoup de « je faisais » français se rendent par un `indefinido`, et beaucoup de « j'ai
fait » par un `imperfecto`. Traduire le temps plutôt que le sens est l'erreur numéro un du
passé espagnol — voir la fiche dédiée.
