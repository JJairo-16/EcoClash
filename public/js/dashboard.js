import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import { auth } from "./config.js";
import { redirect } from "./components/redirector.js";

import { getUserData } from "./lib/user-data-lib.js";
import { updateDailyMissionsIfNeeded } from "./lib/random-quest-selector.js";
import {
    getUserDailyMissions,
    startUserMission,
    addProgressToUserMission
} from "./lib/mission-progress-lib.js";
import { setupNumberControlsInContainer } from "./components/number-control.js";

const MISSION_STATES = {
    NOT_STARTED: "per_iniciar",
    IN_PROGRESS: "en_progres",
    COMPLETED: "completada"
};

const dom = {
    levelLabel: document.getElementById("level-label"),
    levelBar: document.getElementById("level-bar"),
    progressCard: document.querySelector(".progress-card"),
    questsContainer: document.querySelector(".quests")
};

let savedUid = null;
let missionEventsBound = false;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        redirect();
        return;
    }

    try {
        savedUid = user.uid;

        const userData = await getUserData(savedUid);

        if (!userData) {
            redirect();
            return;
        }

        updateExperienceUI(userData);
        await updateDailyMissionsIfNeeded(savedUid);
        await buildQuests();
    } catch (error) {
        console.error("Error en carregar les dades de l'usuari:", error);
    }
});

async function buildQuests() {
    if (!dom.questsContainer || !savedUid) return;

    try {
        const missions = await getUserDailyMissions(savedUid);

        if (!Array.isArray(missions) || missions.length === 0) {
            dom.questsContainer.innerHTML = `
                <h2 class="section-title">Repte diari actiu</h2>
                <p>No hi ha missions disponibles</p>
            `;
            return;
        }

        const cardConfigs = missions.map((mission) => mapMissionToCardConfig(mission));

        const questsHtml = cardConfigs
            .filter(Boolean)
            .map((config) => createActiveQuestCard(config))
            .join("");

        dom.questsContainer.innerHTML = `
            <h2 class="section-title">Repte diari actiu</h2>
            ${questsHtml || "<p>No hi ha missions disponibles</p>"}
        `;

        setupNumberControlsInContainer(dom.questsContainer);
        bindMissionEvents();
    } catch (error) {
        console.error("Error en carregar les missions:", error);
        dom.questsContainer.innerHTML = `
            <h2 class="section-title">Repte diari actiu</h2>
            <p>No s'han pogut carregar les missions</p>
        `;
    }
}

function mapMissionToCardConfig(mission) {
    if (!mission) return null;

    const total = Number(mission.amountTarget) || 1;
    const current = Number(mission.currentProgress) || 0;

    const percentage = clamp(
        Math.round((current / total) * 100),
        0,
        100
    );

    let state = MISSION_STATES.NOT_STARTED;

    if (mission.completed) {
        state = MISSION_STATES.COMPLETED;
    } else if (mission.active) {
        state = MISSION_STATES.IN_PROGRESS;
    }

    return {
        missionId: mission.missionId || "",
        state,
        percentage,
        current,
        total,
        unit: mission.unity || "",
        name: mission.title || "Missió",
        description: mission.description || "",
        allowDecimals: Boolean(mission.allowDecimals)
    };
}

function updateExperienceUI(userData) {
    const level = Number(userData.level) || 1;
    const experience = Number(userData.experience) || 0;
    const maxExperience = Number(userData.maxExperience) || 1;

    const percentage = clamp(
        Math.round((experience / maxExperience) * 100),
        0,
        100
    );

    const remainingPoints = Math.max(0, maxExperience - experience);

    const progressFill = dom.progressCard?.querySelector(".progress-fill");
    const progressText = dom.progressCard?.querySelector(".progress-text");

    if (dom.levelLabel) {
        dom.levelLabel.textContent = `Nivell ${level}`;
    }

    if (dom.levelBar) {
        dom.levelBar.textContent = `${percentage}%`;
    }

    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }

    if (progressText) {
        progressText.textContent = `Pròxim nivell en ${remainingPoints} punts`;
    }
}

