import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { auth } from './config.js';

import { redirect } from './components/redirector.js';

const home = document.getElementById('home-btn');

home.addEventListener('click', (event) => redirect('dashboard.html'));
document.getElementById('back-btn').addEventListener('click', (event) => history.back());


onAuthStateChanged(auth, async (user) => {
    if (user) {
        home.textContent = "Tornar al tauler";
    } else {
        home.textContent = "Anar a la pàgina de log in";
    }
});