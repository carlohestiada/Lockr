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
            'password' => 'StrongPassword123!',
            'password_confirmation' => 'StrongPassword123!',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('dashboard', absolute: false));
    }

    public function test_registration_validates_required_fields_email_and_password_confirmation()
    {
        $response = $this->from('/register')->post('/register', [
            'name' => '',
            'email' => 'not-an-email',
            'password' => 'StrongPassword123!',
            'password_confirmation' => 'StrongPassword123!',
        ]);

        $response->assertRedirect('/register')
            ->assertSessionHasErrors(['name', 'email']);

        $this->assertGuest();
    }

    public function test_registration_requires_a_password_that_meets_the_displayed_requirements()
    {
        $response = $this->from('/register')->post('/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'weakpassword',
            'password_confirmation' => 'weakpassword',
        ]);

        $response->assertRedirect('/register')
            ->assertSessionHasErrors('password');

        $this->assertGuest();
    }

    public function test_registration_rejects_mismatched_valid_passwords()
    {
        $response = $this->from('/register')->post('/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'StrongPassword123!',
            'password_confirmation' => 'AnotherPassword123!',
        ]);

        $response->assertRedirect('/register')
            ->assertSessionHasErrors('password');

        $this->assertGuest();
    }
}
