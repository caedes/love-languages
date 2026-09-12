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
