<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class FolderAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_users_only_see_their_own_folders(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        $userA->folders()->create(['name' => 'Personal']);
        $userB->folders()->create(['name' => 'Work']);

        $response = $this->actingAs($userA)
            ->getJson('/api/folders')
            ->assertOk();

        $response->assertJsonFragment(['name' => 'Personal']);
        $response->assertJsonMissing(['name' => 'Work']);
    }

    public function test_folder_management_page_uses_the_dedicated_page(): void
    {
        $this->actingAs(User::factory()->create())
            ->get('/folders')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('folders/index'));
    }

    public function test_folder_names_are_case_insensitively_unique_per_user(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();
        $folder = $owner->folders()->create(['name' => 'Personal']);

        $this->actingAs($owner)
            ->postJson('/api/folders', ['name' => 'personal'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        $this->actingAs($owner)
            ->putJson("/api/folders/{$folder->id}", ['name' => 'pErSoNaL'])
            ->assertOk();

        $this->actingAs($otherUser)
            ->postJson('/api/folders', ['name' => 'PERSONAL'])
            ->assertCreated();

        $this->assertDatabaseCount('folders', 2);
    }

    public function test_user_cannot_update_another_users_folder(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();

        $folder = $owner->folders()->create([
            'name' => 'Private Folder',
        ]);

        $this->actingAs($otherUser)
            ->putJson("/api/folders/{$folder->id}", [
                'name' => 'Changed Folder',
            ])
            ->assertForbidden();

        $this->assertDatabaseHas('folders', [
            'id' => $folder->id,
            'name' => 'Private Folder',
            'user_id' => $owner->id,
        ]);
    }

    public function test_user_cannot_delete_another_users_folder(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();

        $folder = $owner->folders()->create([
            'name' => 'Private Folder',
        ]);

        $this->actingAs($otherUser)
            ->deleteJson("/api/folders/{$folder->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('folders', [
            'id' => $folder->id,
            'user_id' => $owner->id,
        ]);
    }

    public function test_unauthenticated_user_cannot_access_folders(): void
    {
        $this->get('/api/folders')
            ->assertRedirect(route('login'));
    }

    public function test_deleting_folder_preserves_credentials_and_unassigns_folder(): void
    {
        $user = User::factory()->create();

        $folder = $user->folders()->create([
            'name' => 'Personal',
        ]);

        $credential = $user->credentials()->create([
            'title' => 'Email Account',
            'password' => 'test-secret',
            'folder_id' => $folder->id,
        ]);

        $this->actingAs($user)
            ->deleteJson("/api/folders/{$folder->id}")
            ->assertOk();

        $this->assertDatabaseMissing('folders', [
            'id' => $folder->id,
        ]);

        $this->assertDatabaseHas('credentials', [
            'id' => $credential->id,
            'user_id' => $user->id,
            'title' => 'Email Account',
            'folder_id' => null,
        ]);
    }
}
