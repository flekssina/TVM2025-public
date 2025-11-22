import { c as C, Op, I32 } from "@tvm/wasm";
import { Expr } from "@tvm/lab04";
import { buildOneFunctionModule, Fn } from "./emitHelper";

const { i32, get_local, varuint32 } = C;


export function getVariables(e: Expr): string[] {
    const variables: string[] = [];
    const seen = new Set<string>();
    
    function traverse(expr: Expr): void {
        switch (expr.type) {
            case 'number':
                break;
                
            case 'variable':
                if (!seen.has(expr.name)) {
                    seen.add(expr.name);
                    variables.push(expr.name);
                }
                break;
                
            case 'unary':
                traverse(expr.operand);
                break;
                
            case 'binary':
                traverse(expr.left);
                traverse(expr.right);
                break;
        }
    }
    
    traverse(e);
    return variables;
}

export async function buildFunction(e: Expr, variables: string[]): Promise<Fn<number>> {
    let expr = wasm(e, variables);
    return await buildOneFunctionModule("test", variables.length, [expr]);
}

function wasm(e: Expr, args: string[]): Op<I32> {
    switch (e.type) {
        case 'number':
            return i32.const(e.value);
            
        case 'variable': {
            const index = args.indexOf(e.name);
            if (index === -1) {
                throw new WebAssembly.RuntimeError(`Variable '${e.name}' not found in argument list`);
            }
            return get_local(i32, index);
        }
            
        case 'unary': {
            // Для унарного минуса: компилируем операнд, затем применяем операцию
            const operand = wasm(e.operand, args);
            if (e.operator === '-') {
                return i32.sub(i32.const(0), operand);
            } else {
                return operand;
            }
        }
            
        case 'binary': {
            const left = wasm(e.left, args);
            const right = wasm(e.right, args);
            
            // Применяем бинарную операцию
            switch (e.operator) {
                case '+':
                    return i32.add(left, right);
                case '-':
                    return i32.sub(left, right);
                case '*':
                    return i32.mul(left, right);
                case '/':
                    return i32.div_s(left, right);
                case '^':
                    throw new Error("Power operator (^) is not supported in WebAssembly compilation");
            }
        }
    }
}