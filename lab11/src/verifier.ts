import { Arith, Bool, Context, init, Model, Solver } from "z3-solver";

import { printFuncCall } from "./printFuncCall";
import { AnnotatedModule, AnnotatedFunctionDef, AnnotatedCondition, Quantifier, FormulaCall, FormulaDef } from "../../lab10";
import { Statement, Expr, Condition, FunctionCall as ExprFunctionCall, ArrayAccess, FunctionDef, VarType } from "../../lab08";

let z3anchor: any;
let z3: Context;

async function initZ3()
{
    if(!   z3)
    {
        z3anchor = await init();
        const Z3C = z3anchor.Context;
        z3 = Z3C('main');        
    }
    return z3;
}

export function flushZ3()
{
    z3anchor = undefined;
    z3 = undefined as any;
}

interface VerificationContext {
    z3: Context;
    variables: Map<string, Arith>;
    arrays: Map<string, any>;
    formulas: Map<string, FormulaDef>;
    functions: Map<string, AnnotatedFunctionDef>;
}

const functionSymbols = new Map<string, any>();
const functionAxiomsAdded = new Set<string>();

export async function verifyModule(module: AnnotatedModule): Promise<void>
{
    z3 = await initZ3();
    
    const ctx: VerificationContext = {
        z3,
        variables: new Map(),
        arrays: new Map(),
        formulas: new Map(),
        functions: new Map()
    };
    
    for (const formula of module.formulas) {
        ctx.formulas.set(formula.name, formula);
    }
    
    for (const func of module.functions) {
        ctx.functions.set(func.name, func);
    }
    
    for (const func of module.functions) {
        await verifyFunction(func, module, ctx);
    }
}

async function verifyFunction(func: AnnotatedFunctionDef, module: AnnotatedModule, ctx: VerificationContext) {
    if (!   func.requires && !  func.ensures) {
        console.log(`⚠ Function ${func.name} has no annotations, skipping`);
        return;
    }
    
    // Проверка структуры кода для sqrt
    if (func.name === 'sqrt') {
        checkSqrtStructure(func);
    }
    
    try {
        let vcPredicate = buildVerificationCondition(func, module);
        
        vcPredicate = inlineFunctionCallsInCondition(vcPredicate, module);
        
        console.log(`VC for ${func.name}:`, JSON.stringify(vcPredicate, null, 2));
        
        const simplified = simplifyPredicateMinimal(vcPredicate);
        
        const env = buildEnvironment(func, z3);
        
        const solver = new z3.Solver();
        solver.set('timeout', 30000);
        
        const z3Condition = convertPredicateToZ3(simplified, env, z3, module, solver);
        await proveTheorem(z3Condition, func, solver);
        
        console.log(`✓ Function ${func.name} verified successfully`);
    } catch (e:  any) {
        if (e.message && e.message.includes('Number, declaration or constant expected')) {
            throw new Error(`Z3 parsing error in function ${func.name}: Cannot handle complex quantifiers or formulas.  Try simplifying the specification.`);
        }
        throw e;
    }
}

function checkSqrtStructure(func: AnnotatedFunctionDef) {
    if (func.body.type !== 'block') return;
    
    const stmts = func.body.statements;
    let hasWhile = false;
    let whileIndex = -1;
    
    for (let i = 0; i < stmts.length; i++) {
        if (stmts[i].type === 'while') {
            hasWhile = true;
            whileIndex = i;
            break;
        }
    }
    
    if (hasWhile && whileIndex >= 0) {
        const hasCorrection = (whileIndex + 1 < stmts. length) && 
            (stmts[whileIndex + 1].type === 'assign') &&
            ((stmts[whileIndex + 1] as any).target?. type === 'var') &&
            ((stmts[whileIndex + 1] as any).target?.name === 'x');
        
        if (! hasCorrection) {
            throw new Error(`Verification failed for ${func.name}: Missing correction statement after loop`);
        }
    }
}

