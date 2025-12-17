Funnier <:  Funny {
    // Переопределяем Module для поддержки определений формул
    Module := FormulaDef* Function+
    
    // Определения формул
    FormulaDef = "formula" ident "(" Params?  ")" "=" Predicate ";"
    
    // Переопределяем CondAtom для добавления кванторов и вызовов формул
    // ВАЖНО:  Quantifier должен идти ПЕРЕД FormulaCall! 
    CondAtom := "true"                              --true
             | "false"                             --false
             | Quantifier                          --quantifier
             | Comparison
             | FormulaCall                         --formulaCall
             | "(" Condition ")"                   --paren
    
    // Кванторы (для Grade B)
    Quantifier = QuantifierOp "(" ident ":" QuantifierType "|" Condition ")"  --parens
               | QuantifierOp ident ":" QuantifierDomain ":" Condition         --colon
    
    QuantifierOp = "forall" | "exists"
    
    QuantifierType = "int" "[" "]"  --array
                   | "int"          --int
    
    QuantifierDomain = RangeDomain | ArrayDomain
    
    // Диапазон для квантора:  0.. n, 0..length(arr)
    RangeDomain = Expr ". ." Expr
    
    // Массив для квантора:  array arr
    ArrayDomain = "array" ident
    
    // Вызов формулы (для Grade A) или length()
    // НЕ должен совпадать с QuantifierOp
    FormulaCall = ~QuantifierOp ident "(" ListOf<Expr, ","> ")"
    
    // Переопределяем Atom чтобы length() работал в выражениях
    Atom := LengthCall
          | FunctionCall
          | ArrayAccess
          | Paren
          | variable
          | number
    
    LengthCall = "length" "(" Expr ")"
    
    // Обновляем ключевые слова
    keyword := "if" | "else" | "while" | "returns" | "uses" 
            | "requires" | "ensures" | "invariant"
            | "true" | "false" | "not" | "and" | "or"
            | "int" | "formula" | "forall" | "exists" | "array" | "length"
}