function parseValue(value) {
    const asNumber = Number(value);
    return Number.isNaN(asNumber) ? 0 : asNumber;
}

function normalizeStep(value, step) {
    // Mejor precisión decimal para evitar errores de punto flotante
    const decimals = step.toString().split('.')[1]?.length || 0;
    return Number((Math.round(value / step) * step).toFixed(decimals));
}

function clamp(n, min, max) {
    if (n < min) return min;
    if (n > max) return max;
    return n;
}

// Función para manejar controles numéricos
function setupNumberControls(inputId, upBtnId, downBtnId) {
    const input = document.getElementById(inputId);
    const btnUp = document.getElementById(upBtnId);
    const btnDown = document.getElementById(downBtnId);

    function updateValue(newValue) {
        const min = input.min === '' ? -Infinity : Number.parseFloat(input.min);
        const max = input.max === '' ? Infinity : Number.parseFloat(input.max);
        const step = Number.parseFloat(input.step) || 1;

        input.value = normalizeStep(clamp(newValue, min, max), step);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    btnUp.addEventListener('click', function () {
        const current = parseValue(input.value);
        const step = Number.parseFloat(input.step) || 1;
        updateValue(current + step);
    });

    btnDown.addEventListener('click', function () {
        const current = parseValue(input.value);
        const step = Number.parseFloat(input.step) || 1;
        updateValue(current - step);
    });
}

// Configurar controles para ambos campos
setupNumberControls('transport-km', 'transport-up', 'transport-down');
setupNumberControls('energy-consumption', 'energy-up', 'energy-down');

