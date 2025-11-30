import { Expr } from "../../lab04";
import { cost } from "./cost";

type Substitution = Map<string, Expr>;

function exprEquals(e1: Expr, e2: Expr): boolean {
    if (e1.type !== e2.type) return false;
    
    switch (e1.type) {
        case 'number':
            return e2.type === 'number' && e1.value === e2.value;
        case 'variable':
            return e2.type === 'variable' && e1.name === e2.name;
        case 'unary':
            return e2.type === 'unary' && 
                   e1.operator === e2.operator && 
                   exprEquals(e1.operand, e2.operand);
        case 'binary':
            return e2.type === 'binary' && 
                   e1.operator === e2.operator && 
                   exprEquals(e1.left, e2.left) && 
                   exprEquals(e1.right, e2.right);
    }
}
//подходит ли выражение под шаблон
function match(pattern: Expr, expr: Expr, subst: Substitution = new Map()): Substitution | null {
    if (pattern.type === 'variable') {
        const existing = subst.get(pattern.name);
        if (existing !== undefined) {
            return exprEquals(existing, expr) ? subst : null;
        }
        const newSubst = new Map(subst);
        newSubst.set(pattern.name, expr);
        return newSubst;
    }
    
    if (pattern.type === 'number') {
        return expr.type === 'number' && pattern.value === pattern.value ? subst : null;
    }
    
    if (pattern.type === 'unary') {
        if (expr.type !== 'unary' || pattern.operator !== expr.operator) return null;
        return match(pattern.operand, expr.operand, subst);
    }
    
    if (pattern.type === 'binary') {
        if (expr.type !== 'binary' || pattern.operator !== expr.operator) return null;
        const leftMatch = match(pattern.left, expr.left, subst);
        if (leftMatch === null) return null;
        return match(pattern.right, expr.right, leftMatch);
    }
    
    return null;
}
//замена на подвыражения
function substitute(expr: Expr, subst: Substitution): Expr {
    switch (expr.type) {
        case 'number':
            return expr;
        case 'variable':
            const replacement = subst.get(expr.name);
            return replacement !== undefined ? replacement : expr;
        case 'unary':
            return {
                type: 'unary',
                operator: expr.operator,
                operand: substitute(expr.operand, subst)
            };
        case 'binary':
            return {
                type: 'binary',
                operator: expr.operator,
                left: substitute(expr.left, subst),
                right: substitute(expr.right, subst)
            };
    }
}


function fold(expr: Expr): Expr {
    switch (expr.type) {
        case 'number':
        case 'variable':
            return expr;
            
        case 'unary': {
            const operand = fold(expr.operand);
            if (operand.type === 'number') {
                const value = expr.operator === '-' ? -operand.value : operand.value;
                return { type: 'number', value };
            }
            return { type: 'unary', operator: expr.operator, operand };
        }
            
        case 'binary': {
            const left = fold(expr.left);
            const right = fold(expr.right);
            
            //свертка констант
            if (left.type === 'number' && right.type === 'number') {
                let value: number;
                switch (expr.operator) {
                    case '+': value = left.value + right.value; break;
                    case '-': value = left.value - right.value; break;
                    case '*': value = left.value * right.value; break;
                    case '/': value = right.value !== 0 ? left.value / right.value : left.value / right.value; break;
                    case '^': value = Math.pow(left.value, right.value); break;
                }
                return { type: 'number', value };
            }
            
            //алгебраические упрощения
            if (expr.operator === '*') {
                if (left.type === 'number' && left.value === 0) return { type: 'number', value: 0 };
                if (right.type === 'number' && right.value === 0) return { type: 'number', value: 0 };
                if (left.type === 'number' && left.value === 1) return right;
                if (right.type === 'number' && right.value === 1) return left;
            }
            
            if (expr.operator === '+') {
                if (left.type === 'number' && left.value === 0) return right;
                if (right.type === 'number' && right.value === 0) return left;
            }
            
            if (expr.operator === '-') {
                if (right.type === 'number' && right.value === 0) return left;
                if (exprEquals(left, right)) return { type: 'number', value: 0 };
            }
            
            if (expr.operator === '/') {
                if (left.type === 'number' && left.value === 0) return { type: 'number', value: 0 };
                if (right.type === 'number' && right.value === 1) return left;
            }
            
            return { type: 'binary', operator: expr.operator, left, right };
        }
    }
}

