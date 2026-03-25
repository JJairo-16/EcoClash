import { db } from "../config.js";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    runTransaction,
    where
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
    validateUsername,
    validateName,
    validateSurname,
    validateLastname,
    validatePhoneNum,
    validateBirthDate,
    validateEmail,
    validateLevel,
    validateMaxExperience,
    validateExperience,
    validateFriends,
    validateRequiredText,
    validateUserExtraData
} from "./user-validators.js";
import {
    addExperienceToLevelState,
    getDefaultMaxExperience,
    getProgressFromLevelState,
    levelDownState,
    levelUpState,
    setExperienceInLevelState,
    setLevelState
} from "./level-manager.js";
import { updateDailyMissionsIfNeeded } from "./random-quest-selector.js";

/**
 * @typedef {Object} UserExtraData
 * @property {string} username
 * @property {string} name
 * @property {string} surname
 * @property {string} [lastname]
 * @property {string} [phoneNum]
 * @property {Date} birthDate
 */

/**
 * @typedef {Object} UserSettings
 * @property {boolean} notifications
 * @property {number} profilePrivacy
 * @property {boolean} bigLetters
 * @property {boolean|null} darkTheme
 */

/**
 * @typedef {Object} UserDocument
 * @property {string} username
 * @property {string} name
 * @property {string} surname
 * @property {string} lastname
 * @property {string} phoneNum
 * @property {Date} birthDate
 * @property {string} email
 * @property {number} level
 * @property {number} maxExperience
 * @property {number} experience
 * @property {Array<import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js").DocumentReference>} friends
 * @property {Array<import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js").DocumentReference>} friendsRequest
 */

const USER_DATA_COLLECTION = "userData";
const USER_SETTINGS_COLLECTION = "userSettings";

const PROTECTED_USER_FIELDS = new Set([
    "username",
    "name",
    "surname",
    "lastname",
    "birthDate",
    "email",
    "level",
    "maxExperience",
    "experience"
]);

const PERSONAL_USER_FIELDS = new Set([
    "username",
    "name",
    "surname",
    "lastname",
    "birthDate",
    "email"
]);

const LEVEL_STATE_FIELDS = new Set([
    "level",
    "maxExperience",
    "experience"
]);

const PUBLIC_UPDATE_FIELDS = new Set([
    "phoneNum",
    "friends",
    "friendsRequest"
]);

function getDefaultUserSettings() {
    const supportsMatchMedia =
        typeof globalThis !== "undefined" &&
        typeof globalThis.matchMedia === "function";

    return {
        notifications: true,
        profilePrivacy: 2,
        bigLetters: false,
        darkTheme: supportsMatchMedia
            ? globalThis.matchMedia("(prefers-color-scheme: dark)").matches
            : null
    };
}

function getUserDataRef(uid) {
    return doc(db, USER_DATA_COLLECTION, validateRequiredText(uid, "uid"));
}

function getUserSettingsRef(uid) {
    return doc(db, USER_SETTINGS_COLLECTION, validateRequiredText(uid, "uid"));
}

function validateAuthUser(user) {
    if (!user || typeof user.uid !== "string" || user.uid.trim() === "") {
        throw new Error("L'usuari autenticat no és vàlid.");
    }

    return user.uid.trim();
}

function assertOnlyAllowedFields(data, allowedFields, errorPrefix) {
    for (const key of Object.keys(data)) {
        if (!allowedFields.has(key)) {
            throw new Error(`${errorPrefix}: el camp "${key}" no es pot actualitzar aquí.`);
        }
    }
}

function assertNoProtectedFields(data) {
    for (const key of Object.keys(data)) {
        if (PROTECTED_USER_FIELDS.has(key)) {
            throw new Error(`El camp "${key}" està protegit i no es pot actualitzar amb aquesta funció.`);
        }
    }
}

