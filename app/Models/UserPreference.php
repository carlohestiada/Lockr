<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserPreference extends Model
{
    protected $fillable = [
        'theme',
        'accent_color',
        'font_size',
        'show_website_icons',
        'auto_lock_minutes',
    ];

    protected function casts(): array
    {
        return [
            'show_website_icons' => 'boolean',
            'auto_lock_minutes' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
