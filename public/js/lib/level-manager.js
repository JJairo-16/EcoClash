export const BASE_MAX_EXPERIENCE = 100;
export const EXPERIENCE_LINEAR_GROWTH = 35;
export const EXPERIENCE_QUADRATIC_GROWTH = 8;
export const MAX_LEVEL = 500;

/**
 * Experiència necessària per pujar DEL nivell actual AL següent.
 * level = 1 -> XP per passar de 1 a 2
 *
 * @param {number} level
 * @returns {number}
 */
export function getMaxExperienceForLevel(level) {
    validateLevel(level);

    const normalizedLevel = level - 1;

    return Math.floor(
        BASE_MAX_EXPERIENCE +
        (normalizedLevel * EXPERIENCE_LINEAR_GROWTH) +
        (normalizedLevel * normalizedLevel * EXPERIENCE_QUADRATIC_GROWTH)
    );
}

/**
 * Àlies del valor base per defecte.
 *
 * @returns {number}
 */
export function getDefaultMaxExperience() {
    return BASE_MAX_EXPERIENCE;
}

/**
 * Experiència total acumulada necessària per assolir un nivell.
 * level = 1 -> 0 XP
 * level = 2 -> XP necessària per arribar al nivell 2
 *
 * @param {number} level
 * @returns {number}
 */
export function getTotalExperienceForLevel(level) {
    validateLevel(level);

    if (level === 1) {
        return 0;
    }

    let total = 0;

    for (let currentLevel = 1; currentLevel < level; currentLevel++) {
        total += getMaxExperienceForLevel(currentLevel);
    }

    return total;
}

/**
 * Retorna el nivell actual segons l'experiència total acumulada.
 *
 * @param {number} totalExperience
 * @returns {number}
 */
export function getLevelFromExperience(totalExperience) {
    validateExperience(totalExperience);

    let level = 1;
    let accumulated = 0;

    while (level < MAX_LEVEL) {
        const required = getMaxExperienceForLevel(level);

        if (accumulated + required > totalExperience) {
            break;
        }

        accumulated += required;
        level++;
    }

    return level;
}

/**
 * Retorna el progrés detallat de l'usuari a partir de l'experiència total acumulada.
 *
 * @param {number} totalExperience
 * @returns {{
 *   level: number,
 *   totalExperience: number,
 *   currentExperience: number,
 *   requiredExperience: number,
 *   remainingExperience: number,
 *   progress: number,
 *   isMaxLevel: boolean
 * }}
 */
export function getLevelProgress(totalExperience) {
    validateExperience(totalExperience);

    const level = getLevelFromExperience(totalExperience);
    const currentLevelTotal = getTotalExperienceForLevel(level);
    const nextLevelRequired =
        level >= MAX_LEVEL ? 0 : getMaxExperienceForLevel(level);

    const currentExperience = totalExperience - currentLevelTotal;
    const remainingExperience =
        level >= MAX_LEVEL ? 0 : Math.max(0, nextLevelRequired - currentExperience);

    return {
        level,
        totalExperience,
        currentExperience,
        requiredExperience: nextLevelRequired,
        remainingExperience,
        progress:
            level >= MAX_LEVEL || nextLevelRequired === 0
                ? 100
                : Math.min(100, (currentExperience / nextLevelRequired) * 100),
        isMaxLevel: level >= MAX_LEVEL
    };
}

/**
 * Retorna l'estat normalitzat d'un nivell concret.
 *
 * @param {number} level
 * @param {number} experience
 * @returns {{
 *   level: number,
 *   experience: number,
 *   maxExperience: number
 * }}
 */
export function createLevelState(level = 1, experience = 0) {
    const normalizedLevel = validateLevel(level);
    const normalizedExperience = validateExperience(experience);
    const maxExperience = getMaxExperienceForLevel(normalizedLevel);

    if (normalizedExperience >= maxExperience) {
        throw new Error("L'experiència indicada no pot ser igual o superior a l'experiència màxima del nivell.");
    }

    return {
        level: normalizedLevel,
        experience: normalizedExperience,
        maxExperience
    };
}

/**
 * Retorna un estat consistent recalculant el màxim d'experiència del nivell actual.
 *
 * @param {{
 *   level: number,
 *   experience: number
 * }} state
 * @returns {{
 *   level: number,
 *   experience: number,
 *   maxExperience: number
 * }}
 */
export function normalizeLevelState(state) {
    if (typeof state !== "object" || state === null || Array.isArray(state)) {
        throw new Error("L'estat de nivell no és vàlid.");
    }

    return createLevelState(state.level, state.experience);
}

/**
 * Afegeix experiència a un estat de nivell de manera segura.
 * Gestiona automàticament les pujades de nivell necessàries.
 *
 * @param {{
 *   level: number,
 *   experience: number
 * }} state
 * @param {number} gainedExperience
 * @returns {{
 *   level: number,
 *   experience: number,
 *   maxExperience: number,
 *   levelsGained: number
 * }}
 */