async function buildNewUserData(user, extraData) {
    validateAuthUser(user);

    if (!user.email) {
        throw new Error("L'usuari autenticat no té un correu electrònic vàlid.");
    }

    validateUserExtraData(extraData);

    return {
        username: validateUsername(extraData.username),
        name: validateName(extraData.name),
        surname: validateSurname(extraData.surname),
        lastname: validateLastname(extraData.lastname),
        phoneNum: validatePhoneNum(extraData.phoneNum),
        birthDate: validateBirthDate(extraData.birthDate),
        email: validateEmail(user.email),
        level: 1,
        maxExperience: validateMaxExperience(getDefaultMaxExperience()),
        experience: 0,
        friends: [],
        friendsRequest: []
    };
}

function sanitizeUserSettings(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("La configuració de l'usuari no és vàlida.");
    }

    const entries = Object.entries(value);

    if (entries.length === 0) {
        throw new Error("No s'ha indicat cap camp de configuració per actualitzar.");
    }

    /** @type {Partial<UserSettings>} */
    const sanitizedSettings = {};

    for (const [key, fieldValue] of entries) {
        switch (key) {
            case "notifications":
                if (typeof fieldValue !== "boolean") {
                    throw new TypeError('El camp "notifications" no és vàlid.');
                }
                sanitizedSettings.notifications = fieldValue;
                break;
            case "profilePrivacy":
                if (typeof fieldValue !== "number" || !Number.isInteger(fieldValue)) {
                    throw new TypeError('El camp "profilePrivacy" no és vàlid.');
                }
                sanitizedSettings.profilePrivacy = fieldValue;
                break;
            case "bigLetters":
                if (typeof fieldValue !== "boolean") {
                    throw new TypeError('El camp "bigLetters" no és vàlid.');
                }
                sanitizedSettings.bigLetters = fieldValue;
                break;
            case "darkTheme":
                if (fieldValue !== null && typeof fieldValue !== "boolean") {
                    throw new TypeError('El camp "darkTheme" no és vàlid.');
                }
                sanitizedSettings.darkTheme = fieldValue;
                break;
            default:
                throw new Error(`El camp de configuració "${key}" no existeix.`);
        }
    }

    return sanitizedSettings;
}

function sanitizePublicUserUpdateData(data) {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
        throw new Error("Les dades de l'usuari no són vàlides.");
    }

    assertNoProtectedFields(data);
    assertOnlyAllowedFields(data, PUBLIC_UPDATE_FIELDS, "Actualització no permesa");

    /** @type {Partial<UserDocument>} */
    const sanitizedData = {};

    for (const [key, value] of Object.entries(data)) {
        switch (key) {
            case "phoneNum":
                sanitizedData.phoneNum = validatePhoneNum(value);
                break;
            case "friends":
                sanitizedData.friends = validateFriends(value);
                break;
            case "friendsRequest":
                sanitizedData.friendsRequest = validateFriends(value);
                break;
            default:
                throw new Error(`El camp "${key}" no es pot actualitzar.`);
        }
    }

    return sanitizedData;
}

function sanitizeProtectedUserUpdateData(data) {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
        throw new Error("Les dades protegides de l'usuari no són vàlides.");
    }

    assertOnlyAllowedFields(data, PROTECTED_USER_FIELDS, "Actualització protegida no permesa");

    /** @type {Partial<UserDocument>} */
    const sanitizedData = {};

    for (const [key, value] of Object.entries(data)) {
        switch (key) {
            case "username":
                sanitizedData.username = validateUsername(value);
                break;
            case "name":
                sanitizedData.name = validateName(value);
                break;
            case "surname":
                sanitizedData.surname = validateSurname(value);
                break;
            case "lastname":
                sanitizedData.lastname = validateLastname(value);
                break;
            case "birthDate":
                sanitizedData.birthDate = validateBirthDate(value);
                break;
            case "email":
                sanitizedData.email = validateEmail(value);
                break;
            case "level":
                sanitizedData.level = validateLevel(value);
                break;
            case "maxExperience":
                sanitizedData.maxExperience = validateMaxExperience(value);
                break;
            case "experience":
                sanitizedData.experience = validateExperience(value);
                break;
            default:
                throw new Error(`El camp protegit "${key}" no es pot actualitzar.`);
        }
    }

    return sanitizedData;
}

