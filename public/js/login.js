import { auth } from "./config.js";
import { addNewUser, userExists } from "./lib/user-data-lib.js";
import { validateEmail, validateBirthDate } from "./lib/user-validators.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

/* =========================
   MENSAJES
========================= */
function msg(id, text, ok) {
  const el = document.getElementById(id);
  if (!el) return;

  el.innerHTML = `
    <p class="form-message ${ok ? "msg-ok" : "msg-error"}">
      ${text}
    </p>
  `;
}

function clearMsg(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = "";
}

/* =========================
   PASSWORD
========================= */
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

function validarPassword(pass) {
  return passwordRegex.test(pass);
}

/* =========================
   HELPERS DE CLASES
========================= */
function addClass(el, className) {
  if (el) el.classList.add(className);
}

function removeClass(el, className) {
  if (el) el.classList.remove(className);
}

function clearValidationClasses(fields) {
  fields.forEach((field) => {
    if (!field) return;
    removeClass(field, "field-required");
    removeClass(field, "incorrect-field");
    removeClass(field, "bad-password");
    removeClass(field, "no-copy-password");
  });
}

function isEmpty(value) {
  return !value || value.trim() === "";
}

function markRequired(field) {
  addClass(field, "field-required");
  removeClass(field, "incorrect-field");
}

function markIncorrect(field) {
  addClass(field, "incorrect-field");
  removeClass(field, "field-required");
}

function parseBirthFromFlatpickr(value) {
  if (isEmpty(value)) return null;

  const parts = value.split("/");
  if (parts.length !== 3) return null;

  const [day, month, year] = parts.map(Number);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getDate() !== day ||
    date.getMonth() !== month - 1 ||
    date.getFullYear() !== year
  ) {
    return null;
  }

  return date;
}

/* =========================
   REFERENCIAS LOGIN
========================= */
const loginForm = document.getElementById("login-form");
const loginUser = document.getElementById("login-user");
const loginPass = document.getElementById("login-pass");

/* =========================
   REFERENCIAS REGISTER
========================= */
const registerForm = document.getElementById("register-form");
const regUsername = document.getElementById("reg-username");
const regName = document.getElementById("reg-name");
const regSurname = document.getElementById("reg-surname");
const regLastname = document.getElementById("reg-lastname");
const regPhone = document.getElementById("reg-phone");
const regBirth = document.getElementById("reg-birth");
const regEmail = document.getElementById("reg-email");
const regPass = document.getElementById("reg-pass");
const regPass2 = document.getElementById("reg-pass2");

const loginFields = [loginUser, loginPass];
const registerFields = [
  regUsername,
  regName,
  regSurname,
  regLastname,
  regPhone,
  regBirth,
  regEmail,
  regPass,
  regPass2
];

/* =========================
   FLATPICKR
========================= */
flatpickr("#reg-birth", {
  dateFormat: "d/m/Y",
  maxDate: "today",
  disableMobile: true,
  allowInput: false,
  clickOpens: true,
  monthSelectorType: "static"
});

/* =========================
   LIMPIEZA EN TIEMPO REAL
========================= */
[
  loginUser,
  loginPass,
  regUsername,
  regName,
  regSurname,
  regLastname,
  regPhone,
  regBirth,
  regEmail
].forEach((field) => {
  if (!field) return;

  field.addEventListener("input", () => {
    removeClass(field, "field-required");
    removeClass(field, "incorrect-field");
  });

  field.addEventListener("change", () => {
    removeClass(field, "field-required");
    removeClass(field, "incorrect-field");
  });
});

/* =========================
   PASSWORD FEEDBACK
========================= */
function updatePasswordClasses() {
  removeClass(regPass, "bad-password");
  removeClass(regPass, "no-copy-password");
  removeClass(regPass2, "no-copy-password");

  const pass = regPass.value;
  const pass2 = regPass2.value;

  if (pass !== "" && !validarPassword(pass)) {
    addClass(regPass, "bad-password");
  }

  if (pass !== "" && pass2 !== "" && pass !== pass2) {
    addClass(regPass, "no-copy-password");
    addClass(regPass2, "no-copy-password");
  }
}

regPass.addEventListener("input", (e) => {
  const pass = e.target.value;

  if (pass === "") {
    clearMsg("reg-msg");
    removeClass(regPass, "bad-password");
    removeClass(regPass, "no-copy-password");
    removeClass(regPass2, "no-copy-password");
    return;
  }

  if (validarPassword(pass)) {
    msg("reg-msg", "Contrasenya segura ✔", true);
  } else {
    msg(
      "reg-msg",
      "La contrasenya ha de tenir 8 caràcters, majúscula, minúscula, número i símbol.",
      false
    );
  }

  updatePasswordClasses();
});

