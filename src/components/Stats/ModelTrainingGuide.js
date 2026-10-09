import React, { useEffect, useState } from 'react';

const OPEN_KEY = 'dashboards.model.guideOpen';
const MIN_SAMPLES = 200;

// Weekly fit: every Sunday 04:00 UTC (backend cron "Weekly pattern strength model fit")
export const nextWeeklyFit = (now = new Date()) => {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 4, 0, 0));
  const daysToSunday = (7 - d.getUTCDay()) % 7;
  d.setUTCDate(d.getUTCDate() + daysToSunday);
  if (d <= now) d.setUTCDate(d.getUTCDate() + 7);
  return d;
};

/**
 * How the strength model learns and what makes it better - shown on the model dashboard.
 * `decided` = resolved setups (win + loss + expired) in the training data, when known.
 */
const ModelTrainingGuide = ({ decided }) => {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(OPEN_KEY) !== 'false'; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem(OPEN_KEY, String(open)); } catch { /* not remembered */ }
  }, [open]);

  const next = nextWeeklyFit();
  const enough = decided == null ? null : decided >= MIN_SAMPLES;

  return (
    <section className="sm-card sm-guide">
      <button type="button" className="sm-guide-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{open ? '▾' : '▸'}</span>
        <span className="sm-card-title">Jak uczy się model i jak go poprawić</span>
        <span className="sm-guide-next">
          najbliższe automatyczne uczenie: <strong>{next.toLocaleString([], { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong>
        </span>
      </button>

      {open && (
        <div className="sm-guide-body">
          <div className="sm-guide-answer">
            <strong>Czy wystarczy wygenerować nowe formacje i kliknąć „Naucz teraz”? Nie.</strong>{' '}
            Model nie uczy się na formacjach ze skanu wykresu (SCAN) ani z ręcznego XABCD. Uczy się wyłącznie
            na <em>rozstrzygniętych setupach śledzonych assetów</em> - takich, które weszły w PRZ i skończyły się
            wygraną, przegraną albo wygasły. „Naucz teraz” tylko przelicza model na danych, które już są.
          </div>

          <div className="sm-guide-cols">
            <div>
              <h4>Skąd biorą się dane uczące</h4>
              <ol>
                <li>
                  <strong>Śledzone assety</strong> (zakładka „Alerty i śledzone assety” → Tracked assets): ich setupy są
                  aktualizowane co godzinę i z czasem same się rozstrzygają.
                </li>
                <li>
                  <strong>Backfill</strong>: dodanie assetu albo interwału przelicza od razu jego historię
                  (domyślnie 5000 świec). To najszybszy sposób na dużo nowych danych.
                </li>
                <li>
                  Do uczenia trafiają setupy ze statusem <span className="st win">win</span>,{' '}
                  <span className="st loss">loss</span> i <span className="st expired">expired</span> z wejściem.
                  Setupy <em>waiting</em>, <em>open</em>, <em>no entry</em> i <em>invalidated</em> nie uczą.
                </li>
              </ol>

              <h4>Kiedy model się uczy</h4>
              <ul>
                <li><strong>Automatycznie</strong> w każdą niedzielę o 04:00 UTC (cron „Weekly pattern strength model fit”).</li>
                <li><strong>Ręcznie</strong> przyciskiem „Naucz teraz” (tylko admin).</li>
                <li>
                  Każde uczenie tworzy oba modele (pełny i wstępny) i od razu je aktywuje. Poprzednie zostają w historii
                  (20 ostatnich) - widać je w tabeli i na wykresie AUC.
                </li>
              </ul>
            </div>

            <div>
              <h4>Kiedy warto kliknąć „Naucz teraz”</h4>
              <ul>
                <li>po dodaniu nowych assetów lub interwałów i zakończeniu ich backfillu,</li>
                <li>po wyraźnym przyroście rozstrzygniętych setupów (wykres „Dane uczące” poniżej),</li>
                <li>nie ma sensu po samym skanowaniu wykresu - te formacje nie trafiają do danych.</li>
              </ul>

              <h4>Warunki i pułapki</h4>
              <ul>
                <li>
                  Potrzeba co najmniej <strong>{MIN_SAMPLES}</strong> rozstrzygniętych setupów - inaczej uczenie kończy się
                  błędem i aktywny zostaje poprzedni model.
                  {decided != null && (
                    <span className={`sm-guide-count ${enough ? 'ok' : 'low'}`}>
                      {' '}Teraz w danych: {decided.toLocaleString()} {enough ? '✓' : `(brakuje ${MIN_SAMPLES - decided})`}
                    </span>
                  )}
                </li>
                <li>
                  Metryki liczone są uczciwie: model uczy się na 70% najstarszych setupów i jest sprawdzany na 30%
                  najnowszych, których nie widział. Model produkcyjny jest potem uczony na całości.
                </li>
                <li>Cechy, które wystąpiły mniej niż 30 razy, są pomijane jako szum.</li>
                <li>
                  <strong>Zmiana reguł symulacji setupów</strong> (wersja reguł / params_version) otwiera nową serię
                  danych od zera. Trzeba ją wypełnić backfillem; do tego czasu działa poprzedni model.
                </li>
              </ul>

              <h4>Jak ocenić, czy model jest lepszy</h4>
              <ul>
                <li><strong>AUC</strong>: 0.5 = zgadywanie, powyżej ~0.6 model zaczyna być użyteczny.</li>
                <li><strong>Kwintyle</strong>: win rate i średnie R powinny rosnąć od Q1 do Q5.</li>
                <li><strong>Kalibracja</strong>: punkty blisko przekątnej = podawane p_win są wiarygodne.</li>
                <li>Model <em>wstępny</em> uczy się na tych samych setupach, ale tylko z cech znanych przed wejściem (poziomy S/R, trendline, Fibo, wyższe TF, pivot, round level, volume profile) plus typ formacji, interwał, wielkość i proporcje struktury - dlatego zwykle ma niższe AUC.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ModelTrainingGuide;
