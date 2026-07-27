#!/usr/bin/env python
"""Build churches/index.html from church-finance-audit/index.html.

church-finance-audit/ is the source of truth for the offer page. churches/ is the
LIVE, indexed build artifact of it: same body, different head (indexable, keyword
meta, canonical /churches/ URLs) plus the JSON-LD graph that carries the old
/churches/ page's SEO equity.

Run this after EVERY edit to the source page, then commit both. Forgetting it ships
a change that is invisible on the live URL.

    python sync_to_churches.py [--check]

--check exits non-zero if churches/index.html is stale, for use as a guard.
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "index.html"
OUT = HERE.parent / "churches" / "index.html"
GRAPH = HERE / "seo-graph.json"

TITLE = "Church Bookkeeping Services | Turnkey CFO"
KEYWORDS = (
    "church bookkeeping services, church bookkeeper near me, outsourced church "
    "bookkeeping, nonprofit bookkeeping services, church accounting, clergy housing "
    "allowance bookkeeping, fund accounting for churches, church payroll services"
)


def strip_tags(html: str) -> str:
    """Plain text of an HTML fragment, for the FAQ schema."""
    text = re.sub(r"<[^>]+>", "", html)
    for ent, ch in (("&amp;", "&"), ("&nbsp;", " "), ("&middot;", "·"),
                    ("&rsquo;", "’"), ("&mdash;", "—"), ("&#10003;", "")):
        text = text.replace(ent, ch)
    return " ".join(text.split())


def faq_entities(src: str):
    """Rebuild FAQPage entries from the page's own <details> blocks, so the schema
    can never drift from what a visitor actually reads."""
    block = re.search(r'<section class="faq" id="faq">(.*?)</section>', src, re.S)
    if not block:
        raise SystemExit("sync: FAQ section not found in source page")
    out = []
    for q, a in re.findall(r"<summary>(.*?)</summary>\s*<div class=\"a\">(.*?)</div>",
                           block.group(1), re.S):
        out.append({
            "@type": "Question",
            "name": strip_tags(q),
            "acceptedAnswer": {"@type": "Answer", "text": strip_tags(a)},
        })
    if not out:
        raise SystemExit("sync: no FAQ items parsed")
    return out


def build() -> str:
    src = SRC.read_text(encoding="utf-8")
    graph = json.loads(GRAPH.read_text(encoding="utf-8"))

    for node in graph["@graph"]:
        if node.get("@type") == "FAQPage":
            node["mainEntity"] = faq_entities(src)

    html = src
    html = html.replace(
        "<title>Church Bookkeeping and Finance Operations | Turnkey CFO</title>",
        f"<title>{TITLE}</title>")
    html = html.replace(
        "<!-- Offer landing page. Intentionally noindex so it cannot cannibalize the "
        "ranking /churches/ page. -->\n"
        '<meta name="robots" content="noindex, nofollow">',
        '<meta name="robots" content="index, follow">\n'
        f'<meta name="keywords" content="{KEYWORDS}">')
    html = html.replace(
        '<meta property="og:title" content="Church Bookkeeping and Finance Operations | Turnkey CFO">',
        f'<meta property="og:title" content="{TITLE}">\n'
        f'<meta name="twitter:title" content="{TITLE}">')
    html = html.replace(
        '<meta property="og:url" content="https://turnkeycfo.com/church-finance-audit/">',
        '<meta property="og:url" content="https://turnkeycfo.com/churches/">\n'
        '<meta property="og:locale" content="en_US">')
    html = html.replace("https://turnkeycfo.com/church-finance-audit/",
                        "https://turnkeycfo.com/churches/")

    ld = ('<script type="application/ld+json">\n'
          + json.dumps(graph, indent=2, ensure_ascii=False)
          + "\n</script>\n")
    marker = "</head>"
    if marker not in html:
        raise SystemExit("sync: no </head> in source page")
    html = html.replace(marker, ld + marker, 1)

    for probe, label in (("noindex", "robots noindex"),
                         ("church-finance-audit/", "source-page URL")):
        if probe in html:
            raise SystemExit(f"sync: {label} survived into the built page")
    return html


def main() -> int:
    built = build()
    if "--check" in sys.argv:
        current = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if current == built:
            print("churches/index.html is up to date")
            return 0
        print("STALE: churches/index.html does not match the source page. "
              "Run: python sync_to_churches.py")
        return 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(built, encoding="utf-8")
    print(f"wrote {OUT} ({len(built):,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
