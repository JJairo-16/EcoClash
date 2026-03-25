import { auth } from './config.js';

const LOGIN = 'login.html';

function go(path) {
    const current = new URL(globalThis.location.href);
    const target = new URL(path, current.origin);

    if (current.href === target.href) return;

    globalThis.location.href = target.href;
}

export async function redirect(url = LOGIN) {
    if (auth.currentUser) {
        go(url);
    } else {
        go(LOGIN);
    }
}