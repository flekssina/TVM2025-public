import { writeFileSync } from "fs";
import { Op, I32, Void, c, BufferedEmitter, LocalEntry, N, AnyOp} from "../../wasm";
import { Module, FunctionDef, Statement, Expr, Condition, VarType, FunctionCall, ArrayAccess } from "../../lab08";
import * as arith from "../../lab04";

const { i32, 
    varuint32,
    get_local, local_entry, set_local, call, if_, void_block, void_loop, br_if, br, str_ascii, export_entry,
    func_type, func_type_m, function_body, type_section, function_section, export_section, code_section } = c;

interface CompilerContext {
    locals: Map<string, number>;
    localTypes: LocalEntry[];
    functionMap: Map<string, number>;
}

function compileExpression(expr: Expr, ctx: CompilerContext): Op<I32> {
    if (expr.type === 'number') {
        return i32. const(expr.value);
    }
    
    if (expr.type === 'variable') {
        const localIndex = ctx.locals.get(expr.name);
        if (localIndex === undefined) {
            throw new Error(`Unknown variable: ${expr.name}`);
        }
        return get_local(i32, localIndex);
    }
    
    if (expr. type === 'binary') {
        const binaryExpr = expr as arith.BinaryOp;
        const left = compileExpression(binaryExpr.left, ctx);
        const right = compileExpression(binaryExpr.right, ctx);
        
        switch (binaryExpr.operator) {
            case '+': 
                return i32.add(left, right);
            case '-': 
                return i32.sub(left, right);
            case '*': 
                return i32.mul(left, right);
            case '/': 
                return i32. div_s(left, right);
            case '^':
                return i32.xor(left, right);
            default: 
                throw new Error(`Unknown binary operator: ${binaryExpr.operator}`);
        }
    }
    
    if (expr.type === 'unary') {
        const unaryExpr = expr as arith.UnaryOp;
        const operand = compileExpression(unaryExpr.operand, ctx);
        if (unaryExpr.operator === '-') {
            return i32.sub(i32.const(0), operand);
        } else {
            return operand;
        }
    }
    
    if (expr.type === 'call') {
        const funcCall = expr as FunctionCall;
        const funcIndex = ctx.functionMap.get(funcCall.name);
        if (funcIndex === undefined) {
            throw new Error(`Unknown function: ${funcCall.name}`);
        }
        
        const args = funcCall.args.map(arg => compileExpression(arg, ctx));
        return call(i32, varuint32(funcIndex), args);
    }
    
    if (expr.type === 'arrayAccess') {
        const arrayAccess = expr as ArrayAccess;
        const arrayIndex = ctx.locals.get(arrayAccess.name);
        if (arrayIndex === undefined) {
            throw new Error(`Unknown array: ${arrayAccess.name}`);
        }
        
        const baseAddr = get_local(i32, arrayIndex);
        const index = compileExpression(arrayAccess.index, ctx);
        const offset = i32.mul(index, i32.const(4));
        const addr = i32.add(baseAddr, offset);
        return i32.load(c.align32, addr);
    }
    
    throw new Error(`Unknown expression type: ${(expr as any).type}`);
}

function compileCondition(cond: Condition, ctx: CompilerContext): Op<I32> {
    switch (cond.type) {
        case 'true':
            return i32.const(1);
            
        case 'false':
            return i32.const(0);
            
        case 'comparison': {
            const left = compileExpression(cond.left, ctx);
            const right = compileExpression(cond.right, ctx);
            
            switch (cond.op) {
                case '==': return i32.eq(left, right);
                case '!=': return i32.ne(left, right);
                case '<': return i32.lt_s(left, right);
                case '<=': return i32.le_s(left, right);
                case '>': return i32. gt_s(left, right);
                case '>=': return i32.ge_s(left, right);
                default: throw new Error(`Unknown comparison operator: ${cond.op}`);
            }
        }
            
        case 'not':
            return i32.eqz(compileCondition(cond.operand, ctx));
            
        case 'and': {
            const left = compileCondition(cond.left, ctx);
            const right = compileCondition(cond.right, ctx);
            return i32.and(left, right);
        }
            
        case 'or': {
            const left = compileCondition(cond.left, ctx);
            const right = compileCondition(cond.right, ctx);
            return i32.or(left, right);
        }
            
        case 'implies': {
            const notLeft = i32.eqz(compileCondition(cond.left, ctx));
            const right = compileCondition(cond.right, ctx);
            return i32.or(notLeft, right);
        }
            
        default:
            throw new Error(`Unknown condition type: ${(cond as any).type}`);
    }
}