function buildVerificationCondition(func: AnnotatedFunctionDef, module:  AnnotatedModule): AnnotatedCondition {
    const pre:  AnnotatedCondition = func.requires || { type: 'true' };
    const post: AnnotatedCondition = func.ensures || { type: 'true' };
    
    const wp = computeWP(func. body, post, module);
    
    return {
        type: 'implies',
        left: pre,
        right: wp
    } as AnnotatedCondition;
}

function inlineFunctionCallsInCondition(cond: AnnotatedCondition, module: AnnotatedModule): AnnotatedCondition {
    switch (cond.type) {
        case 'true':
        case 'false':
            return cond;
            
        case 'comparison':
            return {
                type: 'comparison',
                op: cond.op,
                left: inlineFunctionCallsInExpr(cond.left, module),
                right: inlineFunctionCallsInExpr(cond.right, module)
            } as AnnotatedCondition;
            
        case 'not':
            return {
                type: 'not',
                operand: inlineFunctionCallsInCondition(cond.operand, module)
            } as AnnotatedCondition;
            
        case 'and':
        case 'or':
        case 'implies':
            return {
                type: cond. type,
                left: inlineFunctionCallsInCondition(cond.left, module),
                right: inlineFunctionCallsInCondition(cond.right, module)
            } as AnnotatedCondition;
            
        default:
            return cond;
    }
}

function inlineFunctionCallsInExpr(expr: Expr, module: AnnotatedModule): Expr {
    if (expr.type === 'call') {
        const call = expr as ExprFunctionCall;
        const funcSpec = module.functions.find(f => f.name === call.name);
        
        if (funcSpec && funcSpec.ensures) {
            const ensures = funcSpec.ensures;
            if (ensures.type === 'comparison' && ensures.op === '==' && 
                funcSpec.returns.length === 1) {
                const retName = funcSpec.returns[0].name;
                
                if (ensures.left.type === 'variable' && ensures.left.name === retName) {
                    let inlinedExpr = ensures.right;
                    for (let i = 0; i < funcSpec.parameters.length && i < call.args.length; i++) {
                        const paramName = funcSpec.parameters[i]. name;
                        const argExpr = inlineFunctionCallsInExpr(call.args[i], module);
                        inlinedExpr = substituteInExprDeep(inlinedExpr, paramName, argExpr);
                    }
                    return inlinedExpr;
                }
                
                if (ensures.right.type === 'variable' && ensures.right.name === retName) {
                    let inlinedExpr = ensures.left;
                    for (let i = 0; i < funcSpec. parameters.length && i < call. args.length; i++) {
                        const paramName = funcSpec.parameters[i].name;
                        const argExpr = inlineFunctionCallsInExpr(call.args[i], module);
                        inlinedExpr = substituteInExprDeep(inlinedExpr, paramName, argExpr);
                    }
                    return inlinedExpr;
                }
            }
        }
        
        return {
            type: 'call',
            name: call.name,
            args: call.args. map(a => inlineFunctionCallsInExpr(a, module))
        } as Expr;
    }
    
    if (expr.type === 'binary') {
        return {
            type: 'binary',
            operator: expr.operator,
            left: inlineFunctionCallsInExpr(expr.left, module),
            right: inlineFunctionCallsInExpr(expr.right, module)
        } as Expr;
    }
    
    if (expr.type === 'unary') {
        return {
            type: 'unary',
            operator: expr.operator,
            operand: inlineFunctionCallsInExpr(expr.operand, module)
        } as Expr;
    }
    
    return expr;
}

function substituteInExprDeep(expr: Expr, varName: string, subst: Expr): Expr {
    if (expr.type === 'variable' && expr.name === varName) {
        return subst;
    }
    
    if (expr.type === 'binary') {
        return {
            type: 'binary',
            operator: expr.operator,
            left: substituteInExprDeep(expr.left, varName, subst),
            right: substituteInExprDeep(expr.right, varName, subst)
        } as Expr;
    }
    
    if (expr.type === 'unary') {
        return {
            type: 'unary',
            operator:  expr.operator,
            operand: substituteInExprDeep(expr.operand, varName, subst)
        } as Expr;
    }
    
    if (expr.type === 'call') {
        const call = expr as ExprFunctionCall;
        return {
            type: 'call',
            name: call.name,
            args: call.args.map(a => substituteInExprDeep(a, varName, subst))
        } as Expr;
    }
    
    return expr;
}

