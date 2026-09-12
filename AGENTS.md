# AGENTS.md

Consignes pour les assistants de code (Claude Code, Codex, Cursor…) travaillant
sur ce dépôt. Le `README.md` décrit le projet lui-même — démarrage, tests,
icônes, CI, déploiement, arborescence ; ce fichier ne le répète pas, il ajoute
les conventions de travail que le README ne couvre pas.

## Le projet en deux lignes

Questionnaire des 5 langages de l'amour : Vite + React 18, aucun backend, aucun
appel réseau. L'écran entier vit dans `src/App.jsx`, le calcul des profils dans
`src/scoring.js`, les 30 items dans `src/data/langages-amour-questions.json`.

## Nom des branches

Format : `<type>/<slug-en-kebab-case>`, avec `<type>` parmi `feature`, `fix`,
`chore`, `ci`, `docs`, `refactor`, `test` — les mêmes types que les messages de
commit.

```
feature/tests-vitest
fix/bouton-de-reprise-du-formulaire
docs/conventions-de-branches
```

**Jamais de préfixe d'identité dans un nom de branche** : pas de pseudo, pas de
handle de compte, pas de nom d'outil. Le dépôt est personnel et l'auteur est
déjà porté par l'identité git des commits. Certains outils de worktree
proposent d'eux-mêmes un nom préfixé par le compte détecté sur la machine, qui
n'est pas forcément le bon : corriger le nom avant le premier push.

## Messages de commit

Conventional Commits avec gitmoji, en français, à la manière de l'historique
existant :

```
feat: 🎸 ajoute la favicon et les icônes mobiles
fix: 🐛 rend atteignable le bouton de reprise du formulaire
ci: 🎡 monte les actions aux majeures courantes et fixe Node 24
docs: ✏️ documente le filtre { selector: 'p' } dans le test de vigilance
test: 💍 exerce le branchement de l'affichage inversé
refactor: 💡 extrait le calcul des profils vers scoring.js
```

## Pull requests

`main` est protégée par un ruleset : pull request obligatoire, CI verte
obligatoire, force-push refusé. Titre de PR en français, même convention que
les commits.
