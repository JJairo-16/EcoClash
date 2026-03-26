import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { auth } from '../config.js';

const SESSION_TIMEOUT = 60 * 1000;
const authorizedUsers = new Set([
  "216jjairo@gmail.com"
]);

function isAuthorized(user) {
  return user && authorizedUsers.has(user.email);
}

function saveSession(user, authorized) {
  localStorage.setItem("lastUser", JSON.stringify({
    uid: user.uid,
    email: user.email,
    authorized,
    timestamp: Date.now()
  }));
}

function getLastSession() {
  const data = localStorage.getItem("lastUser");
  return data ? JSON.parse(data) : null;
}

function go403() {
  globalThis.location.replace("/403.html");
}

onAuthStateChanged(auth, (user) => {
  const lastSession = getLastSession();

  if (user) {
    const authorized = isAuthorized(user);

    saveSession(user, authorized);

    if (!authorized) {
      return go403();
    }

    return;
  }

  if (!lastSession) {
    return go403();
  }

  const isExpired = (Date.now() - lastSession.timestamp) > SESSION_TIMEOUT;

  if (!lastSession.authorized) {
    return go403();
  }

  if (isExpired) {
    return go403();
  }
});