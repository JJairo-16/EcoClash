const KEY_USERS = "users";

function getUsers() {
    return JSON.parse(localStorage.getItem(KEY_USERS) || "[]");
}

function saveUsers(users) {
    localStorage.setItem(KEY_USERS, JSON.stringify(users));
}

function msg(id, text, ok) {
    document.getElementById(id).innerHTML =
        `<p style="color:${ok ? 'green' : 'red'}">${text}</p>`;
}

/* 🔐 REGEX CONTRASEÑA */
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

function validarPassword(pass) {
    return passwordRegex.test(pass);
}

/* REGISTER */
document.getElementById("register-form").onsubmit = e => {
    e.preventDefault();

    const username = document.getElementById("reg-username").value.trim();
    const name = document.getElementById("reg-name").value.trim();
    const surname = document.getElementById("reg-surname").value.trim();
    const lastname = document.getElementById("reg-lastname").value.trim();
    const phone = document.getElementById("reg-phone").value.trim();
    const birth = document.getElementById("reg-birth").value;
    const email = document.getElementById("reg-email").value.trim();
    const pass = document.getElementById("reg-pass").value;
    const pass2 = document.getElementById("reg-pass2").value;

    if (!username || !name || !surname || !birth || !email || !pass) {
        msg("reg-msg", "Omple els camps obligatoris", false);
        return;
    }

    if (pass !== pass2) {
        msg("reg-msg", "Les contrasenyes no coincideixen", false);
        return;
    }

    if (!validarPassword(pass)) {
        msg("reg-msg",
            "La contrasenya ha de tenir mínim 8 caràcters, una majúscula, una minúscula, un número i un símbol",
            false
        );
        return;
    }

    const users = getUsers();

    if (users.some(u => u.username === username)) {
        msg("reg-msg", "Aquest usuari ja existeix", false);
        return;
    }

    users.push({
        username,
        name,
        surname,
        lastname,
        phone,
        birth,
        email,
        password: pass
    });

    saveUsers(users);

    msg("reg-msg", "Registrat correctament!", true);
};

/* FEEDBACK EN TIEMPO REAL */
document.getElementById("reg-pass").addEventListener("input", e => {
    const pass = e.target.value;

    if (pass === "") {
        document.getElementById("reg-msg").innerHTML = "";
        return;
    }

    if (validarPassword(pass)) {
        msg("reg-msg", "Contrasenya segura ✔", true);
    } else {
        msg("reg-msg", "Contrasenya massa feble ❌", false);
    }
});

/* LOGIN */
document.getElementById("login-form").onsubmit = e => {
    e.preventDefault();

    const user = document.getElementById("login-user").value.trim();
    const pass = document.getElementById("login-pass").value;

    const users = getUsers();

    const found = users.find(u =>
        (u.username === user || u.email === user) &&
        u.password === pass
    );

    if (!found) {
        msg("login-msg", "Credencials incorrectes", false);
        return;
    }

    globalThis.location.href = "dashboard.html";
};