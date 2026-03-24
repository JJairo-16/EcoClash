import { db } from "../config.js";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    runTransaction,
    setDoc,
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
    validateDailyMissionsDate,
    validateDailyMisions,
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

/**
 * @typedef {Object} UserExtraData
 * @property {string} username Nom d'usuari únic que es mostrarà a l'app.
 * @property {string} name Nom real de l'usuari.
 * @property {string} surname Primer cognom de l'usuari.
 * @property {string} [lastname] Segon cognom de l'usuari.
 * @property {string} [phoneNum] Número de telèfon de l'usuari.
 * @property {Date} birthDate Data de naixement de l'usuari.
 */

/**
 * @typedef {Object} UserSettings
 * @property {boolean} notifications Si l'usuari vol rebre notificacions.
 * @property {number} profilePrivacy Com vol l'usuari que sigui el seu perfil.
 * @property {boolean} bigLetters Si l'usuari vol que les lletres de l'app siguin grans.
 * @property {boolean|null} darkTheme Si l'usuari vol tema fosc, clar o imitar el sistema.
 */

/**
 * @typedef {Object} UserDocument
 * @property {string} username Nom d'usuari únic.
 * @property {string} name Nom real.
 * @property {string} surname Primer cognom.
 * @property {string} lastname Segon cognom.
 * @property {string} phoneNum Número de telèfon.
 * @property {Date} birthDate Data de naixement.
 * @property {string} email Correu electrònic únic.
 * @property {number} level Nivell actual de l'usuari.
 * @property {number} maxExperience Experiència màxima del nivell actual.
 * @property {number} experience Experiència actual dins del nivell.
 * @property {Array<import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js").DocumentReference>} friends Array de referències a usuaris amics.
 * @property {Array<import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js").DocumentReference>} friendsRequest Array de referències a solicituds d'usuaris d'amistat.
 * @property {Date} dailyMissionsDate Data de la missió diària.
 * @property {Array<Object>} dailyMisions Array de missions diàries.
 * @property {UserSettings} settings Configuració de l'usuari.
 */

/**
 * @typedef {Object} PublicUserUpdateData
 * @property {string} [phoneNum] Número de telèfon.
 * @property {Array<import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js").DocumentReference>} [friends] Array de referències a usuaris amics.
 * @property {Array<import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js").DocumentReference>} friendsRequest Array de referències a solicituds d'usuaris d'amistat. 
 * @property {Date} [dailyMissionsDate] Data de la missió diària.
 * @property {Array<Object>} [dailyMisions] Array de missions diàries.
 * @property {UserSettings} [settings] Configuració de l'usuari.
 */

/**
 * @typedef {Object} ProtectedUserUpdateData
 * @property {string} [username] Nom d'usuari únic.
 * @property {string} [name] Nom real.
 * @property {string} [surname] Primer cognom.
 * @property {string} [lastname] Segon cognom.
 * @property {Date} [birthDate] Data de naixement.
 * @property {string} [email] Correu electrònic.
 * @property {number} [level] Nivell actual.
 * @property {number} [maxExperience] Experiència màxima del nivell actual.
 * @property {number} [experience] Experiència actual dins del nivell.
 */

const USERS_COLLECTION = "users";

/**
 * Camps protegits que no s'han de poder modificar des d'actualitzacions públiques.
 * Inclou tota la informació personal excepte el telèfon, i també el sistema de nivell/XP.
 */
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

/**
 * Camps estrictament personals de l'usuari.
 */
const PERSONAL_USER_FIELDS = new Set([
    "username",
    "name",
    "surname",
    "lastname",
    "birthDate",
    "email"
]);

/**
 * Camps relacionats amb nivell/experiència.
 */
const LEVEL_STATE_FIELDS = new Set([
    "level",
    "maxExperience",
    "experience"
]);

/**
 * Camps públics permesos en actualitzacions normals.
 */
const PUBLIC_UPDATE_FIELDS = new Set([
    "phoneNum",
    "friends",
    "friendsRequest",
    "dailyMissionsDate",
    "dailyMisions",
    "settings"
]);

/**
 * Retorna la configuració per defecte de l'usuari.
 *
 * Valors inicials:
 * - notifications: true
 * - profilePrivacy: 2
 * - bigLetters: false
 * - darkTheme: segons preferència del sistema quan està disponible
 *
 * @returns {UserSettings}
 */
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

/**
 * Retorna la referència del document de l'usuari.
 *
 * @param {string} uid
 * @returns {import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js").DocumentReference}
 */
function getUserRef(uid) {
    const normalizedUid = validateRequiredText(uid, "uid");
    return doc(db, USERS_COLLECTION, normalizedUid);
}

/**
 * Comprova que l'usuari autenticat sigui vàlid.
 *
 * @param {import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js").User | null} user
 * @returns {string}
 */