regPass2.addEventListener("input", () => {
  updatePasswordClasses();

  if (regPass.value !== "" && regPass2.value !== "") {
    if (regPass.value === regPass2.value && validarPassword(regPass.value)) {
      msg("reg-msg", "Les contrasenyes coincideixen ✔", true);
    } else if (regPass.value !== regPass2.value) {
      msg("reg-msg", "Les contrasenyes no coincideixen.", false);
    }
  }
});

regPass.addEventListener("change", updatePasswordClasses);
regPass2.addEventListener("change", updatePasswordClasses);

/* =========================
   REGISTER
========================= */
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  clearValidationClasses(registerFields);

  const username = regUsername.value.trim();
  const name = regName.value.trim();
  const surname = regSurname.value.trim();
  const lastname = regLastname.value.trim();
  const phone = regPhone.value.trim();
  const birthRaw = regBirth.value.trim();
  const emailRaw = regEmail.value.trim();
  const pass = regPass.value;
  const pass2 = regPass2.value;

  let hasErrors = false;

  if (isEmpty(username)) {
    markRequired(regUsername);
    hasErrors = true;
  }
  if (isEmpty(name)) {
    markRequired(regName);
    hasErrors = true;
  }
  if (isEmpty(surname)) {
    markRequired(regSurname);
    hasErrors = true;
  }
  if (isEmpty(birthRaw)) {
    markRequired(regBirth);
    hasErrors = true;
  }
  if (isEmpty(emailRaw)) {
    markRequired(regEmail);
    hasErrors = true;
  }
  if (isEmpty(pass)) {
    markRequired(regPass);
    hasErrors = true;
  }
  if (isEmpty(pass2)) {
    markRequired(regPass2);
    hasErrors = true;
  }

  if (!isEmpty(emailRaw)) {
    try {
      validateEmail(emailRaw);
    } catch {
      markIncorrect(regEmail);
      hasErrors = true;
    }
  }

  let birthDate = null;
  if (!isEmpty(birthRaw)) {
    birthDate = parseBirthFromFlatpickr(birthRaw);

    try {
      if (!birthDate) throw new Error("Invalid date");
      validateBirthDate(birthDate);
    } catch {
      markIncorrect(regBirth);
      hasErrors = true;
    }
  }

  if (!isEmpty(pass) && !validarPassword(pass)) {
    addClass(regPass, "bad-password");
    hasErrors = true;
  }

  if (!isEmpty(pass) && !isEmpty(pass2) && pass !== pass2) {
    addClass(regPass, "no-copy-password");
    addClass(regPass2, "no-copy-password");
    hasErrors = true;
  }

  if (hasErrors) {
    msg("reg-msg", "Revisa els camps marcats.", false);
    return;
  }

  try {
    const email = validateEmail(emailRaw);

    const credential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = credential.user;

    await addNewUser(user, {
      username,
      name,
      surname,
      lastname,
      phoneNum: phone,
      birthDate
    });

    msg("reg-msg", "Registrat correctament! Redirigint...", true);
    globalThis.location.href = "dashboard.html";
  } catch (error) {
    console.error("Error al registrar:", error);
    msg("reg-msg", error.message || "No s'ha pogut completar el registre.", false);
  }
});

/* =========================
   LOGIN
========================= */
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  clearValidationClasses(loginFields);

  const userInput = loginUser.value.trim();
  const pass = loginPass.value;

  let hasErrors = false;

  if (isEmpty(userInput)) {
    markRequired(loginUser);
    hasErrors = true;
  }

  if (isEmpty(pass)) {
    markRequired(loginPass);
    hasErrors = true;
  }

  if (!isEmpty(userInput)) {
    try {
      validateEmail(userInput);
    } catch {
      markIncorrect(loginUser);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    msg("login-msg", "Revisa els camps marcats.", false);
    return;
  }

  try {
    const email = validateEmail(userInput);
    const credential = await signInWithEmailAndPassword(auth, email, pass);
    const user = credential.user;

    const exists = await userExists(user);
    if (!exists) {
      throw new Error("L'usuari s'ha autenticat però no té els documents creats a Firestore.");
    }

    msg("login-msg", "Inici de sessió correcte! Redirigint...", true);
    globalThis.location.href = "dashboard.html";
  } catch (error) {
    console.error("Error al iniciar sessió:", error);
    msg("login-msg", error.message || "Credencials incorrectes.", false);
  }
});