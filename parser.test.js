// tests/parser.test.js — regression suite for parser.js.
//
// Run with:  node tests/parser.test.js
// (zero dependencies — plain Node, no test framework needed)
//
// Every real-world input format we've discussed or hit a bug on lives here
// as a case. When you change parser.js, run this file. When you fix a new
// bug or add a new format, add a case for it here FIRST (it should fail),
// then fix parser.js until it passes. That's the "keep track of the
// training" loop — this file IS the training set.

var path = require('path');
var DimParser = require(path.join(__dirname, '..', 'parser.js'));

var passed = 0;
var failed = 0;

function approxEqual(a, b, eps) {
  return Math.abs(a - b) < (eps || 1e-9);
}

function deepApprox(actual, expected) {
  if (expected === null) return actual === null;
  if (actual === null) return false;
  for (var key in expected) {
    var ev = expected[key];
    var av = actual[key];
    if (typeof ev === 'number') {
      if (!approxEqual(av, ev, 1e-6)) return false;
    } else if (Array.isArray(ev)) {
      if (!Array.isArray(av) || av.length !== ev.length) return false;
      for (var i = 0; i < ev.length; i++) {
        if (!approxEqual(av[i], ev[i], 1e-6)) return false;
      }
    } else {
      if (av !== ev) return false;
    }
  }
  return true;
}

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name);
    console.log('      ' + e.message);
  }
}

function assertParsed(input, expected, label) {
  var raw = DimParser.normalizeQuotes(input);
  var result = DimParser.parseDims(raw);
  if (!deepApprox(result, expected)) {
    throw new Error(
      (label || input) + '\n      expected: ' + JSON.stringify(expected) +
      '\n      actual:   ' + JSON.stringify(result)
    );
  }
}

function assertNull(input, label) {
  var raw = DimParser.normalizeQuotes(input);
  var result = DimParser.parseDims(raw);
  if (result !== null) {
    throw new Error((label || input) + '\n      expected: null\n      actual:   ' + JSON.stringify(result));
  }
}

console.log('\nparser.js regression suite\n');

// ---------------------------------------------------------------------
// 1. Plain one-line "W x D x H <unit>" — the baseline case
// ---------------------------------------------------------------------
console.log('one-line, ordered numbers');

test('bed frame, cm, lowercase x', function () {
  assertParsed('180 x 90 x 75 cm', { mode: 'ordered', nums: [180, 90, 75], unit: 'cm' });
});

test('desk, cm, uppercase X', function () {
  assertParsed('120 X 60 X 75 cm', { mode: 'ordered', nums: [120, 60, 75], unit: 'cm' });
});

test('dresser, inches, unit spelled out', function () {
  assertParsed('70 x 35 x 30 in', { mode: 'ordered', nums: [70, 35, 30], unit: 'in' });
});

test('moving box, "inches" spelled fully', function () {
  assertParsed('24 x 18 x 30 inches', { mode: 'ordered', nums: [24, 18, 30], unit: 'in' });
});

test('dining table, meters, decimals', function () {
  assertParsed('1.4 x 0.9 x 0.75 m', { mode: 'ordered', nums: [1.4, 0.9, 0.75], unit: 'm' });
});

test('no unit at all (caller falls back to assumed unit)', function () {
  assertParsed('100 x 40 x 15', { mode: 'ordered', nums: [100, 40, 15], unit: null });
});

test('unicode multiplication sign instead of x', function () {
  assertParsed('100 × 40 × 15 cm', { mode: 'ordered', nums: [100, 40, 15], unit: 'cm' });
});

test('mm unit', function () {
  assertParsed('1000mm x 400mm x 150mm', { mode: 'ordered', nums: [1000, 400, 150], unit: 'mm' });
});

test('ft unit, whole numbers', function () {
  assertParsed('6 ft x 3 ft x 2 ft', { mode: 'ordered', nums: [6, 3, 2], unit: 'ft' });
});

// ---------------------------------------------------------------------
// 2. Straight/curly quote marks as inch (") and foot (') symbols
// ---------------------------------------------------------------------
console.log('\nquote-mark units (", \', and the doubled/curly variants)');

test('single straight-double-quote inches', function () {
  assertParsed('47.4" x 30.8" x 15.5"', { mode: 'ordered', nums: [47.4, 30.8, 15.5], unit: 'in' });
});

test('doubled straight apostrophe used as inches (real marketplace bug)', function () {
  assertParsed("47.4'' x 30.8'' x 15.5''", { mode: 'ordered', nums: [47.4, 30.8, 15.5], unit: 'in' });
});

test('single straight apostrophe as feet', function () {
  assertParsed("6' x 3' x 2'", { mode: 'ordered', nums: [6, 3, 2], unit: 'ft' });
});

test('curly right double quotes (iOS smart punctuation) as inches', function () {
  assertParsed('47.4” x 30.8” x 15.5”', { mode: 'ordered', nums: [47.4, 30.8, 15.5], unit: 'in' });
});

