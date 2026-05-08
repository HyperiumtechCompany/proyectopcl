import os

folders = [
    'metradoarquitectura', 'metradocomunicaciones', 'metradoelectricas', 
    'metradoestructuras', 'metradogas', 'metradosanitarias'
]
prefixes = [
    'arquitectura', 'comunicaciones', 'electricas', 
    'estructuras', 'gas', 'sanitarias'
]

helpers = """
const toNum = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const r4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const isZeroLike = (v: unknown): boolean => { if (v === null || v === undefined || v === '') return true; const n = Number(v); return Number.isFinite(n) && abs(n) < 0.0000001; };
const abs = Math.abs;
"""

for folder, prefix in zip(folders, prefixes):
    path = f'resources/js/pages/costos/metrados/{folder}/{prefix}_constants.ts'
    if not os.path.exists(path):
        continue
        
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    import_line = f"import {{ r4, toNum, isZeroLike }} from './{prefix}_utils';"
    
    if import_line in content:
        content = content.replace(import_line, helpers)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
            
print("Done")