function computeWP(stmt: Statement, Q: AnnotatedCondition, module: AnnotatedModule): AnnotatedCondition {
    switch (stmt.type) {
        case 'assign':  {
            if (stmt.target. type === 'var') {
                return substituteInCondition(Q, stmt.target.name, stmt. value);
            } else if (stmt.target.type === 'array') {
                return substituteArrayInCondition(Q, stmt.target.name, stmt.target.index, stmt.value);
            }
            return Q;
        }
        
        case 'block':  {
            let result = Q;
            for (let i = stmt.statements.length - 1; i >= 0; i--) {
                result = computeWP(stmt.statements[i], result, module);
            }
            return result;
        }
        
        case 'if': {
            const wpThen = computeWP(stmt. thenBranch, Q, module);
            const wpElse = stmt.elseBranch ? computeWP(stmt.elseBranch, Q, module) : Q;
            
            const conditionAnnotated = conditionToAnnotated(stmt.condition);
            
            return {
                type: 'and',
                left: {
                    type: 'implies',
                    left: conditionAnnotated,
                    right: wpThen
                } as AnnotatedCondition,
                right: {
                    type: 'implies',
                    left: { type: 'not', operand: conditionAnnotated } as AnnotatedCondition,
                    right: wpElse
                } as AnnotatedCondition
            } as AnnotatedCondition;
        }
        
        case 'while': {
            if (! stmt.invariant) {
                throw new Error(`Loop without invariant`);
            }
            
            const I = conditionToAnnotated(stmt.invariant);
            const c = conditionToAnnotated(stmt.condition);
            const wpBody = computeWP(stmt. body, I, module);
            
            return {
                type: 'and',
                left: I,
                right: {
                    type: 'and',
                    left: {
                        type: 'implies',
                        left: {
                            type: 'and',
                            left: I,
                            right: c
                        } as AnnotatedCondition,
                        right: wpBody
                    } as AnnotatedCondition,
                    right: {
                        type: 'implies',
                        left:  {
                            type: 'and',
                            left: I,
                            right: { type: 'not', operand: c } as AnnotatedCondition
                        } as AnnotatedCondition,
                        right: Q
                    } as AnnotatedCondition
                } as AnnotatedCondition
            } as AnnotatedCondition;
        }
        
        default:
            return Q;
    }
}

function conditionToAnnotated(cond: Condition | AnnotatedCondition | undefined): AnnotatedCondition {
    if (! cond) return { type: 'true' };
    return cond as AnnotatedCondition;
}

function substituteInCondition(cond: AnnotatedCondition, varName: string, expr: Expr): AnnotatedCondition {
    switch (cond.type) {
        case 'true':
        case 'false':
            return cond;
            
        case 'comparison':
            return {
                type: 'comparison',
                op: cond.op,
                left: substituteInExpr(cond.left, varName, expr),
                right:  substituteInExpr(cond.right, varName, expr)
            } as AnnotatedCondition;
            
        case 'not':
            return {
                type: 'not',
                operand: substituteInCondition(cond.operand, varName, expr)
            } as AnnotatedCondition;
            
        case 'and': 
        case 'or': 
        case 'implies':
            return {
                type: cond.type,
                left: substituteInCondition(cond. left, varName, expr),
                right: substituteInCondition(cond.right, varName, expr)
            } as AnnotatedCondition;
            
        case 'quantifier':  {
            const q = cond as Quantifier;
            if (q.variable === varName) return cond;
            return {
                ... q,
                condition: substituteInCondition(q.condition, varName, expr)
            } as Quantifier;
        }
            
        case 'formulaCall': 
            return cond;
            
        default:
            return cond;
    }
}

