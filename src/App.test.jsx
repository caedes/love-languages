import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { DATA } from './questionnaire.js';

/**
 * user-event v14 attend des délais réels : sans `advanceTimers`, un test sous
 * fausses horloges se fige. Le stub de Math.random fixe l'ordre d'affichage :
 * par défaut 0.9 (>= 0.5, donc aucun item n'est inversé, l'ordre reste celui du
 * JSON) ; un appel avec 0.2 inverse l'affichage de tous les items.
 * @param {number} valeurAleatoire valeur renvoyée par Math.random
 */
function preparer(valeurAleatoire = 0.9) {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(valeurAleatoire);
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
  await act(async () => {
    vi.advanceTimersByTime(400);
  });
}

/** Répond aux 30 items : Alice sur la position `slotAlice`, Bob sur `slotBob`. */
async function repondreTout(user, slotAlice, slotBob) {
  for (let i = 0; i < DATA.items.length; i += 1) {
    await repondre(user, slotAlice, slotBob);
  }
}

/**
 * Matcher `getByText` pour un texte réparti entre plusieurs éléments (nom de
 * dimension et score dans des `<span>` distincts, phrase de vigilance avec
 * `<strong>`/`<em>`) : compare le texte intégral de l'élément, espaces normalisés.
 */
function texteIntegral(attendu) {
  return (_, element) => element.textContent.replace(/\s+/g, ' ').trim() === attendu;
}

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

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

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Chacun choisit sa proposition',
    );
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
    expect(within(cartes[0]).getByRole('button', { name: 'Alice' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(cartes[1]).getByRole('button', { name: 'Alice' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('annonce qui doit encore répondre', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    await user.click(
      within(screen.getAllByRole('group')[0]).getByRole('button', { name: 'Alice' }),
    );
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

  it('revient à l’accueil sans perdre les réponses déjà données', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);
    await repondre(user, 0, 0);
    await user.click(screen.getByRole('button', { name: 'Accueil' }));

    expect(screen.getByRole('heading', { name: "Les 5 langages de l'amour" })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reprendre où nous en étions (1 / 30)' }),
    ).toBeInTheDocument();
  });

  it('n’avance pas sur les résultats quand on rentre à l’accueil au dernier item', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);
    for (let i = 0; i < DATA.items.length - 1; i += 1) await repondre(user, 0, 0);
    const cartes = screen.getAllByRole('group');
    await user.click(within(cartes[0]).getByRole('button', { name: 'Alice' }));
    await user.click(within(cartes[0]).getByRole('button', { name: 'Bob' }));
    await user.click(screen.getByRole('button', { name: 'Accueil' }));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByRole('heading', { name: "Les 5 langages de l'amour" })).toBeInTheDocument();
  });

  it('efface les deux réponses de l’item précédent au retour arrière', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);
    await repondre(user, 0, 0);
    await user.click(screen.getByRole('button', { name: /Question précédente/ }));

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'question 1 sur 30');
    screen.getAllByRole('group').forEach((carte) => {
      within(carte)
        .getAllByRole('button')
        .forEach((b) => {
          expect(b).toHaveAttribute('aria-pressed', 'false');
        });
    });
  });
});

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
    // On vérifie que chaque score est bien rattaché à sa dimension, pour la bonne personne.
    const profilAlice = screen.getByRole('group', { name: 'Alice' });
    const profilBob = screen.getByRole('group', { name: 'Bob' });
    [profilAlice, profilBob].forEach((profil) => {
      expect(
        within(profil).getByText(texteIntegral('Paroles valorisantes9/12')),
      ).toBeInTheDocument();
      expect(within(profil).getByText(texteIntegral('Moments de qualité7/12'))).toBeInTheDocument();
      expect(within(profil).getByText(texteIntegral('Cadeaux5/12'))).toBeInTheDocument();
      expect(within(profil).getByText(texteIntegral('Contact physique5/12'))).toBeInTheDocument();
      expect(within(profil).getByText(texteIntegral('Services rendus4/12'))).toBeInTheDocument();
    });
  });

  it('attribue les points à la bonne dimension quand l’affichage est inversé', async () => {
    const user = preparer(0.2); // makeOrders() rend 1 partout : chaque item est inversé
    render(<App />);
    await demarrer(user);
    // Affichage inversé : cliquer sur le slot 0 sélectionne options[1], donc la distribution
    // de REPONSES_SECONDE_OPTION (P:3 M:5 C:7 S:8 T:7) pour les deux participants.
    await repondreTout(user, 0, 0);

    const profilAlice = screen.getByRole('group', { name: 'Alice' });
    const profilBob = screen.getByRole('group', { name: 'Bob' });
    [profilAlice, profilBob].forEach((profil) => {
      expect(within(profil).getByText(texteIntegral('Services rendus8/12'))).toBeInTheDocument();
      expect(within(profil).getByText(texteIntegral('Cadeaux7/12'))).toBeInTheDocument();
      expect(within(profil).getByText(texteIntegral('Contact physique7/12'))).toBeInTheDocument();
      expect(within(profil).getByText(texteIntegral('Moments de qualité5/12'))).toBeInTheDocument();
      expect(
        within(profil).getByText(texteIntegral('Paroles valorisantes3/12')),
      ).toBeInTheDocument();
    });
  });

  it('relève la vigilance et les divergences quand les choix s’opposent', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);
    await repondreTout(user, 0, 1);

    await user.click(screen.getByRole('button', { name: 'Vigilance' }));
    // Alice choisit toujours la première proposition (P=9, langage primaire),
    // Bob toujours la seconde (P=3, canal neutre) : c'est bien Alice le besoin fort.
    // { selector: 'p' } : sans lui, le texte intégral du <div> englobant (son seul enfant est
    // ce <p>) matche aussi, et getByText lève une erreur d'ambiguïté sur les deux éléments.
    expect(
      screen.getByText(
        texteIntegral(
          'Alice a un besoin fort de Paroles valorisantes, une dimension peu sensible chez Bob.',
        ),
        { selector: 'p' },
      ),
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Divergences (30)' })).toBeInTheDocument();
  });
});

