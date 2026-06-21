document.addEventListener("DOMContentLoaded", () => {
  const revealItems = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("in-view"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16, rootMargin: "0px 0px -10% 0px" }
  );

  revealItems.forEach((item) => observer.observe(item));

  // CTA click tracking hook — once GTM is wired, events push to dataLayer
  document.querySelectorAll("[data-cta]").forEach((el) => {
    el.addEventListener("click", () => {
      if (window.dataLayer) {
        window.dataLayer.push({
          event: "cta_click",
          cta_label: el.getAttribute("data-cta"),
        });
      }
    });
  });
});

// Desktop-only hero video. On mobile the file is NEVER downloaded (saves ~12MB
// on phones) — the section is hidden by CSS and we skip attaching the source.
(function () {
  var v = document.getElementById("video-hero-media");
  if (!v) return;
  var isDesktop = window.matchMedia && window.matchMedia("(min-width: 769px)").matches;
  if (!isDesktop) return;
  var src = v.getAttribute("data-src");
  if (!src) return;
  var s = document.createElement("source");
  s.src = src;
  s.type = "video/mp4";
  v.appendChild(s);
  v.setAttribute("autoplay", "");
  v.load();
  var p = v.play();
  if (p && p.catch) p.catch(function () {});
})();

// Calendly + its Stripe dependency load only when the booking widget nears the
// viewport (saves ~2.5MB + Stripe on first paint). Header/CTA "Book Call" links
// open calendly.com directly and don't need the embed.
(function () {
  var widget = document.querySelector(".calendly-inline-widget");
  if (!widget) return;
  var loaded = false;
  function loadCalendly() {
    if (loaded) return;
    loaded = true;
    var css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://assets.calendly.com/assets/external/widget.css";
    document.head.appendChild(css);
    var js = document.createElement("script");
    js.src = "https://assets.calendly.com/assets/external/widget.js";
    js.async = true;
    document.body.appendChild(js);
  }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            loadCalendly();
            io.disconnect();
          }
        });
      },
      { rootMargin: "600px" }
    );
    io.observe(widget);
  } else {
    loadCalendly();
  }
})();
