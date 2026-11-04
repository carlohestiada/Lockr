<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page()
    {
        $this->get('/dashboard')->assertRedirect('/login');
    }

    public function test_root_redirects_guests_to_the_login_page()
    {
        $this->get('/')
            ->assertRedirect('/login')
            ->assertDontSee('Let\'s get started');
    }

    public function test_authenticated_users_can_visit_the_dashboard()
    {
        $this->withoutVite();
        $this->actingAs(User::factory()->create());

        $this->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('dashboard/index'));
    }

    public function test_root_redirects_authenticated_users_to_the_dashboard()
    {
        $this->actingAs(User::factory()->create());

        $this->get('/')->assertRedirect('/dashboard');
    }

    public function test_folder_and_favorite_filters_use_the_existing_vault_page()
    {
        $this->withoutVite();
        $this->actingAs(User::factory()->create());

        $this->get('/vault?folder=all')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('vault/index'));
        $this->get('/vault?favorites=1')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('vault/index'));
    }
}
