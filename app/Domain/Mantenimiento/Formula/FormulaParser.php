<?php

namespace App\Domain\Mantenimiento\Formula;

class FormulaParser
{
    private array $tokens = [];

    private int $position = 0;

    public function parse(string $formula): array
    {
        $source = str_starts_with(trim($formula), '=') ? substr(trim($formula), 1) : trim($formula);
        if ($source === '') {
            throw new FormulaException('PARSE_ERROR', 'La fórmula está vacía.');
        }
        $this->tokens = $this->tokenize($source);
        $this->position = 0;
        $expression = $this->comparison();
        if ($this->current()['type'] !== 'eof') {
            throw new FormulaException('PARSE_ERROR', 'Hay contenido inesperado al final de la fórmula.');
        }

        return $expression;
    }

    private function comparison(): array
    {
        $node = $this->addition();
        while (in_array($this->current()['value'], ['=', '==', '!=', '<>', '<', '<=', '>', '>='], true)) {
            $operator = $this->advance()['value'];
            $node = ['type' => 'binary', 'operator' => $operator, 'left' => $node, 'right' => $this->addition()];
        }

        return $node;
    }

    private function addition(): array
    {
        $node = $this->multiplication();
        while (in_array($this->current()['value'], ['+', '-'], true)) {
            $operator = $this->advance()['value'];
            $node = ['type' => 'binary', 'operator' => $operator, 'left' => $node, 'right' => $this->multiplication()];
        }

        return $node;
    }

    private function multiplication(): array
    {
        $node = $this->unary();
        while (in_array($this->current()['value'], ['*', '/'], true)) {
            $operator = $this->advance()['value'];
            $node = ['type' => 'binary', 'operator' => $operator, 'left' => $node, 'right' => $this->unary()];
        }

        return $node;
    }

    private function unary(): array
    {
        if (in_array($this->current()['value'], ['+', '-'], true)) {
            return ['type' => 'unary', 'operator' => $this->advance()['value'], 'value' => $this->unary()];
        }
        $node = $this->primary();
        while ($this->current()['value'] === '%') {
            $this->advance();
            $node = ['type' => 'percent', 'value' => $node];
        }

        return $node;
    }

    private function primary(): array
    {
        $token = $this->advance();
        if ($token['type'] === 'number') {
            return ['type' => 'number', 'value' => $token['value']];
        }
        if ($token['type'] === 'reference') {
            return ['type' => 'reference', 'key' => $token['value']];
        }
        if ($token['type'] === 'string') {
            return ['type' => 'string', 'value' => $token['value']];
        }
        if ($token['value'] === '(') {
            $node = $this->comparison();
            $this->expect(')');

            return $node;
        }
        if ($token['type'] === 'identifier' && $this->current()['value'] === '(') {
            $this->advance();
            $arguments = [];
            if ($this->current()['value'] !== ')') {
                do {
                    $arguments[] = $this->comparison();
                    if ($this->current()['value'] !== ',') {
                        break;
                    }
                    $this->advance();
                } while (true);
            }
            $this->expect(')');

            return ['type' => 'function', 'name' => strtoupper($token['value']), 'arguments' => $arguments];
        }

        throw new FormulaException('PARSE_ERROR', 'Se esperaba un número, referencia o función.');
    }

    private function tokenize(string $source): array
    {
        $tokens = [];
        $length = strlen($source);
        for ($index = 0; $index < $length;) {
            $character = $source[$index];
            if (ctype_space($character)) {
                $index++;

                continue;
            }
            if (ctype_digit($character) || ($character === '.' && $index + 1 < $length && ctype_digit($source[$index + 1]))) {
                $start = $index++;
                while ($index < $length && (ctype_digit($source[$index]) || $source[$index] === '.')) {
                    $index++;
                }
                $value = substr($source, $start, $index - $start);
                if (! preg_match('/^(?:\d+(?:\.\d*)?|\.\d+)$/', $value)) {
                    throw new FormulaException('PARSE_ERROR', "Número inválido: {$value}.");
                }
                $tokens[] = ['type' => 'number', 'value' => $value];

                continue;
            }
            if ($character === '{') {
                $end = strpos($source, '}', $index + 1);
                if ($end === false) {
                    throw new FormulaException('PARSE_ERROR', 'Referencia sin llave de cierre.');
                }
                $key = substr($source, $index + 1, $end - $index - 1);
                if (! preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $key)) {
                    throw new FormulaException('PARSE_ERROR', "Referencia inválida: {$key}.");
                }
                $tokens[] = ['type' => 'reference', 'value' => $key];
                $index = $end + 1;

                continue;
            }
            if ($character === '"') {
                $end = strpos($source, '"', $index + 1);
                if ($end === false) {
                    throw new FormulaException('PARSE_ERROR', 'Texto sin comilla de cierre.');
                }
                $tokens[] = ['type' => 'string', 'value' => substr($source, $index + 1, $end - $index - 1)];
                $index = $end + 1;

                continue;
            }
            if (ctype_alpha($character) || $character === '_') {
                $start = $index++;
                while ($index < $length && (ctype_alnum($source[$index]) || $source[$index] === '_')) {
                    $index++;
                }
                $tokens[] = ['type' => 'identifier', 'value' => substr($source, $start, $index - $start)];

                continue;
            }
            $pair = substr($source, $index, 2);
            if (in_array($pair, ['<=', '>=', '<>', '!=', '=='], true)) {
                $tokens[] = ['type' => 'symbol', 'value' => $pair];
                $index += 2;

                continue;
            }
            if (str_contains('+-*/%(),=<>', $character)) {
                $tokens[] = ['type' => 'symbol', 'value' => $character];
                $index++;

                continue;
            }
            throw new FormulaException('PARSE_ERROR', "Carácter no permitido: {$character}.");
        }
        $tokens[] = ['type' => 'eof', 'value' => ''];

        return $tokens;
    }

    private function current(): array
    {
        return $this->tokens[$this->position];
    }

    private function advance(): array
    {
        return $this->tokens[$this->position++];
    }

    private function expect(string $value): void
    {
        if ($this->current()['value'] !== $value) {
            throw new FormulaException('PARSE_ERROR', "Se esperaba '{$value}'.");
        }
        $this->advance();
    }
}
