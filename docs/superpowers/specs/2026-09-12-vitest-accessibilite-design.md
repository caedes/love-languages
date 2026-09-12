# Tests unitaires Vitest orientés accessibilité

- **Date** : 2026-09-12
- **Statut** : design validé, prêt pour le plan d'implémentation
- **Périmètre** : mise en place de Vitest, extraction du calcul hors de `App.jsx`,
  corrections d'accessibilité induites, première série de tests.

## Contexte

Le projet est une application Vite 8 + React 18 sans aucune dépendance de test.
La logique tient dans deux fichiers : `src/questionnaire.js` (données, couleurs,
`levelFor`, `de`) et `src/App.jsx`, un composant classe de 485 lignes qui porte à
lui seul le calcul des scores, la persistance `localStorage`, l'anti-biais de
position et les trois écrans.

Le questionnaire compte 30 items à choix forcé entre deux propositions. Chacune
des cinq dimensions apparaît exactement 12 fois, ce qui fonde le
`scoreMaxParDimension: 12` de `meta`.

## Décisions

| Question | Décision | Raison |
|---|---|---|
| Sens de « accessibilité » | Requêtes par rôle et par libellé, et correction de l'app quand un élément n'est pas atteignable ainsi | L'accessibilité devient une conséquence testée plutôt qu'une cible déclarative ; aucun `data-testid` de contournement |
| Périmètre | Extraction du calcul vers un module pur + tests de parcours sur les trois écrans | Un échec localise le défaut : calcul ou affichage |
| Outillage | `test`, `test:run`, `test:coverage` ; pas de CI, pas de seuil bloquant | On mesure d'abord, on décide ensuite |
| Non-déterminisme | `vi.spyOn(Math, 'random')` et `localStorage.clear()` dans le setup | Pas d'API de production ajoutée pour le seul besoin des tests (YAGNI) |
| Découpage d'`App.jsx` en composants d'écran | Reporté | Refactoring d'architecture à décider pour lui-même, une fois le filet de tests posé |
| Vrais onglets ARIA sur l'écran de résultats | Refusé | `role="tab"` engage un contrat de navigation au clavier ; l'implémenter à moitié serait moins utilisable que les trois boutons actuels |
| Snapshot du JSON | Sur une projection (`id` + paire de codes), pas sur le fichier entier | Git assure déjà la revue du diff ; la projection isole la structure psychométrique de l'éditorial |

