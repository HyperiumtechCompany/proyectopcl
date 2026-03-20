<?php

namespace App\Events;

use App\Models\MetradoElectricasSpreadsheet;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ElectricasSpreadsheetUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public MetradoElectricasSpreadsheet $spreadsheet,
        public int $updatedBy,
        public string $updatedByName
    ) {}

    public function broadcastOn(): Channel
    {
        return new Channel('metrado-electricas.' . $this->spreadsheet->id);
    }

    public function broadcastAs(): string
    {
        return 'updated';
    }
}
