import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

// `componentDidUpdate` écrit dans localStorage à chaque changement d'état :
// sans ce nettoyage, le test suivant croit reprendre une passation en cours.
afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});
