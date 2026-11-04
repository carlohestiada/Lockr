<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class VaultAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_credential_password_and_notes_are_encrypted_in_database(): void
    {
        $user = User::factory()->create();

        $credential = $user->credentials()->create([
            'title' => 'Test Account',
            'username' => 'test@example.com',
            'password' => 'secret-password-123',
            'notes' => 'Private test notes',
        ]);

        $stored = DB::table('credentials')
            ->where('id', $credential->id)
            ->first();

        $this->assertNotSame('secret-password-123', $stored->password);
        $this->assertNotSame('Private test notes', $stored->notes);

        $this->assertSame(
            'secret-password-123',
            $credential->fresh()->password
        );

        $this->assertSame(
            'Private test notes',
            $credential->fresh()->notes
        );
    }

    public function test_user_cannot_view_another_users_credential(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();

        $credential = $owner->credentials()->create([
            'title' => 'Private Account',
            'password' => 'secret-password',
        ]);

        $this->unlockVault($otherUser);

        $this->actingAs($otherUser)
            ->getJson("/api/credentials/{$credential->id}")
            ->assertForbidden();
    }

    public function test_user_cannot_update_or_delete_another_users_credential(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();

        $credential = $owner->credentials()->create([
            'title' => 'Owner Account',
            'password' => 'owner-secret',
        ]);

        $this->unlockVault($otherUser);

        $this->actingAs($otherUser)
            ->putJson("/api/credentials/{$credential->id}", [
                'title' => 'Changed by another user',
            ])
            ->assertForbidden();

        $this->actingAs($otherUser)
            ->deleteJson("/api/credentials/{$credential->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('credentials', [
            'id' => $credential->id,
            'title' => 'Owner Account',
        ]);
    }

    public function test_user_cannot_assign_credential_to_another_users_folder(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();

        $otherUsersFolder = $otherUser->folders()->create([
            'name' => 'Private Folder',
        ]);

        $this->unlockVault($user);

        $this->actingAs($user)
            ->postJson('/api/credentials', [
                'title' => 'My Account',
                'password' => 'my-secret',
                'folder_id' => $otherUsersFolder->id,
            ])
            ->assertUnprocessable();

        $this->assertDatabaseMissing('credentials', [
            'user_id' => $user->id,
            'folder_id' => $otherUsersFolder->id,
        ]);
    }

    public function test_credential_list_does_not_expose_password_or_notes(): void
    {
        $user = User::factory()->create();

        $user->credentials()->create([
            'title' => 'Private Account',
            'password' => 'do-not-return-this',
            'notes' => 'private-note-content',
        ]);

        $this->unlockVault($user);

        $response = $this->actingAs($user)
            ->getJson('/api/credentials')
            ->assertOk();

        $response->assertJsonMissingPath('data.0.password');
        $response->assertJsonMissingPath('data.0.notes');

        $this->assertStringNotContainsString(
            'do-not-return-this',
            $response->getContent()
        );

        $this->assertStringNotContainsString(
            'private-note-content',
            $response->getContent()
        );
    }

    public function test_credential_list_searches_metadata_and_filters_favorites_without_exposing_secrets(): void
    {
        $user = User::factory()->create();

        $matching = $user->credentials()->create([
            'title' => 'Work mail account',
            'username' => 'work@example.test',
            'password' => 'dashboard-search-secret',
            'notes' => 'dashboard-search-private-note',
            'is_favorite' => true,
        ]);

        $user->credentials()->create([
            'title' => 'Personal calendar',
            'username' => 'calendar@example.test',
            'password' => 'another-secret',
            'is_favorite' => false,
        ]);

        $this->unlockVault($user);

        $response = $this->actingAs($user)
            ->getJson('/api/credentials?search=WORK&favorite=1&per_page=1')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $matching->id)
            ->assertJsonMissingPath('data.0.password')
            ->assertJsonMissingPath('data.0.notes');

        $this->assertStringNotContainsString('dashboard-search-secret', $response->getContent());
        $this->assertStringNotContainsString('dashboard-search-private-note', $response->getContent());
    }

    public function test_credential_list_filters_by_a_folder_owned_by_the_authenticated_user(): void
    {
        $user = User::factory()->create();
        $folder = $user->folders()->create(['name' => 'Personal']);
        $credential = $user->credentials()->create([
            'title' => 'Folder credential',
            'password' => 'not-returned',
            'folder_id' => $folder->id,
        ]);
        $user->credentials()->create([
            'title' => 'Unfiled credential',
            'password' => 'also-not-returned',
        ]);
        $otherUserFolder = User::factory()->create()->folders()->create(['name' => 'Other user']);

        $this->unlockVault($user);

        $this->actingAs($user)
            ->getJson("/api/credentials?folder_id={$folder->id}")
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $credential->id)
            ->assertJsonMissingPath('data.0.password');

        $this->actingAs($user)
            ->getJson("/api/credentials?folder_id={$otherUserFolder->id}")
            ->assertUnprocessable();
    }

    public function test_unauthenticated_user_cannot_access_credentials(): void
    {
        $this->get('/api/credentials')
            ->assertRedirect(route('login'));
    }

    public function test_owner_can_retrieve_their_decrypted_credential(): void
    {
        $owner = User::factory()->create();

        $credential = $owner->credentials()->create([
            'title' => 'My Private Account',
            'username' => 'owner@example.com',
            'password' => 'owner-secret-123',
            'notes' => 'My private recovery notes',
        ]);

        $this->unlockVault($owner);

        $response = $this->actingAs($owner)
            ->getJson("/api/credentials/{$credential->id}")
            ->assertOk();

        $response->assertSeeText('My Private Account');
        $response->assertSeeText('owner-secret-123');
        $response->assertSeeText('My private recovery notes');
    }

    public function test_credential_password_only_request_does_not_return_other_private_fields(): void
    {
        $owner = User::factory()->create();
        $credential = $owner->credentials()->create([
            'title' => 'Private mail',
            'password' => 'password-only-secret',
            'notes' => 'must-not-be-returned',
        ]);

        $this->unlockVault($owner);

        $this->actingAs($owner)
            ->getJson("/api/credentials/{$credential->id}?field=password")
            ->assertOk()
            ->assertExactJson([
                'data' => [
                    'password' => 'password-only-secret',
                ],
            ]);
    }

    public function test_user_can_move_credential_to_another_owned_folder(): void
    {
        $user = User::factory()->create();

        $oldFolder = $user->folders()->create([
            'name' => 'Personal',
        ]);

        $newFolder = $user->folders()->create([
            'name' => 'Work',
        ]);

        $credential = $user->credentials()->create([
            'title' => 'Email Account',
            'password' => 'test-secret',
            'folder_id' => $oldFolder->id,
        ]);

        $this->unlockVault($user);

        $this->actingAs($user)
            ->putJson("/api/credentials/{$credential->id}", [
                'folder_id' => $newFolder->id,
            ])
            ->assertOk();

        $this->assertDatabaseHas('credentials', [
            'id' => $credential->id,
            'user_id' => $user->id,
            'folder_id' => $newFolder->id,
        ]);
    }

    private function unlockVault(User $user): void
    {
        $this->actingAs($user)
            ->postJson('/api/vault/unlock', [
                'password' => 'password',
            ])
            ->assertOk();
    }

    public function test_locked_vault_rejects_credential_access(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/credentials')
            ->assertStatus(423)
            ->assertJsonPath('code', 'VAULT_LOCKED');
    }

    public function test_user_can_unlock_vault_with_account_password(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/vault/unlock', ['password' => 'password'])
            ->assertOk()
            ->assertJsonPath('locked', false);

        $this->assertSame($user->id, (int) session('vault_unlocked_user_id'));
        $this->assertNotEmpty(session('vault_unlocked_at'));

        $this->getJson('/api/vault/status')
            ->assertOk()
            ->assertJsonPath('locked', false);
    }

    public function test_incorrect_account_password_does_not_unlock_vault(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/vault/unlock', ['password' => 'incorrect-password'])
            ->assertUnprocessable();

        $this->getJson('/api/vault/status')
            ->assertOk()
            ->assertJsonPath('locked', true);
    }

    public function test_vault_unlock_attempts_are_rate_limited(): void
    {
        $user = User::factory()->create();

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->actingAs($user)
                ->postJson('/api/vault/unlock', ['password' => 'incorrect-password'])
                ->assertUnprocessable();
        }

        $this->actingAs($user)
            ->postJson('/api/vault/unlock', ['password' => 'incorrect-password'])
            ->assertStatus(429);
    }

    public function test_manual_lock_clears_unlock_session_values(): void
    {
        $user = User::factory()->create();
        $this->unlockVault($user);

        $this->postJson('/api/vault/lock')
            ->assertOk()
            ->assertJsonPath('locked', true);

        $this->assertFalse(session()->has('vault_unlocked_at'));
        $this->assertFalse(session()->has('vault_unlocked_user_id'));
        $this->getJson('/api/credentials')->assertStatus(423);
    }

    public function test_unlock_session_is_bound_to_the_authenticated_user(): void
    {
        $user = User::factory()->create();
        $anotherUser = User::factory()->create();
        $this->unlockVault($user);

        $this->actingAs($anotherUser)
            ->getJson('/api/credentials')
            ->assertStatus(423);

        $this->assertFalse(session()->has('vault_unlocked_at'));
        $this->assertFalse(session()->has('vault_unlocked_user_id'));
    }

    public function test_inactivity_timeout_locks_vault_and_clears_session_values(): void
    {
        $user = User::factory()->create();
        $this->unlockVault($user);

        $this->travel(16)->minutes();

        $this->getJson('/api/credentials')->assertStatus(423);
        $this->assertFalse(session()->has('vault_unlocked_at'));
        $this->assertFalse(session()->has('vault_unlocked_user_id'));
    }

    public function test_zero_timeout_disables_inactivity_lock_but_explicit_lock_still_works(): void
    {
        $user = User::factory()->create();
        $user->preference()->create(['auto_lock_minutes' => 0]);
        $this->unlockVault($user);

        $this->travel(2)->hours();
        $this->getJson('/api/credentials')->assertOk();

        $this->postJson('/api/vault/lock')->assertOk();
        $this->getJson('/api/credentials')->assertStatus(423);
    }
}
