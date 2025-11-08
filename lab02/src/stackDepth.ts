import { ReversePolishNotationActionDict } from "./rpn.ohm-bundle";

export const rpnStackDepth = {
  number(digit) {
    return { max: 1, out: 1 };
  },

  Expr(expr) {
    return expr.stackDepth;
  },

  Sum(expr0, expr1, _plus) {
    return calculateStackDepth(expr0.stackDepth, expr1.stackDepth);
  },

  Mul(expr0, expr1, _asterisk) {
    return calculateStackDepth(expr0.stackDepth, expr1.stackDepth);
  },
} satisfies ReversePolishNotationActionDict<StackDepth>;
export type StackDepth = { max: number; out: number };

function calculateStackDepth(res0: StackDepth, res1: StackDepth): StackDepth {
  var max = Math.max(res0.max, res0.out + res1.max);
  var out = 1;

  return { max, out };
}