function createActiveQuestCard({
    missionId = "",
    state = MISSION_STATES.NOT_STARTED,
    percentage = 0,
    current = 0,
    total = 0,
    unit = "",
    name = "",
    description = "",
    allowDecimals = false
} = {}) {
    const safePercentage = clamp(Number(percentage) || 0, 0, 100);
    const safeCurrent = Number(current) || 0;
    const safeTotal = Number(total) || 0;
    const safeUnit = escapeHtml(unit);
    const safeName = escapeHtml(name);
    const safeDescription = escapeHtml(description);
    const safeMissionId = escapeHtml(missionId);

    const badgeHtml = getBadge(state);

    const progressHtml = `
        <div class="progress-bar mt-3">
            <div class="progress-fill" style="width: ${safePercentage}%;"></div>
        </div>
        <p class="progress-text">
            ${safePercentage}% completat (${safeCurrent} de ${safeTotal} ${safeUnit})
        </p>
    `;

    const actionsHtml = getMissionActionsHtml(
        state,
        safeUnit,
        allowDecimals,
        safeCurrent,
        safeTotal
    );

    return `
    <section class="dashboard-section">
        <div 
            class="challenge-card card"
            data-mission-id="${safeMissionId}"
            data-mission-state="${state}"
            data-allow-decimals="${allowDecimals}"
            data-unit="${safeUnit}"
            data-current="${safeCurrent}"
            data-total="${safeTotal}"
        >
            <div class="challenge-header">
                <h3 class="challenge-title">${safeName}</h3>
                ${badgeHtml}
            </div>

            <p class="challenge-description">${safeDescription}</p>

            ${progressHtml}

            ${actionsHtml}
        </div>
    </section>
`;
}

function getBadge(state) {
    if (state === MISSION_STATES.IN_PROGRESS)
        return `<span class="badge badge-active">Actiu</span>`;

    if (state === MISSION_STATES.COMPLETED)
        return `<span class="badge badge-active">Completat</span>`;

    return "";
}

function getMissionInputConfig(allowDecimals) {
    return allowDecimals
        ? { min: "0.01", step: "0.01" }
        : { min: "1", step: "1" };
}

function getMissionActionsHtml(
    state,
    unit,
    allowDecimals = false,
    current = 0,
    total = 0
) {
    if (state === MISSION_STATES.NOT_STARTED) {
        return `
            <div class="challenge-actions">
                <button
                    class="btn btn-primary js-start-mission-btn"
                    type="button"
                >
                    Iniciar missió
                </button>
            </div>
        `;
    }

    if (state === MISSION_STATES.IN_PROGRESS) {
        const { min, step } = getMissionInputConfig(allowDecimals);
        const remaining = Math.max(0, Number(total) - Number(current));
        const max = allowDecimals
            ? remaining.toFixed(2)
            : String(Math.floor(remaining));

        return `
            <div class="challenge-actions">
                <div class="number-control-wrapper" data-number-control>
                    <input
                        type="number"
                        class="form-input number-input js-mission-progress-input"
                        data-number-input
                        placeholder="Introdueix ${unit || "valor"}"
                        min="${min}"
                        max="${max}"
                        step="${step}"
                    >
                    <div class="number-badges">
                        <button
                            class="btn btn-secondary number-btn js-mission-progress-up"
                            data-number-increment
                            type="button"
                            aria-label="Augmentar valor"
                        >▲</button>
                        <button
                            class="btn btn-secondary number-btn js-mission-progress-down"
                            data-number-decrement
                            type="button"
                            aria-label="Disminuir valor"
                        >▼</button>
                    </div>
                </div>
                <button
                    class="btn btn-primary js-register-action-btn"
                    type="button"
                >
                    Registrar Acció
                </button>
            </div>
        `;
    }

    if (state === MISSION_STATES.COMPLETED) {
        return "";
    }

    return "";
}

function bindMissionEvents() {
    if (!dom.questsContainer || missionEventsBound) return;

    dom.questsContainer.addEventListener("click", async (event) => {
        const startBtn = event.target.closest(".js-start-mission-btn");
        if (startBtn) {
            const card = startBtn.closest(".challenge-card");
            await handleStartMission(card);
            return;
        }

        const registerBtn = event.target.closest(".js-register-action-btn");
        if (registerBtn) {
            const card = registerBtn.closest(".challenge-card");
            handleRegisterMissionAction(card);
        }
    });

    missionEventsBound = true;
}

async function handleStartMission(card) {
    if (!card) return;

    const missionId = card.dataset.missionId;
    const allowDecimals = card.dataset.allowDecimals === "true";
    const unit = card.dataset.unit || "";
    const current = Number(card.dataset.current) || 0;
    const total = Number(card.dataset.total) || 0;

    card.dataset.missionState = MISSION_STATES.IN_PROGRESS;

    const header = card.querySelector(".challenge-header");
    if (!header.querySelector(".badge-active")) {
        header.insertAdjacentHTML(
            "beforeend",
            `<span class="badge badge-active">Actiu</span>`
        );
    }

    const actions = card.querySelector(".challenge-actions");
    if (actions) {
        actions.outerHTML = getMissionActionsHtml(
            MISSION_STATES.IN_PROGRESS,
            unit,
            allowDecimals,
            current,
            total
        );
        setupNumberControlsInContainer(card);
    }

    await startUserMission(savedUid, missionId);
}

