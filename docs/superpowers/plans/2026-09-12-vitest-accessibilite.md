# Tests Vitest orientés accessibilité — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Installer Vitest, extraire le calcul hors de `App.jsx` vers un module pur, corriger l'accessibilité là où elle empêche d'interroger l'interface par rôle, et livrer une première série d'environ 45 tests.

**Architecture:** Trois niveaux. `src/questionnaire.js` garde les données et ses deux helpers. Un nouveau `src/scoring.js`, sans état ni React, reçoit des réponses et rend des scores. `App.jsx` ne garde que l'état, les écrans et les gestionnaires d'événements, et appelle `scoring.*`. Les tests suivent la même pyramide : données, calcul, parcours.

**Tech Stack:** Vite 8, React 18 (composant classe), Vitest 5, jsdom, Testing Library (react / dom / user-event / jest-dom), pnpm.

**Spec:** `docs/superpowers/specs/2026-09-12-vitest-accessibilite-design.md`

## Global Constraints

- Gestionnaire de paquets : **pnpm** uniquement. Le dépôt est verrouillé par `pnpm-lock.yaml` ; ne jamais lancer `npm install`.
- `@vitest/coverage-v8` doit avoir **exactement** la même version majeure que `vitest` (peer stricte) : les deux en `^5`.
- **Aucun `data-testid`** dans le code de production. Tout élément atteint dans un test l'est par rôle, libellé accessible ou texte.
- Langue du code et des tests : **français**, comme le reste du dépôt (noms de tests, commentaires, libellés).
- Commits en **Conventional Commits avec gitmoji**, à l'image de l'historique : `feat: 🎸 …`, `test: 💍 …`, `refactor: 💡 …`, `docs: ✏️ …`.
- `src/scoring.js` n'importe **ni React ni `App.jsx`**.
- Aucun changement visuel de l'application : les corrections d'accessibilité préservent les styles inline existants à l'identique.
- Les 30 items de `src/data/langages-amour-questions.json` ne sont **jamais** modifiés par ce chantier.

---

### Task 1 : Infrastructure Vitest et verrouillage des données

**Files:**
- Modify: `vite.config.js`
- Modify: `package.json` (scripts)
- Modify: `.gitignore`
- Modify: `README.md`
- Create: `src/test/setup.js`
- Test: `src/questionnaire.test.js`

**Interfaces:**
- Consumes: rien.
- Produces: la commande `pnpm test:run`, l'environnement jsdom + matchers jest-dom, et le nettoyage `localStorage` entre tests dont dépendent toutes les tâches suivantes.

- [ ] **Step 1 : Installer les dépendances de test**

```bash
pnpm add -D vitest@^5 @vitest/coverage-v8@^5 jsdom@^30 \
  @testing-library/react@^16 @testing-library/dom@^10 \
  @testing-library/user-event@^14 @testing-library/jest-dom@^6
```

`@testing-library/dom` est une peer explicite de RTL 16 et ne s'installe pas toute seule — c'est pour cela qu'elle figure dans la liste.

- [ ] **Step 2 : Ajouter le bloc `test` à `vite.config.js`**

Remplacer le contenu entier du fichier par :

```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**'],
      exclude: [
        'src/data/**',
        'src/styles/**',
        'src/main.jsx',
        'src/test/**',
        'src/**/*.test.{js,jsx}'
      ]
    }
  }
});
```

L'import vient désormais de `vitest/config`, qui ré-exporte le `defineConfig` de Vite : le comportement de build est inchangé.

- [ ] **Step 3 : Créer le fichier de setup**

`src/test/setup.js` :

```js
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

// `componentDidUpdate` écrit dans localStorage à chaque changement d'état :
// sans ce nettoyage, le test suivant croit reprendre une passation en cours.
afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});
```

- [ ] **Step 4 : Ajouter les scripts et l'ignore**

Dans `package.json`, ajouter aux `scripts` existants :

```json
"test": "vitest",
"test:run": "vitest run",
"test:coverage": "vitest run --coverage"
```

Ajouter `coverage` à la fin de `.gitignore`.

- [ ] **Step 5 : Écrire les tests de données et de helpers**

`src/questionnaire.test.js` :

```js
import { describe, it, expect } from 'vitest';
import { DATA, levelFor, de } from './questionnaire.js';

describe('intégrité du questionnaire', () => {
  it('contient le nombre d’items annoncé par meta', () => {
    expect(DATA.items).toHaveLength(DATA.meta.nombreItems);
    expect(DATA.items).toHaveLength(30);
  });

  it('donne un identifiant unique à chaque item', () => {
    const ids = DATA.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('oppose deux dimensions connues et différentes à chaque item', () => {
    const codes = DATA.meta.dimensions.map((d) => d.code);
    DATA.items.forEach((item) => {
      expect(item.options).toHaveLength(2);
      expect(item.options[0].code).not.toBe(item.options[1].code);
      item.options.forEach((opt) => {
        expect(codes).toContain(opt.code);
        expect(opt.texte.trim().length).toBeGreaterThan(0);
      });
    });
  });

  it('propose chaque dimension exactement scoreMaxParDimension fois', () => {
    const compte = {};
    DATA.meta.dimensions.forEach((d) => { compte[d.code] = 0; });
    DATA.items.forEach((item) => item.options.forEach((opt) => { compte[opt.code] += 1; }));
    DATA.meta.dimensions.forEach((d) => {
      expect(compte[d.code]).toBe(DATA.meta.scoreMaxParDimension);
    });
  });

  it('verrouille l’appariement des dimensions item par item', () => {
    const paires = DATA.items.map(
      (i) => i.id + ' ' + i.options[0].code + '/' + i.options[1].code
    );
    expect(paires).toMatchInlineSnapshot();
  });
});

describe('levelFor', () => {
  it.each([
    [12, 'Langage primaire'],
    [9, 'Langage primaire'],
    [8, 'Langage secondaire'],
    [6, 'Langage secondaire'],
    [5, 'Canal intermédiaire'],
    [4, 'Canal neutre'],
    [0, 'Canal neutre']
  ])('classe le score %i en « %s »', (score, niveau) => {
    expect(levelFor(score).niveau).toBe(niveau);
  });
});

describe('de', () => {
  it.each([
    ['Alice', "d'"],
    ['Élodie', "d'"],
    ['Bob', 'de '],
    ['', 'de '],
    [undefined, 'de ']
  ])('élide correctement devant %s', (prenom, attendu) => {
    expect(de(prenom)).toBe(attendu);
  });
});
```

