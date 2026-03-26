import { db } from "../config.js";
import {
  doc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { selectById, setById } from "./firestore.js";
import { addUserExperience } from "./user-data-lib.js";
import { setCachedDailyMissions, getCachedDailyMissions } from "./cache/DailyMissionsCache.js";

const USER_DATA_COLLECTION = "userData";
const USER_DAILY_MISSIONS_COLLECTION = "userDailyMissions";

function getUserDailyMissionsRef(uid) {
  return doc(db, USER_DAILY_MISSIONS_COLLECTION, uid);
}

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
 * @param {number} value
 * @param {boolean} allowDecimals
 * @returns {number}
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
 * @param {number} amount
 * @param {boolean} allowDecimals
 * @returns {number}
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
 * @param {any} mission
 * @returns {void}
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
 * @param {unknown} missions
 * @returns {Array<any>}
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
 * @param {Array<any>} missions
 * @param {string} missionId
 * @returns {number}
 */
function findMissionIndex(missions, missionId) {
  return missions.findIndex((mission) => mission?.missionId === missionId);
}

/**
 * Retorna una còpia superficial d'una missió per evitar mutacions directes.
 *
 * @param {any} mission
 * @returns {any}
 */
function cloneMission(mission) {
  return {
    ...mission
  };
}

/**
 * Retorna si una missió permet decimals.
 *
 * @param {any} mission
 * @returns {boolean}
 */
function getMissionAllowDecimals(mission) {
  return mission.allowDecimals === true;
}

/**
 * Assegura que l'usuari existeix a userData.
 *
 * @param {string} uid
 * @returns {Promise<void>}
 */
async function assertUserExists(uid) {
  const userData = await selectById(USER_DATA_COLLECTION, uid);

  if (!userData) {
    throw new Error("L'usuari no existeix.");
  }
}

/**
 * Obté el document de missions diàries.
 *
 * @param {string} uid
 * @returns {Promise<{ id?: string, dailyMissionsDate?: any, missions?: Array } | null>}
 */
async function getUserDailyMissionsDocument(uid) {
  return await selectById(USER_DAILY_MISSIONS_COLLECTION, uid);
}

/**
 * Desa el document complet de missions diàries.
 *
 * @param {string} uid
 * @param {{ dailyMissionsDate: any, missions: Array }} docData
 * @returns {Promise<void>}
 */
async function saveUserDailyMissionsDocument(uid, docData) {
  await setById(USER_DAILY_MISSIONS_COLLECTION, uid, docData, false);

  if (Array.isArray(docData?.missions)) {
    setCachedDailyMissions(uid, docData.missions);
  }
}

/**
 * Carrega i valida el document de missions d'un usuari.
 *
 * @param {string} uid
 * @returns {Promise<{ dailyMissionsDate: any, missions: Array }>}
 */
async function getValidatedMissionStore(uid) {
  await assertUserExists(uid);

  const missionStore = await getUserDailyMissionsDocument(uid);

  return {
    dailyMissionsDate: missionStore?.dailyMissionsDate ?? null,
    missions: validateUserMissionsArray(missionStore?.missions ?? [])
  };
}

/**
 * Obté totes les missions diàries d'un usuari.
 *
 * @param {string} uid
 * @returns {Promise<Array<any>>}
 */
export async function getUserDailyMissions(uid) {
  const normalizedUid = validateUid(uid);
  const missionStore = await getValidatedMissionStore(normalizedUid);
  return missionStore.missions;
}

/**
 * Obté una missió concreta d'un usuari pel seu missionId.
 *
 * @param {string} uid
 * @param {string} missionId
 * @returns {Promise<any | null>}
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
 * @param {string} uid
 * @param {string} missionId
 * @returns {Promise<any>}
 */
export async function startUserMission(uid, missionId) {
  const normalizedUid = validateUid(uid);
  const normalizedMissionId = validateMissionId(missionId);

  await assertUserExists(normalizedUid);

  const missionRef = getUserDailyMissionsRef(normalizedUid);

  const updatedMission = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(missionRef);
    const missionStore = snap.exists() ? snap.data() : {};

    const missions = validateUserMissionsArray(missionStore?.missions ?? []);
    const missionIndex = findMissionIndex(missions, normalizedMissionId);

    if (missionIndex === -1) {
      throw new Error("La missió indicada no existeix per a aquest usuari.");
    }

    const updatedDailyMissions = [...missions];
    const currentMission = cloneMission(updatedDailyMissions[missionIndex]);

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

    updatedDailyMissions[missionIndex] = currentMission;

    transaction.set(
      missionRef,
      {
        dailyMissionsDate: missionStore?.dailyMissionsDate ?? null,
        missions: updatedDailyMissions
      },
      { merge: false }
    );

    return currentMission;
  });

  const cachedMissions = getCachedDailyMissions(normalizedUid);
  if (Array.isArray(cachedMissions)) {
    const nextCachedMissions = cachedMissions.map((mission) =>
      mission.missionId === normalizedMissionId ? { ...updatedMission } : mission
    );
    setCachedDailyMissions(normalizedUid, nextCachedMissions);
  }

  return updatedMission;
}

