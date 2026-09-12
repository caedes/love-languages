# Plan d'implémentation — Biome, hook de pre-commit et gate CI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** doter le dépôt d'un formateur et d'un linter uniques (Biome 2.5.13),
mettre l'ensemble des fichiers en conformité, puis verrouiller cette conformité
par un hook de pre-commit et une étape de CI.

**Architecture :** Biome remplace à lui seul ce que feraient Prettier et ESLint.
La migration se fait en onze commits sur la branche `biome-js`, du plus
mécanique au plus délicat : configuration, formatage, correctifs automatiques,
puis les corrections qui demandent du jugement. Le hook et la gate CI arrivent
**en dernier**, une fois le dépôt propre — posés plus tôt, le hook réécrirait
les commits de migration et la CI serait rouge sur toute la branche.

**Tech Stack :** Biome 2.5.13, husky 9.1.7, pnpm 11.24.0, Node 24, Vitest 5,
React 18, Vite 8, GitHub Actions.

**Spec :** `docs/superpowers/specs/2026-09-12-biome-formatage-et-lint-design.md`

## Global Constraints

- Branche de travail : `biome-js`. Une seule pull request vers `main`.
- Messages de commit : Conventional Commits + gitmoji, **en français**. Types
  autorisés : `feat` 🎸, `fix` 🐛, `chore` 🤖, `ci` 🎡, `docs` ✏️, `refactor` 💡,
  `test` 💍. Aucun autre type.
- Versions exactes : `@biomejs/biome` **2.5.13**, `husky` **9.1.7**. Pas de
  plage, pas de `latest`.
- Gestionnaire de paquets : **pnpm** uniquement (`pnpm add -D`, jamais `npm`).
- **Aucun test existant ne doit être modifié** pour faire passer une étape. Un
  test qui casse signale que la correction est fausse, pas que le test l'est.
  La seule exception est la tâche 4, où Biome retire des imports depuis des
  fichiers de test — et il ne touche alors à aucune assertion.
- `pnpm test:run` doit rester vert après **chaque** commit.
- Les commentaires de `.github/workflows/ci.yml` sont écrits **sans accents**
  dans ce dépôt : conserver cette convention.
- Ne jamais lancer `biome check --write --unsafe` en aveugle hors de la tâche 4,
  et y relire chaque changement.
- Biome ne formate ni le Markdown ni le YAML : `README.md`, `AGENTS.md` et
  `ci.yml` ne sont jamais réécrits par l'outil.

## Repères de mesure

Chiffres obtenus en faisant tourner Biome 2.5.13 sur une copie du dépôt, avec la
configuration de la tâche 1. Ils servent de contrôle : un écart important à une
étape signale une erreur de manipulation.

| après la tâche | diagnostics attendus |
| --- | --- |
| 1 (configuration) | 70 — 52 erreurs, 7 avertissements, 11 infos |
| 2 (formatage) | 49 — 32 erreurs, 7 avertissements, 10 infos |
| 3 (correctifs sûrs) | 39 — 22 erreurs, 7 avertissements, 10 infos |
| 4 (correctifs *unsafe*) | 23 — 22 erreurs, 1 info |
| 5 (`forEach`) | 17 erreurs |
| 6 (`type` des boutons) | 6 erreurs |
| 7 (clés stables) | 3 erreurs |
| 8 (`fieldset`) | **0** |

---

### Task 1 : Configuration de Biome

**Files:**
- Create: `biome.json`
- Modify: `package.json` (bloc `scripts`, bloc `devDependencies`)
- Modify: `pnpm-lock.yaml` (généré)

**Interfaces:**
- Consumes: rien.
- Produces: les scripts `pnpm format`, `pnpm check`, `pnpm check:ci`, utilisés
  par toutes les tâches suivantes. Le fichier `biome.json` à la racine, que
  Biome découvre seul depuis n'importe quel sous-répertoire.

- [ ] **Step 1 : Installer Biome**

```bash
pnpm add -D --save-exact @biomejs/biome@2.5.13
```

`--save-exact` : la version du formateur détermine le contenu des fichiers du
dépôt, une montée de version subie reformaterait tout sans prévenir.

- [ ] **Step 2 : Créer `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "includes": ["**", "!public/favicon.svg"] },
  "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "javascript": { "formatter": { "quoteStyle": "single" } },
  "css": { "formatter": { "quoteStyle": "single" } },
  "linter": { "enabled": true, "rules": { "recommended": true } }
}
```

`public/favicon.svg` est le seul fichier exclu, et pour une raison précise : il
est **produit** par `pnpm icons`, via `scripts/generate-icons.mjs`. Un formateur
qui réécrit la sortie d'un générateur, ou qui lui réclame un `<title>`
(`a11y/noSvgWithoutTitle`), transforme la prochaine régénération légitime en CI
rouge. Le générateur lui-même, dans `scripts/` et `src/icons/`, reste
intégralement soumis au linter. `public/site.webmanifest`, écrit à la main,
reste lui aussi dans le périmètre.

- [ ] **Step 3 : Ajouter les trois scripts**

Dans `package.json`, bloc `scripts`, après `"build"` :

```json
    "check": "biome check",
    "check:ci": "biome ci",
    "format": "biome check --write",
```

- [ ] **Step 4 : Vérifier que Biome voit bien le dépôt**

Run: `./node_modules/.bin/biome check --max-diagnostics=500 --reporter=summary`

Expected: sortie en erreur (c'est normal, rien n'est encore corrigé) avec
**70 diagnostics** — 52 erreurs, 7 avertissements, 11 infos. Les règles listées
doivent inclure `lint/suspicious/noArrayIndexKey` : sa présence prouve que Biome
a bien détecté le *domain* React depuis `package.json`. Si elle manque, la
configuration n'est pas lue — ne pas continuer.

