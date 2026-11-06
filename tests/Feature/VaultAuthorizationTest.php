<?php

namespace Tests\Feature;

use App\Models\CredentialAuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Mockery;
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

    public function test_credential_list_sorts_by_last_update_time(): void
    {
        $user = User::factory()->create();
        $older = $user->credentials()->create(['title' => 'Updated first', 'password' => 'first-secret']);
        $newer = $user->credentials()->create(['title' => 'Created second', 'password' => 'second-secret']);

        DB::table('credentials')
            ->where('id', $older->id)
            ->update(['updated_at' => now()->addMinute()]);

        $this->unlockVault($user);

        $this->actingAs($user)
            ->getJson('/api/credentials?sort=updated')
            ->assertOk()
            ->assertJsonPath('data.0.id', $older->id)
            ->assertJsonMissingPath('data.0.password');
    }

    public function test_unauthenticated_user_cannot_access_credentials(): void
    {
        $this->get('/api/credentials')
            ->assertRedirect(route('login'));
    }

    public function test_credential_show_returns_metadata_without_password_or_notes(): void
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

        $response
            ->assertJsonPath('data.title', 'My Private Account')
            ->assertJsonMissingPath('data.password')
            ->assertJsonMissingPath('data.notes');
        $this->assertStringNotContainsString('owner-secret-123', $response->getContent());
        $this->assertStringNotContainsString('My private recovery notes', $response->getContent());
    }

    public function test_reveal_returns_only_password_and_audits_without_caching(): void
    {
        $owner = User::factory()->create();
        $credential = $owner->credentials()->create([
            'title' => 'Private mail',
            'password' => 'password-only-secret',
            'notes' => 'must-not-be-returned',
        ]);

        $this->unlockVault($owner);

        $this->actingAs($owner)
            ->postJson("/api/credentials/{$credential->id}/reveal")
            ->assertOk()
            ->assertExactJson([
                'password' => 'password-only-secret',
            ])
            ->assertHeader('Cache-Control', 'no-store, private');

        $this->assertDatabaseHas('credential_audit_logs', [
            'user_id' => $owner->id,
            'credential_id' => $credential->id,
            'event' => 'revealed',
            'user_agent' => 'Symfony',
        ]);

        $auditLog = CredentialAuditLog::query()->where('credential_id', $credential->id)->sole();
        $this->assertArrayNotHasKey('password', $auditLog->getAttributes());
        $this->assertStringNotContainsString(
            'password-only-secret',
            json_encode($auditLog->toArray(), JSON_THROW_ON_ERROR)
        );
    }

    public function test_revealing_multiple_credentials_creates_individual_audit_records(): void
    {
        $owner = User::factory()->create();
        $credentials = collect(['First secret', 'Second secret'])->map(
            fn (string $password) => $owner->credentials()->create([
                'title' => 'Private mail',
                'password' => $password,
            ])
        );

        $this->unlockVault($owner);

        foreach ($credentials as $credential) {
            $this->actingAs($owner)
                ->postJson("/api/credentials/{$credential->id}/reveal")
                ->assertOk()
                ->assertExactJson(['password' => $credential->password]);
        }

        $this->assertDatabaseCount('credential_audit_logs', 2);
        foreach ($credentials as $credential) {
            $this->assertDatabaseHas('credential_audit_logs', [
                'user_id' => $owner->id,
                'credential_id' => $credential->id,
                'event' => 'revealed',
            ]);
        }
    }

    public function test_audit_log_ip_and_user_agent_are_nullable(): void
    {
        $owner = User::factory()->create();
        $credential = $owner->credentials()->create([
            'title' => 'Private mail',
            'password' => 'private-password',
        ]);

        $auditLog = CredentialAuditLog::create([
            'user_id' => $owner->id,
            'credential_id' => $credential->id,
            'event' => 'revealed',
            'ip' => null,
            'user_agent' => null,
        ]);

        $this->assertDatabaseHas('credential_audit_logs', [
            'id' => $auditLog->id,
            'ip' => null,
            'user_agent' => null,
        ]);
    }

    public function test_password_is_not_returned_when_audit_logging_fails(): void
    {
        $owner = User::factory()->create();
        $credential = $owner->credentials()->create([
            'title' => 'Private mail',
            'password' => 'private-password',
        ]);

        $this->unlockVault($owner);
        Schema::drop('credential_audit_logs');

        Log::shouldReceive('error')
            ->once()
            ->with(
                'Unable to record credential reveal audit event.',
                Mockery::on(fn (array $context) => $context['user_id'] === $owner->id
                    && $context['credential_id'] === $credential->id
                    && isset($context['sql_state']))
            );

        $this->actingAs($owner)
            ->postJson("/api/credentials/{$credential->id}/reveal")
            ->assertStatus(503)
            ->assertExactJson(['message' => 'The credential password is temporarily unavailable.'])
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertDontSee('private-password');
    }

    public function test_locked_or_unauthorized_users_cannot_reveal_a_credential_password(): void
    {
        $owner = User::factory()->create();
        $credential = $owner->credentials()->create([
            'title' => 'Private mail',
            'password' => 'must-not-be-revealed',
        ]);
        $otherUser = User::factory()->create();

        $this->actingAs($owner)
            ->postJson("/api/credentials/{$credential->id}/reveal")
            ->assertStatus(423);

        $this->unlockVault($otherUser);

        $this->actingAs($otherUser)
            ->postJson("/api/credentials/{$credential->id}/reveal")
            ->assertForbidden();

        $this->assertDatabaseMissing('credential_audit_logs', [
            'credential_id' => $credential->id,
            'event' => 'revealed',
        ]);
    }

    public function test_bulk_actions_validate_ownership_before_changing_credentials(): void
    {
        $owner = User::factory()->create();
        $folder = $owner->folders()->create(['name' => 'Work']);
        $first = $owner->credentials()->create(['title' => 'First', 'password' => 'first-secret']);
        $second = $owner->credentials()->create(['title' => 'Second', 'password' => 'second-secret']);
        $foreign = User::factory()->create()->credentials()->create([
            'title' => 'Foreign',
            'password' => 'foreign-secret',
        ]);

        $this->unlockVault($owner);

        $this->actingAs($owner)->postJson('/api/credentials/bulk', [
            'action' => 'move',
            'ids' => [$first->id, $second->id],
            'folder_id' => $folder->id,
        ])->assertOk();

        $this->assertDatabaseHas('credentials', ['id' => $first->id, 'folder_id' => $folder->id]);
        $this->assertDatabaseHas('credentials', ['id' => $second->id, 'folder_id' => $folder->id]);

        $this->actingAs($owner)->postJson('/api/credentials/bulk', [
            'action' => 'move',
            'ids' => [$first->id],
            'folder_id' => null,
        ])->assertOk();

        $this->assertDatabaseHas('credentials', ['id' => $first->id, 'folder_id' => null]);

        $this->actingAs($owner)->postJson('/api/credentials/bulk', [
            'action' => 'delete',
            'ids' => [$first->id, $foreign->id],
        ])->assertForbidden();

        $this->assertDatabaseHas('credentials', ['id' => $first->id]);
        $this->assertDatabaseHas('credentials', ['id' => $foreign->id]);
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