export function addExperienceToLevelState(state, gainedExperience) {
    const normalizedState = normalizeLevelState(state);
    const pendingGain = validateExperience(gainedExperience);

    if (pendingGain === 0) {
        return {
            ...normalizedState,
            levelsGained: 0
        };
    }

    let level = normalizedState.level;
    let experience = normalizedState.experience;
    let maxExperience = normalizedState.maxExperience;
    let remainingGain = pendingGain;
    let levelsGained = 0;

    while (remainingGain > 0) {
        const remainingToLevelUp = maxExperience - experience;

        if (remainingGain < remainingToLevelUp) {
            experience += remainingGain;
            break;
        }

        remainingGain -= remainingToLevelUp;

        if (level >= MAX_LEVEL) {
            experience = maxExperience;
            break;
        }

        level += 1;
        levelsGained += 1;
        experience = 0;
        maxExperience = getMaxExperienceForLevel(level);
    }

    return {
        level,
        experience,
        maxExperience,
        levelsGained
    };
}

/**
 * Fa pujar un estat un nombre concret de nivells.
 * Reinicia l'experiència a 0.
 *
 * @param {{
 *   level: number,
 *   experience: number
 * }} state
 * @param {number} levelsToAdd
 * @returns {{
 *   level: number,
 *   experience: number,
 *   maxExperience: number,
 *   levelsGained: number
 * }}
 */
export function levelUpState(state, levelsToAdd = 1) {
    normalizeLevelState(state);

    if (!Number.isInteger(levelsToAdd) || levelsToAdd < 1) {
        throw new Error("El nombre de nivells a afegir ha de ser un enter més gran o igual a 1.");
    }

    const nextLevel = validateLevel(Math.min(MAX_LEVEL, state.level + levelsToAdd));
    const maxExperience = getMaxExperienceForLevel(nextLevel);

    return {
        level: nextLevel,
        experience: 0,
        maxExperience,
        levelsGained: nextLevel - state.level
    };
}

/**
 * Fa baixar un estat un nombre concret de nivells.
 * Reinicia l'experiència a 0.
 *
 * @param {{
 *   level: number,
 *   experience: number
 * }} state
 * @param {number} levelsToRemove
 * @returns {{
 *   level: number,
 *   experience: number,
 *   maxExperience: number,
 *   levelsLost: number
 * }}
 */
export function levelDownState(state, levelsToRemove = 1) {
    normalizeLevelState(state);

    if (!Number.isInteger(levelsToRemove) || levelsToRemove < 1) {
        throw new Error("El nombre de nivells a treure ha de ser un enter més gran o igual a 1.");
    }

    const nextLevel = validateLevel(Math.max(1, state.level - levelsToRemove));
    const maxExperience = getMaxExperienceForLevel(nextLevel);

    return {
        level: nextLevel,
        experience: 0,
        maxExperience,
        levelsLost: state.level - nextLevel
    };
}

/**
 * Estableix directament el nivell i l'experiència dins del nivell.
 *
 * @param {number} level
 * @param {number} experience
 * @returns {{
 *   level: number,
 *   experience: number,
 *   maxExperience: number
 * }}
 */
export function setLevelState(level, experience) {
    return createLevelState(level, experience);
}

/**
 * Estableix només l'experiència d'un estat existent.
 *
 * @param {{
 *   level: number,
 *   experience: number
 * }} state
 * @param {number} experience
 * @returns {{
 *   level: number,
 *   experience: number,
 *   maxExperience: number
 * }}
 */
export function setExperienceInLevelState(state, experience) {
    const normalizedState = normalizeLevelState(state);
    return createLevelState(normalizedState.level, experience);
}

/**
 * Retorna el progrés detallat d'un estat de nivell.
 *
 * @param {{
 *   level: number,
 *   experience: number
 * }} state
 * @returns {{
 *   level: number,
 *   experience: number,
 *   maxExperience: number,
 *   remainingExperience: number,
 *   progress: number,
 *   isMaxLevel: boolean
 * }}
 */
export function getProgressFromLevelState(state) {
    const normalizedState = normalizeLevelState(state);
    const remainingExperience = Math.max(
        0,
        normalizedState.maxExperience - normalizedState.experience
    );

    return {
        level: normalizedState.level,
        experience: normalizedState.experience,
        maxExperience: normalizedState.maxExperience,
        remainingExperience,
        progress:
            normalizedState.maxExperience === 0
                ? 100
                : Math.min(
                    100,
                    (normalizedState.experience / normalizedState.maxExperience) * 100
                ),
        isMaxLevel: normalizedState.level >= MAX_LEVEL
    };
}

/**
 * Retorna l'experiència total acumulada a partir d'un estat de nivell.
 *
 * @param {{
 *   level: number,
 *   experience: number
 * }} state
 * @returns {number}
 */
export function getTotalExperienceFromLevelState(state) {
    const normalizedState = normalizeLevelState(state);

    return (
        getTotalExperienceForLevel(normalizedState.level) +
        normalizedState.experience
    );
}

function validateLevel(level) {
    if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
        throw new Error(`El nivell ha de ser un enter entre 1 i ${MAX_LEVEL}.`);
    }

    return level;
}

function validateExperience(totalExperience) {
    if (!Number.isFinite(totalExperience) || totalExperience < 0) {
        throw new Error("L'experiència total ha de ser un nombre més gran o igual a 0.");
    }

    return Math.floor(totalExperience);
}