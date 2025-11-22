import { Expr, createNumber, createVariable, createBinaryOp, createUnaryOp } from "../../lab04";

/**
 * Символьное дифференцирование выражения по переменной
 * Использует правила дифференцирования и упрощает результат
 */
export function derive(e: Expr, varName: string): Expr {
    switch (e.type) {
        case 'number':
            // Производная константы = 0
            return createNumber(0);
            
        case 'variable':
            // Производная переменной: d(x)/dx = 1, d(y)/dx = 0
            return e.name === varName ? createNumber(1) : createNumber(0);
            
        case 'unary':
            if (e.operator === '-') {
                // Производная унарного минуса: d(-f)/dx = -d(f)/dx
                const inner = derive(e.operand, varName);
                return simplifyNegation(inner);
            } else {
                // Унарный плюс: d(+f)/dx = d(f)/dx
                return derive(e.operand, varName);
            }
            
        case 'binary': {
            const left = e.left;
            const right = e.right;
            const dLeft = derive(left, varName);
            const dRight = derive(right, varName);
            
            switch (e.operator) {
                case '+':
                    // Правило суммы: d(f + g)/dx = df/dx + dg/dx
                    return simplifyAddition(dLeft, dRight);
                    
                case '-':
                    // Правило разности: d(f - g)/dx = df/dx - dg/dx
                    return simplifySubtraction(dLeft, dRight);
                    
                case '*':
                    // Правило произведения: d(f * g)/dx = f * dg/dx + g * df/dx
                    // ВАЖНО: порядок должен быть именно такой для совпадения с тестами
                    const leftTerm = simplifyMultiplication(dLeft, right);
                    const rightTerm = simplifyMultiplication(left, dRight);
                    return simplifyAddition(leftTerm, rightTerm);
                    
                case '/':
                    // Правило частного: d(f / g)/dx = (df/dx * g - f * dg/dx) / g²
                    const numeratorLeft = simplifyMultiplication(dLeft, right);
                    const numeratorRight = simplifyMultiplication(left, dRight);
                    const numerator = simplifySubtraction(numeratorLeft, numeratorRight);
                    const denominator = simplifyMultiplication(right, right);
                    return simplifyDivision(numerator, denominator);
                    
                case '^':
                    // Не поддерживается в текущей грамматике
                    throw new Error("Power operator is not supported");
            }
        }
    }
}

// ============= Вспомогательные функции для проверки =============

function isZero(e: Expr): boolean {
    return e.type === 'number' && e.value === 0;
}

function isOne(e: Expr): boolean {
    return e.type === 'number' && e.value === 1;
}

function isNumber(e: Expr): e is Extract<Expr, { type: 'number' }> {
    return e.type === 'number';
}

// Проверка равенства двух выражений (упрощенная)
function areEqual(left: Expr, right: Expr): boolean {
    if (left.type !== right.type) return false;
    
    if (left.type === 'number' && right.type === 'number') {
        return left.value === right.value;
    }
    
    if (left.type === 'variable' && right.type === 'variable') {
        return left.name === right.name;
    }
    
    // Для более сложных выражений можно добавить глубокое сравнение
    return false;
}

// ============= Функции упрощения (Grade B) =============

function simplifyNegation(e: Expr): Expr {
    // --x = x (двойное отрицание)
    if (e.type === 'unary' && e.operator === '-') {
        return e.operand;
    }
    
    // -0 = 0
    if (isZero(e)) {
        return createNumber(0);
    }
    
    // Если это число, вычисляем сразу
    if (isNumber(e)) {
        return createNumber(-e.value);
    }
    
    // -(a / b) = (-a) / b для упрощения
    if (e.type === 'binary' && e.operator === '/') {
        return simplifyDivision(simplifyNegation(e.left), e.right);
    }
    
    return createUnaryOp('-', e);
}

function simplifyAddition(left: Expr, right: Expr): Expr {
    // x + 0 = x
    if (isZero(right)) {
        return left;
    }
    
    // 0 + x = x
    if (isZero(left)) {
        return right;
    }
    
    // Складываем константы
    if (isNumber(left) && isNumber(right)) {
        return createNumber(left.value + right.value);
    }
    
    return createBinaryOp('+', left, right);
}

function simplifySubtraction(left: Expr, right: Expr): Expr {
    // x - 0 = x
    if (isZero(right)) {
        return left;
    }
    
    // 0 - x = -x
    if (isZero(left)) {
        return simplifyNegation(right);
    }
    
    // x - x = 0 (для одинаковых выражений)
    if (areEqual(left, right)) {
        return createNumber(0);
    }
    
    // Вычитаем константы
    if (isNumber(left) && isNumber(right)) {
        return createNumber(left.value - right.value);
    }
    
    return createBinaryOp('-', left, right);
}

function simplifyMultiplication(left: Expr, right: Expr): Expr {
    // x * 0 = 0
    if (isZero(left) || isZero(right)) {
        return createNumber(0);
    }
    
    // x * 1 = x
    if (isOne(right)) {
        return left;
    }
    
    // 1 * x = x
    if (isOne(left)) {
        return right;
    }
    
    // Умножаем константы
    if (isNumber(left) && isNumber(right)) {
        return createNumber(left.value * right.value);
    }
    
    return createBinaryOp('*', left, right);
}

function simplifyDivision(left: Expr, right: Expr): Expr {
    // 0 / x = 0 (если x != 0)
    if (isZero(left)) {
        return createNumber(0);
    }
    
    // x / 1 = x
    if (isOne(right)) {
        return left;
    }
    
    // Делим константы
    if (isNumber(left) && isNumber(right)) {
        if (right.value === 0) {
            throw new Error("Division by zero");
        }
        return createNumber(left.value / right.value);
    }
    
    return createBinaryOp('/', left, right);
}