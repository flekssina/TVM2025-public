import { Expr, BinaryOp, UnaryOp } from "./ast";

const precedence: Record<string, number> = {
    '+': 1,
    '-': 1,
    '*': 2,
    '/': 2,
    '^': 3,
    'unary': 4 
};

const isRightAssociative = (op: string): boolean => {
    return op === '^';
};

export function printExpr(e: Expr, parentOp?: string, isRightChild?: boolean): string {
    switch (e.type) {
        case 'number':
            return e.value.toString();
            
        case 'variable':
            return e.name;
            
        case 'unary':
            const operandStr = printExpr(e.operand, 'unary', false);
            const needsParenForUnary = e.operand.type === 'binary';
            return e.operator + (needsParenForUnary ? `(${operandStr})` : operandStr);
            
        case 'binary':
            return printBinaryOp(e, parentOp, isRightChild);
    }
}

function printBinaryOp(e: BinaryOp, parentOp?: string, isRightChild?: boolean): string {
    const currentPrec = precedence[e.operator];
    const leftStr = printExpr(e.left, e.operator, false);
    const rightStr = printExpr(e.right, e.operator, true);
    
    const result = `${leftStr} ${e.operator} ${rightStr}`;

    if (!parentOp) {
        return result;
    }
    
    const parentPrec = precedence[parentOp];
    
    
    if (currentPrec < parentPrec) {
        return `(${result})`;
    }
    

    if (currentPrec === parentPrec) {
        if (e.operator === parentOp) {
            if (e.operator === '+' || e.operator === '*') {
                return result;
            }
            if (isRightChild) {
                return `(${result})`;
            }
            return result;
        }
        if (!isRightAssociative(parentOp)) {
            if (isRightChild) {
                return `(${result})`;
            }
        } else {
            if (!isRightChild) {
                return `(${result})`;
            }
        }
    }
    
    return result;
}