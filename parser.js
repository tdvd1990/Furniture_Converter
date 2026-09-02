// parser.js — the single source of truth for Cut List's dimension-parsing
// and unit-formatting logic. Loaded as a plain <script> in the browser
// (exposes window.DimParser) and via require() in Node for the test suite
// in tests/parser.test.js. Keep ALL parsing/formatting logic in this file —
// cutlist.html / index.html should only ever call into it, never duplicate it.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DimParser = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CM_PER = { mm: 0.1, cm: 1, m: 100, in: 2.54, ft: 30.48 };
  var UNIT_LABEL = { mm: 'mm', cm: 'cm', m: 'm', in: 'in', ft: 'ft' };

  function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }

  function toFraction(value, denom) {
    var neg = value < 0;
    value = Math.abs(value);
    var whole = Math.floor(value);
    var rem = value - whole;
    var num = Math.round(rem * denom);
    if (num === denom) { whole += 1; num = 0; }
    var out;
    if (num === 0) {
      out = whole + '"';
    } else {
      var g = gcd(num, denom);
      num = num / g;
      var d = denom / g;
      out = (whole > 0 ? whole + ' ' : '') + num + '/' + d + '"';
    }
    return (neg ? '-' : '') + out;
  }

  function toFeetInches(totalInches, denom) {
    var neg = totalInches < 0;
    totalInches = Math.abs(totalInches);
    var totalUnits = Math.round(totalInches * denom);
    var wholeInches = Math.floor(totalUnits / denom);
    var num = totalUnits % denom;
    var ft = Math.floor(wholeInches / 12);
    var remIn = wholeInches % 12;
    var fracPart = '';
    if (num !== 0) {
      var g = gcd(num, denom);
      fracPart = ' ' + (num / g) + '/' + (denom / g);
    }
    var out;
    if (ft === 0) {
      out = remIn + fracPart + '"';
    } else {
      out = ft + "'" + ' ' + remIn + fracPart + '"';
    }
    return (neg ? '-' : '') + out;
  }

  // ---- parsing: labels first (handles stacked lines, colon or tab-separated
  // "table paste", any order), falling back to a noise-guarded number scan
  // for a plain one-line "100 x 40 x 15 cm" input. ----

  var UNIT_TOKEN = '(mm\\b|cm\\b|feet\\b|ft\\b|inches\\b|inch\\b|in\\b|m\\b|"|\')';
  var NUM_UNIT_RE = new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + UNIT_TOKEN + '?', 'gi');

  function normalizeUnit(u) {
    u = u.toLowerCase();
    if (u === '"' || u === 'inch' || u === 'inches') return 'in';
    if (u === "'" || u === 'feet') return 'ft';
    return u;
  }

  // Mobile keyboards and pasted listings often write inches as two straight
  // apostrophes (no easy " key) or as curly quotes (iOS smart punctuation) —
  // fold all of those to a plain " before parsing so '' isn't misread as feet.
  function normalizeQuotes(str) {
    str = str.replace(/[‘’]/g, "'");
    str = str.replace(/[“”]/g, '"');
    str = str.replace(/''/g, '"');
    return str;
  }

  // "100cm W" / "30.8\" W" — the label trails the number, as on many spec sheets.
  function findTrailingLabelValue(str, labelAlt) {
    var re = new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + UNIT_TOKEN + '?\\s*\\b(?:' + labelAlt + ')\\b', 'i');
    var m = re.exec(str);
    if (!m) return null;
    return { value: parseFloat(m[1]), unit: m[2] ? normalizeUnit(m[2]) : null };
  }

  // "Width: 100cm" — the label leads the number.
  function findLeadingLabelValue(str, labelAlt) {
    var re = new RegExp('\\b(?:' + labelAlt + ')\\b\\s*[:\\-]?\\s*(\\d+(?:\\.\\d+)?)\\s*' + UNIT_TOKEN + '?', 'i');
    var m = re.exec(str);
    if (!m) return null;
    return { value: parseFloat(m[1]), unit: m[2] ? normalizeUnit(m[2]) : null };
  }

  function findLabelValue(str, labelAlt) {
    return findLeadingLabelValue(str, labelAlt) || findTrailingLabelValue(str, labelAlt);
  }

  function tryLabeledParse(str) {
    var wM = findLabelValue(str, 'width|w');
    var dM = findLabelValue(str, 'depth|d');
    var hM = findLabelValue(str, 'height|h');
    var lM = findLabelValue(str, 'length|l');

    var lengthUsedAs = null;
    if (!wM && lM) { wM = lM; lengthUsedAs = 'width'; }
    else if (!dM && lM) { dM = lM; lengthUsedAs = 'depth'; }

    if (!wM || !dM || !hM) return null;

    var unit = wM.unit || dM.unit || hM.unit || (lM && lM.unit) || null;
    return { w: wM.value, d: dM.value, h: hM.value, unit: unit, lengthUsedAs: lengthUsedAs };
  }

  // Numbers near price/SKU/weight/rating words are almost never the dimension
  // someone meant — skip them unless they carry an explicit length unit.
  var EXCLUDE_WORDS = ['sku', 'item', 'model', 'qty', 'quantity', 'pack', 'price', 'usd',
    'kg', 'kilogram', 'kilograms', 'lb', 'lbs', 'pound', 'pounds', 'oz', 'ounce', 'ounces',
    'gram', 'grams', 'weight', 'rating', 'review', 'reviews', 'star', 'stars'];

  function isExcluded(str, start, end) {
    // Look back/forward for exclusion keywords, but never across a line
    // break — "SKU 12345" on one line shouldn't poison a "100 cm" that
    // happens to sit within 16 characters of it on the *next* line.
    var before = str.slice(Math.max(0, start - 16), start);
    var beforeNl = before.lastIndexOf('\n');
    if (beforeNl !== -1) before = before.slice(beforeNl + 1);
    before = before.toLowerCase();

    var after = str.slice(end, end + 10);
    var afterNl = after.indexOf('\n');
    if (afterNl !== -1) after = after.slice(0, afterNl);
    after = after.toLowerCase();

    if (/[$#]\s*$/.test(before)) return true;
    if (/^\s*%/.test(after)) return true;
    for (var i = 0; i < EXCLUDE_WORDS.length; i++) {
      if (before.indexOf(EXCLUDE_WORDS[i]) !== -1 || after.indexOf(EXCLUDE_WORDS[i]) !== -1) return true;
    }
    return false;
  }

  function parseGuardedNumbers(str) {
    var re = new RegExp(NUM_UNIT_RE.source, 'gi');
    var nums = [];
    var detected = null;
    var m;
    while ((m = re.exec(str)) !== null) {
      if (m[1] === undefined) { if (m.index === re.lastIndex) re.lastIndex++; continue; }
      var hasUnit = !!m[2];
      if (!hasUnit && isExcluded(str, m.index, re.lastIndex)) {
        if (m.index === re.lastIndex) re.lastIndex++;
        continue;
      }
      nums.push(parseFloat(m[1]));
      if (!detected && hasUnit) detected = normalizeUnit(m[2]);
      if (nums.length >= 3) break;
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    if (nums.length < 3) return null;
    return { nums: nums, unit: detected };
  }

  function parseDims(str) {
    var labeled = tryLabeledParse(str);
    if (labeled) return { mode: 'labeled', w: labeled.w, d: labeled.d, h: labeled.h, unit: labeled.unit, lengthUsedAs: labeled.lengthUsedAs };
    var guarded = parseGuardedNumbers(str);
    if (guarded) return { mode: 'ordered', nums: guarded.nums, unit: guarded.unit };
    return null;
  }

  function orderToWDH(nums, order) {
    if (order === 'hwd') {
      return { h: nums[0], w: nums[1], d: nums[2] };
    }
    return { w: nums[0], d: nums[1], h: nums[2] };
  }

  function round1(v) {
    var r = Math.round(v * 10) / 10;
    return (r % 1 === 0) ? r.toFixed(0) : r.toFixed(1);
  }

  function formatCm(cmVal, unit, denom) {
    switch (unit) {
      case 'mm': return Math.round(cmVal * 10) + ' mm';
      case 'cm': return round1(cmVal) + ' cm';
      case 'm': return (cmVal / 100).toFixed(3) + ' m';
      case 'indec': return (cmVal / CM_PER.in).toFixed(2) + '"';
      case 'ftin': return toFeetInches(cmVal / CM_PER.in, denom);
      case 'infrac':
      default: return toFraction(cmVal / CM_PER.in, denom);
    }
  }

  function formatOrig(value, unit) {
    var precision = (unit === 'mm') ? 0 : (unit === 'm' ? 2 : 1);
    var s = value.toFixed(precision).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    return s + ' ' + UNIT_LABEL[unit];
  }

  return {
    CM_PER: CM_PER,
    UNIT_LABEL: UNIT_LABEL,
    gcd: gcd,
    toFraction: toFraction,
    toFeetInches: toFeetInches,
    normalizeUnit: normalizeUnit,
    normalizeQuotes: normalizeQuotes,
    findTrailingLabelValue: findTrailingLabelValue,
    findLeadingLabelValue: findLeadingLabelValue,
    findLabelValue: findLabelValue,
    tryLabeledParse: tryLabeledParse,
    isExcluded: isExcluded,
    parseGuardedNumbers: parseGuardedNumbers,
    parseDims: parseDims,
    orderToWDH: orderToWDH,
    round1: round1,
    formatCm: formatCm,
    formatOrig: formatOrig
  };
});
