<?php

namespace App\Events;

use App\Models\CaidaTensionSpreadsheet;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SpreadsheetUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly CaidaTensionSpreadsheet $spreadsheet,
        public readonly int $updatedBy,
        public readonly string $updatedByName,
    ) {}

    /**
     * Canal privado por spreadsheet. Solo usuarios autorizados pueden suscribirse.
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("spreadsheet.{$this->spreadsheet->id}"),
        ];
    }

    /**
     * Nombre del evento en el frontend (snake_case por convención Pusher).
     */
    public function broadcastAs(): string
    {
        return 'spreadsheet.updated';
    }

    /**
     * Solo enviar los datos necesarios para sincronizar el estado del frontend.
     */
    public function broadcastWith(): array
    {
        return [
            'td_data'          => $this->spreadsheet->td_data,
            'tg_data'          => $this->spreadsheet->tg_data,
            'selection_data'   => $this->spreadsheet->selection_data,
            'updated_by'       => $this->updatedBy,
            'updated_by_name'  => $this->updatedByName,
            'updated_at'       => now()->toIso8601String(),
        ];
    }
}
