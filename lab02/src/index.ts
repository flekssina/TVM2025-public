import { match } from "assert";
import grammar from "./rpn.ohm-bundle";
import { rpnSemantics } from "./semantics";

export function evaluate(source: string): number {
  var res = grammar.match(source);

  if (res.failed()) {
    throw new SyntaxError(res.shortMessage);
  }

  return rpnSemantics(res).calculate();
}

export function maxStackDepth(source: string): number {
  var res = grammar.match(source);

  if (res.failed()) {
    throw new SyntaxError(res.shortMessage);
  }

  var resStackDepth = rpnSemantics(res).stackDepth;

  if (resStackDepth.out != 1) {
    throw new SyntaxError();
  }

  return resStackDepth.max;
}

export class SyntaxError extends Error {}