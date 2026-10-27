
const expressionEl = document.getElementById("expression");
const previousEl = document.getElementById("previous");
const resultEl = document.getElementById("result");
const historyEl = document.getElementById("history");
const keysEl = document.getElementById("keys");

let expression = "";
let justCalculated = false;
let history = [];

function pretty(value) {
    return value
        .replace(/\*\*/g, "^")
        .replace(/\*/g, "×")
        .replace(/\//g, "÷")
        .replace(/-/g, "−")
        .replace(/sqrt\(/g, "√(");
}

function formatNumber(number) {
    if (!Number.isFinite(number)) {
        throw new Error("Invalid result");
    }

    if (Object.is(number, -0)) {
        number = 0;
    }

    return Number(number.toPrecision(12)).toString();
}

// Safe expression parser: evaluates only calculator operations.
function evaluateExpression(input) {
    if (!input.trim()) return 0;

    let source = input.replace(/\s+/g, "");

    if (!/^[0-9+\-*/().%a-z]+$/i.test(source)) {
        throw new Error("Invalid expression");
    }

    // Only the explicitly supported function is allowed.
    source = source.replace(/sqrt\(/g, "S(");

    if (/[a-z]/i.test(source.replace(/S/g, ""))) {
        throw new Error("Invalid expression");
    }

    let position = 0;

    function peek() {
        return source[position];
    }

    function consume(char) {
        if (peek() === char) {
            position++;
            return true;
        }
        return false;
    }

    function parseNumber() {
        const start = position;

        while (/[0-9.]/.test(peek() || "")) {
            position++;
        }

        const raw = source.slice(start, position);

        if (!raw || raw === "." || (raw.match(/\./g) || []).length > 1) {
            throw new Error("Invalid number");
        }

        const number = Number(raw);

        if (!Number.isFinite(number)) {
            throw new Error("Invalid number");
        }

        return number;
    }

    function primary() {
        if (consume("+")) return unary();
        if (consume("-")) return -unary();

        if (consume("(")) {
            const value = addSub();

            if (!consume(")")) {
                throw new Error("Missing closing bracket");
            }

            return value;
        }

        if (source.slice(position, position + 2) === "S(") {
            position += 2;

            const value = addSub();

            if (!consume(")")) {
                throw new Error("Missing closing bracket");
            }

            if (value < 0) {
                throw new Error("Square root needs a positive number");
            }

            return Math.sqrt(value);
        }

        return parseNumber();
    }

    function unary() {
        let value = primary();

        while (consume("%")) {
            value /= 100;
        }

        return value;
    }

    function power() {
        let base = unary();

        if (consume("*")) {
            if (!consume("*")) {
                throw new Error("Invalid operator");
            }

            const exponent = power();
            base = Math.pow(base, exponent);
        }

        return base;
    }

    function multiplyDivide() {
        let value = power();

        while (true) {
            if (consume("*")) {
                value *= power();
            } else if (consume("/")) {
                const divisor = power();

                if (divisor === 0) {
                    throw new Error("Cannot divide by zero");
                }

                value /= divisor;
            } else {
                break;
            }
        }

        return value;
    }

    function addSub() {
        let value = multiplyDivide();

        while (true) {
            if (consume("+")) {
                value += multiplyDivide();
            } else if (consume("-")) {
                value -= multiplyDivide();
            } else {
                break;
            }
        }

        return value;
    }

    const answer = addSub();

    if (position !== source.length) {
        throw new Error("Check your expression");
    }

    if (!Number.isFinite(answer)) {
        throw new Error("Invalid result");
    }

    return answer;
}

function render() {
    expressionEl.textContent = expression ? pretty(expression) : "0";

    if (!expression) {
        resultEl.textContent = "";
        return;
    }

    try {
        resultEl.textContent = "= " + formatNumber(
            evaluateExpression(expression)
        );
    } catch {
        resultEl.textContent = "";
    }
}

function addValue(value) {
    if (justCalculated && /[0-9.(]/.test(value)) {
        expression = "";
        previousEl.textContent = "New calculation";
    }

    justCalculated = false;

    if (value === ".") {
        const currentNumber = expression.split(/[+\-*/()%]/).pop();

        if (currentNumber.includes(".")) return;

        if (!currentNumber) {
            value = "0.";
        }
    }

    if (/^[+\-*/]$/.test(value) && /[+\-*/]$/.test(expression)) {
        expression = expression.slice(0, -1);
    }

    expression += value;
    render();
}

function calculate() {
    try {
        const answer = evaluateExpression(expression);
        const shownExpression = pretty(expression);
        const output = formatNumber(answer);

        previousEl.textContent = shownExpression + " =";
        expression = output;
        resultEl.textContent = output;
        justCalculated = true;

        history.unshift({
            expr: shownExpression,
            result: output
        });

        history = history.slice(0, 8);

        renderHistory();

        expressionEl.textContent = output;
        resultEl.textContent = "Calculation complete";
    } catch (error) {
        resultEl.textContent = error.message || "Invalid expression";
    }
}

function renderHistory() {
    historyEl.innerHTML = "";

    if (history.length === 0) {
        const row = document.createElement("div");
        row.className = "history-item";

        const label = document.createElement("span");
        label.textContent = "Your history will appear here";

        const dash = document.createElement("span");
        dash.textContent = "—";

        row.append(label, dash);
        historyEl.appendChild(row);
        return;
    }

    history.forEach(item => {
        const row = document.createElement("div");
        row.className = "history-item";

        const left = document.createElement("span");
        left.textContent = item.expr;

        const right = document.createElement("span");
        right.textContent = "= " + item.result;

        row.append(left, right);

        row.addEventListener("click", () => {
            expression = item.result;
            previousEl.textContent = item.expr + " =";
            justCalculated = true;
            render();
        });

        historyEl.appendChild(row);
    });
}

function handleAction(action) {
    if (action === "clear") {
        expression = "";
        previousEl.textContent = "Your calculation";
        resultEl.textContent = "";
        justCalculated = false;
        render();
    }

    if (action === "delete") {
        expression = expression.slice(0, -1);
        justCalculated = false;
        render();
    }

    if (action === "equals") {
        calculate();
    }

    if (action === "sign") {
        if (!expression) {
            expression = "-";
        } else {
            try {
                expression = formatNumber(
                    -evaluateExpression(expression)
                );
            } catch {
                expression = "-(" + expression + ")";
            }
        }

        justCalculated = false;
        render();
    }
}

keysEl.addEventListener("click", event => {
    const button = event.target.closest("button");

    if (!button) return;

    if (button.dataset.action) {
        handleAction(button.dataset.action);
    } else {
        addValue(button.dataset.value);
    }
});

document.getElementById("clearHistory").addEventListener("click", () => {
    history = [];
    renderHistory();
});

document.addEventListener("keydown", event => {
    if (/^[0-9().%+\-*/]$/.test(event.key)) {
        event.preventDefault();
        addValue(event.key);
    } else if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        calculate();
    } else if (event.key === "Backspace") {
        event.preventDefault();
        handleAction("delete");
    } else if (event.key === "Escape") {
        handleAction("clear");
    }
});

render();