describe('écran de résultats', () => {
  it('expose l’onglet actif par aria-pressed', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);
    await repondreTout(user, 0, 1);

    expect(screen.getByRole('button', { name: 'Profils' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Vigilance' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await user.click(screen.getByRole('button', { name: 'Vigilance' }));
    expect(screen.getByRole('button', { name: 'Vigilance' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Profils' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
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
      configurable: true,
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

describe('effacement d’une passation en cours', () => {
  it('demande confirmation et respecte l’annulation', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);
    await repondre(user, 0, 0);
    await user.click(screen.getByRole('button', { name: 'Accueil' }));
    await user.click(screen.getByRole('button', { name: 'Commencer' }));

    expect(screen.getByText('Effacer les réponses en cours et recommencer ?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(
      screen.getByRole('button', { name: 'Reprendre où nous en étions (1 / 30)' }),
    ).toBeInTheDocument();
  });

  it('repart de la première question une fois la confirmation donnée', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);
    await repondre(user, 0, 0);
    await user.click(screen.getByRole('button', { name: 'Accueil' }));
    await user.click(screen.getByRole('button', { name: 'Commencer' }));
    await user.click(screen.getByRole('button', { name: 'Oui, effacer' }));

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'question 1 sur 30');
    screen.getAllByRole('group').forEach((carte) => {
      within(carte)
        .getAllByRole('button')
        .forEach((b) => {
          expect(b).toHaveAttribute('aria-pressed', 'false');
        });
    });
  });

  it('démarre sans confirmation quand rien n’est sauvegardé', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'question 1 sur 30');
  });
});

describe('persistance locale', () => {
  it('revient sur l’accueil après un remontage, en proposant la reprise', async () => {
    const user = preparer();
    const vue = render(<App />);
    await demarrer(user);
    await repondre(user, 0, 0);
    await repondre(user, 0, 0);
    vue.unmount();

    render(<App />);
    expect(screen.getByRole('heading', { name: "Les 5 langages de l'amour" })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reprendre où nous en étions (2 / 30)' }),
    ).toBeInTheDocument();
  });

  it('rouvre la question en cours au clic sur la reprise', async () => {
    const user = preparer();
    const vue = render(<App />);
    await demarrer(user);
    await repondre(user, 0, 0);
    await repondre(user, 0, 0);
    vue.unmount();

    render(<App />);
    await user.click(screen.getByRole('button', { name: /Reprendre/ }));

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'question 3 sur 30');
  });

  it('restaure les prénoms saisis après un remontage', async () => {
    const user = preparer();
    const vue = render(<App />);
    await demarrer(user);
    await repondre(user, 0, 0);
    vue.unmount();

    render(<App />);
    expect(screen.getByLabelText('Premier prénom')).toHaveValue('Alice');
    expect(screen.getByLabelText('Second prénom')).toHaveValue('Bob');
  });

  it('propose de revoir le dernier résultat depuis l’accueil', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);
    await repondreTout(user, 0, 0);
    await user.click(screen.getByRole('button', { name: 'Recommencer' }));

    expect(screen.getByRole('button', { name: 'Revoir le dernier résultat' })).toBeInTheDocument();
  });

  it('ramène sur les profils au clic sur « Revoir le dernier résultat »', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);
    await repondreTout(user, 0, 0);
    await user.click(screen.getByRole('button', { name: 'Recommencer' }));
    await user.click(screen.getByRole('button', { name: 'Revoir le dernier résultat' }));

    expect(screen.getByRole('heading', { name: 'Vos deux profils' })).toBeInTheDocument();
  });

  it('efface la sauvegarde quand on relance une passation', async () => {
    const user = preparer();
    render(<App />);
    await demarrer(user);
    await repondreTout(user, 0, 0);
    await user.click(screen.getByRole('button', { name: 'Recommencer' }));
    await user.click(screen.getByRole('button', { name: 'Commencer' }));
    await user.click(screen.getByRole('button', { name: 'Oui, effacer' }));

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'question 1 sur 30');
    screen.getAllByRole('group').forEach((carte) => {
      within(carte)
        .getAllByRole('button')
        .forEach((b) => {
          expect(b).toHaveAttribute('aria-pressed', 'false');
        });
    });
  });
});
