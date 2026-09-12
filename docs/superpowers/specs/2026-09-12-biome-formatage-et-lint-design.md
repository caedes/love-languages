# Formatage et lint avec Biome, posés par un hook de pre-commit

- **Date** : 2026-09-12
- **Statut** : design validé, prêt pour le plan d'implémentation
- **Issue** : [#5 — Biome JS](https://github.com/caedes/love-languages/issues/5)
- **Périmètre** : installation de Biome 2.5.13 (formateur + linter), mise en
  conformité du dépôt, hook de pre-commit husky, gate CI, documentation.

## Contexte

Le dépôt n'a aujourd'hui ni formateur ni linter. Le style s'est maintenu à la
main : indentation de deux espaces, guillemets simples, point-virgules — mais
aucune discipline de largeur, `App.jsx` allant jusqu'à 304 colonnes.

L'issue pose une question à laquelle il faut répondre avant de concevoir quoi
que ce soit : Biome embarque-t-il sa propre mécanique de hook ? **Non.** Sa
documentation renvoie vers husky, lefthook, simple-git-hooks ou pre-commit. En
revanche sa CLI accepte `--staged`, ce qui rend `lint-staged` inutile : le hook
tient en deux lignes.

### Mesure préalable

Biome 2.5.13 a été exécuté sur une copie du dépôt, avec la configuration retenue
ci-dessous. Ces chiffres fondent le découpage de la migration :

| passe | diagnostics restants |
| --- | --- |
| état actuel | 69 (51 erreurs, 7 avertissements, 11 infos) |
| après `check --write` (correctifs sûrs) | 39 |
| après `check --write --unsafe` | 22, toutes à trancher à la main |

Ces mesures ne valent qu'en présence de `package.json` dans l'arborescence
analysée : c'est de lui que Biome déduit les *domains* React et Vitest, donc
l'activation de règles comme `noArrayIndexKey`. Une mesure faite sur une copie
partielle les sous-estime.

Le formatage seul pèse ~1 900 lignes de diff sur 19 fichiers, dont 526 pour
`src/data/langages-amour-questions.json` et 480 pour `src/styles/nocturne.css`.

Les 22 irréductibles, après examen des sites concernés :

| règle | nombre | nature réelle |
| --- | --- | --- |
| `a11y/useButtonType` | 11 | Hygiène. Il n'y a aucun `<form>` dans `App.jsx` : pas de soumission accidentelle en embuscade. Mécanique. |
| `suspicious/useIterableCallbackReturn` | 5 | Toutes le même motif — un `forEach` imbriqué en corps d'expression d'une flèche. Correctif : des accolades. Aucun changement de comportement, y compris dans `src/icons/heart.js`. |
| `suspicious/noArrayIndexKey` | 3 | Clés d'index sur des listes calculées (`App.jsx` lignes 181, 266 et 363 avant formatage ; 246, 450 et 669 après). Demande une clé stable tirée du contenu. |
| `a11y/useSemanticElements` | 3 | Trois `div role="group"`, pour lesquels Biome réclame un `<fieldset>`. Demande du jugement — `fieldset` porte des styles par défaut et se comporte à part en flex — et touche le terrain couvert par les tests. |

Six corrections sur vingt-deux demandent donc vraiment de réfléchir.

## Décisions

| Question | Décision | Raison |
|---|---|---|
| Périmètre de Biome | Formateur **et** linter, jeu de règles `recommended` | Remplace Prettier et ESLint d'un coup ; l'ensemble recommandé est peu bavard et le coût de mise en conformité mesuré reste faible |
| Style de formatage | 2 espaces, guillemets simples, `lineWidth: 100` | Prolonge le style existant au lieu de le renier ; à 80 le JSX d'`App.jsx` se découpe beaucoup plus, à 100 le diff initial se concentre sur le rewrap des lignes vraiment longues |
| Comportement du hook | Corrige puis réindexe | Le commit passe, déjà conforme ; ce que Biome ne sait pas corriger seul bloque quand même |
| Runner de hook | husky 9 | Chemin balisé et documenté partout, que l'auteur connaît déjà. Une alternative sans dépendance existe (`core.hooksPath` + script versionné) ; écartée au profit de la familiarité |
| `lint-staged` | Non | `biome check --staged` couvre le besoin sans dépendance supplémentaire |
| Gate CI | Étape dans le job `ci` existant | Le hook est contournable (`--no-verify`) et absent tant que `pnpm install` n'a pas tourné. Le job `ci` est déjà le check requis du ruleset : la gate de merge se resserre sans reconfiguration côté GitHub |
| Ordre de la migration | Hook et gate en **dernier** | Posés en premier, le hook réécrirait les commits de migration et la CI serait rouge sur toute la branche |
| Correctifs *unsafe* | Appliqués puis relus un par un | La suppression de variables et d'imports inutilisés peut révéler un calcul mort qui mérite un regard |
| Découpage | Une seule pull request | Les 22 corrections sont concentrées et peu risquées ; le dépôt est conforme dès le merge, sans règle désactivée à rallumer plus tard |
| Markdown et YAML | Hors du champ | Biome 2 ne les formate pas. `README.md`, `AGENTS.md` et `ci.yml` restent hors de son autorité — à savoir plutôt qu'à découvrir |
| Guillemets du CSS | Simples, comme en JS | Le défaut de Biome est le guillemet double ; l'aligner évite une incohérence entre deux familles de fichiers du même dépôt, et supprime dix lignes de diff |
| Le JSON des questions | Formaté comme le reste, sans exception | `src/data/langages-amour-questions.json` passe de 142 à 420 lignes. Le coût est assumé : aucune zone du dépôt n'échappe à Biome, et la règle reste expliquable en une phrase. Si les diffs sur les 30 items deviennent pénibles à relire, un `override` portant `lineWidth` à 180 sur `src/data/**` restaure la disposition compacte sans rien exclure |

## Section 1 — Outillage et configuration

### Dépendances

Deux devDependencies, et rien d'autre :

- `@biomejs/biome` 2.5.13
- `husky` 9.1.7

### `biome.json`

À la racine :

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "javascript": { "formatter": { "quoteStyle": "single" } },
  "css": { "formatter": { "quoteStyle": "single" } },
  "linter": { "enabled": true, "rules": { "recommended": true } }
}
```

`vcs.useIgnoreFile` fait relire le `.gitignore` existant : `dist/`, `coverage/`
et `node_modules` sortent du champ sans qu'on les redéclare. Les *domains* React
et Vitest s'activent seuls, Biome les déduisant de `package.json`.
L'organisation des imports est un *assist* actif par défaut — c'est ce qui pèse
pour 10 des diagnostics initiaux.

### Scripts

```json
"format": "biome check --write",
"check": "biome check",
"check:ci": "biome ci"
```

`format` est la commande à lancer à la main, `check` vérifie sans rien écrire,
`check:ci` est la gate. `biome ci` est la variante non destructrice prévue pour
l'intégration continue.

### Périmètre des fichiers

JS, JSX, JSON et CSS — dix-neuf fichiers touchés par la première passe. Cela
inclut `src/data/langages-amour-questions.json`, dont la disposition compacte
actuelle (un item par ligne, 142 lignes) sera éclatée en 420 lignes.

## Section 2 — Le hook de pre-commit

`.husky/pre-commit` :

```sh
pnpm exec biome check --write --staged --files-ignore-unknown=true --no-errors-on-unmatched
git update-index --again
```

et dans `package.json` :

```json
"prepare": "husky"
```

Le hook s'installe au premier `pnpm install`.

Ligne par ligne : `--staged` restreint au contenu de l'index, `--write` applique
formatage et correctifs sûrs, `--files-ignore-unknown` évite d'échouer sur un
commit qui ne touche que du Markdown, `--no-errors-on-unmatched` évite d'échouer
quand rien ne matche. Biome **ne réindexe pas** ce qu'il corrige, d'où
`git update-index --again`, qui réindexe exactement les chemins déjà présents
dans l'index. Une erreur non corrigeable automatiquement fait sortir Biome en
échec et le commit est refusé.

### Limite connue

Sur un fichier **partiellement indexé** (`git add -p`), `git update-index
--again` réindexe le fichier entier, donc aussi la portion délibérément laissée
de côté. C'est le prix de l'absence de `lint-staged`, qui résout le cas en
remisant le reste du fichier pendant le hook. À documenter dans le README ; si
la pratique du `add -p` s'installe, c'est l'argument pour ajouter `lint-staged`.

## Section 3 — La gate CI

Dans `.github/workflows/ci.yml`, job `ci`, après `pnpm install --frozen-lockfile`
et **avant** `pnpm test:coverage` :

```yaml
      # biome ci n'ecrit rien : il sort en erreur si un fichier n'est pas conforme.
      - run: pnpm check:ci
