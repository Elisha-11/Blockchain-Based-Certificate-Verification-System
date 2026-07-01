const crypto = require('crypto');

/**
 * Recursively canonicalize an object for deterministic JSON serialization.
 * Sorts all object keys alphabetically and normalizes array ordering.
 * 
 * @param {*} obj - The value to canonicalize
 * @returns {*} The canonicalized value
 * @private
 */
function canonicalize(obj) {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj
      .map(item => canonicalize(item))
      .sort((a, b) => {
        const strA = typeof a === 'object' ? JSON.stringify(a) : String(a);
        const strB = typeof b === 'object' ? JSON.stringify(b) : String(b);
        return strA.localeCompare(strB);
      });
  }
  
  const sorted = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = canonicalize(obj[key]);
  }
  return sorted;
}

/**
 * Generates a deterministic SHA-256 hash for certificate verification.
 * Supports multiple certificate types: university_degree, grade12_result, technical_cert.
 * 
 * Normalization rules:
 * - Strings: trimmed, lowercased (except candidate_number which is uppercased)
 * - Objects: keys sorted alphabetically at all nesting levels
 * - Arrays: items sorted by stringified representation
 * - Null/undefined/empty values: excluded from hash input
 * 
 * @param {Object} data - Certificate data object
 * @param {string} data.cert_id - Unique certificate identifier
 * @param {string} [data.certificate_type='university_degree'] - Type of certificate
 * @param {string} data.student_name - Student full name
 * @param {string} data.institution_id - Institution UUID
 * @param {string} data.issue_date - Issue date in ISO format
 * @param {string} [data.candidate_number] - Examination candidate number (for ECZ)
 * @param {string} [data.program] - Academic program name (for university degrees)
 * @param {Object} [data.metadata] - Additional type-specific data
 * @returns {string} SHA-256 hash as hexadecimal string
 */
function generateDeterministicHash(data) {
  const rawPayload = {
    cert_id: normalizeString(data.cert_id),
    certificate_type: normalizeString(data.certificate_type, 'university_degree'),
    student_name: normalizeString(data.student_name, '', true),
    institution_id: normalizeString(data.institution_id),
    issue_date: normalizeString(data.issue_date),
    candidate_number: data.candidate_number 
      ? normalizeString(data.candidate_number, '', false, true) 
      : null,
    program: data.program 
      ? normalizeString(data.program, '', true) 
      : null,
    metadata: data.metadata || null
  };

  const cleanedPayload = removeEmptyValues(rawPayload);
  const canonicalPayload = canonicalize(cleanedPayload);
  const canonicalJSON = JSON.stringify(canonicalPayload);
  
  return crypto.createHash('sha256').update(canonicalJSON).digest('hex');
}

/**
 * Normalizes a string value for consistent hashing.
 * 
 * @param {*} value - The value to normalize
 * @param {string} [defaultValue=''] - Default if value is null/undefined
 * @param {boolean} [toLowerCase=false] - Convert to lowercase
 * @param {boolean} [toUpperCase=false] - Convert to uppercase (mutually exclusive with toLowerCase)
 * @returns {string} Normalized string
 * @private
 */
function normalizeString(value, defaultValue = '', toLowerCase = false, toUpperCase = false) {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  
  let normalized = String(value).trim();
  if (!normalized) {
    return defaultValue;
  }
  
  if (toUpperCase) {
    return normalized.toUpperCase();
  }
  if (toLowerCase) {
    return normalized.toLowerCase();
  }
  return normalized;
}

/**
 * Removes null, undefined, and empty string values from an object.
 * 
 * @param {Object} obj - The object to clean
 * @returns {Object} Cleaned object
 * @private
 */
function removeEmptyValues(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined && value !== '') {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Verifies that two hash strings match using constant-time comparison.
 * Prevents timing attacks on hash verification.
 * 
 * @param {string} hash1 - First hash value
 * @param {string} hash2 - Second hash value
 * @returns {boolean} True if hashes match, false otherwise
 */
function verifyHashMatch(hash1, hash2) {
  if (!hash1 || !hash2 || typeof hash1 !== 'string' || typeof hash2 !== 'string') {
    return false;
  }
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash1, 'hex'),
      Buffer.from(hash2, 'hex')
    );
  } catch (error) {
    // Handle case where hashes are different lengths
    return false;
  }
}

module.exports = {
  generateDeterministicHash,
  verifyHashMatch
};