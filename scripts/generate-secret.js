const { randomBytes } = require('crypto');

// Generate 32 random bytes and convert to hex
randomBytes(32, (err, buffer) => {
  if (err) throw err;
  console.log(buffer.toString('hex'));
});