```

En premier, pour qu'un écart de format se signale en quelques secondes au lieu
d'attendre la fin des tests et du build.

Deux détails. Le `pnpm install` de la CI déclenchera `prepare`, donc `husky` :
inoffensif, il ne fait que poser `core.hooksPath`, et aucun hook ne se déclenche
dans un job qui ne committe pas. Et les commentaires de `ci.yml` sont écrits
sans accents dans ce dépôt : la convention est conservée.

## Section 4 — La migration

Une pull request sur la branche `biome-js`, onze commits.

| # | commit | contenu |
| --- | --- | --- |
| 1 | `chore: 🤖 ajoute Biome et sa configuration` | `biome.json`, la devDependency, les trois scripts. Aucun fichier source touché. |
| 2 | `chore: 🤖 applique le formatage Biome au dépôt` | `biome format --write` seul. ~1 900 lignes, 19 fichiers, purement mécanique. |
| 3 | `chore: 🤖 applique les correctifs sûrs et trie les imports` | `biome check --write`. Petit diff. |
| 4 | `refactor: 💡 supprime le code mort et simplifie les concaténations` | Les 26 correctifs *unsafe* — `noUnusedVariables` ×4, `noUnusedImports` ×2, `useTemplate` ×9, `useOptionalChain` ×1 et leurs suites — appliqués puis relus un par un. |
| 5 | `refactor: 💡 ferme les callbacks forEach imbriqués` | Les 5 jeux d'accolades. |
| 6 | `fix: 🐛 type explicite sur les boutons` | Les 11 `type="button"`. |
| 7 | `fix: 🐛 clés stables sur les listes calculées` | Les 3 `key={i}`. |
| 8 | `refactor: 💡 balises sémantiques à la place des rôles ARIA` | Les 3 `useSemanticElements`. |
| 9 | `chore: 🤖 installe le hook de pre-commit` | `husky`, `.husky/pre-commit`, `prepare`. |
| 10 | `ci: 🎡 ajoute la gate Biome` | L'étape dans `ci.yml`. |
| 11 | `docs: ✏️ documente Biome` | Section README, convention dans `AGENTS.md`. |

### Le commit 8 est le seul à risque

Les tests interrogent l'interface par rôle et par libellé accessible. Remplacer
un `div role="group"` par un élément sémantique doit laisser la suite verte
**sans la retoucher** : c'est exactement ce qu'elle est là pour garantir. Chaque
substitution se fait tests lancés avant et après. Si un test casse, c'est le
remplacement qui est faux, pas le test — le cas échéant, on renonce à la
substitution et on désactive la règle sur le site précis, avec un commentaire
qui dit pourquoi.

### `git blame`

Les commits 2 et 3 polluent `git blame` sur tout le dépôt. Un
`.git-blame-ignore-revs` les liste, ajouté au commit 11 une fois leurs SHA
connus. GitHub le lit automatiquement ; en local il faut
`git config blame.ignoreRevsFile .git-blame-ignore-revs`, à documenter dans le
README.

### Vérification

`pnpm test:coverage` est rejoué après chaque commit, et en particulier après le
commit 2 : le formatage rewrappe du JSX et, même si Testing Library normalise
les espaces, cela se vérifie au lieu de se supposer.

## Hors périmètre

- Le formatage du Markdown et du YAML : Biome 2 ne sait pas le faire.
- Les groupes de règles au-delà de `recommended` (`style`, `nursery`, a11y
  complet) : à rouvrir une fois la base stabilisée, si le besoin se manifeste.
- Le découpage d'`App.jsx`, déjà reporté par le design précédent et toujours
  hors sujet ici.
- Toute intégration éditeur (extension VS Code, format à la sauvegarde) :
  affaire de poste de travail, pas de dépôt.

## Critères d'acceptation

1. `pnpm check` sort sans aucun diagnostic sur l'ensemble du dépôt.
2. `pnpm test:coverage` reste vert, sans qu'aucun test ait été modifié pour le
   faire passer.
3. Un commit contenant un fichier mal formaté est corrigé et réindexé par le
   hook, et passe.
4. Un commit contenant une erreur de lint non corrigeable automatiquement est
   refusé par le hook.
5. La CI échoue sur une branche où un fichier n'est pas conforme.
6. Un clone neuf suivi de `pnpm install` dispose du hook actif.
7. Le README explique les commandes, la limite du `git add -p` et la
   configuration de `blame.ignoreRevsFile`.
