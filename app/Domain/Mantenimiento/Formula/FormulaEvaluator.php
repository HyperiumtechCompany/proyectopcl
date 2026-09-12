<?php

namespace App\Domain\Mantenimiento\Formula;

class FormulaEvaluator
{
    private array $trace = [];

    public function __construct(private readonly DecimalMath $math) {}

    public function evaluate(array $ast, FormulaContext $context): array
    {
        $this->trace = [];
        $value = $this->node($ast, $context);

        return ['value' => $value, 'references' => $this->trace];
    }

    private function node(array $node, FormulaContext $context): string
    {
        return match ($node['type']) {
            'number' => $this->math->normalize($node['value']),
            'reference' => $this->rowReference($node['key'], $context),
            'unary' => $node['operator'] === '-' ? $this->math->subtract('0', $this->node($node['value'], $context)) : $this->node($node['value'], $context),
            'percent' => $this->math->divide($this->node($node['value'], $context), '100'),
            'binary' => $this->binary($node, $context),
            'function' => $this->function($node, $context),
            'string' => throw new FormulaException('TYPE_ERROR', 'El texto solo puede usarse como identificador en una función.'),
            default => throw new FormulaException('PARSE_ERROR', 'Nodo de fórmula desconocido.'),
        };
    }

    private function binary(array $node, FormulaContext $context): string
    {
        $left = $this->node($node['left'], $context);
        $right = $this->node($node['right'], $context);

        return match ($node['operator']) {
            '+' => $this->math->add($left, $right),
            '-' => $this->math->subtract($left, $right),
            '*' => $this->math->multiply($left, $right),
            '/' => $this->math->divide($left, $right),
            '=', '==' => $this->boolean($this->math->compare($left, $right) === 0),
            '!=', '<>' => $this->boolean($this->math->compare($left, $right) !== 0),
            '<' => $this->boolean($this->math->compare($left, $right) < 0),
            '<=' => $this->boolean($this->math->compare($left, $right) <= 0),
            '>' => $this->boolean($this->math->compare($left, $right) > 0),
            '>=' => $this->boolean($this->math->compare($left, $right) >= 0),
            default => throw new FormulaException('PARSE_ERROR', 'Operador desconocido.'),
        };
    }

    private function function(array $node, FormulaContext $context): string
    {
        $arguments = $node['arguments'];

        return match ($node['name']) {
            'SUM' => $this->sum($arguments, $context),
            'MIN' => $this->minimum($arguments, $context),
            'MAX' => $this->maximum($arguments, $context),
            'ROUND' => $this->round($arguments, $context),
            'IF' => $this->conditional($arguments, $context),
            'CELL' => $this->cellReference($arguments, $context),
            'SUM_CHILDREN' => $this->childrenSum($arguments, $context),
            'SUM_COLUMN' => $this->columnSum($arguments, $context),
            default => throw new FormulaException('NAME_ERROR', "Función desconocida: {$node['name']}"),
        };
    }

    private function sum(array $arguments, FormulaContext $context): string
    {
        return array_reduce($arguments, fn (string $total, array $argument) => $this->math->add($total, $this->node($argument, $context)), '0');
    }

    private function minimum(array $arguments, FormulaContext $context): string
    {
        $this->requireCount($arguments, 1, null, 'MIN');
        $values = array_map(fn (array $argument) => $this->node($argument, $context), $arguments);

        return array_reduce(array_slice($values, 1), fn (string $minimum, string $value) => $this->math->compare($value, $minimum) < 0 ? $value : $minimum, $values[0]);
    }

    private function maximum(array $arguments, FormulaContext $context): string
    {
        $this->requireCount($arguments, 1, null, 'MAX');
        $values = array_map(fn (array $argument) => $this->node($argument, $context), $arguments);

        return array_reduce(array_slice($values, 1), fn (string $maximum, string $value) => $this->math->compare($value, $maximum) > 0 ? $value : $maximum, $values[0]);
    }

    private function round(array $arguments, FormulaContext $context): string
    {
        $this->requireCount($arguments, 2, 2, 'ROUND');
        $digits = $this->node($arguments[1], $context);
        if (! preg_match('/^\d+$/', $digits)) {
            throw new FormulaException('ARGUMENT_ERROR', 'Los decimales de ROUND deben ser un entero positivo.');
        }

        return $this->math->round($this->node($arguments[0], $context), (int) $digits);
    }

    private function conditional(array $arguments, FormulaContext $context): string
    {
        $this->requireCount($arguments, 3, 3, 'IF');
        $condition = $this->node($arguments[0], $context);

        return $this->node($this->math->compare($condition, '0') !== 0 ? $arguments[1] : $arguments[2], $context);
    }

    private function rowReference(string $key, FormulaContext $context): string
    {
        $value = ($context->rowValue)($key);
        $this->trace[] = ['type' => 'row', 'reference' => $key, 'value' => $value];

        return $value;
    }

    private function cellReference(array $arguments, FormulaContext $context): string
    {
        $this->requireCount($arguments, 1, 1, 'CELL');
        $cellId = $this->stringArgument($arguments[0], 'CELL');
        $value = ($context->cellValue)($cellId);
        $this->trace[] = ['type' => 'cell', 'reference' => $cellId, 'value' => $value];

        return $value;
    }

    private function childrenSum(array $arguments, FormulaContext $context): string
    {
        $this->requireCount($arguments, 1, 1, 'SUM_CHILDREN');
        $key = $this->referenceArgument($arguments[0], 'SUM_CHILDREN');
        $value = ($context->childrenSum)($key);
        $this->trace[] = ['type' => 'children', 'reference' => $key, 'value' => $value];

        return $value;
    }

    private function columnSum(array $arguments, FormulaContext $context): string
    {
        $this->requireCount($arguments, 2, 2, 'SUM_COLUMN');
        $sheetId = $this->stringArgument($arguments[0], 'SUM_COLUMN');
        $key = $this->referenceArgument($arguments[1], 'SUM_COLUMN');
        $value = ($context->columnSum)($sheetId, $key);
        $this->trace[] = ['type' => 'column', 'reference' => $sheetId.':'.$key, 'value' => $value];

        return $value;
    }

    private function stringArgument(array $argument, string $function): string
    {
        if ($argument['type'] !== 'string') {
            throw new FormulaException('ARGUMENT_ERROR', "{$function} requiere un identificador entre comillas.");
        }

        return $argument['value'];
    }

    private function referenceArgument(array $argument, string $function): string
    {
        if ($argument['type'] !== 'reference') {
            throw new FormulaException('ARGUMENT_ERROR', "{$function} requiere una referencia {columna}.");
        }

        return $argument['key'];
    }

    private function requireCount(array $arguments, int $minimum, ?int $maximum, string $function): void
    {
        if (count($arguments) < $minimum || ($maximum !== null && count($arguments) > $maximum)) {
            throw new FormulaException('ARGUMENT_ERROR', "Cantidad de argumentos inválida para {$function}.");
        }
    }

    private function boolean(bool $value): string
    {
        return $value ? '1' : '0';
    }
}