function validateAuthUser(user) {
    if (!user || typeof user.uid !== "string" || user.uid.trim() === "") {
        throw new Error("L'usuari autenticat no és vàlid.");
    }

    return user.uid.trim();
}

/**
 * Comprova que només hi hagi camps permesos.
 *
 * @param {Record<string, unknown>} data
 * @param {Set<string>} allowedFields
 * @param {string} errorPrefix
 */
function assertOnlyAllowedFields(data, allowedFields, errorPrefix) {
    for (const key of Object.keys(data)) {
        if (!allowedFields.has(key)) {
            throw new Error(`${errorPrefix}: el camp "${key}" no es pot actualitzar aquí.`);
        }
    }
}

/**
 * Comprova que cap camp protegit s'hagi inclòs en dades públiques.
 *
 * @param {Record<string, unknown>} data
 */
function assertNoProtectedFields(data) {
    for (const key of Object.keys(data)) {
        if (PROTECTED_USER_FIELDS.has(key)) {
            throw new Error(`El camp "${key}" està protegit i no es pot actualitzar amb aquesta funció.`);
        }
    }
}

/**
 * Construeix i valida les dades inicials d'un nou usuari.
 *
 * @param {import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js").User | null} user
 * @param {UserExtraData} extraData
 * @returns {Promise<UserDocument>}
 */
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
        friendsRequest: [],
        dailyMissionsDate: new Date(),
        dailyMisions: [],
        settings: getDefaultUserSettings()
    };
}

/**
 * Valida i normalitza dades parcials de configuració.
 *
 * @param {unknown} value
 * @returns {Partial<UserSettings>}
 */
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
                if (
                    typeof fieldValue !== "number" ||
                    !Number.isInteger(fieldValue)
                ) {
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

/**
 * Valida i normalitza dades públiques actualitzables.
 * No permet modificar cap camp protegit.
 *
 * @param {PublicUserUpdateData} data
 * @returns {Partial<UserDocument>}
 */
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
            case "friends" | "friendsRequest":
                sanitizedData.friends = validateFriends(value);
                break;
            case "dailyMissionsDate":
                sanitizedData.dailyMissionsDate = validateDailyMissionsDate(value);
                break;
            case "dailyMisions":
                sanitizedData.dailyMisions = validateDailyMisions(value);
                break;
            case "settings":
                sanitizedData.settings = {
                    ...getDefaultUserSettings(),
                    ...sanitizeUserSettings(value)
                };
                break;
            default:
                throw new Error(`El camp "${key}" no es pot actualitzar.`);
        }
    }

    return sanitizedData;
}

/**
 * Valida i normalitza dades protegides.
 * Aquesta funció només s'ha d'utilitzar des de wrappers interns/controlats.
 *
 * @param {ProtectedUserUpdateData} data
 * @returns {Partial<UserDocument>}
 */
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

/**
 * Valida i normalitza només les dades personals protegides.
 *
 * @param {Partial<Pick<UserDocument, "username" | "name" | "surname" | "lastname" | "birthDate" | "email">>} data
 * @returns {Partial<UserDocument>}
 */
function sanitizePersonalUserUpdateData(data) {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
        throw new Error("Les dades personals de l'usuari no són vàlides.");
    }

    assertOnlyAllowedFields(data, PERSONAL_USER_FIELDS, "Actualització personal no permesa");

    return sanitizeProtectedUserUpdateData(data);
}

/**
 * Valida i normalitza només l'estat de nivell/experiència.
 *
 * @param {Partial<Pick<UserDocument, "level" | "maxExperience" | "experience">>} data
 * @returns {Partial<UserDocument>}
 */
function sanitizeLevelStateUpdateData(data) {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
        throw new Error("L'estat de nivell no és vàlid.");
    }

    assertOnlyAllowedFields(data, LEVEL_STATE_FIELDS, "Actualització de nivell no permesa");

    return sanitizeProtectedUserUpdateData(data);
}

/**
 * Comprova si existeix un usuari a Firestore.
 *
 * @param {import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js").User | null} user
 * @returns {Promise<boolean>}
 */
export async function userExists(user) {
    const uid = validateAuthUser(user);
    const snap = await getDoc(getUserRef(uid));
    return snap.exists();
}

/**
 * Comprova si existeix un usuari pel seu uid.
 *
 * @param {string} uid
 * @returns {Promise<boolean>}
 */
export async function userUidExists(uid) {
    const snap = await getDoc(getUserRef(uid));
    return snap.exists();
}

/**
 * Comprova si un nom d'usuari ja existeix.
 *
 * @param {string} username
 * @returns {Promise<boolean>}
 */
