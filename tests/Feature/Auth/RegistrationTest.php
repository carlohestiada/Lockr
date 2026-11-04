<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_screen_can_be_rendered()
    {
        $response = $this->get('/register');

        $response->assertOk()
            ->assertInertia(fn ($page) => $page->component('auth/register'));
    }

    public function test_new_users_can_register()
    {
        $response = $this->post('/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('dashboard', absolute: false));
    }

    public function test_registration_validates_required_fields_email_and_password_confirmation()
    {
        $response = $this->from('/register')->post('/register', [
            'name' => '',
            'email' => 'not-an-email',
            'password' => 'password',
            'password_confirmation' => 'different-password',
        ]);

        $response->assertRedirect('/register')
            ->assertSessionHasErrors(['name', 'email', 'password']);

        $this->assertGuest();
    }
}
