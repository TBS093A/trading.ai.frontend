import React, { useEffect, useState } from 'react';

const OPEN_KEY = 'dashboards.benchmarks.guideOpen';

// What the benchmark measures and how to read it - shown on the benchmarks dashboard
const BenchmarksGuide = () => {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(OPEN_KEY) !== 'false'; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem(OPEN_KEY, String(open)); } catch { /* not remembered */ }
  }, [open]);

  return (
    <section className="sm-card sm-guide">
      <button type="button" className="sm-guide-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{open ? '▾' : '▸'}</span>
        <span className="sm-card-title">Co mierzy benchmark i jak go czytać</span>
      </button>

      {open && (
        <div className="sm-guide-body">
          <div className="sm-guide-answer">
            <strong>Każdy wariant gra dokładnie te same setupy</strong> (te same pary, ten sam okres, X..C i PRZ znane
            w chwili t). Różnią się tylko tym, <em>kiedy wchodzą</em> i <em>jak prowadzą pozycję</em>. Dzięki temu różnica
            w wynikach to efekt reguły, a nie innego zestawu formacji. Punkt odniesienia to <strong>baseline</strong> -
            dokładnie to, co dziś liczą statystyki i alerty.
          </div>

          <div className="sm-guide-cols">
            <div>
              <h4>Elementy wariantów</h4>
              <ul>
                <li><strong>dotknięcie PRZ</strong> (baseline) - wejście, gdy cena dotknie bliższej krawędzi PRZ.</li>
                <li>
                  <strong>potwierdzenie</strong> - po dotknięciu czekamy najwyżej 3 świece na świecę odwrócenia
                  (bullish: wzrostowa, zamknięta powyżej dolnej krawędzi PRZ; bearish lustrzanie) i wchodzimy po jej
                  zamknięciu. SL za ekstremum od dotknięcia.
                </li>
                <li><strong>SL na wejście po +1R</strong> (breakeven) - gdy pozycja zyska 1R, SL przesuwa się na cenę wejścia.</li>
                <li><strong>TP1 najwyżej 2R / 1.5R</strong> - bliższy cel: częściej trafia, ale mniej zarabia na transakcji.</li>
                <li><strong>siła ≥ 60 / 80</strong> - tylko setupy z siłą (percentyl modelu) co najmniej tyle w chwili wejścia.</li>
                <li>
                  <strong>EV ≥ 0</strong> - tylko setupy z dodatnią wartością oczekiwaną: p_win × R:R − (1 − p_win) ≥ 0.
                </li>
              </ul>

              <h4>In, out i cutoff</h4>
              <ul>
                <li>
                  Na potrzeby benchmarku model siły jest uczony <strong>tylko na danych sprzed cutoff</strong>.
                  Transakcje po cutoff (<strong>out</strong>) są dla niego nowe - to uczciwy test.
                </li>
                <li>
                  W okresie <strong>in</strong> warianty z siłą/EV oceniają setupy, które model już widział, więc ich
                  wyniki są zawyżone. Warianty bez siły są uczciwe w obu okresach.
                </li>
                <li>Na wykresie kapitału cutoff to pionowa przerywana linia.</li>
              </ul>
            </div>

            <div>
              <h4>Kolumny</h4>
              <ul>
                <li><strong>Trades</strong> - liczba transakcji. Poniżej ~100 wyniki są mało pewne.</li>
                <li>
                  <strong>Win rate (95% CI)</strong> - odsetek transakcji zamkniętych na TP1, pod spodem zakres, w którym
                  z 95% pewnością leży prawdziwa wartość.
                </li>
                <li>
                  <strong>Avg R (95% CI)</strong> - średni wynik na transakcję w R (1R = ryzyko do SL). To najważniejsza
                  kolumna: powyżej 0 wariant zarabia. Jeśli cały przedział CI jest powyżej 0, wynik jest pewny.
                </li>
                <li><strong>Total R</strong> - suma R; zależy też od liczby transakcji, więc nie porównuj tylko jej.</li>
                <li><strong>Max DD</strong> - największe obsunięcie kapitału w R po drodze: ile trzeba było przetrwać.</li>
              </ul>

              <h4>Jak wybrać wariant</h4>
              <ul>
                <li>Patrz na okres <strong>out</strong> i porównuj z baseline.</li>
                <li>Szukaj wyższego <strong>avg R</strong> przy co najmniej ~100 transakcjach i jak najwęższym CI - ★ oznacza najlepszy taki wariant.</li>
                <li>Przy podobnym avg R wybierz mniejszy max DD.</li>
                <li>Filtry (siła, EV) zwykle zmniejszają liczbę transakcji - mniej okazji, ale lepsza jakość.</li>
              </ul>

              <h4>Założenia i uruchamianie</h4>
              <ul>
                <li>Konserwatywnie: SL i TP w tej samej świecy liczy się jako SL; pozycja wygasa po 2 × rozpiętość X..C.</li>
                <li>Brak prowizji i poślizgu - odejmij je samodzielnie (kalkulator w „Skuteczność formacji”).</li>
                <li>
                  Raport liczą workery w tle dla każdej pary (asset × interwał). „Świec na parę” ustala, jak długą
                  historię przeliczyć - więcej świec to więcej transakcji, ale dłuższe liczenie.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default BenchmarksGuide;
