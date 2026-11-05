<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CredentialAuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'credential_id',
        'event',
        'ip',
        'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }
}