- [ ] **Step 6 : Lancer la suite et remplir le snapshot**

Run : `pnpm test:run`

Vitest écrit lui-même l'argument de `toMatchInlineSnapshot()` dans le fichier au premier passage. **Relire le snapshot généré avant de commiter** : les trente lignes doivent commencer par `1 P/T`, `2 M/S`, `3 C/M`, `4 S/T`, `5 T/C`. C'est la seule relecture qui donne sa valeur au snapshot — l'accepter sans le lire revient à ne pas l'avoir.

Expected : 17 tests au vert.

- [ ] **Step 7 : Documenter dans le README**

Ajouter après la section « Démarrer » :

> Dans le README, la section suivante s'écrit avec un bloc `bash` ordinaire ;
> elle est reproduite ici sans clôture de bloc imbriquée pour rester lisible.

    ## Tests

    ```bash
    pnpm test           # mode watch
    pnpm test:run       # une passe
    pnpm test:coverage  # rapport de couverture dans coverage/
    ```

    Les tests interrogent l'interface comme le ferait un lecteur d'écran
    (rôles ARIA et libellés accessibles), sans `data-testid`.

- [ ] **Step 8 : Commit**

```bash
git add package.json pnpm-lock.yaml vite.config.js .gitignore README.md src/test/setup.js src/questionnaire.test.js
git commit -m "test: 💍 installe Vitest et verrouille les données du questionnaire"
```

---

### Task 2 : `scoring.js` — prénoms, scores, profils

**Files:**
- Create: `src/scoring.js`
- Create: `src/test/fixtures.js`
- Modify: `src/App.jsx`
- Test: `src/scoring.test.js`

**Interfaces:**
- Consumes: `DATA`, `DIM_COLOR`, `levelFor` depuis `./questionnaire.js`.
- Produces :
  - `resolveNames(nameA: string, nameB: string) => [string, string]`
  - `scores(answersOfOne: Array<string|null|undefined>) => { P: number, M: number, C: number, S: number, T: number }`
  - `profileRows(answersOfOne) => Array<{ code, nom, score, pct, color, niveau }>` triée par score décroissant
  - fixtures : `REPONSES_PREMIERE_OPTION`, `REPONSES_SECONDE_OPTION`, `reponsesAvecDivergences(indices)`

- [ ] **Step 1 : Écrire les fixtures partagées**

`src/test/fixtures.js` :

```js
import { DATA } from '../questionnaire.js';

/** Une passation où l'on choisit toujours la première proposition du JSON. */
export const REPONSES_PREMIERE_OPTION = DATA.items.map((i) => i.options[0].code);

/** Une passation où l'on choisit toujours la seconde. */
export const REPONSES_SECONDE_OPTION = DATA.items.map((i) => i.options[1].code);

/**
 * La première passation, mais avec la seconde proposition sur les items visés.
 * @param {number[]} indices index (base 0) des items à basculer
 */
export function reponsesAvecDivergences(indices) {
  const out = REPONSES_PREMIERE_OPTION.slice();
  indices.forEach((i) => { out[i] = DATA.items[i].options[1].code; });
  return out;
}
```

Répartitions obtenues, vérifiées sur le JSON courant :

| Fixture | P | M | C | S | T |
|---|---|---|---|---|---|
| `REPONSES_PREMIERE_OPTION` | 9 | 7 | 5 | 4 | 5 |
| `REPONSES_SECONDE_OPTION` | 3 | 5 | 7 | 8 | 7 |

- [ ] **Step 2 : Écrire les tests en échec**

`src/scoring.test.js` :

```js
import { describe, it, expect } from 'vitest';
import { resolveNames, scores, profileRows } from './scoring.js';
import { REPONSES_PREMIERE_OPTION, REPONSES_SECONDE_OPTION } from './test/fixtures.js';

describe('resolveNames', () => {
  it('retire les espaces autour des prénoms saisis', () => {
    expect(resolveNames('  Alice ', 'Bob  ')).toEqual(['Alice', 'Bob']);
  });

  it('replie sur des prénoms génériques quand la saisie est vide', () => {
    expect(resolveNames('', '   ')).toEqual(['Personne 1', 'Personne 2']);
  });

  it('ne replie que le prénom manquant', () => {
    expect(resolveNames('Alice', '')).toEqual(['Alice', 'Personne 2']);
  });
});

describe('scores', () => {
  it('compte les choix par dimension sur une passation complète', () => {
    expect(scores(REPONSES_PREMIERE_OPTION)).toEqual({ P: 9, M: 7, C: 5, S: 4, T: 5 });
    expect(scores(REPONSES_SECONDE_OPTION)).toEqual({ P: 3, M: 5, C: 7, S: 8, T: 7 });
  });

  it('rend les cinq dimensions à zéro sur une passation vierge', () => {
    expect(scores([])).toEqual({ P: 0, M: 0, C: 0, S: 0, T: 0 });
  });

  it('ignore les items sans réponse', () => {
    const partielle = REPONSES_PREMIERE_OPTION.slice();
    partielle[0] = null;
    partielle[5] = undefined;
    const total = Object.values(scores(partielle)).reduce((a, b) => a + b, 0);
    expect(total).toBe(28);
  });
});

describe('profileRows', () => {
  it('trie les cinq dimensions par score décroissant', () => {
    const lignes = profileRows(REPONSES_PREMIERE_OPTION);
    expect(lignes.map((l) => l.code)).toEqual(['P', 'M', 'C', 'T', 'S']);
  });

  it('calcule le pourcentage arrondi sur le score maximal', () => {
    const lignes = profileRows(REPONSES_PREMIERE_OPTION);
    expect(lignes[0]).toMatchObject({ code: 'P', score: 9, pct: 75, niveau: 'Langage primaire' });
    expect(lignes[4]).toMatchObject({ code: 'S', score: 4, pct: 33, niveau: 'Canal neutre' });
  });

  it('conserve les dimensions jamais choisies, à zéro', () => {
    const lignes = profileRows([]);
    expect(lignes).toHaveLength(5);
    lignes.forEach((l) => {
      expect(l.score).toBe(0);
      expect(l.pct).toBe(0);
      expect(l.niveau).toBe('Canal neutre');
    });
  });

  it('porte le nom et la couleur de chaque dimension', () => {
    const [premiere] = profileRows(REPONSES_PREMIERE_OPTION);
    expect(premiere.nom).toBe('Paroles valorisantes');
    expect(premiere.color).toMatch(/^oklch\(/);
  });
});
```

