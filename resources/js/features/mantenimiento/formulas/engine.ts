import Decimal from 'decimal.js';

const MoneyDecimal = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_DOWN });
const SCALE = 10;

type Node =
    | { type: 'number'; value: string }
    | { type: 'reference'; key: string }
    | { type: 'string'; value: string }
    | { type: 'unary'; operator: '+' | '-'; value: Node }
    | { type: 'percent'; value: Node }
    | { type: 'binary'; operator: string; left: Node; right: Node }
    | { type: 'function'; name: string; arguments: Node[] };

interface Token { type: 'number' | 'reference' | 'string' | 'identifier' | 'symbol' | 'eof'; value: string }

export interface FormulaContext {
    rowValue: (key: string) => string;
    cellValue: (id: string) => string;
    childrenSum: (key: string) => string;
    columnSum: (sheetId: string, key: string) => string;
}

export interface FormulaEvaluation {
    value: string;
    references: Array<{ type: string; reference: string; value: string }>;
}

export class FormulaError extends Error {
    constructor(public readonly code: string, message: string) {
        super(message);
    }
}

const decimal = (value: Decimal.Value) => new MoneyDecimal(value).toDecimalPlaces(SCALE, Decimal.ROUND_DOWN);
const normalized = (value: Decimal.Value) => {
    const result = decimal(String(value));
    return result.isZero() ? '0' : result.toFixed(SCALE).replace(/\.?0+$/, '');
};

class Parser {
    private position = 0;
    private readonly tokens: Token[];

    constructor(formula: string) {
        const source = formula.trim().replace(/^=/, '').trim();
        if (!source) throw new FormulaError('PARSE_ERROR', 'La fórmula está vacía.');
        this.tokens = this.tokenize(source);
    }

    parse(): Node {
        const node = this.comparison();
        if (this.current().type !== 'eof') throw new FormulaError('PARSE_ERROR', 'Contenido inesperado al final.');
        return node;
    }

    private comparison(): Node {
        let node = this.addition();
        while (['=', '==', '!=', '<>', '<', '<=', '>', '>='].includes(this.current().value)) {
            node = { type: 'binary', operator: this.advance().value, left: node, right: this.addition() };
        }
        return node;
    }

    private addition(): Node {
        let node = this.multiplication();
        while (['+', '-'].includes(this.current().value)) {
            node = { type: 'binary', operator: this.advance().value, left: node, right: this.multiplication() };
        }
        return node;
    }

    private multiplication(): Node {
        let node = this.unary();
        while (['*', '/'].includes(this.current().value)) {
            node = { type: 'binary', operator: this.advance().value, left: node, right: this.unary() };
        }
        return node;
    }

    private unary(): Node {
        if (['+', '-'].includes(this.current().value)) {
            return { type: 'unary', operator: this.advance().value as '+' | '-', value: this.unary() };
        }
        let node = this.primary();
        while (this.current().value === '%') {
            this.advance();
            node = { type: 'percent', value: node };
        }
        return node;
    }

    private primary(): Node {
        const token = this.advance();
        if (token.type === 'number') return { type: 'number', value: token.value };
        if (token.type === 'reference') return { type: 'reference', key: token.value };
        if (token.type === 'string') return { type: 'string', value: token.value };
        if (token.value === '(') {
            const node = this.comparison();
            this.expect(')');
            return node;
        }
        if (token.type === 'identifier' && this.current().value === '(') {
            this.advance();
            const args: Node[] = [];
            if (this.current().value !== ')') {
                do {
                    args.push(this.comparison());
                    if (this.current().value !== ',') break;
                    this.advance();
                } while (true);
            }
            this.expect(')');
            return { type: 'function', name: token.value.toUpperCase(), arguments: args };
        }
        throw new FormulaError('PARSE_ERROR', 'Se esperaba un número, referencia o función.');
    }

    private tokenize(source: string): Token[] {
        const result: Token[] = [];
        let index = 0;
        while (index < source.length) {
            const rest = source.slice(index);
            const whitespace = rest.match(/^\s+/);
            if (whitespace) { index += whitespace[0].length; continue; }
            const reference = rest.match(/^\{([A-Za-z_][A-Za-z0-9_]*)\}/);
            if (reference) { result.push({ type: 'reference', value: reference[1] }); index += reference[0].length; continue; }
            const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
            if (number) { result.push({ type: 'number', value: number[0] }); index += number[0].length; continue; }
            const string = rest.match(/^"([^"\\]*)"/);
            if (string) { result.push({ type: 'string', value: string[1] }); index += string[0].length; continue; }
            const identifier = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/);
            if (identifier) { result.push({ type: 'identifier', value: identifier[0] }); index += identifier[0].length; continue; }
            const pair = rest.slice(0, 2);
            if (['<=', '>=', '<>', '!=', '=='].includes(pair)) { result.push({ type: 'symbol', value: pair }); index += 2; continue; }
            if ('+-*/%(),=<>'.includes(source[index])) { result.push({ type: 'symbol', value: source[index++] }); continue; }
            throw new FormulaError('PARSE_ERROR', `Carácter no permitido: ${source[index]}.`);
        }
        result.push({ type: 'eof', value: '' });
        return result;
    }

    private current() { return this.tokens[this.position]; }
    private advance() { return this.tokens[this.position++]; }
    private expect(value: string) {
        if (this.current().value !== value) throw new FormulaError('PARSE_ERROR', `Se esperaba '${value}'.`);
        this.advance();
    }
}

