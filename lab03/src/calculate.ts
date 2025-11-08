import { MatchResult } from "ohm-js";
import grammar, {
  ArithmeticActionDict,
  ArithmeticSemantics,
} from "./arith.ohm-bundle";

export const arithSemantics: ArithSemantics =
  grammar.createSemantics() as ArithSemantics;

const arithCalc = {
  number(digit) {
    return Number.parseInt(digit.sourceString);
  },

  variable(letter, alnum) {
    return this.args.params[this.sourceString];
  },

  Paren(_lparen, expr, _rparen) {
    return expr.calculate(this.args.params);
  },

  Atom(expr) {
    return expr.calculate(this.args.params);
  },

  Sum(expr0, _addOp, expr2) {
    var res = expr0.calculate(this.args.params);

    for (var i = 0; i < expr2.children.length; i++) {
      var rightRes = expr2.child(i).calculate(this.args.params);
      var _op = _addOp.child(i).sourceString;

      if (_op === "+") {
        res += rightRes;
      } else if (_op === "-") {
        res -= rightRes;
      }
    }

    return res;
  },

  Mul(expr0, _mulOp, expr2) {
    var res = expr0.calculate(this.args.params);

    for (var i = 0; i < expr2.children.length; i++) {
      var rightRes = expr2.child(i).calculate(this.args.params);
      var _op = _mulOp.child(i).sourceString;

      if (_op === "*") {
        res *= rightRes;
      } else if (_op === "/") {
        if (rightRes === 0) {
          throw new Error();
        }

        res /= rightRes;
      }
    }

    return res;
  },

  Neg_neg(_minus, expr) {
    return -expr.calculate(this.args.params);
  },

  Neg(expr) {
    return expr.calculate(this.args.params);
  },
} satisfies ArithmeticActionDict<number | undefined>;

arithSemantics.addOperation<Number>("calculate(params)", arithCalc);

export interface ArithActions {
  calculate(params: { [name: string]: number }): number;
}

export interface ArithSemantics extends ArithmeticSemantics {
  (match: MatchResult): ArithActions;
}