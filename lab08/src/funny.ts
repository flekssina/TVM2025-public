import * as arith from "../../lab04";


export interface Module {
    type: 'module';
    functions: FunctionDef[];
}


export interface FunctionDef {
    type: 'fun';
    name: string;
    parameters: ParameterDef[];
    returns: ParameterDef[];
    locals: ParameterDef[];
    requires?: Condition;
    ensures?: Condition;
    body: Statement;
}


export interface ParameterDef {
    type: "param";
    name: string;
    varType: VarType;
}


export type VarType = IntType | ArrayType;

export interface IntType {
    type: 'int';
}

export interface ArrayType {
    type: 'array';
    elementType: 'int';
}


export type Statement = Assignment | Conditional | Loop | Block;

export interface Assignment {
    type: 'assign';
    target: AssignTarget;
    value: Expr;
}

export type AssignTarget = 
    | { type: 'var'; name: string }
    | { type: 'array'; name: string; index: Expr }
    | { type: 'tuple'; names: string[] };

export interface Conditional {
    type: 'if';
    condition: Condition;
    thenBranch: Statement;
    elseBranch?: Statement;
}

export interface Loop {
    type: 'while';
    condition: Condition;
    invariant?: Condition;
    body: Statement;
}

export interface Block {
    type: 'block';
    statements: Statement[];
}

export type Expr = arith.Expr | FunctionCall | ArrayAccess;

export interface FunctionCall {
    type: 'call';
    name: string;
    args: Expr[];
}

export interface ArrayAccess {
    type: 'arrayAccess';
    name: string;
    index: Expr;
}

export type Condition = 
    | { type: 'true' }
    | { type: 'false' }
    | { type: 'comparison'; op: CompOp; left: Expr; right: Expr }
    | { type: 'not'; operand: Condition }
    | { type: 'and'; left: Condition; right: Condition }
    | { type: 'or'; left: Condition; right: Condition }
    | { type: 'implies'; left: Condition; right: Condition };

export type CompOp = '==' | '!=' | '<' | '>' | '<=' | '>=';