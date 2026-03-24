import { selectById, selectAll, updateById } from "./firestore.js";

const USERS_COLLECTION = "users";
const QUESTS_COLLECTION = "quests";
const DAILY_MISSIONS_COUNT = 3;

/**
 * Genera un valor pseudoaleatori triangular entre 0 i 1.
 * Dona més probabilitat als valors centrals.
 *
 * @returns {number}
 */
function triangularRandom() {
  return (Math.random() + Math.random()) / 2;
}

/**
 * Interpola linealment entre dos valors.
 *
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @returns {number}
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Arrodoneix un número a 2 decimals.
 *
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Calcula la quantitat objectiu d'una missió dins del rang indicat.
 *
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function getQuestTarget(min, max) {
  const t = triangularRandom();
  return round2(lerp(min, max, t));
}

/**
 * Barreja un array i en retorna una còpia.
 *
 * @template T
 * @param {T[]} array
 * @returns {T[]}
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
 * Retorna la data d'avui amb l'hora reiniciada a 00:00:00.000.
 *
 * @returns {Date}
 */
function getStartOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Comprova si dues dates corresponen al mateix dia natural.
 *
 * @param {Date | null} dateA
 * @param {Date | null} dateB
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
 * Normalitza una data provinent de Firestore o d'una altra font.
 *
 * Accepta:
 * - Date
 * - Timestamp de Firestore amb `toDate()`
 * - valors compatibles amb `new Date(...)`
 *
 * @param {unknown} value
 * @returns {Date | null}
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
 * Valida una missió base de la col·lecció `quests`.
 *
 * Camps mínims esperats:
 * - id
 * - name
 * - minAmount
 * - maxAmount
 *
 * @param {any} quest
 * @returns {void}
 */
function validateBaseQuest(quest) {
  if (typeof quest !== "object" || quest === null) {
    throw new TypeError("Una missió base no té un format vàlid.");
  }

  if (typeof quest.id !== "string" || quest.id.trim() === "") {
    throw new Error('El camp "id" de la missió és obligatori.');
  }

  if (typeof quest.name !== "string" || quest.name.trim() === "") {
    throw new Error('El camp "name" de la missió és obligatori.');
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
}

/**
 * Crea una còpia de missió diària a partir d'una missió base.
 *
 * Estructura resultant:
 * - missionId
 * - title
 * - amountTarget
 * - currentProgress
 * - completed
 * - active
 * - startTimestamp
 * - endTimestamp
 *
 * @param {any} quest
 * @returns {{
 *   missionId: string,
 *   title: string,
 *   amountTarget: number,
 *   currentProgress: number,
 *   completed: boolean,
 *   active: boolean,
 *   startTimestamp: Date | null,
 *   endTimestamp: Date | null
 * }}
 */
function createDailyMissionFromQuest(quest) {
  validateBaseQuest(quest);

  return {
    missionId: quest.id,
    title: quest.name.trim(),
    amountTarget: getQuestTarget(quest.minAmount, quest.maxAmount),
    currentProgress: 0,
    completed: false,
    active: false,
    startTimestamp: null,
    endTimestamp: null
  };
}

/**
 * Obté missions base actives, en selecciona aleatòriament un nombre concret
 * i les transforma en missions diàries amb estat propi.
 *
 * @param {number} count
 * @returns {Promise<Object[]>}
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
 * Actualitza automàticament les missions diàries de l'usuari si no són d'avui.
 *
 * Funcionament:
 * - Llegeix les dades de l'usuari.
 * - Comprova `dailyMissionsDate`.
 * - Si la data ja és d'avui, retorna les missions actuals sense regenerar-les.
 * - Si la data no és d'avui, carrega les missions base des de `quests`.
 * - Selecciona 3 missions aleatòries en memòria.
 * - Substitueix completament `dailyMisions`.
 * - Actualitza `dailyMissionsDate` amb la data d'avui.
 *
 * @param {string} uid
 * @returns {Promise<Object[]>}
 */
export async function updateDailyMissionsIfNeeded(uid) {
  if (typeof uid !== "string" || uid.trim() === "") {
    throw new Error('El camp "uid" és obligatori.');
  }

  const normalizedUid = uid.trim();
  const userData = await selectById(USERS_COLLECTION, normalizedUid);

  if (!userData) {
    throw new Error("L'usuari no existeix.");
  }

  const today = getStartOfToday();
  const currentDailyMissionsDate = normalizeDate(userData.dailyMissionsDate);

  if (isSameDay(currentDailyMissionsDate, today)) {
    return Array.isArray(userData.dailyMisions) ? userData.dailyMisions : [];
  }

  const newDailyMissions = await getRandomDailyMissionsFromTable(DAILY_MISSIONS_COUNT);

  await updateById(USERS_COLLECTION, normalizedUid, {
    dailyMisions: newDailyMissions,
    dailyMissionsDate: today
  });

  return newDailyMissions;
}