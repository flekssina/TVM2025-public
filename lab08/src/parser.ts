import { getExprAst } from '../../lab04';
import * as ast from './funny';
import { FunnyError } from './index';

import grammar from './funny.ohm-bundle';
import { MatchResult, Semantics, Node } from 'ohm-js';

function findPosition(source: string, identifier: string): { line: number; column: number } | null {
    const lines = source.split('\n');
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        const idx = line.indexOf(identifier);
        if (idx !== -1) {
            return {
                line: lineNum + 1,
                column: idx + 1
            };
        }
    }
    return null;
}

export const getFunnyAst = {
    Module(this: Node, functions: any) {
        return {
            type: 'module',
            functions: functions.children.map((f: any) => f.parse())
        };
    },
    
    Function(this: Node, 
        name: any,
        _lp: any,
        params: any,
        _rp: any,
        _reqKw: any,
        req: any,
        _retKw: any,
        returns: any,
        _ensKw: any,
        ens: any,
        _usesKw: any,
        locals: any,
        body: any
    ) {
        return {
            type: 'fun',
            name: name.parse(),
            parameters: params.numChildren > 0 ? params.child(0).parse() : [],
            returns: returns.parse(),
            locals: locals.numChildren > 0 ? locals.child(0).parse() : [],
            requires: req.numChildren > 0 ? req.child(0).child(0).parse() : undefined,
            ensures: ens.numChildren > 0 ? ens.child(0).child(0).parse() : undefined,
            body: body.parse()
        };
    },
    
    Params(this: Node, first: any, _comma: any, rest: any) {
        return [first.parse(), ...rest.children.map((p: any) => p.parse())];
    },
    
    ParamDef(this: Node, name: any, _colon: any, type: any) {
        return {
            type: 'param',
            name: name.parse(),
            varType: type.parse()
        };
    },
    
    LocalsList(this: Node, first: any, _comma: any, rest: any) {
        return [first.parse(), ...rest.children.map((l: any) => l.parse())];
    },
    
    LocalDef(this: Node, name: any, _colon: any, _int: any) {
        return {
            type: 'param',
            name: name.parse(),
            varType: { type: 'int' }
        };
    },
    
    VarType(this: Node, _int: any, _lb: any, _rb: any) {
        if (_lb.numChildren > 0) {
            return { type: 'array', elementType: 'int' };
        }
        return { type: 'int' };
    },
    
    Statement(this: Node, stmt: any) {
        return stmt.parse();
    },
    
    Assignment_simple(this: Node, target: any, _eq: any, value: any, _semi: any) {
        return {
            type: 'assign',
            target: { type: 'var', name: target.parse() },
            value: value.parse()
        };
    },
    
    Assignment_array(this: Node, arrayAccess: any, _eq: any, value: any, _semi: any) {
        const access = arrayAccess.parse();
        return {
            type: 'assign',
            target: { 
                type: 'array', 
                name: access.name, 
                index: access.index 
            },
            value: value.parse()
        };
    },
    
    Assignment_tuple(this: Node, first: any, _comma: any, rest: any, _eq: any, call: any, _semi: any) {
        return {
            type: 'assign',
            target: {
                type: 'tuple',
                names: [first.parse(), ...rest.children.map((n: any) => n.parse())]
            },
            value: call.parse()
        };
    },
    
    Assignment(this: Node, assign: any) {
        return assign.parse();
    },
    
    Conditional(this: Node, _if: any, _lp: any, cond: any, _rp: any, thenBranch: any, _else: any, elseBranch: any) {
        return {
            type: 'if',
            condition: cond.parse(),
            thenBranch: thenBranch.parse(),
            elseBranch: elseBranch.numChildren > 0 ? elseBranch.child(0).parse() : undefined
        };
    },
    
    Loop(this: Node, _while: any, _lp: any, cond: any, _rp: any, _invKw: any, inv: any, body: any) {
        return {
            type: 'while',
            condition: cond.parse(),
            invariant: inv.numChildren > 0 ? inv.child(0).parse() : undefined,
            body: body.parse()
        };
    },
    
    Block(this: Node, _lb: any, statements: any, _rb: any) {
        return {
            type: 'block',
            statements: statements.children.map((s: any) => s.parse())
        };
    },
    
    FunctionCall(this: Node, name: any, _lp: any, args: any, _rp: any) {
        return {
            type: 'call',
            name: name.parse(),
            args: args.asIteration().children.map((a: any) => a.parse())
        };
    },
    
    ArrayAccess(this: Node, name: any, _lb: any, index: any, _rb: any) {
        return {
            type: 'arrayAccess',
            name: name.parse(),
            index: index.parse()
        };
    },
    
    Expr(this: Node, sum: any) {
        return sum.parse();
    },
    
    Condition(this: Node, impl: any) {
        return impl.parse();
    },
    
    CondImply(this: Node, left: any, _arrow: any, right: any) {
        if (right.numChildren === 0) {
            return left.parse();
        }
        return {
            type: 'implies',
            left: left.parse(),
            right: right.child(0).parse()
        };
    },
    
    CondOr(this: Node, first: any, _or: any, rest: any) {
        let result = first.parse();
        for (const r of rest.children) {
            result = {
                type: 'or',
                left: result,
                right: r.parse()
            };
        }
        return result;
    },
    
    CondAnd(this: Node, first: any, _and: any, rest: any) {
        let result = first.parse();
        for (const r of rest.children) {
            result = {
                type: 'and',
                left: result,
                right: r.parse()
            };
        }
        return result;
    },
    
    CondNot_not(this: Node, _not: any, operand: any) {
        return {
            type: 'not',
            operand: operand.parse()
        };
    },
    
    CondNot(this: Node, atom: any) {
        return atom.parse();
    },
    
    CondAtom(this: Node, node: any) {
        return node.parse();
    },
    
    CondAtom_true(this: Node, _true: any) {
        return { type: 'true' };
    },
    
    CondAtom_false(this: Node, _false: any) {
        return { type: 'false' };
    },
    
    CondAtom_paren(this: Node, _lp: any, cond: any, _rp: any) {
        return cond.parse();
    },
    
    Comparison(this: Node, left: any, op: any, right: any) {
        return {
            type: 'comparison',
            op: op.sourceString,
            left: left.parse(),
            right: right.parse()
        };
    },
    
    CompOp(this: Node, op: any) {
        return op.sourceString;
    },
    
    Predicate(this: Node, cond: any) {
        return cond.parse();
    },
    
    Sum(this: Node, first: any, _op: any, rest: any) {
        let result = first.parse();
        const ops = _op.children;
        const operands = rest.children;
        
        for (let i = 0; i < ops.length; i++) {
            result = {
                type: 'binary',
                operator: ops[i].sourceString,
                left: result,
                right: operands[i].parse()
            };
        }
        return result;
    },
    
    add(this: Node, op: any) {
        return op.sourceString;
    },
    
    Mul(this: Node, first: any, _op: any, rest: any) {
        let result = first.parse();
        const ops = _op.children;
        const operands = rest.children;
        
        for (let i = 0; i < ops.length; i++) {
            result = {
                type: 'binary',
                operator: ops[i].sourceString,
                left: result,
                right: operands[i].parse()
            };
        }
        return result;
    },
    
    mul(this: Node, op: any) {
        return op.sourceString;
    },
    
    Neg_neg(this: Node, _op: any, operand: any) {
        return {
            type: 'unary',
            operator: '-',
            operand: operand.parse()
        };
    },
    
    Neg(this: Node, atom: any) {
        return atom.parse();
    },
    
    Atom(this: Node, node: any) {
        return node.parse();
    },
    
    Paren(this: Node, _lp: any, expr: any, _rp: any) {
        return expr.parse();
    },
    
    variable(this: Node, _first: any, _rest: any) {
        return {
            type: 'variable',
            name: this.sourceString
        };
    },
    
    number(this: Node, _digits: any): any {
        return {
            type: 'number',
            value: parseInt(this.sourceString, 10)
        };
    },
    
    ident(this: Node, _first: any, _rest: any): string {
        return this.sourceString;
    },
    
    keyword(this: Node, kw: any): string {
        return this.sourceString;
    },
    
    _terminal(this: Node): string {
        return this.sourceString;
    },
    
    _iter(this: Node, ...children: any[]): any[] {
        return children.map((c: any) => c.parse());
    }
};

