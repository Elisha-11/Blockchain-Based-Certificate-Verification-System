// backend/utils/hashBuilder.js

const normalizeIssueDate = (dateValue) => {
  if (!dateValue) return '';
  
  // If it's already a string in YYYY-MM-DD format, use it directly
  // This bypasses ALL Date object parsing bugs
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
    return dateValue.substring(0, 10);
  }
  
  // Only use Date constructor as absolute last resort for non-standard formats
  try {
    const d = new Date(dateValue);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  } catch (e) {}
  
  // Fallback: just take first 10 chars of whatever we got
  return String(dateValue).substring(0, 10);
};

exports.buildCertificateHashInput = (certId, baseData, typeFields = {}) => {
  return {
    cert_id: String(certId || '').trim(),
    certificate_type: String(baseData?.certificate_type || 'university').trim().toLowerCase(),
    student_name: String(baseData?.student_name || '').trim().toLowerCase(),
    institution_id: String(baseData?.institution_id || '').trim(),
    issue_date: normalizeIssueDate(baseData?.issue_date),
    candidate_number: typeFields.candidate_number 
      ? String(typeFields.candidate_number).trim() 
      : null,
    program: typeFields.program 
      ? String(typeFields.program).trim() 
      : null,
    class_of_degree: typeFields.class_of_degree || null,
    // Pulled out of metadata into the top-level hash input so generateDeterministicHash
    // hashes it. Null for pre-classification certificates, which keeps their
    // hash unchanged — see the classification note in utils/crypto.js.
    classification: typeFields.metadata?.classification || null,
    metadata: {}
  };
};