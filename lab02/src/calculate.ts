import { ReversePolishNotationActionDict } from "./rpn.ohm-bundle";

export const rpnCalc = {
  number(digit) {
    return Number.parseInt(digit.sourceString);
  },

  Expr(expr) {
    return expr.calculate();
  },

  Sum(expr0, expr1, _plus) {
    var res0 = expr0.calculate();
    var res1 = expr1.calculate();

    return res0 + res1;
  },

  Mul(expr0, expr1, _asterisk) {
    var res0 = expr0.calculate();
    var res1 = expr1.calculate();

    return res0 * res1;
  },
} satisfies ReversePolishNotationActionDict<number>;