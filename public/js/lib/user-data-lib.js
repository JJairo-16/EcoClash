import { db } from "../config.js";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
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
    validateUserExtraData,
    validatePartialUserData
} from "./validators.js";

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
 * @property {Date} dailyMissionsDate Data de la missió diària.
 * @property {Array<Object>} dailyMisions Array de missions diàries.
 * @property {UserSettings} settings Configuració de l'usuari.
 */

const USERS_COLLECTION = "users";

/**
 * Retorna la configuració per defecte de l'usuari.
 *
 * Valors inicials:
 * - notifications: true
 * - profilePrivacy: 2
 * - bigLetters: false
 * - darkTheme: null (imitar el sistema)
 *
 * @returns {UserSettings}
 */
function getDefaultUserSettings() {
    return {
        notifications: true,
        profilePrivacy: 2,
        bigLetters: false,
        darkTheme: globalThis.matchMedia('(prefers-color-scheme: dark)').matches
    };
}

/**
 * Retorna la referència del document de l'usuari.
 * @param {string} uid
 * @returns {import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js").DocumentReference}
 */
function getUserRef(uid) {
    const normalizedUid = validateRequiredText(uid, "uid");
    return doc(db, USERS_COLLECTION, normalizedUid);
}

/**
 * Construeix i valida les dades inicials d'un nou usuari.
 *
 * @param {import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js").User | null} user
 * @param {UserExtraData} extraData
 * @returns {UserDocument}
 */
function buildNewUserData(user, extraData) {
    if (!user || typeof user.uid !== "string" || user.uid.trim() === "") {
        throw new Error("L'usuari autenticat no és vàlid.");
    }

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
        maxExperience: 100,
        experience: 0,
        friends: [],
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
                    throw new TypeError("El camp \"notifications\" no és vàlid.");
                }
                sanitizedSettings.notifications = fieldValue;
                break;

            case "profilePrivacy":
                if (
                    typeof fieldValue !== "number" ||
                    !Number.isInteger(fieldValue)
                ) {
                    throw new TypeError("El camp \"profilePrivacy\" no és vàlid.");
                }
                sanitizedSettings.profilePrivacy = fieldValue;
                break;

            case "bigLetters":
                if (typeof fieldValue !== "boolean") {
                    throw new TypeError("El camp \"bigLetters\" no és vàlid.");
                }
                sanitizedSettings.bigLetters = fieldValue;
                break;

            case "darkTheme":
                if (fieldValue !== null && typeof fieldValue !== "boolean") {
                    throw new Error("El camp \"darkTheme\" no és vàlid.");
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
 * Valida i normalitza dades parcials d'un usuari.
 * Només s'accepten camps existents al model.
 *
 * @param {Partial<UserDocument>} data
 * @returns {Partial<UserDocument>}
 */
function sanitizeUserUpdateData(data) {
    validatePartialUserData(data);

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
            case "phoneNum":
                sanitizedData.phoneNum = validatePhoneNum(value);
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
            case "friends":
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
        }
    }

    return sanitizedData;
}

/**
 * Comprova si existeix un usuari a Firestore.
 *
 * @param {import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js").User | null} user
 * @returns {Promise<boolean>}
 */
export async function userExists(user) {
    if (!user || typeof user.uid !== "string" || user.uid.trim() === "") {
        throw new Error("L'usuari autenticat no és vàlid.");
    }

    const snap = await getDoc(getUserRef(user.uid));
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
    const newUser = buildNewUserData(user, extraData);

    if (await userExists(user)) {
        throw new Error("Aquest usuari ja existeix.");
    }

    if (await usernameExists(newUser.username)) {
        throw new Error("El nom d'usuari ja està en ús.");
    }

    if (await emailExists(newUser.email)) {
        throw new Error("El correu electrònic ja està en ús.");
    }

    await setDoc(getUserRef(user.uid), newUser);

    return newUser;
}

/**
 * Actualitza parcialment les dades d'un usuari existent.
 * No permet afegir camps inexistents.
 * Utilitza `setDoc` amb `merge`.
 *
 * @param {string} uid
 * @param {Partial<UserDocument>} data
 * @returns {Promise<void>}
 */
export async function updateUserData(uid, data) {
    const sanitizedData = sanitizeUserUpdateData(data);
    const currentUser = await getUserData(uid);

    if (!currentUser) {
        throw new Error("L'usuari no existeix.");
    }

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

    await setDoc(getUserRef(uid), sanitizedData, { merge: true });
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
    const currentUser = await getUserData(uid);

    if (!currentUser) {
        throw new Error("L'usuari no existeix.");
    }

    const sanitizedSettings = sanitizeUserSettings(settings);
    const mergedSettings = {
        ...getDefaultUserSettings(),
        ...currentUser.settings,
        ...sanitizedSettings
    };

    await setDoc(
        getUserRef(uid),
        { settings: mergedSettings },
        { merge: true }
    );

    return mergedSettings;
}