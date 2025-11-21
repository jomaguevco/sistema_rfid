const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Hashear una contraseña
 */
async function hashPassword(password) {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  } catch (error) {
    throw new Error('Error al hashear contraseña: ' + error.message);
  }
}

/**
 * Verificar una contraseña
 */
async function verifyPassword(password, hash) {
  try {
    const isValid = await bcrypt.compare(password, hash);
    return isValid;
  } catch (error) {
    throw new Error('Error al verificar contraseña: ' + error.message);
  }
}

module.exports = {
  hashPassword,
  verifyPassword
};