function exprToKey(expr: Expr): string {
    switch (expr.type) {
        case 'number': return `n${expr.value}`;
        case 'variable': return `v${expr.name}`;
        case 'unary': return `u${expr.operator}(${exprToKey(expr.operand)})`;
        case 'binary': return `b${expr.operator}(${exprToKey(expr.left)},${exprToKey(expr.right)})`;
    }
}


function applyAtRoot(expr: Expr, identity: [Expr, Expr]): Expr[] {
    const [lhs, rhs] = identity;
    const results: Expr[] = [];
    
    //прямое применение
    const subst1 = match(lhs, expr);
    if (subst1 !== null) {
        const result = fold(substitute(rhs, subst1));
        if (!exprEquals(result, expr)) {
            results.push(result);
        }
    }
    
    //обратное применение
    const subst2 = match(rhs, expr);
    if (subst2 !== null) {
        const result = fold(substitute(lhs, subst2));
        if (!exprEquals(result, expr)) {
            results.push(result);
        }
    }
    
    return results;
}


function rewriteAnywhere(expr: Expr, identities: [Expr, Expr][], depth: number = 0): Expr[] {
    if (depth > 4) return [];
    
    const results: Expr[] = [];
    
    for (const identity of identities) {
        results.push(...applyAtRoot(expr, identity));
    }
    
    switch (expr.type) {
        case 'number':
        case 'variable':
            break;
            
        case 'unary':
            for (const child of rewriteAnywhere(expr.operand, identities, depth + 1)) {
                results.push(fold({ type: 'unary', operator: expr.operator, operand: child }));
            }
            break;
            
        case 'binary':
            for (const newLeft of rewriteAnywhere(expr.left, identities, depth + 1)) {
                results.push(fold({ type: 'binary', operator: expr.operator, left: newLeft, right: expr.right }));
            }
            for (const newRight of rewriteAnywhere(expr.right, identities, depth + 1)) {
                results.push(fold({ type: 'binary', operator: expr.operator, left: expr.left, right: newRight }));
            }
            break;
    }
    
    const seen = new Set<string>();
    const unique: Expr[] = [];
    for (const result of results) {
        const key = exprToKey(result);
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(result);
        }
    }
    
    return unique;
}


export function simplify(e: Expr, identities: [Expr, Expr][]): Expr {
    const start = fold(e);
    let best = start;
    let bestCost = cost(best);
    
    
    const frontier: Array<{ expr: Expr, cost: number }> = [{ expr: start, cost: bestCost }];
    const visited = new Set<string>([exprToKey(start)]);
    
    const STEP_LIMIT = 1000;
    const FRONTIER_CAP = 1000;
    
    for (let step = 0; step < STEP_LIMIT && frontier.length > 0; step++) {
        frontier.sort((a, b) => a.cost - b.cost);
        const current = frontier.shift()!;
        
        if (current.cost < bestCost) {
            best = current.expr;
            bestCost = current.cost;
        }
        
        const nexts = rewriteAnywhere(current.expr, identities);
        
        for (const next of nexts) {
            const key = exprToKey(next);
            if (visited.has(key)) continue;
            visited.add(key);
            
            const nextCost = cost(next);
            frontier.push({ expr: next, cost: nextCost });
        }
        
        if (frontier.length > FRONTIER_CAP) {
            frontier.sort((a, b) => a.cost - b.cost);
            frontier.splice(FRONTIER_CAP);
        }
    }
    
    return best;
}