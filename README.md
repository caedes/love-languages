# Les 5 langages de l'amour — version Vite + React

## Démarrer

```bash
pnpm install
pnpm dev      # http://localhost:5173
pnpm build    # bundle statique dans dist/
```

## Arborescence

```
index.html
vite.config.js
src/
  main.jsx                            point d'entrée React
  App.jsx                             tout l'écran : accueil, passation, résultats
  questionnaire.js                    données, couleurs des dimensions, helpers
  data/langages-amour-questions.json  les 30 items (seule source de vérité)
  styles/nocturne.css                 tokens et composants du design system Nocturne
  styles/app.css                      resets, keyframes, classes .lq-chip / .lq-tab
```

## Modifier les questions

Éditer `src/data/langages-amour-questions.json` : le fichier est importé par
`src/questionnaire.js`, donc Vite recharge à chaud. La structure attendue est
`meta.dimensions` (5 codes), `meta.interpretation` (seuils) et `items[]` (deux
`options` avec `code` + `texte` par item).

Pour consommer le JSON au runtime plutôt qu'au build (le changer sans rebuild),
déplacer le fichier dans `public/` et remplacer l'import par un `fetch('/langages-amour-questions.json')`.

## Notes de comportement

- L'ordre d'affichage des deux propositions est tiré au sort à chaque item.
- La passation est sauvegardée en `localStorage` (clé `langages-amour-v1`) à
  chaque changement d'état ; « Commencer » efface cette sauvegarde, « Recommencer »
  la conserve et ramène à l'accueil.
- Aucun appel réseau, aucune dépendance en dehors de React.
