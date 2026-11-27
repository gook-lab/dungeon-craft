"""Subset one Galmuri face and rename it (OFL Reserved Font Name).

Called by scripts/build-font-subset.mjs — not meant to be run by hand.

    python font_subset.py <src.woff2> <out.woff2> <unicodes.txt> <Galmuri prefix> <new prefix>

unicodes.txt holds one hex code point per line. Prints JSON to stdout:
{"missing": [code points the source font does not have]}.

The output must draw pixel-for-pixel like the original (checked in Chrome on
canvas at 18/20/24/30px). Two settings matter for that:
- glyph_names: keep the post table glyph names (format 2). Without them
  (format 3) Chrome on macOS anti-aliased 18px text slightly differently even
  though every outline and metric was identical. Costs ~2.5 KB per face.
- recalcBBoxes=False / no range pruning: head, hhea, maxp and OS/2 keep the
  upstream values.

Needs fonttools + brotli (pip install fonttools brotli). They are a build-time
tool only, never a game dependency.
"""

import json
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

# Name IDs that carry the font's name. Copyright (0), trademark (7), designer
# (9), URLs (11, 12) and license (13, 14) stay as the author wrote them.
RENAME_IDS = {1, 3, 4, 6, 16, 17, 18, 21, 22, 25}


def main():
    src, out, unicodes_path, old, new = sys.argv[1:6]
    with open(unicodes_path, encoding="utf-8") as f:
        wanted = [int(line, 16) for line in f if line.strip()]

    font = TTFont(src, recalcTimestamp=False, recalcBBoxes=False)
    have = set(font.getBestCmap().keys())
    missing = [u for u in wanted if u not in have]

    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]  # keep kerning / any GSUB so shapes match the original
    opts.name_IDs = ["*"]
    opts.name_languages = ["*"]
    opts.notdef_outline = True
    opts.glyph_names = True
    opts.prune_unicode_ranges = False
    opts.prune_codepage_ranges = False
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=[u for u in wanted if u in have])
    sub.subset(font)

    for rec in font["name"].names:
        if rec.nameID in RENAME_IDS:
            text = rec.toUnicode()
            if old in text:
                rec.string = text.replace(old, new)

    left = [r.nameID for r in font["name"].names if r.nameID in RENAME_IDS and old in r.toUnicode()]
    if left:
        raise SystemExit("reserved name left in name IDs %s" % left)

    font.flavor = "woff2"
    font.save(out)
    print(json.dumps({"missing": missing}))


if __name__ == "__main__":
    main()