export const semantics: FunnySemanticsExt = grammar.Funny.createSemantics() as any;
semantics.addOperation("parse()", getFunnyAst);

export interface FunnySemanticsExt extends Semantics {
    (match: MatchResult): FunnyActionsExt
}

interface FunnyActionsExt {
    parse(): ast.Module;
}

export function parseFunny(source: string): ast.Module {
    const match = grammar.Funny.match(source, 'Module');
    
    if (match.failed()) {
        throw new FunnyError(
            `Syntax error: ${match.message}`,
            'SYNTAX_ERROR'
        );
    }
    
    const sem = semantics(match);
    const module = sem.parse();
    
    validateModule(module, source);
    
    return module;
}

function validateModule(module: ast.Module, source: string) {
    const functionNames = new Set<string>();
    
    for (const func of module.functions) {
        if (functionNames.has(func.name)) {
            const pos = findPosition(source, func.name);
            throw new FunnyError(
                pos ? `Duplicate function name: ${func.name} at line ${pos.line}, column ${pos.column}` : `Duplicate function name: ${func.name}`,
                'DUPLICATE_FUNCTION'
            );
        }
        functionNames.add(func.name);
        
        validateFunction(func, module, source);
    }
}

function validateFunction(func: ast.FunctionDef, module: ast.Module, source: string) {
    const scope = new Map<string, { varType: ast.VarType; used: boolean }>();
    
    for (const param of func.parameters) {
        if (scope.has(param.name)) {
            const pos = findPosition(source, param.name);
            throw new FunnyError(
                pos ? `Duplicate parameter name: ${param.name} at line ${pos.line}, column ${pos.column}` : `Duplicate parameter name: ${param.name}`,
                'DUPLICATE_VARIABLE'
            );
        }
        scope.set(param.name, { varType: param.varType, used: false });
    }
    
    for (const ret of func.returns) {
        if (scope.has(ret.name)) {
            const pos = findPosition(source, ret.name);
            throw new FunnyError(
                pos ? `Duplicate return variable name: ${ret.name} at line ${pos.line}, column ${pos.column}` : `Duplicate return variable name: ${ret.name}`,
                'DUPLICATE_VARIABLE'
            );
        }
        scope.set(ret.name, { varType: ret.varType, used: false });
    }
    
    for (const local of func.locals) {
        if (scope.has(local.name)) {
            const pos = findPosition(source, local.name);
            throw new FunnyError(
                pos ? `Duplicate local variable name: ${local.name} at line ${pos.line}, column ${pos.column}` : `Duplicate local variable name: ${local.name}`,
                'DUPLICATE_VARIABLE'
            );
        }
        scope.set(local.name, { varType: local.varType, used: false });
    }
    
    const readOnly = new Set(func.parameters.map(p => p.name));
    validateStatement(func.body, scope, module, readOnly, source);
    
    // Проверка неиспользованных переменных
    const warnings: string[] = [];
    for (const [varName, varInfo] of scope.entries()) {
        if (!varInfo.used && !readOnly.has(varName) && !func.returns.some(r => r.name === varName)) {
            const pos = findPosition(source, varName);
            warnings.push(`Warning: Unused variable '${varName}' at line ${pos?.line || '?'}, column ${pos?.column || '?'}`);
        }
    }
    
    if (warnings.length > 0) {
        console.warn(warnings.join('\n'));
    }
}

