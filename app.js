// ---- Preloader: light & fast. Gate only on the two intro images (+ fonts) so
// entry is quick; the video, music and gallery warm up in the background. No
// blob: URLs — those caused blank/white video on iOS Safari and wasted memory.
(function () {
  const pre = document.getElementById('preloader');
  if (!pre) return;
  const prog = pre.querySelector('.pl-prog');
  const pctEl = pre.querySelector('.pl-pct');
  const CIRC = 339.292; // 2π·54
  const startedAt = performance.now();
  let shown = 0, finished = false;

  function render(p) {
    p = Math.max(0, Math.min(1, p));
    prog.style.strokeDashoffset = CIRC * (1 - p);
    const pct = Math.round(p * 100);
    pctEl.textContent = pct + '%';
    pre.setAttribute('aria-valuenow', String(pct));
  }
  function warmRest() {
    // Load everything non-critical only after the guest is already in.
    ['garden-ceremony.jpg', 'church.jpg', 'signing-arch.jpg', 'table.jpg', 'monogram.jpg', 'palace-gate.jpg']
      .forEach(src => { const im = new Image(); im.src = src; });
    const ev = document.getElementById('entrance-video');
    if (ev) { try { ev.load(); } catch (e) {} } // nudge the entrance clip to start buffering
  }
  function reveal() {
    if (finished) return;
    finished = true;
    render(1);
    const wait = Math.max(0, 450 - (performance.now() - startedAt)); // let 100% be seen
    setTimeout(() => {
      pre.classList.add('pl-done');
      setTimeout(() => { if (pre.parentNode) pre.remove(); }, 800);
    }, wait);
    warmRest();
  }

  // Only the intro visuals gate entry (~1MB total) — fast even on mobile data.
  const assets = ['floral-gate.jpg', 'open-aisle.jpg'];
  // Hard safety net: never trap the guest if the network misbehaves.
  const safety = setTimeout(reveal, 10000);

  const fontsReady = (document.fonts && document.fonts.ready)
    ? document.fonts.ready.catch(() => {}) : Promise.resolve();

  // Old browsers without streaming fetch: approximate, then reveal on load.
  if (!('fetch' in window) || !('ReadableStream' in window)) {
    let f = 0;
    const iv = setInterval(() => { f = Math.min(0.92, f + 0.06); render(f); }, 100);
    const go = () => { clearInterval(iv); clearTimeout(safety); reveal(); };
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
    return;
  }

  const loaded = new Array(assets.length).fill(0);
  const sizes = new Array(assets.length).fill(0);

  function update() {
    const totLoaded = loaded.reduce((a, b) => a + b, 0);
    const totSize = sizes.reduce((a, b) => a + b, 0);
    let p = totSize > 0 ? totLoaded / Math.max(totSize, totLoaded) : 0;
    p = Math.min(p, 0.97);
    if (p > shown) { shown = p; render(shown); } // monotonic — never goes backwards
  }

  Promise.all(assets.map((url, i) =>
    fetch(url).then(res => {
      sizes[i] = +res.headers.get('content-length') || 0;
      if (!res.body || !res.body.getReader) {
        return res.blob().then(b => { loaded[i] = b.size; if (!sizes[i]) sizes[i] = b.size; update(); });
      }
      const reader = res.body.getReader();
      return (function pump() {
        return reader.read().then(({ done, value }) => {
          if (done) { if (!sizes[i]) sizes[i] = loaded[i]; update(); return; }
          loaded[i] += value.length; update(); return pump(); // chunks discarded — no blob kept
        });
      })();
    }).catch(() => { sizes[i] = sizes[i] || 1; loaded[i] = sizes[i]; update(); })
  ).concat([fontsReady])).then(() => { clearTimeout(safety); reveal(); });
})();

