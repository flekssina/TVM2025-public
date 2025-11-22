import { MatchResult, Node } from 'ohm-js';
import { arithGrammar, ArithmeticActionDict, ArithmeticSemantics, SyntaxError } from '../../lab03';
import { Expr, createNumber, createVariable, createBinaryOp, createUnaryOp } from './ast';

export const getExprAst: ArithmeticActionDict<Expr> = {
    Sum(expr0: Node, _addOp: Node, expr2: Node): Expr {
        let result = expr0.parse();
        
        for (let i = 0; i < expr2.children.length; i++) {
            const right = expr2.child(i).parse();
            const op = _addOp.child(i).sourceString as '+' | '-';
            result = createBinaryOp(op, result, right);
        }
        
        return result;
    },
    
    Mul(expr0: Node, _mulOp: Node, expr2: Node): Expr {
        let result = expr0.parse();
        
        for (let i = 0; i < expr2.children.length; i++) {
            const right = expr2.child(i).parse();
            const op = _mulOp.child(i).sourceString as '*' | '/';
            result = createBinaryOp(op, result, right);
        }
        
        return result;
    },
    
    Neg_neg(_minus: Node, expr: Node): Expr {
        return createUnaryOp('-', expr.parse());
    },
    
    Neg(expr: Node): Expr {
        return expr.parse();
    },
    
    Atom(expr: Node): Expr {
        return expr.parse();
    },
    
    Paren(_lparen: Node, expr: Node, _rparen: Node): Expr {
        return expr.parse();
    },
    
    number(_digits: Node): Expr {
        return createNumber(parseFloat(this.sourceString));
    },
    
    variable(_letter: Node, _alnum: Node): Expr {
        return createVariable(this.sourceString);
    }
}

export const semantics = arithGrammar.createSemantics();
semantics.addOperation("parse()", getExprAst);

export interface ArithSemanticsExt extends ArithmeticSemantics {
    (match: MatchResult): ArithActionsExt
}

export interface ArithActionsExt {
    parse(): Expr
}

export function parseExpr(source: string): Expr {
    const match = arithGrammar.match(source);
    
    if (match.failed()) {
        throw new SyntaxError(match.message || "Parse error");
    }
    
    const sem = semantics as ArithSemanticsExt;
    return sem(match).parse();
}