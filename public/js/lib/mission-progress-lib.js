import { selectById, updateById } from "./firestore.js";
import { addUserExperience } from "./user-data-lib.js";

const USER_DATA_COLLECTION = "userData";

/**
 * Retorna la data actual amb els segons i mil·lisegons posats a 0,
 * de manera que només es conservin l'hora i els minuts.
 *
 * @returns {Date} Data actual truncada a hora i minuts.
 */
function getCurrentHourMinuteDate() {
  const now = new Date();
  now.setSeconds(0, 0);
  return now;
}

/**
 * Arrodoneix un nombre a un màxim de 2 decimals.
 *
 * @param {number} value Valor a arrodonir.
 * @returns {number} Valor arrodonit a 2 decimals.
 */
function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Valida que el uid sigui un text no buit.
 *
 * @param {unknown} uid Identificador de l'usuari.
 * @returns {string} UID normalitzat.
 * @throws {Error} Si el uid no és vàlid.
 */
function validateUid(uid) {
  if (typeof uid !== "string" || uid.trim() === "") {
    throw new Error('El camp "uid" és obligatori.');
  }

  return uid.trim();
}

/**
 * Valida que el missionId sigui un text no buit.
 *
 * @param {unknown} missionId Identificador de la missió.
 * @returns {string} Mission ID normalitzat.
 * @throws {Error} Si el missionId no és vàlid.
 */
function validateMissionId(missionId) {
  if (typeof missionId !== "string" || missionId.trim() === "") {
    throw new Error('El camp "missionId" és obligatori.');
  }

  return missionId.trim();
}

/**
 * Valida que la quantitat de progrés sigui un número finit superior a 0.
 *
 * @param {unknown} amount Quantitat de progrés.
 * @returns {number} Quantitat validada.
 * @throws {TypeError} Si no és un número finit.
 * @throws {Error} Si és menor o igual a 0.
 */
function validateProgressAmount(amount) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new TypeError('El camp "amount" no és vàlid.');
  }

  if (amount <= 0) {
    throw new Error("La quantitat de progrés ha de ser superior a 0.");
  }

  return amount;
}

/**
 * Normalitza un valor numèric segons si la missió permet decimals o no.
 *
 * - Si `allowDecimals` és `true`, retorna el valor amb un màxim de 2 decimals.
 * - Si `allowDecimals` és `false`, aplica `Math.floor(...)`.
 *
 * @param {number} value Valor a normalitzar.
 * @param {boolean} allowDecimals Indica si es permeten decimals.
 * @returns {number} Valor normalitzat.
 * @throws {TypeError} Si el valor no és un número finit.
 */
function normalizeMissionNumber(value, allowDecimals) {
  if (!Number.isFinite(value)) {
    throw new TypeError("El valor numèric de la missió no és vàlid.");
  }

  return allowDecimals ? round2(value) : Math.floor(value);
}

/**
 * Valida i normalitza la quantitat de progrés segons les regles de la missió.
 *
 * - Primer valida que el valor sigui un número finit superior a 0.
 * - Després:
 *   - si no es permeten decimals, aplica `Math.floor(...)`
 *   - si es permeten decimals, limita a 2 decimals
 * - Si el resultat normalitzat és 0 o inferior, també es rebutja.
 *
 * @param {number} amount Quantitat de progrés introduïda.
 * @param {boolean} allowDecimals Indica si la missió permet decimals.
 * @returns {number} Quantitat de progrés normalitzada.
 * @throws {Error|TypeError} Si el valor no és acceptable.
 */
function normalizeProgressInputByMissionRules(amount, allowDecimals) {
  const validatedAmount = validateProgressAmount(amount);
  const normalizedAmount = normalizeMissionNumber(validatedAmount, allowDecimals);

  if (normalizedAmount <= 0) {
    throw new Error(
      "La quantitat de progrés resultant ha de ser superior a 0."
    );
  }

  return normalizedAmount;
}

/**
 * Valida l'estructura mínima d'una missió d'usuari.
 *
 * Camps obligatoris:
 * - missionId
 * - title
 * - amountTarget
 * - currentProgress
 * - completed
 * - active
 *
 * Camp opcional:
 * - allowDecimals
 *
 * @param {any} mission Missió a validar.
 * @returns {void}
 * @throws {Error|TypeError} Si algun camp és invàlid.
 */