function validateStatement(
    stmt: ast.Statement,
    scope: Map<string, { varType: ast.VarType; used: boolean }>,
    module: ast.Module,
    readOnly: Set<string>,
    source: string
) {
    switch (stmt.type) {
        case 'assign':
            if (stmt.target.type === 'var') {
                if (!scope.has(stmt.target.name)) {
                    const pos = findPosition(source, stmt.target.name);
                    throw new FunnyError(
                        pos ? `Undefined variable: ${stmt.target.name} at line ${pos.line}, column ${pos.column}` : `Undefined variable: ${stmt.target.name}`,
                        'UNDEFINED_VARIABLE'
                    );
                }
                if (readOnly.has(stmt.target.name)) {
                    const pos = findPosition(source, stmt.target.name);
                    throw new FunnyError(
                        pos ? `Cannot assign to read-only parameter: ${stmt.target.name} at line ${pos.line}, column ${pos.column}` : `Cannot assign to read-only parameter: ${stmt.target.name}`,
                        'READONLY_ASSIGNMENT'
                    );
                }
                const varInfo = scope.get(stmt.target.name);
                if (varInfo) varInfo.used = true;
            } else if (stmt.target.type === 'array') {
                if (!scope.has(stmt.target.name)) {
                    const pos = findPosition(source, stmt.target.name);
                    throw new FunnyError(
                        pos ? `Undefined variable: ${stmt.target.name} at line ${pos.line}, column ${pos.column}` : `Undefined variable: ${stmt.target.name}`,
                        'UNDEFINED_VARIABLE'
                    );
                }
                if (readOnly.has(stmt.target.name)) {
                    const pos = findPosition(source, stmt.target.name);
                    throw new FunnyError(
                        pos ? `Cannot assign to read-only parameter: ${stmt.target.name} at line ${pos.line}, column ${pos.column}` : `Cannot assign to read-only parameter: ${stmt.target.name}`,
                        'READONLY_ASSIGNMENT'
                    );
                }
                const varInfo = scope.get(stmt.target.name);
                if (varInfo) varInfo.used = true;
                validateExpr(stmt.target.index, scope, module, source);
            } else if (stmt.target.type === 'tuple') {
                for (const name of stmt.target.names) {
                    if (!scope.has(name)) {
                        const pos = findPosition(source, name);
                        throw new FunnyError(
                            pos ? `Undefined variable: ${name} at line ${pos.line}, column ${pos.column}` : `Undefined variable: ${name}`,
                            'UNDEFINED_VARIABLE'
                        );
                    }
                    if (readOnly.has(name)) {
                        const pos = findPosition(source, name);
                        throw new FunnyError(
                            pos ? `Cannot assign to read-only parameter: ${name} at line ${pos.line}, column ${pos.column}` : `Cannot assign to read-only parameter: ${name}`,
                            'READONLY_ASSIGNMENT'
                        );
                    }
                    const varInfo = scope.get(name);
                    if (varInfo) varInfo.used = true;
                }
                
                if (stmt.value.type === 'call') {
                    const funcCall = stmt.value as ast.FunctionCall;
                    const func = module.functions.find(f => f.name === funcCall.name);
                    if (!func) {
                        const pos = findPosition(source, funcCall.name);
                        throw new FunnyError(
                            pos ? `Undefined function: ${funcCall.name} at line ${pos.line}, column ${pos.column}` : `Undefined function: ${funcCall.name}`,
                            'UNDEFINED_FUNCTION'
                        );
                    }
                    
                    if (func.returns.length !== stmt.target.names.length) {
                        const pos = findPosition(source, funcCall.name);
                        throw new FunnyError(
                            pos ? `Function '${funcCall.name}' returns ${func.returns.length} values, but ${stmt.target.names.length} targets provided at line ${pos.line}, column ${pos.column}` : `Function '${funcCall.name}' returns ${func.returns.length} values, but ${stmt.target.names.length} targets provided`,
                            'RETURN_MISMATCH'
                        );
                    }
                    
                    validateFunctionCall(funcCall, scope, module, source);
                }
            }
            
            if (stmt.value.type === 'call') {
                const funcCall = stmt.value as ast.FunctionCall;
                if (stmt.target.type !== 'tuple') {
                    const func = module.functions.find(f => f.name === funcCall.name);
                    if (func && func.returns.length !== 1) {
                        const pos = findPosition(source, funcCall.name);
                        throw new FunnyError(
                            pos ? `Function '${funcCall.name}' returns ${func.returns.length} values, cannot be used in simple assignment at line ${pos.line}, column ${pos.column}` : `Function '${funcCall.name}' returns ${func.returns.length} values, cannot be used in simple assignment`,
                            'RETURN_MISMATCH'
                        );
                    }
                }
                validateFunctionCall(funcCall, scope, module, source);
            } else {
                validateExpr(stmt.value, scope, module, source);
            }
            break;
            
        case 'if':
            validateCondition(stmt.condition, scope, module, source);
            validateStatement(stmt.thenBranch, scope, module, readOnly, source);
            if (stmt.elseBranch) {
                validateStatement(stmt.elseBranch, scope, module, readOnly, source);
            }
            break;
            
        case 'while':
            validateCondition(stmt.condition, scope, module, source);
            validateStatement(stmt.body, scope, module, readOnly, source);
            break;
            
        case 'block':
            for (const s of stmt.statements) {
                validateStatement(s, scope, module, readOnly, source);
            }
            break;
    }
}

