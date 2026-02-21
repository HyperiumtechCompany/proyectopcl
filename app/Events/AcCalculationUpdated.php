<?php

namespace App\Events;

use App\Models\AcCalculation;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AcCalculationUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public AcCalculation $spreadsheet,
        public int $updatedBy,
        public string $updatedByName
    ) {}

    public function broadcastOn(): array
    {
        // Emitimos al canal privado específico de esta hoja
        return [
            new PrivateChannel('ac-calculation.' . $this->spreadsheet->id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'AcCalculationUpdated';
    }
}
