const test = require('node:test');
const assert = require('node:assert/strict');

const { hashPassword, verifyPassword } = require('./password-utils.js');

test('hashPassword creates a unique salt and stable hash for the same password', async () => {
  const first = await hashPassword('bonjour123', 'salt-1', 'pepper');
  const second = await hashPassword('bonjour123', 'salt-1', 'pepper');

  assert.equal(first.salt, 'salt-1');
  assert.equal(first.hash, second.hash);
  assert.notEqual(first.hash, 'bonjour123');
});

test('verifyPassword accepts the correct salted hash and rejects wrong input', async () => {
  const record = await hashPassword('bonjour123', 'salt-2', 'pepper');

  assert.equal(await verifyPassword('bonjour123', record.hash, record.salt, 'pepper'), true);
  assert.equal(await verifyPassword('mauvaismdp', record.hash, record.salt, 'pepper'), false);
});
