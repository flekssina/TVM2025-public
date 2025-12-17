import { MatchResult, Semantics, Node } from 'ohm-js';

import grammar from './funnier.ohm-bundle';

import { AnnotatedModule, FormulaDef, Quantifier, QuantifierDomain, FormulaCall, AnnotatedCondition, AnnotatedFunctionDef, LengthCall } from './funnier';
import { FunnyError } from '../../lab08';

const getFunnierAst: any = {
    Module(this: Node, formulas: any, functions: any) {
        return {
            type: 'module',
            formulas: formulas. children.map((f: any) => f.parse()),
            functions: functions.children.map((f: any) => f.parse())
        };
    },
    
    FormulaDef(this: Node, 
        _formula: any, 
        name: any, 
        _lp: any, 
        params: any, 
        _rp: any, 
        _eq: any, 
        body:  any, 
        _semi: any
    ) {
        return {
            type: 'formula',
            name: name.parse(),
            parameters: params.numChildren > 0 ? params. child(0).parse() : [],
            body: body.parse()
        };
    },
    
    Function(this: Node, 
        name: any,
        _lp: any,
        params:  any,
        _rp:  any,
        _reqKw: any,
        req: any,
        _retKw: any,
        returns: any,
        _ensKw: any,
        ens: any,
        _usesKw: any,
        locals: any,
        body: any
    ) {
        return {
            type: 'fun',
            name: name.parse(),
            parameters: params.numChildren > 0 ? params. child(0).parse() : [],
            returns: returns.parse(),
            locals: locals.numChildren > 0 ? locals.child(0).parse() : [],
            requires: req.numChildren > 0 ? req.child(0).child(0).parse() : undefined,
            ensures: ens. numChildren > 0 ? ens.child(0).child(0).parse() : undefined,
            body: body.parse()
        };
    },
    
    Predicate(this: Node, cond: any) {
        return cond.parse();
    },
    
    Condition(this: Node, impl: any) {
        return impl.parse();
    },
    
    CondImply(this: Node, left:  any, _arrow: any, right: any) {
        if (right.numChildren === 0) {
            return left.parse();
        }
        return {
            type: 'implies',
            left: left.parse(),
            right: right.child(0).parse()
        };
    },
    
    CondOr(this: Node, first:  any, _or: any, rest: any) {
        let result = first.parse();
        for (const r of rest.children) {
            result = {
                type: 'or',
                left: result,
                right:  r.parse()
            };
        }
        return result;
    },
    
    CondAnd(this: Node, first: any, _and: any, rest: any) {
        let result = first.parse();
        for (const r of rest.children) {
            result = {
                type: 'and',
                left: result,
                right: r.parse()
            };
        }
        return result;
    },
    
    CondNot_not(this: Node, _not: any, operand: any) {
        return {
            type: 'not',
            operand: operand.parse()
        };
    },
    
    CondNot(this: Node, atom: any) {
        return atom.parse();
    },
    
    CondAtom_true(this: Node, _true: any) {
        return { type: 'true' };
    },
    
    CondAtom_false(this: Node, _false: any) {
        return { type:  'false' };
    },
    
    CondAtom_quantifier(this: Node, quantifier: any) {
        return quantifier.parse();
    },
    
    CondAtom_formulaCall(this: Node, call: any) {
        return call.parse();
    },
    
    CondAtom_paren(this: Node, _lp: any, cond: any, _rp:  any) {
        return cond.parse();
    },
    
    CondAtom(this: Node, node: any) {
        return node.parse();
    },
    
    Quantifier_parens(this:  Node, 
        op: any, 
        _lp: any,
        variable: any, 
        _colon: any, 
        type: any,
        _pipe: any,
        condition: any,
        _rp: any
    ) {
        return {
            type: 'quantifier',
            operator: op.parse(),
            variable: variable.parse(),
            domain: type.parse(),
            condition: condition.parse()
        };
    },
    
    Quantifier_colon(this:  Node, 
        op: any, 
        variable: any, 
        _colon1: any, 
        domain: any, 
        _colon2: any, 
        condition: any
    ) {
        return {
            type: 'quantifier',
            operator: op.parse(),
            variable: variable.parse(),
            domain: domain.parse(),
            condition: condition.parse()
        };
    },
    
    QuantifierOp(this: Node, op: any) {
        return op.sourceString as 'forall' | 'exists';
    },
    
    QuantifierType_int(this: Node, _int: any) {
        return 'int';
    },
    
    QuantifierType_array(this: Node, _int: any, _lb: any, _rb:  any) {
        return 'int[]';
    },
    
    QuantifierDomain(this: Node, domain:  any) {
        return domain. parse();
    },
    
    RangeDomain(this: Node, from: any, _dots: any, to: any) {
        return {
            type:  'range',
            from:  from.parse(),
            to: to.parse()
        };
    },
    
    ArrayDomain(this: Node, _array: any, arrayName: any) {
        return {
            type: 'arrayDomain',
            arrayName:  arrayName.parse()
        };
    },
    
    FormulaCall(this: Node, name: any, _lp:  any, args: any, _rp: any) {
        return {
            type: 'formulaCall',
            name: name.parse(),
            args: args.asIteration().children.map((a: any) => a.parse())
        };
    },
    
    LengthCall(this: Node, _length: any, _lp: any, array: any, _rp: any) {
        return {
            type: 'lengthCall',
            array: array.parse()
        };
    },
    
    Comparison(this: Node, left: any, op: any, right: any) {
        return {
            type: 'comparison',
            op: op.sourceString,
            left: left.parse(),
            right: right.parse()
        };
    },
    
    // Наследуем правила из Funny
    Params(this: Node, first: any, _comma: any, rest: any) {
        return [first. parse(), ...rest.children.map((p: any) => p.parse())];
    },
    
    ParamDef(this: Node, name:  any, _colon: any, type: any) {
        return {
            type: 'param',
            name: name.parse(),
            varType: type.parse()
        };
    },
    
    LocalsList(this: Node, first: any, _comma: any, rest: any) {
        return [first.parse(), ...rest.children.map((l: any) => l.parse())];
    },
    
    LocalDef(this: Node, name:  any, _colon: any, _int: any) {
        return {
            type: 'param',
            name: name.parse(),
            varType: { type: 'int' }
        };
    },
    
    VarType(this: Node, _int: any, _lb: any, _rb: any) {
        if (_lb.numChildren > 0) {
            return { type: 'array', elementType: 'int' };
        }
        return { type: 'int' };
    },
    
    Statement(this: Node, stmt: any) {
        return stmt.parse();
    },
    
    Assignment_simple(this: Node, target: any, _eq: any, value: any, _semi: any) {
        return {
            type: 'assign',
            target: { type: 'var', name: target.parse() },
            value: value.parse()
        };
    },
    
    Assignment_array(this: Node, arrayAccess: any, _eq:  any, value: any, _semi: any) {
        const access = arrayAccess.parse();
        return {
            type: 'assign',
            target: { 
                type: 'array', 
                name: access.name, 
                index: access.index 
            },
            value:  value.parse()
        };
    },
    
    Assignment_tuple(this: Node, first: any, _comma: any, rest: any, _eq: any, call: any, _semi: any) {
        return {
            type: 'assign',
            target: {
                type: 'tuple',
                names: [first.parse(), ...rest.children.map((n: any) => n.parse())]
            },
            value:  call.parse()
        };
    },
    
    Conditional(this: Node, _if:  any, _lp: any, cond:  any, _rp: any, thenBranch: any, _else: any, elseBranch: any) {
        return {
            type: 'if',
            condition: cond. parse(),
            thenBranch: thenBranch. parse(),
            elseBranch: elseBranch.numChildren > 0 ? elseBranch.child(0).parse() : undefined
        };
    },
    
    Loop(this: Node, _while: any, _lp: any, cond: any, _rp: any, _invKw: any, inv: any, body: any) {
        return {
            type:  'while',
            condition: cond. parse(),
            invariant: inv.numChildren > 0 ? inv.child(0).parse() : undefined,
            body: body.parse()
        };
    },
    
    Block(this: Node, _lb: any, statements: any, _rb: any) {
        return {
            type: 'block',
            statements: statements.children.map((s: any) => s.parse())
        };
    },
    
    FunctionCall(this: Node, name: any, _lp: any, args: any, _rp: any) {
        return {
            type: 'call',
            name: name.parse(),
            args: args.asIteration().children.map((a: any) => a.parse())
        };
    },
    
    ArrayAccess(this:  Node, name: any, _lb: any, index: any, _rb: any) {
        return {
            type: 'arrayAccess',
            name: name.parse(),
            index: index.parse()
        };
    },
    
    Expr(this: Node, sum: any) {
        return sum.parse();
    },
    
    Sum(this: Node, first: any, _op: any, rest: any) {
        let result = first.parse();
        const ops = _op.children;
        const operands = rest.children;
        
        for (let i = 0; i < ops. length; i++) {
            result = {
                type: 'binary',
                operator: ops[i].sourceString,
                left: result,
                right: operands[i].parse()
            };
        }
        return result;
    },
    
    Mul(this: Node, first: any, _op: any, rest:  any) {
        let result = first.parse();
        const ops = _op.children;
        const operands = rest.children;
        
        for (let i = 0; i < ops. length; i++) {
            result = {
                type: 'binary',
                operator: ops[i].sourceString,
                left: result,
                right: operands[i].parse()
            };
        }
        return result;
    },
    
    Neg_neg(this: Node, _op: any, operand: any) {
        return {
            type: 'unary',
            operator: '-',
            operand: operand.parse()
        };
    },
    
    Neg(this: Node, atom: any) {
        return atom.parse();
    },
    
    Atom(this: Node, node: any) {
        return node.parse();
    },
    
    Paren(this:  Node, _lp: any, expr: any, _rp:  any) {
        return expr. parse();
    },
    
    variable(this: Node, _first: any, _rest: any) {
        return {
            type: 'variable',
            name: this.sourceString
        };
    },
    
    number(this: Node, _digits: any): any {
        return {
            type: 'number',
            value: parseInt(this.sourceString, 10)
        };
    },
    
    ident(this: Node, _first: any, _rest: any): string {
        return this.sourceString;
    },
    
    _terminal(this: Node): string {
        return this.sourceString;
    },
    
    _iter(this: Node, ... children: any[]): any[] {
        return children. map((c: any) => c.parse());
    }
};

export const semantics:  FunnySemanticsExt = grammar. Funnier.createSemantics() as FunnySemanticsExt;
semantics.addOperation("parse()", getFunnierAst);

export interface FunnySemanticsExt extends Semantics
{
    (match: MatchResult): FunnyActionsExt
}

interface FunnyActionsExt 
{
    parse(): AnnotatedModule;
}

export function parseFunnier(source: string, origin?: string): AnnotatedModule
{
    const match = grammar.Funnier.match(source, 'Module');
    
    if (match. failed()) {
        throw new FunnyError(
            `Syntax error:  ${match.message}`,
            'SYNTAX_ERROR'
        );
    }
    
    const sem = semantics(match);
    const module = sem.parse();
    
    return module;
}