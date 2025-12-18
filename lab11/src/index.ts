import { ExportWrapper, compileModule } from "../../lab09";
import { parseFunnier } from "../../lab10";
import { verifyModule } from "./verifier";
import { Module } from "../../lab08";

export async function parseVerifyAndCompile(name: string, source: string): Promise<Record<string, Function>>
{
    const ast = parseFunnier(source);
    
    // Верифицируем
    await verifyModule(ast);
    
    // Конвертируем в базовый Module для компиляции
    const baseModule:  Module = {
        type: 'module',
        functions: ast.functions.map(f => ({
            type: 'fun' as const,
            name: f.name,
            parameters: f.parameters,
            returns: f.returns,
            locals: f.locals,
            requires: undefined,
            ensures: undefined,
            body: f.body
        }))
    };
    
    const mod = await compileModule(baseModule, name);
    return new ExportWrapper(mod);
}