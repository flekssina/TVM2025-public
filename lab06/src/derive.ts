import { Expr, createNumber, createVariable, createBinaryOp, createUnaryOp } from "../../lab04";


export function derive(e: Expr, varName: string): Expr {
    switch (e.type) {
        case 'number':
            return createNumber(0);
            
        case 'variable':
            //d(x)/dx = 1, d(y)/dx = 0
            return e.name === varName ? createNumber(1) : createNumber(0);
            
        case 'unary':
            if (e.operator === '-') {
                //d(-f)/dx = -d(f)/dx
                const inner = derive(e.operand, varName);
                return simplifyNegation(inner);
            } else {
                // d(+f)/dx = d(f)/dx
                return derive(e.operand, varName);
            }
            
        case 'binary': {
            const left = e.left;
            const right = e.right;
            const dLeft = derive(left, varName);
            const dRight = derive(right, varName);
            
            switch (e.operator) {
                case '+':
                    //  d(f + g)/dx = df/dx + dg/dx
                    return simplifyAddition(dLeft, dRight);
                    
                case '-':
                    // d(f - g)/dx = df/dx - dg/dx
                    return simplifySubtraction(dLeft, dRight);
                    
                case '*':
                    //  d(f * g)/dx = df/dx * g + f * dg/dx
                    const leftTerm = simplifyMultiplication(dLeft, right);
                    const rightTerm = simplifyMultiplication(left, dRight);
                    return simplifyAddition(leftTerm, rightTerm);
                    
                case '/':
                    //  d(f / g)/dx = (df/dx * g - f * dg/dx) / g²
                    const numeratorLeft = simplifyMultiplication(dLeft, right);
                    const numeratorRight = simplifyMultiplication(left, dRight);
                    const numerator = simplifySubtraction(numeratorLeft, numeratorRight);
                    const denominator = simplifyMultiplication(right, right);
                    return simplifyDivision(numerator, denominator);
                    
                case '^':
                    throw new Error("Power operator is not supported");
            }
        }
    }
}


function isZero(e: Expr): boolean {
    return e.type === 'number' && e.value === 0;
}

function isOne(e: Expr): boolean {
    return e.type === 'number' && e.value === 1;
}

function isNumber(e: Expr): e is Extract<Expr, { type: 'number' }> {
    return e.type === 'number';
}

function areEqual(left: Expr, right: Expr): boolean {
    if (left.type !== right.type) return false;
    
    if (left.type === 'number' && right.type === 'number') {
        return left.value === right.value;
    }
    
    if (left.type === 'variable' && right.type === 'variable') {
        return left.name === right.name;
    }
    
    return false;
}

function areEqualStructurally(left: Expr, right: Expr): boolean {
    if (left.type !== right.type) return false;
    
    if (left.type === 'number' && right.type === 'number') {
        return left.value === right.value;
    }
    
    if (left.type === 'variable' && right.type === 'variable') {
        return left.name === right.name;
    }
    
    if (left.type === 'unary' && right.type === 'unary') {
        return left.operator === right.operator && 
               areEqualStructurally(left.operand, right.operand);
    }
    
    if (left.type === 'binary' && right.type === 'binary') {
        return left.operator === right.operator && 
               areEqualStructurally(left.left, right.left) && 
               areEqualStructurally(left.right, right.right);
    }
    
    return false;
}



function simplifyNegation(e: Expr): Expr {
    // --x = x 
    if (e.type === 'unary' && e.operator === '-') {
        return e.operand;
    }
    
    // -0 = 0
    if (isZero(e)) {
        return createNumber(0);
    }
    
    //
    if (isNumber(e)) {
        return createNumber(-e.value);
    }
    
    // -(a / b) = (-a) / b 
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
    
    if (isNumber(left) && isNumber(right)) {
        return createNumber(left.value + right.value);
    }
    
    // x + x = 2*x 
    if (areEqualStructurally(left, right)) {
        return simplifyMultiplication(createNumber(2), left);
    }
    
    // n*x + x = (n+1)*x
    if (left.type === 'binary' && left.operator === '*' && 
        isNumber(left.left) && areEqualStructurally(left.right, right)) {
        return simplifyMultiplication(createNumber(left.left.value + 1), right);
    }
    
    // x + n*x = (n+1)*x
    if (right.type === 'binary' && right.operator === '*' && 
        isNumber(right.left) && areEqualStructurally(right.right, left)) {
        return simplifyMultiplication(createNumber(right.left.value + 1), left);
    }
    
    // n*x + m*x = (n+m)*x
    if (left.type === 'binary' && left.operator === '*' && isNumber(left.left) &&
        right.type === 'binary' && right.operator === '*' && isNumber(right.left) &&
        areEqualStructurally(left.right, right.right)) {
        return simplifyMultiplication(
            createNumber(left.left.value + right.left.value), 
            left.right
        );
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
    
    // x - x = 0 
    if (areEqual(left, right)) {
        return createNumber(0);
    }
    
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
    
    if (isNumber(left) && isNumber(right)) {
        if (right.value === 0) {
            throw new Error("Division by zero");
        }
        return createNumber(left.value / right.value);
    }
    
    return createBinaryOp('/', left, right);
}