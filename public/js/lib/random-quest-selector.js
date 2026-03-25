import { selectById, selectAll, updateById } from "./firestore.js";

const USER_DATA_COLLECTION = "userData";
const QUESTS_COLLECTION = "quests";
const DAILY_MISSIONS_COUNT = 3;

function triangularRandom() {
  return (Math.random() + Math.random()) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function getQuestTarget(min, max) {
  const t = triangularRandom();
  return round2(lerp(min, max, t));
}

function shuffle(array) {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function getStartOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isSameDay(dateA, dateB) {
  if (!(dateA instanceof Date) || Number.isNaN(dateA.getTime())) return false;
  if (!(dateB instanceof Date) || Number.isNaN(dateB.getTime())) return false;

  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

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

function getQuestId(quest) {
  if (typeof quest.id === "string" && quest.id.trim() !== "") {
    return quest.id.trim();
  }

  if (typeof quest.questId === "string" && quest.questId.trim() !== "") {
    return quest.questId.trim();
  }

  return null;
}

function getQuestTitle(quest) {
  if (typeof quest.name === "string" && quest.name.trim() !== "") {
    return quest.name.trim();
  }

  if (typeof quest.title === "string" && quest.title.trim() !== "") {
    return quest.title.trim();
  }

  return null;
}

function createDailyMissionFromQuest(quest) {
  const { questId, questTitle } = validateBaseQuest(quest);

  return {
    missionId: questId,
    title: questTitle,
    amountTarget: getQuestTarget(quest.minAmount, quest.maxAmount),
    currentProgress: 0,
    completed: false,
    active: false,
    startTimestamp: null,
    endTimestamp: null
  };
}

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

  if (isSameDay(currentDailyMissionsDate, today)) {
    return Array.isArray(userData.dailyMisions) ? userData.dailyMisions : [];
  }

  const newDailyMissions = await getRandomDailyMissionsFromTable(DAILY_MISSIONS_COUNT);

  await updateById(USER_DATA_COLLECTION, normalizedUid, {
    dailyMisions: newDailyMissions,
    dailyMissionsDate: today
  });

  return newDailyMissions;
}

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