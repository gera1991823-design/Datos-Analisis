#!/usr/bin/env python3
"""Compare the reconciled UI's operational contract with the pinned main commit."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import hashlib
import json
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
BASE = "faa906368d868016e92c2ae0b1067d4cb0782767"
PR = "5400d87f9932d151a273708bfa0c5267458b82cd"


class Document(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.ids = []
        self.controls = []
        self.options = []
        self.links = []
        self.headings = 0
        self.portal_cards = []
        self.labels = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.append(a["id"])
        if tag in {"input", "select", "textarea", "button"}:
            # Classes/labels may change. Values and event hooks must not.
            keys = {"id", "type", "accept", "min", "max", "step", "multiple",
                    "required", "readonly", "value", "name", "disabled"}
            self.controls.append((tag, sorted((k, v) for k, v in attrs
                                             if k in keys or k.startswith("data-"))))
        if tag == "option":
            self.options.append(sorted(attrs))
        if tag == "th":
            self.headings += 1
        if tag == "a" and a.get("href"):
            self.links.append(a["href"])
            if "app-card" in a.get("class", "").split():
                self.portal_cards.append(attrs)
        if tag == "label" and "for" in a:
            self.labels.append(a["for"])


def blocks(data, tag):
    return re.findall(rb"<" + tag + rb"\b[^>]*>.*?</" + tag + rb">", data, re.S | re.I)


def main():
    report = {"main": BASE, "pr": PR, "files": [], "scope": "static contract, not live Firebase"}
    all_ids = 0
    for path in sorted(ROOT.glob("*.html")):
        baseline = subprocess.check_output(["git", "show", f"{BASE}:{path.name}"], cwd=ROOT)
        current = path.read_bytes()
        assert blocks(baseline, b"script") == blocks(current, b"script"), f"Scripts changed: {path.name}"
        assert blocks(baseline, b"style") == blocks(current, b"style"), f"Original CSS changed: {path.name}"
        a, b = Document(baseline.decode()), Document(current.decode())
        assert a.ids == b.ids, f"Functional IDs changed: {path.name}"
        assert not [k for k, v in Counter(b.ids).items() if v > 1], f"Duplicate IDs: {path.name}"
        assert a.controls == b.controls, f"Controls changed: {path.name}"
        assert a.options == b.options, f"Stored option values changed: {path.name}"
        assert a.headings == b.headings, f"Table schema changed: {path.name}"
        assert a.portal_cards == b.portal_cards, "Current portal cards changed"
        assert not (Counter(a.links) - Counter(b.links)), f"Original links missing: {path.name}"
        assert all(label in b.ids for label in b.labels), f"Label target missing: {path.name}"
        assert current.count(b'href="interagrovial-ui.css"') == 1, path.name
        for link in b.links:
            if ":" in link or link.startswith("#"):
                continue
            from urllib.parse import unquote
            assert (ROOT / unquote(link.split("#")[0])).exists(), f"Missing local route: {link}"
        # Syntax-check all original executable scripts, including module imports.
        for script in blocks(current, b"script"):
            body = script.split(b">", 1)[1].rsplit(b"</script>", 1)[0]
            if not body.strip():
                continue
            with tempfile.NamedTemporaryFile(suffix=".mjs") as temp:
                temp.write(body)
                temp.flush()
                subprocess.run(["node", "--check", temp.name], check=True, capture_output=True)
        assert not re.search(rb"^(<<<<<<< |=======|>>>>>>> )", current, re.M), path.name
        all_ids += len(b.ids)
        report["files"].append({"file": path.name, "ids": len(b.ids), "scripts": len(blocks(current, b"script")),
                                "table_columns": b.headings,
                                "script_sha256": hashlib.sha256(b"".join(blocks(current, b"script"))).hexdigest()})
        print(f"PASS {path.name}: scripts, IDs, controls, options, columns, routes and JS syntax")
    report["ids"] = all_ids
    report["result"] = "PASS"
    output = ROOT / "test-results" / "contract.json"
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(f"PASS: {all_ids} IDs preserved; main {BASE[:7]} and PR {PR[:7]}")


if __name__ == "__main__":
    main()
