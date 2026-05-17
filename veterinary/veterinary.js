/* veterinary.js — Veterinary LP tracking + conversion event wiring */
(function () {
  'use strict';
  window.dataLayer = window.dataLayer || [];
  document.addEventListener('DOMContentLoaded', function () {
    var items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { items.forEach(function (i) { i.classList.add('in-view'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); } });
    }, { threshold: 0.16, rootMargin: '0px 0px -10% 0px' });
    items.forEach(function (i) { io.observe(i); });
  });
  function track(event, params) { window.dataLayer.push(Object.assign({ event: event }, params || {})); }
  track('lp_view', { lp: 'veterinary', lp_version: 'v1' });
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-cta]');
    if (!el) return;
    var cta = el.getAttribute('data-cta');
    track('cta_click', { cta_id: cta, cta_category: cta.indexOf('book-call') === 0 ? 'calendly' : cta.indexOf('estimate') === 0 ? 'instant_estimate' : 'other', lp: 'veterinary' });
  }, { passive: true });
  window.addEventListener('message', function (e) {
    if (!e.data) return;
    var evt = String(e.data.event || '');
    if (evt === 'calendly.event_scheduled') { track('calendly_booking_complete', { lp: 'veterinary', conversion: 1 }); }
    if (evt === 'estimate_submitted' || evt === 'instant_estimate_submitted') { track('estimate_submit_complete', { lp: 'veterinary', conversion: 1 }); }
  }, false);
  var fired = {};
  function depth() {
    var h = document.documentElement;
    var pct = Math.round((h.scrollTop + window.innerHeight) / h.scrollHeight * 100);
    [25, 50, 75, 90].forEach(function (t) { if (pct >= t && !fired[t]) { fired[t] = true; track('scroll_depth', { depth: t, lp: 'veterinary' }); } });
  }
  window.addEventListener('scroll', depth, { passive: true });
  document.querySelectorAll('.faq-item').forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (item.open) { track('faq_open', { question: item.querySelector('summary').textContent.trim().slice(0, 80), lp: 'veterinary' }); }
    });
  });
})();
