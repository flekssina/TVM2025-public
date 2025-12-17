import { Module as BaseModule, FunctionDef, Condition, Expr, ParameterDef } from '../../lab08';

// Не расширяем Module напрямую, создаем свой тип
export interface AnnotatedModule {
    type: 'module';
    formulas: FormulaDef[];
    functions: AnnotatedFunctionDef[];
}

export interface FormulaDef {
    type: 'formula';
    name: string;
    parameters: ParameterDef[];
    body: AnnotatedCondition;
}

export interface AnnotatedFunctionDef extends Omit<FunctionDef, 'requires' | 'ensures'> {
    requires?:  AnnotatedCondition;
    ensures?: AnnotatedCondition;
}

// Расширяем типы условий для кванторов и вызовов формул
export type AnnotatedCondition = 
    | Condition  // базовые условия из lab08
    | Quantifier
    | FormulaCall;

export interface Quantifier {
    type: 'quantifier';
    operator: 'forall' | 'exists';
    variable: string;
    domain:  QuantifierDomain | 'int' | 'int[]';  // поддержка обоих синтаксисов
    condition: AnnotatedCondition;
}

export type QuantifierDomain = RangeDomain | ArrayDomain;

export interface RangeDomain {
    type: 'range';
    from: Expr;
    to:  Expr;
}

export interface ArrayDomain {
    type:  'arrayDomain';
    arrayName: string;
}

export interface FormulaCall {
    type: 'formulaCall';
    name: string;
    args: Expr[];
}

// Добавляем LengthCall как выражение
export interface LengthCall {
    type: 'lengthCall';
    array:  Expr;
}