const $ = selector => document.querySelector(selector);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const entranceVideo = $('#entrance-video');
const heroVideo = $('#hero-video');
let introTimer, captionTimer, loadTimer, opening = false, generation = 0;
let heroVisible = false;
function clearIntroTimers() {
  clearTimeout(introTimer); clearTimeout(captionTimer); clearTimeout(loadTimer);
}
function syncVideo() {
  const active = !document.hidden;
  if (active && opening && !$('#intro').hidden) entranceVideo.play().catch(() => {});
  else entranceVideo.pause();
  if (active && !$('#main').hidden && heroVisible) heroVideo.play().catch(() => {});
  else heroVideo.pause();
}
function finish() {
  const intro = $('#intro');
  if (intro.hidden) return;                     // already handed off
  generation++; opening = false; clearIntroTimers(); entranceVideo.pause();
  $('#main').hidden = false;
  document.body.classList.remove('locked'); $('#skip').hidden = true;
  window.scrollTo(0, 0);
  const done = () => {
    intro.hidden = true;
    intro.classList.remove('fade-out');
    syncVideo();
    $('#home').setAttribute('tabindex', '-1'); $('#home').focus({preventScroll:true});
  };
  if (reduced) { done(); return; }
  syncVideo();                                  // let the hero video take over behind the fade
  // Cross-fade the entrance scene out over the invitation instead of a hard cut.
  requestAnimationFrame(() => intro.classList.add('fade-out'));
  let handled = false;
  const onEnd = e => {
    if (handled || (e && e.target !== intro)) return;
    handled = true; intro.removeEventListener('transitionend', onEnd); done();
  };
  intro.addEventListener('transitionend', onEnd);
  setTimeout(onEnd, 1200);                       // fallback if transitionend never fires
}
$('#open').onclick = () => {
  if ($('#open').disabled) return;
  if (!musicWanted) startMusic();
  const attempt = ++generation;
  $('#open').disabled = true; $('#skip').hidden = false;
  $('#scene-caption').textContent = 'ვიდეო იტვირთება…';
  if (entranceVideo.readyState) entranceVideo.currentTime = 0;
  function failed() {
    if (attempt !== generation || opening) return;
    clearTimeout(loadTimer); $('#open').disabled = false;
    $('#scene-caption').textContent = 'ვიდეო ვერ ჩაიტვირთა. სცადეთ ხელახლა ან გადადით მოსაწვევზე.';
  }
  loadTimer = setTimeout(failed, 12000);
  entranceVideo.play().then(() => {
    if (attempt !== generation) return;
    clearTimeout(loadTimer); opening = true;
    $('#scene-caption').textContent = '';
    $('#intro').classList.add('opening');
    captionTimer = setTimeout(() => $('#scene-caption').textContent = 'ჩვენი საერთო გზის დასაწყისი', reduced ? 10 : 1800);
    if (reduced) {
      introTimer = setTimeout(finish, 350);
    } else {
      // The entrance clip plays once and its own 'ended' event hands off to
      // the invitation. This timer is only a safety fallback in case 'ended'
      // never fires (e.g. a decode hiccup).
      const dur = (entranceVideo.duration && isFinite(entranceVideo.duration)) ? entranceVideo.duration : 4;
      introTimer = setTimeout(finish, dur * 1000 + 1500);
    }
    syncVideo();
  }).catch(failed);
};
// The 4s entrance clip plays once; the moment it ends, move straight to the
// invitation — a clean, elegant hand-off with no looping restarts.
entranceVideo.addEventListener('ended', () => {
  if (opening && !$('#intro').hidden) finish();
});
$('#skip').onclick = finish;
$('#replay').onclick = () => {
  generation++; opening = false; clearIntroTimers();
  entranceVideo.pause(); heroVideo.pause();
  if (entranceVideo.readyState) entranceVideo.currentTime = 0;
  $('#main').hidden = true; $('#intro').hidden = false;
  document.body.classList.add('locked'); $('#intro').classList.remove('opening');
  $('#open').disabled = false; $('#skip').hidden = true;
  $('#scene-caption').textContent = ''; window.scrollTo(0, 0); $('#open').focus();
};
const observer = new IntersectionObserver(entries => {
  heroVisible = entries[0].isIntersecting; syncVideo();
}, {threshold:0.05});
observer.observe(heroVideo);