function validateUserMission(mission) {
  if (typeof mission !== "object" || mission === null) {
    throw new TypeError("La missió de l'usuari no té un format vàlid.");
  }

  if (
    typeof mission.missionId !== "string" ||
    mission.missionId.trim() === ""
  ) {
    throw new Error('El camp "missionId" de la missió és obligatori.');
  }

  if (typeof mission.title !== "string" || mission.title.trim() === "") {
    throw new Error('El camp "title" de la missió és obligatori.');
  }

  if (
    typeof mission.amountTarget !== "number" ||
    !Number.isFinite(mission.amountTarget) ||
    mission.amountTarget <= 0
  ) {
    throw new Error('El camp "amountTarget" de la missió no és vàlid.');
  }

  if (
    typeof mission.currentProgress !== "number" ||
    !Number.isFinite(mission.currentProgress) ||
    mission.currentProgress < 0
  ) {
    throw new Error('El camp "currentProgress" de la missió no és vàlid.');
  }

  if (typeof mission.completed !== "boolean") {
    throw new TypeError('El camp "completed" de la missió no és vàlid.');
  }

  if (typeof mission.active !== "boolean") {
    throw new TypeError('El camp "active" de la missió no és vàlid.');
  }

  if (
    mission.allowDecimals !== undefined &&
    typeof mission.allowDecimals !== "boolean"
  ) {
    throw new TypeError('El camp "allowDecimals" de la missió no és vàlid.');
  }
}

/**
 * Valida que el conjunt de missions de l'usuari sigui un array vàlid.
 *
 * @param {unknown} missions Llista de missions.
 * @returns {Array<any>} Array validat de missions.
 * @throws {TypeError} Si no és un array vàlid.
 */
function validateUserMissionsArray(missions) {
  if (!Array.isArray(missions)) {
    throw new TypeError("Les missions diàries de l'usuari no són vàlides.");
  }

  missions.forEach(validateUserMission);
  return missions;
}

/**
 * Cerca l'índex d'una missió dins l'array a partir del seu missionId.
 *
 * @param {Array<any>} missions Array de missions.
 * @param {string} missionId Identificador de la missió.
 * @returns {number} Índex de la missió o -1 si no existeix.
 */
function findMissionIndex(missions, missionId) {
  return missions.findIndex((mission) => mission?.missionId === missionId);
}

/**
 * Retorna una còpia superficial d'una missió per evitar mutacions directes.
 *
 * @param {any} mission Missió original.
 * @returns {any} Còpia de la missió.
 */
function cloneMission(mission) {
  return {
    ...mission
  };
}

/**
 * Retorna si una missió permet decimals.
 *
 * Si el camp `allowDecimals` no existeix, es considera `false`.
 *
 * @param {any} mission Missió de l'usuari.
 * @returns {boolean} `true` si permet decimals; altrament `false`.
 */
function getMissionAllowDecimals(mission) {
  return mission.allowDecimals === true;
}

/**
 * Obté totes les missions diàries d'un usuari.
 *
 * @param {string} uid Identificador de l'usuari.
 * @returns {Promise<Array<any>>} Llista de missions diàries.
 * @throws {Error|TypeError} Si l'usuari no existeix o les missions són invàlides.
 */
export async function getUserDailyMissions(uid) {
  const normalizedUid = validateUid(uid);
  const userData = await selectById(USER_DATA_COLLECTION, normalizedUid);

  if (!userData) {
    throw new Error("L'usuari no existeix.");
  }

  return validateUserMissionsArray(userData.dailyMisions ?? []);
}

/**
 * Obté una missió concreta d'un usuari pel seu missionId.
 *
 * @param {string} uid Identificador de l'usuari.
 * @param {string} missionId Identificador de la missió.
 * @returns {Promise<any | null>} La missió trobada o `null` si no existeix.
 * @throws {Error|TypeError} Si els paràmetres no són vàlids.
 */
export async function getUserMissionById(uid, missionId) {
  const normalizedMissionId = validateMissionId(missionId);
  const missions = await getUserDailyMissions(uid);
  const mission = missions.find(
    (item) => item.missionId === normalizedMissionId
  );

  return mission ? cloneMission(mission) : null;
}

