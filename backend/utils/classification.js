// backend/utils/classification.js

/**
 * The single classification vocabulary used by every credential type
 * (university degrees, technical diplomas and examination results), so a
 * verifier reads the same four words whatever the certificate is.
 *
 * Order matters: best first. Used to render dropdowns and to validate input.
 */
const CLASSIFICATIONS = ['Distinction', 'Merit', 'Credit', 'Pass'];

/**
 * How many subjects count towards an examination aggregate. ECZ computes the
 * aggregate from a candidate's best six subjects; a candidate sitting fewer
 * than six is scored on whatever they sat.
 */
const AGGREGATE_SUBJECT_COUNT = 6;

/**
 * Aggregate bands, checked in order — the first band whose `maxAggregate` the
 * aggregate does not exceed wins. These mirror the ECZ divisions (I: 6-12,
 * II: 13-24, III: 25-30, IV: 31-36) collapsed onto the four classifications,
 * with 'Pass' as the open-ended floor so every aggregate maps to something.
 *
 * Kept as data rather than an if-chain so the bands can be retuned in one
 * place without touching the derivation logic.
 */
const AGGREGATE_BANDS = [
  { maxAggregate: 12, classification: 'Distinction' },
  { maxAggregate: 24, classification: 'Merit' },
  { maxAggregate: 30, classification: 'Credit' },
  { maxAggregate: Infinity, classification: 'Pass' }
];

/**
 * Validates a manually chosen classification (university / technical).
 * Matching is case-insensitive but the stored value is always the canonical
 * capitalisation, because the classification is part of the certificate hash
 * and 'merit' must not hash differently from 'Merit'.
 *
 * @param {*} value - Raw classification from the request body
 * @returns {string|null} Canonical classification, or null if absent
 * @throws {Error} If a value was supplied but is not one of CLASSIFICATIONS
 */
function normalizeClassification(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }

  const candidate = String(value).trim().toLowerCase();
  const match = CLASSIFICATIONS.find((c) => c.toLowerCase() === candidate);

  if (!match) {
    throw new Error(
      `classification must be one of: ${CLASSIFICATIONS.join(', ')}`
    );
  }

  return match;
}

/**
 * Parses a single subject grade into aggregate points.
 *
 * ECZ grades are 1 (best) to 9 (worst) and the aggregate is their sum, so the
 * grade doubles as its own point value. Anything unparseable is rejected
 * rather than silently scored, so a typo cannot quietly inflate a result.
 *
 * @param {*} grade - Raw grade as entered by the issuing officer
 * @returns {number|null} Points, or null if the grade is not a 1-9 value
 */
function gradeToPoints(grade) {
  const points = Number(String(grade ?? '').trim());

  if (!Number.isInteger(points) || points < 1 || points > 9) {
    return null;
  }

  return points;
}

/**
 * Derives an examination classification from the subject grades themselves,
 * so the issuing clerk cannot choose a candidate's classification by hand —
 * it falls out of the grades that are already on the certificate.
 *
 * @param {Array<{code: string, grade: string}>} subjects
 * @returns {{classification: string|null, aggregate: number|null, counted_subjects: number}}
 */
function deriveExaminationClassification(subjects) {
  const points = (Array.isArray(subjects) ? subjects : [])
    .map((subject) => gradeToPoints(subject?.grade))
    .filter((p) => p !== null)
    .sort((a, b) => a - b)
    .slice(0, AGGREGATE_SUBJECT_COUNT);

  if (points.length === 0) {
    return { classification: null, aggregate: null, counted_subjects: 0 };
  }

  const aggregate = points.reduce((sum, p) => sum + p, 0);
  const band = AGGREGATE_BANDS.find((b) => aggregate <= b.maxAggregate);

  return {
    classification: band.classification,
    aggregate,
    counted_subjects: points.length
  };
}

module.exports = {
  CLASSIFICATIONS,
  AGGREGATE_SUBJECT_COUNT,
  AGGREGATE_BANDS,
  normalizeClassification,
  deriveExaminationClassification,
  gradeToPoints
};
