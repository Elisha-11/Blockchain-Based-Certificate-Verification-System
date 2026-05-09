const { generateDeterministicHash } = require('./utils/crypto');

// Replace with the EXACT values from your MySQL query above
const testData = {
  cert_id: 'CERT-1775906123879-RL4S6G',
  student_name: 'Test student',  // From MySQL
  program: 'BSc Computing',      // From MySQL
  institution_id: 'a911695f-3023-11f1-a766-484d7efdbe1f', // From MySQL
  issue_date: '2026-04-05'       // From MySQL
};

const hash = generateDeterministicHash(testData);
console.log('Recomputed hash:', hash);

// Compare with stored hash from MySQL
const storedHash = '155b856b39f6e9a89fb9d6d490ef3d852cbba3411a3a8cae7abeae04908617fa'; // From MySQL
console.log('Stored hash:    ', storedHash);
console.log('Match:', hash === storedHash ? '✅ YES' : '❌ NO');