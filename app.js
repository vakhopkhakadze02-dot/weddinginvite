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
  generation++; opening = false; clearIntroTimers(); entranceVideo.pause();
  $('#intro').hidden = true; $('#main').hidden = false;
  document.body.classList.remove('locked'); $('#skip').hidden = true;
  window.scrollTo(0, 0); syncVideo();
  $('#home').setAttribute('tabindex', '-1'); $('#home').focus({preventScroll:true});
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
    captionTimer = setTimeout(() => $('#scene-caption').textContent = 'ჩვენი საერთო გზის დასაწყისი', reduced ? 10 : 3400);
    introTimer = setTimeout(finish, reduced ? 350 : 9500);
    syncVideo();
  }).catch(failed);
};
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
