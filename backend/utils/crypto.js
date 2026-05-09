const crypto = require('crypto');

exports.generateDeterministicHash = (data) => {
  // Normalize ALL string inputs consistently
  const payload = {
    cert_id: String(data.cert_id || '').trim(),
    student_name: String(data.student_name || '').trim().toLowerCase(),
    program: String(data.program || '').trim().toLowerCase(),
    institution_id: String(data.institution_id || '').trim(),
    issue_date: String(data.issue_date || '').trim()
  };
  
  // Canonicalize: sort keys alphabetically → stringify → SHA-256
  const sortedKeys = Object.keys(payload).sort();
  const canonicalObj = {};
  for (const key of sortedKeys) {
    canonicalObj[key] = payload[key];
  }
  const canonicalJSON = JSON.stringify(canonicalObj);
  
  return crypto.createHash('sha256').update(canonicalJSON).digest('hex');
};