function sanitizePersonalUserUpdateData(data) {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
        throw new Error("Les dades personals de l'usuari no són vàlides.");
    }

    assertOnlyAllowedFields(data, PERSONAL_USER_FIELDS, "Actualització personal no permesa");
    return sanitizeProtectedUserUpdateData(data);
}

function sanitizeLevelStateUpdateData(data) {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
        throw new Error("L'estat de nivell no és vàlid.");
    }

    assertOnlyAllowedFields(data, LEVEL_STATE_FIELDS, "Actualització de nivell no permesa");
    return sanitizeProtectedUserUpdateData(data);
}

async function userDataDocExists(uid) {
    const snap = await getDoc(getUserDataRef(uid));
    return snap.exists();
}

async function userSettingsDocExists(uid) {
    const snap = await getDoc(getUserSettingsRef(uid));
    return snap.exists();
}

/**
 * Comprova si existeix un usuari a Firestore.
 * Necessita tant `userData/{uid}` com `userSettings/{uid}`.
 *
 * @param {import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js").User | null} user
 * @returns {Promise<boolean>}
 */
export async function userExists(user) {
    const uid = validateAuthUser(user);
    const [hasUserData, hasUserSettings] = await Promise.all([
        userDataDocExists(uid),
        userSettingsDocExists(uid)
    ]);

    return hasUserData && hasUserSettings;
}

/**
 * Comprova si existeix un usuari pel seu uid.
 * Necessita tant `userData/{uid}` com `userSettings/{uid}`.
 *
 * @param {string} uid
 * @returns {Promise<boolean>}
 */
export async function userUidExists(uid) {
    const normalizedUid = validateRequiredText(uid, "uid");

    const [hasUserData, hasUserSettings] = await Promise.all([
        userDataDocExists(normalizedUid),
        userSettingsDocExists(normalizedUid)
    ]);

    return hasUserData && hasUserSettings;
}

/**
 * Comprova si un nom d'usuari ja existeix.
 *
 * @param {string} username
 * @returns {Promise<boolean>}
 */
export async function usernameExists(username) {
    const normalizedUsername = validateUsername(username);
    const usersRef = collection(db, USER_DATA_COLLECTION);
    const q = query(usersRef, where("username", "==", normalizedUsername));
    const snapshot = await getDocs(q);

    return !snapshot.empty;
}

/**
 * Comprova si un correu electrònic ja existeix.
 *
 * @param {string} email
 * @returns {Promise<boolean>}
 */
export async function emailExists(email) {
    const normalizedEmail = validateEmail(email);
    const usersRef = collection(db, USER_DATA_COLLECTION);
    const q = query(usersRef, where("email", "==", normalizedEmail));
    const snapshot = await getDocs(q);

    return !snapshot.empty;
}

/**
 * Obté les dades d'un usuari a partir del seu uid.
 *
 * @param {string} uid
 * @returns {Promise<UserDocument | null>}
 */
export async function getUserData(uid) {
    const normalizedUid = validateRequiredText(uid, "uid");
    const snap = await getDoc(getUserDataRef(normalizedUid));

    if (!snap.exists()) {
        return null;
    }

    return /** @type {UserDocument} */ (snap.data());
}

/**
 * Obté només les dades personals protegides.
 *
 * @param {string} uid
 * @returns {Promise<Pick<UserDocument, "username" | "name" | "surname" | "lastname" | "birthDate" | "email"> | null>}
 */
export async function getPersonalUserData(uid) {
    const userData = await getUserData(uid);

    if (!userData) {
        return null;
    }

    return {
        username: userData.username,
        name: userData.name,
        surname: userData.surname,
        lastname: userData.lastname,
        birthDate: userData.birthDate,
        email: userData.email
    };
}

/**
 * Obté només l'estat de nivell/experiència.
 *
 * @param {string} uid
 * @returns {Promise<Pick<UserDocument, "level" | "maxExperience" | "experience"> | null>}
 */
export async function getUserLevelState(uid) {
    const userData = await getUserData(uid);

    if (!userData) {
        return null;
    }

    return {
        level: userData.level,
        maxExperience: userData.maxExperience,
        experience: userData.experience
    };
}