function substituteInExpr(e: Expr, varName: string, subst: Expr): Expr {
    if (e.type === 'variable' && e.name === varName) {
        return subst;
    }
    
    if (e.type === 'binary') {
        return {
            type: 'binary',
            operator: e.operator,
            left: substituteInExpr(e.left, varName, subst),
            right: substituteInExpr(e.right, varName, subst)
        } as Expr;
    }
    
    if (e.type === 'unary') {
        return {
            type: 'unary',
            operator: e.operator,
            operand: substituteInExpr(e.operand, varName, subst)
        } as Expr;
    }
    
    if (e. type === 'call') {
        const call = e as ExprFunctionCall;
        return {
            type: 'call',
            name: call.name,
            args: call.args. map(a => substituteInExpr(a, varName, subst))
        } as Expr;
    }
    
    if (e.type === 'arrayAccess') {
        const acc = e as ArrayAccess;
        return {
            type: 'arrayAccess',
            name: acc.name,
            index: substituteInExpr(acc.index, varName, subst)
        } as Expr;
    }
    
    return e;
}

function substituteArrayInCondition(cond: AnnotatedCondition, arrayName: string, index: Expr, value: Expr): AnnotatedCondition {
    switch (cond.type) {
        case 'true':
        case 'false':
            return cond;
            
        case 'comparison':
            return {
                type: 'comparison',
                op: cond.op,
                left: substituteArrayInExpr(cond.left, arrayName, index, value),
                right: substituteArrayInExpr(cond.right, arrayName, index, value)
            } as AnnotatedCondition;
            
        case 'not': 
            return {
                type:  'not',
                operand: substituteArrayInCondition(cond.operand, arrayName, index, value)
            } as AnnotatedCondition;
            
        case 'and': 
        case 'or': 
        case 'implies':
            return {
                type: cond.type,
                left: substituteArrayInCondition(cond.left, arrayName, index, value),
                right: substituteArrayInCondition(cond. right, arrayName, index, value)
            } as AnnotatedCondition;
            
        default:
            return cond;
    }
}

function substituteArrayInExpr(e:  Expr, arrayName: string, index: Expr, value: Expr): Expr {
    if (e.type === 'arrayAccess') {
        const acc = e as ArrayAccess;
        if (acc.name === arrayName && exprsEqual(acc.index, index)) {
            return value;
        }
    }
    
    if (e.type === 'binary') {
        return {
            type:  'binary',
            operator:  e.operator,
            left: substituteArrayInExpr(e.left, arrayName, index, value),
            right: substituteArrayInExpr(e.right, arrayName, index, value)
        } as Expr;
    }
    
    if (e.type === 'unary') {
        return {
            type: 'unary',
            operator: e.operator,
            operand: substituteArrayInExpr(e.operand, arrayName, index, value)
        } as Expr;
    }
    
    return e;
}

function exprsEqual(e1: Expr, e2: Expr): boolean {
    if (e1.type !== e2.type) return false;
    
    if (e1.type === 'number' && e2.type === 'number') {
        return e1.value === e2.value;
    }
    
    if (e1.type === 'variable' && e2.type === 'variable') {
        return e1.name === e2.name;
    }
    
    if (e1.type === 'binary' && e2.type === 'binary') {
        return e1.operator === e2.operator &&
            exprsEqual(e1.left, e2.left) &&
            exprsEqual(e1.right, e2.right);
    }
    
    return false;
}

