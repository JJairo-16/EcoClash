/**
 * Valida si un string es válido (no vacío)
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {string}
 */
function validateRequiredString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`El camp "${fieldName}" és obligatori.`);
  }

  return value.trim();
}

/**
 * Alias genérico para texto obligatorio
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {string}
 */
export function validateRequiredText(value, fieldName) {
  return validateRequiredString(value, fieldName);
}

/**
 * Valida username
 * @param {unknown} username
 * @returns {string}
 */
export function validateUsername(username) {
  const value = validateRequiredString(username, "username");

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
 * Valida nombre con nombre de campo
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {string}
 */
export function validateName(value, fieldName = "name") {
  const cleaned = validateRequiredString(value, fieldName);

  if (cleaned.length < 2) {
    throw new Error(`El camp "${fieldName}" ha de tenir com a mínim 2 caràcters.`);
  }

  return cleaned;
}

/**
 * Wrapper para surname
 * @param {unknown} value
 * @returns {string}
 */
export function validateSurname(value) {
  return validateName(value, "surname");
}

/**
 * Wrapper para lastname
 * @param {unknown} value
 * @returns {string}
 */
export function validateLastname(value) {
  return validateOptionalString(value);
}

/**
 * Valida campo opcional de texto
 * @param {unknown} value
 * @returns {string}
 */
export function validateOptionalString(value) {
  if (value == null) return "";

  if (typeof value !== "string") {
    throw new TypeError("El valor introduït no és vàlid.");
  }

  return value.trim();
}

/**
 * Valida teléfono
 * @param {unknown} phone
 * @returns {string}
 */
export function validatePhone(phone) {
  if (phone == null || phone === "") return "";

  if (typeof phone !== "string") {
    throw new TypeError("El número de telèfon no és vàlid.");
  }

  const cleaned = phone.trim();

  if (!/^[0-9+ ]{6,15}$/.test(cleaned)) {
    throw new Error("El número de telèfon no és vàlid.");
  }

  return cleaned;
}

/**
 * Alias compatible con user-data-lib
 * @param {unknown} phone
 * @returns {string}
 */
export function validatePhoneNum(phone) {
  return validatePhone(phone);
}

/**
 * Valida fecha de nacimiento
 * @param {unknown} date
 * @returns {Date}
 */
export function validateBirthDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError("La data no és vàlida.");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const minBirthDate = new Date(1950, 0, 1);
  const minAgeDate = new Date(
    today.getFullYear() - 14,
    today.getMonth(),
    today.getDate()
  );
  minAgeDate.setHours(0, 0, 0, 0);

  if (date.getTime() > today.getTime()) {
    throw new Error("La data de naixement no pot ser futura.");
  }

  if (date.getTime() < minBirthDate.getTime()) {
    throw new Error("La data de naixement no pot ser anterior a l'any 1950.");
  }

  if (date.getTime() > minAgeDate.getTime()) {
    throw new Error("Has de tenir com a mínim 14 anys.");
  }

  return date;
}

/**
 * Valida email
 * @param {unknown} email
 * @returns {string}
 */
export function validateEmail(email) {
  const value = validateRequiredString(email, "email").toLowerCase();

  // Validación simple suficiente para app
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error("El correu electrònic no és vàlid.");
  }

  return value;
}

/**
 * Valida nivel
 * @param {unknown} level
 * @returns {number}
 */
export function validateLevel(level) {
  if (!Number.isInteger(level) || level < 1) {
    throw new Error("El nivell no és vàlid.");
  }

  return level;
}

/**
 * Valida experiencia actual
 * @param {unknown} experience
 * @returns {number}
 */
export function validateExperience(experience) {
  if (typeof experience !== 'number') throw new Error("L'experiència màxima ha de ser un nombre");

  if (!Number.isFinite(experience) || experience < 0) {
    throw new Error("L'experiència no és vàlida.");
  }

  return Math.floor(experience);
}

/**
 * Valida experiencia máxima
 * @param {unknown} maxExperience
 * @returns {number}
 */
export function validateMaxExperience(maxExperience) {
  if (typeof maxExperience !== 'number') throw new Error("L'experiència màxima ha de ser un nombre");

  if (!Number.isFinite(maxExperience) || maxExperience < 1) {
    throw new Error("L'experiència màxima no és vàlida.");
  }

  return Math.floor(maxExperience);
}

/**
 * Valida array de amigos
 * @param {unknown} friends
 * @returns {Array<any>}
 */
export function validateFriends(friends) {
  if (friends == null) return [];

  if (!Array.isArray(friends)) {
    throw new TypeError("La llista d'amics no és vàlida.");
  }

  return friends;
}

/**
 * Valida fecha de misiones diarias
 * @param {unknown} value
 * @returns {Date}
 */
export function validateDailyMissionsDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError("La data de missions diàries no és vàlida.");
  }

  return value;
}

/**
 * Valida misiones diarias
 * @param {unknown} value
 * @returns {Array<any>}
 */
export function validateDailyMisions(value) {
  if (value == null) return [];

  if (!Array.isArray(value)) {
    throw new TypeError("Les missions diàries no són vàlides.");
  }

  return value;
}

/**
 * Valida estructura mínima de datos extra del usuario
 * @param {unknown} value
 * @returns {true}
 */
export function validateUserExtraData(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Les dades extra de l'usuari no són vàlides.");
  }

  const data = /** @type {Record<string, unknown>} */ (value);

  validateUsername(data.username);
  validateName(data.name, "name");
  validateSurname(data.surname);
  validateLastname(data.lastname);
  validatePhoneNum(data.phoneNum);
  validateBirthDate(data.birthDate);

  return true;
}