/**
 * Obté el progrés del nivell de l'usuari.
 *
 * @param {string} uid
 * @returns {Promise<{ level: number, experience: number, maxExperience: number, progress: number } | null>}
 */
export async function getUserLevelProgress(uid) {
    const levelState = await getUserLevelState(uid);

    if (!levelState) {
        return null;
    }

    return getProgressFromLevelState(levelState);
}

/**
 * Obté la configuració d'un usuari.
 * Si el document no existeix, retorna null.
 * Si existeix però és buit, retorna la configuració per defecte.
 *
 * @param {string} uid
 * @returns {Promise<UserSettings | null>}
 */
export async function getUserSettings(uid) {
    const normalizedUid = validateRequiredText(uid, "uid");
    const snap = await getDoc(getUserSettingsRef(normalizedUid));

    if (!snap.exists()) {
        return null;
    }

    return {
        ...getDefaultUserSettings(),
        ...snap.data()
    };
}

/**
 * Crea un nou usuari a Firestore.
 * Desa:
 * - `userData/{uid}` amb les dades del perfil
 * - `userSettings/{uid}` amb la configuració per defecte
 *
 * A més, genera les missions diàries inicials des de `quests`
 * i les desa dins `userData/{uid}`.
 *
 * Si les col·leccions no existeixen, Firestore les crearà automàticament
 * en crear aquests documents.
 *
 * @param {import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js").User | null} user
 * @param {UserExtraData} extraData
 * @returns {Promise<UserDocument>}
 */
export async function addNewUser(user, extraData) {
    const uid = validateAuthUser(user);
    const newUser = await buildNewUserData(user, extraData);
    const defaultSettings = getDefaultUserSettings();

    if (await userUidExists(uid)) {
        throw new Error("Aquest usuari ja existeix.");
    }

    if (await usernameExists(newUser.username)) {
        throw new Error("El nom d'usuari ja està en ús.");
    }

    if (await emailExists(newUser.email)) {
        throw new Error("El correu electrònic ja està en ús.");
    }

    await runTransaction(db, async (transaction) => {
        const userDataRef = getUserDataRef(uid);
        const userSettingsRef = getUserSettingsRef(uid);

        const [userDataSnap, userSettingsSnap] = await Promise.all([
            transaction.get(userDataRef),
            transaction.get(userSettingsRef)
        ]);

        if (userDataSnap.exists() || userSettingsSnap.exists()) {
            throw new Error("Aquest usuari ja existeix.");
        }

        transaction.set(userDataRef, newUser);
        transaction.set(userSettingsRef, defaultSettings);
    });

    try {
        await updateDailyMissionsIfNeeded(uid);
    } catch (error) {
        console.error("No se pudieron generar las misiones iniciales:", error);
        // No lanzamos error aquí para no romper el registro del usuario
    }

    const createdUser = await getUserData(uid);

    if (!createdUser) {
        throw new Error("No s'han pogut recuperar les dades del nou usuari.");
    }

    return createdUser;
}

/**
 * Actualitza parcialment només els camps públics/permesos d'un usuari.
 *
 * Camps protegits:
 * - username, name, surname, lastname, birthDate, email
 * - level, maxExperience, experience
 *
 * @param {string} uid
 * @param {Partial<UserDocument>} data
 * @returns {Promise<void>}
 */
export async function updateUserData(uid, data) {
    const normalizedUid = validateRequiredText(uid, "uid");
    const userRef = getUserDataRef(normalizedUid);
    const sanitizedData = sanitizePublicUserUpdateData(data);

    await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(userRef);

        if (!snap.exists()) {
            throw new Error("L'usuari no existeix.");
        }

        transaction.set(userRef, sanitizedData, { merge: true });
    });
}

/**
 * Actualitza parcialment la configuració d'un usuari.
 * Si el document de configuració no existeix, es crea.
 *
 * @param {string} uid
 * @param {Partial<UserSettings>} settings
 * @returns {Promise<UserSettings>}
 */
