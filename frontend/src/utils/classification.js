// frontend/src/utils/classification.js

/**
 * Mirrors backend/utils/classification.js.
 *
 * Kept in step with the backend deliberately rather than fetched: the issuance
 * form needs the vocabulary to render its dropdown before any request is made,
 * and the examination preview needs the derivation to show an officer what
 * classification the grades they are typing will produce.
 *
 * The backend remains the authority — it recomputes the classification on
 * issuance and hashes its own result, so a tampered copy of this file changes
 * what the form displays but never what gets stored or verified.
 */

export const CLASSIFICATIONS = ['Distinction', 'Merit', 'Credit', 'Pass'];

const AGGREGATE_SUBJECT_COUNT = 6;

const AGGREGATE_BANDS = [
  { maxAggregate: 12, classification: 'Distinction' },
  { maxAggregate: 24, classification: 'Merit' },
  { maxAggregate: 30, classification: 'Credit' },
  { maxAggregate: Infinity, classification: 'Pass' }
];

/** Tailwind classes per classification, so the badge reads the same everywhere. */
export const CLASSIFICATION_STYLES = {
  Distinction: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  Merit: 'bg-blue-100 text-blue-800 border-blue-300',
  Credit: 'bg-amber-100 text-amber-800 border-amber-300',
  Pass: 'bg-gray-100 text-gray-700 border-gray-300'
};

function gradeToPoints(grade) {
  const points = Number(String(grade ?? '').trim());
  if (!Number.isInteger(points) || points < 1 || points > 9) return null;
  return points;
}

/**
 * Previews the classification the backend will derive from these grades.
 *
 * @param {Array<{code: string, grade: string}>} subjects
 * @returns {{classification: string|null, aggregate: number|null, counted_subjects: number}}
 */
export function deriveExaminationClassification(subjects) {
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

  return { classification: band.classification, aggregate, counted_subjects: points.length };
}