/**
 * Inicia una missió de l'usuari.
 *
 * Regles:
 * - La missió ha d'existir.
 * - No pot estar completada.
 * - Si ja està activa, no es reinicia l'hora d'inici.
 * - Si s'activa per primer cop, es guarda `startTimestamp` amb hora i minuts.
 * - En iniciar-la, `endTimestamp` es posa a `null`.
 *
 * @param {string} uid Identificador de l'usuari.
 * @param {string} missionId Identificador de la missió.
 * @returns {Promise<any>} Missió actualitzada.
 * @throws {Error|TypeError} Si l'usuari o la missió no són vàlids.
 */
export async function startUserMission(uid, missionId) {
  const normalizedUid = validateUid(uid);
  const normalizedMissionId = validateMissionId(missionId);

  const userData = await selectById(USER_DATA_COLLECTION, normalizedUid);

  if (!userData) {
    throw new Error("L'usuari no existeix.");
  }

  const dailyMisions = validateUserMissionsArray(userData.dailyMisions ?? []);
  const missionIndex = findMissionIndex(dailyMisions, normalizedMissionId);

  if (missionIndex === -1) {
    throw new Error("La missió indicada no existeix per a aquest usuari.");
  }

  const updatedDailyMisions = [...dailyMisions];
  const currentMission = cloneMission(updatedDailyMisions[missionIndex]);

  if (currentMission.completed) {
    throw new Error(
      "La missió ja està completada i no es pot tornar a iniciar."
    );
  }

  if (currentMission.active) {
    return currentMission;
  }

  currentMission.active = true;
  currentMission.startTimestamp =
    currentMission.startTimestamp ?? getCurrentHourMinuteDate();
  currentMission.endTimestamp = null;

  updatedDailyMisions[missionIndex] = currentMission;

  await updateById(USER_DATA_COLLECTION, normalizedUid, {
    dailyMisions: updatedDailyMisions
  });

  return currentMission;
}

/**
 * Afegeix progrés a una missió de l'usuari.
 *
 * Regles:
 * - La missió ha d'existir.
 * - La missió ha d'estar activa.
 * - La missió no pot estar completada.
 * - El progrés introduït ha de ser superior a 0.
 * - Si la missió no permet decimals, el valor introduït es converteix amb `Math.floor(...)`.
 * - Si la missió permet decimals, el valor es limita a un màxim de 2 decimals.
 * - El `currentProgress` final també queda normalitzat segons aquestes mateixes regles.
 * - Si s'arriba o se supera `amountTarget`, la missió es marca com a completada.
 * - En completar-se, es guarda `endTimestamp` amb hora i minuts.
 * - Si no existia `startTimestamp`, també es crea.
 *
 * @param {string} uid Identificador de l'usuari.
 * @param {string} missionId Identificador de la missió.
 * @param {number} amount Quantitat de progrés a afegir.
 * @returns {Promise<any>} Missió actualitzada.
 * @throws {Error|TypeError} Si l'operació no és vàlida.
 */
export async function addProgressToUserMission(uid, missionId, amount) {
  const normalizedUid = validateUid(uid);
  const normalizedMissionId = validateMissionId(missionId);

  const userData = await selectById(USER_DATA_COLLECTION, normalizedUid);

  if (!userData) {
    throw new Error("L'usuari no existeix.");
  }

  const dailyMisions = validateUserMissionsArray(userData.dailyMisions ?? []);
  const missionIndex = findMissionIndex(dailyMisions, normalizedMissionId);

  if (missionIndex === -1) {
    throw new Error("La missió indicada no existeix per a aquest usuari.");
  }

  const updatedDailyMisions = [...dailyMisions];
  const currentMission = cloneMission(updatedDailyMisions[missionIndex]);

  if (!currentMission.active) {
    throw new Error("No es pot progressar una missió que no està activa.");
  }

  if (currentMission.completed) {
    throw new Error("La missió ja està completada.");
  }

  const allowDecimals = getMissionAllowDecimals(currentMission);
  const normalizedAmount = normalizeProgressInputByMissionRules(
    amount,
    allowDecimals
  );

  const normalizedCurrentProgress = normalizeMissionNumber(
    currentMission.currentProgress,
    allowDecimals
  );

  const normalizedAmountTarget = normalizeMissionNumber(
    currentMission.amountTarget,
    allowDecimals
  );

  const rawNextProgress = normalizedCurrentProgress + normalizedAmount;
  const normalizedNextProgress = normalizeMissionNumber(
    rawNextProgress,
    allowDecimals
  );

  const completed = normalizedNextProgress >= normalizedAmountTarget;

  currentMission.currentProgress = completed
    ? normalizedAmountTarget
    : normalizedNextProgress;

  currentMission.completed = completed;

  if (!currentMission.startTimestamp) {
    currentMission.startTimestamp = getCurrentHourMinuteDate();
  }

  if (completed) {
    currentMission.endTimestamp = getCurrentHourMinuteDate();

    const weight =
      Number.isFinite(currentMission.puntuationWeight)
        ? currentMission.puntuationWeight
        : 1;

    const xp = Math.max(0, Math.floor(normalizedAmountTarget * weight));
    await addUserExperience(normalizedUid, xp);

  }

  updatedDailyMisions[missionIndex] = currentMission;

  await updateById(USER_DATA_COLLECTION, normalizedUid, {
    dailyMisions: updatedDailyMisions
  });

  return currentMission;
}