/**
 * Afegeix progrés a una missió de l'usuari.
 *
 * @param {string} uid
 * @param {string} missionId
 * @param {number} amount
 * @returns {Promise<any>}
 */
export async function addProgressToUserMission(uid, missionId, amount) {
  const normalizedUid = validateUid(uid);
  const normalizedMissionId = validateMissionId(missionId);

  await assertUserExists(normalizedUid);

  const missionRef = getUserDailyMissionsRef(normalizedUid);

  const result = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(missionRef);
    const missionStore = snap.exists() ? snap.data() : {};

    const missions = validateUserMissionsArray(missionStore?.missions ?? []);
    const missionIndex = findMissionIndex(missions, normalizedMissionId);

    if (missionIndex === -1) {
      throw new Error("La missió indicada no existeix per a aquest usuari.");
    }

    const updatedDailyMissions = [...missions];
    const currentMission = cloneMission(updatedDailyMissions[missionIndex]);

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

    const completedNow = normalizedNextProgress >= normalizedAmountTarget;

    currentMission.currentProgress = completedNow
      ? normalizedAmountTarget
      : normalizedNextProgress;

    currentMission.completed = completedNow;

    if (!currentMission.startTimestamp) {
      currentMission.startTimestamp = getCurrentHourMinuteDate();
    }

    if (completedNow) {
      currentMission.endTimestamp = getCurrentHourMinuteDate();
    }

    updatedDailyMissions[missionIndex] = currentMission;

    transaction.set(
      missionRef,
      {
        dailyMissionsDate: missionStore?.dailyMissionsDate ?? null,
        missions: updatedDailyMissions
      },
      { merge: false }
    );

    const weight =
      Number.isFinite(currentMission.puntuationWeight)
        ? currentMission.puntuationWeight
        : 1;

    const xp = completedNow
      ? Math.max(0, Math.floor(normalizedAmountTarget * weight))
      : 0;

    return {
      mission: currentMission,
      missions: updatedDailyMissions,
      completedNow,
      xp
    };
  });

  setCachedDailyMissions(normalizedUid, result.missions);

  if (result.completedNow && result.xp > 0) {
    await addUserExperience(normalizedUid, result.xp);
  }

  return result.mission;
}

/**
 * Estableix manualment si una missió està activa o no.
 *
 * @param {string} uid
 * @param {string} missionId
 * @param {boolean} active
 * @returns {Promise<any>}
 */
export async function setUserMissionActive(uid, missionId, active) {
  const normalizedUid = validateUid(uid);
  const normalizedMissionId = validateMissionId(missionId);

  if (typeof active !== "boolean") {
    throw new TypeError('El camp "active" no és vàlid.');
  }

  const missionStore = await getValidatedMissionStore(normalizedUid);
  const missionIndex = findMissionIndex(missionStore.missions, normalizedMissionId);

  if (missionIndex === -1) {
    throw new Error("La missió indicada no existeix per a aquest usuari.");
  }

  const updatedDailyMissions = [...missionStore.missions];
  const currentMission = cloneMission(updatedDailyMissions[missionIndex]);

  if (currentMission.completed && active) {
    throw new Error("No es pot activar una missió completada.");
  }

  currentMission.active = active;

  if (active && !currentMission.startTimestamp) {
    currentMission.startTimestamp = getCurrentHourMinuteDate();
  }

  updatedDailyMissions[missionIndex] = currentMission;

  await saveUserDailyMissionsDocument(normalizedUid, {
    dailyMissionsDate: missionStore.dailyMissionsDate,
    missions: updatedDailyMissions
  });

  return currentMission;
}

/**
 * Reinicia manualment una missió de l'usuari.
 *
 * @param {string} uid
 * @param {string} missionId
 * @returns {Promise<any>}
 */
export async function resetUserMission(uid, missionId) {
  const normalizedUid = validateUid(uid);
  const normalizedMissionId = validateMissionId(missionId);

  const missionStore = await getValidatedMissionStore(normalizedUid);
  const missionIndex = findMissionIndex(missionStore.missions, normalizedMissionId);

  if (missionIndex === -1) {
    throw new Error("La missió indicada no existeix per a aquest usuari.");
  }

  const updatedDailyMissions = [...missionStore.missions];
  const currentMission = cloneMission(updatedDailyMissions[missionIndex]);

  currentMission.currentProgress = 0;
  currentMission.completed = false;
  currentMission.active = false;
  currentMission.startTimestamp = null;
  currentMission.endTimestamp = null;

  updatedDailyMissions[missionIndex] = currentMission;

  await saveUserDailyMissionsDocument(normalizedUid, {
    dailyMissionsDate: missionStore.dailyMissionsDate,
    missions: updatedDailyMissions
  });

  return currentMission;
}