- [ ] **Step 5 : Vérifier que rien n'a bougé dans les sources**

Run: `git status --short`

Expected: seuls `biome.json`, `package.json` et `pnpm-lock.yaml` apparaissent.
Aucun fichier de `src/`.

- [ ] **Step 6 : Commit**

```bash
git add biome.json package.json pnpm-lock.yaml
git commit -m "chore: 🤖 ajoute Biome et sa configuration"
```

---

### Task 2 : Formatage de l'ensemble du dépôt

**Files:**
- Modify: 19 fichiers — `src/App.jsx`, `src/App.test.jsx`, `src/main.jsx` (si
  concerné), `src/questionnaire.js`, `src/questionnaire.test.js`,
  `src/scoring.js`, `src/scoring.test.js`, `src/test/fixtures.js`,
  `src/data/langages-amour-questions.json`, `src/styles/nocturne.css`,
  `src/styles/app.css`, `src/icons/*.js`, `scripts/generate-icons.mjs`,
  `vite.config.js`

**Interfaces:**
- Consumes: les scripts de la tâche 1.
- Produces: un dépôt formaté. **Les numéros de ligne de `src/App.jsx` changent**
  — toutes les tâches suivantes citent les lignes *d'après* cette étape.

- [ ] **Step 1 : Formater**

```bash
./node_modules/.bin/biome format --write .
```

`format` et non `check` : cette étape ne doit contenir **que** de la mise en
forme. Les correctifs de lint arrivent à la tâche 3, dans leur propre commit.

- [ ] **Step 2 : Contrôler le volume**

Run: `git diff --stat`

Expected: 19 fichiers, environ 1 900 lignes modifiées. Les deux plus gros postes
sont attendus et voulus : `src/data/langages-amour-questions.json` (~526 lignes,
le fichier passe de 142 à 420 lignes — décision actée dans le spec) et
`src/styles/nocturne.css` (~480 lignes).

- [ ] **Step 3 : Vérifier qu'aucune chaîne de caractères n'a changé**

Un formateur ne réécrit pas de contenu. Le prouver plutôt que de le croire,
en comparant les deux versions **une fois analysées** :

```bash
git show HEAD:src/data/langages-amour-questions.json > /tmp/lq-avant.json
node -e "
const a = require('/tmp/lq-avant.json');
const b = require('$PWD/src/data/langages-amour-questions.json');
require('node:assert').deepStrictEqual(a, b);
console.log('JSON identique :', b.items.length, 'items,', b.meta.dimensions.length, 'dimensions');
"
rm /tmp/lq-avant.json
```

Expected: `JSON identique : 30 items, 5 dimensions`. Si `deepStrictEqual` lève,
une valeur a changé — arrêter et investiguer, ce serait un défaut du formateur
et non une étape à forcer.

- [ ] **Step 4 : Lancer la suite de tests**

Run: `pnpm test:run`

Expected: PASS, sans qu'aucun fichier de test ait été modifié à la main. C'est
le point de contrôle le plus important du plan : le formatage rewrappe du JSX,
et les tests interrogent l'interface par libellé accessible. Testing Library
normalise les espaces, donc cela doit passer — mais cela se vérifie.

Si un test échoue : ne pas le corriger. Identifier le nœud JSX concerné, et
signaler le cas — c'est que le rewrap a modifié un texte affiché.

- [ ] **Step 5 : Vérifier que le build passe**

Run: `pnpm build`

Expected: succès.

- [ ] **Step 6 : Commit**

```bash
git add -A
git commit -m "chore: 🤖 applique le formatage Biome au dépôt"
```

- [ ] **Step 7 : Noter le SHA**

```bash
git rev-parse HEAD
```

Conserver cette valeur : elle alimente `.git-blame-ignore-revs` à la tâche 11.

---

### Task 3 : Correctifs sûrs et tri des imports

**Files:**
- Modify: `src/App.jsx`, `src/App.test.jsx`, `src/icons/heart.test.js`,
  `src/icons/png.test.js`, `src/icons/raster.test.js`, `src/icons/svg.test.js`,
  `src/questionnaire.test.js`, `src/scoring.test.js`

**Interfaces:**
- Consumes: le dépôt formaté de la tâche 2.
- Produces: des imports triés. Aucune signature, aucun comportement modifié.

- [ ] **Step 1 : Appliquer les correctifs sûrs**

```bash
pnpm format
```

(soit `biome check --write`, qui ajoute au formatage les correctifs de lint sûrs
et les *assists*.)

- [ ] **Step 2 : Vérifier que le diff ne contient que des imports**

Run: `git diff`

Expected: uniquement des blocs d'`import` réordonnés, par exemple dans
`src/App.test.jsx` :

```diff
-import React from 'react';
-import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
-import { render, screen, within, act } from '@testing-library/react';
+import { act, render, screen, within } from '@testing-library/react';
 import userEvent from '@testing-library/user-event';
+import React from 'react';
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
 import App from './App.jsx';
```

Aucune ligne de code hors des blocs d'import ne doit bouger. Si c'est le cas,
arrêter : le formatage de la tâche 2 était incomplet.

- [ ] **Step 3 : Contrôler le décompte**

Run: `./node_modules/.bin/biome check --max-diagnostics=500 --reporter=summary`

Expected: 39 diagnostics — 22 erreurs, 7 avertissements, 10 infos. Plus aucune
ligne `assist/source/organizeImports`.

- [ ] **Step 4 : Lancer les tests**

