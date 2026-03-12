<?php

namespace App\Events;

use App\Models\MetradoComunicacionSpreadsheet;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ComunicacionSpreadsheetUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly MetradoComunicacionSpreadsheet $spreadsheet,
        public readonly int $updatedBy,
        public readonly string $updatedByName,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("spreadsheet.{$this->spreadsheet->id}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'spreadsheet.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'sheet_data'       => $this->spreadsheet->sheet_data,
            'updated_by'       => $this->updatedBy,
            'updated_by_name'  => $this->updatedByName,
            'updated_at'       => now()->toIso8601String(),
        ];
    }
}