test('curly right single quotes (iOS smart punctuation) as feet', function () {
  assertParsed('6’ x 3’ x 2’', { mode: 'ordered', nums: [6, 3, 2], unit: 'ft' });
});

// ---------------------------------------------------------------------
// 3. Labeled input — leading label ("Width: 100cm"), any order, any
//    separator, works across multiple stacked lines
// ---------------------------------------------------------------------
console.log('\nlabeled, leading label ("Label: value")');

test('stacked lines, colon-separated, W/D/H order', function () {
  assertParsed('Width: 100 cm\nDepth: 40 cm\nHeight: 15 cm',
    { mode: 'labeled', w: 100, d: 40, h: 15, unit: 'cm', lengthUsedAs: null });
});

test('stacked lines, out-of-order (H then W then D)', function () {
  assertParsed('Height: 15 cm\nWidth: 100 cm\nDepth: 40 cm',
    { mode: 'labeled', w: 100, d: 40, h: 15, unit: 'cm', lengthUsedAs: null });
});

test('single-letter labels, dash-separated', function () {
  assertParsed('W - 100cm, D - 40cm, H - 15cm',
    { mode: 'labeled', w: 100, d: 40, h: 15, unit: 'cm', lengthUsedAs: null });
});

test('tab-separated spec table paste', function () {
  assertParsed('Width\t100 cm\nDepth\t40 cm\nHeight\t15 cm',
    { mode: 'labeled', w: 100, d: 40, h: 15, unit: 'cm', lengthUsedAs: null });
});

test('no colon at all, just space', function () {
  assertParsed('Width 100 cm Depth 40 cm Height 15 cm',
    { mode: 'labeled', w: 100, d: 40, h: 15, unit: 'cm', lengthUsedAs: null });
});

// ---------------------------------------------------------------------
// 4. Labeled input — trailing label ("100cm W" / "30.8\" W")
// ---------------------------------------------------------------------
console.log('\nlabeled, trailing label ("value Label") — real marketplace bug');

test('the exact reported bug: doubled-apostrophe inches, trailing H/W/D labels', function () {
  assertParsed("47.4'' H x 30.8'' W x 15.5'' D",
    { mode: 'labeled', w: 30.8, d: 15.5, h: 47.4, unit: 'in', lengthUsedAs: null });
});

test('trailing labels, plain straight double-quote', function () {
  assertParsed('30.8" W x 15.5" D x 47.4" H',
    { mode: 'labeled', w: 30.8, d: 15.5, h: 47.4, unit: 'in', lengthUsedAs: null });
});

test('trailing labels, cm, no quote marks', function () {
  assertParsed('100cm W x 40cm D x 15cm H',
    { mode: 'labeled', w: 100, d: 40, h: 15, unit: 'cm', lengthUsedAs: null });
});

test('mixed leading and trailing labels in the same string', function () {
  assertParsed('Width: 100cm, 15cm H, Depth: 40cm',
    { mode: 'labeled', w: 100, d: 40, h: 15, unit: 'cm', lengthUsedAs: null });
});

// ---------------------------------------------------------------------
// 5. "Length" used as a stand-in for Width or Depth
// ---------------------------------------------------------------------
console.log('\n"Length" filling in for a missing Width or Depth label');

test('Length used as Width when Width is missing', function () {
  var raw = DimParser.normalizeQuotes('Length: 100 cm, Depth: 40 cm, Height: 15 cm');
  var result = DimParser.parseDims(raw);
  if (!(result && result.mode === 'labeled' && result.w === 100 && result.d === 40 && result.h === 15 && result.lengthUsedAs === 'width')) {
    throw new Error('expected Length to fill Width slot, got ' + JSON.stringify(result));
  }
});

test('Length used as Depth when Width is already present but Depth is missing', function () {
  var raw = DimParser.normalizeQuotes('Width: 100 cm, Length: 40 cm, Height: 15 cm');
  var result = DimParser.parseDims(raw);
  if (!(result && result.mode === 'labeled' && result.w === 100 && result.d === 40 && result.h === 15 && result.lengthUsedAs === 'depth')) {
    throw new Error('expected Length to fill Depth slot, got ' + JSON.stringify(result));
  }
});

// ---------------------------------------------------------------------
// 6. Noisy real-world listing blobs — must skip price/SKU/weight numbers
// ---------------------------------------------------------------------
console.log('\nnoisy listing text (price / SKU / weight numbers must be ignored)');

test('pasted spec block: item number, price, dims, weight, unlabeled dims fallback', function () {
  var input = 'Item #48213 — $199.00\n100 cm\n40 cm\n15 cm\nWeight: 22 kg';
  var raw = DimParser.normalizeQuotes(input);
  var result = DimParser.parseDims(raw);
  // No W/D/H labels here, so this falls through to the guarded positional
  // scan, which must skip "48213" (SKU) and "199.00" (price) and "22" (kg).
  if (!(result && result.mode === 'ordered' && result.nums.length === 3 &&
        result.nums[0] === 100 && result.nums[1] === 40 && result.nums[2] === 15)) {
    throw new Error('expected [100, 40, 15], got ' + JSON.stringify(result));
  }
});

