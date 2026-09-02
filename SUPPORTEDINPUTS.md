# What Cut List can parse

A plain-language reference for every input shape the parser recognizes. If
you find something real (a marketplace listing, a spec sheet) that doesn't
parse the way you'd expect, add it as a case in `tests/parser.test.js` and
fix `parser.js` until it passes — see that file's header comment for the
loop.

The parser tries two strategies, in order, on whatever you type or paste:

1. **Labeled parsing** — looks for Width/Depth/Height (or Length as a
   stand-in) labels anywhere in the text and pulls the number next to each
   one, regardless of order or line breaks.
2. **Ordered number scan** — if no labels are found, it just takes the
   first three numbers it sees left-to-right (skipping numbers that are
   clearly a price, SKU, weight, or rating), and assigns them to
   Width/Depth/Height using whichever order you've selected in the toggle.

Units can be mixed into either strategy or left off entirely (in which case
the "assume ___" dropdown is used).

## 1. A single line of numbers

```
180 x 90 x 75 cm
120 X 60 X 75 cm          (uppercase X works too)
1.4 x 0.9 x 0.75 m         (decimals)
70 × 35 × 30 in            (unicode × sign)
100 x 40 x 15              (no unit — falls back to the "assume" dropdown)
```

Recognized units, in any position: `mm`, `cm`, `m`, `in`, `inch`, `inches`,
`ft`, `feet`, `"`, `'`. Only the first number found with a unit sets the
unit for all three — you don't need to repeat it three times.

## 2. Quote marks as inch/foot symbols

Real listings almost never type `in` or `ft` — they use tick marks.

```
47.4" x 30.8" x 15.5"      → inches
6' x 3' x 2'                → feet
47.4'' x 30.8'' x 15.5''    → inches (doubled apostrophe, common when a
                               keyboard has no dedicated " key)
47.4” x 30.8” x 15.5”       → inches (curly "smart quote", common from iOS
                               copy/paste)
6’ x 3’ x 2’                 → feet (curly smart apostrophe)
```

## 3. Labels, leading ("Label: value")

Any order, any of these separators (colon, dash, or nothing), and it works
across multiple stacked lines just as well as one line:

```
Width: 100 cm
Depth: 40 cm
Height: 15 cm

W - 100cm, D - 40cm, H - 15cm

Height: 15 cm
Width: 100 cm
Depth: 40 cm
```

Single letters (`W`, `D`, `H`, `L`) work the same as the full words, as
long as they're a whole word — "100 cm **w**ide" won't accidentally match
the `W` label (word-boundary protected).

## 4. Labels, trailing ("value Label")

Common on spec sheets and some marketplace listings where the label comes
*after* the number instead of before:

```
100cm W x 40cm D x 15cm H
30.8" W x 15.5" D x 47.4" H
47.4'' H x 30.8'' W x 15.5'' D
```

Leading and trailing styles can even be mixed in the same paste.

## 5. "Length" filling in for a missing Width or Depth

Some listings say Length instead of Width or Depth. If Width is missing,
Length is used as Width; if Width is present but Depth is missing, Length
is used as Depth instead. The on-screen hint always tells you which one it
picked.

```
Length: 100 cm
Depth: 40 cm
Height: 15 cm
→ Length used as Width

Width: 100 cm
Length: 40 cm
Height: 15 cm
→ Length used as Depth
```

## 6. Tab-separated or pasted spec tables

Copy-pasting a two-column spec table (from a PDF, a product page, a
spreadsheet) usually comes through with tabs between the label and value —
this is treated the same as a colon:

```
Width	100 cm
Depth	40 cm
Height	15 cm
```

## 7. Noisy real-world listing text

A pasted product listing often has a price, SKU/item number, weight, or
star rating mixed in with the dimensions. Any bare number (no unit)
sitting next to one of these words is skipped, so it won't get mistaken
for a dimension:

```
Item #48213 — $199.00
100 cm
40 cm
15 cm
Weight: 22 kg
→ reads only 100 / 40 / 15

4.5 stars, 230 reviews
100 x 40 x 15 cm
→ reads only 100 / 40 / 15
```

Excluded-word list: `sku`, `item`, `model`, `qty`, `quantity`, `pack`,
`price`, `usd`, `kg`/`kilogram(s)`, `lb`/`lbs`/`pound(s)`,
`oz`/`ounce(s)`, `gram(s)`, `weight`, `rating`, `review(s)`,
`star(s)` — plus anything right after a `$` or `#`, or right before a `%`.
This guard only applies to *unlabeled* numbers with no unit; a number with
an explicit label (Width:) or unit (100cm) is always trusted, even if a
price sits nearby.

## 8. What does NOT parse (by design)

- Fewer than three numbers, or only one dimension label with the other
  two missing.
- Plain prose without labels or clear separators, e.g. a sentence with
  the numbers buried in unrelated context and no `x`/`×`/label to anchor
  them.

In both cases the app shows "Still looking for three numbers —" and
leaves the results blank rather than guessing.

## Where this lives in code

- `parser.js` — the actual parsing/formatting logic (framework-free, runs
  in the browser and in Node).
- `tests/parser.test.js` — the regression suite. Every example in this
  document has a matching test case. Run it with `node tests/parser.test.js`
  any time you touch `parser.js`.