export function rowReferences(formula: string): string[] {
    const found = new Set<string>();
    const visit = (node: Node) => {
        if (node.type === 'reference') found.add(node.key);
        else if (node.type === 'binary') { visit(node.left); visit(node.right); }
        else if (node.type === 'unary' || node.type === 'percent') visit(node.value);
        else if (node.type === 'function' && !['CELL', 'SUM_CHILDREN', 'SUM_COLUMN'].includes(node.name)) node.arguments.forEach(visit);
    };
    visit(new Parser(formula).parse());
    return [...found];
}

export function evaluateFormula(formula: string, context: FormulaContext, outputScale = 2): FormulaEvaluation {
    const trace: FormulaEvaluation['references'] = [];
    const requireCount = (args: Node[], min: number, max: number | null, name: string) => {
        if (args.length < min || (max !== null && args.length > max)) throw new FormulaError('ARGUMENT_ERROR', `Cantidad de argumentos inválida para ${name}.`);
    };
    const referenceArg = (node: Node, name: string) => {
        if (node.type !== 'reference') throw new FormulaError('ARGUMENT_ERROR', `${name} requiere una referencia {columna}.`);
        return node.key;
    };
    const stringArg = (node: Node, name: string) => {
        if (node.type !== 'string') throw new FormulaError('ARGUMENT_ERROR', `${name} requiere un identificador entre comillas.`);
        return node.value;
    };
    const calculate = (node: Node): string => {
        if (node.type === 'number') return normalized(node.value);
        if (node.type === 'string') throw new FormulaError('TYPE_ERROR', 'El texto solo puede identificar una referencia.');
        if (node.type === 'reference') {
            const value = context.rowValue(node.key); trace.push({ type: 'row', reference: node.key, value }); return value;
        }
        if (node.type === 'unary') return node.operator === '-' ? normalized(decimal(0).minus(decimal(calculate(node.value)))) : calculate(node.value);
        if (node.type === 'percent') return normalized(decimal(calculate(node.value)).div(100));
        if (node.type === 'binary') {
            const left = decimal(calculate(node.left));
            const right = decimal(calculate(node.right));
            if (node.operator === '/' && right.isZero()) throw new FormulaError('DIV_ZERO', 'No se puede dividir entre cero.');
            const arithmetic: Record<string, () => Decimal> = {
                '+': () => left.plus(right), '-': () => left.minus(right), '*': () => left.times(right), '/': () => left.div(right),
            };
            if (arithmetic[node.operator]) return normalized(arithmetic[node.operator]());
            const compared = left.comparedTo(right);
            return ['=', '=='].includes(node.operator) ? (compared === 0 ? '1' : '0')
                : ['!=', '<>'].includes(node.operator) ? (compared !== 0 ? '1' : '0')
                    : node.operator === '<' ? (compared < 0 ? '1' : '0')
                        : node.operator === '<=' ? (compared <= 0 ? '1' : '0')
                            : node.operator === '>' ? (compared > 0 ? '1' : '0') : (compared >= 0 ? '1' : '0');
        }
        const args = node.arguments;
        if (node.name === 'SUM') return normalized(args.reduce((sum, item) => sum.plus(calculate(item)), decimal(0)));
        if (node.name === 'MIN' || node.name === 'MAX') {
            requireCount(args, 1, null, node.name);
            return normalized(args.map(calculate).reduce((chosen, value) => node.name === 'MIN'
                ? (decimal(value).lessThan(chosen) ? decimal(value) : chosen)
                : (decimal(value).greaterThan(chosen) ? decimal(value) : chosen), decimal(calculate(args[0]))));
        }
        if (node.name === 'ROUND') {
            requireCount(args, 2, 2, node.name);
            const digits = calculate(args[1]);
            if (!/^\d+$/.test(digits) || Number(digits) > SCALE) throw new FormulaError('ARGUMENT_ERROR', 'ROUND acepta entre 0 y 10 decimales.');
            return normalized(decimal(calculate(args[0])).toDecimalPlaces(Number(digits), Decimal.ROUND_HALF_UP));
        }
        if (node.name === 'IF') { requireCount(args, 3, 3, node.name); return calculate(decimal(calculate(args[0])).isZero() ? args[2] : args[1]); }
        if (node.name === 'CELL') {
            requireCount(args, 1, 1, node.name); const id = stringArg(args[0], node.name); const value = context.cellValue(id);
            trace.push({ type: 'cell', reference: id, value }); return value;
        }
        if (node.name === 'SUM_CHILDREN') {
            requireCount(args, 1, 1, node.name); const key = referenceArg(args[0], node.name); const value = context.childrenSum(key);
            trace.push({ type: 'children', reference: key, value }); return value;
        }
        if (node.name === 'SUM_COLUMN') {
            requireCount(args, 2, 2, node.name); const sheet = stringArg(args[0], node.name); const key = referenceArg(args[1], node.name); const value = context.columnSum(sheet, key);
            trace.push({ type: 'column', reference: `${sheet}:${key}`, value }); return value;
        }
        throw new FormulaError('NAME_ERROR', `Función desconocida: ${node.name}`);
    };

    const raw = calculate(new Parser(formula).parse());
    return { value: decimal(raw).toDecimalPlaces(outputScale, Decimal.ROUND_HALF_UP).toFixed(outputScale), references: trace };
}