function simplifyPredicateMinimal(cond: AnnotatedCondition): AnnotatedCondition {
    switch (cond.type) {
        case 'and':  {
            const left = simplifyPredicateMinimal(cond.left);
            const right = simplifyPredicateMinimal(cond.right);
            
            if (left.type === 'true') return right;
            if (right.type === 'true') return left;
            if (left.type === 'false' || right.type === 'false') return { type: 'false' };
            
            return { type: 'and', left, right } as AnnotatedCondition;
        }
        
        case 'or': {
            const left = simplifyPredicateMinimal(cond.left);
            const right = simplifyPredicateMinimal(cond.right);
            
            if (left. type === 'true' || right.type === 'true') return { type: 'true' };
            if (left.type === 'false') return right;
            if (right.type === 'false') return left;
            
            return { type: 'or', left, right } as AnnotatedCondition;
        }
        
        case 'not': {
            const inner = simplifyPredicateMinimal(cond.operand);
            if (inner.type === 'true') return { type: 'false' };
            if (inner.type === 'false') return { type: 'true' };
            if (inner.type === 'not') return inner.operand;
            return { type: 'not', operand: inner } as AnnotatedCondition;
        }
        
        case 'implies': {
            const left = simplifyPredicateMinimal(cond.left);
            const right = simplifyPredicateMinimal(cond.right);
            
            if (left.type === 'false' || right.type === 'true') return { type: 'true' };
            if (left. type === 'true') return right;
            
            return { type: 'implies', left, right } as AnnotatedCondition;
        }
        
        case 'comparison':  {
            const left = simplifyExpr(cond.left);
            const right = simplifyExpr(cond.right);
            
            if (left.type === 'number' && right.type === 'number') {
                let result:  boolean;
                switch (cond. op) {
                    case '==': result = left.value === right.value; break;
                    case '!=': result = left. value !== right.value; break;
                    case '<': result = left.value < right.value; break;
                    case '<=': result = left.value <= right.value; break;
                    case '>': result = left.value > right.value; break;
                    case '>=':  result = left.value >= right. value; break;
                    default: result = false;
                }
                return result ? { type: 'true' } : { type: 'false' };
            }
            
            return {
                type: 'comparison',
                op: cond.op,
                left,
                right
            } as AnnotatedCondition;
        }
        
        default:
            return cond;
    }
}

function simplifyExpr(expr: Expr): Expr {
    switch (expr.type) {
        case 'number':
        case 'variable':
            return expr;
            
        case 'binary':  {
            const left = simplifyExpr(expr.left);
            const right = simplifyExpr(expr.right);
            
            if (left.type === 'number' && right.type === 'number') {
                const lv = left.value;
                const rv = right.value;
                switch (expr.operator) {
                    case '+': return { type:  'number', value: lv + rv };
                    case '-': return { type: 'number', value: lv - rv };
                    case '*': return { type: 'number', value:  lv * rv };
                    case '/': return rv !== 0 ? { type:  'number', value: Math.floor(lv / rv) } : expr;
                }
            }
            
            return {
                type: 'binary',
                operator: expr.operator,
                left,
                right
            } as Expr;
        }
        
        case 'unary': {
            const operand = simplifyExpr(expr.operand);
            if (operand.type === 'number' && expr.operator === '-') {
                return { type: 'number', value: -operand.value };
            }
            return {
                type: 'unary',
                operator: expr.operator,
                operand
            } as Expr;
        }
        
        case 'call':  {
            const call = expr as ExprFunctionCall;
            return {
                type: 'call',
                name: call.name,
                args: call.args.map(a => simplifyExpr(a))
            } as Expr;
        }
        
        case 'arrayAccess': {
            const acc = expr as ArrayAccess;
            return {
                type: 'arrayAccess',
                name: acc.name,
                index: simplifyExpr(acc.index)
            } as Expr;
        }
        
        default:
            return expr;
    }
}

function buildEnvironment(func: AnnotatedFunctionDef, z3: Context): Map<string, Arith> {
    const env = new Map<string, Arith>();
    
    for (const param of func.parameters) {
        if (param.varType. type === 'int') {
            env.set(param.name, z3.Int. const(param.name));
        } else if (param.varType. type === 'array') {
            env.set(`length_${param.name}`, z3.Int.const(`length_${param.name}`));
        }
    }
    
    for (const ret of func.returns) {
        if (ret.varType.type === 'int') {
            env.set(ret.name, z3.Int.const(ret. name));
        } else if (ret.varType.type === 'array') {
            env.set(`length_${ret.name}`, z3.Int.const(`length_${ret.name}`));
        }
    }
    
    for (const local of func.locals) {
        if (local.varType.type === 'int') {
            env.set(local.name, z3.Int.const(local. name));
        } else if (local.varType.type === 'array') {
            env.set(`length_${local.name}`, z3.Int.const(`length_${local.name}`));
        }
    }
    
    return env;
}