const wedding = Date.parse('2026-11-14T13:00:00+04:00');
$('#countdown').innerHTML = ['დღე','საათი','წუთი','წამი'].map(label => `<div><strong>00</strong><span>${label}</span></div>`).join('');
const digits = [...document.querySelectorAll('#countdown strong')];
function tick() {
  const n = Math.max(0, wedding - Date.now());
  const values = [Math.floor(n/86400000), Math.floor(n/3600000)%24, Math.floor(n/60000)%60, Math.floor(n/1000)%60];
  values.forEach((value, i) => {
    const text = String(value).padStart(2, '0');
    if (digits[i].textContent !== text) digits[i].textContent = text;
  });
  if (!n) $('#count-label').textContent = 'ჩვენი განსაკუთრებული დღე დადგა ♡';
}
tick(); setInterval(() => { if (!document.hidden) tick(); }, 1000);
const weddingAudio = $('#wedding-audio');
let musicWanted = false; weddingAudio.volume = .6;
function updateMusic() {
  const playing = !weddingAudio.paused;
  $('#music').setAttribute('aria-pressed', String(playing));
  $('#music').setAttribute('aria-label', playing ? 'ფონური მუსიკის გამორთვა' : 'ფონური მუსიკის ჩართვა');
  $('#music span').textContent = playing ? 'გამორთვა' : 'მუსიკა';
}
function startMusic() { musicWanted = true; weddingAudio.play().catch(updateMusic); }
$('#music').onclick = () => {
  if (musicWanted) { musicWanted = false; weddingAudio.pause(); updateMusic(); }
  else startMusic();
};
weddingAudio.addEventListener('play', updateMusic);
weddingAudio.addEventListener('pause', updateMusic);
document.addEventListener('visibilitychange', () => {
  syncVideo();
  if (!document.hidden) { tick(); if (musicWanted && weddingAudio.paused) startMusic(); }
});
const dialog = $('#lightbox');
document.querySelectorAll('[data-photo]').forEach(button => button.onclick = () => {
  $('#large-photo').src = button.dataset.photo; dialog.showModal();
});
$('#close-photo').onclick = () => dialog.close();
dialog.onclick = event => { if (event.target === dialog) dialog.close(); };

// ---- Scroll reveal: blocks rise & fade in as they enter view ----
(function () {
  if (reduced) return;                       // reduced-motion: leave everything visible & static
  document.documentElement.classList.add('has-reveal');

  // Tag the blocks that should animate in, with a little stagger per group.
  [['.events article', 0.12], ['.photos button', 0.12]].forEach(([sel, step]) => {
    document.querySelectorAll(sel).forEach((el, i) => { el.classList.add('reveal'); el.style.transitionDelay = (i * step) + 's'; });
  });
  ['.count-section .month-card', '.count-section .countdown', '.gallery > div', '.schedule > h2', '.schedule > .eyebrow']
    .forEach(sel => document.querySelectorAll(sel).forEach(el => el.classList.add('reveal')));

  // Every .reveal element, including .journey and #rsvp declared in the HTML.
  const items = [...document.querySelectorAll('.reveal')];
  const reveal = el => el.classList.add('in');

  const io = ('IntersectionObserver' in window) ? new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }) : null;
  if (io) items.forEach(el => io.observe(el));

  // Fallback sweep — a block is never left hidden even if the observer misses it.
  let ticking = false;
  function sweep() {
    const vh = innerHeight;
    let remaining = false;
    items.forEach(el => {
      if (el.classList.contains('in')) return;
      const r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh * 0.92) reveal(el); else remaining = true;
    });
    if (!remaining) { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); }
  }
  function onScroll() { if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; sweep(); }); }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  sweep();
})();

