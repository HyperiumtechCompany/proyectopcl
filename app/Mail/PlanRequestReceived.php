<?php

namespace App\Mail;

use App\Models\PlanRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class PlanRequestReceived extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public PlanRequest $planRequest) {}

    public function build(): self
    {
        return $this
            ->subject("Nueva solicitud de plan: {$this->planRequest->nombre} ({$this->planRequest->plan})")
            ->view('emails.plan-request-received', [
                'planRequest' => $this->planRequest,
                'comprobanteUrl' => $this->planRequest->comprobante_path
                    ? asset('storage/'.$this->planRequest->comprobante_path)
                    : null,
            ]);
    }
}