export async function usernameExists(username) {
    const normalizedUsername = validateUsername(username);
    const usersRef = collection(db, USERS_COLLECTION);
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
    const usersRef = collection(db, USERS_COLLECTION);
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
    const snap = await getDoc(getUserRef(uid));

    if (!snap.exists()) {
        return null;
    }

    return /** @type {UserDocument} */ (snap.data());
}

/**
 * Obté només la informació protegida de l'usuari.
 *
 * @param {string} uid
 * @returns {Promise<ProtectedUserUpdateData | null>}
 */
export async function getProtectedUserData(uid) {
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
        email: userData.email,
        level: userData.level,
        maxExperience: userData.maxExperience,
        experience: userData.experience
    };
}

/**
 * Obté només les dades personals protegides de l'usuari.
 *
 * @param {string} uid
 * @returns {Promise<Partial<Pick<UserDocument, "username" | "name" | "surname" | "lastname" | "birthDate" | "email">> | null>}
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
 * Obté només l'estat de nivell/experiència de l'usuari.
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
 * Obté la configuració d'un usuari.
 * Si el camp no existeix, retorna la configuració per defecte.
 *
 * @param {string} uid
 * @returns {Promise<UserSettings | null>}
 */
export async function getUserSettings(uid) {
    const userData = await getUserData(uid);

    if (!userData) {
        return null;
    }

    return {
        ...getDefaultUserSettings(),
        ...userData.settings
    };
}

/**
 * Crea un nou usuari a Firestore.
 * El document es desa a `users/{uid}`.
 *
 * `friends` i `dailyMisions` s'inicialitzen com arrays buits.
 * `settings` es crea automàticament amb els valors per defecte.
 *
 * @param {import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js").User | null} user
 * @param {UserExtraData} extraData
 * @returns {Promise<UserDocument>}
 */
export async function addNewUser(user, extraData) {
    const uid = validateAuthUser(user);
    const newUser = await buildNewUserData(user, extraData);

    if (await userUidExists(uid)) {
        throw new Error("Aquest usuari ja existeix.");
    }

    if (await usernameExists(newUser.username)) {
        throw new Error("El nom d'usuari ja està en ús.");
    }

    if (await emailExists(newUser.email)) {
        throw new Error("El correu electrònic ja està en ús.");
    }

    await setDoc(getUserRef(uid), newUser);

    return newUser;
}

/**
 * Actualitza parcialment només els camps públics/permesos d'un usuari.
 *
 * Camps protegits:
 * - username, name, surname, lastname, birthDate, email
 * - level, maxExperience, experience
 *
 * @param {string} uid
 * @param {PublicUserUpdateData} data
 * @returns {Promise<void>}
 */
export async function updateUserData(uid, data) {
    const userRef = getUserRef(uid);
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
 * Si el document no té configuració, es crea amb els valors per defecte
 * i s'hi apliquen els canvis indicats.
 *
 * @param {string} uid
 * @param {Partial<UserSettings>} settings
 * @returns {Promise<UserSettings>}
 */
export async function updateUserSettings(uid, settings) {
    const userRef = getUserRef(uid);
    const sanitizedSettings = sanitizeUserSettings(settings);

    return await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(userRef);

        if (!snap.exists()) {
            throw new Error("L'usuari no existeix.");
        }

        const currentUser = /** @type {UserDocument} */ (snap.data());
        const mergedSettings = {
            ...getDefaultUserSettings(),
            ...currentUser.settings,
            ...sanitizedSettings
        };

        transaction.set(
            userRef,
            { settings: mergedSettings },
            { merge: true }
        );

        return mergedSettings;
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
 * Wrapper intern per actualitzar el correu electrònic.
 *
 * @param {string} uid
 * @param {string} email
 * @returns {Promise<void>}
 */
export async function updateEmail(uid, email) {
    await updatePersonalUserData(uid, { email });
}

/**
 * Actualitza camps protegits d'un usuari.
 *
 * Aquesta funció està pensada per a fluxos interns i controlats.
 * No s'ha d'exposar a operacions de client no autoritzades.
 *
 * @param {string} uid
 * @param {ProtectedUserUpdateData} data
 * @returns {Promise<void>}
 */
export async function updateProtectedUserData(uid, data) {
    const userRef = getUserRef(uid);
    const sanitizedData = sanitizeProtectedUserUpdateData(data);

    await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(userRef);

        if (!snap.exists()) {
            throw new Error("L'usuari no existeix.");
        }

        const currentUser = /** @type {UserDocument} */ (snap.data());

        if (
            sanitizedData.username &&
            sanitizedData.username !== currentUser.username &&
            await usernameExists(sanitizedData.username)
        ) {
            throw new Error("El nom d'usuari ja està en ús.");
        }

        if (
            sanitizedData.email &&
            sanitizedData.email !== currentUser.email &&
            await emailExists(sanitizedData.email)
        ) {
            throw new Error("El correu electrònic ja està en ús.");
        }

        transaction.set(userRef, sanitizedData, { merge: true });
    });
}

