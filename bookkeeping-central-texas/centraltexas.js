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
  track('lp_view', { lp: 'bookkeeping-central-texas', lp_version: 'v1' });
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-cta]');
    if (!el) return;
    var cta = el.getAttribute('data-cta');
    track('cta_click', { cta_id: cta, cta_category: cta.indexOf('book-call') === 0 ? 'calendly' : cta.indexOf('estimate') === 0 ? 'instant_estimate' : 'other', lp: 'bookkeeping-central-texas' });
  }, { passive: true });
  window.addEventListener('message', function (e) {
    if (!e.data) return;
    var evt = String(e.data.event || '');
    if (evt === 'calendly.event_scheduled') { track('calendly_booking_complete', { lp: 'bookkeeping-central-texas', conversion: 1 }); }
    if (evt === 'estimate_submitted' || evt === 'instant_estimate_submitted') { track('estimate_submit_complete', { lp: 'bookkeeping-central-texas', conversion: 1 }); }
  });
})();