export async function updateUserSettings(uid, settings) {
    const normalizedUid = validateRequiredText(uid, "uid");
    const userDataRef = getUserDataRef(normalizedUid);
    const userSettingsRef = getUserSettingsRef(normalizedUid);
    const sanitizedSettings = sanitizeUserSettings(settings);

    return await runTransaction(db, async (transaction) => {
        const [userDataSnap, userSettingsSnap] = await Promise.all([
            transaction.get(userDataRef),
            transaction.get(userSettingsRef)
        ]);

        if (!userDataSnap.exists()) {
            throw new Error("L'usuari no existeix.");
        }

        const mergedSettings = {
            ...getDefaultUserSettings(),
            ...(userSettingsSnap.exists() ? userSettingsSnap.data() : {}),
            ...sanitizedSettings
        };

        transaction.set(userSettingsRef, mergedSettings, { merge: true });

        return mergedSettings;
    });
}

/**
 * Wrapper intern per actualitzar dades protegides.
 *
 * @param {string} uid
 * @param {Partial<UserDocument>} data
 * @returns {Promise<void>}
 */
export async function updateProtectedUserData(uid, data) {
    const normalizedUid = validateRequiredText(uid, "uid");
    const userRef = getUserDataRef(normalizedUid);
    const sanitizedData = sanitizeProtectedUserUpdateData(data);

    await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(userRef);

        if (!snap.exists()) {
            throw new Error("L'usuari no existeix.");
        }

        transaction.set(userRef, sanitizedData, { merge: true });
    });
}

/**
 * Wrapper intern per actualitzar dades personals protegides.
 *
 * @param {string} uid
 * @param {Partial<Pick<UserDocument, "username" | "name" | "surname" | "lastname" | "birthDate" | "email">>} data
 * @returns {Promise<void>}
 */
export async function updatePersonalUserData(uid, data) {
    const sanitizedData = sanitizePersonalUserUpdateData(data);
    await updateProtectedUserData(uid, sanitizedData);
}

/**
 * Wrapper intern per actualitzar l'estat de nivell.
 *
 * @param {string} uid
 * @param {Partial<Pick<UserDocument, "level" | "maxExperience" | "experience">>} data
 * @returns {Promise<void>}
 */
export async function updateUserLevelState(uid, data) {
    const sanitizedData = sanitizeLevelStateUpdateData(data);
    await updateProtectedUserData(uid, sanitizedData);
}

/**
 * Wrapper intern per actualitzar el username.
 *
 * @param {string} uid
 * @param {string} username
 * @returns {Promise<void>}
 */
export async function updateUsername(uid, username) {
    await updatePersonalUserData(uid, { username });
}

/**
 * Wrapper intern per actualitzar el nom.
 *
 * @param {string} uid
 * @param {string} name
 * @returns {Promise<void>}
 */
export async function updateName(uid, name) {
    await updatePersonalUserData(uid, { name });
}

/**
 * Wrapper intern per actualitzar el primer cognom.
 *
 * @param {string} uid
 * @param {string} surname
 * @returns {Promise<void>}
 */
export async function updateSurname(uid, surname) {
    await updatePersonalUserData(uid, { surname });
}

/**
 * Wrapper intern per actualitzar el segon cognom.
 *
 * @param {string} uid
 * @param {string} lastname
 * @returns {Promise<void>}
 */
export async function updateLastname(uid, lastname) {
    await updatePersonalUserData(uid, { lastname });
}

/**
 * Wrapper intern per actualitzar la data de naixement.
 *
 * @param {string} uid
 * @param {Date} birthDate
 * @returns {Promise<void>}
 */
export async function updateBirthDate(uid, birthDate) {
    await updatePersonalUserData(uid, { birthDate });
}

/**
 * Wrapper intern per actualitzar l'email.
 *
 * @param {string} uid
 * @param {string} email
 * @returns {Promise<void>}
 */
export async function updateEmail(uid, email) {
    await updatePersonalUserData(uid, { email });
}

/**
 * Estableix manualment l'estat de nivell.
 *
 * @param {string} uid
 * @param {number} level
 * @param {number} [experience=0]
 * @returns {Promise<{ level: number, maxExperience: number, experience: number }>}
 */
