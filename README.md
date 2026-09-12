# Les 5 langages de l'amour — version Vite + React

## Démarrer

Node 24 est requis (`.nvmrc` — `nvm use` le prend en compte). C'est aussi la
version que lit la CI.

```bash
pnpm install
pnpm dev      # http://localhost:5173
pnpm build    # bundle statique dans dist/
```

## Tests

```bash
pnpm test           # mode watch
pnpm test:run       # une passe
pnpm test:coverage  # rapport de couverture dans coverage/
```

Les tests interrogent l'interface comme le ferait un lecteur d'écran
(rôles ARIA et libellés accessibles), sans `data-testid`.

## Formatage et lint

Biome tient le rôle de Prettier et d'ESLint à la fois, sur le JavaScript, le
JSX, le JSON et le CSS. La configuration vit dans `biome.json` : deux espaces,
guillemets simples, lignes à 100 colonnes, jeu de règles `recommended`.

```bash
pnpm format     # corrige : mise en forme, correctifs sûrs, tri des imports
pnpm check      # signale sans rien écrire
```

Un hook de pre-commit (husky) lance `biome check --write` sur les seuls fichiers
indexés, puis les réindexe : un commit mal formaté est corrigé au passage et
aboutit. Un diagnostic de sévérité *error* — une clé de liste instable, un rôle
ARIA qui devrait être une balise — refuse le commit. C'est la sévérité qui
tranche, et non la capacité de Biome à corriger tout seul : un *warning*, telle
une variable inutilisée, s'affiche et laisse passer, y compris en CI. La même
vérification tourne en CI (`pnpm check:ci`), car un hook local se contourne avec
`git commit --no-verify` et n'existe pas tant que `pnpm install` n'a pas tourné.

Deux choses à savoir :

- **`git add -p` et le hook font mauvais ménage.** `git update-index --again`
  réindexe **tout chemin déjà indexé qui diffère de `HEAD`**, entier — que Biome
  l'ait corrigé ou non. La portion que vous aviez délibérément laissée de côté
  part donc avec le commit, y compris dans un fichier auquel Biome n'a pas
  touché. Pour un commit partiel, passez par `git commit --no-verify` et lancez
  `pnpm format` ensuite.
- **Le blâme des lignes.** Deux commits ont reformaté tout le dépôt d'un coup.
  Ils sont listés dans `.git-blame-ignore-revs`, que GitHub lit tout seul. En
  local, une fois pour toutes :

  ```bash
  git config blame.ignoreRevsFile .git-blame-ignore-revs
  ```

Biome ne formate ni le Markdown ni le YAML : ce fichier, `AGENTS.md` et
`.github/workflows/ci.yml` restent à votre main.

## Icônes et aperçu de partage

L'app est faite pour vivre sur l'écran d'accueil d'un téléphone. Les icônes
(favicon, écran d'accueil iOS et Android, image d'aperçu quand on partage le
lien) sortent toutes d'un même dessin : un cœur carmin en pixel art sur une
grille 16×16, liseré d'un pixel plus rose, posé sur le bleu nuit du site.

Le motif et les encodeurs vivent dans `src/icons/` (grille, rendu SVG, rendu PNG
écrit à la main sur `zlib`) et sont couverts par des tests. `scripts/generate-icons.mjs`
en tire les fichiers de `public/`, qui sont versionnés :

```bash
pnpm icons     # à relancer seulement si le motif ou les couleurs changent
```

Aucune dépendance n'est nécessaire pour cela : du pixel art n'étant qu'une grille
de carrés, l'encodeur PNG tient en quelques dizaines de lignes et la CI n'a rien
de plus à installer.

Deux points à savoir avant de toucher au dessin :

- **La bordure de la grille reste vide.** Le liseré est déduit du remplissage et
  pousse vers l'extérieur ; sans cette marge, il déborderait du cadre. Un test
  garde l'invariant.
- **L'icône *maskable* est plus petite.** Android rogne l'icône selon la forme du
  lanceur et ne garantit que les 80 % centraux, d'où la `coverage` réduite dans
  le script.

L'`og:image` est déclarée en URL absolue dans `index.html` : les robots des
messageries ne résolvent pas les chemins relatifs. Si le domaine change, cette
URL est à mettre à jour.

## Intégration continue

`.github/workflows/ci.yml` rejoue `pnpm check:ci`, `pnpm test:coverage` puis
`pnpm build` sur chaque pull request vers `main` et sur chaque push vers `main`.
La vérification Biome passe en premier : elle rend la main en quelques secondes
là où les tests prennent le temps qu'ils prennent.

Les seuils de couverture vivent dans `vite.config.js` (`test.coverage.thresholds`) :
sous le seuil, `vitest` sort en erreur et la CI échoue. C'est donc la même
commande qui produit le rapport et qui bloque le merge. Les valeurs sont posées
quelques points sous la couverture réelle, pour absorber le bruit de mesure de
v8 sans laisser passer une régression franche.

`main` est protégée par un ruleset : passage par une pull request obligatoire,
CI verte obligatoire, force-push refusé. Aucune approbation n'est exigée, GitHub
interdisant d'approuver sa propre pull request.

## Déploiement

Le site est publié sur Netlify : <https://cinq-langages-amour.netlify.app>.
Chaque push sur `main` — donc chaque merge de pull request — déclenche le job
`deploy` de `.github/workflows/ci.yml`, qui pousse le `dist/` via la CLI Netlify.
Le bundle publié est exactement celui qui vient de passer les tests : il transite
d'un job à l'autre en artefact, il n'est pas reconstruit.

Sur une pull request, le job est *skipped* — sa garde exige un `push` sur `main`.
Il ne fait pas partie des checks requis du ruleset : un déploiement raté ne bloque
donc pas les merges suivants, il se rejoue.

Deux valeurs vivent côté GitHub :

| nom | type | contenu |
| --- | --- | --- |
| `NETLIFY_AUTH_TOKEN` | secret | personal access token Netlify (*User settings → Applications*) |
| `NETLIFY_SITE_ID` | variable | identifiant du site |

L'ID est une variable et non un secret : ce n'est pas une clé, et le garder lisible
dans les logs fait gagner du temps le jour où un déploiement vise le mauvais site.

Pour rejouer un déploiement raté, relancer le job depuis l'onglet Actions
(« Re-run failed jobs ») : l'artefact `dist` est conservé sept jours.

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
