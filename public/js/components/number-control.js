function parseValue(value) {
    const asNumber = Number(value);
    return Number.isNaN(asNumber) ? 0 : asNumber;
}

function getStepDecimals(step) {
    return step.toString().split('.')[1]?.length || 0;
}

function normalizeStep(value, step) {
    const decimals = getStepDecimals(step);
    return Number((Math.round(value / step) * step).toFixed(decimals));
}

function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function getNumericConfig(input) {
    return {
        min: input.min === '' ? -Infinity : Number.parseFloat(input.min),
        max: input.max === '' ? Infinity : Number.parseFloat(input.max),
        step: Number.parseFloat(input.step) || 1
    };
}

export function updateNumberInputValue(input, nextValue) {
    if (!input) return;

    const { min, max, step } = getNumericConfig(input);
    const normalizedValue = normalizeStep(clamp(nextValue, min, max), step);

    input.value = normalizedValue;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

function stepInput(input, direction) {
    const { step } = getNumericConfig(input);
    const current = parseValue(input.value);
    updateNumberInputValue(input, current + (step * direction));
}

function bindHoldBehavior(button, onStep) {
    if (!button) return;

    const INITIAL_DELAY = 400;
    const REPEAT_DELAY = 75;

    let holdTimeoutId = null;
    let holdIntervalId = null;
    let pointerActive = false;
    let suppressNextClick = false;

    const clearTimers = () => {
        if (holdTimeoutId) {
            clearTimeout(holdTimeoutId);
            holdTimeoutId = null;
        }

        if (holdIntervalId) {
            clearInterval(holdIntervalId);
            holdIntervalId = null;
        }
    };

    const stopHold = () => {
        pointerActive = false;
        clearTimers();
    };

    button.addEventListener('click', (event) => {
        if (suppressNextClick) {
            suppressNextClick = false;
            event.preventDefault();
            return;
        }

        if (event.detail === 0) {
            onStep();
        }
    });

    button.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;

        pointerActive = true;
        suppressNextClick = true;
        event.preventDefault();
        onStep();

        holdTimeoutId = globalThis.setTimeout(() => {
            holdIntervalId = globalThis.setInterval(onStep, REPEAT_DELAY);
        }, INITIAL_DELAY);
    });

    button.addEventListener('pointerup', stopHold);
    button.addEventListener('pointerleave', stopHold);
    button.addEventListener('pointercancel', stopHold);
    button.addEventListener('lostpointercapture', stopHold);

    button.addEventListener('keydown', (event) => {
        if (event.repeat && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            onStep();
        }
    });

    button.addEventListener('contextmenu', (event) => {
        if (pointerActive) {
            event.preventDefault();
        }
    });
}

export function setupNumberControl({ input, incrementButton, decrementButton }) {
    if (!input || !incrementButton || !decrementButton) return null;

    bindHoldBehavior(incrementButton, () => stepInput(input, 1));
    bindHoldBehavior(decrementButton, () => stepInput(input, -1));

    return {
        input,
        increment() {
            stepInput(input, 1);
        },
        decrement() {
            stepInput(input, -1);
        },
        setValue(nextValue) {
            updateNumberInputValue(input, nextValue);
        }
    };
}

export function setupNumberControlsInContainer(container = document) {
    const wrappers = container.querySelectorAll('[data-number-control]');

    return Array.from(wrappers)
        .map((wrapper) => setupNumberControl({
            input: wrapper.querySelector('[data-number-input]'),
            incrementButton: wrapper.querySelector('[data-number-increment]'),
            decrementButton: wrapper.querySelector('[data-number-decrement]')
        }))
        .filter(Boolean);
}
