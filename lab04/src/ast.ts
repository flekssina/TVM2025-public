
export type Expr = | NumberLiteral | Variable | BinaryOp | UnaryOp;

export interface NumberLiteral {
  type: 'number';
  value: number;
}

export interface Variable {
  type: 'variable';
  name: string;
}

export interface BinaryOp {
  type: 'binary';
  operator: '+' | '-' | '*' | '/' | '^';
  left: Expr;
  right: Expr;
}


export interface UnaryOp {
  type: 'unary';
  operator: '+' | '-';
  operand: Expr;
}

export function createNumber(value: number): NumberLiteral {
  return { type: 'number', value };
}

export function createVariable(name: string): Variable {
  return { type: 'variable', name };
}

export function createBinaryOp(operator: '+' | '-' | '*' | '/' | '^', left: Expr, right: Expr): BinaryOp {
  return { type: 'binary', operator, left, right };
}

export function createUnaryOp(operator: '+' | '-', operand: Expr): UnaryOp {
  return { type: 'unary', operator, operand };
}