async function handleRegisterMissionAction(card) {
    if (!card || !savedUid) return;

    const missionId = card.dataset.missionId;
    const input = card.querySelector(".js-mission-progress-input");
    const rawValue = input?.value?.trim() ?? "";

    const current = Number(card.dataset.current) || 0;
    const total = Number(card.dataset.total) || 0;
    const remaining = Math.max(0, total - current);

    if (!missionId) {
        console.error("No s'ha trobat el missionId de la targeta.");
        return;
    }

    if (remaining <= 0) {
        console.warn("La missió ja està completada.");
        return;
    }

    const enteredAmount = Number(rawValue);

    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
        console.warn("La quantitat introduïda no és vàlida.");
        input?.focus();
        return;
    }

    const allowDecimals = card.dataset.allowDecimals === "true";
    let amountToSubmit = Math.min(enteredAmount, remaining);

    if (!allowDecimals) {
        amountToSubmit = Math.floor(amountToSubmit);
    }

    if (!Number.isFinite(amountToSubmit) || amountToSubmit <= 0) {
        console.warn("La quantitat ajustada no és vàlida.");
        input?.focus();
        return;
    }

    try {
        if (input && amountToSubmit !== enteredAmount) {
            input.value = String(amountToSubmit);
        }

        const updatedMission = await addProgressToUserMission(
            savedUid,
            missionId,
            amountToSubmit
        );

        updateMissionCardProgress(card, {
            current: updatedMission.currentProgress,
            total: updatedMission.amountTarget,
            unit: card.dataset.unit || "",
            allowDecimals: updatedMission.allowDecimals === true
        });

        const updatedUserData = await getUserData(savedUid);

        if (updatedUserData) {
            updateExperienceUI(updatedUserData);
        }

        if (input) {
            input.value = "";
        }

        console.log("Progrés registrat correctament:", updatedMission);
    } catch (error) {
        console.error("Error registrant el progrés de la missió:", error);
    }
}

function updateMissionCardProgress(card, {
    current = 0,
    total = 1,
    unit = "",
    allowDecimals = false
} = {}) {
    if (!card) return;

    const safeCurrent = Math.max(0, Number(current) || 0);
    const safeTotal = Math.max(1, Number(total) || 1);
    const safePercentage = clamp(
        Math.round((safeCurrent / safeTotal) * 100),
        0,
        100
    );

    const remaining = Math.max(0, safeTotal - safeCurrent);
    const isCompleted = safeCurrent >= safeTotal;
    const nextState = isCompleted
        ? MISSION_STATES.COMPLETED
        : MISSION_STATES.IN_PROGRESS;

    card.dataset.current = String(safeCurrent);
    card.dataset.total = String(safeTotal);
    card.dataset.unit = unit;
    card.dataset.allowDecimals = String(allowDecimals);
    card.dataset.missionState = nextState;

    const progressFill = card.querySelector(".progress-fill");
    const progressText = card.querySelector(".progress-text");
    const header = card.querySelector(".challenge-header");
    let actions = card.querySelector(".challenge-actions");
    let input = card.querySelector(".js-mission-progress-input");

    if (progressFill) {
        progressFill.style.width = `${safePercentage}%`;
    }

    if (progressText) {
        progressText.textContent = `${safePercentage}% completat (${safeCurrent} de ${safeTotal} ${unit})`;
    }

    const existingBadge = header?.querySelector(".badge");

    if (isCompleted) {
        if (existingBadge) {
            existingBadge.remove();
        }

        if (actions) {
            actions.remove();
        }

        return;
    }

    if (header && !header.querySelector(".badge-active")) {
        header.insertAdjacentHTML(
            "beforeend",
            `<span class="badge badge-active">Actiu</span>`
        );
    }

    if (!actions) {
        card.insertAdjacentHTML(
            "beforeend",
            getMissionActionsHtml(
                MISSION_STATES.IN_PROGRESS,
                unit,
                allowDecimals,
                safeCurrent,
                safeTotal
            )
        );
        setupNumberControlsInContainer(card);

        input = card.querySelector(".js-mission-progress-input");
    }

    if (input) {
        const { min, step } = getMissionInputConfig(allowDecimals);

        input.min = min;
        input.step = step;
        input.max = allowDecimals
            ? String(remaining)
            : String(Math.floor(remaining));

        const currentValue = Number(input.value);
        if (Number.isFinite(currentValue) && currentValue > remaining) {
            input.value = remaining > 0 ? String(remaining) : "";
        }
    }
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
