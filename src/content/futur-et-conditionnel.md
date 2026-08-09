<script setup lang="ts">
import ConjugationTable from '@/components/ConjugationTable.vue'
</script>

Ces deux temps tiennent dans une seule fiche parce qu'ils sont **solidaires** : ils se
construisent sur le même radical, et les douze verbes qui l'altèrent l'altèrent pour les
deux à la fois. Apprendre `tendré`, c'est avoir `tendría` par-dessus le marché.

## Formation

Contrairement à tous les autres temps, on ne retire rien : les terminaisons s'ajoutent à
**l'infinitif entier**.

<div class="not-prose grid gap-3 sm:grid-cols-3">
  <ConjugationTable infinitive="hablar" tense="indicativo.futuro" />
  <ConjugationTable infinitive="comer" tense="indicativo.futuro" />
  <ConjugationTable infinitive="vivir" tense="indicativo.futuro" />
</div>

Une seule série pour les trois groupes : `-é`, `-ás`, `-á`, `-emos`, `-éis`, `-án`.
**Toutes les personnes portent un accent écrit sauf `nosotros`** — c'est la marque
visuelle du temps, et son oubli le transforme en autre chose : `hablara` est un subjonctif.

Le conditionnel prend le même radical et les terminaisons de l'imparfait des `-er`/`-ir` —
`-ía`, `-ías`, `-ía`, `-íamos`, `-íais`, `-ían`. Ici, les six formes sont accentuées.

<div class="not-prose grid gap-3 sm:grid-cols-3">
  <ConjugationTable infinitive="hablar" tense="indicativo.condicional" />
  <ConjugationTable infinitive="comer" tense="indicativo.condicional" />
  <ConjugationTable infinitive="vivir" tense="indicativo.condicional" />
</div>

## Les douze radicaux irréguliers

C'est toute l'irrégularité de ces deux temps : douze verbes, un radical chacun, valable au
futur **et** au conditionnel. Ils se rangent en trois groupes qui aident à les retenir.

| Ce qui arrive                 | Verbes                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------ |
| La voyelle de la finale tombe | caber → cabr-, haber → habr-, poder → podr-, querer → querr-, saber → sabr-    |
| Elle est remplacée par un `d` | poner → pondr-, salir → saldr-, tener → tendr-, valer → valdr-, venir → vendr- |
| Le radical est raccourci      | decir → dir-, hacer → har-                                                     |

<div class="not-prose grid gap-3 sm:grid-cols-2">
  <ConjugationTable infinitive="tener" tense="indicativo.futuro" />
  <ConjugationTable infinitive="tener" tense="indicativo.condicional" />
  <ConjugationTable infinitive="decir" tense="indicativo.futuro" />
  <ConjugationTable infinitive="hacer" tense="indicativo.condicional" />
</div>

Les dérivés suivent : `obtener` → obtendré, `componer` → compondré, `deshacer` → desharé,
`contradecir` → contradiré. Et `ser`, `ir`, `ver`, `estar`, si irréguliers ailleurs, sont
ici parfaitement réguliers : `seré`, `iré`, `veré`, `estaré`.

## Emploi

### Le futur dit moins souvent l'avenir qu'on ne le croit

Pour un projet ou une intention, l'espagnol parlé préfère `ir a` + infinitif, ou même le
présent : _**Voy a llamarte** mañana_, _Mañana **llamo** a Ana_. Le futur simple sonne plus
formel, plus lointain, plus écrit.

En revanche il a un emploi que le français n'a pas, et qui est très fréquent : **la
conjecture au présent**. Il ne parle alors pas du tout de l'avenir, il exprime une
hypothèse sur maintenant.

> _— ¿Qué hora es? — **Serán** las tres._ — « Il doit être trois heures. »
> _No contesta, **estará** durmiendo._ — « Il ne répond pas, il doit dormir. »

Là où le français emploie « devoir », l'espagnol met un futur. C'est un réflexe à
installer, parce qu'il s'entend en permanence.

### Le conditionnel

Trois emplois, dans l'ordre de fréquence :

- **La politesse** : _¿**Podrías** ayudarme?_, _Me **gustaría** un café._ C'est le premier
  usage à maîtriser, parce qu'il rend une demande acceptable.
- **L'hypothèse** : _Con más tiempo, lo **haría** mejor._
- **Le futur du passé** : ce qui était à venir au moment du récit.
  _Dijo que **vendría** a las ocho._

Et symétriquement au futur de conjecture, il exprime **l'hypothèse dans le passé** :
_**Serían** las tres cuando llegó_ — « il devait être trois heures ».

## Le piège pour francophones

### Après `si`, ni futur ni conditionnel

Le français interdit déjà le futur après « si » ; l'espagnol interdit aussi le
conditionnel, et surtout, il ne met pas le même temps que le français dans l'hypothèse
irréelle.

| Français                                 | Espagnol                         |
| ---------------------------------------- | -------------------------------- |
| Si j'ai le temps, j'irai                 | Si **tengo** tiempo, iré         |
| Si j'**avais** de l'argent, j'achèterais | Si **tuviera** dinero, compraría |

Le second cas est le piège : là où le français pose un imparfait de l'indicatif,
l'espagnol pose un **imparfait du subjonctif**. Le conditionnel, lui, reste dans l'autre
moitié de la phrase — jamais après `si`.

### Le radical ne diphtongue jamais

C'est la faute qu'on fait en raisonnant trop bien. `poder` donne `puedo` au présent, donc
la main veut écrire _puedría_. Non : ces deux temps se construisent sur l'infinitif, et
l'infinitif ne diphtongue pas.

> `podría`, `contaría`, `volvería`, `dormiría` — jamais _puedría_, _cuentaría_,
> _vuelvería_, _duermiría_.

La règle est confortable : sauf pour les douze radicaux ci-dessus, il n'y a **rien** à
savoir. Si l'infinitif est là, la forme est juste.

### `Quand` + futur devient un subjonctif

Le français dit « quand j'aurai le temps ». L'espagnol ne met jamais de futur après
`cuando` : il met le subjonctif présent.

> _**Cuando tenga** tiempo, te llamo._ — jamais _cuando tendré_.

Même chose avec `en cuanto`, `hasta que`, `mientras`, `antes de que`. C'est un point de
subjonctif autant que de futur, et l'une des différences les plus visibles entre les deux
langues.

### `Habrá` est invariable

Le futur de `hay` est `habrá`, son conditionnel `habría` — au singulier, quel que soit ce
qui suit. _**Habrá** muchos problemas_, jamais _habrán_.
