import { selectById, selectAll, updateById } from "./firestore.js";

const USER_DATA_COLLECTION = "userData";
const QUESTS_COLLECTION = "quests";
const DAILY_MISSIONS_COUNT = 3;

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

  if (allowDecimals) return round2(target);
  else return Math.round(target);
}

/**
 * Barreja un array (Fisher-Yates).
 *
 * @param {Array} array
 * @returns {Array}
 */
function shuffle(array) {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
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
  if (typeof quest.allowDecimals === "boolean") {
    return quest.allowDecimals;
  }
  return false;
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
    amountTarget: getQuestTarget(
      quest.minAmount,
      quest.maxAmount,
      allowDecimals
    ),
    currentProgress: 0,
    completed: false,
    active: false,
    startTimestamp: null,
    endTimestamp: null
  };
}

/**
 * Obté missions aleatòries actives de la base de dades.
 *
 * @param {number} count
 * @returns {Promise<Array>}
 */
async function getRandomDailyMissionsFromTable(count = DAILY_MISSIONS_COUNT) {
  const allQuests = await selectAll(QUESTS_COLLECTION);

  if (!Array.isArray(allQuests)) {
    throw new TypeError("La taula de missions no té un format vàlid.");
  }

  const activeQuests = allQuests.filter((quest) => quest?.active === true);

  if (activeQuests.length === 0) {
    throw new Error("No hi ha missions actives disponibles.");
  }

  return shuffle(activeQuests)
    .slice(0, Math.min(count, activeQuests.length))
    .map(createDailyMissionFromQuest);
}

/**
 * Actualitza les missions diàries si encara no s'han generat avui.
 *
 * @param {string} uid
 * @returns {Promise<Array>}
 */
export async function updateDailyMissionsIfNeeded(uid) {
  if (typeof uid !== "string" || uid.trim() === "") {
    throw new Error('El camp "uid" és obligatori.');
  }

  const normalizedUid = uid.trim();
  const userData = await selectById(USER_DATA_COLLECTION, normalizedUid);

  if (!userData) {
    throw new Error("L'usuari no existeix.");
  }

  const today = getStartOfToday();
  const currentDailyMissionsDate = normalizeDate(userData.dailyMissionsDate);

  // Si ja s'han generat avui, es retornen
  if (isSameDay(currentDailyMissionsDate, today)) {
    return Array.isArray(userData.dailyMisions) ? userData.dailyMisions : [];
  }

  // Generació de noves missions
  const newDailyMissions = await getRandomDailyMissionsFromTable(DAILY_MISSIONS_COUNT);

  await updateById(USER_DATA_COLLECTION, normalizedUid, {
    dailyMisions: newDailyMissions,
    dailyMissionsDate: today
  });

  return newDailyMissions;
}

/**
 * Força la regeneració de missions diàries (ignora la data).
 *
 * @param {string} uid
 * @returns {Promise<Array>}
 */
export async function forceRefreshDailyMissions(uid) {
  if (typeof uid !== "string" || uid.trim() === "") {
    throw new Error('El camp "uid" és obligatori.');
  }

  const normalizedUid = uid.trim();
  const userData = await selectById(USER_DATA_COLLECTION, normalizedUid);

  if (!userData) {
    throw new Error("L'usuari no existeix.");
  }

  const today = getStartOfToday();
  const newDailyMissions = await getRandomDailyMissionsFromTable(DAILY_MISSIONS_COUNT);

  await updateById(USER_DATA_COLLECTION, normalizedUid, {
    dailyMisions: newDailyMissions,
    dailyMissionsDate: today
  });

  return newDailyMissions;
}