const crypto = require('crypto');
const { promisify } = require('util');
const CryptoJS = require('crypto-js');

const scrypt = promisify(crypto.scrypt);
const HASH_PREFIX = 'scrypt';
const SALT_BYTES = 16;
const HASH_BYTES = 64;

async function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const derived = await scrypt(password, salt, HASH_BYTES);
  return `${HASH_PREFIX}$${salt}$${derived.toString('hex')}`;
}

async function verifyPassword(password, storedPassword, legacyEncryptionKey) {
  if (typeof password !== 'string' || typeof storedPassword !== 'string') {
    return { valid: false, needsUpgrade: false };
  }

  const parts = storedPassword.split('$');
  if (parts[0] === HASH_PREFIX && parts.length === 3) {
    try {
      const expected = Buffer.from(parts[2], 'hex');
      if (!parts[1] || expected.length !== HASH_BYTES) return { valid: false, needsUpgrade: false };
      const actual = await scrypt(password, parts[1], HASH_BYTES);
      return {
        valid: crypto.timingSafeEqual(actual, expected),
        needsUpgrade: false,
      };
    } catch {
      return { valid: false, needsUpgrade: false };
    }
  }

  // Existing accounts store CryptoJS AES ciphertext. Verify it for compatibility,
  // then callers should replace it with a one-way hash after successful login.
  if (!legacyEncryptionKey) return { valid: false, needsUpgrade: false };
  try {
    const bytes = CryptoJS.AES.decrypt(storedPassword, legacyEncryptionKey);
    const legacyPassword = bytes.toString(CryptoJS.enc.Utf8);
    const valid = legacyPassword.length === password.length && crypto.timingSafeEqual(
      Buffer.from(legacyPassword),
      Buffer.from(password)
    );
    return { valid, needsUpgrade: valid };
  } catch {
    return { valid: false, needsUpgrade: false };
  }
}

module.exports = { hashPassword, verifyPassword };
