<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class AccountCredentialsMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public string $plainPassword,
    ) {}

    public function build(): self
    {
        return $this
            ->subject('Tu cuenta en PCL está lista')
            ->view('emails.account-credentials', [
                'user' => $this->user,
                'plainPassword' => $this->plainPassword,
                'loginUrl' => route('login'),
            ]);
    }
}
