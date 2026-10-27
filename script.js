
const expressionEl = document.getElementById("expression");
const previousEl = document.getElementById("previous");
const resultEl = document.getElementById("result");
const keysEl = document.getElementById("keys");
const historyEl = document.getElementById("history");

let expression = "";
let justCalculated = false;
let history = [];

const isDigit = char => char >= "0" && char <= "9";

function pretty(value) {
    return value
        .replace(/sqrt\(/g, "√(")
        .replace(/\*\*/g, "^")
        .replace(/\*/g, "×")
        .replace(/\//g, "÷")
        .replace(/-/g, "−");
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

// Safe mathematical parser. It does not execute arbitrary JavaScript.
function evaluate(input) {
    const source = input.replace(/\s+/g, "");

    if (!source) return 0;

    let position = 0;

    function peek() {
        return source[position] || "";
    }

    function consume(char) {
        if (peek() === char) {
            position++;
            return true;
        }
        return false;
    }

    function expect(char, message) {
        if (!consume(char)) {
            throw new Error(message);
        }
    }

    function parseNumber() {
        const start = position;
        let decimalSeen = false;

        while (position < source.length) {
            const char = peek();

            if (isDigit(char)) {
                position++;
            } else if (char === "." && !decimalSeen) {
                decimalSeen = true;
                position++;
            } else {
                break;
            }
        }

        const token = source.slice(start, position);

        if (!token || token === ".") {
            throw new Error("Enter a valid number");
        }

        const number = Number(token);

        if (!Number.isFinite(number)) {
            throw new Error("Invalid number");
        }

        return number;
    }

    function parsePrimary() {
        if (consume("(")) {
            const value = parseExpression();

            expect(")", "Missing closing bracket");

            return value;
        }

        if (source.slice(position, position + 5) === "sqrt(") {
            position += 5;

            const value = parseExpression();

            expect(")", "Missing closing bracket");

            if (value < 0) {
                throw new Error("Square root of a negative number is not real");
            }

            return Math.sqrt(value);
        }

        return parseNumber();
    }

    function parsePostfix() {
        let value = parsePrimary();

        while (consume("%")) {
            value /= 100;
        }

        return value;
    }

    function parsePower() {
        const base = parsePostfix();

        if (source.slice(position, position + 2) === "**") {
            position += 2;

            const exponent = parseUnary();
            const result = Math.pow(base, exponent);

            if (!Number.isFinite(result)) {
                throw new Error("Result is outside the supported range");
            }

            return result;
        }

        return base;
    }

    function parseUnary() {
        if (consume("+")) return parseUnary();
        if (consume("-")) return -parseUnary();

        return parsePower();
    }

    function parseMultiplication() {
        let value = parseUnary();

        while (true) {
            if (consume("*")) {
                value *= parseUnary();
            } else if (consume("/")) {
                const divisor = parseUnary();

                if (divisor === 0) {
                    throw new Error("Cannot divide by zero");
                }

                value /= divisor;
            } else {
                break;
            }

            if (!Number.isFinite(value)) {
                throw new Error("Result is outside the supported range");
            }
        }

        return value;
    }

    function parseExpression() {
        let value = parseMultiplication();

        while (true) {
            if (consume("+")) {
                value += parseMultiplication();
            } else if (consume("-")) {
                value -= parseMultiplication();
            } else {
                break;
            }

            if (!Number.isFinite(value)) {
                throw new Error("Result is outside the supported range");
            }
        }

        return value;
    }

    if (!/^[0-9.+\-*/()%a-z]*$/i.test(source)) {
        throw new Error("Invalid character");
    }

    const answer = parseExpression();

    if (position !== source.length) {
        throw new Error("Check the expression");
    }

    if (!Number.isFinite(answer)) {
        throw new Error("Invalid result");
    }

    return answer;
}

function render() {
    expressionEl.textContent = expression
        ? pretty(expression)
        : "0";

    expressionEl.scrollLeft = expressionEl.scrollWidth;

    resultEl.classList.remove("error");

    if (!expression) {
        resultEl.textContent = "";
        return;
    }

    try {
        resultEl.textContent =
            "= " + formatNumber(evaluate(expression));
    } catch {
        resultEl.textContent = "";
    }
}

function addValue(value) {
    if (justCalculated) {
        if (
            isDigit(value) ||
            value === "." ||
            value === "(" ||
            value === "sqrt("
        ) {
            expression = "";
            previousEl.textContent = "New calculation";
        }

        justCalculated = false;
    }

    if (value === ".") {
        const currentNumber = expression.split(/[+\-*/()%]/).pop();

        if (currentNumber.includes(".")) {
            return;
        }

        if (
            !currentNumber ||
            /[+\-*/(]$/.test(expression)
        ) {
            value = "0.";
        }
    }

    if (
        /^[+\-*/]$/.test(value) &&
        /[+\-*/]$/.test(expression)
    ) {
        expression = expression.slice(0, -1);
    }

    expression += value;

    render();
}

function calculate() {
    try {
        const shownExpression = pretty(expression);
        const answer = formatNumber(evaluate(expression));

        previousEl.textContent = shownExpression + " =";

        expression = answer;
        justCalculated = true;

        resultEl.classList.remove("error");
        resultEl.textContent = "Calculation complete";

        history.unshift({
            expr: shownExpression,
            result: answer
        });

        history = history.slice(0, 10);

        renderHistory();

        expressionEl.textContent = answer;
    } catch (error) {
        resultEl.textContent =
            error.message || "Invalid expression";

        resultEl.classList.add("error");
    }
}

function toggleSign() {
    if (!expression) {
        expression = "-";
    } else if (/^-?\d*\.?\d+$/.test(expression)) {
        expression = formatNumber(-Number(expression));
    } else {
        expression = "-(" + expression + ")";
    }

    justCalculated = false;

    render();
}

function applyAction(action) {
    if (action === "clear") {
        expression = "";
        previousEl.textContent = "Your calculation";
        justCalculated = false;

        resultEl.classList.remove("error");

        render();
        return;
    }

    if (action === "delete") {
        if (justCalculated) {
            expression = "";
            justCalculated = false;
        } else if (expression.endsWith("sqrt(")) {
            expression = expression.slice(0, -5);
        } else if (expression.endsWith("**")) {
            expression = expression.slice(0, -2);
        } else {
            expression = expression.slice(0, -1);
        }

        render();
        return;
    }

    if (action === "equals") {
        calculate();
        return;
    }

    if (action === "decimal") {
        addValue(".");
        return;
    }

    if (action === "sign") {
        toggleSign();
        return;
    }

    if (action === "percent") {
        const match = expression.match(/(\d*\.?\d+)$/);

        if (match && !expression.endsWith("%")) {
            expression =
                expression.slice(0, match.index) +
                match[0] +
                "%";
        } else if (expression.endsWith(")")) {
            expression += "%";
        }

        justCalculated = false;
        render();
        return;
    }

    if (action === "power") {
        expression += "**";
        justCalculated = false;
        render();
        return;
    }

    if (action === "sqrt") {
        expression = "sqrt(" + expression + ")";
        justCalculated = false;
        render();
    }
}

function renderHistory() {
    historyEl.replaceChildren();

    if (history.length === 0) {
        const empty = document.createElement("div");

        empty.className = "empty-history";
        empty.textContent = "Your history will appear here";

        historyEl.appendChild(empty);
        return;
    }

    history.forEach(item => {
        const row = document.createElement("div");
        row.className = "history-item";

        const left = document.createElement("span");
        const right = document.createElement("span");

        left.textContent = item.expr;
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

keysEl.addEventListener("click", event => {
    const button = event.target.closest("button");

    if (!button) return;

    if (button.dataset.action) {
        applyAction(button.dataset.action);
    } else {
        addValue(button.dataset.value);
    }
});

document.getElementById("clearHistory").addEventListener("click", () => {
    history = [];
    renderHistory();
});

document.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
    }

    if (/^[0-9()+\-*/%]$/.test(event.key)) {
        event.preventDefault();
        addValue(event.key);
    } else if (event.key === ".") {
        event.preventDefault();
        addValue(".");
    } else if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        calculate();
    } else if (event.key === "Backspace") {
        event.preventDefault();
        applyAction("delete");
    } else if (event.key === "Escape") {
        applyAction("clear");
    }
});

render();