/**
 * Wrapper intern per persistir l'estat de nivell/experiència.
 *
 * @param {string} uid
 * @param {{ level: number, experience: number, maxExperience: number }} levelState
 * @returns {Promise<{ level: number, experience: number, maxExperience: number }>}
 */
export async function updateUserLevelState(uid, levelState) {
    const sanitizedData = sanitizeLevelStateUpdateData(levelState);
    await updateProtectedUserData(uid, sanitizedData);

    return /** @type {{ level: number, experience: number, maxExperience: number }} */ ({
        level: sanitizedData.level,
        experience: sanitizedData.experience,
        maxExperience: sanitizedData.maxExperience
    });
}

/**
 * Assigna directament l'estat de nivell/experiència.
 * Útil per a migracions, correccions o administració controlada.
 *
 * @param {string} uid
 * @param {number} level
 * @param {number} experience
 * @returns {Promise<{ level: number, experience: number, maxExperience: number }>}
 */
export async function setUserLevelState(uid, level, experience) {
    const nextState = setLevelState(level, experience);
    return await updateUserLevelState(uid, nextState);
}

/**
 * Afegeix experiència a un usuari de manera segura i atòmica.
 * Gestiona automàticament les pujades de nivell necessàries.
 *
 * @param {string} uid
 * @param {number} gainedExperience
 * @returns {Promise<{
 *   level: number,
 *   experience: number,
 *   maxExperience: number,
 *   levelsGained: number
 * }>}
 */
export async function addUserExperience(uid, gainedExperience) {
    const normalizedGainedExperience = validateExperience(gainedExperience);
    const currentState = await getUserLevelState(uid);

    if (!currentState) {
        throw new Error("L'usuari no existeix.");
    }

    const result = addExperienceToLevelState(currentState, normalizedGainedExperience);
    await updateUserLevelState(uid, result);
    return result;
}

/**
 * Fa pujar l'usuari un nombre concret de nivells.
 * Reinicia l'experiència actual a 0 per evitar estats inconsistents.
 *
 * @param {string} uid
 * @param {number} levelsToAdd
 * @returns {Promise<{ level: number, experience: number, maxExperience: number }>}
 */
export async function levelUpUser(uid, levelsToAdd = 1) {
    const currentState = await getUserLevelState(uid);

    if (!currentState) {
        throw new Error("L'usuari no existeix.");
    }

    const result = levelUpState(currentState, levelsToAdd);
    await updateUserLevelState(uid, result);

    return {
        level: result.level,
        experience: result.experience,
        maxExperience: result.maxExperience
    };
}

/**
 * Fa baixar l'usuari un nombre concret de nivells.
 * Reinicia l'experiència actual a 0 per mantenir coherència.
 *
 * @param {string} uid
 * @param {number} levelsToRemove
 * @returns {Promise<{ level: number, experience: number, maxExperience: number }>}
 */
export async function levelDownUser(uid, levelsToRemove = 1) {
    const currentState = await getUserLevelState(uid);

    if (!currentState) {
        throw new Error("L'usuari no existeix.");
    }

    const result = levelDownState(currentState, levelsToRemove);
    await updateUserLevelState(uid, result);

    return {
        level: result.level,
        experience: result.experience,
        maxExperience: result.maxExperience
    };
}

/**
 * Estableix l'experiència actual dins del nivell de manera controlada.
 * No permet valors iguals o superiors al màxim del nivell.
 *
 * @param {string} uid
 * @param {number} experience
 * @returns {Promise<{ level: number, experience: number, maxExperience: number }>}
 */
export async function setUserExperience(uid, experience) {
    const currentState = await getUserLevelState(uid);

    if (!currentState) {
        throw new Error("L'usuari no existeix.");
    }

    const result = setExperienceInLevelState(currentState, experience);
    await updateUserLevelState(uid, result);

    return {
        level: result.level,
        experience: result.experience,
        maxExperience: result.maxExperience
    };
}

/**
 * Retorna un resum de progrés de nivell de l'usuari.
 *
 * @param {string} uid
 * @returns {Promise<{
 *   level: number,
 *   experience: number,
 *   maxExperience: number,
 *   remainingExperience: number,
 *   progress: number
 * } | null>}
 */
export async function getUserLevelProgress(uid) {
    const levelState = await getUserLevelState(uid);

    if (!levelState) {
        return null;
    }

    const progress = getProgressFromLevelState(levelState);

    return {
        level: progress.level,
        experience: progress.experience,
        maxExperience: progress.maxExperience,
        remainingExperience: progress.remainingExperience,
        progress: progress.progress
    };
}