const cryptoUtils = require('./utils/crypto');

function runTests() {
  console.log('Running deterministic hashing tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Same data, different formatting and ordering -> should produce identical hash
  const cert1 = {
    cert_id: 'CERT-123',
    certificate_type: 'grade12_result',
    student_name: 'John Doe',
    institution_id: 'ecz-uuid-here',
    issue_date: '2025-12-01',
    candidate_number: '123456789',
    metadata: {
      exam_year: 2025,
      subjects: [{ code: 'MAT', grade: '1' }, { code: 'ENG', grade: '2' }]
    }
  };
  
  const cert2 = {
    cert_id: '  CERT-123  ',
    certificate_type: '  grade12_result  ',
    student_name: '  JOHN DOE  ',
    institution_id: 'ecz-uuid-here',
    issue_date: '2025-12-01',
    candidate_number: ' 123456789 ',
    metadata: {
      subjects: [{ grade: '2', code: 'ENG' }, { code: 'MAT', grade: '1' }],
      exam_year: 2025
    }
  };
  
  const hash1 = cryptoUtils.generateDeterministicHash(cert1);
  const hash2 = cryptoUtils.generateDeterministicHash(cert2);
  const test1Pass = hash1 === hash2;
  
  console.log('Test 1: Same data, different formatting and ordering');
  console.log('  Expected: Identical hashes');
  console.log('  Result:', test1Pass ? 'PASS' : 'FAIL');
  console.log('  Hash 1:', hash1);
  console.log('  Hash 2:', hash2);
  console.log('');
  
  if (test1Pass) passed++; else failed++;
  
  // Test 2: Different certificate type -> should produce different hash
  const cert3 = { ...cert1, certificate_type: 'university_degree' };
  const hash3 = cryptoUtils.generateDeterministicHash(cert3);
  const test2Pass = hash1 !== hash3;
  
  console.log('Test 2: Different certificate_type');
  console.log('  Expected: Different hashes');
  console.log('  Result:', test2Pass ? 'PASS' : 'FAIL');
  console.log('');
  
  if (test2Pass) passed++; else failed++;
  
  // Test 3: Different candidate number -> should produce different hash
  const cert4 = { ...cert1, candidate_number: '987654321' };
  const hash4 = cryptoUtils.generateDeterministicHash(cert4);
  const test3Pass = hash1 !== hash4;
  
  console.log('Test 3: Different candidate_number');
  console.log('  Expected: Different hashes');
  console.log('  Result:', test3Pass ? 'PASS' : 'FAIL');
  console.log('');
  
  if (test3Pass) passed++; else failed++;
  
  // Test 4: University degree, same data different formatting -> should produce identical hash
  const uniCert1 = {
    cert_id: 'UNI-456',
    certificate_type: 'university_degree',
    student_name: 'Alice Banda',
    institution_id: 'unza-uuid-here',
    issue_date: '2026-05-01',
    program: 'BSc Computing',
    metadata: { class_of_degree: 'First Class', student_id: '2021001234' }
  };
  
  const uniCert2 = {
    cert_id: 'UNI-456',
    certificate_type: 'university_degree',
    student_name: '  ALICE BANDA  ',
    institution_id: 'unza-uuid-here',
    issue_date: '2026-05-01',
    program: '  bsc computing  ',
    metadata: { student_id: '2021001234', class_of_degree: 'First Class' }
  };
  
  const uniHash1 = cryptoUtils.generateDeterministicHash(uniCert1);
  const uniHash2 = cryptoUtils.generateDeterministicHash(uniCert2);
  const test4Pass = uniHash1 === uniHash2;
  
  console.log('Test 4: University degree, different formatting');
  console.log('  Expected: Identical hashes');
  console.log('  Result:', test4Pass ? 'PASS' : 'FAIL');
  console.log('');
  
  if (test4Pass) passed++; else failed++;
  
  // Test 5: Hash verification helper
  const validMatch = cryptoUtils.verifyHashMatch(hash1, hash2);
  const invalidMatch = cryptoUtils.verifyHashMatch(hash1, hash3);
  const test5Pass = validMatch === true && invalidMatch === false;
  
  console.log('Test 5: verifyHashMatch helper function');
  console.log('  Expected: true for matching hashes, false for different');
  console.log('  Result:', test5Pass ? 'PASS' : 'FAIL');
  console.log('');
  
  if (test5Pass) passed++; else failed++;
  
  // Summary
  console.log('='.repeat(50));
  console.log('Test Summary:', passed, 'passed,', failed, 'failed');
  console.log('='.repeat(50));
  
  return failed === 0;
}

// Run tests if executed directly
if (require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}

module.exports = { runTests };