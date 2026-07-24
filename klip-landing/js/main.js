/* ════════════════════════════════════════════════════════════════════
   KLIP — Landing pro · interactions
   Nav solide au scroll, menu mobile, reveals, marquee, toggle tarifs,
   accordéon FAQ. Vanilla JS, aucune dépendance.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Nav : fond solide au scroll ── */
  var nav = document.getElementById('nav');
  function onScroll() { nav.classList.toggle('solid', window.scrollY > 40); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ── Menu mobile ── */
  var mobMenu = document.getElementById('mobMenu');
  document.getElementById('mobBtn').addEventListener('click', function () { mobMenu.classList.add('open'); });
  document.getElementById('mobClose').addEventListener('click', function () { mobMenu.classList.remove('open'); });
  mobMenu.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { mobMenu.classList.remove('open'); });
  });

  /* ── Reveals au scroll (IntersectionObserver) ── */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.rv').forEach(function (el) { io.observe(el); });

  /* ── Marquee : on duplique le contenu pour une boucle sans couture ── */
  var mq = document.getElementById('mq');
  if (mq) { mq.innerHTML += mq.innerHTML; }

  /* ── Toggle tarifs mensuel / annuel ── */
  document.querySelectorAll('.toggle button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.toggle button').forEach(function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
      var yearly = btn.dataset.period === 'yearly';
      document.querySelectorAll('.amt').forEach(function (a) { a.textContent = yearly ? a.dataset.y : a.dataset.m; });
      document.querySelectorAll('.billed').forEach(function (b) { b.textContent = yearly ? b.dataset.by : b.dataset.bm; });
    });
  });

  /* ── FAQ accordéon ── */
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var q = item.querySelector('.faq-q');
    var a = item.querySelector('.faq-a');
    q.addEventListener('click', function () {
      var open = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(function (i) {
        i.classList.remove('open');
        i.querySelector('.faq-a').style.maxHeight = null;
      });
      if (!open) { item.classList.add('open'); a.style.maxHeight = a.scrollHeight + 'px'; }
    });
  });
})();