Prénoms de fixture : **Alice** et **Bob**. Ils couvrent au passage les deux
branches de l'élision de `de()` (`d'Alice`, `de Bob`).

## Section 1 — Infrastructure

### Dépendances

Installées en `devDependencies` avec **pnpm** (le dépôt est verrouillé par un
`pnpm-lock.yaml`) :

| Paquet | Version | Note |
|---|---|---|
| `vitest` | `^5` | Déclare `vite: ^6 \|\| ^7 \|\| ^8`, compatible avec le Vite 8.3 du projet |
| `@vitest/coverage-v8` | `^5` | Peer stricte : la version doit être identique à celle du runner |
| `jsdom` | `^30` | Environnement DOM |
| `@testing-library/react` | `^16` | |
| `@testing-library/dom` | `^10` | Peer explicite de RTL 16, ne s'installe pas seule |
| `@testing-library/user-event` | `^14` | |
| `@testing-library/jest-dom` | `^6` | Matchers `toBeDisabled`, `toHaveAttribute`, etc. |

### Configuration

Le bloc `test` est ajouté à `vite.config.js` plutôt que dans un
`vitest.config.js` séparé, pour garder une seule source de vérité sur le plugin
React. L'import passe de `vite` à `vitest/config`, qui ré-exporte `defineConfig`
de Vite : le reste du fichier est inchangé.

Réglages :

- `environment: 'jsdom'`
- `globals: true` — active aussi le nettoyage automatique du DOM par RTL entre
  les tests
- `setupFiles: './src/test/setup.js'`
- couverture `v8`, rapporteurs `text` et `html`, `include: ['src/**']`,
  `exclude` sur `src/data/**`, `src/styles/**`, `src/main.jsx` et les fichiers de
  test. Aucun seuil bloquant.

### Fichier de setup

`src/test/setup.js` :

1. importe `@testing-library/jest-dom/vitest` ;
2. déclare un `afterEach` global qui appelle `localStorage.clear()` puis
   `vi.restoreAllMocks()`.

Ce point est structurant : `componentDidUpdate` écrit dans `localStorage` à
chaque changement d'état, donc sans nettoyage le test suivant démarre en croyant
reprendre une passation en cours.

### Conventions

Fichiers de test à côté du code testé, suffixés `.test.js` / `.test.jsx`. Pas de
dossier `__tests__` séparé.

Scripts `package.json` : `test` (watch), `test:run` (une passe, sortie non
interactive), `test:coverage`. Ajout de `coverage` au `.gitignore` et d'une
section « Tests » au README.

## Section 2 — Extraction de `src/scoring.js`

Module sans état ni React. Il reçoit des données, il rend des données.

| Fonction | Entrées | Sortie |
|---|---|---|
| `resolveNames(nameA, nameB)` | les deux saisies brutes | couple de prénoms, `trim` et repli `Personne 1` / `Personne 2` appliqués |
| `scores(answersOfOne)` | un tableau de codes | `{ P, M, C, S, T }` |
| `profileRows(answersOfOne)` | idem | lignes triées par score décroissant : `code`, `nom`, `score`, `pct`, `color`, `niveau` |
| `vigilanceList(answers, names)` | les deux tableaux + prénoms | écarts primaire (>= 9) contre neutre (<= 4) |
| `divergenceList(answers, names)` | idem | items où les deux codes diffèrent |
| `summaryText(answers, names)` | idem | le texte de la synthèse copiée |
| `makeOrders()` | — | 30 tirages 0/1, lit `Math.random` |
| `slotFor(code, item, flipped)` | une dimension | sa position à l'écran (0/1), ou `null` |
| `codeAt(item, flipped, slot)` | une position cliquée | la dimension correspondante |

`slotFor` existe aujourd'hui comme méthode d'`App`, mais son inverse est écrit à
la main dans `pick`. Sortir les deux permet de tester la règle anti-biais dans
les deux sens, sur le même couple de fonctions — c'est là que se logerait un bug
silencieux, celui qui attribue les points à la mauvaise dimension sans que rien
ne se voie à l'écran.

`levelFor` et `de` restent dans `questionnaire.js`, qui garde son rôle de
données et helpers ; `scoring.js` importe `levelFor`.

Dans `App.jsx`, les méthodes devenues des coquilles (`names`, `scores`,
`profileRows`, `vigilanceList`, `divergenceList`, `summaryText`, `makeOrders`,
`slotFor`) sont supprimées et remplacées par des appels directs via
`import * as scoring from './scoring.js'`, sur une dizaine de sites d'usage.

Cette section ne change aucun comportement : c'est du déplacement à l'identique,
et les tests de parcours de la section 4 en sont la preuve.

## Section 3 — Corrections d'accessibilité

Principe : on ne corrige que ce qu'un test par rôle réclame, et chaque
correction ouvre une assertion.

1. **Puces de choix** — deux boutons nommés « Alice » coexistent à l'écran, un
   par proposition. Aucune requête par rôle ne les distingue, et un lecteur
   d'écran annonce « Alice, Alice » sans rattacher chacun à sa phrase. Chaque
   carte de proposition devient un `role="group"` porteur d'un `aria-labelledby`
   pointant sur le `<p>` du texte. Les tests passent alors par
   `within(getByRole('group', { name: /…/ })).getByRole('button', { name: 'Alice' })`.
2. **État sélectionné** — aujourd'hui porté par la couleur et par un « ✓ » collé
   dans le libellé, ce qui fait basculer le nom accessible de « Alice » à
   « ✓ Alice ». Ajout de `aria-pressed`, et passage du « ✓ » dans un
   `<span aria-hidden="true">` : il reste visible, il sort du nom accessible. La
   couleur cesse d'être le seul véhicule de l'information.
3. **Barre de progression** — deux `div` muets deviennent un `role="progressbar"`
   avec `aria-valuemin`, `aria-valuemax`, `aria-valuenow` et un `aria-valuetext`
   en clair.
4. **Titre de l'écran de passation** — accueil et résultats ont leur `<h1>`, la
   passation n'a rien. Le paragraphe « Chacun choisit sa proposition » devient un
   `<h1>` avec les mêmes styles inline. Aucun changement visuel.
5. **Message d'attente** — « En attente de Bob » est la seule indication qu'il
   reste quelqu'un à faire répondre, et il apparaît sans être annoncé. Ajout de
   `role="status"`. Même traitement pour la confirmation « Résultat copié ».
6. **Textarea de repli sur copie refusée** — ajout d'un `aria-label`.
7. **Onglets des résultats** — `aria-pressed` sur chacun des trois boutons,
   regroupés dans un `role="group"` nommé. Pas de `role="tablist"` : voir la
   décision correspondante.

Déjà correct, non touché : `lang="fr"` sur `index.html`, les `<label htmlFor>`
des deux champs prénom, et le `:focus-visible` global de `nocturne.css`.

## Section 4 — Plan de tests

Environ 45 cas répartis en trois fichiers, du plus pur au plus intégré.

### `src/questionnaire.test.js` — données et helpers

Intégrité du JSON : 30 items, identifiants uniques, deux options par item de
codes différents, et chaque dimension présente exactement
`meta.scoreMaxParDimension` fois. Le README documente l'édition de ce fichier
comme le point d'extension du projet : ce test attrape la question mal
équilibrée le jour où quelqu'un en ajoute une.

Snapshot inline sur la projection suivante :

```js
DATA.items.map((i) => i.id + ' ' + i.options[0].code + '/' + i.options[1].code)
```

soit trente lignes du type `1 P/T`, `2 M/S`. Il verrouille l'appariement des dimensions,
c'est-à-dire la structure psychométrique du questionnaire, sans broncher sur une
reformulation de texte.

`levelFor` sur les bornes exactes des quatre paliers : 12, 9, 8, 6, 5, 4, 0. Le
palier « Canal intermédiaire » est un singleton (`min: 5, max: 5`), typiquement
la borne qu'un refactoring casse sans bruit.

`de` sur `Alice`, `Bob`, une voyelle accentuée, et l'entrée vide.

### `src/scoring.test.js` — règles de calcul

- `resolveNames` : trim et replis.
- `scores` : passation complète, puis passation partielle où les cases vides
  sont ignorées.
- `profileRows` : les cinq dimensions toujours présentes même à zéro, tri
  décroissant, `pct` arrondi, `niveau` cohérent avec `levelFor`.
- `vigilanceList` : déclenchement à 9 contre 4 dans les deux sens, absence de
  déclenchement à 8 contre 4 et à 9 contre 5.
- `divergenceList` : ignore les items non répondus et les accords, porte les
  textes des deux options choisies.
- `summaryText` : snapshot inline sur une passation Alice/Bob figée, plus deux ou
  trois assertions ciblées sur les cas de repli (« Aucun écart de ce type »).
- **Propriété aller-retour** :
  `codeAt(item, flipped, slotFor(code, item, flipped)) === code`, pour les deux
  codes de chaque item et les deux valeurs de `flipped`. Un test, 120
  assertions, et la garantie que l'anti-biais de position ne créditera jamais la
  mauvaise dimension. Plus : `slotFor` d'un code absent rend `null`.
- `makeOrders` : longueur égale au nombre d'items, valeurs dans `{0, 1}`,
  comportement vérifié aux deux bornes de `Math.random`.

### `src/App.test.jsx` — parcours par requêtes accessibles

- **Accueil** : « Commencer » désactivé tant qu'un prénom manque ; champs
  atteints par `getByLabelText`.
- **Passation** : la puce d'Alice dans le groupe de la première proposition
  passe à `aria-pressed="true"` ; le `role="status"` annonce l'attente de Bob ;
  la `progressbar` avance.
- **Retour arrière** : « Question précédente » efface les deux réponses de
  l'item précédent.
- **Parcours complet** des 30 items par un helper, jusqu'aux scores affichés sur
  l'écran de résultats. C'est le test qui prouve que l'extraction de la section 2
  n'a rien changé.
- **Persistance** : démonter puis remonter `<App />` fait apparaître « Reprendre
  où nous en étions » ; « Commencer » efface la sauvegarde.
- **Onglets** : `aria-pressed` et bascule de panneau.
- **Copie** : succès annoncé en `role="status"` ; refus faisant apparaître le
  `textarea` de repli, trouvé par son `aria-label`.

### Pièges connus

- `pick` avance via un `setTimeout(340)`. Fausses horloges obligatoires, et
  `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` — sans cette
  option, user-event v14 attend un temps réel qui n'avance jamais et le test
  gèle.
- `Math.random` est stubbé à `0.9` dans les tests de parcours : `makeOrders` rend
  alors des `0` partout, donc l'ordre d'affichage est celui du JSON. Le hasard
  reste testé là où il est le sujet, dans `scoring.test.js`.
- `navigator.clipboard` n'existe pas dans jsdom. Il faut le poser explicitement
  par test, en version résolue et en version rejetée, pour couvrir les deux
  branches de `copy()`.

## Hors périmètre

- Découpage d'`App.jsx` en composants d'écran (`Home`, `Quiz`, `Results`).
- Audit automatisé type `vitest-axe` (contrastes, ARIA, structure des titres).
- Intégration continue GitHub Actions et seuils de couverture bloquants.
- Tests de bout en bout dans un vrai navigateur.

## Critères d'acceptation

1. `pnpm test:run` passe intégralement, en quelques secondes.
2. `pnpm build` continue de produire le bundle sans avertissement nouveau.
3. Aucun `data-testid` dans le code de production : tous les éléments des tests
   de parcours sont atteints par rôle, libellé ou texte accessible.
4. `src/scoring.js` n'importe ni React ni `App.jsx`.
5. L'application se comporte à l'identique dans le navigateur : mêmes écrans,
   mêmes scores, même sauvegarde, aucun changement visuel.