// ---- Ambient falling petals (subtle, palette-matched) ----
(function () {
  if (reduced) return;
  const layer = document.createElement('div');
  layer.className = 'petals';
  layer.setAttribute('aria-hidden', 'true');
  const count = window.matchMedia('(max-width:650px)').matches ? 7 : 11;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'petal';
    const size = 9 + Math.random() * 10;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.left = (Math.random() * 100) + 'vw';
    p.style.animationDuration = (12 + Math.random() * 12) + 's';
    p.style.animationDelay = (-Math.random() * 18) + 's';
    p.style.opacity = '';
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
})();

// ---- RSVP: a custom form that posts to the couple's Google Form ----
(function () {
  const form = document.getElementById('rsvp-form');
  if (!form) return;
  const FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLSc7llQy1hmF_0xox08SXYec3NMpu4pi6crMjUR7QCnVIIvuzw/formResponse';
  const ENTRY = { name: 'entry.559352220', attend: 'entry.877086558', persons: 'entry.924523986' };
  const YES = 'სიამოვნებით მოვალ';
  const nameI = document.getElementById('rsvp-name');
  const opts = [...form.querySelectorAll('.rsvp-opt')];
  const personsWrap = form.querySelector('.rsvp-persons');
  const personsSel = document.getElementById('rsvp-persons');
  const msg = form.querySelector('.rsvp-msg');
  const submit = form.querySelector('.rsvp-submit');
  const doneBox = document.querySelector('.rsvp-done');
  let attend = '';

  opts.forEach(b => b.addEventListener('click', () => {
    attend = b.dataset.attend;
    opts.forEach(o => o.setAttribute('aria-pressed', String(o === b)));
    personsWrap.hidden = (attend !== YES);
    msg.textContent = '';
  }));

  let sent = false;
  function showDone() {
    if (sent) return; sent = true;
    const coming = attend === YES;
    doneBox.querySelector('h3').textContent = coming ? 'გმადლობთ! გელოდებით 💛' : 'გმადლობთ, რომ გვაცნობეთ';
    doneBox.querySelector('p').textContent = coming
      ? 'თქვენი დადასტურება მივიღეთ. შევხვდებით 14 ნოემბერს!'
      : 'ვწუხვართ, რომ ვერ შემოგვიერთდებით — მადლობა პასუხისთვის.';
    form.hidden = true; doneBox.hidden = false;
    doneBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (sent) return;
    const name = nameI.value.trim();
    if (!name) { msg.textContent = 'გთხოვთ, შეიყვანოთ სახელი და გვარი.'; nameI.focus(); return; }
    if (!attend) { msg.textContent = 'გთხოვთ, აირჩიოთ — მობრძანდებით თუ არა.'; return; }
    submit.disabled = true; msg.textContent = ''; submit.textContent = 'იგზავნება…';

    // Submit via a real form POST into a hidden iframe — the reliable,
    // CORS-free way to record into Google Forms from our own page.
    let iframe = document.getElementById('rsvp-sink');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.name = 'rsvp-sink'; iframe.id = 'rsvp-sink'; iframe.style.display = 'none';
      document.body.appendChild(iframe);
    }
    const gform = document.createElement('form');
    gform.action = FORM_ACTION; gform.method = 'POST'; gform.target = 'rsvp-sink'; gform.style.display = 'none';
    const add = (k, v) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; gform.appendChild(i); };
    add(ENTRY.name, name);
    add(ENTRY.attend, attend);
    if (attend === YES) add(ENTRY.persons, personsSel.value);
    document.body.appendChild(gform);

    iframe.addEventListener('load', showDone, { once: true }); // response came back → recorded
    gform.submit();
    setTimeout(showDone, 1600);                 // fallback if the iframe load doesn't fire
    setTimeout(() => gform.remove(), 2200);
  });
})();
