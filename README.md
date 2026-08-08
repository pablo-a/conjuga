# Conjuga

PWA d'apprentissage de la conjugaison espagnole, pensée pour un francophone de niveau A2
et une session quotidienne de **20 minutes**.

- 100 % hors ligne, installable, aucune donnée envoyée nulle part.
- Un moteur de conjugaison qui explique **pourquoi** une forme est irrégulière, au lieu de
  se contenter de la donner.
- Répétition espacée (FSRS) pilotée par tes erreurs réelles.

Le plan détaillé, le vocabulaire du domaine et les décisions d'architecture sont dans
[PLAN.md](PLAN.md). Commence par là.

## Démarrer

```sh
npm install
npm run dev
```

## Commandes

| Commande            | Rôle                                                     |
| ------------------- | -------------------------------------------------------- |
| `npm run dev`       | Serveur de développement                                 |
| `npm run build`     | Typecheck puis build de production                       |
| `npm run preview`   | Sert le build (nécessaire pour tester le service worker) |
| `npm test`          | Tests Vitest                                             |
| `npm run typecheck` | `vue-tsc` sur tout le projet                             |
| `npm run lint`      | ESLint                                                   |
| `npm run format`    | Prettier                                                 |

Le service worker est désactivé en développement (`devOptions.enabled: false`) : pour vérifier
le comportement hors ligne, utiliser `npm run build && npm run preview`.

## Déploiement

Chaque push sur `main` publie sur GitHub Pages, après la suite de vérifications. Le site est
servi sous `/<dépôt>/`, ce que le build ne peut pas deviner : pour reproduire le déploiement
réel en local, `VITE_BASE=/conjuga/ npm run build && npm run preview`.

## Structure

Voir [PLAN.md](PLAN.md) §3. Le cœur du projet est `src/conjugation/`, un module pur sans
dépendance à l'UI, testé exhaustivement et vérifié contre une source externe indépendante.
