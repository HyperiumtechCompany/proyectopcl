import { router, usePage } from '@inertiajs/react';
import React from 'react';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Pencil } from 'lucide-react';

type Balance = {
  id: number;
  nombre: string;
  created_at: string;
};

export default function BalanceList() {
  const page = usePage<{ balances: Pick<Balance, 'id' | 'nombre' | 'created_at'>[] }>();
  const balances = page.props.balances;

  const createNew = () => {
    router.post('/balance');
  };

  const openBalance = (id: number) => {
    router.get(`/balance/${id}`);
  };

  const deleteBalance = (id: number) => {
    if (!confirm('¿Eliminar este balance?')) return;

    router.delete(`/balance/${id}`, {
      onSuccess: () => {
        // recarga automática
      },
    });
  };

  return (
    <AppLayout breadcrumbs={[
      { title: 'Balance', href: '/balance' }
    ]}>
      <div className="p-6 space-y-6">

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Balances</h1>

          <Button onClick={createNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Balance
          </Button>
        </div>

        {/* TABLE */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-gray-800">
              <tr>
                <th className="text-left p-3">Nombre</th>
                <th className="text-left p-3">Fecha</th>
                <th className="text-right p-3">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {balances.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center p-6 text-slate-400">
                    No hay balances aún
                  </td>
                </tr>
              )}

              {balances.map((b) => (
                <tr
                  key={b.id}
                  className="border-t hover:bg-slate-50 dark:hover:bg-gray-800"
                >
                  <td className="p-3 font-medium">{b.nombre}</td>
                  <td className="p-3 text-slate-500">{b.created_at}</td>

                  <td className="p-3">
                    <div className="flex justify-end gap-2">

                      {/* EDITAR */}
                      <button
                        onClick={() => openBalance(b.id)}
                        className="p-2 rounded hover:bg-blue-100 text-blue-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      {/* ELIMINAR */}
                      <button
                        onClick={() => deleteBalance(b.id)}
                        className="p-2 rounded hover:bg-red-100 text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </AppLayout>
  );
}