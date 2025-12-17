import { AnnotatedModule, FormulaDef, AnnotatedCondition, Quantifier, FormulaCall, AnnotatedFunctionDef } from "./funnier";
import { FunnyError, Expr, Condition } from "../../lab08";

interface ResolverContext {
    formulas: Map<string, FormulaDef>;
    variables: Map<string, { type: 'param' | 'local' | 'return' | 'quantifier' }>;
    functions: Map<string, AnnotatedFunctionDef>;
}

export function resolveModule(m: AnnotatedModule): AnnotatedModule {
    const ctx: ResolverContext = {
        formulas: new Map(),
        variables: new Map(),
        functions: new Map()
    };
    
    // Регистрируем формулы
    for (const formula of m.formulas) {
        if (ctx.formulas.has(formula. name)) {
            throw new FunnyError(
                `Duplicate formula name: ${formula.name}`,
                'DUPLICATE_FORMULA'
            );
        }
        ctx.formulas. set(formula.name, formula);
    }
    
    // Регистрируем функции
    for (const func of m.functions) {
        if (ctx.functions.has(func.name)) {
            throw new FunnyError(
                `Duplicate function name: ${func. name}`,
                'DUPLICATE_FUNCTION'
            );
        }
        ctx.functions. set(func.name, func);
    }
    
    // Проверяем формулы
    for (const formula of m.formulas) {
        validateFormula(formula, ctx);
    }
    
    // Проверяем функции
    for (const func of m.functions) {
        validateFunction(func, ctx);
    }
    
    return m;
}

function validateFormula(formula: FormulaDef, ctx: ResolverContext) {
    const localCtx:  ResolverContext = {
        ...ctx,
        variables: new Map()
    };
    
    // Регистрируем параметры формулы
    for (const param of formula.parameters) {
        if (localCtx.variables.has(param. name)) {
            throw new FunnyError(
                `Duplicate parameter name in formula ${formula.name}: ${param.name}`,
                'DUPLICATE_VARIABLE'
            );
        }
        localCtx.variables.set(param.name, { type: 'param' });
    }
    
    // Проверяем тело формулы
    validateCondition(formula.body, localCtx);
}

function validateFunction(func: AnnotatedFunctionDef, ctx: ResolverContext) {
    const localCtx: ResolverContext = {
        ...ctx,
        variables: new Map()
    };
    
    // Регистрируем параметры
    for (const param of func. parameters) {
        localCtx.variables.set(param.name, { type: 'param' });
    }
    
    // Регистрируем возвращаемые значения
    for (const ret of func.returns) {
        localCtx.variables.set(ret.name, { type: 'return' });
    }
    
    // Регистрируем локальные переменные
    for (const local of func.locals) {
        localCtx.variables.set(local.name, { type: 'local' });
    }
    
    // Проверяем аннотации
    if (func.requires) {
        validateCondition(func.requires, localCtx);
    }
    
    if (func.ensures) {
        validateCondition(func.ensures, localCtx);
    }
}

function validateCondition(cond: AnnotatedCondition | Condition, ctx: ResolverContext) {
    if (! cond || typeof cond !== 'object') {
        return;
    }
    
    switch (cond.type) {
        case 'true':
        case 'false':
            break;
            
        case 'comparison':
            validateExpression(cond.left, ctx);
            validateExpression(cond.right, ctx);
            break;
            
        case 'not': 
            validateCondition(cond.operand, ctx);
            break;
            
        case 'and':
        case 'or':
        case 'implies':
            validateCondition(cond.left, ctx);
            validateCondition(cond.right, ctx);
            break;
            
        case 'quantifier':  {
            const quantifier = cond as Quantifier;
            
            // Проверяем домен
            if (typeof quantifier.domain === 'object') {
                if (quantifier.domain.type === 'range') {
                    validateExpression(quantifier.domain.from, ctx);
                    validateExpression(quantifier.domain.to, ctx);
                } else if (quantifier.domain.type === 'arrayDomain') {
                    if (! ctx.variables.has(quantifier. domain.arrayName)) {
                        throw new FunnyError(
                            `Undefined array in quantifier domain: ${quantifier. domain.arrayName}`,
                            'UNDEFINED_VARIABLE'
                        );
                    }
                }
            }
            // Если domain === 'int' или 'int[]', просто принимаем
            
            // Создаем новый контекст с переменной квантора
            const quantifierCtx:  ResolverContext = {
                ...ctx,
                variables: new Map(ctx.variables)
            };
            quantifierCtx.variables.set(quantifier.variable, { type: 'quantifier' });
            
            // Проверяем условие квантора
            validateCondition(quantifier.condition, quantifierCtx);
            break;
        }
            
        case 'formulaCall':  {
            const call = cond as FormulaCall;
            
            // length() - встроенная функция
            if (call.name === 'length') {
                if (call. args.length !== 1) {
                    throw new FunnyError(
                        `Function length expects 1 argument, got ${call.args.length}`,
                        'ARGUMENT_MISMATCH'
                    );
                }
                for (const arg of call.args) {
                    validateExpression(arg, ctx);
                }
                break;
            }
            
            // Проверяем существование формулы
            const formula = ctx.formulas.get(call.name);
            if (!formula) {
                throw new FunnyError(
                    `Undefined formula: ${call.name}`,
                    'UNDEFINED_FORMULA'
                );
            }
            
            // Проверяем количество аргументов
            if (call.args.length !== formula.parameters.length) {
                throw new FunnyError(
                    `Formula ${call.name} expects ${formula.parameters.length} arguments, got ${call.args.length}`,
                    'ARGUMENT_MISMATCH'
                );
            }
            
            // Проверяем аргументы
            for (const arg of call.args) {
                validateExpression(arg, ctx);
            }
            break;
        }
            
        default:
            break;
    }
}

function validateExpression(expr: Expr | any, ctx: ResolverContext) {
    if (! expr || typeof expr !== 'object') {
        return;
    }
    
    switch (expr.type) {
        case 'number':
            break;
            
        case 'variable':
            if (! ctx.variables.has(expr. name) && !ctx.functions.has(expr.name)) {
                throw new FunnyError(
                    `Undefined variable: ${expr.name}`,
                    'UNDEFINED_VARIABLE'
                );
            }
            break;
            
        case 'unary':
            validateExpression(expr.operand, ctx);
            break;
            
        case 'binary':
            validateExpression(expr.left, ctx);
            validateExpression(expr. right, ctx);
            break;
            
        case 'call':
            // length() в выражениях
            if (expr.name === 'length') {
                if (expr.args.length !== 1) {
                    throw new FunnyError(
                        `Function length expects 1 argument, got ${expr.args.length}`,
                        'ARGUMENT_MISMATCH'
                    );
                }
                for (const arg of expr.args) {
                    validateExpression(arg, ctx);
                }
                break;
            }
            
            // Проверяем существование функции
            if (!ctx.functions.has(expr.name)) {
                throw new FunnyError(
                    `Undefined function: ${expr.name}`,
                    'UNDEFINED_FUNCTION'
                );
            }
            
            // Проверяем аргументы
            for (const arg of expr.args) {
                validateExpression(arg, ctx);
            }
            break;
            
        case 'arrayAccess':
            if (!ctx.variables.has(expr.name)) {
                throw new FunnyError(
                    `Undefined array: ${expr.name}`,
                    'UNDEFINED_VARIABLE'
                );
            }
            validateExpression(expr.index, ctx);
            break;
            
        case 'lengthCall':
            validateExpression(expr.array, ctx);
            break;
            
        default:
            break;
    }
}