- [ ] **Step 3 : Lancer les tests pour vérifier qu'ils échouent**

Run : `pnpm test:run src/scoring.test.js`
Expected : FAIL, `Failed to resolve import "./scoring.js"`.

- [ ] **Step 4 : Écrire `src/scoring.js`**

```js
import { DATA, DIM_COLOR, levelFor } from './questionnaire.js';

/**
 * Les deux prénoms nettoyés, avec repli générique quand la saisie est vide.
 * @param {string} nameA
 * @param {string} nameB
 * @returns {[string, string]}
 */
export function resolveNames(nameA, nameB) {
  return [(nameA || '').trim() || 'Personne 1', (nameB || '').trim() || 'Personne 2'];
}

/**
 * Le nombre de choix par dimension pour un participant.
 * @param {Array<string|null|undefined>} answersOfOne
 */
export function scores(answersOfOne) {
  const out = { P: 0, M: 0, C: 0, S: 0, T: 0 };
  (answersOfOne || []).forEach((code) => { if (code) out[code] += 1; });
  return out;
}

/**
 * Les cinq dimensions d'un participant, triées du score le plus fort au plus faible.
 * @param {Array<string|null|undefined>} answersOfOne
 */
export function profileRows(answersOfOne) {
  const s = scores(answersOfOne);
  return DATA.meta.dimensions
    .map((d) => ({
      code: d.code,
      nom: d.nom,
      score: s[d.code],
      pct: Math.round((s[d.code] / DATA.meta.scoreMaxParDimension) * 100),
      color: DIM_COLOR[d.code],
      niveau: levelFor(s[d.code]).niveau
    }))
    .sort((a, b) => b.score - a.score);
}
```

- [ ] **Step 5 : Lancer les tests pour vérifier qu'ils passent**

Run : `pnpm test:run src/scoring.test.js`
Expected : PASS, 10 tests.

- [ ] **Step 6 : Brancher `App.jsx` sur le module**

Dans `src/App.jsx` :

1. Ajouter l'import sous les imports existants : `import * as scoring from './scoring.js';`
2. Supprimer les méthodes `names()`, `scores(who)` et `profileRows(who)`.
3. Remplacer chaque `this.names()` par `scoring.resolveNames(this.state.nameA, this.state.nameB)`.
4. Remplacer chaque `this.profileRows(who)` par `scoring.profileRows(this.state.answers[who])`.
5. Dans `vigilanceList()`, remplacer `this.scores(0)` / `this.scores(1)` par `scoring.scores(this.state.answers[0])` / `scoring.scores(this.state.answers[1])`.

Les appelants de `this.names()` sont `renderQuiz`, `renderResults`, `vigilanceList`, `divergenceList` et `summaryText`. Aucun autre site n'utilise ces trois méthodes.

- [ ] **Step 7 : Vérifier que l'application démarre toujours**

Run : `pnpm build`
Expected : build réussi, aucun avertissement nouveau.

Run : `pnpm test:run`
Expected : 27 tests au vert.

- [ ] **Step 8 : Commit**

```bash
git add src/scoring.js src/scoring.test.js src/test/fixtures.js src/App.jsx
git commit -m "refactor: 💡 extrait le calcul des profils vers scoring.js"
```

---

### Task 3 : `scoring.js` — vigilance, divergences, synthèse

**Files:**
- Modify: `src/scoring.js`
- Modify: `src/App.jsx`
- Test: `src/scoring.test.js`

**Interfaces:**
- Consumes: `scores`, `profileRows`, `resolveNames` de la tâche 2.
- Produces :
  - `vigilanceList(answers: [string[], string[]], names: [string, string]) => Array<{ strong, weak, dim, color }>`
  - `divergenceList(answers, names) => Array<{ id, nameA, nameB, dimA, dimB, textA, textB, colorA, colorB }>`
  - `summaryText(answers, names) => string`

- [ ] **Step 1 : Écrire les tests en échec**

Ajouter à `src/scoring.test.js` — et compléter l'import en tête du fichier avec `vigilanceList`, `divergenceList`, `summaryText`, ainsi que `reponsesAvecDivergences` depuis les fixtures :