Run: `pnpm test:run`

Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "chore: 🤖 applique les correctifs sûrs et trie les imports"
```

- [ ] **Step 6 : Noter le SHA**

```bash
git rev-parse HEAD
```

Deuxième valeur pour `.git-blame-ignore-revs`.

---

### Task 4 : Correctifs `unsafe`, relus un par un

**Files:**
- Modify: `src/App.jsx`, `src/App.test.jsx`, `src/main.jsx`,
  `src/questionnaire.test.js`, `src/scoring.js`

**Interfaces:**
- Consumes: le dépôt de la tâche 3.
- Produces: aucun changement d'interface. `summaryText(answers, names)` dans
  `src/scoring.js` garde exactement la même signature et **doit produire exactement
  la même chaîne** : seule la syntaxe de concaténation change.

Biome qualifie ces correctifs d'*unsafe* parce qu'il ne peut pas prouver seul
qu'ils préservent le comportement. Ici ils le préservent — mais c'est à
l'implémenteur de le constater, pas à l'outil de l'affirmer.

- [ ] **Step 1 : Appliquer**

```bash
./node_modules/.bin/biome check --write --unsafe --max-diagnostics=500 .
```

- [ ] **Step 2 : Relire les cinq fichiers modifiés**

Run: `git diff`

Expected: exactement ces cinq familles de changements, et rien d'autre.

1. **`src/App.jsx` — quatre `catch` renommés.** Le paramètre n'était pas
   utilisé ; le préfixe `_` le dit explicitement :

```diff
-    } catch (e) {
+    } catch (_e) {
```

2. **`src/App.jsx` — un chaînage optionnel :**

```diff
-    if (navigator.clipboard && navigator.clipboard.writeText) {
+    if (navigator.clipboard?.writeText) {
```

3. **`src/App.jsx` — deux concaténations en gabarit :**

```diff
-    if (selA !== null && selB === null) waiting = 'En attente ' + de(names[1]) + names[1];
-    else if (selB !== null && selA === null) waiting = 'En attente ' + de(names[0]) + names[0];
+    if (selA !== null && selB === null) waiting = `En attente ${de(names[1])}${names[1]}`;
+    else if (selB !== null && selA === null) waiting = `En attente ${de(names[0])}${names[0]}`;
```

4. **`src/scoring.js` et `src/questionnaire.test.js` — sept autres gabarits**, de
   la même forme :

```diff
-      lines.push('  ' + r.score + '/12  ' + r.nom + '  (' + r.niveau + ')');
+      lines.push(`  ${r.score}/12  ${r.nom}  (${r.niveau})`);
-    lines.push('  Total de contrôle : ' + answers[who].filter(Boolean).length + '/30');
+    lines.push(`  Total de contrôle : ${answers[who].filter(Boolean).length}/30`);
-  lines.push('ITEMS DIVERGENTS (' + div.length + ')');
+  lines.push(`ITEMS DIVERGENTS (${div.length})`);
-    lines.push('  Item ' + x.id);
-    lines.push('    ' + x.nameA + ' — ' + x.textA);
-    lines.push('    ' + x.nameB + ' — ' + x.textB);
+    lines.push(`  Item ${x.id}`);
+    lines.push(`    ${x.nameA} — ${x.textA}`);
+    lines.push(`    ${x.nameB} — ${x.textB}`);
```

Vérifier **espace par espace** que les gabarits reproduisent les chaînes
d'origine : `summaryText` produit le texte copié dans le presse-papiers, et un
espace perdu se verrait chez l'utilisateur. Les doubles espaces de
`'  ' + r.score + '/12  '` sont significatifs.

5. **`src/App.test.jsx` et `src/main.jsx` — `import React from 'react'` supprimé.**
   C'est le seul changement du plan qui touche un fichier de test, et il ne
   touche aucune assertion. Il est correct parce que `@vitejs/plugin-react` active
   le *runtime* JSX automatique : le JSX n'a plus besoin que `React` soit dans la
   portée. Vérifier que ces deux fichiers ne contiennent aucune occurrence de
   `React.` :

```bash
grep -n 'React\.' src/main.jsx src/App.test.jsx
```

Expected: aucun résultat. `src/App.jsx` conserve son import — il étend
`React.Component`.

- [ ] **Step 3 : Contrôler le décompte**

Run: `./node_modules/.bin/biome check --max-diagnostics=500 --reporter=summary`

Expected: 23 diagnostics — 22 erreurs, 1 info. Quatre règles restantes :
`useIterableCallbackReturn` (5), `noArrayIndexKey` (3), `useSemanticElements` (3),
`useButtonType` (11).

- [ ] **Step 4 : Lancer les tests et le build**

Run: `pnpm test:run && pnpm build`

Expected: PASS puis succès du build. Le build valide la suppression des imports
`React` en conditions de production, ce que les tests seuls ne font pas.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "refactor: 💡 supprime le code mort et simplifie les concaténations"
```

---

### Task 5 : Fermer les `forEach` imbriqués

**Files:**
- Modify: `src/icons/heart.js:61`
- Modify: `src/icons/heart.test.js:18`, `src/icons/heart.test.js:30`
- Modify: `src/questionnaire.test.js:32`
- Modify: `src/scoring.test.js:213`

**Interfaces:**
- Consumes: le dépôt de la tâche 4.
- Produces: aucun changement d'interface ni de comportement. `heartGrid()` de
  `src/icons/heart.js` garde sa signature `() => number[][]`.

La règle `useIterableCallbackReturn` s'oppose à un `forEach` dont le callback
renvoie une valeur : `forEach` ignore le retour, donc écrire `x => f(x)` laisse
croire à un `map`. Les cinq sites sont le même motif — un `forEach` imbriqué
écrit en corps d'expression. Le correctif est d'entourer d'accolades, ce qui ne
change rien à l'exécution.

- [ ] **Step 1 : Corriger `src/icons/heart.js`**

Avant :

```js
  grid.forEach((ligne, y) =>
    ligne.forEach((cell, x) => {
      if (cell !== FILL) return;
      voisines(x, y).forEach(([vx, vy]) => {
        if (grid[vy][vx] === BG) grid[vy][vx] = OUTLINE;
      });
    }),
  );
```

Après :

```js
  grid.forEach((ligne, y) => {
    ligne.forEach((cell, x) => {
      if (cell !== FILL) return;
      voisines(x, y).forEach(([vx, vy]) => {
        if (grid[vy][vx] === BG) grid[vy][vx] = OUTLINE;
      });
    });
  });
```

- [ ] **Step 2 : Vérifier le seul fichier de production touché**

Run: `pnpm test:run src/icons/heart.test.js`

Expected: PASS. `heart.js` est le seul site de cette tâche qui ne soit pas un
fichier de test ; c'est celui dont une régression se verrait dans les icônes
livrées.

- [ ] **Step 3 : Corriger les quatre sites de test**

Même transformation, dans chaque cas : passer le corps d'expression de la flèche
extérieure en bloc.

`src/icons/heart.test.js:18` :

```js
  grid.forEach((ligne, y) => {
    ligne.forEach((cell, x) => {
      if (cell === valeur) out.push([x, y]);
    });
  });
```

`src/icons/heart.test.js:30`, `src/questionnaire.test.js:32` et
`src/scoring.test.js:213` suivent la même forme. Pour
`src/questionnaire.test.js:32` :

```js
    DATA.items.forEach((item) => {
      item.options.forEach((opt) => {
        compte[opt.code] += 1;
      });
    });
```

Aucune assertion ne change, aucun `expect` n'est ajouté ni retiré.

- [ ] **Step 4 : Vérifier que la règle est éteinte**

Run: `./node_modules/.bin/biome check --max-diagnostics=500 --reporter=summary`

Expected: 17 erreurs restantes, et plus aucune ligne
`lint/suspicious/useIterableCallbackReturn`.

- [ ] **Step 5 : Lancer toute la suite**

Run: `pnpm test:run`

Expected: PASS, avec le **même nombre de tests qu'avant** la tâche. Une
transformation qui ferait disparaître des assertions changerait ce nombre.

- [ ] **Step 6 : Commit**

```bash
git add -A
git commit -m "refactor: 💡 ferme les callbacks forEach imbriqués"
```

---

### Task 6 : Type explicite sur les boutons

**Files:**
- Modify: `src/App.jsx`, lignes 301, 308, 318, 327, 496, 504, 734, 748, 778,
  793, 800 (numérotation d'après la tâche 2)

**Interfaces:**
- Consumes: le dépôt de la tâche 5.
- Produces: aucun changement d'interface.

Un `<button>` sans attribut `type` vaut `type="submit"` à l'intérieur d'un
formulaire. Il n'y a aucun `<form>` dans `App.jsx`, donc rien ne casse
aujourd'hui — mais la règle empêche le piège le jour où un formulaire
apparaîtra. Correction purement additive.

- [ ] **Step 1 : Ajouter `type="button"` aux onze boutons**

Pour chacun, ajouter l'attribut en **première** position, juste après
l'ouverture de la balise :

```diff
               <button
+                type="button"
                 onClick={...}
```

Les onze sites sont tous des `<button` en balise multi-lignes. Aucun n'est un
bouton de soumission : `type="button"` est le bon type pour les onze.

- [ ] **Step 2 : Vérifier qu'aucun autre attribut n'a bougé**

Run: `git diff src/App.jsx`

Expected: exactement onze lignes ajoutées, zéro ligne supprimée.

- [ ] **Step 3 : Vérifier que la règle est éteinte**

Run: `./node_modules/.bin/biome check --max-diagnostics=500 --reporter=summary`

Expected: 6 erreurs restantes, plus aucune ligne `lint/a11y/useButtonType`.

- [ ] **Step 4 : Lancer les tests**

Run: `pnpm test:run`

Expected: PASS. Les tests cliquent sur ces boutons par leur rôle et leur
libellé ; l'ajout de `type` ne change ni l'un ni l'autre.

- [ ] **Step 5 : Commit**

```bash
git add src/App.jsx
git commit -m "fix: 🐛 type explicite sur les boutons"
```

---

### Task 7 : Clés stables sur les listes calculées

**Files:**
- Modify: `src/App.jsx`, trois sites — aux alentours des lignes 246, 454 et 675

> **Les numéros de ligne ont dérivé.** Ils valaient 246, 450 et 669 juste après
> la tâche 2 ; la tâche 6 a depuis inséré onze lignes dans le même fichier, qui
> décalent les deux derniers de 4 et 6 lignes. Localisez chaque site par le code
> cité dans les diffs ci-dessous, pas par son numéro. Le contrôle de fin de
> tâche (3 diagnostics restants) confirmera que vous avez visé juste.

**Interfaces:**
- Consumes: le dépôt de la tâche 6, et les formes de données produites par
  `src/scoring.js` : `vigilanceList(answers, names)` renvoie un tableau
  d'objets `{ strong, weak, dim, color }`, où `dim` est le nom d'une dimension.
- Produces: aucun changement d'interface.

Une clé d'index dit à React « la position fait l'identité ». Quand la liste est
recalculée et peut changer d'ordre ou de longueur, React réutilise alors le
mauvais nœud. Les trois listes concernées sont toutes recalculées à chaque
rendu.

- [ ] **Step 1 : les consignes** (`consignes.map`, vers la ligne 246)

`consignes` est un tableau de trois chaînes distinctes, défini juste au-dessus.
La chaîne elle-même est l'identité.

```diff
-          {consignes.map((t, i) => (
-            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
+          {consignes.map((t) => (
+            <div key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
```

- [ ] **Step 2 : les deux propositions d'un item** (`shown.map`, vers la ligne 454)

`shown` contient les deux options de l'item courant, dans un ordre tiré au sort
à chaque item. Leurs `code` sont distincts — c'est un invariant du jeu de
données, verrouillé par le snapshot en ligne de `src/questionnaire.test.js` qui
liste des paires du type `"1 P/T"`. C'est précisément parce que l'ordre varie
que l'index est une mauvaise clé ici.

Attention : `slot` reste utilisé à la ligne suivante pour construire `labelId`.
Ne pas le retirer de la signature.

```diff
           {shown.map((opt, slot) => {
             const labelId = `lq-opt-${st.idx}-${slot}`;
             return (
               <div
-                key={slot}
+                key={opt.code}
                 role="group"
```

- [ ] **Step 3 : les points de vigilance** (`vig.map`, vers la ligne 675)

`vig` vient de `scoring.vigilanceList(...)`, qui parcourt
`DATA.meta.dimensions` et pousse **au plus un objet par dimension**. Le champ
`dim` est donc unique dans la liste.

```diff
-                  {vig.map((v, i) => (
+                  {vig.map((v) => (
                     <p
-                      key={i}
+                      key={v.dim}
```

- [ ] **Step 4 : Vérifier que la règle est éteinte**

Run: `./node_modules/.bin/biome check --max-diagnostics=500 --reporter=summary`

Expected: 3 erreurs restantes, toutes `lint/a11y/useSemanticElements`.

- [ ] **Step 5 : Lancer les tests**

Run: `pnpm test:run`

Expected: PASS. Le parcours complet du questionnaire est couvert : il exerce les
trente items, donc le remontage des deux propositions à chaque item.

- [ ] **Step 6 : Commit**

```bash
git add src/App.jsx
git commit -m "fix: 🐛 clés stables sur les listes calculées"
```

---

### Task 8 : Balises sémantiques à la place des rôles ARIA

**Files:**
- Modify: `src/App.jsx`, trois sites — aux alentours des lignes 455, 569 et 581

> **Les numéros de ligne ont dérivé.** Ils valaient 451, 563 et 575 juste après
> la tâche 2 ; les onze lignes insérées par la tâche 6 les décalent de 4 et 6
> lignes. Localisez chaque site par son attribut `role="group"` et le code cité
> dans les diffs, pas par son numéro. Il n'y a que trois `role="group"` dans le
> fichier : `grep -n 'role="group"' src/App.jsx` les donne tous les trois.

**Interfaces:**
- Consumes: le dépôt de la tâche 7.
- Produces: aucun changement d'interface JavaScript. Le contrat qui compte ici
  est celui de l'arbre d'accessibilité : les trois nœuds doivent conserver le
  rôle `group` **et** le même nom accessible.

**C'est la seule tâche à risque du plan.** Les tests interrogent l'interface par
rôle et par libellé accessible : ils doivent rester verts **sans être touchés**.
C'est exactement ce pour quoi ils ont été écrits.

Biome réclame un `<fieldset>` pour chacun des trois `div role="group"`.
`<fieldset>` porte un rôle `group` natif, donc le rôle explicite disparaît avec
la balise. Mais `<fieldset>` porte aussi des styles par défaut du navigateur
(bordure, marges latérales, remplissage) et se comporte à part comme conteneur
flex. Les trois sites sont stylés en ligne ; il faut donc neutraliser ces
défauts.

- [ ] **Step 1 : Écrire le garde-fou avant de toucher au JSX**

Lancer la suite et **noter le nombre de tests**, qui sert de référence :

```bash
pnpm test:run 2>&1 | tail -5
```

Expected: PASS. Conserver le total affiché.

- [ ] **Step 2 : le bloc d'une proposition** (`aria-labelledby={labelId}`, vers la ligne 455)

```diff
             return (
-              <div
+              <fieldset
                 key={opt.code}
-                role="group"
                 aria-labelledby={labelId}
                 style={{
+                  margin: 0,
+                  minInlineSize: 0,
                   display: 'flex',
```

et la balise fermante correspondante passe de `</div>` à `</fieldset>`.

`margin: 0` annule les marges latérales par défaut du navigateur ;
`minInlineSize: 0` annule le `min-inline-size: min-content` que les navigateurs
appliquent aux `fieldset` et qui l'empêche de rétrécir dans un conteneur flex.
Le `border` et le `padding` sont déjà fixés explicitement par le `style`
existant : ne pas les redéclarer.

- [ ] **Step 3 : le groupe d'onglets de résultats** (`aria-label="Vue des résultats"`, vers la ligne 569)

```diff
-        <div role="group" aria-label="Vue des résultats" style={{ display: 'flex', gap: 6 }}>
+        <fieldset
+          aria-label="Vue des résultats"
+          style={{ display: 'flex', gap: 6, margin: 0, padding: 0, border: 'none', minInlineSize: 0 }}
+        >
           {tab('profils', 'Profils')}
           {tab('vigilance', 'Vigilance')}
           {tab('divergences', `Divergences (${div.length})`)}
-        </div>
+        </fieldset>
```

Ici le `style` d'origine ne fixait ni bordure ni remplissage : les trois défauts
(`margin`, `padding`, `border`) doivent être annulés, sans quoi une bordure
grise apparaît autour des trois onglets.

- [ ] **Step 4 : la carte de profil d'un participant** (`lq-profil-`, vers la ligne 581)

```diff
               {[0, 1].map((who) => (
-                <div
+                <fieldset
                   key={who}
-                  role="group"
                   aria-labelledby={`lq-profil-${who}`}
                   style={{
+                    margin: 0,
+                    minInlineSize: 0,
                     background: 'var(--color-surface)',
```

et la fermeture correspondante en `</fieldset>`. Le `border` et le
`borderRadius` sont déjà déclarés dans le `style` existant.

- [ ] **Step 5 : Vérifier que Biome est satisfait**

Run: `./node_modules/.bin/biome check --max-diagnostics=500`

Expected: **aucun diagnostic.** C'est le premier moment du plan où le dépôt est
entièrement conforme.

- [ ] **Step 6 : Lancer les tests, sans y toucher**

Run: `pnpm test:run`

Expected: PASS, avec le même nombre de tests qu'au Step 1.

Si un test échoue ici, **ne pas le modifier**. Deux issues possibles, dans cet
ordre :

1. Le nom accessible a changé — c'est une erreur de transcription de
   `aria-label` ou `aria-labelledby`. Corriger le JSX.
2. `<fieldset>` ne convient pas à ce site. Revenir au `div role="group"` sur ce
   site précis et désactiver la règle à cet endroit seulement, avec la raison :

```jsx
{/* biome-ignore lint/a11y/useSemanticElements: <fieldset> casse la mise en page flex de ce bloc */}
<div role="group" ...>
```

- [ ] **Step 7 : Contrôler le rendu réel**

Run: `pnpm dev`

Ouvrir http://localhost:5173, parcourir les trois écrans (accueil, un item de
passation, résultats) et vérifier qu'aucune bordure ni marge parasite n'est
apparue autour des propositions, des onglets ou des cartes de profil. Les tests
ne voient pas les styles par défaut du navigateur.

- [ ] **Step 8 : Commit**

```bash
git add src/App.jsx
git commit -m "refactor: 💡 balises sémantiques à la place des rôles ARIA"
```

---

### Task 9 : Le hook de pre-commit

**Files:**
- Create: `.husky/pre-commit`
- Modify: `package.json` (bloc `scripts`, bloc `devDependencies`)
- Modify: `pnpm-lock.yaml` (généré)

**Interfaces:**
- Consumes: un dépôt entièrement conforme (fin de la tâche 8) et le script
  `pnpm format` de la tâche 1.
- Produces: le hook, actif pour tous les commits suivants — y compris ceux des
  tâches 10 et 11.

- [ ] **Step 1 : Installer husky**

```bash
pnpm add -D --save-exact husky@9.1.7
pnpm exec husky init
```

`husky init` crée `.husky/pre-commit` et ajoute `"prepare": "husky"` aux
scripts.

- [ ] **Step 2 : Écrire le hook**

Remplacer le contenu de `.husky/pre-commit` par :

```sh
./node_modules/.bin/biome check --write --staged --files-ignore-unknown=true --no-errors-on-unmatched
git update-index --again
```

Pas de shebang ni de ligne d'amorçage : husky 9 n'en a plus besoin.

- [ ] **Step 3 : Vérifier que `prepare` est bien là**

Run: `grep prepare package.json`

Expected: `"prepare": "husky"`. Si `husky init` ne l'a pas ajouté, l'ajouter à
la main dans le bloc `scripts`.

- [ ] **Step 4 : Vérifier que le dépôt est toujours conforme, puis commiter**

Run: `pnpm check && pnpm test:run`

Expected: aucun diagnostic, tests verts.

```bash
git add .husky package.json pnpm-lock.yaml
git commit -m "chore: 🤖 installe le hook de pre-commit"
git rev-parse HEAD
```

Ce commit passe par le hook qu'il installe — c'est normal, il ne contient rien à
corriger. **Noter ce SHA** : les deux sondes qui suivent créent des commits
jetables, et c'est le point de retour.

- [ ] **Step 5 : Sonde 1 — un fichier mal formé doit être corrigé et passer**

```bash
printf 'const   x    =  1\nexport default x\n' > src/sonde.js
git add src/sonde.js
git commit -m "chore: 🤖 sonde"
git show HEAD:src/sonde.js
```

Expected: le commit **passe**, et `git show` affiche `const x = 1;` — Biome a
formaté le fichier **et l'a réindexé** avant que le commit ne se referme. C'est
la preuve que `git update-index --again` fait son office.

- [ ] **Step 6 : Sonde 2 — une erreur non corrigeable doit bloquer**

```bash
cat > src/sonde.js <<'EOF'
export function sonde(liste) {
  liste.forEach((x) => x * 2);
}
EOF
git add src/sonde.js
git commit -m "chore: 🤖 sonde bloquante"
```

Expected: le commit est **refusé**, avec un diagnostic
`lint/suspicious/useIterableCallbackReturn`. C'est le comportement voulu : ce
que Biome ne sait pas corriger seul bloque.

- [ ] **Step 7 : Effacer les sondes**

```bash
git reset --hard <SHA du Step 4>
git status --short
```

Expected: arbre propre, aucun `src/sonde.js`, et `git log --oneline -1` affiche
« installe le hook de pre-commit ». Le `reset --hard` ne détruit rien d'utile :
husky et le hook sont déjà dans le commit du Step 4.

- [ ] **Step 8 : Vérifier qu'un clone neuf reçoit le hook**

Le hook ne sert à rien s'il faut un geste manuel pour l'activer. Vérifier qu'un
`pnpm install` suffit, dans un clone jetable et avec des chemins absolus :

```bash
DEPOT="$(pwd)"
CLONE="$(mktemp -d)/clone"
git clone --branch biome-js --single-branch "$DEPOT" "$CLONE"
(cd "$CLONE" && pnpm install --frozen-lockfile && git config --get core.hooksPath)
```

Expected: la dernière commande affiche `.husky/_`. C'est `prepare` qui l'a posé
pendant l'installation — donc un poste neuf est protégé sans rien faire de plus.

Puis supprimer le clone :

```bash
rm -rf "$(dirname "$CLONE")"
cd "$DEPOT" && git status --short
```

Expected: arbre propre.

### Task 10 : La gate CI

**Files:**
- Modify: `.github/workflows/ci.yml:26-30`

**Interfaces:**
- Consumes: le script `pnpm check:ci` de la tâche 1.
- Produces: un job `ci` qui échoue si un fichier n'est pas conforme. Le job `ci`
  est déjà le check requis du ruleset de `main` : aucune reconfiguration côté
  GitHub n'est nécessaire.

- [ ] **Step 1 : Insérer l'étape**

Entre `- run: pnpm install --frozen-lockfile` (ligne 26) et le commentaire des
tests (ligne 28) :

```diff
       - run: pnpm install --frozen-lockfile
 
+      # biome ci n'ecrit rien : il sort en erreur si un fichier n'est pas
+      # conforme. Place avant les tests pour rendre la main en quelques secondes.
+      - run: pnpm check:ci
+
       # Execute les tests et applique les seuils de couverture : sous le seuil,
       # vitest sort en erreur et la gate bloque.
       - run: pnpm test:coverage
```

Commentaire **sans accents**, comme le reste du fichier.

- [ ] **Step 2 : Vérifier la syntaxe YAML**

```bash
node -e "const fs=require('node:fs');const s=fs.readFileSync('.github/workflows/ci.yml','utf8');const i=s.indexOf('pnpm check:ci');console.log(i>0?'etape presente':'ETAPE ABSENTE');console.log(s.split('\n').filter(l=>l.includes('- run:')).join('\n'))"
```

Expected: `etape presente`, puis les quatre `- run:` du fichier dans l'ordre —
`pnpm install --frozen-lockfile`, `pnpm check:ci`, `pnpm test:coverage`,
`pnpm build` — suivis du `npx ... netlify-cli` du job `deploy`.

- [ ] **Step 3 : Rejouer localement ce que fera la CI**

Run: `pnpm check:ci`

Expected: aucun diagnostic. `biome ci` n'écrit rien ; s'il sort en erreur, c'est
qu'une étape précédente a laissé un écart.

- [ ] **Step 4 : Éprouver la gate — elle doit savoir échouer**

Une gate qu'on n'a jamais vue rougir n'est pas une gate. Introduire un écart,
constater le refus, revenir en arrière :

```bash
printf 'const   y    =  2\nexport default y\n' > src/sonde-ci.js
pnpm check:ci
```

Expected: sortie **en erreur**, avec un diagnostic de formatage sur
`src/sonde-ci.js`. Puis nettoyer :

```bash
rm src/sonde-ci.js
pnpm check:ci
```

Expected: aucun diagnostic. Vérifier avec `git status --short` que l'arbre est
propre avant de commiter.

- [ ] **Step 5 : Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: 🎡 ajoute la gate Biome"
```

---

### Task 11 : Documentation et `git blame`

**Files:**
- Create: `.git-blame-ignore-revs`
- Modify: `README.md` (nouvelle section, et mention dans « Intégration continue »)
- Modify: `AGENTS.md` (nouvelle section)

**Interfaces:**
- Consumes: les SHA notés aux tâches 2 et 3.
- Produces: la documentation de référence du dispositif.

- [ ] **Step 1 : Créer `.git-blame-ignore-revs`**

Avec les deux SHA relevés, en clair et commentés :

```
# Commits de reformatage massif : ils ne portent aucun changement de
# comportement et noieraient git blame. GitHub lit ce fichier automatiquement.
# En local : git config blame.ignoreRevsFile .git-blame-ignore-revs
<SHA de la tâche 2>  chore: applique le formatage Biome au dépôt
<SHA de la tâche 3>  chore: applique les correctifs sûrs et trie les imports
```

Les retrouver au besoin :

```bash
git log --format='%H %s' --grep='formatage Biome' --grep='correctifs sûrs' | cat
```

- [ ] **Step 2 : Vérifier que le fichier fonctionne**

```bash
git -c blame.ignoreRevsFile=.git-blame-ignore-revs blame -L 240,250 src/App.jsx | cat
```

Expected: les lignes sont attribuées à leurs commits d'origine, pas au commit de
formatage. Si git répond `fatal: could not open object name list`, un SHA est
mal copié.

- [ ] **Step 3 : Ajouter la section au `README.md`**

À placer entre « Tests » et « Icônes et aperçu de partage » :

```markdown
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
aboutit. Ce que Biome ne sait pas corriger seul — une clé de liste instable, un
rôle ARIA qui devrait être une balise — refuse le commit. La même vérification
tourne en CI (`pnpm check:ci`), car un hook local se contourne avec
`git commit --no-verify` et n'existe pas tant que `pnpm install` n'a pas tourné.

Deux choses à savoir :

- **`git add -p` et le hook font mauvais ménage.** Le hook réindexe les fichiers
  entiers qu'il a corrigés : la portion que vous aviez délibérément laissée de
  côté part avec le commit. Pour un commit partiel, passez par
  `git commit --no-verify` et lancez `pnpm format` ensuite.
- **Le blâme des lignes.** Deux commits ont reformaté tout le dépôt d'un coup.
  Ils sont listés dans `.git-blame-ignore-revs`, que GitHub lit tout seul. En
  local, une fois pour toutes :

  ```bash
  git config blame.ignoreRevsFile .git-blame-ignore-revs
  ```

Biome ne formate ni le Markdown ni le YAML : ce fichier, `AGENTS.md` et
`.github/workflows/ci.yml` restent à votre main.
```

- [ ] **Step 4 : Mentionner la gate dans la section « Intégration continue »**

Dans le premier paragraphe de cette section, remplacer :

```markdown
`.github/workflows/ci.yml` rejoue `pnpm test:coverage` puis `pnpm build` sur
chaque pull request vers `main` et sur chaque push vers `main`.
```

par :

```markdown
`.github/workflows/ci.yml` rejoue `pnpm check:ci`, `pnpm test:coverage` puis
`pnpm build` sur chaque pull request vers `main` et sur chaque push vers `main`.
La vérification Biome passe en premier : elle rend la main en quelques secondes
là où les tests prennent le temps qu'ils prennent.
```

- [ ] **Step 5 : Ajouter la convention à `AGENTS.md`**

Après la section « Messages de commit » :

```markdown
## Formatage

Biome tient la mise en forme et le lint de tout ce qui est JS, JSX, JSON et CSS.
Ne discutez pas le style avec l'outil : `pnpm format` tranche. Un hook de
pre-commit l'applique aux fichiers indexés, et `pnpm check:ci` garde la CI.

Deux règles de travail :

- **Ne jamais désactiver une règle pour faire passer un commit.** Un
  `biome-ignore` se justifie par une raison écrite sur la ligne même, et se
  limite au site concerné.
- **Ne jamais lancer `biome check --unsafe` en aveugle.** Ces correctifs
  changent le code sans que l'outil puisse prouver qu'il préserve le
  comportement : ils se relisent un par un.
```

- [ ] **Step 6 : Vérifier que tout tient debout**

Run: `pnpm check && pnpm test:run && pnpm build`

Expected: aucun diagnostic, tests verts, build réussi.

- [ ] **Step 7 : Commit**

```bash
git add .git-blame-ignore-revs README.md AGENTS.md
git commit -m "docs: ✏️ documente Biome"
```

---

### Task 12 : Ouvrir la pull request

**Files:** aucun.

**Interfaces:**
- Consumes: les onze commits des tâches précédentes.

- [ ] **Step 1 : Relire l'historique**

Run: `git log --oneline main..HEAD`

Expected: onze commits, dans l'ordre des tâches 1 à 11, tous du type
`chore` / `refactor` / `fix` / `ci` / `docs`, en français, avec gitmoji. Les deux
commits de spec (`648a6e9`, `466a3f5`) les précèdent sur la branche.

- [ ] **Step 2 : Vérification finale**

Run: `pnpm check:ci && pnpm test:coverage && pnpm build`

Expected: les trois passent. C'est exactement la séquence de la CI.

- [ ] **Step 3 : Pousser**

```bash
git push -u origin biome-js
```

- [ ] **Step 4 : Ouvrir la pull request**

```bash
gh pr create --base main --title "chore: 🤖 met en place Biome, le hook de pre-commit et la gate CI" --body "$(cat <<'EOF'
Ferme #5.

Biome 2.5.13 remplace ce qu'auraient fait Prettier et ESLint : formatage et
lint du JS, JSX, JSON et CSS, dans une seule configuration. Un hook de
pre-commit husky l'applique aux fichiers indexés, une étape de CI empêche de
contourner le hook.

Les onze commits vont du plus mécanique au plus délicat, et se relisent dans
cet ordre. Les commits 2 et 3 reformatent tout le dépôt et se survolent ; ils
sont listés dans `.git-blame-ignore-revs`. Les commits 5 à 8 traitent les 22
diagnostics que Biome ne sait pas corriger seul — le dernier, qui remplace
trois `div role="group"` par des `fieldset`, est le seul à toucher au rendu.

Aucun test n'a été modifié pour faire passer une étape.

Design : `docs/superpowers/specs/2026-09-12-biome-formatage-et-lint-design.md`
EOF
)"
```

- [ ] **Step 5 : Vérifier la CI**

```bash
gh pr checks --watch
```

Expected: le job `ci` passe, le job `deploy` apparaît *skipped* (sa garde exige
un push sur `main`).

---

## Notes pour l'implémenteur

**Le décompte de Biome est votre boussole.** Chaque tâche annonce le nombre de
diagnostics attendu après elle. Un écart signale une erreur de manipulation
bien avant que les tests ne s'en aperçoivent. Toujours passer
`--max-diagnostics=500` : la valeur par défaut est 20, et une sortie tronquée
donne de faux décomptes.

Ces appels de mesure invoquent le binaire par son chemin,
`./node_modules/.bin/biome`, et non `pnpm check` ni `./node_modules/.bin/biome`. Deux
raisons : `pnpm check --drapeau` ne garantit pas la transmission du drapeau au
script sous-jacent, et surtout, sur un poste où un outil réécrit les commandes
`pnpm` à la volée, une sortie filtrée peut afficher « No issues found » sur un
dépôt qui n'est pas propre. Un faux négatif de mesure est le pire mode de
défaillance de ce plan : chaque tâche s'appuie sur son décompte. `pnpm check`
et `pnpm check:ci` restent les commandes du quotidien et de la CI — ce sont
elles que le README documente.

**`biome check` contre `biome format`.** `format` ne fait que la mise en forme.
`check` y ajoute le lint et les *assists*. La tâche 2 exige `format` pour que le
commit de reformatage ne contienne rien d'autre. Partout ailleurs, `check`.

**Les numéros de ligne.** Toutes les lignes citées à partir de la tâche 5 sont
celles du fichier **après** le formatage de la tâche 2. Si vous les cherchez
dans l'état initial, vous ne les trouverez pas.

**Ce que le plan ne fait pas.** Il ne découpe pas `App.jsx`, n'active aucune
règle au-delà de `recommended`, n'ajoute aucune intégration à l'éditeur et ne
formate ni Markdown ni YAML. Ces sujets sont explicitement hors périmètre dans
le spec.
