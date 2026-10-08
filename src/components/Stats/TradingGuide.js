import React from 'react';

// How a harmonic setup is played - the same rules the simulation uses
const TradingGuide = () => (
  <details className="stats-method guide">
    <summary>Jak rozgrywać setup (long / short, kiedy czekać)</summary>

    <p className="guide-note">
      To opis reguł, według których backend symuluje transakcje - nie rekomendacja inwestycyjna.
      Zanim potraktujesz formację poważnie, sprawdź jej Avg R w tabeli powyżej.
    </p>

    <h4>Buy i sell w longu i shorcie</h4>
    <table className="guide-table">
      <thead>
        <tr><th /><th>Otwarcie</th><th>Zamknięcie z zyskiem (TP)</th><th>Zamknięcie ze stratą (SL)</th></tr>
      </thead>
      <tbody>
        <tr><td><strong className="bull">Long</strong> (formacja bycza)</td><td><strong>buy</strong></td><td><strong>sell</strong> wyżej</td><td><strong>sell</strong> niżej</td></tr>
        <tr><td><strong className="bear">Short</strong> (formacja niedźwiedzia)</td><td><strong>sell</strong></td><td><strong>buy</strong> niżej</td><td><strong>buy</strong> wyżej</td></tr>
      </tbody>
    </table>

    <h4>Cykl życia setupu</h4>
    <ol className="guide-steps">
      <li>
        <strong>Wykrycie - status <span className="st waiting">waiting</span> → czekasz.</strong>{' '}
        X-A-B-C są znane, PRZ wyznaczona, cena jeszcze do niej nie doszła. Formacja bycza ma PRZ <em>pod</em> ceną
        (czekasz, aż cena zejdzie), niedźwiedzia <em>nad</em> ceną (czekasz, aż cena podejdzie od dołu).
      </li>
      <li>
        <strong>Cena dotyka bliższej krawędzi PRZ → wejście, status <span className="st open">open</span>.</strong>{' '}
        Long: <strong>buy na górnej krawędzi</strong> PRZ (pierwsza, do której dochodzi spadająca cena).
        Short: <strong>sell na dolnej krawędzi</strong> PRZ (pierwsza, do której dochodzi rosnąca cena).
        Na wykresie: strzałka ↑ (long) / ↓ (short).
      </li>
      <li>
        <strong>Od razu SL i TP.</strong>{' '}
        SL po drugiej stronie PRZ (long - pod strefą, short - nad strefą): jeśli cena przebije całą strefę, formacja nie zadziałała.
        TP1 w kierunku ruchu; w symulacji cała pozycja zamyka się na TP1.
        Dokładne ceny SL / TP1 / TP2 zobaczysz po najechaniu na PRZ na wykresie (SETUPS).
      </li>
      <li>
        <strong>Rozstrzygnięcie.</strong>
        <ul>
          <li><span className="st win">win</span> - cena doszła do TP1 (long: sprzedajesz, short: odkupujesz), np. +1.6R.</li>
          <li><span className="st loss">loss</span> - zadziałał SL, −1R.</li>
          <li><span className="st expired">expired</span> - ani TP, ani SL w limicie czasu, zamknięcie po rynku.</li>
          <li><span className="st no_entry">no entry</span> - cena nie doszła do PRZ, nie było transakcji.</li>
          <li><span className="st invalidated">invalidated</span> - struktura złamana przed wejściem, nie było transakcji.</li>
        </ul>
      </li>
    </ol>

    <h4>Kiedy czekać, kiedy odpuścić</h4>
    <ul className="guide-list">
      <li><strong>Czekasz</strong>, dopóki setup jest <em>waiting</em> - cena jeszcze nie w PRZ.</li>
      <li><strong>Odpuszczasz</strong> setupy <em>no entry</em> i <em>invalidated</em> - nie ma już czego grać.</li>
      <li><strong>Nie gonisz ceny</strong> - jeśli cena przeszła już przez krawędź PRZ i jest blisko SL, stosunek zysku do ryzyka jest gorszy niż w regule.</li>
      <li><strong>Patrzysz na Avg R netto</strong> (kolumna z kalkulatora), nie na sam win rate, i tylko w grupach z dużą liczbą transakcji (wąski przedział ufności).</li>
    </ul>

    <h4>Wielkość pozycji</h4>
    <p>
      Ustalasz ryzyko na transakcję (np. 1% kapitału = 1R). Wielkość pozycji wynika z odległości do SL:{' '}
      <code>pozycja = kwota ryzyka / |wejście − SL|</code>. Przykład: kapitał 1000 $, ryzyko 1% = 10 $, short BTC z wejściem
      83 000 i SL 84 000 → pozycja 0,01 BTC (≈ 830 $). Gdy zadziała SL, tracisz 10 $, a nie 830 $.
      Przy win rate 35–40% serie 6–8 strat z rzędu są normalne - dlatego zwykle ryzykuje się 0,5–2% na transakcję.
    </p>
  </details>
);

export default TradingGuide;