```js
const NOMS = ['Alice', 'Bob'];

/** Une passation dont on force les scores, sans passer par les 30 items réels. */
function passationForcee(repartition) {
  const out = [];
  Object.entries(repartition).forEach(([code, n]) => {
    for (let i = 0; i < n; i += 1) out.push(code);
  });
  return out;
}

describe('vigilanceList', () => {
  it('signale une dimension primaire chez l’un et neutre chez l’autre', () => {
    const a = passationForcee({ P: 9, M: 3 });
    const b = passationForcee({ P: 4, M: 8 });
    const vig = vigilanceList([a, b], NOMS);
    expect(vig).toHaveLength(1);
    expect(vig[0]).toMatchObject({ strong: 'Alice', weak: 'Bob', dim: 'Paroles valorisantes' });
  });

  it('signale l’écart dans l’autre sens', () => {
    const a = passationForcee({ P: 4 });
    const b = passationForcee({ P: 9 });
    expect(vigilanceList([a, b], NOMS)[0]).toMatchObject({ strong: 'Bob', weak: 'Alice' });
  });

  it('ne signale rien à 8 contre 4 : le seuil primaire n’est pas atteint', () => {
    const a = passationForcee({ P: 8 });
    const b = passationForcee({ P: 4 });
    expect(vigilanceList([a, b], NOMS)).toEqual([]);
  });

  it('ne signale rien à 9 contre 5 : le seuil neutre n’est pas atteint', () => {
    const a = passationForcee({ P: 9 });
    const b = passationForcee({ P: 5 });
    expect(vigilanceList([a, b], NOMS)).toEqual([]);
  });

  it('signale l’écart réel entre les deux fixtures de passation', () => {
    const vig = vigilanceList([REPONSES_PREMIERE_OPTION, REPONSES_SECONDE_OPTION], NOMS);
    expect(vig).toHaveLength(1);
    expect(vig[0]).toMatchObject({ strong: 'Alice', weak: 'Bob', dim: 'Paroles valorisantes' });
  });
});

describe('divergenceList', () => {
  it('ne retient que les items où les deux ont choisi une dimension différente', () => {
    const b = reponsesAvecDivergences([0, 3]);
    const div = divergenceList([REPONSES_PREMIERE_OPTION, b], NOMS);
    expect(div.map((d) => d.id)).toEqual([1, 4]);
  });

  it('porte les prénoms, dimensions et textes des deux choix', () => {
    const b = reponsesAvecDivergences([0]);
    const [premier] = divergenceList([REPONSES_PREMIERE_OPTION, b], NOMS);
    expect(premier).toMatchObject({
      nameA: 'Alice',
      nameB: 'Bob',
      dimA: 'Paroles valorisantes',
      dimB: 'Contact physique'
    });
    expect(premier.textA).toMatch(/compliments/);
    expect(premier.textB).toMatch(/bras/);
  });

  it('ignore les items auxquels l’un des deux n’a pas répondu', () => {
    const a = REPONSES_PREMIERE_OPTION.slice();
    const b = reponsesAvecDivergences([0, 3]);
    a[0] = null;
    expect(divergenceList([a, b], NOMS).map((d) => d.id)).toEqual([4]);
  });

  it('rend une liste vide quand les deux passations sont identiques', () => {
    expect(divergenceList([REPONSES_PREMIERE_OPTION, REPONSES_PREMIERE_OPTION], NOMS)).toEqual([]);
  });
});

describe('summaryText', () => {
  it('rend la synthèse d’une passation quasi identique', () => {
    const b = reponsesAvecDivergences([0, 1]);
    expect(summaryText([REPONSES_PREMIERE_OPTION, b], NOMS)).toMatchInlineSnapshot();
  });

  it('mentionne l’absence d’écart quand aucune vigilance ne se déclenche', () => {
    const texte = summaryText([REPONSES_PREMIERE_OPTION, REPONSES_PREMIERE_OPTION], NOMS);
    expect(texte).toContain('Aucun écart de ce type.');
    expect(texte).toContain('ITEMS DIVERGENTS (0)');
  });

  it('reprend le total de contrôle de chaque participant', () => {
    const texte = summaryText([REPONSES_PREMIERE_OPTION, REPONSES_SECONDE_OPTION], NOMS);
    expect(texte).toContain('Total de contrôle : 30/30');
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run : `pnpm test:run src/scoring.test.js`
Expected : FAIL, `vigilanceList is not a function`.

- [ ] **Step 3 : Compléter `src/scoring.js`**

Ajouter en tête l'import de `DIM_NAME` (`import { DATA, DIM_COLOR, DIM_NAME, levelFor } from './questionnaire.js';`) puis :

```js
/**
 * Les dimensions où l'un est en langage primaire (9-12) et l'autre en canal neutre (0-4).
 * @param {[string[], string[]]} answers
 * @param {[string, string]} names
 */
export function vigilanceList(answers, names) {
  const a = scores(answers[0]);
  const b = scores(answers[1]);
  const out = [];
  DATA.meta.dimensions.forEach((d) => {
    const av = a[d.code];
    const bv = b[d.code];
    if (av >= 9 && bv <= 4) out.push({ strong: names[0], weak: names[1], dim: d.nom, color: DIM_COLOR[d.code] });
    else if (bv >= 9 && av <= 4) out.push({ strong: names[1], weak: names[0], dim: d.nom, color: DIM_COLOR[d.code] });
  });
  return out;
}

/**
 * Les items où les deux n'ont pas retenu la même dimension.
 * @param {[string[], string[]]} answers
 * @param {[string, string]} names
 */
export function divergenceList(answers, names) {
  const out = [];
  DATA.items.forEach((item, i) => {
    const ca = answers[0][i];
    const cb = answers[1][i];
    if (!ca || !cb || ca === cb) return;
    const ta = item.options.find((o) => o.code === ca);
    const tb = item.options.find((o) => o.code === cb);
    out.push({
      id: item.id,
      nameA: names[0], nameB: names[1],
      dimA: DIM_NAME[ca], dimB: DIM_NAME[cb],
      textA: ta ? ta.texte : '', textB: tb ? tb.texte : '',
      colorA: DIM_COLOR[ca], colorB: DIM_COLOR[cb]
    });
  });
  return out;
}

/**
 * La synthèse textuelle des deux profils, telle qu'elle est copiée dans le presse-papiers.
 * @param {[string[], string[]]} answers
 * @param {[string, string]} names
 */
