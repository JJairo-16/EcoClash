const dailyMissionCache = new Map();

function cloneMission(mission) {
  if (typeof mission !== "object" || mission === null) {
    return mission;
  }

  return { ...mission };
}

function cloneMissionsArray(missions) {
  return Array.isArray(missions) ? missions.map(cloneMission) : null;
}

/**
 * Retorna la clau del dia actual en format YYYY-MM-DD.
 *
 * @returns {string}
 */
function getTodayCacheKey() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString().slice(0, 10);
}

/**
 * Obté les missions cachejades d'un usuari si encara són d'avui.
 *
 * @param {string} uid
 * @returns {Array|null}
 */
export function getCachedDailyMissions(uid) {
  if (typeof uid !== "string" || uid.trim() === "") {
    return null;
  }

  const normalizedUid = uid.trim();
  const cachedEntry = dailyMissionCache.get(normalizedUid);

  if (!cachedEntry) {
    return null;
  }

  if (cachedEntry.dateKey !== getTodayCacheKey()) {
    dailyMissionCache.delete(normalizedUid);
    return null;
  }

  return cloneMissionsArray(cachedEntry.missions);
}

/**
 * Desa les missions diàries en caché per a l'usuari actual.
 *
 * @param {string} uid
 * @param {Array} missions
 * @returns {void}
 */
export function setCachedDailyMissions(uid, missions) {
  if (typeof uid !== "string" || uid.trim() === "") {
    throw new Error('El camp "uid" és obligatori.');
  }

  if (!Array.isArray(missions)) {
    throw new TypeError('El camp "missions" no és vàlid.');
  }

  const normalizedUid = uid.trim();

  dailyMissionCache.set(normalizedUid, {
    dateKey: getTodayCacheKey(),
    missions: cloneMissionsArray(missions)
  });
}

/**
 * Elimina la caché de missions diàries d'un usuari.
 *
 * @param {string} uid
 * @returns {void}
 */
export function clearCachedDailyMissions(uid) {
  if (typeof uid !== "string" || uid.trim() === "") {
    return;
  }

  dailyMissionCache.delete(uid.trim());
}

/**
 * Neteja tota la caché.
 *
 * @returns {void}
 */
export function clearAllDailyMissionsCache() {
  dailyMissionCache.clear();
}