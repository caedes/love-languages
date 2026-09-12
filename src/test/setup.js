import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

// `componentDidUpdate` écrit dans localStorage à chaque changement d'état :
// sans ce nettoyage, le test suivant croit reprendre une passation en cours.
afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

// Compat Vitest / @testing-library/react : l'`asyncWrapper` de la librairie (utilisé par
// chaque appel async de `userEvent`) ne sait détecter des faux timers que via un global
// `jest` (elle regarde `setTimeout._isMockFunction` ou `setTimeout.clock`, mais seulement
// si `typeof jest !== 'undefined'`). Sous Vitest ce global n'existe pas : sans ce stub,
// tout `userEvent.click/type(...)` lancé sous `vi.useFakeTimers()` reste bloqué
// indéfiniment, en attente d'un timer que rien n'avance jamais.
if (typeof globalThis.jest === 'undefined') {
  globalThis.jest = { advanceTimersByTime: (ms) => vi.advanceTimersByTime(ms) };
}