test('pasted spec block with explicit Width/Depth/Height labels (the chip example)', function () {
  var input = 'Item #48213 — $199.00\nWidth: 100 cm\nDepth: 40 cm\nHeight: 15 cm\nWeight: 22 kg';
  assertParsed(input, { mode: 'labeled', w: 100, d: 40, h: 15, unit: 'cm', lengthUsedAs: null });
});

test('SKU number directly adjacent to dims is skipped even without a $ sign', function () {
  var input = 'SKU 12345\n100 x 40 x 15 cm';
  var raw = DimParser.normalizeQuotes(input);
  var result = DimParser.parseDims(raw);
  if (!(result && result.mode === 'ordered' && result.nums[0] === 100)) {
    throw new Error('expected SKU number skipped, got ' + JSON.stringify(result));
  }
});

test('rating/review numbers are skipped', function () {
  var input = '4.5 stars, 230 reviews\n100 x 40 x 15 cm';
  var raw = DimParser.normalizeQuotes(input);
  var result = DimParser.parseDims(raw);
  if (!(result && result.mode === 'ordered' && result.nums[0] === 100)) {
    throw new Error('expected rating numbers skipped, got ' + JSON.stringify(result));
  }
});

// ---------------------------------------------------------------------
// 7. Natural prose must NOT be mistaken for labeled mode
//    (guards against the word "wide"/"deep"/"high" tripping the W/D/H
//    single-letter label regex)
// ---------------------------------------------------------------------
console.log('\nnegative cases: prose that must NOT trigger labeled mode');

test('natural prose "100 cm wide, 40cm deep, 15cm high" parses as ordered, not labeled', function () {
  var raw = DimParser.normalizeQuotes('100 cm wide, 40cm deep, 15cm high');
  var result = DimParser.parseDims(raw);
  if (!result || result.mode !== 'ordered') {
    throw new Error('expected ordered mode (word-boundary guard should stop "wide" matching "w"), got ' + JSON.stringify(result));
  }
});

// ---------------------------------------------------------------------
// 8. Unparseable input -> null
// ---------------------------------------------------------------------
console.log('\nunparseable input');

test('empty string', function () { assertNull(''); });
test('only two numbers', function () { assertNull('100 x 40 cm'); });
test('no numbers at all', function () { assertNull('some random text with no dims'); });
test('only one dimension label supplied', function () { assertNull('Width: 100cm'); });

// ---------------------------------------------------------------------
// 9. Output formatting — fractions, feet+inches, decimals
// ---------------------------------------------------------------------
console.log('\noutput formatting');

test('toFraction: whole inch, no remainder', function () {
  if (DimParser.toFraction(12, 16) !== '12"') throw new Error('got ' + DimParser.toFraction(12, 16));
});

test('toFraction: reduces to lowest terms', function () {
  if (DimParser.toFraction(12.5, 16) !== '12 1/2"') throw new Error('got ' + DimParser.toFraction(12.5, 16));
});

test('toFraction: rounds up to next whole when remainder rounds to the denominator', function () {
  // 12.999 at denom 8 should round the fractional part up to 8/8 -> carries to 13"
  if (DimParser.toFraction(12.999, 8) !== '13"') throw new Error('got ' + DimParser.toFraction(12.999, 8));
});

test('toFeetInches: under a foot has no feet part', function () {
  if (DimParser.toFeetInches(8.5, 16) !== '8 1/2"') throw new Error('got ' + DimParser.toFeetInches(8.5, 16));
});

test('toFeetInches: over a foot splits into feet + inches', function () {
  if (DimParser.toFeetInches(18.5, 16) !== '1\' 6 1/2"') throw new Error('got ' + DimParser.toFeetInches(18.5, 16));
});

test('formatCm: cm passthrough rounds to 1 decimal', function () {
  if (DimParser.formatCm(100.04, 'cm', 16) !== '100 cm') throw new Error('got ' + DimParser.formatCm(100.04, 'cm', 16));
});

test('formatCm: mm rounds to whole number', function () {
  if (DimParser.formatCm(100, 'mm', 16) !== '1000 mm') throw new Error('got ' + DimParser.formatCm(100, 'mm', 16));
});

test('formatCm: m to 3 decimals', function () {
  if (DimParser.formatCm(140, 'm', 16) !== '1.400 m') throw new Error('got ' + DimParser.formatCm(140, 'm', 16));
});

test('formatCm: decimal inches to 2 places', function () {
  if (DimParser.formatCm(2.54, 'indec', 16) !== '1.00"') throw new Error('got ' + DimParser.formatCm(2.54, 'indec', 16));
});

test('formatOrig: strips trailing zeros', function () {
  if (DimParser.formatOrig(100, 'cm') !== '100 cm') throw new Error('got ' + DimParser.formatOrig(100, 'cm'));
});

// ---------------------------------------------------------------------
// summary
// ---------------------------------------------------------------------
console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) process.exit(1);