export function summaryText(answers, names) {
  const lines = [DATA.meta.titre, ''];
  [0, 1].forEach((who) => {
    lines.push(names[who].toUpperCase());
    profileRows(answers[who]).forEach((r) => {
      lines.push('  ' + r.score + '/12  ' + r.nom + '  (' + r.niveau + ')');
    });
    lines.push('  Total de contrôle : ' + answers[who].filter(Boolean).length + '/30');
    lines.push('');
  });
  lines.push('POINTS DE VIGILANCE');
  const vig = vigilanceList(answers, names);
  if (!vig.length) lines.push('  Aucun écart de ce type.');
  vig.forEach((v) => {
    lines.push('  ' + v.strong + ' a un besoin fort de ' + v.dim + ', une dimension peu sensible chez ' + v.weak + '.');
  });
  lines.push('');
  const div = divergenceList(answers, names);
  lines.push('ITEMS DIVERGENTS (' + div.length + ')');
  div.forEach((x) => {
    lines.push('  Item ' + x.id);
    lines.push('    ' + x.nameA + ' — ' + x.textA);
    lines.push('    ' + x.nameB + ' — ' + x.textB);
  });
  return lines.join('\n');
}
```

Ce code est repris **à l'identique** de `App.jsx`, les accès à `this.state` étant remplacés par les paramètres. Ne rien reformuler au passage : toute retouche invaliderait le rôle de filet des tests de parcours.

- [ ] **Step 4 : Lancer les tests et relire le snapshot**

Run : `pnpm test:run src/scoring.test.js`

Vitest remplit `toMatchInlineSnapshot()`. **Relire le bloc généré** : il doit contenir les deux profils Alice et Bob, `Aucun écart de ce type.` sous POINTS DE VIGILANCE — Alice est à 9 en Paroles valorisantes mais Bob à 8, le seuil neutre n'est pas atteint — et `ITEMS DIVERGENTS (2)` portant les items 1 et 2.

Expected : PASS, 22 tests dans ce fichier.

- [ ] **Step 5 : Brancher `App.jsx`**

Supprimer les méthodes `vigilanceList()`, `divergenceList()` et `summaryText()` d'`App.jsx`. Dans `renderResults`, calculer une fois les prénoms puis appeler le module :

```js
const names = scoring.resolveNames(st.nameA, st.nameB);
const vig = scoring.vigilanceList(st.answers, names);
const div = scoring.divergenceList(st.answers, names);
```

Dans `copy()`, remplacer `this.summaryText()` par :

```js
const names = scoring.resolveNames(this.state.nameA, this.state.nameB);
const text = scoring.summaryText(this.state.answers, names);
```

- [ ] **Step 6 : Vérifier**

Run : `pnpm test:run && pnpm build`
Expected : 39 tests au vert, build réussi.

- [ ] **Step 7 : Commit**

```bash
git add src/scoring.js src/scoring.test.js src/App.jsx
git commit -m "refactor: 💡 extrait vigilance, divergences et synthèse vers scoring.js"
```

---

### Task 4 : `scoring.js` — l'anti-biais de position

**Files:**
- Modify: `src/scoring.js`
- Modify: `src/App.jsx`
- Test: `src/scoring.test.js`

**Interfaces:**
- Consumes: `DATA` depuis `./questionnaire.js`.
- Produces :
  - `makeOrders() => number[]` (longueur `DATA.items.length`, valeurs `0` ou `1`)
  - `slotFor(code: string, item: object, flipped: boolean) => 0 | 1 | null`
  - `codeAt(item: object, flipped: boolean, slot: 0 | 1) => string`

C'est la tâche la plus sensible du plan : une inversion ici crédite les points à la mauvaise dimension sans que rien ne se voie à l'écran.

- [ ] **Step 1 : Écrire les tests en échec**

Ajouter à `src/scoring.test.js` (compléter l'import avec `makeOrders`, `slotFor`, `codeAt`, et importer `DATA` depuis `./questionnaire.js`, ainsi que `vi` depuis `vitest`) :

```js
describe('makeOrders', () => {
  it('tire un ordre par item', () => {
    expect(makeOrders()).toHaveLength(DATA.items.length);
  });

  it('ne rend que des 0 et des 1', () => {
    makeOrders().forEach((v) => expect([0, 1]).toContain(v));
  });

  it('inverse l’affichage sous le seuil de 0,5', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2);
    expect(makeOrders().every((v) => v === 1)).toBe(true);
  });

  it('conserve l’ordre du JSON au-dessus du seuil', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    expect(makeOrders().every((v) => v === 0)).toBe(true);
  });
});

