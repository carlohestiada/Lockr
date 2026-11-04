<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserPreferenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_receives_default_preferences_without_creating_a_record(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->getJson('/api/preferences');

        $response->assertOk()
            ->assertJsonPath('data.theme', 'system')
            ->assertJsonPath('data.accent_color', '#2563eb')
            ->assertJsonPath('data.font_size', 'medium')
            ->assertJsonPath('data.show_website_icons', true)
            ->assertJsonPath('data.auto_lock_minutes', 15);

        $this->assertDatabaseMissing('user_preferences', [
            'user_id' => $user->id,
        ]);
    }

    public function test_user_can_create_preferences(): void
    {
        $user = User::factory()->create();

        $payload = [
            'theme' => 'dark',
            'accent_color' => '#12ABef',
            'font_size' => 'large',
            'show_website_icons' => false,
            'auto_lock_minutes' => 30,
        ];

        $response = $this->actingAs($user)
            ->putJson('/api/preferences', $payload);

        $response->assertOk()
            ->assertJsonPath('data.theme', 'dark')
            ->assertJsonPath('data.accent_color', '#12ABef')
            ->assertJsonPath('data.font_size', 'large')
            ->assertJsonPath('data.show_website_icons', false)
            ->assertJsonPath('data.auto_lock_minutes', 30);

        $this->assertDatabaseHas('user_preferences', [
            'user_id' => $user->id,
            'theme' => 'dark',
            'accent_color' => '#12ABef',
            'font_size' => 'large',
            'show_website_icons' => false,
            'auto_lock_minutes' => 30,
        ]);
    }

    public function test_user_can_update_only_selected_preferences(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->putJson('/api/preferences', [
            'theme' => 'dark',
            'font_size' => 'large',
        ])->assertOk();

        $this->actingAs($user)->putJson('/api/preferences', [
            'theme' => 'light',
        ])->assertOk()
            ->assertJsonPath('data.theme', 'light')
            ->assertJsonPath('data.font_size', 'large');

        $this->assertDatabaseHas('user_preferences', [
            'user_id' => $user->id,
            'theme' => 'light',
            'font_size' => 'large',
        ]);
    }

    public function test_invalid_preference_values_are_rejected(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->putJson('/api/preferences', [
                'theme' => 'purple',
                'accent_color' => 'not-a-hex-color',
                'font_size' => 'huge',
                'show_website_icons' => 'perhaps',
                'auto_lock_minutes' => 7,
            ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors([
                'theme',
                'accent_color',
                'font_size',
                'show_website_icons',
                'auto_lock_minutes',
            ]);

        $this->assertDatabaseMissing('user_preferences', [
            'user_id' => $user->id,
        ]);
    }

    public function test_empty_preference_update_is_rejected(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->putJson('/api/preferences', [])
            ->assertUnprocessable()
            ->assertJsonPath(
                'message',
                'Provide at least one preference to update.'
            );
    }

    public function test_users_can_only_read_and_update_their_own_preferences(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        $this->actingAs($userA)->putJson('/api/preferences', [
            'theme' => 'dark',
        ])->assertOk();

        $this->actingAs($userB)->putJson('/api/preferences', [
            'theme' => 'light',
        ])->assertOk();

        $this->actingAs($userA)
            ->getJson('/api/preferences')
            ->assertOk()
            ->assertJsonPath('data.theme', 'dark');

        $this->actingAs($userB)
            ->getJson('/api/preferences')
            ->assertOk()
            ->assertJsonPath('data.theme', 'light');

        $this->assertDatabaseHas('user_preferences', [
            'user_id' => $userA->id,
            'theme' => 'dark',
        ]);

        $this->assertDatabaseHas('user_preferences', [
            'user_id' => $userB->id,
            'theme' => 'light',
        ]);

        $this->assertDatabaseCount('user_preferences', 2);
    }

    public function test_unauthenticated_user_cannot_access_preferences(): void
    {
        $this->getJson('/api/preferences')
            ->assertUnauthorized();

        $this->putJson('/api/preferences', [
            'theme' => 'dark',
        ])->assertUnauthorized();
    }

    public function test_zero_auto_lock_minutes_is_allowed(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->putJson('/api/preferences', [
                'auto_lock_minutes' => 0,
            ])
            ->assertOk()
            ->assertJsonPath('data.auto_lock_minutes', 0);
    }
}