function validateExpr(
    expr: ast.Expr,
    scope: Map<string, { varType: ast.VarType; used: boolean }>,
    module: ast.Module,
    source: string
): void {
    switch (expr.type) {
        case 'number':
            break;
            
        case 'variable':
            if (!scope.has(expr.name)) {
                const pos = findPosition(source, expr.name);
                throw new FunnyError(
                    pos ? `Undefined variable: ${expr.name} at line ${pos.line}, column ${pos.column}` : `Undefined variable: ${expr.name}`,
                    'UNDEFINED_VARIABLE'
                );
            }
            const varInfo = scope.get(expr.name);
            if (varInfo) varInfo.used = true;
            break;
            
        case 'unary':
            validateExpr(expr.operand, scope, module, source);
            break;
            
        case 'binary':
            validateExpr(expr.left, scope, module, source);
            validateExpr(expr.right, scope, module, source);
            break;
            
        case 'call':
            validateFunctionCall(expr, scope, module, source);
            break;
            
        case 'arrayAccess':
            if (!scope.has(expr.name)) {
                const pos = findPosition(source, expr.name);
                throw new FunnyError(
                    pos ? `Undefined variable: ${expr.name} at line ${pos.line}, column ${pos.column}` : `Undefined variable: ${expr.name}`,
                    'UNDEFINED_VARIABLE'
                );
            }
            const arrayInfo = scope.get(expr.name);
            if (arrayInfo) {
                arrayInfo.used = true;
                if (arrayInfo.varType.type !== 'array') {
                    const pos = findPosition(source, expr.name);
                    throw new FunnyError(
                        pos ? `Variable ${expr.name} is not an array at line ${pos.line}, column ${pos.column}` : `Variable ${expr.name} is not an array`,
                        'TYPE_ERROR'
                    );
                }
            }
            validateExpr(expr.index, scope, module, source);
            break;
    }
}