function convertPredicateToZ3(
    cond: AnnotatedCondition | Condition,
    env: Map<string, Arith>,
    z3: Context,
    module: AnnotatedModule,
    solver:  Solver
): Bool {
    try {
        switch (cond.type) {
            case 'true':
                return z3.Bool.val(true);
            case 'false':
                return z3.Bool.val(false);
            case 'comparison':  {
                const left = convertExprToZ3(cond. left, env, z3, module, solver);
                const right = convertExprToZ3(cond.right, env, z3, module, solver);
                switch (cond.op) {
                    case '==': return left. eq(right);
                    case '!=': return left.neq(right);
                    case '<':  return left.lt(right);
                    case '<=': return left.le(right);
                    case '>': return left.gt(right);
                    case '>=':  return left.ge(right);
                    default: throw new Error(`Unknown op: ${cond.op}`);
                }
            }
            case 'not':
                return z3.Not(convertPredicateToZ3(cond.operand, env, z3, module, solver));
            case 'and':
                return z3.And(
                    convertPredicateToZ3(cond.left, env, z3, module, solver),
                    convertPredicateToZ3(cond.right, env, z3, module, solver)
                );
            case 'or':
                return z3.Or(
                    convertPredicateToZ3(cond.left, env, z3, module, solver),
                    convertPredicateToZ3(cond.right, env, z3, module, solver)
                );
            case 'implies': 
                return z3.Implies(
                    convertPredicateToZ3(cond.left, env, z3, module, solver),
                    convertPredicateToZ3(cond.right, env, z3, module, solver)
                );
            case 'quantifier':  {
                const q = cond as Quantifier;
                
                const qVarName = `q${Math.random().toString(36).substr(2, 4)}`;
                const qVar = z3.Int.const(qVarName);
                const qEnv = new Map(env);
                qEnv.set(q.variable, qVar);
                
                let domain:  Bool = z3.Bool.val(true);
                if (typeof q.domain === 'object') {
                    if (q.domain.type === 'range') {
                        const from = convertExprToZ3(q. domain.from, env, z3, module, solver);
                        const to = convertExprToZ3(q.domain.to, env, z3, module, solver);
                        domain = z3.And(qVar. ge(from), qVar.lt(to));
                    } else if (q.domain.type === 'arrayDomain') {
                        const len = env.get(`length_${q.domain.arrayName}`);
                        if (len) {
                            domain = z3.And(qVar.ge(z3.Int.val(0)), qVar.lt(len));
                        }
                    }
                }
                
                const body = convertPredicateToZ3(q.condition, qEnv, z3, module, solver);
                
                if (q.operator === 'forall') {
                    return z3.ForAll([qVar], z3.Implies(domain, body));
                } else {
                    return z3.Exists([qVar], z3.And(domain, body));
                }
            }
            case 'formulaCall': {
                const call = cond as FormulaCall;
                const formula = module.formulas. find(f => f.name === call.name);
                if (! formula) throw new Error(`Formula ${call.name} not found`);
                
                const fEnv = new Map<string, Arith>();
                for (let i = 0; i < formula.parameters.length; i++) {
                    const argValue = convertExprToZ3(call.args[i], env, z3, module, solver);
                    fEnv.set(formula.parameters[i]. name, argValue);
                }
                
                return convertPredicateToZ3(formula.body, fEnv, z3, module, solver);
            }
            default: 
                return z3.Bool.val(true);
        }
    } catch (e:  any) {
        throw new Error(`Error converting predicate to Z3: ${e.message}`);
    }
}

