/**
 * Valida si un string es válido (no vacío)
 * @param {unknown} value
 * @param {string} fieldName
 */
function validateRequiredString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`El camp "${fieldName}" és obligatori.`);
  }
}

/**
 * Valida username
 * @param {string} username
 */
export function validateUsername(username) {
  validateRequiredString(username, "username");

  const value = username.trim();

  if (value.length < 3) {
    throw new Error("El nom d'usuari ha de tenir com a mínim 3 caràcters.");
  }

  if (value.length > 20) {
    throw new Error("El nom d'usuari no pot superar els 20 caràcters.");
  }

  if (!/^\w+$/.test(value)) {
    throw new Error("El nom d'usuari només pot contenir lletres, números i guions baixos.");
  }

  return value;
}

/**
 * Valida nom o cognoms
 */
export function validateName(value, fieldName) {
  validateRequiredString(value, fieldName);

  const cleaned = value.trim();

  if (cleaned.length < 2) {
    throw new Error(`El camp "${fieldName}" ha de tenir com a mínim 2 caràcters.`);
  }

  return cleaned;
}

/**
 * Valida camp opcional de text
 */
export function validateOptionalString(value) {
  if (value == null) return "";

  if (typeof value !== "string") {
    throw new TypeError("El valor introduït no és vàlid.");
  }

  return value.trim();
}

/**
 * Valida telèfon (simple)
 */
export function validatePhone(phone) {
  if (!phone) return "";

  if (!/^[0-9+ ]{6,15}$/.test(phone)) {
    throw new Error("El número de telèfon no és vàlid.");
  }

  return phone.trim();
}

/**
 * Valida data (no futura)
 */
export function validateBirthDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError("La data no és vàlida.");
  }

  if (date.getTime() > Date.now()) {
    throw new Error("La data no pot ser futura.");
  }

  return date;
}