function validateFunctionCall(
    call: ast.FunctionCall,
    scope: Map<string, { varType: ast.VarType; used: boolean }>,
    module: ast.Module,
    source: string
): void {
    if (call.name === 'length') {
        if (call.args.length !== 1) {
            const pos = findPosition(source, call.name);
            throw new FunnyError(
                pos ? `Function 'length' expects 1 argument, got ${call.args.length} at line ${pos.line}, column ${pos.column}` : `Function 'length' expects 1 argument, got ${call.args.length}`,
                'ARGUMENT_MISMATCH'
            );
        }
        for (const arg of call.args) {
            validateExpr(arg, scope, module, source);
        }
        return;
    }
    
    const func = module.functions.find(f => f.name === call.name);
    if (!func) {
        const pos = findPosition(source, call.name);
        throw new FunnyError(
            pos ? `Undefined function: ${call.name} at line ${pos.line}, column ${pos.column}` : `Undefined function: ${call.name}`,
            'UNDEFINED_FUNCTION'
        );
    }
    
    if (func.returns.length !== 1) {
        const pos = findPosition(source, call.name);
        throw new FunnyError(
            pos ? `Function '${call.name}' returns ${func.returns.length} values, cannot be used in expression at line ${pos.line}, column ${pos.column}` : `Function '${call.name}' returns ${func.returns.length} values, cannot be used in expression`,
            'RETURN_MISMATCH'
        );
    }
    
    if (call.args.length !== func.parameters.length) {
        const pos = findPosition(source, call.name);
        throw new FunnyError(
            pos ? `Function '${call.name}' expects ${func.parameters.length} arguments, got ${call.args.length} at line ${pos.line}, column ${pos.column}` : `Function '${call.name}' expects ${func.parameters.length} arguments, got ${call.args.length}`,
            'ARGUMENT_MISMATCH'
        );
    }
    
    for (const arg of call.args) {
        validateExpr(arg, scope, module, source);
    }
}

function validateCondition(
    cond: ast.Condition,
    scope: Map<string, { varType: ast.VarType; used: boolean }>,
    module: ast.Module,
    source: string
): void {
    switch (cond.type) {
        case 'true':
        case 'false':
            break;
            
        case 'comparison':
            validateExpr(cond.left, scope, module, source);
            validateExpr(cond.right, scope, module, source);
            break;
            
        case 'not':
            validateCondition(cond.operand, scope, module, source);
            break;
            
        case 'and':
        case 'or':
        case 'implies':
            validateCondition(cond.left, scope, module, source);
            validateCondition(cond.right, scope, module, source);
            break;
    }
}