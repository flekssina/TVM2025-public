import { Dict, MatchResult, Semantics } from "ohm-js";
import grammar, { AddMulActionDict } from "./addmul.ohm-bundle";

export const addMulSemantics: AddMulSemantics = grammar.createSemantics() as AddMulSemantics;


const addMulCalc = {
    number(digit) {
        return Number.parseInt(digit.sourceString);
    },

    Expr(expr) {
        return expr.calculate();
    },

    Paren(_lparen, expr, _rparen) {
        return expr.calculate();
    },

    Atom(expr) {
        return expr.calculate();
    },

    Sum(expr0, _plus, expr2) {
        var res = expr0.calculate();

        if (expr2.numChildren > 0) {
            res += expr2.children[0].calculate();
        }

        return res;
    },

    Mul(expr0, _asterisk, expr2) {
        var res = expr0.calculate();

        if (expr2.numChildren > 0) {
            res *= expr2.children[0].calculate();
        }

        return res;
    },
} satisfies AddMulActionDict<number>

addMulSemantics.addOperation<Number>("calculate()", addMulCalc);

interface AddMulDict  extends Dict {
    calculate(): number;
}

interface AddMulSemantics extends Semantics
{
    (match: MatchResult): AddMulDict;
}