const bcrypt = require('bcryptjs');

// Password to hash
const password = 'test123';

// Generate the hash
bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error hashing password:', err);
  } else {
    console.log('Hashed password:', hash);  // Copy this hash to use in your database
  }
});