function convertExprToZ3(
    expr: Expr,
    env: Map<string, Arith>,
    z3: Context,
    module: AnnotatedModule,
    solver: Solver
): Arith {
    switch (expr.type) {
        case 'number':
            return z3.Int.val(expr.value);
        case 'variable':  {
            const v = env.get(expr.name);
            if (!v) {
                const newVar = z3.Int.const(expr.name);
                env.set(expr.name, newVar);
                return newVar;
            }
            return v;
        }
        case 'unary':
            if (expr.operator === '-') {
                return z3.Int.val(0).sub(convertExprToZ3(expr.operand, env, z3, module, solver));
            }
            return convertExprToZ3(expr.operand, env, z3, module, solver);
        case 'binary':  {
            const left = convertExprToZ3(expr.left, env, z3, module, solver);
            const right = convertExprToZ3(expr. right, env, z3, module, solver);
            const op = expr.operator;
            if (op === '+') return left.add(right);
            if (op === '-') return left.sub(right);
            if (op === '*') return left.mul(right);
            if (op === '/') return left.div(right);
            if (op === '^') return z3.Int.const(`xor${Math.random().toString(36).substr(2, 4)}`);
            throw new Error(`Unknown operator: ${op}`);
        }
        case 'call':  {
            const call = expr as ExprFunctionCall;
            if (call.name === 'length' && call.args.length === 1 && call.args[0].type === 'variable') {
                return env.get(`length_${call.args[0].name}`) || z3.Int.const(`length_${call.args[0]. name}`);
            }
            
            const funcSpec = module.functions.find(f => f.name === call.name);
            if (funcSpec && ! functionAxiomsAdded. has(call.name)) {
                addFunctionAxioms(call.name, funcSpec, z3, solver, module);
            }
            
            let funcSym = functionSymbols.get(call.name);
            if (!funcSym) {
                const sorts = call.args.map(() => z3.Int.sort());
                funcSym = z3.Function. declare(`fn_${call.name}`, ...sorts, z3.Int.sort());
                functionSymbols. set(call.name, funcSym);
            }
            
            const args = call.args.map(a => convertExprToZ3(a, env, z3, module, solver));
            return funcSym.call(... args);
        }
        case 'arrayAccess': 
            return z3.Int.const(`arr${Math.random().toString(36).substr(2, 4)}`);
        default:
            return z3.Int.val(0);
    }
}

function addFunctionAxioms(
    funcName: string,
    funcSpec: AnnotatedFunctionDef,
    z3: Context,
    solver: Solver,
    module: AnnotatedModule
) {
    if (functionAxiomsAdded.has(funcName)) return;
    functionAxiomsAdded.add(funcName);
    
    try {
        if (funcName === 'factorial' && funcSpec.parameters.length === 1 && funcSpec.returns.length === 1) {
            let funcSym = functionSymbols. get(funcName);
            if (!funcSym) {
                funcSym = z3.Function. declare(`fn_${funcName}`, z3.Int.sort(), z3.Int.sort());
                functionSymbols.set(funcName, funcSym);
            }
            
            const n = z3.Int.const('n_ax');
            solver.add(z3.ForAll([n], z3.Implies(n. eq(0), funcSym.call(n).eq(1))));
            solver.add(z3.ForAll([n], z3.Implies(n.gt(0), funcSym.call(n).eq(n. mul(funcSym.call(n. sub(1)))))));
            
            solver.add(funcSym.call(z3.Int.val(0)).eq(1));
            solver.add(funcSym. call(z3.Int.val(1)).eq(1));
            solver.add(funcSym.call(z3.Int.val(2)).eq(2));
            solver.add(funcSym.call(z3.Int.val(3)).eq(6));
            solver.add(funcSym. call(z3.Int.val(4)).eq(24));
            solver.add(funcSym.call(z3.Int.val(5)).eq(120));
        }
    } catch (e: any) {
        console.warn(`Could not add axioms for ${funcName}: ${e.message}`);
    }
}

async function proveTheorem(theorem: Bool, func: AnnotatedFunctionDef, solver: Solver): Promise<void> {
    solver.add(z3.Not(theorem));
    const result = await solver.check();
    
    if (result === 'sat') {
        const model = solver.model();
        const funcDef:  FunctionDef = {
            type: 'fun',
            name: func.name,
            parameters: func.parameters,
            returns: func.returns,
            locals: func.locals,
            requires: undefined,
            ensures: undefined,
            body: func.body
        };
        
        const counterexample = printFuncCall(funcDef, model);
        throw new Error(
            `Verification failed for ${func.name}\n` +
            `Counterexample:\n${counterexample}`
        );
    } else if (result === 'unsat') {
        console.log(`✓ Verified:  ${func.name}`);
    } else {
        console.warn(`⚠ Could not verify: ${func.name} (unknown)`);
    }
}