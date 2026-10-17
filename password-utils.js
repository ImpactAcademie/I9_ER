(function (global) {
  function hexFromBytes(bytes) {
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  function toHexString(value) {
    return typeof value === 'string' ? value : hexFromBytes(new Uint8Array(value));
  }

  function makePepper() {
    const pepper = global.PASSWORD_PEPPER || globalThis.PASSWORD_PEPPER || 'atelier-pepper-dev';
    return String(pepper).trim();
  }

  function generateSalt() {
    const bytes = new Uint8Array(16);
    if (global.crypto && typeof global.crypto.getRandomValues === 'function') {
      global.crypto.getRandomValues(bytes);
      return hexFromBytes(bytes);
    }

    if (typeof require === 'function') {
      const crypto = require('node:crypto');
      return crypto.randomBytes(16).toString('hex');
    }

    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  async function hashPassword(password, salt = generateSalt(), pepper = makePepper()) {
    const normalizedSalt = String(salt || generateSalt());
    const normalizedPepper = String(pepper || makePepper());
    const text = `${normalizedSalt}:${password}:${normalizedPepper}`;

    if (global.crypto && typeof global.crypto.subtle === 'object') {
      const hash = await global.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return {
        salt: normalizedSalt,
        hash: hexFromBytes(new Uint8Array(hash)),
      };
    }

    if (typeof require === 'function') {
      const crypto = require('node:crypto');
      return {
        salt: normalizedSalt,
        hash: crypto.createHash('sha256').update(text).digest('hex'),
      };
    }

    return {
      salt: normalizedSalt,
      hash: text.split('').reduce((accumulator, current) => accumulator + current.charCodeAt(0).toString(16).padStart(2, '0'), ''),
    };
  }

  async function verifyPassword(password, storedHash, storedSalt, pepper = makePepper()) {
    if (!password || !storedHash || !storedSalt) return false;
    const derived = await hashPassword(password, storedSalt, pepper);
    return derived.hash === String(storedHash);
  }

  const passwordUtils = { generateSalt, hashPassword, verifyPassword, makePepper };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = passwordUtils;
  }

  global.PasswordUtils = passwordUtils;
})(typeof window !== 'undefined' ? window : globalThis);
