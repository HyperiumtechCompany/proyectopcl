<?php

namespace Tests\Feature;

use App\Mail\AccountCredentialsMail;
use App\Mail\PlanRequestReceived;
use App\Models\PlanRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PlanRequestTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'clientes', 'guard_name' => 'web']);
    }

    public function test_free_plan_does_not_require_comprobante(): void
    {
        Mail::fake();

        $response = $this->post('/solicitudes', [
            'nombre' => 'Juan Pérez',
            'email' => 'juan@example.com',
            'plan' => 'free',
        ]);

        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('plan_requests', [
            'email' => 'juan@example.com',
            'plan' => 'free',
            'status' => 'pending',
        ]);
        Mail::assertSent(PlanRequestReceived::class);
    }

    public function test_paid_plan_requires_comprobante(): void
    {
        Mail::fake();

        $response = $this->post('/solicitudes', [
            'nombre' => 'Ana López',
            'email' => 'ana@example.com',
            'plan' => 'mensual',
        ]);

        $response->assertSessionHasErrors('comprobante');
        $this->assertDatabaseMissing('plan_requests', ['email' => 'ana@example.com']);
    }

    public function test_submitting_with_comprobante_stores_file_and_notifies_admin(): void
    {
        Storage::fake('public');
        Mail::fake();

        $response = $this->post('/solicitudes', [
            'nombre' => 'Ana López',
            'email' => 'ana@example.com',
            'plan' => 'mensual',
            'comprobante' => UploadedFile::fake()->image('voucher.jpg'),
        ]);

        $response->assertSessionHasNoErrors();

        $planRequest = PlanRequest::where('email', 'ana@example.com')->firstOrFail();
        $this->assertNotNull($planRequest->comprobante_path);
        Storage::disk('public')->assertExists($planRequest->comprobante_path);

        Mail::assertSent(PlanRequestReceived::class, fn ($mail) => $mail->planRequest->is($planRequest));
    }

    public function test_business_plan_requires_empresa_but_not_comprobante(): void
    {
        Mail::fake();

        $response = $this->post('/solicitudes', [
            'nombre' => 'Carla Ruiz',
            'email' => 'carla@empresa.com',
            'plan' => 'negocios',
        ]);

        $response->assertSessionHasErrors('empresa');
        $this->assertDatabaseMissing('plan_requests', ['email' => 'carla@empresa.com']);

        $response = $this->post('/solicitudes', [
            'nombre' => 'Carla Ruiz',
            'email' => 'carla@empresa.com',
            'plan' => 'empresarial',
            'empresa' => 'Constructora Ruiz S.A.C.',
        ]);

        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('plan_requests', [
            'email' => 'carla@empresa.com',
            'plan' => 'empresarial',
            'empresa' => 'Constructora Ruiz S.A.C.',
        ]);
    }

    public function test_approving_a_business_request_does_not_auto_create_an_account(): void
    {
        Mail::fake();
        $admin = User::factory()->create();
        $admin->assignRole(Role::firstOrCreate(['name' => 'root', 'guard_name' => 'web']));

        $planRequest = PlanRequest::factory()->create([
            'plan' => 'negocios',
            'empresa' => 'Constructora Ruiz S.A.C.',
            'status' => 'pending',
        ]);

        $response = $this->actingAs($admin)->post("/solicitudes/{$planRequest->id}/approve");

        $response->assertSessionHasNoErrors();

        $planRequest->refresh();
        $this->assertSame('approved', $planRequest->status);
        $this->assertNull($planRequest->user_id);
        $this->assertDatabaseCount('users', 1); // only the admin
        Mail::assertNotSent(AccountCredentialsMail::class);
    }

    public function test_admin_can_approve_a_pending_request(): void
    {
        Mail::fake();
        $admin = User::factory()->create();
        $admin->assignRole(Role::firstOrCreate(['name' => 'root', 'guard_name' => 'web']));

        $planRequest = PlanRequest::factory()->create([
            'plan' => 'mensual',
            'status' => 'pending',
        ]);

        $response = $this->actingAs($admin)->post("/solicitudes/{$planRequest->id}/approve");

        $response->assertSessionHasNoErrors();

        $planRequest->refresh();
        $this->assertSame('approved', $planRequest->status);
        $this->assertNotNull($planRequest->user_id);

        $user = User::findOrFail($planRequest->user_id);
        $this->assertSame($planRequest->email, $user->email);
        $this->assertSame('mensual', $user->plan);
        $this->assertTrue($user->hasRole('clientes'));

        Mail::assertSent(AccountCredentialsMail::class, fn ($mail) => $mail->user->is($user));
    }

    public function test_admin_can_reject_a_pending_request(): void
    {
        Mail::fake();
        $admin = User::factory()->create();
        $admin->assignRole(Role::firstOrCreate(['name' => 'root', 'guard_name' => 'web']));

        $planRequest = PlanRequest::factory()->create(['status' => 'pending']);

        $response = $this->actingAs($admin)->post("/solicitudes/{$planRequest->id}/reject");

        $response->assertSessionHasNoErrors();
        $this->assertSame('rejected', $planRequest->fresh()->status);
        $this->assertDatabaseCount('users', 1); // only the admin, no new account
        Mail::assertNotSent(AccountCredentialsMail::class);
    }

    public function test_guest_cannot_view_or_approve_requests(): void
    {
        $planRequest = PlanRequest::factory()->create();

        $this->get('/solicitudes')->assertRedirect('/login');
        $this->post("/solicitudes/{$planRequest->id}/approve")->assertRedirect('/login');
    }
}
