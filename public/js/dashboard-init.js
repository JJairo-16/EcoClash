import { setupNumberControl } from './components/number-control.js';
import { auth } from './config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const CALCULATOR_FACTORS = {
    transportKgCo2PerKm: 0.21,
    energyKgCo2PerKwh: 0.23
};

const calculatorDom = {
    form: document.querySelector('.calculator-card .form-group'),
    transportInput: document.getElementById('transport-km'),
    energyInput: document.getElementById('energy-consumption'),
    resultContainer: document.getElementById('carbon-result'),
    resultValue: document.getElementById('carbon-value'),
    transportUp: document.getElementById('transport-up'),
    transportDown: document.getElementById('transport-down'),
    energyUp: document.getElementById('energy-up'),
    energyDown: document.getElementById('energy-down')
};

function setupCalculatorNumberControls() {
    setupNumberControl({
        input: calculatorDom.transportInput,
        incrementButton: calculatorDom.transportUp,
        decrementButton: calculatorDom.transportDown
    });

    setupNumberControl({
        input: calculatorDom.energyInput,
        incrementButton: calculatorDom.energyUp,
        decrementButton: calculatorDom.energyDown
    });
}

function calculateCarbonFootprint({ transportKm, energyConsumption }) {
    const transportEmissions = transportKm * CALCULATOR_FACTORS.transportKgCo2PerKm;
    const energyEmissions = energyConsumption * CALCULATOR_FACTORS.energyKgCo2PerKwh;
    return transportEmissions + energyEmissions;
}

function parseInputValue(input) {
    const parsedValue = Number.parseFloat(input?.value ?? '0');
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
}

function renderCarbonResult(value) {
    if (!calculatorDom.resultContainer || !calculatorDom.resultValue) return;

    calculatorDom.resultValue.textContent = value.toFixed(2);
    calculatorDom.resultContainer.style.display = 'block';
}

function bindCalculatorForm() {
    if (!calculatorDom.form) return;

    calculatorDom.form.addEventListener('submit', (event) => {
        event.preventDefault();

        const transportKm = parseInputValue(calculatorDom.transportInput);
        const energyConsumption = parseInputValue(calculatorDom.energyInput);

        const carbonFootprint = calculateCarbonFootprint({
            transportKm,
            energyConsumption
        });

        renderCarbonResult(carbonFootprint);
    });
}

setupCalculatorNumberControls();
bindCalculatorForm();

document.getElementById('log-out').addEventListener('click', async (event) => {
    await signOut(auth);
});