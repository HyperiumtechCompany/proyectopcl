<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Balance;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;


class BalanceController extends Controller
{
    public function index()
    {
        $balances = Balance::latest()->get();

        return Inertia::render('Balance/List', [
            'balances' => $balances
        ]);
    }
    public function store()
    {
        $balance = Balance::create([
            'nombre' => 'Nuevo Balance'
        ]);

        return redirect("/balance/{$balance->id}");
    }
    public function edit($id)
    {
        $balance = Balance::with('items')->findOrFail($id);

        return Inertia::render('Balance/Index', [
            'balance' => $balance,
            'rows' => $balance->items,
        ]);
    }


    public function update(Request $request, $id)
    {
        $balance = Balance::findOrFail($id);

        DB::beginTransaction();

        try {

            // borrar items anteriores
            $balance->items()->delete();

            $rows = $request->input('rows', []);

            foreach ($rows as $row) {

                // validación básica
                if (!isset($row['descripcion']) || trim($row['descripcion']) === '') {
                    continue;
                }

                // calcular total
                $total =
                    ($row['ene'] ?? 0) +
                    ($row['feb'] ?? 0) +
                    ($row['mar'] ?? 0) +
                    ($row['abr'] ?? 0) +
                    ($row['may'] ?? 0) +
                    ($row['jun'] ?? 0) +
                    ($row['jul'] ?? 0) +
                    ($row['ago'] ?? 0) +
                    ($row['set'] ?? 0) +
                    ($row['oct'] ?? 0) +
                    ($row['nov'] ?? 0) +
                    ($row['dic'] ?? 0);

                $balance->items()->create([
                    'tipo' => $row['tipo'] ?? 'gasto',
                    'categoria' => $row['categoria'] ?? null,
                    'descripcion' => $row['descripcion'],

                    'ene' => $row['ene'] ?? 0,
                    'feb' => $row['feb'] ?? 0,
                    'mar' => $row['mar'] ?? 0,
                    'abr' => $row['abr'] ?? 0,
                    'may' => $row['may'] ?? 0,
                    'jun' => $row['jun'] ?? 0,
                    'jul' => $row['jul'] ?? 0,
                    'ago' => $row['ago'] ?? 0,
                    'set' => $row['set'] ?? 0,
                    'oct' => $row['oct'] ?? 0,
                    'nov' => $row['nov'] ?? 0,
                    'dic' => $row['dic'] ?? 0,

                    'total' => $total,
                ]);
            }

            DB::commit();

            return response()->json([
                'ok' => true
            ]);

        } catch (\Throwable $e) {

            DB::rollBack();

            return response()->json([
                'ok' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }
    public function destroy($id)
    {
        $balance = Balance::findOrFail($id);
        $balance->delete();

        return redirect('/balance');
    }
}