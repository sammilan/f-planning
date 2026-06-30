#!/usr/bin/env python3
"""
bundle.py — build index.html from src/index.html + src/core.js + src/parsers.js + src/ui.js.

Usage:
    py bundle.py            # build index.html (downloads libraries if not cached)
    py bundle.py --refresh  # re-download all libraries even if cached

Libraries are cached in src/libs/ (gitignored).  The bundled index.html is the
only output — it is self-contained, no CDN dependencies, safe to deploy to
GitHub Pages.

IMPORTANT: Always bundle from src/index.html (the template with CDN script tags).
Never re-bundle from a previously-built index.html — that breaks the PDF worker
and loses the body HTML.
"""

import base64, os, sys, urllib.request
from pathlib import Path

ROOT    = Path(__file__).parent
LIBDIR  = ROOT / "src" / "libs"
TMPL    = ROOT / "src" / "index.html"
OUTFILE = ROOT / "index.html"

REFRESH = "--refresh" in sys.argv

# ---------------------------------------------------------------------------
# Library definitions — version-pinned URLs and local cache filenames
# ---------------------------------------------------------------------------
LIBS = [
    {
        "name": "Chart.js",
        "url":  "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js",
        "file": "chart.umd.min.js",
        "tag":  '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>',
    },
    {
        "name": "pdf.js",
        "url":  "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js",
        "file": "pdf.min.js",
        "tag":  '<script src="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js"></script>',
    },
    {
        "name": "PapaParse",
        "url":  "https://unpkg.com/papaparse@5.4.1/papaparse.min.js",
        "file": "papaparse.min.js",
        "tag":  '<script src="https://unpkg.com/papaparse@5.4.1/papaparse.min.js"></script>',
    },
]

WORKER_URL      = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js"
WORKER_FILE     = "pdf.worker.min.js"
WORKER_SENTINEL = "/* BFB_WORKER_SRC:"   # start of the worker script block in template

APP_FILES = [
    ("src/core.js",    '<script src="src/core.js"></script>'),
    ("src/parsers.js", '<script src="src/parsers.js"></script>'),
    ("src/ui.js",      '<script src="src/ui.js"></script>'),
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def fetch(url: str, dest: Path, name: str) -> bytes:
    """Download url to dest, return bytes.  Uses cache unless REFRESH."""
    if not REFRESH and dest.exists():
        print(f"  [cache] {name}")
        return dest.read_bytes()
    print(f"  [download] {name} …", end="", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": "bundle.py/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    dest.write_bytes(data)
    print(f" {len(data)//1024} KB")
    return data


def replace_once(html: str, needle: str, replacement: str, label: str) -> str:
    """str.replace with exactly-one-occurrence guard.  Never uses regex."""
    count = html.count(needle)
    if count == 0:
        raise ValueError(f"Marker not found in template: {label!r}")
    if count > 1:
        raise ValueError(f"Marker appears {count} times (expected 1): {label!r}")
    return html.replace(needle, replacement, 1)

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # Verify template exists
    if not TMPL.exists():
        sys.exit(f"ERROR: template not found at {TMPL}\n"
                 "Run from the repo root: py bundle.py")

    LIBDIR.mkdir(parents=True, exist_ok=True)

    print("Fetching libraries …")
    html = TMPL.read_text(encoding="utf-8")

    # 1. Inline each CDN library (string replacement, NOT regex)
    for lib in LIBS:
        data  = fetch(lib["url"], LIBDIR / lib["file"], lib["name"])
        text  = data.decode("utf-8", errors="replace")
        inlined = f"<script>{text}</script>"
        html  = replace_once(html, lib["tag"], inlined, lib["name"])

    # 2. Inline PDF.js worker as a base64 blob URL
    worker_bytes = fetch(WORKER_URL, LIBDIR / WORKER_FILE, "pdf.js worker")
    worker_b64   = base64.b64encode(worker_bytes).decode("ascii")
    worker_script = (
        "<script>if (window.pdfjsLib) {\n"
        f'  const _wb = Uint8Array.from(atob("{worker_b64}"));\n'
        "  const _wu = URL.createObjectURL(new Blob([_wb],{type:\"application/javascript\"}));\n"
        "  pdfjsLib.GlobalWorkerOptions.workerSrc = _wu;\n"
        "}</script>"
    )
    # Find the worker script block: from <script>/* BFB_WORKER_SRC: ... to the next </script>
    sentinel_tag = f"<script>{WORKER_SENTINEL}"
    start = html.find(sentinel_tag)
    if start < 0:
        sys.exit(f"ERROR: worker sentinel not found in {TMPL}\n"
                 f"Expected a <script> block starting with: {WORKER_SENTINEL}")
    end = html.find("</script>", start) + len("</script>")
    html = html[:start] + worker_script + html[end:]

    # 3. Inline local app JS files (string replacement, NOT regex)
    for fname, tag in APP_FILES:
        fpath = ROOT / fname
        if not fpath.exists():
            sys.exit(f"ERROR: {fname} not found — run extraction first")
        content = fpath.read_text(encoding="utf-8")
        inlined = f"<script>\n{content.rstrip()}\n</script>"
        html = replace_once(html, tag, inlined, fname)

    # 4. Write output
    OUTFILE.write_text(html, encoding="utf-8")
    size_kb = OUTFILE.stat().st_size // 1024
    lines   = html.count("\n") + 1
    print(f"\nWrote {OUTFILE}  ({size_kb} KB, {lines} lines)")

    # Sanity checks
    checks = [
        ("pdfjsLib.GlobalWorkerOptions.workerSrc",  "PDF worker setup"),
        ("Chart.js",                                 "Chart.js present"),
        ("PapaParse",                                "PapaParse present"),
        ("const CAT_META",                           "CAT_META"),
        ("parseStatementLines",                      "parseStatementLines"),
        ("renderSummary",                            "renderSummary"),
        ("cdn.jsdelivr.net",                         "NO CDN REFS (unexpected)"),
        ("unpkg.com",                                "NO CDN REFS (unexpected)"),
    ]
    print("\nSanity checks:")
    errors = 0
    for needle, label in checks:
        found = needle in html
        expected = label.startswith("NO ") != found  # "NO" labels expect NOT found
        ok = found if not label.startswith("NO ") else not found
        status = "OK " if ok else "FAIL"
        if not ok:
            errors += 1
        print(f"  [{status}] {label}")
    if errors:
        print(f"\n{errors} check(s) failed — inspect {OUTFILE}")
    else:
        print("\nAll checks passed. Ready to deploy.")


if __name__ == "__main__":
    main()