describe('slotFor et codeAt', () => {
  it('place la première option en haut quand l’affichage n’est pas inversé', () => {
    const item = DATA.items[0];
    expect(slotFor(item.options[0].code, item, false)).toBe(0);
    expect(slotFor(item.options[1].code, item, false)).toBe(1);
  });

  it('intervertit les positions quand l’affichage est inversé', () => {
    const item = DATA.items[0];
    expect(slotFor(item.options[0].code, item, true)).toBe(1);
    expect(slotFor(item.options[1].code, item, true)).toBe(0);
  });

  it('rend null pour une dimension absente de l’item', () => {
    const item = DATA.items[0]; // P / T
    expect(slotFor('C', item, false)).toBeNull();
  });

  it('rend la dimension effectivement affichée à une position donnée', () => {
    const item = DATA.items[0];
    expect(codeAt(item, false, 0)).toBe(item.options[0].code);
    expect(codeAt(item, true, 0)).toBe(item.options[1].code);
  });

  it('fait l’aller-retour sans perte sur les 30 items, dans les deux sens', () => {
    DATA.items.forEach((item) => {
      [false, true].forEach((flipped) => {
        item.options.forEach((opt) => {
          const slot = slotFor(opt.code, item, flipped);
          expect(slot).not.toBeNull();
          expect(codeAt(item, flipped, slot)).toBe(opt.code);
        });
      });
    });
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run : `pnpm test:run src/scoring.test.js`
Expected : FAIL, `makeOrders is not a function`.

- [ ] **Step 3 : Compléter `src/scoring.js`**

```js
/** Un ordre d'affichage tiré au sort par item, pour éviter le biais de position. */
export function makeOrders() {
  return DATA.items.map(() => (Math.random() < 0.5 ? 1 : 0));
}

/**
 * La position à l'écran (0 ou 1) d'une dimension sur un item donné.
 * @param {string} code
 * @param {object} item
 * @param {boolean} flipped
 * @returns {0|1|null}
 */
export function slotFor(code, item, flipped) {
  const i = item.options.findIndex((o) => o.code === code);
  if (i < 0) return null;
  return flipped ? 1 - i : i;
}

/**
 * La dimension affichée à une position donnée : l'inverse exact de `slotFor`.
 * @param {object} item
 * @param {boolean} flipped
 * @param {0|1} slot
 */
export function codeAt(item, flipped, slot) {
  return item.options[flipped ? 1 - slot : slot].code;
}
```

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run : `pnpm test:run src/scoring.test.js`
Expected : PASS. Le test aller-retour porte 120 assertions à lui seul.

- [ ] **Step 5 : Brancher `App.jsx`**

1. Supprimer les méthodes `makeOrders()` et `slotFor(code)`.
2. Dans `start()`, remplacer `this.makeOrders()` par `scoring.makeOrders()`.
3. Dans `pick(who, slot)`, remplacer le calcul manuel :

```js
  pick(who, slot) {
    const idx = this.state.idx;
    const item = DATA.items[idx];
    const flipped = this.state.order[idx] === 1;
    const code = scoring.codeAt(item, flipped, slot);
    const answers = this.state.answers.map((a) => a.slice());
    answers[who][idx] = code;
    this.setState({ answers });
    if (!answers[0][idx] || !answers[1][idx]) return;
    clearTimeout(this._advance);
    this._advance = setTimeout(() => {
      if (idx < DATA.items.length - 1) this.setState({ idx: idx + 1 });
      else this.setState({ screen: 'results', tab: 'profils', divIdx: 0 });
    }, 340);
  }
```

4. Dans `renderQuiz`, remplacer les deux appels à `this.slotFor(...)` :

```js
    const selA = st.answers[0][st.idx] ? scoring.slotFor(st.answers[0][st.idx], item, flipped) : null;
    const selB = st.answers[1][st.idx] ? scoring.slotFor(st.answers[1][st.idx], item, flipped) : null;
```

Ces deux lignes se placent après `const flipped = …`, qui existe déjà dans `renderQuiz`.

- [ ] **Step 6 : Vérifier**

Run : `pnpm test:run && pnpm build`
Expected : 48 tests au vert, build réussi. `App.jsx` ne contient plus aucune méthode de calcul.

- [ ] **Step 7 : Commit**

```bash
git add src/scoring.js src/scoring.test.js src/App.jsx
git commit -m "refactor: 💡 extrait l'anti-biais de position et verrouille son aller-retour"
```

---

### Task 5 : Accessibilité et tests de l'écran de passation

**Files:**
- Modify: `src/App.jsx` (`renderQuiz`)
- Test: `src/App.test.jsx`

**Interfaces:**
- Consumes: tout `scoring.*` des tâches 2 à 4.
- Produces: le harnais de test de parcours réutilisé par les tâches 6 et 7 —
  `demarrer(user)` amène l'application de l'accueil à la première question avec Alice et Bob ;
  `repondre(user, slotAlice, slotBob)` répond à l'item courant et laisse l'avance automatique s'exécuter.

Les tests sont écrits **avant** les corrections : c'est leur échec qui justifie chaque attribut ajouté.

- [ ] **Step 1 : Écrire les tests en échec**

`src/App.test.jsx` :

```jsx
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import { DATA } from './questionnaire.js';

/**
 * user-event v14 attend des délais réels : sans `advanceTimers`, un test sous
 * fausses horloges se fige. Le stub de Math.random fixe l'ordre d'affichage
 * sur celui du JSON (0.9 >= 0.5 donc aucun item n'est inversé).
 */
function preparer() {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0.9);
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

async function demarrer(user) {
  await user.type(screen.getByLabelText('Premier prénom'), 'Alice');
  await user.type(screen.getByLabelText('Second prénom'), 'Bob');
  await user.click(screen.getByRole('button', { name: 'Commencer' }));
}

/** Répond à l'item affiché puis laisse s'écouler l'avance automatique de 340 ms. */
async function repondre(user, slotAlice, slotBob) {
  const cartes = screen.getAllByRole('group');
  await user.click(within(cartes[slotAlice]).getByRole('button', { name: 'Alice' }));
  await user.click(within(cartes[slotBob]).getByRole('button', { name: 'Bob' }));
  await act(async () => { vi.advanceTimersByTime(400); });
}

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { vi.useRealTimers(); });

describe('écran d’accueil', () => {
  it('interdit de commencer tant qu’un prénom manque', async () => {
    const user = preparer();
    render(<App />);
    expect(screen.getByRole('button', { name: 'Commencer' })).toBeDisabled();
    await user.type(screen.getByLabelText('Premier prénom'), 'Alice');
    expect(screen.getByRole('button', { name: 'Commencer' })).toBeDisabled();
    await user.type(screen.getByLabelText('Second prénom'), 'Bob');
    expect(screen.getByRole('button', { name: 'Commencer' })).toBeEnabled();
  });

  it('n’offre pas de reprise quand aucune passation n’est sauvegardée', () => {
    render(<App />);
    expect(screen.queryByRole('button', { name: /Reprendre/ })).not.toBeInTheDocument();
  });
});

describe('écran de passation', () => {
  it('donne un titre à l’écran et annonce la progression', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Chacun choisit sa proposition');
    const barre = screen.getByRole('progressbar');
    expect(barre).toHaveAttribute('aria-valuenow', '0');
    expect(barre).toHaveAttribute('aria-valuemax', String(DATA.items.length));
    expect(barre).toHaveAttribute('aria-valuetext', 'question 1 sur 30');
  });

  it('rattache chaque bouton de choix à la proposition qu’il concerne', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);

    const cartes = screen.getAllByRole('group');
    expect(cartes).toHaveLength(2);
    expect(cartes[0]).toHaveAccessibleName(DATA.items[0].options[0].texte);
    expect(cartes[1]).toHaveAccessibleName(DATA.items[0].options[1].texte);
    expect(within(cartes[0]).getByRole('button', { name: 'Alice' })).toBeInTheDocument();
    expect(within(cartes[1]).getByRole('button', { name: 'Alice' })).toBeInTheDocument();
  });

  it('expose le choix par aria-pressed sans altérer le nom du bouton', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);

    const cartes = screen.getAllByRole('group');
    const alice = within(cartes[0]).getByRole('button', { name: 'Alice' });
    expect(alice).toHaveAttribute('aria-pressed', 'false');
    await user.click(alice);
    expect(within(cartes[0]).getByRole('button', { name: 'Alice' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(cartes[1]).getByRole('button', { name: 'Alice' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('annonce qui doit encore répondre', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    await user.click(within(screen.getAllByRole('group')[0]).getByRole('button', { name: 'Alice' }));
    expect(screen.getByRole('status')).toHaveTextContent('En attente de Bob');
  });

  it('passe à l’item suivant une fois les deux réponses données', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);
    await repondre(user, 0, 0);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'question 2 sur 30');
    expect(screen.getAllByRole('group')[0]).toHaveAccessibleName(DATA.items[1].options[0].texte);
  });

  it('efface les deux réponses de l’item précédent au retour arrière', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);
    await repondre(user, 0, 0);
    await user.click(screen.getByRole('button', { name: /Question précédente/ }));

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'question 1 sur 30');
    screen.getAllByRole('group').forEach((carte) => {
      within(carte).getAllByRole('button').forEach((b) => {
        expect(b).toHaveAttribute('aria-pressed', 'false');
      });
    });
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run : `pnpm test:run src/App.test.jsx`
Expected : FAIL. Les échecs attendus sont exactement ceux que la spec annonçait — `Unable to find an accessible element with the role "progressbar"`, `Unable to find an accessible element with the role "heading"`, `Found multiple elements with the role "button" and name "Alice"`, `role "status"`.

- [ ] **Step 3 : Corriger `renderQuiz` dans `src/App.jsx`**

Quatre modifications, toutes à styles constants.

Le fabricant de puce reçoit `aria-pressed` et sort le « ✓ » du nom accessible :

```jsx
    const chip = (sel, slot, who) => (
      <button
        className="lq-chip"
        type="button"
        aria-pressed={sel === slot}
        onClick={() => this.pick(who, slot)}
        style={{ border: `1px solid ${sel === slot ? SEL_BORDER : OFF_BORDER}`, background: sel === slot ? SEL_BG : OFF_BG }}
      >
        {sel === slot && <span aria-hidden="true">✓ </span>}
        {names[who]}
      </button>
    );
```

Le paragraphe de consigne devient le titre de l'écran — `fontWeight: 400` préserve l'apparence, un `<h1>` étant gras par défaut :

```jsx
            <h1 style={{ margin: 0, fontSize: 12, fontWeight: 400, letterSpacing: '.08em', textTransform: 'uppercase', color: muted(55) }}>Chacun choisit sa proposition</h1>
```

La barre de progression s'annonce :

```jsx
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={st.idx}
            aria-valuetext={`question ${st.idx + 1} sur ${total}`}
            style={{ height: 3, borderRadius: 2, background: muted(12), overflow: 'hidden' }}
          >
```

Chaque carte devient un groupe nommé par le texte de sa proposition :

```jsx
          {shown.map((opt, slot) => {
            const labelId = `lq-opt-${st.idx}-${slot}`;
            return (
              <div key={slot} role="group" aria-labelledby={labelId} style={{ display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--color-surface)', border: '1px solid var(--color-divider)', borderLeft: `3px solid ${DIM_COLOR[opt.code]}`, borderRadius: 'var(--radius-lg)', padding: 18 }}>
                <p id={labelId} style={{ margin: 0, fontSize: 'clamp(16px, 4.3vw, 18px)', lineHeight: 1.45, textWrap: 'pretty' }}>{opt.texte}</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  {chip(selA, slot, 0)}
                  {chip(selB, slot, 1)}
                </div>
              </div>
            );
          })}
```

Attention : le `map` passe d'un corps d'expression à un corps de bloc, il faut donc un `return` explicite et une accolade fermante supplémentaire.

Enfin le message d'attente s'annonce :

```jsx
          <p role="status" style={{ margin: 0, fontSize: 12, color: muted(45) }}>{waiting}</p>
```

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run : `pnpm test:run src/App.test.jsx`
Expected : PASS, 8 tests.

- [ ] **Step 5 : Vérifier l'absence de régression visuelle**

Run : `pnpm dev`, ouvrir `http://localhost:5173`, lancer une passation sur deux ou trois items.
Expected : puces, coche, barre de progression et consigne strictement identiques à avant.

- [ ] **Step 6 : Commit**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "feat: 🎸 rend l'écran de passation navigable au lecteur d'écran"
```

---

### Task 6 : Parcours complet et persistance

**Files:**
- Test: `src/App.test.jsx`

**Interfaces:**
- Consumes: `demarrer`, `repondre` et `preparer` de la tâche 5.
- Produces: rien de nouveau. Cette tâche ne modifie aucun code de production — c'est le filet qui prouve que les extractions des tâches 2 à 4 n'ont rien changé.

- [ ] **Step 1 : Ajouter le helper de parcours complet**

Dans `src/App.test.jsx`, sous `repondre` :

```jsx
/** Répond aux 30 items : Alice sur la position `slotAlice`, Bob sur `slotBob`. */
async function repondreTout(user, slotAlice, slotBob) {
  for (let i = 0; i < DATA.items.length; i += 1) {
    await repondre(user, slotAlice, slotBob);
  }
}
```

- [ ] **Step 2 : Écrire les tests**

```jsx
describe('parcours complet', () => {
  it('affiche deux profils identiques quand les deux répondent pareil', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);
    await repondreTout(user, 0, 0);

    expect(screen.getByRole('heading', { name: 'Vos deux profils' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Alice' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bob' })).toBeInTheDocument();
    // Toujours la première proposition : P=9, M=7, C=5, S=4, T=5, pour chacun.
    expect(screen.getAllByText('9/12')).toHaveLength(2);
    expect(screen.getAllByText('4/12')).toHaveLength(2);
  });

  it('relève la vigilance et les divergences quand les choix s’opposent', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);
    await repondreTout(user, 0, 1);

    await user.click(screen.getByRole('button', { name: 'Vigilance' }));
    expect(screen.getByText(/Paroles valorisantes/)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Divergences (30)' })).toBeInTheDocument();
  });
});

describe('persistance locale', () => {
  it('reprend à la question en cours après un remontage', async () => {
    const user = preparer();
    const vue = render(<App />);
    await demarrer(user);
    await repondre(user, 0, 0);
    await repondre(user, 0, 0);
    vue.unmount();

    render(<App />);
    // La sauvegarde restaure aussi l'écran : on revient directement sur la passation.
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'question 3 sur 30');
  });

  it('propose de revoir le dernier résultat depuis l’accueil', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);
    await repondreTout(user, 0, 0);
    await user.click(screen.getByRole('button', { name: 'Recommencer' }));

    expect(screen.getByRole('button', { name: 'Revoir le dernier résultat' })).toBeInTheDocument();
  });

  it('efface la sauvegarde quand on relance une passation', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);
    await repondreTout(user, 0, 0);
    await user.click(screen.getByRole('button', { name: 'Recommencer' }));
    await user.click(screen.getByRole('button', { name: 'Commencer' }));

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'question 1 sur 30');
    screen.getAllByRole('group').forEach((carte) => {
      within(carte).getAllByRole('button').forEach((b) => {
        expect(b).toHaveAttribute('aria-pressed', 'false');
      });
    });
  });
});
```

- [ ] **Step 3 : Lancer les tests**

Run : `pnpm test:run src/App.test.jsx`
Expected : PASS, 13 tests.

Si le parcours complet dépasse quelques secondes, augmenter le `testTimeout` du bloc `test` de `vite.config.js` plutôt que de réduire le nombre d'items parcourus : c'est le passage sur les 30 items réels qui fait la valeur de ce test.

- [ ] **Step 4 : Commit**

```bash
git add src/App.test.jsx
git commit -m "test: 💍 couvre le parcours complet et la reprise d'une passation"
```

---

### Task 7 : Accessibilité et tests de l'écran de résultats

**Files:**
- Modify: `src/App.jsx` (`renderResults`)
- Modify: `src/styles/app.css`
- Test: `src/App.test.jsx`

**Interfaces:**
- Consumes: `demarrer`, `repondreTout`, `preparer` des tâches 5 et 6.
- Produces: la classe utilitaire `.sr-only` dans `app.css`, disponible pour toute annonce future destinée aux seuls lecteurs d'écran.

- [ ] **Step 1 : Écrire les tests en échec**

Ajouter à `src/App.test.jsx` :

```jsx
describe('écran de résultats', () => {
  it('expose l’onglet actif par aria-pressed', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);
    await repondreTout(user, 0, 1);

    expect(screen.getByRole('button', { name: 'Profils' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Vigilance' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'Vigilance' }));
    expect(screen.getByRole('button', { name: 'Vigilance' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Profils' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('annonce la copie réussie de la synthèse', async () => {
    const user = preparer();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(<App />);
    await demarrer(user);
    await repondreTout(user, 0, 1);
    await user.click(screen.getByRole('button', { name: 'Copier le résultat' }));

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toContain('ALICE');
    expect(await screen.findByRole('status')).toHaveTextContent('Résultat copié');
  });

  it('propose une copie manuelle quand le navigateur refuse', async () => {
    const user = preparer();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('refus')) },
      configurable: true
    });
    // jsdom n'implémente pas execCommand : on le rend explicitement infructueux.
    document.execCommand = vi.fn(() => false);

    render(<App />);
    await demarrer(user);
    await repondreTout(user, 0, 1);
    await user.click(screen.getByRole('button', { name: 'Copier le résultat' }));

    const zone = await screen.findByLabelText('Synthèse à copier manuellement');
    expect(zone.value).toContain('ALICE');
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run : `pnpm test:run src/App.test.jsx`
Expected : FAIL sur `aria-pressed` absent des onglets, sur le `role="status"` introuvable et sur le libellé du textarea.

- [ ] **Step 3 : Ajouter l'utilitaire visuellement masqué**

À la fin de `src/styles/app.css` :

```css
/* Contenu réservé aux lecteurs d'écran : présent dans l'arbre d'accessibilité,
   absent de la mise en page. */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 4 : Corriger `renderResults` dans `src/App.jsx`**

Le fabricant d'onglet expose son état :

```jsx
    const tab = (name, label) => (
      <button
        className="lq-tab"
        type="button"
        aria-pressed={st.tab === name}
        onClick={() => this.setState({ tab: name })}
        style={{
          border: `1px solid ${st.tab === name ? 'var(--color-accent-600)' : 'var(--color-divider)'}`,
          background: st.tab === name ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)' : 'transparent'
        }}
      >
        {label}
      </button>
    );
```

La rangée d'onglets devient un groupe nommé :

```jsx
        <div role="group" aria-label="Vue des résultats" style={{ display: 'flex', gap: 6 }}>
          {tab('profils', 'Profils')}
          {tab('vigilance', 'Vigilance')}
          {tab('divergences', `Divergences (${div.length})`)}
        </div>
```

Le textarea de repli reçoit son libellé :

```jsx
            <textarea className="input" readOnly aria-label="Synthèse à copier manuellement" value={st.copyText} onFocus={(e) => e.target.select()} style={{ minHeight: 160, fontSize: 12, lineHeight: 1.45 }} />
```

Et la confirmation de copie s'annonce. Le libellé du bouton change déjà à l'écran, mais un changement de nom accessible n'est pas annoncé : il faut une région vivante dédiée. L'ajouter juste avant la rangée de boutons du bas :

```jsx
        <p role="status" className="sr-only">{st.copied ? 'Résultat copié dans le presse-papiers' : ''}</p>
```

- [ ] **Step 5 : Lancer les tests pour vérifier qu'ils passent**

Run : `pnpm test:run src/App.test.jsx`
Expected : PASS, 16 tests.

Note : l'écran de résultats compte désormais deux éléments de rôle `group` — la rangée d'onglets et, pendant la passation, les cartes de proposition. Les helpers `repondre` et `repondreTout` ne s'exécutent que sur l'écran de passation, ils ne sont donc pas affectés.

- [ ] **Step 6 : Commit**

```bash
git add src/App.jsx src/App.test.jsx src/styles/app.css
git commit -m "feat: 🎸 annonce l'onglet actif et la copie aux lecteurs d'écran"
```

---

### Task 8 : Vérification des critères d'acceptation

**Files:**
- Modify: `README.md` (si la couverture révèle un manque à documenter)

**Interfaces:**
- Consumes: l'ensemble des tâches précédentes.
- Produces: la confirmation, preuves à l'appui, que les cinq critères de la spec sont tenus.

- [ ] **Step 1 : Passer la suite complète**

Run : `pnpm test:run`
Expected : 64 tests au vert, aucun échec, aucun test ignoré. Durée de quelques secondes.

- [ ] **Step 2 : Vérifier le build**

Run : `pnpm build`
Expected : bundle produit dans `dist/`, aucun avertissement nouveau par rapport à avant le chantier.

- [ ] **Step 3 : Vérifier l'absence de sélecteurs de test dans le code de production**

Run :

```bash
grep -rn "data-testid" src/ && echo "ÉCHEC : un data-testid subsiste" || echo "OK : aucun data-testid"
```

Expected : `OK : aucun data-testid`.

- [ ] **Step 4 : Vérifier l'isolement de `scoring.js`**

Run :

```bash
grep -nE "^import" src/scoring.js
```

Expected : une seule ligne d'import, depuis `./questionnaire.js`. Ni React, ni `App.jsx`.

- [ ] **Step 5 : Relever la couverture**

Run : `pnpm test:coverage`

Lire le tableau. `scoring.js` et `questionnaire.js` doivent être proches de 100 %. Si une branche d'`App.jsx` ressort à découvert et qu'elle porte une règle métier — et non du style —, la noter dans le message de commit comme piste pour la suite. Ne pas ajouter de seuil bloquant : la spec l'exclut explicitement.

- [ ] **Step 6 : Vérifier l'application dans le navigateur**

Run : `pnpm dev`
Parcourir un questionnaire complet à deux : accueil, passation, retour arrière, résultats, trois onglets, copie.
Expected : comportement et apparence identiques à l'état initial du chantier.

- [ ] **Step 7 : Commit final**

```bash
git add -A
git commit -m "test: 💍 vérifie les critères d'acceptation de la suite Vitest"
```

Si rien n'a changé à cette étape, ne pas créer de commit vide — passer.
