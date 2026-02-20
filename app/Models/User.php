<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, TwoFactorAuthenticatable, HasRoles;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'phone',
        'avatar',
        'dni',
        'position',
        'plan',
        'plan_expires_at',
        'status',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'plan_expires_at' => 'datetime',
        ];
    }

    /**
     * Check if the user account is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Check if the user has an active plan.
     */
    public function hasActivePlan(): bool
    {
        if ($this->plan === 'lifetime') {
            return true;
        }

        if ($this->plan === 'free' && $this->plan_expires_at) {
            return $this->plan_expires_at->isFuture();
        }

        if (in_array($this->plan, ['mensual', 'anual']) && $this->plan_expires_at) {
            return $this->plan_expires_at->isFuture();
        }

        return false;
    }

    /**
     * Get a human-readable label for the plan expiration.
     */
    public function planExpiresLabel(): string
    {
        return match ($this->plan) {
            'lifetime' => 'De por vida',
            'free' => $this->plan_expires_at
                ? 'Prueba hasta ' . $this->plan_expires_at->format('d/m/Y')
                : 'Sin fecha',
            'mensual', 'anual' => $this->plan_expires_at
                ? 'Hasta ' . $this->plan_expires_at->format('d/m/Y')
                : 'Sin fecha',
            default => 'Desconocido',
        };
    }

    /**
     * Append roles list to the model.
     */
    public function getRolesListAttribute(): array
    {
        return $this->roles->pluck('name')->toArray();
    }

    protected $appends = ['roles_list'];
}
