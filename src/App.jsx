import React from 'react';
import {
  DATA,
  DIM_COLOR,
  de,
  OFF_BG,
  OFF_BORDER,
  SEL_BG,
  SEL_BORDER,
  STORAGE_KEY,
} from './questionnaire.js';
import * as scoring from './scoring.js';

const muted = (pct) => `color-mix(in srgb, var(--color-text) ${pct}%, transparent)`;

/**
 * Le questionnaire des 5 langages de l'amour pour deux personnes sur un même appareil :
 * accueil, passation à deux mains item par item, puis comparaison des deux profils.
 * L'état de la passation est conservé en `localStorage`, l'écran courant non : un rechargement
 * repart toujours de l'accueil, qui propose alors de reprendre. « Commencer » efface la
 * sauvegarde, après confirmation lorsqu'une passation est en cours.
 */
export default class App extends React.Component {
  state = {
    screen: 'home',
    nameA: '',
    nameB: '',
    idx: 0,
    answers: [[], []],
    order: [],
    tab: 'profils',
    divIdx: 0,
    copied: false,
    copyText: null,
    confirmReset: false,
  };

  componentDidMount() {
    let saved = null;
    try {
      saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (_e) {
      saved = null;
    }
    if (saved && Array.isArray(saved.answers) && saved.answers.length === 2) {
      this.setState({
        nameA: saved.nameA || '',
        nameB: saved.nameB || '',
        idx: saved.idx || 0,
        answers: [saved.answers[0] || [], saved.answers[1] || []],
        order: saved.order || [],
        tab: saved.tab || 'profils',
        divIdx: saved.divIdx || 0,
      });
    }
  }

  componentDidUpdate() {
    const st = this.state;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          nameA: st.nameA,
          nameB: st.nameB,
          idx: st.idx,
          answers: st.answers,
          order: st.order,
          tab: st.tab,
          divIdx: st.divIdx,
        }),
      );
    } catch (_e) {
      /* quota ou mode privé : la passation continue sans sauvegarde */
    }
  }

  componentWillUnmount() {
    clearTimeout(this._advance);
    clearTimeout(this._copyTimer);
  }

  /** Le nombre d'items où les deux ont répondu : ce qui est réellement reprenable. */
  savedCount() {
    const [a, b] = this.state.answers;
    return Math.min(a.filter(Boolean).length, b.filter(Boolean).length);
  }

  /** « Commencer » efface la sauvegarde : on fait confirmer tant qu'il y a quelque chose à perdre. */
  askStart() {
    if (this.savedCount() > 0) this.setState({ confirmReset: true });
    else this.start();
  }

  start() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (_e) {
      /* ignore */
    }
    this.setState({
      screen: 'quiz',
      idx: 0,
      answers: [[], []],
      order: scoring.makeOrders(),
      tab: 'profils',
      divIdx: 0,
      confirmReset: false,
    });
  }

  resume() {
    const done = scoring.passationTerminee(this.state.answers);
    this.setState({ screen: done ? 'results' : 'quiz' });
  }

  /**
   * Retour à l'accueil depuis la passation, réponses conservées. Le `clearTimeout` est
   * indispensable : sans lui, une avance déjà programmée nous renverrait sur l'item
   * suivant — ou sur les résultats — une fraction de seconde après le retour.
   */
  goHome() {
    clearTimeout(this._advance);
    this.setState({ screen: 'home', confirmReset: false });
  }

  /**
   * Enregistre le choix d'un participant, puis passe à l'item suivant dès que les deux ont répondu.
   * @param {0|1} who
   * @param {0|1} slot position à l'écran de la proposition cliquée
   */
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

  back() {
    if (this.state.idx === 0) return;
    clearTimeout(this._advance);
    const answers = this.state.answers.map((a) => a.slice());
    answers[0][this.state.idx - 1] = null;
    answers[1][this.state.idx - 1] = null;
    this.setState({ answers, idx: this.state.idx - 1 });
  }

  /** Copie la synthèse ; en cas de refus du navigateur, expose le texte à copier à la main. */
  copy() {
    const names = scoring.resolveNames(this.state.nameA, this.state.nameB);
    const text = scoring.summaryText(this.state.answers, names);
    const done = () => {
      this.setState({ copied: true, copyText: null });
      clearTimeout(this._copyTimer);
      this._copyTimer = setTimeout(() => this.setState({ copied: false }), 2200);
    };
    const legacy = () => {
      let ok = false;
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, text.length);
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (_e) {
        ok = false;
      }
      if (ok) done();
      else this.setState({ copyText: text, copied: false });
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done, legacy);
    } else {
      legacy();
    }
  }

  renderHome() {
    const st = this.state;
    const total = DATA.items.length;
    const savedCount = this.savedCount();
    const savedDone = scoring.passationTerminee(st.answers);
    const consignes = [
      "Chacun répond pour lui-même, sans se laisser influencer par l'autre.",
      "Le choix est binaire et obligatoire. En cas d'hésitation, tranchez pour ce qui vous manquerait le plus.",
      'Le dépouillement se lit ensemble, à la fin, devant le même écran.',
    ];
    return (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 20,
          animation: 'lqFade .3s ease',
        }}
      >
        <div>
          <p
            style={{
              fontSize: 11,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: muted(50),
              margin: '0 0 10px',
            }}
          >
            Questionnaire à choix forcés
          </p>
          <h1
            style={{
              fontSize: 'clamp(26px, 7.5vw, 34px)',
              lineHeight: 1.08,
              letterSpacing: '-.02em',
              margin: '0 0 10px',
            }}
          >
            Les 5 langages de l'amour
          </h1>
          <p style={{ fontSize: 14, color: muted(75), margin: 0 }}>
            30 paires, une par écran. Vous répondez tous les deux sur le même appareil, puis les
            profils sont comparés. Vos réponses restent sur cet appareil, rien n'est envoyé.
          </p>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {consignes.map((t, i) => (
            <div key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span
                style={{
                  flex: 'none',
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: '1px solid var(--color-accent-600)',
                  color: 'var(--color-accent-300)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 11,
                }}
              >
                {i + 1}
              </span>
              <p style={{ margin: 0, fontSize: 13.5, color: muted(82) }}>{t}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label htmlFor="lq-a">Premier prénom</label>
            <input
              className="input"
              id="lq-a"
              type="text"
              autoComplete="off"
              placeholder="Prénom"
              value={st.nameA}
              onChange={(e) => this.setState({ nameA: e.target.value })}
              style={{ minHeight: 46, fontSize: 16 }}
            />
          </div>
          <div className="field">
            <label htmlFor="lq-b">Second prénom</label>
            <input
              className="input"
              id="lq-b"
              type="text"
              autoComplete="off"
              placeholder="Prénom"
              value={st.nameB}
              onChange={(e) => this.setState({ nameB: e.target.value })}
              style={{ minHeight: 46, fontSize: 16 }}
            />
          </div>
        </div>

        {st.confirmReset ? (
          <div>
            <p style={{ margin: '0 0 10px', fontSize: 14, color: muted(82) }}>
              Effacer les réponses en cours et recommencer ?
            </p>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => this.start()}
              style={{ minHeight: 50, fontSize: 16, margin: 0 }}
            >
              Oui, effacer
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => this.setState({ confirmReset: false })}
              style={{ minHeight: 46, fontSize: 14, margin: '8px 0 0' }}
            >
              Annuler
            </button>
          </div>
        ) : (
          <div>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => this.askStart()}
              disabled={!st.nameA.trim() || !st.nameB.trim()}
              style={{ minHeight: 50, fontSize: 16, margin: 0 }}
            >
              Commencer
            </button>
            {savedCount > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => this.resume()}
                style={{ minHeight: 46, fontSize: 14, margin: '8px 0 0' }}
              >
                {savedDone
                  ? 'Revoir le dernier résultat'
                  : `Reprendre où nous en étions (${savedCount} / ${total})`}
              </button>
            )}
            <p style={{ fontSize: 12, color: muted(48), margin: '10px 0 0' }}>
              Vos réponses sont conservées sur cet appareil. « Commencer » les efface.
            </p>
          </div>
        )}
      </div>
    );
  }

  renderQuiz() {
    const st = this.state;
    const names = scoring.resolveNames(this.state.nameA, this.state.nameB);
    const total = DATA.items.length;
    const item = DATA.items[st.idx];
    const flipped = st.order[st.idx] === 1;
    const shown = flipped ? [item.options[1], item.options[0]] : [item.options[0], item.options[1]];
    const selA = st.answers[0][st.idx]
      ? scoring.slotFor(st.answers[0][st.idx], item, flipped)
      : null;
    const selB = st.answers[1][st.idx]
      ? scoring.slotFor(st.answers[1][st.idx], item, flipped)
      : null;

    const chip = (sel, slot, who) => (
      <button
        className="lq-chip"
        type="button"
        aria-pressed={sel === slot}
        onClick={() => this.pick(who, slot)}
        style={{
          border: `1px solid ${sel === slot ? SEL_BORDER : OFF_BORDER}`,
          background: sel === slot ? SEL_BG : OFF_BG,
        }}
      >
        {sel === slot && <span aria-hidden="true">✓ </span>}
        {names[who]}
      </button>
    );

    let waiting = '';
    if (selA !== null && selB === null) waiting = `En attente ${de(names[1])}${names[1]}`;
    else if (selB !== null && selA === null) waiting = `En attente ${de(names[0])}${names[0]}`;

    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
              margin: '0 0 8px',
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 400,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: muted(55),
              }}
            >
              Chacun choisit sa proposition
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontVariantNumeric: 'tabular-nums',
                color: muted(60),
              }}
            >
              {st.idx + 1} / {total}
            </p>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={st.idx}
            aria-valuetext={`question ${st.idx + 1} sur ${total}`}
            style={{ height: 3, borderRadius: 2, background: muted(12), overflow: 'hidden' }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.round((st.idx / total) * 100)}%`,
                background: 'var(--color-accent)',
                transition: 'width .3s ease',
              }}
            />
          </div>
        </div>

        <div
          key={st.idx}
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 18,
            animation: 'lqFade .22s ease',
          }}
        >
          {shown.map((opt, slot) => {
            const labelId = `lq-opt-${st.idx}-${slot}`;
            return (
              <fieldset
                key={opt.code}
                aria-labelledby={labelId}
                style={{
                  margin: 0,
                  minInlineSize: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-divider)',
                  borderLeft: `3px solid ${DIM_COLOR[opt.code]}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: 18,
                }}
              >
                <p
                  id={labelId}
                  style={{
                    margin: 0,
                    fontSize: 'clamp(16px, 4.3vw, 18px)',
                    lineHeight: 1.45,
                    textWrap: 'pretty',
                  }}
                >
                  {opt.texte}
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  {chip(selA, slot, 0)}
                  {chip(selB, slot, 1)}
                </div>
              </fieldset>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            minHeight: 40,
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            {st.idx > 0 && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => this.back()}
                style={{ minHeight: 40, fontSize: 13 }}
              >
                ← Question précédente
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => this.goHome()}
              style={{ minHeight: 40, fontSize: 13 }}
            >
              Accueil
            </button>
          </div>
          <p role="status" style={{ margin: 0, fontSize: 12, color: muted(45) }}>
            {waiting}
          </p>
        </div>
      </div>
    );
  }

  renderResults() {
    const st = this.state;
    const names = scoring.resolveNames(this.state.nameA, this.state.nameB);
    const vig = scoring.vigilanceList(st.answers, names);
    const div = scoring.divergenceList(st.answers, names);
    const dc = div[Math.min(st.divIdx, Math.max(div.length - 1, 0))] || null;

    const tab = (name, label) => (
      <button
        className="lq-tab"
        type="button"
        aria-pressed={st.tab === name}
        onClick={() => this.setState({ tab: name })}
        style={{
          border: `1px solid ${st.tab === name ? 'var(--color-accent-600)' : 'var(--color-divider)'}`,
          background:
            st.tab === name
              ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)'
              : 'transparent',
        }}
      >
        {label}
      </button>
    );

    return (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          animation: 'lqFade .3s ease',
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, margin: '0 0 2px' }}>Vos deux profils</h1>
          <p style={{ fontSize: 12.5, color: muted(58), margin: 0 }}>
            Scores sur 12, 30 choix répartis entre les cinq dimensions.
          </p>
        </div>

        {/* biome-ignore lint/a11y/useSemanticElements: trois boutons de changement de vue, pas des champs de formulaire — un <fieldset> sans contrôle dedans serait sémantiquement faux */}
        <div role="group" aria-label="Vue des résultats" style={{ display: 'flex', gap: 6 }}>
          {tab('profils', 'Profils')}
          {tab('vigilance', 'Vigilance')}
          {tab('divergences', `Divergences (${div.length})`)}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {st.tab === 'profils' && (
            <div style={{ display: 'grid', gap: 12 }}>
              {[0, 1].map((who) => (
                <fieldset
                  key={who}
                  aria-labelledby={`lq-profil-${who}`}
                  style={{
                    margin: 0,
                    minInlineSize: 0,
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-divider)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '14px 16px 12px',
                  }}
                >
                  <h3 id={`lq-profil-${who}`} style={{ fontSize: 17, margin: '0 0 12px' }}>
                    {names[who]}
                  </h3>
                  <div style={{ display: 'grid', gap: 11 }}>
                    {scoring.profileRows(this.state.answers[who]).map((d) => (
                      <div key={d.code}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                            gap: 10,
                          }}
                        >
                          <span style={{ fontSize: 14 }}>{d.nom}</span>
                          <span
                            style={{
                              fontSize: 13,
                              fontVariantNumeric: 'tabular-nums',
                              color: muted(68),
                            }}
                          >
                            {d.score}/12
                          </span>
                        </div>
                        <div
                          style={{
                            height: 7,
                            borderRadius: 4,
                            background: muted(10),
                            overflow: 'hidden',
                            margin: '6px 0 4px',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${d.pct}%`,
                              background: d.color,
                              borderRadius: 4,
                            }}
                          />
                        </div>
                        <p style={{ margin: 0, fontSize: 11.5, color: muted(58) }}>{d.niveau}</p>
                      </div>
                    ))}
                  </div>
                  <p
                    style={{
                      margin: '12px 0 0',
                      paddingTop: 9,
                      borderTop: '1px solid var(--color-divider)',
                      fontSize: 11.5,
                      color: muted(55),
                    }}
                  >
                    Contrôle : {st.answers[who].filter(Boolean).length}/30
                  </p>
                </fieldset>
              ))}
            </div>
          )}

          {st.tab === 'vigilance' && (
            <div
              style={{
                border: '1px solid var(--color-accent-700)',
                background:
                  'linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 12%, transparent), color-mix(in srgb, var(--color-accent) 4%, transparent))',
                borderRadius: 'var(--radius-lg)',
                padding: 16,
              }}
            >
              <p style={{ fontSize: 12, color: muted(60), margin: '0 0 14px' }}>
                Dimensions où l'un est en langage primaire et l'autre en canal neutre.
              </p>
              {vig.length === 0 ? (
                <p style={{ margin: 0, fontSize: 14, color: muted(80) }}>
                  Aucun écart de ce type : personne n'a de langage primaire là où l'autre a un canal
                  neutre.
                </p>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {vig.map((v) => (
                    <p
                      key={v.dim}
                      style={{
                        margin: 0,
                        paddingLeft: 12,
                        borderLeft: `3px solid ${v.color}`,
                        fontSize: 14,
                        textWrap: 'pretty',
                      }}
                    >
                      <strong style={{ fontWeight: 600 }}>{v.strong}</strong> a un besoin fort de{' '}
                      <em>{v.dim}</em>, une dimension peu sensible chez{' '}
                      <strong style={{ fontWeight: 600 }}>{v.weak}</strong>.
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {st.tab === 'divergences' &&
            (dc ? (
              <div>
                <div
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-divider)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '14px 16px',
                  }}
                >
                  <p
                    style={{
                      margin: '0 0 12px',
                      fontSize: 11,
                      letterSpacing: '.1em',
                      textTransform: 'uppercase',
                      color: muted(45),
                    }}
                  >
                    Item {dc.id}
                  </p>
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div style={{ paddingLeft: 12, borderLeft: `3px solid ${dc.colorA}` }}>
                      <p style={{ margin: '0 0 4px', fontSize: 12.5, color: dc.colorA }}>
                        {dc.nameA} · {dc.dimA}
                      </p>
                      <p style={{ margin: 0, fontSize: 14.5, textWrap: 'pretty' }}>{dc.textA}</p>
                    </div>
                    <div style={{ paddingLeft: 12, borderLeft: `3px solid ${dc.colorB}` }}>
                      <p style={{ margin: '0 0 4px', fontSize: 12.5, color: dc.colorB }}>
                        {dc.nameB} · {dc.dimB}
                      </p>
                      <p style={{ margin: 0, fontSize: 14.5, textWrap: 'pretty' }}>{dc.textB}</p>
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginTop: 10,
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() =>
                      this.setState({ divIdx: (st.divIdx - 1 + div.length) % div.length })
                    }
                    style={{ minHeight: 40, fontSize: 13 }}
                  >
                    ‹ Précédent
                  </button>
                  <span
                    style={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: muted(55) }}
                  >
                    {Math.min(st.divIdx, div.length - 1) + 1} / {div.length}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => this.setState({ divIdx: (st.divIdx + 1) % div.length })}
                    style={{ minHeight: 40, fontSize: 13 }}
                  >
                    Suivant ›
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 14, color: muted(80) }}>
                Aucune divergence : vous avez choisi la même proposition sur les 30 items.
              </p>
            ))}
        </div>

        {st.copyText && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 12, color: muted(60) }}>
              Copie automatique refusée par le navigateur. Sélectionnez le texte ci-dessous puis
              copiez-le.
            </p>
            <textarea
              className="input"
              readOnly
              aria-label="Synthèse à copier manuellement"
              value={st.copyText}
              onFocus={(e) => e.target.select()}
              style={{ minHeight: 160, fontSize: 12, lineHeight: 1.45 }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => this.setState({ copyText: null })}
              style={{ minHeight: 40, fontSize: 13 }}
            >
              Fermer
            </button>
          </div>
        )}

        <p role="status" className="sr-only">
          {st.copied ? 'Résultat copié dans le presse-papiers' : ''}
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => this.copy()}
            style={{ flex: 1, minHeight: 44, fontSize: 13 }}
          >
            {st.copied ? 'Résultat copié' : 'Copier le résultat'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => this.setState({ screen: 'home', copied: false, copyText: null })}
            style={{ flex: 1, minHeight: 44, fontSize: 13 }}
          >
            Recommencer
          </button>
        </div>
      </div>
    );
  }

  render() {
    const { screen } = this.state;
    return (
      <div
        style={{
          height: '100dvh',
          overflow: 'hidden',
          background: 'radial-gradient(120% 70% at 50% -10%, #1c1f31 0%, var(--color-bg) 60%)',
          fontFamily: 'var(--font-body)',
          fontSize: 16,
          lineHeight: 1.5,
          padding: '16px 16px 14px',
          display: 'flex',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 540,
            margin: '0 auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {screen === 'home' && this.renderHome()}
          {screen === 'quiz' && this.renderQuiz()}
          {screen === 'results' && this.renderResults()}
        </div>
      </div>
    );
  }
}
