#!/usr/bin/env python3
"""Generate witness-pack QR targets for the demo desk.

Creates one witness-pack per defense scenario (persisted in SQLite, so the links
survive an agent restart), then writes a print-ready HTML sheet with a QR code
per scenario plus the digest wall and pilot form.

Usage:
  bash scripts/witness-qr.sh                 # defaults: http://localhost:3001
  BASE_URL=https://bothy.trustfall.xyz bash scripts/witness-qr.sh

Output: apps/agent/data/witness-sheet.html  (open in a browser, print to A4)
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

BASE_APP = os.environ.get("BASE_URL", "http://localhost:3001")
AGENT = os.environ.get("AGENT_URL", "http://127.0.0.1:8787")
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/agent/data/witness-sheet.html"

SCENARIOS = [
    ("loitering-bom", "Loitering munition — 8-hop BOM"),
    ("gallium-exposure", "Primary gallium dependency"),
    ("chn-ownership", "NATO firms with CHN parents"),
    ("taiwan-chokepoint", "Primes behind the Taiwan Strait"),
    ("sanctions-exposure", "Sanctioned-parent facilities"),
    ("red-sea-d01", "Red Sea disruption D01"),
    ("ukr-energy-near", "Ukrainian plant proximity"),
    ("logistics-high-risk", "High-risk shipments"),
]


def post(path, body):
    req = urllib.request.Request(
        f"{AGENT}{path}",
        data=json.dumps(body).encode(),
        headers={"content-type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def get(path):
    with urllib.request.urlopen(f"{AGENT}{path}", timeout=30) as r:
        return json.loads(r.read())


def qr_svg(data: str) -> str:
    """Inline SVG QR (no PIL, no network)."""
    import qrcode
    import qrcode.image.svg

    img = qrcode.make(data, image_factory=qrcode.image.svg.SvgPathImage, box_size=6, border=1)
    return img.to_string().decode()


def main():
    try:
        rows = get("/api/graph/scenarios")
    except Exception as e:
        print(f"agent not reachable at {AGENT}: {e}", file=sys.stderr)
        print("run: bash scripts/venue.sh", file=sys.stderr)
        return 1

    catalogue = {s["id"]: s for s in (rows.get("scenarios") or rows)}

    entries = []
    for sid, label in SCENARIOS:
        try:
            res = post(f"/api/graph/scenario/{sid}/run", {})
        except Exception as e:
            print(f"  skip {sid}: {e}")
            continue
        pack = post("/api/graph/witness", {
            "scenarioId": sid,
            "officer": "demo-desk",
            "rows": res.get("rows", [])[:25],
        })
        url = f"{BASE_APP}/witness/{pack['hash']}"
        entries.append({
            "label": label,
            "url": url,
            "hash": pack["hash"],
            "count": res.get("count", 0),
            "ms": res.get("ms", 0),
            "stakes": (catalogue.get(sid) or {}).get("stakes", ""),
        })
        print(f"  {sid}: {res.get('count')} rows in {res.get('ms')}ms -> {url}")

    extra = [
        ("Digest wall — the forward loop", f"{BASE_APP}/digest"),
        ("Pilot one-pager + request form", f"{BASE_APP}/pilot"),
        ("Watch room — run it yourself", f"{BASE_APP}/watch"),
    ]

    cards = []
    for e in entries:
        cards.append(f"""
    <figure class="card">
      <div class="qr">{qr_svg(e['url'])}</div>
      <figcaption>
        <strong>{e['label']}</strong>
        <span class="meta">{e['count']} rows · {round(e['ms'],1)}ms · hash {e['hash'][:10]}…</span>
        <span class="stakes">{e['stakes']}</span>
        <code>{e['url']}</code>
      </figcaption>
    </figure>""")
    for label, url in extra:
        cards.append(f"""
    <figure class="card">
      <div class="qr">{qr_svg(url)}</div>
      <figcaption>
        <strong>{label}</strong>
        <span class="meta">scan to open</span>
        <code>{url}</code>
      </figcaption>
    </figure>""")

    html = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Bothy witness QR sheet</title>
<style>
  :root {{ color-scheme: light; }}
  body {{ font: 14px/1.45 ui-sans-serif, system-ui, sans-serif; margin: 24px; color: #101418; }}
  h1 {{ font-size: 20px; margin: 0 0 4px; }}
  p.sub {{ margin: 0 0 20px; color: #55606d; }}
  .grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }}
  .card {{ margin: 0; border: 1px solid #ccd3db; border-radius: 10px; padding: 12px; display: flex; gap: 12px; }}
  .qr {{ width: 120px; flex: 0 0 120px; }}
  .qr svg {{ width: 120px; height: 120px; }}
  figcaption {{ display: flex; flex-direction: column; gap: 3px; min-width: 0; }}
  .meta {{ color: #55606d; font: 11px/1.4 ui-monospace, Menlo, monospace; }}
  .stakes {{ color: #2c343d; font-size: 12px; }}
  code {{ font: 10px/1.35 ui-monospace, Menlo, monospace; word-break: break-all; color: #2c343d; }}
  @media print {{ body {{ margin: 12mm; }} .card {{ break-inside: avoid; }} }}
</style></head>
<body>
  <h1>Bothy — witness-pack QR sheet</h1>
  <p class="sub">Every scan is a user you didn't pitch. Packs are hash-linked and persisted in SQLite
  ({len(entries)} scenarios), so these links survive an agent restart.</p>
  <div class="grid">{''.join(cards)}</div>
</body></html>"""

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html)
    print(f"\nwrote {OUT}")
    print("open it, print to A4, cut the cards.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())