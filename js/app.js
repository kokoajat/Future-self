/* Tuleva minä – sovelluslogiikka (ei riippuvuuksia, tallennus localStorageen) */
(function () {
  'use strict';
  const C = window.CONTENT;
  const KEY = 'tulevaMina.v1';
  const $main = document.getElementById('main');
  const $nav = document.getElementById('bottomnav');
  const $top = document.getElementById('topbar-right');
  const $toast = document.getElementById('toast');

  /* ---------- Apuvälineet ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const todayISO = () => toISO(new Date());
  const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const diffDays = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);
  const fmtDate = (iso) => fromISO(iso).toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'short' });
  const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
  const nl2br = (s) => esc(s).replace(/\n/g, '<br>');
  let toastTimer;
  const toast = (msg) => { $toast.textContent = msg; $toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $toast.hidden = true; }, 2600); };

  /* ---------- Tila ---------- */
  const defaults = () => ({
    version: 1, name: '', areas: [], anchor: { cue: '', action: '' }, letter: '', letterAppendix: [],
    why: '', startDate: null, reminder: '', theme: 'auto', days: {}, seed: Math.floor(Math.random() * 1e9), notifiedOn: null, comebackShownOn: null,
  });
  let S = load();
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return Object.assign(defaults(), JSON.parse(raw)); } catch (e) { /* tyhjä tai rikki */ }
    return defaults();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Tallennus epäonnistui (selaimen tallennustila).'); } }

  /* ---------- Ohjelman laskenta ---------- */
  const N = C.PROGRAM_DAYS;
  function currentDay() { if (!S.startDate) return 0; return diffDays(S.startDate, todayISO()) + 1; }
  const clampDay = (n) => Math.max(1, n);
  const contentIndex = (n) => ((clampDay(n) - 1) % N); // 66 jälkeen kierretään
  const isExtension = (n) => n > N;
  const phaseOf = (n) => C.PHASES.find((p) => contentIndex(n) + 1 >= p.from && contentIndex(n) + 1 <= p.to);
  const isWeekly = (n) => n % 7 === 0;
  function areaForDay(n) {
    if (!S.areas.length) return null;
    return S.areas[(clampDay(n) - 1) % S.areas.length];
  }
  function areaAction(n) {
    const a = areaForDay(n); if (!a) return null;
    const pool = C.AREA_ACTIONS[a]; const off = hash(S.seed + a) % pool.length;
    const round = Math.floor((clampDay(n) - 1) / S.areas.length);
    return { area: C.AREAS.find((x) => x.id === a), text: pool[(off + round) % pool.length] };
  }
  function dayItems(n) {
    const d = C.DAYS[contentIndex(n)];
    const items = [];
    if (S.anchor.action) items.push({ id: 'anchor', label: 'Ankkuriteko', text: `Kun ${S.anchor.cue || '…'}, niin ${S.anchor.action}.`, meta: 'Sama teko, sama tilanne, joka päivä' });
    items.push({ id: 'main', label: 'Päivän teko', text: d.action, meta: `~${d.minutes} min` });
    const aa = areaAction(n); if (aa) items.push({ id: 'area', label: `${aa.area.emoji} ${aa.area.name}`, text: aa.text, meta: 'Painopistealueesi teko' });
    return items;
  }
  const rec = (n) => S.days[n] || (S.days[n] = { done: {}, note: '', auto: 0, review: {} });
  const dayDone = (n) => { const r = S.days[n]; return r ? Object.values(r.done).filter(Boolean).length : 0; };
  const dayTotal = (n) => dayItems(n).length;
  function streak() {
    const today = currentDay(); if (today < 1) return 0;
    let s = 0; let n = dayDone(today) > 0 ? today : today - 1;
    while (n >= 1 && dayDone(n) > 0) { s++; n--; }
    return s;
  }
  function stats() {
    const today = Math.min(currentDay(), 100000);
    let active = 0, acts = 0, full = 0; const autos = [];
    for (let n = 1; n <= today; n++) { const d = dayDone(n); if (d > 0) active++; acts += d; if (d >= dayTotal(n)) full++; if (S.days[n]?.auto) autos.push(S.days[n].auto); }
    const recentAuto = autos.slice(-7); const avgAuto = recentAuto.length ? recentAuto.reduce((a, b) => a + b, 0) / recentAuto.length : 0;
    return { active, acts, full, streak: streak(), avgAuto, missed: Math.max(0, today - 1 - activeBefore(today)) };
    function activeBefore(t) { let a = 0; for (let n = 1; n < t; n++) if (dayDone(n) > 0) a++; return a; }
  }

  /* ---------- Reititys ---------- */
  let view = 'today'; let viewArg = null;
  function go(v, arg) { view = v; viewArg = arg ?? null; render(); window.scrollTo({ top: 0 }); }
  $nav.addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) go(b.dataset.view); });
  function setNav() {
    $nav.hidden = !S.startDate;
    $nav.querySelectorAll('.navbtn').forEach((b) => { if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  }
  function applyTheme() { const r = document.documentElement; if (S.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', S.theme); }

  function render() {
    applyTheme(); setNav();
    if (!S.startDate) { $top.innerHTML = ''; return renderOnboarding(); }
    const n = currentDay();
    $top.innerHTML = `<span class="pill">Päivä ${n}${isExtension(n) ? ' · jatko' : ' / ' + N}</span>${streak() > 1 ? `<span class="pill accent">🔥 ${streak()}</span>` : ''}`;
    ({ today: renderToday, progress: renderProgress, letter: renderLetter, research: renderResearch, settings: renderSettings, day: renderDayDetail }[view] || renderToday)();
  }

  /* ---------- Perehdytys ---------- */
  let ob = { step: 0, name: '', areas: [], cue: '', action: '', letter: '', why: '', reminder: '20:00' };
  const ANCHOR_EXAMPLES = [
    { cue: 'olen laittanut aamukahvin tippumaan', action: 'kirjoitan yhden lauseen tulevalle itselleni' },
    { cue: 'istun bussiin', action: 'luen kaksi sivua' },
    { cue: 'olen pessyt hampaat illalla', action: 'laitan huomisen vaatteet esille' },
    { cue: 'suljen työkoneen', action: 'kirjoitan huomisen tärkeimmän tehtävän' },
    { cue: 'tulen kotiin', action: 'laitan puhelimen laturiin toiseen huoneeseen' },
  ];
  function renderOnboarding() {
    const steps = 5; const bar = `<div class="steps">${Array.from({ length: steps }, (_, i) => `<i class="${i <= ob.step ? 'on' : ''}"></i>`).join('')}</div>`;
    let html = '';
    if (ob.step === 0) html = `
      <section class="hero"><h1>Priorisoi tulevan itsesi tarpeet.</h1>
        <p class="muted">Tuleva minä on tutkimukseen perustuva ${N} päivän ohjelma. Opit tavan, jossa päivän pienet valinnat tehdään sen ihmisen hyväksi, joka olet huomenna, vuoden ja kymmenen vuoden päästä.</p></section>
      <div class="card">
        <h2>Miksi ${N} päivää?</h2>
        <p>Lallyn ja kollegoiden tutkimuksessa (2010) uusi teko muuttui automaattiseksi keskimäärin 66 päivässä, kun sitä toistettiin samassa tilanteessa. Siksi ohjelma kestää vähintään sen verran – ja jatkuu, jos haluat.</p>
        <h2>Mitä teet päivittäin?</h2>
        <ul>
          <li>Luet yhden tutkimukseen perustuvan vinkin.</li>
          <li>Teet 2–3 pientä tekoa tulevan itsesi hyväksi (yhteensä alle 10 minuuttia).</li>
          <li>Arvioit yhdellä napautuksella, kuinka automaattiselta ankkuritekosi jo tuntuu.</li>
        </ul>
        <div class="field"><label for="ob-name">Miksi sinua kutsutaan?</label><input id="ob-name" type="text" value="${esc(ob.name)}" placeholder="Etunimi" autocomplete="given-name"></div>
        <div class="btnrow"><button class="btn primary block" id="ob-next">Aloitetaan</button></div>
        <p class="small muted" style="margin-top:10px">Tiedot tallennetaan vain tähän laitteeseen. Ei tiliä, ei pilveä.</p>
      </div>`;
    if (ob.step === 1) html = `
      <h1>Missä tuleva minä tarvitsee sinua eniten?</h1>
      <p class="muted">Valitse 1–3 aluetta. Saat joka päivä yhden pienen teon näiltä alueilta vuorotellen.</p>
      <div class="card"><div class="chips" id="ob-areas">${C.AREAS.map((a) => `<button class="chip" data-id="${a.id}" aria-pressed="${ob.areas.includes(a.id)}">${a.emoji} ${esc(a.name)}</button>`).join('')}</div>
        <div class="field" style="margin-top:14px"><label for="ob-why">Miksi tämä on sinulle tärkeää juuri nyt?</label><textarea id="ob-why" placeholder="Esim. Haluan, että 40-vuotias minä on terve ja velaton.">${esc(ob.why)}</textarea><div class="hint">Yksi lause riittää. Palaat tähän ohjelman aikana.</div></div>
        <div class="btnrow"><button class="btn ghost" id="ob-back">Takaisin</button><button class="btn primary" id="ob-next" ${ob.areas.length ? '' : 'disabled'}>Jatka</button></div></div>`;
    if (ob.step === 2) html = `
      <h1>Ankkuriteko</h1>
      <p class="muted">Tämä on ohjelman ydin: yksi alle kahden minuutin teko, jonka teet joka päivä samassa tilanteessa. Muotoile se jos–niin-suunnitelmana (Gollwitzer &amp; Sheeran 2006): <em>kun</em> jokin, mitä teet joka päivä jo nyt, <em>niin</em> uusi pieni teko.</p>
      <div class="card">
        <div class="field"><label for="ob-cue">Kun…</label><input id="ob-cue" type="text" value="${esc(ob.cue)}" placeholder="olen laittanut aamukahvin tippumaan"><div class="hint">Vihje, joka toistuu joka päivä samassa paikassa.</div></div>
        <div class="field"><label for="ob-action">…niin</label><input id="ob-action" type="text" value="${esc(ob.action)}" placeholder="kirjoitan yhden lauseen tulevalle itselleni"><div class="hint">Alle 2 minuuttia. Pienempi on parempi – kokoa voi kasvattaa myöhemmin.</div></div>
        <p class="small muted">Esimerkkejä:</p>
        <div class="chips">${ANCHOR_EXAMPLES.map((x, i) => `<button class="chip" data-ex="${i}">Kun ${esc(x.cue)}, niin ${esc(x.action)}</button>`).join('')}</div>
        <div class="btnrow"><button class="btn ghost" id="ob-back">Takaisin</button><button class="btn primary" id="ob-next">Jatka</button></div></div>`;
    if (ob.step === 3) html = `
      <h1>Kirje tulevalle itsellesi</h1>
      <p class="muted">Kirjoita itsellesi, joka lukee tämän päivänä ${N}. Kirje sinetöidään ja avataan silloin. Tutkimuksessa kirjeen kirjoittaminen tulevalle itselle lisäsi terveyskäyttäytymistä jo seuraavina päivinä (Rutchick ym. 2018).</p>
      <div class="card">
        <p class="small">Vinkkejä: Mitä toivot hänen tehneen? Mistä hän olisi ylpeä? Mitä pelkäät hänen unohtaneen? Ole konkreettinen – elävyys vahvistaa yhteyttä (Blouin-Hudon &amp; Pychyl 2015).</p>
        <textarea id="ob-letter" class="letter" placeholder="Hei tuleva minä,&#10;&#10;kun luet tätä, on kulunut ${N} päivää…">${esc(ob.letter)}</textarea>
        <div class="btnrow"><button class="btn ghost" id="ob-back">Takaisin</button><button class="btn primary" id="ob-next">Sinetöi kirje</button></div></div>`;
    if (ob.step === 4) html = `
      <h1>Muistutus ja aloitus</h1>
      <div class="card">
        <div class="field"><label for="ob-rem">Päivittäinen muistutusaika</label><input id="ob-rem" type="time" value="${esc(ob.reminder)}"><div class="hint">Muistutus näytetään, kun sovellus on auki tai asennettuna ja ilmoitukset sallittu. Voit muuttaa tätä asetuksissa.</div></div>
        <div class="callout"><b>Tänään on päivä 1.</b> Ohjelma kestää ${N} päivää eli ${fmtDate(addDays(todayISO(), N - 1))} asti. Yksi väliin jäänyt päivä ei nollaa mitään – kaksi peräkkäistä kannattaa välttää.</div>
        <div class="btnrow"><button class="btn ghost" id="ob-back">Takaisin</button><button class="btn primary" id="ob-start">Aloita päivä 1</button></div></div>`;
    $main.innerHTML = bar + html;

    const q = (s) => $main.querySelector(s);
    const grab = () => {
      if (q('#ob-name')) ob.name = q('#ob-name').value.trim();
      if (q('#ob-why')) ob.why = q('#ob-why').value.trim();
      if (q('#ob-cue')) ob.cue = q('#ob-cue').value.trim();
      if (q('#ob-action')) ob.action = q('#ob-action').value.trim();
      if (q('#ob-letter')) ob.letter = q('#ob-letter').value;
      if (q('#ob-rem')) ob.reminder = q('#ob-rem').value;
    };
    q('#ob-next')?.addEventListener('click', () => {
      grab();
      if (ob.step === 2 && (!ob.cue || !ob.action)) return toast('Täytä sekä "kun" että "niin".');
      if (ob.step === 3 && ob.letter.trim().length < 20) return toast('Kirjoita vähintään pari lausetta – tuleva minä kiittää.');
      ob.step++; renderOnboarding();
    });
    q('#ob-back')?.addEventListener('click', () => { grab(); ob.step--; renderOnboarding(); });
    q('#ob-areas')?.addEventListener('click', (e) => {
      const b = e.target.closest('.chip'); if (!b) return; grab();
      const id = b.dataset.id; const i = ob.areas.indexOf(id);
      if (i >= 0) ob.areas.splice(i, 1); else if (ob.areas.length < 3) ob.areas.push(id); else return toast('Enintään kolme aluetta – vähemmän on enemmän.');
      renderOnboarding();
    });
    $main.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => { const x = ANCHOR_EXAMPLES[+b.dataset.ex]; ob.cue = x.cue; ob.action = x.action; renderOnboarding(); }));
    q('#ob-start')?.addEventListener('click', () => {
      grab();
      S.name = ob.name; S.areas = ob.areas; S.anchor = { cue: ob.cue, action: ob.action }; S.letter = ob.letter; S.why = ob.why; S.reminder = ob.reminder; S.startDate = todayISO();
      save(); go('today'); toast('Päivä 1 alkaa. Tervetuloa.');
      if (S.reminder && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
    });
    q('#ob-name')?.focus();
  }

  /* ---------- Tänään ---------- */
  function renderToday() {
    const n = currentDay();
    if (n < 1) { $main.innerHTML = `<div class="card"><h2>Ohjelma alkaa ${fmtDate(S.startDate)}</h2><p>Aloituspäivä on tulevaisuudessa. Voit muuttaa sitä asetuksista.</p></div>`; return; }
    const d = C.DAYS[contentIndex(n)]; const ph = phaseOf(n); const r = rec(n); const items = dayItems(n);
    const done = dayDone(n); const total = items.length; const ext = isExtension(n);
    const pct = Math.min(100, Math.round((Math.min(n, N) / N) * 100));
    const st = stats();
    const hello = S.name ? `Hei ${esc(S.name)}.` : 'Hei.';

    // Paluuviesti, jos edellinen päivä jäi väliin
    let comeback = '';
    if (n > 1 && dayDone(n - 1) === 0 && S.comebackShownOn !== todayISO() && done === 0) {
      comeback = `<div class="callout">${esc(C.COMEBACK[hash(todayISO()) % C.COMEBACK.length])}</div>`;
    }
    const src = C.SOURCES[d.src];
    $main.innerHTML = `
      <section class="hero">
        <div class="eyebrow">${ext ? 'Vapaa jatko · ' : ''}${esc(ph.short)} · ${fmtDate(todayISO())}</div>
        <h1>${hello} ${ext ? `Jatkopäivä ${n - N}.` : `Päivä ${n} / ${N}.`}</h1>
        <div class="progressbar" aria-label="Ohjelman edistyminen"><i style="width:${pct}%"></i></div>
        <div class="day-line small muted"><span>${ext ? `Ohjelman ${N} päivää täynnä – jatkat omasta halustasi.` : `${N - n} päivää jäljellä`}</span>${st.streak > 1 ? `<span>· ${st.streak} päivän putki</span>` : ''}</div>
      </section>
      ${comeback}
      ${n === N ? `<div class="card accent celebrate"><div class="big">✉</div><h2>Päivä ${N}: kirjeesi avautuu tänään.</h2><p>Sinä olet nyt se tuleva minä, jolle päivän 1 minä kirjoitti.</p><button class="btn primary" id="open-letter">Avaa kirje</button></div>` : ''}
      <div class="card">
        <div class="card-head"><span class="eyebrow">Päivän vinkki</span><span class="pill">${esc(ph.name)}</span></div>
        <p class="tip">${esc(d.tip)}</p>
        <div class="source"><details><summary>Lähde</summary><p>${esc(src.cite)}</p><p>${esc(src.summary)}</p>${src.url ? `<a href="${esc(src.url)}" target="_blank" rel="noopener">Avaa lähde ↗</a>` : ''}</details></div>
      </div>
      <div class="card">
        <div class="card-head"><span class="eyebrow">Pienet teot tulevalle itselle</span><span class="pill ${done === total ? 'success' : ''}">${done} / ${total}</span></div>
        ${items.map((it) => `
          <div class="task ${r.done[it.id] ? 'done' : ''}" data-id="${it.id}">
            <button class="check" aria-pressed="${!!r.done[it.id]}" aria-label="Merkitse tehdyksi: ${esc(it.label)}">✓</button>
            <div class="body"><div class="label">${esc(it.label)}</div><p class="text">${esc(it.text)}</p><div class="meta">${esc(it.meta)}</div></div>
          </div>`).join('')}
        ${done === total ? `<div class="callout success" style="margin-top:12px"><b>Kaikki tehty.</b> Tuleva minä huomasi. Nähdään huomenna samassa tilanteessa.</div>` : ''}
      </div>
      ${S.anchor.action ? `<div class="card">
        <div class="eyebrow">Automaattisuus tänään</div>
        <p class="small muted">Kuinka paljon ankkuriteko vaati tänään tietoista päättämistä? (Itsearvio, vrt. Lally 2010:n automaattisuusmittari.)</p>
        <div class="scale" role="group" aria-label="Automaattisuus 1–5">${[1, 2, 3, 4, 5].map((v) => `<button data-auto="${v}" aria-pressed="${r.auto === v}">${v}</button>`).join('')}</div>
        <div class="scale-labels"><span>Vaati pakottamista</span><span>Tapahtui itsestään</span></div>
      </div>` : ''}
      <div class="card">
        <div class="eyebrow">Mitä tuleva minä kiittää tänään?</div>
        <textarea id="note" placeholder="Yksi lause riittää.">${esc(r.note)}</textarea>
        <div class="btnrow"><button class="btn" id="save-note">Tallenna</button><button class="btn ghost" id="add-letter-line">+ Rivi kirjeeseen</button></div>
      </div>
      ${isWeekly(n) ? renderWeekly(n, r) : ''}
      ${S.why ? `<div class="card soft"><div class="eyebrow">Miksi</div><p class="serif">${nl2br(S.why)}</p></div>` : ''}
    `;
    if (comeback) { S.comebackShownOn = todayISO(); save(); }

    $main.querySelectorAll('.task .check').forEach((b) => b.addEventListener('click', () => {
      const id = b.closest('.task').dataset.id; r.done[id] = !r.done[id]; r.ts = Date.now(); save(); renderToday();
      if (r.done[id] && dayDone(n) === dayTotal(n)) toast(n === N ? 'Päivä 66. Sinä teit sen.' : 'Kaikki päivän teot tehty ✓');
    }));
    $main.querySelectorAll('[data-auto]').forEach((b) => b.addEventListener('click', () => { r.auto = +b.dataset.auto; save(); renderToday(); }));
    $main.querySelector('#save-note').addEventListener('click', () => { r.note = $main.querySelector('#note').value.trim(); save(); toast('Tallennettu.'); });
    $main.querySelector('#add-letter-line').addEventListener('click', () => {
      const t = $main.querySelector('#note').value.trim(); if (!t) return toast('Kirjoita ensin rivi.');
      S.letterAppendix.push({ day: n, date: todayISO(), text: t }); r.note = t; save(); toast(`Lisätty kirjeeseen (avataan päivänä ${N}).`);
    });
    $main.querySelector('#open-letter')?.addEventListener('click', () => go('letter'));
    $main.querySelectorAll('[data-wq]').forEach((ta) => ta.addEventListener('change', () => { r.review[ta.dataset.wq] = ta.value.trim(); save(); toast('Viikkokatsaus tallennettu.'); }));
  }
  function renderWeekly(n, r) {
    return `<div class="card accent">
      <div class="eyebrow">Viikkokatsaus · viikko ${Math.round(n / 7)}</div>
      <p class="small muted">Edistymisen seuraaminen lisää tavoitteiden saavuttamista (Harkin ym. 2016). Kolme kysymystä, lyhyet vastaukset.</p>
      ${C.WEEKLY_QUESTIONS.map((qq, i) => `<div class="field"><label>${esc(qq)}</label><textarea data-wq="${i}" style="min-height:70px">${esc(r.review[i] || '')}</textarea></div>`).join('')}
    </div>`;
  }

  /* ---------- Edistyminen ---------- */
  function renderProgress() {
    const n = currentDay(); const st = stats(); const last = Math.max(N, n);
    const cells = []; for (let i = 1; i <= last; i++) {
      const d = dayDone(i), t = dayTotal(i); let cls = 'future';
      if (i <= n) cls = d === 0 ? 'miss' : d >= t ? 'full' : 'part';
      if (i === n) cls += ' today';
      cells.push(`<button class="cell ${cls}" data-day="${i}" title="Päivä ${i}: ${fmtDate(addDays(S.startDate, i - 1))}" ${i > n ? 'disabled' : ''}>${i}</button>`);
    }
    $main.innerHTML = `
      <h1>Edistyminen</h1>
      <div class="card"><div class="stats">
        <div class="stat"><b>${st.streak}</b><span>päivän putki</span></div>
        <div class="stat"><b>${st.active}</b><span>aktiivista päivää</span></div>
        <div class="stat"><b>${st.acts}</b><span>tekoa tulevalle itselle</span></div>
      </div>
      ${st.missed > 0 ? `<p class="small muted" style="margin-top:10px">Väliin jääneitä päiviä: ${st.missed}. Se on tilastoa, ei tuomio – kaksi peräkkäistä kannattaa välttää.</p>` : ''}
      </div>
      <div class="card"><div class="card-head"><span class="eyebrow">Automaattisuus</span><span class="pill">${st.avgAuto ? 'viim. 7 pv ka. ' + st.avgAuto.toFixed(1) : 'ei arvioita vielä'}</span></div>
        <p class="small muted">Lallyn (2010) käyrä nousee jyrkimmin alussa ja tasaantuu. Jos käyräsi tasaantuu, se on odotettua.</p>
        ${renderChart(n)}
      </div>
      <div class="card"><div class="eyebrow">Päivät</div><p class="small muted">Napauta päivää nähdäksesi sen vinkin ja muistiinpanot.</p><div class="calendar">${cells.join('')}</div></div>
      <div class="card"><div class="eyebrow">Ohjelman vaiheet</div><div class="phases">${C.PHASES.map((p) => { const ci = contentIndex(n) + 1; const cls = ci >= p.from && ci <= p.to ? 'current' : ci > p.to ? 'past' : ''; return `<div class="phase ${cls}"><div class="range">${p.from}–${p.to}</div><div><b>${esc(p.name)}</b><div class="small muted">${esc(p.desc)}</div></div></div>`; }).join('')}</div></div>
      ${renderNotes()}
    `;
    $main.querySelectorAll('.cell[data-day]').forEach((b) => b.addEventListener('click', () => go('day', +b.dataset.day)));
  }
  function renderChart(n) {
    const W = 640, H = 200, L = 28, R = 10, T = 10, B = 24; const last = Math.max(N, n);
    const x = (i) => L + ((i - 1) / (last - 1)) * (W - L - R); const y = (v) => T + (1 - (v - 1) / 4) * (H - T - B);
    const pts = []; for (let i = 1; i <= Math.min(n, last); i++) if (S.days[i]?.auto) pts.push([x(i), y(S.days[i].auto), i]);
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const grid = [1, 2, 3, 4, 5].map((v) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>`).join('');
    const xt = [1, 22, 44, 66].filter((v) => v <= last).map((v) => `<text class="axis" x="${x(v)}" y="${H - 6}" text-anchor="middle">${v}</text>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Automaattisuuden itsearvio päivittäin">${grid}${xt}${path ? `<path class="line" d="${path}"/>` : ''}${pts.map((p) => `<circle class="dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3"><title>Päivä ${p[2]}: ${S.days[p[2]].auto}/5</title></circle>`).join('')}${pts.length ? '' : `<text class="axis" x="${W / 2}" y="${H / 2}" text-anchor="middle">Arvioi ankkuriteon automaattisuus Tänään-näkymässä.</text>`}</svg>`;
  }
  function renderNotes() {
    const notes = Object.entries(S.days).filter(([, r]) => r.note).sort((a, b) => b[0] - a[0]).slice(0, 10);
    if (!notes.length) return '';
    return `<div class="card"><div class="eyebrow">Mitä tuleva minä kiittää</div><ul class="list-plain">${notes.map(([d, r]) => `<li><span class="small muted">Päivä ${d}</span><br>${nl2br(r.note)}</li>`).join('')}</ul></div>`;
  }
  function renderDayDetail() {
    const i = viewArg; const d = C.DAYS[contentIndex(i)]; const r = S.days[i] || { done: {}, note: '', auto: 0, review: {} }; const items = dayItems(i);
    $main.innerHTML = `
      <button class="btn ghost" id="back">← Edistyminen</button>
      <h1>Päivä ${i}</h1><p class="muted">${fmtDate(addDays(S.startDate, i - 1))} · ${esc(phaseOf(i).name)}</p>
      <div class="card"><div class="eyebrow">Vinkki</div><p class="tip">${esc(d.tip)}</p><div class="source">${esc(C.SOURCES[d.src].cite)}</div></div>
      <div class="card"><div class="eyebrow">Teot</div>${items.map((it) => `<div class="task ${r.done[it.id] ? 'done' : ''}" data-id="${it.id}"><button class="check" aria-pressed="${!!r.done[it.id]}" aria-label="Merkitse: ${esc(it.label)}">✓</button><div class="body"><div class="label">${esc(it.label)}</div><p class="text">${esc(it.text)}</p></div></div>`).join('')}
        <p class="small muted" style="margin-top:10px">Voit merkitä jälkikäteen teon, jonka teit mutta unohdit kirjata.</p></div>
      ${r.auto ? `<div class="card"><div class="eyebrow">Automaattisuus</div><p>${r.auto} / 5</p></div>` : ''}
      ${r.note ? `<div class="card"><div class="eyebrow">Muistiinpano</div><p>${nl2br(r.note)}</p></div>` : ''}
      ${Object.keys(r.review || {}).length ? `<div class="card"><div class="eyebrow">Viikkokatsaus</div>${C.WEEKLY_QUESTIONS.map((q, k) => r.review[k] ? `<p><b class="small">${esc(q)}</b><br>${nl2br(r.review[k])}</p>` : '').join('')}</div>` : ''}
    `;
    $main.querySelector('#back').addEventListener('click', () => go('progress'));
    $main.querySelectorAll('.task .check').forEach((b) => b.addEventListener('click', () => { const rr = rec(i); const id = b.closest('.task').dataset.id; rr.done[id] = !rr.done[id]; save(); renderDayDetail(); }));
  }

  /* ---------- Kirje ---------- */
  function renderLetter() {
    const n = currentDay(); const open = n >= N;
    const appendix = S.letterAppendix.length ? `<div class="card"><div class="eyebrow">Matkan varrella lisätyt rivit</div><ul class="list-plain">${S.letterAppendix.map((a) => `<li><span class="small muted">Päivä ${a.day} · ${fmtDate(a.date)}</span><br>${nl2br(a.text)}</li>`).join('')}</ul></div>` : '';
    if (!open) {
      $main.innerHTML = `
        <h1>Kirje tulevalle itselle</h1>
        <div class="card sealed"><div class="seal">✉</div><h2>Sinetöity</h2><p class="muted">Avautuu päivänä ${N} (${fmtDate(addDays(S.startDate, N - 1))}). Jäljellä ${N - n} päivää.</p>
          <p class="small muted">Voit lisätä kirjeeseen rivejä Tänään-näkymästä. Ne näkyvät vasta avauspäivänä.</p></div>
        <div class="card"><div class="eyebrow">Rivejä lisätty</div><p>${S.letterAppendix.length} kpl</p></div>
        <div class="card soft"><div class="eyebrow">Miksi kirje?</div><p class="small">Kirjeen kirjoittaminen tulevalle itselle lisää tulevaisuusyhteyttä ja terveyskäyttäytymistä (Rutchick ym. 2018). Elävät mielikuvat tulevasta itsestä vähentävät lykkäämistä (Blouin-Hudon &amp; Pychyl 2015, 2017).</p></div>`;
      return;
    }
    $main.innerHTML = `
      <h1>Kirje päivän 1 minältä</h1>
      <p class="muted">Kirjoitettu ${fmtDate(S.startDate)}. ${S.name ? `Hän kirjoitti sinulle, ${esc(S.name)}.` : ''}</p>
      <div class="letter-paper">${nl2br(S.letter)}</div>
      ${appendix}
      <div class="card" style="margin-top:14px"><div class="eyebrow">Vastaus hänelle</div>
        <p class="small muted">Kirjoita muutama rivi tulevan minän äänellä: mitä hän sai aikaan, mistä olet kiitollinen, mitä seuraavaksi.</p>
        <textarea id="reply" class="letter">${esc(S.letterReply || '')}</textarea>
        <div class="btnrow"><button class="btn primary" id="save-reply">Tallenna vastaus</button></div></div>
      <div class="card accent"><h2>Seuraavat ${N} päivää?</h2><p>Yksi tapa kerrallaan on tehokkainta. Voit jatkaa vapaana jatkona samalla ankkuriteolla tai aloittaa uuden ohjelman uudella ankkuriteolla ja kirjeellä.</p>
        <div class="btnrow"><button class="btn" id="continue">Jatka vapaana jatkona</button><button class="btn primary" id="restart">Aloita uusi 66 päivän ohjelma</button></div></div>`;
    $main.querySelector('#save-reply').addEventListener('click', () => { S.letterReply = $main.querySelector('#reply').value; save(); toast('Vastaus tallennettu.'); });
    $main.querySelector('#continue').addEventListener('click', () => go('today'));
    $main.querySelector('#restart').addEventListener('click', () => {
      if (!confirm('Aloitetaanko uusi ohjelma? Nykyinen historia arkistoidaan vientitiedostoon, jonka voit ladata Asetuksista ensin.')) return;
      const prev = { name: S.name, theme: S.theme, reminder: S.reminder };
      S = Object.assign(defaults(), prev); save(); ob = { step: 0, name: prev.name, areas: [], cue: '', action: '', letter: '', why: '', reminder: prev.reminder || '20:00' }; render();
    });
  }

  /* ---------- Tutkimus ---------- */
  function renderResearch() {
    const used = {}; C.DAYS.forEach((d, i) => { (used[d.src] = used[d.src] || []).push(i + 1); });
    $main.innerHTML = `
      <h1>Mihin ohjelma perustuu</h1>
      <div class="card">
        <p>Ohjelma yhdistää kaksi tutkimusalaa: <b>tulevaisuusyhteyden</b> (future self-continuity) ja <b>tapojen muodostumisen</b> psykologian.</p>
        <ul>
          <li><b>Tuleva minä tuntuu vieraalta.</b> Aivokuvantamisessa tulevan itsen ajattelu muistuttaa vieraan ihmisen ajattelua, ja mitä vieraampi hän on, sitä vähemmän hänen hyväkseen toimitaan (Ersner-Hershfield ym. 2009). Yhteyttä voi vahvistaa: ikäprogressoidut kuvat, kirjeet ja elävät mielikuvat lisäävät säästämistä, liikuntaa ja vähentävät lykkäämistä.</li>
          <li><b>Tapa syntyy toistosta samassa tilanteessa.</b> Automaattisuus saavutettiin keskimäärin 66 päivässä (Lally ym. 2010). Siksi ohjelman vähimmäiskesto on 66 päivää.</li>
          <li><b>Jos–niin-suunnitelmat</b> siirtävät päätöksen tilanteeseen: 94 tutkimuksen meta-analyysissä vaikutus oli d = 0,65 (Gollwitzer &amp; Sheeran 2006).</li>
          <li><b>Ympäristö ja sitoumukset</b> toimivat paremmin kuin tahdonvoima: tilanteen muokkaus, houkutusten niputus, oletusasetukset ja etukäteen sovitut korotukset.</li>
          <li><b>Itsemyötätunto</b> lisää halua parantaa, itsekritiikki vähentää sitä (Breines &amp; Chen 2012). Väliin jäänyt päivä ei nollaa mitään.</li>
        </ul>
        <p class="small muted">Sovellus ei ole terveydenhuollon palvelu eikä korvaa ammattiapua. Tutkimustulokset ovat keskiarvoja; yksilölliset erot ovat suuria (Lallyn aineistossa 18–254 päivää).</p>
      </div>
      <div class="card"><div class="eyebrow">Lähteet (${Object.keys(C.SOURCES).length})</div>
        ${Object.entries(C.SOURCES).map(([k, s]) => `<div class="ref"><div class="cite">${esc(s.cite)}</div><div class="use">${esc(s.summary)}</div><div class="small">${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">Lähde ↗</a> · ` : ''}<span class="muted">${used[k] ? 'Päivät ' + used[k].join(', ') : 'Taustalähde'}</span></div></div>`).join('')}
      </div>`;
  }

  /* ---------- Asetukset ---------- */
  function renderSettings() {
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    $main.innerHTML = `
      <h1>Asetukset</h1>
      <div class="card">
        <div class="field"><label for="s-name">Nimi</label><input id="s-name" type="text" value="${esc(S.name)}"></div>
        <div class="field"><label>Painopistealueet (1–3)</label><div class="chips" id="s-areas">${C.AREAS.map((a) => `<button class="chip" data-id="${a.id}" aria-pressed="${S.areas.includes(a.id)}">${a.emoji} ${esc(a.name)}</button>`).join('')}</div></div>
        <div class="field"><label for="s-cue">Ankkuriteko: kun…</label><input id="s-cue" type="text" value="${esc(S.anchor.cue)}"></div>
        <div class="field"><label for="s-action">…niin</label><input id="s-action" type="text" value="${esc(S.anchor.action)}"><div class="hint">Muuta vain, jos nykyinen ei toimi. Sama teko samassa tilanteessa rakentaa automaattisuuden.</div></div>
        <div class="field"><label for="s-why">Miksi</label><textarea id="s-why" style="min-height:70px">${esc(S.why)}</textarea></div>
        <div class="field"><label for="s-start">Aloituspäivä</label><input id="s-start" type="date" value="${esc(S.startDate)}"><div class="hint">Päivänumero lasketaan tästä. Muuta vain, jos aloitit oikeasti eri päivänä.</div></div>
        <div class="btnrow"><button class="btn primary" id="s-save">Tallenna</button></div>
      </div>
      <div class="card">
        <h2>Muistutus</h2>
        <div class="field"><label for="s-rem">Aika</label><input id="s-rem" type="time" value="${esc(S.reminder)}"><div class="hint">Muistutus toimii, kun sovellus on auki tai asennettu aloitusnäytölle ja ilmoitukset on sallittu. Luotettavin muistutus on silti oma ankkurivihjeesi.</div></div>
        <p class="small">Ilmoitusten tila: <b>${{ granted: 'sallittu', denied: 'estetty selaimessa', default: 'ei kysytty', unsupported: 'ei tuettu' }[perm]}</b></p>
        <div class="btnrow"><button class="btn" id="s-rem-save">Tallenna aika</button>${perm === 'default' ? '<button class="btn" id="s-notif">Salli ilmoitukset</button>' : ''}${perm === 'granted' ? '<button class="btn ghost" id="s-notif-test">Testaa</button>' : ''}</div>
      </div>
      <div class="card">
        <h2>Ulkoasu</h2>
        <div class="chips">${[['auto', 'Automaattinen'], ['light', 'Vaalea'], ['dark', 'Tumma']].map(([v, l]) => `<button class="chip" data-theme="${v}" aria-pressed="${S.theme === v}">${l}</button>`).join('')}</div>
      </div>
      <div class="card">
        <h2>Tiedot</h2>
        <p class="small muted">Kaikki tiedot ovat vain tässä selaimessa. Vie varmuuskopio, jos vaihdat laitetta.</p>
        <div class="btnrow"><button class="btn" id="s-export">Vie JSON</button><label class="btn" for="s-import">Tuo JSON</label><input id="s-import" type="file" accept="application/json" hidden><button class="btn danger" id="s-reset">Nollaa kaikki</button></div>
      </div>
      <div class="card soft"><p class="small muted">Tuleva minä · avoin lähdekoodi · ei seurantaa, ei tiliä. Sovellus ei korvaa terveydenhuollon tai talousneuvonnan ammattilaista.</p></div>`;
    const q = (s) => $main.querySelector(s);
    q('#s-areas').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (!b) return; const p = b.getAttribute('aria-pressed') === 'true'; const cnt = [...q('#s-areas').querySelectorAll('[aria-pressed="true"]')].length; if (!p && cnt >= 3) return toast('Enintään kolme aluetta.'); b.setAttribute('aria-pressed', String(!p)); });
    q('#s-save').addEventListener('click', () => {
      const areas = [...q('#s-areas').querySelectorAll('[aria-pressed="true"]')].map((b) => b.dataset.id); if (!areas.length) return toast('Valitse vähintään yksi alue.');
      const start = q('#s-start').value; if (!start) return toast('Aloituspäivä puuttuu.');
      S.name = q('#s-name').value.trim(); S.areas = areas; S.anchor = { cue: q('#s-cue').value.trim(), action: q('#s-action').value.trim() }; S.why = q('#s-why').value.trim(); S.startDate = start; save(); toast('Tallennettu.'); render();
    });
    q('#s-rem-save').addEventListener('click', () => { S.reminder = q('#s-rem').value; save(); toast('Muistutusaika tallennettu.'); });
    q('#s-notif')?.addEventListener('click', () => Notification.requestPermission().then(() => renderSettings()));
    q('#s-notif-test')?.addEventListener('click', () => notify('Tuleva minä', 'Tämä on testi. Pieni teko tänään, kiitos huomenna.'));
    $main.querySelectorAll('[data-theme]').forEach((b) => b.addEventListener('click', () => { S.theme = b.dataset.theme; save(); render(); }));
    q('#s-export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `tuleva-mina-${todayISO()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    q('#s-import').addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return; const fr = new FileReader();
      fr.onload = () => { try { const data = JSON.parse(fr.result); if (!data || typeof data !== 'object' || !('days' in data)) throw new Error(); S = Object.assign(defaults(), data); save(); toast('Tiedot tuotu.'); render(); } catch { toast('Tiedosto ei kelpaa.'); } };
      fr.readAsText(f);
    });
    q('#s-reset').addEventListener('click', () => { if (confirm('Poistetaanko kaikki tiedot tästä laitteesta? Tätä ei voi perua.')) { localStorage.removeItem(KEY); S = defaults(); ob = { step: 0, name: '', areas: [], cue: '', action: '', letter: '', why: '', reminder: '20:00' }; render(); } });
  }

  /* ---------- Muistutukset ---------- */
  function notify(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      if (navigator.serviceWorker?.controller) navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, { body, icon: 'icons/icon-192.png', tag: 'tuleva-mina' }));
      else new Notification(title, { body, icon: 'icons/icon-192.png', tag: 'tuleva-mina' });
    } catch (e) { /* ei tuettu */ }
  }
  function checkReminder() {
    if (!S.startDate || !S.reminder) return; const n = currentDay(); if (n < 1) return;
    const now = new Date(); const [h, m] = S.reminder.split(':').map(Number);
    if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
    if (S.notifiedOn === todayISO() || dayDone(n) >= dayTotal(n)) return;
    S.notifiedOn = todayISO(); save();
    notify(`Päivä ${n}: pieni teko tulevalle itselle`, dayItems(n)[0]?.text || 'Avaa sovellus ja tee yksi pieni teko.');
  }
  setInterval(checkReminder, 60000);

  /* ---------- Käynnistys ---------- */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') { navigator.serviceWorker.register('sw.js').catch(() => {}); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); checkReminder(); } });
  render(); checkReminder();
})();