function compileStatement(stmt: Statement, ctx: CompilerContext): AnyOp[] {
    const ops: AnyOp[] = [];
    
    switch (stmt.type) {
        case 'assign':
            if (stmt.target.type === 'var') {
                const localIndex = ctx.locals.get(stmt.target.name);
                if (localIndex === undefined) {
                    throw new Error(`Unknown variable: ${stmt.target.name}`);
                }
                const value = compileExpression(stmt.value, ctx);
                // set_local(localIndex: uint32, expr: Op<Result>)
                ops.push(set_local(localIndex, value));
            } 
            else if (stmt.target.type === 'array') {
                const arrayIndex = ctx.locals.get(stmt.target.name);
                if (arrayIndex === undefined) {
                    throw new Error(`Unknown array: ${stmt.target.name}`);
                }
                
                const baseAddr = get_local(i32, arrayIndex);
                const index = compileExpression(stmt.target.index, ctx);
                const offset = i32.mul(index, i32.const(4));
                const addr = i32. add(baseAddr, offset);
                const value = compileExpression(stmt.value, ctx);
                
                // store(mi: MemImm, addr: Op<Int>, v: Op<I32>)
                ops.push(i32.store(c.align32, addr, value));
            } 
            else if (stmt. target.type === 'tuple') {
                if (stmt.value.type !== 'call') {
                    throw new Error('Tuple assignment requires function call');
                }
                
                const funcCall = stmt.value as FunctionCall;
                const funcIndex = ctx.functionMap.get(funcCall.name);
                if (funcIndex === undefined) {
                    throw new Error(`Unknown function: ${funcCall.name}`);
                }
                
                const args = funcCall.args.map(arg => compileExpression(arg, ctx));
                
                // Вызываем функцию - возвращает void для multiple returns
                ops.push(call(i32, varuint32(funcIndex), args) as any as Op<Void>);
                
                // Сохраняем результаты - они на стеке справа налево
                for (let i = stmt.target.names.length - 1; i >= 0; i--) {
                    const varName = stmt.target.names[i];
                    const localIndex = ctx.locals.get(varName);
                    if (localIndex === undefined) {
                        throw new Error(`Unknown variable: ${varName}`);
                    }
                    // set_local без выражения - берет значение со стека
                    ops.push(set_local(localIndex, get_local(i32, localIndex)));
                }
            }
            break;
            
        case 'if': {
            const condOp = compileCondition(stmt.condition, ctx);
            const thenOps = compileStatement(stmt.thenBranch, ctx);
            const elseOps = stmt.elseBranch ? compileStatement(stmt.elseBranch, ctx) : [];
            
            // if_<R>(r: R, cond: Op<I32>, then_: AnyOp[], else_?: AnyOp[])
            ops.push(if_(c.void, condOp, thenOps, elseOps));
            break;
        }
            
        case 'while': {
            const condOp = compileCondition(stmt.condition, ctx);
            const bodyOps = compileStatement(stmt.body, ctx);
            
            // br_if(relDepth: uint32, cond: Op<I32>)
            const loopBody: AnyOp[] = [
                ... bodyOps,
                br_if(0, condOp)  // если условие истинно, продолжаем цикл
            ];
            
            // Внешний block для выхода из цикла
            ops.push(void_block([
                void_loop([
                    br_if(1, i32.eqz(condOp)),  // если условие ложно, выходим
                    ...bodyOps,
                    br(0)  // безусловный переход к началу loop
                ])
            ]));
            break;
        }
            
        case 'block':
            for (const s of stmt.statements) {
                ops.push(... compileStatement(s, ctx));
            }
            break;
            
        default:
            throw new Error(`Unknown statement type: ${(stmt as any).type}`);
    }
    
    return ops;
}

export async function compileModule<M extends Module>(m: M, name?: string): Promise<WebAssembly. Exports>
{
    const functionMap = new Map<string, number>();
    
    m.functions.forEach((func, index) => {
        functionMap.set(func.name, index);
    });
    
    const types = [];
    for (const func of m.functions) {
        const paramTypes = func.parameters.map(_ => c.i32);
        const returnTypes = func.returns.map(_ => c.i32);
        types.push(func_type_m(paramTypes, returnTypes));
    }
    
    const funcIndices = m.functions.map((_, i) => varuint32(i));
    
    const exports = m.functions.map((func, i) => 
        export_entry(str_ascii(func.name), c.external_kind. function, varuint32(i))
    );
    
    const bodies = [];
    
    for (const func of m.functions) {
        const ctx: CompilerContext = {
            locals: new Map(),
            localTypes: [],
            functionMap
        };
        
        let localIndex = 0;
        
        //Параметры функции
        for (const param of func.parameters) {
            ctx.locals.set(param. name, localIndex++);
        }
        
        //Возвращаемые значения как локальные переменные
        for (const ret of func.returns) {
            ctx.locals.set(ret.name, localIndex++);
            ctx.localTypes.push(local_entry(varuint32(1), c.i32));
        }
        
        //Локальные переменные
        for (const local of func.locals) {
            ctx.locals.set(local.name, localIndex++);
            ctx.localTypes. push(local_entry(varuint32(1), c.i32));
        }
        
        //Компилируем тело
        const bodyOps: AnyOp[] = compileStatement(func.body, ctx);
        
        //Выталкиваем возвращаемые значения
        for (const ret of func.returns) {
            const retIndex = ctx.locals.get(ret.name);
            if (retIndex !== undefined) {
                bodyOps.push(get_local(i32, retIndex) as any as Op<Void>);
            }
        }
        
        bodies.push(function_body(ctx. localTypes, bodyOps));
    }
    
    const mod = c.module([
        type_section(types),
        function_section(funcIndices),
        export_section(exports),
        code_section(bodies)
    ]);
    
    const emitter = new BufferedEmitter(new ArrayBuffer(mod.z));
    mod.emit(emitter);
    
    if (name) {
        writeFileSync(`${name}.wasm`, Buffer.from(emitter.buffer));
    }
    
    const wasmModule = await WebAssembly.instantiate(emitter.buffer);
    return wasmModule.instance.exports;
}

export { FunnyError } from '../../lab08'