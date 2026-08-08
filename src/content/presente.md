<script setup lang="ts">
import ConjugationTable from '@/components/ConjugationTable.vue'
</script>

## Formation

On retire la terminaison de l'infinitif (`-ar`, `-er`, `-ir`) et on ajoute celle de la
personne. Les trois modèles réguliers :

<div class="not-prose grid gap-3 sm:grid-cols-3">
  <ConjugationTable infinitive="hablar" tense="indicativo.presente" />
  <ConjugationTable infinitive="comer" tense="indicativo.presente" />
  <ConjugationTable infinitive="vivir" tense="indicativo.presente" />
</div>

Deux remarques qui font gagner du temps :

- **`-er` et `-ir` ne diffèrent qu'à `nosotros` et `vosotros`** (`comemos`/`vivimos`,
  `coméis`/`vivís`). Sur les quatre autres personnes, c'est la même conjugaison. Inutile de
  les apprendre comme deux séries.
- **`vosotros` porte toujours un accent écrit** : `-áis`, `-éis`, `-ís`. C'est la forme
  d'Espagne ; l'Amérique latine lui substitue `ustedes` et la 3ᵉ personne du pluriel.

## Les irrégularités, par famille

Presque toutes les irrégularités du présent tiennent en quatre patrons. Les apprendre
comme patrons couvre des centaines de verbes ; les apprendre verbe par verbe n'en couvre
aucun.

### La botte : diphtongaison sur la syllabe tonique

L'accent tonique tombe sur le radical à quatre personnes — `yo`, `tú`, `él`, `ellos` — et
sur la terminaison aux deux autres. **La voyelle du radical ne se brise que lorsqu'elle est
tonique**, d'où la forme en botte : `nosotros` et `vosotros` restent réguliers.

<div class="not-prose grid gap-3 sm:grid-cols-3">
  <ConjugationTable infinitive="pensar" tense="indicativo.presente" />
  <ConjugationTable infinitive="contar" tense="indicativo.presente" />
  <ConjugationTable infinitive="jugar" tense="indicativo.presente" />
</div>

| Patron   | Exemples                                            |
| -------- | --------------------------------------------------- |
| `e → ie` | pensar, querer, empezar, entender, sentir, preferir |
| `o → ue` | contar, poder, volver, dormir, encontrar, recordar  |
| `u → ue` | jugar — et lui seul                                 |

Rien dans l'infinitif ne dit si un verbe diphtongue : `contar` le fait, `montar` non. C'est
une propriété du verbe, à retenir avec lui. En revanche, une fois qu'on sait qu'il
diphtongue, on sait **où** : jamais à `nosotros` ni à `vosotros`.

### L'affaiblissement `e → i`

Réservé aux verbes en `-ir` : `pedir`, `servir`, `repetir`, `seguir`, `vestir`. Même
répartition en botte.

<div class="not-prose sm:max-w-xs">
  <ConjugationTable infinitive="pedir" tense="indicativo.presente" />
</div>

### La première personne à part

Beaucoup de verbes n'ont d'irrégulier que le `yo`. Le reste du présent est régulier — et
cette forme `yo` commande tout le subjonctif présent, ce qui la rend doublement rentable.

| Terminaison du `yo` | Verbes                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `-go`               | tener → **tengo**, poner → pongo, salir → salgo, hacer → hago, decir → digo, venir → vengo, traer → traigo, oír → oigo, caer → caigo |
| `-zco`              | conocer → **conozco**, et tous les verbes en `-ecer`, `-ocer`, `-ucir` : parecer, ofrecer, traducir                                  |
| isolés              | saber → **sé**, caber → quepo, ver → veo, dar → doy                                                                                  |

Plusieurs de ces verbes cumulent : `tener` a un `yo` en `-go` **et** une diphtongue
(`tengo`, mais `tienes`, `tiene`).

<div class="not-prose grid gap-3 sm:grid-cols-2">
  <ConjugationTable infinitive="tener" tense="indicativo.presente" />
  <ConjugationTable infinitive="conocer" tense="indicativo.presente" />
</div>

### Les quatre piliers

`ser`, `estar`, `ir` et `haber` ne suivent aucun patron. Ce sont aussi les quatre verbes
sans lesquels aucune phrase ne tient debout : ils se paient comptant.

<div class="not-prose grid gap-3 sm:grid-cols-2">
  <ConjugationTable infinitive="ser" tense="indicativo.presente" />
  <ConjugationTable infinitive="estar" tense="indicativo.presente" />
  <ConjugationTable infinitive="ir" tense="indicativo.presente" />
  <ConjugationTable infinitive="haber" tense="indicativo.presente" />
</div>

## Emploi

Le présent espagnol recouvre l'essentiel des emplois du présent français : fait actuel,
habitude, vérité générale.

Trois emplois méritent d'être signalés :

- **Le futur proche** se dit très volontiers au présent : _Mañana **voy** al cine._ Là où le
  français hésite entre « je vais aller » et « j'irai », l'espagnol pose le présent sans
  façon.
- **La durée en cours** se dit avec `desde hace` ou `llevar` : _**Vivo** aquí desde hace tres
  años_, _**Llevo** tres años aquí._ Le verbe reste au présent, comme en français.
- **L'hypothèse en `si`** prend le présent : _Si **tienes** tiempo, llámame._

## Le piège pour francophones

### Le pronom sujet ne s'écrit pas

En français, la conjugaison est presque muette : _je parle_, _tu parles_, _il parle_ et
_ils parlent_ se prononcent tous `/paʁl/`. Le pronom est donc **obligatoire**, il porte à
lui seul l'information de personne.

En espagnol, les six formes s'entendent et se distinguent. Le pronom devient redondant, et
on le supprime : on dit `hablo`, pas `yo hablo`. Le garder partout n'est pas une faute de
grammaire, mais c'est la marque la plus reconnaissable d'un francophone débutant. On ne le
remet que pour **contraster** : _Yo trabajo, tú duermes._

### La diphtongue s'arrête à `nosotros`

C'est l'erreur la plus fréquente de toutes, parce que le français n'a rien de comparable :
sa conjugaison ne touche pas à la voyelle du radical. Le réflexe est donc d'appliquer la
diphtongue partout.

> `pienso`, `piensas`, `piensa`, mais **`pensamos`** — jamais _piensamos_.

### Pas de `-nt` à la troisième personne du pluriel

_Ils parlent_ → `hablan`, pas _hablant_. Le `-n` final suffit.

### « Je suis en train de » n'est pas le présent

Le français emploie son présent pour l'action en cours ; l'espagnol a une tournure dédiée,
`estar` + gérondif, et l'utilise beaucoup plus souvent que le français n'utilise « être en
train de » : _**Estoy comiendo**_ pour « je mange (là, maintenant) ».
