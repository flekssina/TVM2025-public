Funny <: Arithmetic {

    Module = Function+
    

    Function = ident "(" Params? ")" 
               ("requires" Predicate)? 
               "returns" Params 
               ("ensures" Predicate)? 
               ("uses" LocalsList)? 
               Statement
    
  
    Params = ParamDef ("," ParamDef)*
    ParamDef = ident ":" VarType
    
   
    LocalsList = LocalDef ("," LocalDef)*
    LocalDef = ident ":" "int"
    
  
    VarType = "int" ("[" "]")?
    
    // Операторы
    Statement = Assignment
              | Conditional
              | Loop
              | Block
    
    //присваивание(три формы)
    Assignment = ArrayAccess "=" Expr ";"                      --array
               | ident ("," ident)+ "=" FunctionCall ";"       --tuple
               | ident "=" Expr ";"                            --simple
    
    
    Conditional = "if" "(" Condition ")" Statement ("else" Statement)?
    
    
    Loop = "while" "(" Condition ")" ("invariant" Predicate)? Statement
    
   
    Block = "{" Statement* "}"
    
    // Выражения
    Atom := FunctionCall
          | ArrayAccess
          | Paren
          | variable
          | number
    
   
    FunctionCall = ident "(" ListOf<Expr, ","> ")"
    
  
    ArrayAccess = ident "[" Expr "]"
    
   
    Expr = Sum
    
    
    Condition = CondImply
    
    CondImply = CondOr ("->" CondImply)?
    
    CondOr = CondAnd ("or" CondAnd)*
    
    CondAnd = CondNot ("and" CondNot)*
    
    CondNot = "not" CondNot  --not
            | CondAtom
    
    CondAtom = "true"                     --true
             | "false"                    --false
             | Comparison
             | "(" Condition ")"          --paren
    
   
    Comparison = Expr CompOp Expr
    CompOp = "==" | "!=" | "<=" | ">=" | "<" | ">"
    
   
    Predicate = Condition
    
   
    ident = ~keyword letter alnum*
    
    keyword = "if" | "else" | "while" | "returns" | "uses" 
            | "requires" | "ensures" | "invariant"
            | "true" | "false" | "not" | "and" | "or"
            | "int"
    

    space += comment
    comment = "//" (~("\n" | "\r") any)* ("\n" | "\r" | end)
}