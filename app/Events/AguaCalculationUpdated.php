<?php

namespace App\Events;

use App\Models\AguaCalculation;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AguaCalculationUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly AguaCalculation $spreadsheet,
        public readonly int $updatedBy,
        public readonly string $updatedByName,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("agua-calculation.{$this->spreadsheet->id}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'spreadsheet.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'data_sheet'       => $this->spreadsheet->data_sheet,
            'updated_by'       => $this->updatedBy,
            'updated_by_name'  => $this->updatedByName,
            'updated_at'       => now()->toIso8601String(),
            // Ensure payload has same structure
            'selection_data'   => [
                'data_sheet' => $this->spreadsheet->data_sheet
            ],
        ];
    }
}
