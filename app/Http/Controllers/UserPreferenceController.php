<?php

namespace App\Http\Controllers;

use App\Models\UserPreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserPreferenceController extends Controller
{
    /**
     * Return the authenticated user's preferences or unsaved defaults.
     */
    public function show(Request $request): JsonResponse
    {
        $preference = $request->user()->preference()->first();

        return response()->json([
            'data' => [
                'theme' => $preference?->theme ?? 'system',
                'accent_color' => $preference?->accent_color ?? '#2563eb',
                'font_size' => $preference?->font_size ?? 'medium',
                'show_website_icons' => $preference?->show_website_icons ?? true,
                'auto_lock_minutes' => $preference?->auto_lock_minutes ?? 15,
            ],
        ]);
    }

    /**
     * Create or update the authenticated user's preferences.
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'theme' => [
                'sometimes',
                'required',
                Rule::in(['system', 'light', 'dark']),
            ],
            'accent_color' => [
                'sometimes',
                'required',
                'regex:/^#[0-9A-Fa-f]{6}$/',
            ],
            'font_size' => [
                'sometimes',
                'required',
                Rule::in(['small', 'medium', 'large']),
            ],
            'show_website_icons' => [
                'sometimes',
                'required',
                'boolean',
            ],
            'auto_lock_minutes' => [
                'sometimes',
                'required',
                'integer',
                Rule::in([0, 1, 5, 10, 15, 30, 60]),
            ],
        ]);

        if ($validated === []) {
            return response()->json([
                'message' => 'Provide at least one preference to update.',
            ], 422);
        }

        $preference = $request->user()
            ->preference()
            ->first();

        if ($preference) {
            $preference->fill($validated);
            $preference->save();
        } else {
            $preference = $request->user()
                ->preference()
                ->create($validated);
        }

        return response()->json([
            'message' => 'Preferences saved successfully.',
            'data' => [
                'theme' => $preference->theme,
                'accent_color' => $preference->accent_color,
                'font_size' => $preference->font_size,
                'show_website_icons' => $preference->show_website_icons,
                'auto_lock_minutes' => $preference->auto_lock_minutes,
            ],
        ]);
    }
}