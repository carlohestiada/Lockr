<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Credential extends Model
{
    protected $fillable = [
        'title',
        'username',
        'password',
        'website_url',
        'notes',
        'folder_id',
        'is_favorite',
    ];

    protected $hidden = [
        'password',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'encrypted',
            'notes' => 'encrypted',
            'is_favorite' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function folder(): BelongsTo
    {
        return $this->belongsTo(Folder::class);
    }
}
