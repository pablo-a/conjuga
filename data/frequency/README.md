# Données de fréquence

Entrées **de construction**, pas de livraison : rien de ce répertoire n'est embarqué dans
l'app. `scripts/build-verb-list.ts` les lit pour produire `src/data/verbs.json`, qui, lui,
est livré.

Elles sont versionnées malgré leur taille, parce qu'une liste de verbes doit pouvoir être
régénérée à l'identique. Une source téléchargée à la volée au moment du build rendrait le
résultat dépendant du jour où on l'a lancé.

## `es_50k.txt`

Les 50 000 formes espagnoles les plus fréquentes du corpus OpenSubtitles 2018.

|                  |                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Source           | [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords), `content/2018/es/es_50k.txt` |
| Licence          | MIT — © 2016 Hermit Dave                                                                                |
| Corpus d'origine | [OpenSubtitles2018](http://opus.nlpl.eu/OpenSubtitles2018.php) (projet OPUS)                            |
| Format           | `{mot} {occurrences}`, une par ligne, fréquence décroissante                                            |
| Taille           | 658 626 octets, 50 000 lignes, UTF-8                                                                    |
| sha256           | `dcff3ad4316192f4dc4ff7d26e637c6ff314ef1ca0f3f720c5649018a71056c0`                                      |

Pour la récupérer à nouveau :

```sh
gh api repos/hermitdave/FrequencyWords/contents/content/2018/es/es_50k.txt \
  --jq '.content' | base64 -d > data/frequency/es_50k.txt
```

### Ce que cette liste n'est pas

Elle donne des **formes**, jamais des lemmes, et n'indique aucune catégorie grammaticale.
`es` y figure au rang 8 et `está` au rang 21 sans que rien ne les rattache à `ser` et
`estar` ; les formes de `tener` sont éparpillées sur des centaines de rangs.

On ne peut donc pas en tirer un classement de verbes par simple filtrage. La méthode retenue
est l'inverse : pour chaque infinitif candidat, le moteur génère son paradigme complet et
l'on **somme les fréquences de toutes ses formes**. C'est le classement par lemme qui en
résulte qui alimente `verbs.json`.

Deux écueils que cette agrégation ne résout pas seule, et qui justifient la relecture
manuelle prévue par PLAN.md §5 :

- **les homographes** — `para` pèse 2,8 millions d'occurrences, mais c'est la préposition,
  pas `parar` à la troisième personne. Même piège avec `vino`, `sobre`, `cerca` ;
- **les noms en -ar, -er, -ir** — `lugar`, `mujer` et `ayer` sont des candidats plausibles
  pour un filtre qui ne regarde que la terminaison.

Le fichier compte 2 317 formes se terminant par `-ar`, `-er` ou `-ir` : c'est l'ensemble des
candidats à départager, pas le nombre de verbes.