/**
 * Estableix manualment si una missió està activa o no.
 *
 * Regles:
 * - La missió ha d'existir.
 * - Si s'activa per primer cop, es guarda `startTimestamp`.
 * - Si es desactiva, no s'esborra `startTimestamp`.
 * - No es permet activar una missió ja completada.
 *
 * @param {string} uid Identificador de l'usuari.
 * @param {string} missionId Identificador de la missió.
 * @param {boolean} active Nou estat de la missió.
 * @returns {Promise<any>} Missió actualitzada.
 * @throws {Error|TypeError} Si l'operació no és vàlida.
 */
export async function setUserMissionActive(uid, missionId, active) {
  const normalizedUid = validateUid(uid);
  const normalizedMissionId = validateMissionId(missionId);

  if (typeof active !== "boolean") {
    throw new TypeError('El camp "active" no és vàlid.');
  }

  const userData = await selectById(USER_DATA_COLLECTION, normalizedUid);

  if (!userData) {
    throw new Error("L'usuari no existeix.");
  }

  const dailyMisions = validateUserMissionsArray(userData.dailyMisions ?? []);
  const missionIndex = findMissionIndex(dailyMisions, normalizedMissionId);

  if (missionIndex === -1) {
    throw new Error("La missió indicada no existeix per a aquest usuari.");
  }

  const updatedDailyMisions = [...dailyMisions];
  const currentMission = cloneMission(updatedDailyMisions[missionIndex]);

  if (currentMission.completed && active) {
    throw new Error("No es pot activar una missió completada.");
  }

  currentMission.active = active;

  if (active && !currentMission.startTimestamp) {
    currentMission.startTimestamp = getCurrentHourMinuteDate();
  }

  updatedDailyMisions[missionIndex] = currentMission;

  await updateById(USER_DATA_COLLECTION, normalizedUid, {
    dailyMisions: updatedDailyMisions
  });

  return currentMission;
}

/**
 * Reinicia manualment una missió de l'usuari.
 *
 * Regles:
 * - La missió ha d'existir.
 * - Es deixa sense progrés.
 * - Es marca com a no completada.
 * - Es marca com a no activa.
 * - S'esborren `startTimestamp` i `endTimestamp`.
 *
 * @param {string} uid Identificador de l'usuari.
 * @param {string} missionId Identificador de la missió.
 * @returns {Promise<any>} Missió reiniciada.
 * @throws {Error|TypeError} Si l'usuari o la missió no són vàlids.
 */
export async function resetUserMission(uid, missionId) {
  const normalizedUid = validateUid(uid);
  const normalizedMissionId = validateMissionId(missionId);

  const userData = await selectById(USER_DATA_COLLECTION, normalizedUid);

  if (!userData) {
    throw new Error("L'usuari no existeix.");
  }

  const dailyMisions = validateUserMissionsArray(userData.dailyMisions ?? []);
  const missionIndex = findMissionIndex(dailyMisions, normalizedMissionId);

  if (missionIndex === -1) {
    throw new Error("La missió indicada no existeix per a aquest usuari.");
  }

  const updatedDailyMisions = [...dailyMisions];
  const currentMission = cloneMission(updatedDailyMisions[missionIndex]);

  currentMission.currentProgress = 0;
  currentMission.completed = false;
  currentMission.active = false;
  currentMission.startTimestamp = null;
  currentMission.endTimestamp = null;

  updatedDailyMisions[missionIndex] = currentMission;

  await updateById(USER_DATA_COLLECTION, normalizedUid, {
    dailyMisions: updatedDailyMisions
  });

  return currentMission;
}