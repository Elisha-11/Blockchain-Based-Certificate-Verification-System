const crypto = require('crypto');

exports.generateDeterministicHash = (data) => {
  const payload = {
    cert_id: data.cert_id,
    student_name: data.student_name?.trim()?.toLowerCase() || '',
    program: data.program?.trim()?.toLowerCase() || '',
    institution_id: data.institution_id,
    issue_date: data.issue_date
  };
  const canonicalJSON = JSON.stringify(
    Object.keys(payload).sort().reduce((obj, key) => {
      obj[key] = payload[key];
      return obj;
    }, {})
  );
  return crypto.createHash('sha256').update(canonicalJSON).digest('hex');
};