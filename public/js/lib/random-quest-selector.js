import { db } from "../config.js";
import {
  doc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { selectById, setById, selectWhere } from "./firestore.js";
import {
  getCachedDailyMissions,
  setCachedDailyMissions,
  clearCachedDailyMissions
} from "./cache/DailyMissionsCache.js";

const USER_DATA_COLLECTION = "userData";
const USER_DAILY_MISSIONS_COLLECTION = "userDailyMissions";
const QUESTS_COLLECTION = "quests";
const DAILY_MISSIONS_COUNT = 3;

function getUserDataRef(uid) {
  return doc(db, USER_DATA_COLLECTION, uid);
}

function getUserDailyMissionsRef(uid) {
  return doc(db, USER_DAILY_MISSIONS_COLLECTION, uid);
}

/**
 * Genera un valor aleatori amb distribució triangular (més pes al centre).
 *
 * @returns {number}
 */
function triangularRandom() {
  return (Math.random() + Math.random()) / 2;
}

/**
 * Interpolació lineal entre dos valors.
 *
 * @param {number} a Valor inicial
 * @param {number} b Valor final
 * @param {number} t Factor (0-1)
 * @returns {number}
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Arrodoneix a 2 decimals.
 *
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Calcula l'objectiu d'una missió dins d'un rang.
 *
 * @param {number} min
 * @param {number} max
 * @param {boolean} allowDecimals
 * @returns {number}
 */
function getQuestTarget(min, max, allowDecimals) {
  const t = triangularRandom();
  const target = lerp(min, max, t);

  return allowDecimals ? round2(target) : Math.round(target);
}

/**
 * Retorna una mostra aleatòria de k elements sense repetir.
 *
 * @param {Array<any>} array
 * @param {number} k
 * @returns {Array<any>}
 */
function getRandomSampleNoCopy(array, k) {
  if (!Array.isArray(array)) {
    throw new TypeError("El paràmetre array no és vàlid.");
  }

  if (!Number.isInteger(k) || k < 0) {
    throw new TypeError('El paràmetre "k" no és vàlid.');
  }

  const n = array.length;
  const limit = Math.min(k, n);

  if (limit === 0) return [];

  const taken = new Set();
  const result = [];

  while (result.length < limit) {
    const index = Math.floor(Math.random() * n);

    if (!taken.has(index)) {
      taken.add(index);
      result.push(array[index]);
    }
  }

  return result;
}

/**
 * Retorna la data d'avui a les 00:00.
 *
 * @returns {Date}
 */
function getStartOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Comprova si dues dates són el mateix dia.
 *
 * @param {Date} dateA
 * @param {Date} dateB
 * @returns {boolean}
 */
function isSameDay(dateA, dateB) {
  if (!(dateA instanceof Date) || Number.isNaN(dateA.getTime())) return false;
  if (!(dateB instanceof Date) || Number.isNaN(dateB.getTime())) return false;

  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

/**
 * Normalitza una data (Date, Timestamp o string).
 *
 * @param {*} value
 * @returns {Date|null}
 */
function normalizeDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    typeof value.toDate === "function"
  ) {
    const convertedDate = value.toDate();
    return convertedDate instanceof Date && !Number.isNaN(convertedDate.getTime())
      ? convertedDate
      : null;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

/**
 * Obté l'id d'una missió base.
 *
 * @param {Object} quest
 * @returns {string|null}
 */
function getQuestId(quest) {
  if (typeof quest.id === "string" && quest.id.trim() !== "") {
    return quest.id.trim();
  }

  if (typeof quest.questId === "string" && quest.questId.trim() !== "") {
    return quest.questId.trim();
  }

  return null;
}

/**
 * Obté el títol d'una missió base.
 *
 * @param {Object} quest
 * @returns {string|null}
 */
function getQuestTitle(quest) {
  if (typeof quest.name === "string" && quest.name.trim() !== "") {
    return quest.name.trim();
  }

  if (typeof quest.title === "string" && quest.title.trim() !== "") {
    return quest.title.trim();
  }

  return null;
}

/**
 * Indica si una missió permet decimals.
 *
 * @param {Object} quest
 * @returns {boolean}
 */
function getAllowDecimals(quest) {
  return quest.allowDecimals === true;
}

/**
 * Valida una missió base del catàleg.
 *
 * @param {Object} quest
 * @returns {{questId: string, questTitle: string}}
 */
function validateBaseQuest(quest) {
  if (typeof quest !== "object" || quest === null) {
    throw new TypeError("Una missió base no té un format vàlid.");
  }

  const questId = getQuestId(quest);
  const questTitle = getQuestTitle(quest);

  if (!questId) {
    throw new Error('El camp "id" o "questId" de la missió és obligatori.');
  }

  if (!questTitle) {
    throw new Error('El camp "name" o "title" de la missió és obligatori.');
  }

  if (!Number.isFinite(quest.minAmount)) {
    throw new TypeError('El camp "minAmount" de la missió no és vàlid.');
  }

  if (!Number.isFinite(quest.maxAmount)) {
    throw new TypeError('El camp "maxAmount" de la missió no és vàlid.');
  }

  if (quest.maxAmount < quest.minAmount) {
    throw new Error('El camp "maxAmount" no pot ser inferior a "minAmount".');
  }

  return {
    questId,
    questTitle
  };
}

/**
 * Converteix una missió base en una missió diària per a un usuari.
 *
 * @param {Object} quest
 * @returns {Object}
 */
function createDailyMissionFromQuest(quest) {
  const { questId, questTitle } = validateBaseQuest(quest);
  const allowDecimals = getAllowDecimals(quest);

  return {
    missionId: questId,
    title: questTitle,
    description: typeof quest.description === "string" ? quest.description : "",
    unity: typeof quest.unity === "string" ? quest.unity : "",
    amountTarget: getQuestTarget(
      quest.minAmount,
      quest.maxAmount,
      allowDecimals
    ),
    currentProgress: 0,
    completed: false,
    active: false,
    allowDecimals,
    startTimestamp: null,
    endTimestamp: null,
    puntuationWeight: Number.isFinite(quest.puntuationWeight)
      ? quest.puntuationWeight
      : 1
  };
}

/**
 * Obté missions aleatòries actives de la base de dades.
 *
 * @param {number} count
 * @returns {Promise<Array>}
 */
async function getRandomDailyMissionsFromTable(count = DAILY_MISSIONS_COUNT) {
  if (!Number.isInteger(count) || count <= 0) {
    throw new TypeError('El paràmetre "count" no és vàlid.');
  }

  const activeQuests = await selectWhere(
    QUESTS_COLLECTION,
    "active",
    "==",
    true
  );

  if (!Array.isArray(activeQuests)) {
    throw new TypeError("La consulta de missions actives no és vàlida.");
  }

  if (activeQuests.length === 0) {
    throw new Error("No hi ha missions actives disponibles.");
  }

  return getRandomSampleNoCopy(activeQuests, count).map(createDailyMissionFromQuest);
}

/**
 * Valida que el uid sigui correcte.
 *
 * @param {string} uid
 * @returns {string}
 */
function validateUid(uid) {
  if (typeof uid !== "string" || uid.trim() === "") {
    throw new Error('El camp "uid" és obligatori.');
  }

  return uid.trim();
}

/**
 * Comprova que el doc principal de l'usuari existeixi.
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
 * Obté el document de missions diàries d'un usuari.
 *
 * @param {string} uid
 * @returns {Promise<{ dailyMissionsDate: any, missions: Array } | null>}
 */
async function getUserDailyMissionsDoc(uid) {
  return await selectById(USER_DAILY_MISSIONS_COLLECTION, uid);
}

/**
 * Guarda completament l'estat de missions diàries d'un usuari.
 *
 * @param {string} uid
 * @param {{dailyMissionsDate: Date|null, missions: Array}} data
 * @returns {Promise<void>}
 */
async function saveUserDailyMissionsDoc(uid, data) {
  await setById(USER_DAILY_MISSIONS_COLLECTION, uid, data, false);
}

/**
 * Actualitza les missions diàries si encara no s'han generat avui.
 *
 * @param {string} uid
 * @returns {Promise<Array>}
 */
export async function updateDailyMissionsIfNeeded(uid) {
  const normalizedUid = validateUid(uid);

  const cachedMissions = getCachedDailyMissions(normalizedUid);
  if (cachedMissions) {
    return cachedMissions;
  }

  await assertUserExists(normalizedUid);

  const today = getStartOfToday();
  const dailyRef = getUserDailyMissionsRef(normalizedUid);

  const existing = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(dailyRef);
    const data = snap.exists() ? snap.data() : null;
    const currentDate = normalizeDate(data?.dailyMissionsDate);

    if (isSameDay(currentDate, today)) {
      return Array.isArray(data?.missions) ? data.missions : [];
    }

    return null;
  });

  if (existing) {
    setCachedDailyMissions(normalizedUid, existing);
    return existing;
  }

  const generated = await getRandomDailyMissionsFromTable(DAILY_MISSIONS_COUNT);

  const finalMissions = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(dailyRef);
    const data = snap.exists() ? snap.data() : null;
    const currentDate = normalizeDate(data?.dailyMissionsDate);

    if (isSameDay(currentDate, today)) {
      return Array.isArray(data?.missions) ? data.missions : [];
    }

    transaction.set(
      dailyRef,
      {
        dailyMissionsDate: today,
        missions: generated
      },
      { merge: false }
    );

    return generated;
  });

  setCachedDailyMissions(normalizedUid, finalMissions);
  return finalMissions;
}

/**
 * Força la regeneració de missions diàries (ignora la data).
 *
 * @param {string} uid
 * @returns {Promise<Array>}
 */
export async function forceRefreshDailyMissions(uid) {
  const normalizedUid = validateUid(uid);

  await assertUserExists(normalizedUid);
  clearCachedDailyMissions(normalizedUid);

  const today = getStartOfToday();
  const newDailyMissions = await getRandomDailyMissionsFromTable(
    DAILY_MISSIONS_COUNT
  );

  await saveUserDailyMissionsDoc(normalizedUid, {
    dailyMissionsDate: today,
    missions: newDailyMissions
  });

  setCachedDailyMissions(normalizedUid, newDailyMissions);
  return newDailyMissions;
}