export async function setUserLevel(uid, level, experience = 0) {
    const normalizedUid = validateRequiredText(uid, "uid");
    const userRef = getUserDataRef(normalizedUid);

    return await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(userRef);

        if (!snap.exists()) {
            throw new Error("L'usuari no existeix.");
        }

        const currentUser = /** @type {UserDocument} */ (snap.data());
        const nextState = setLevelState(
            {
                level: currentUser.level,
                maxExperience: currentUser.maxExperience,
                experience: currentUser.experience
            },
            level,
            experience
        );

        transaction.set(userRef, nextState, { merge: true });
        return nextState;
    });
}

/**
 * Estableix manualment l'experiència de l'usuari dins el seu nivell actual.
 *
 * @param {string} uid
 * @param {number} experience
 * @returns {Promise<{ level: number, maxExperience: number, experience: number }>}
 */
export async function setUserExperience(uid, experience) {
    const normalizedUid = validateRequiredText(uid, "uid");
    const userRef = getUserDataRef(normalizedUid);

    return await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(userRef);

        if (!snap.exists()) {
            throw new Error("L'usuari no existeix.");
        }

        const currentUser = /** @type {UserDocument} */ (snap.data());
        const nextState = setExperienceInLevelState(
            {
                level: currentUser.level,
                maxExperience: currentUser.maxExperience,
                experience: currentUser.experience
            },
            experience
        );

        transaction.set(userRef, nextState, { merge: true });
        return nextState;
    });
}

/**
 * Afegeix experiència a l'usuari i aplica pujades de nivell automàtiques si cal.
 *
 * @param {string} uid
 * @param {number} amount
 * @returns {Promise<{ level: number, maxExperience: number, experience: number, progress: number }>}
 */
export async function addUserExperience(uid, amount) {
    const normalizedUid = validateRequiredText(uid, "uid");
    const userRef = getUserDataRef(normalizedUid);

    return await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(userRef);

        if (!snap.exists()) {
            throw new Error("L'usuari no existeix.");
        }

        const currentUser = /** @type {UserDocument} */ (snap.data());
        const nextState = addExperienceToLevelState(
            {
                level: currentUser.level,
                maxExperience: currentUser.maxExperience,
                experience: currentUser.experience
            },
            amount
        );

        transaction.set(userRef, nextState, { merge: true });

        return getProgressFromLevelState(nextState);
    });
}

/**
 * Puja de nivell manualment.
 *
 * @param {string} uid
 * @param {number} [amount=1]
 * @returns {Promise<{ level: number, maxExperience: number, experience: number }>}
 */
export async function levelUpUser(uid, amount = 1) {
    const normalizedUid = validateRequiredText(uid, "uid");
    const userRef = getUserDataRef(normalizedUid);

    return await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(userRef);

        if (!snap.exists()) {
            throw new Error("L'usuari no existeix.");
        }

        const currentUser = /** @type {UserDocument} */ (snap.data());
        const nextState = levelUpState(
            {
                level: currentUser.level,
                maxExperience: currentUser.maxExperience,
                experience: currentUser.experience
            },
            amount
        );

        transaction.set(userRef, nextState, { merge: true });
        return nextState;
    });
}

/**
 * Baixa de nivell manualment.
 *
 * @param {string} uid
 * @param {number} [amount=1]
 * @returns {Promise<{ level: number, maxExperience: number, experience: number }>}
 */
export async function levelDownUser(uid, amount = 1) {
    const normalizedUid = validateRequiredText(uid, "uid");
    const userRef = getUserDataRef(normalizedUid);

    return await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(userRef);

        if (!snap.exists()) {
            throw new Error("L'usuari no existeix.");
        }

        const currentUser = /** @type {UserDocument} */ (snap.data());
        const nextState = levelDownState(
            {
                level: currentUser.level,
                maxExperience: currentUser.maxExperience,
                experience: currentUser.experience
            },
            amount
        );

        transaction.set(userRef, nextState, { merge: true });
        return nextState;
    });
}