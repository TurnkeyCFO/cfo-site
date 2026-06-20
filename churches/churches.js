/* ============================================================
   churches.js — Church LP tracking + conversion event wiring
   Fires dataLayer events for GA4 + Google Ads via GTM.
   Keep this file small — parent site.js handles reveal/animation.
   ============================================================ */

(function () {
  'use strict';
  window.dataLayer = window.dataLayer || [];

  // Reveal-on-scroll (bundled from parent site.js so this LP is self-contained)
  document.addEventListener('DOMContentLoaded', function () {
    var items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (i) { i.classList.add('in-view'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in-view');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -10% 0px' });
    items.forEach(function (i) { io.observe(i); });
  });

  function track(event, params) {
    window.dataLayer.push(Object.assign({ event: event }, params || {}));
  }

  // 1. Page view with LP context
  track('lp_view', { lp: 'churches', lp_version: 'v1' });

  // 2. CTA clicks — every element with [data-cta] fires a conversion-relevant event
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-cta]');
    if (!el) return;
    var cta = el.getAttribute('data-cta');
    track('cta_click', {
      cta_id: cta,
      cta_category: cta.indexOf('book-call') === 0 ? 'calendly' :
                    cta.indexOf('estimate') === 0 ? 'instant_estimate' : 'other',
      lp: 'churches'
    });
  }, { passive: true });

  // 3. Calendly booking completion — iframe postMessage
  // 4. Instant Estimate submission — listens for postMessage from the estimate iframe
  //    (safe no-op if the Instant Estimate app doesn't emit the event yet).
  window.addEventListener('message', function (e) {
    if (!e.data) return;
    var evt = String(e.data.event || '');
    if (evt.indexOf('calendly') === 0 && evt === 'calendly.event_scheduled') {
      track('calendly_booking_complete', { lp: 'churches', conversion: 1 });
      if (typeof gtag === 'function') {
        gtag('event', 'conversion', { send_to: 'AW-17845290805/txDVCOKXzMIcELWOpr1C', value: 1.0, currency: 'USD' });
      }
    }
    if (evt === 'estimate_submitted' || evt === 'instant_estimate_submitted') {
      track('estimate_submit_complete', { lp: 'churches', conversion: 1 });
      if (typeof gtag === 'function') {
        gtag('event', 'conversion', { send_to: 'AW-XXXXXXXXX/YYYYYYYYYYY' });
      }
    }
  }, false);

  // 4. Scroll depth — 25/50/75/90 for engagement signal
  var fired = {};
  function depth() {
    var h = document.documentElement;
    var pct = Math.round((h.scrollTop + window.innerHeight) / h.scrollHeight * 100);
    [25, 50, 75, 90].forEach(function (t) {
      if (pct >= t && !fired[t]) {
        fired[t] = true;
        track('scroll_depth', { depth: t, lp: 'churches' });
      }
    });
  }
  window.addEventListener('scroll', depth, { passive: true });

  // 5. FAQ open — micro-engagement signal
  document.querySelectorAll('.faq-item').forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (item.open) {
        track('faq_open', {
          question: item.querySelector('summary').textContent.trim().slice(0, 80),
          lp: 'churches'
        });
      }
    });
  });
})();
