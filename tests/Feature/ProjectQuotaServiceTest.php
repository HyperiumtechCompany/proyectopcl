<?php

namespace Tests\Feature;

use App\Http\Middleware\SetCostosDatabase;
use App\Models\CostoProject;
use App\Models\GestorProyecto;
use App\Models\Organization;
use App\Models\User;
use App\Services\ProjectQuotaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class ProjectQuotaServiceTest extends TestCase
{
    use RefreshDatabase;

    private ProjectQuotaService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(ProjectQuotaService::class);
    }

    public function test_free_plan_allows_one_demo_costos_project_then_blocks_a_second(): void
    {
        $user = User::factory()->create(['plan' => 'free']);

        // No demo yet: allowed.
        $this->service->assertCanCreate($user, 'costos');

        CostoProject::factory()->create([
            'user_id' => $user->id,
            'is_demo' => true,
            'demo_expires_at' => now()->addDays(5),
        ]);

        $this->expectException(HttpException::class);
        $this->service->assertCanCreate($user, 'costos');
    }

    public function test_free_plan_allows_new_demo_once_previous_one_expired(): void
    {
        $user = User::factory()->create(['plan' => 'free']);

        CostoProject::factory()->create([
            'user_id' => $user->id,
            'is_demo' => true,
            'demo_expires_at' => now()->subDay(),
        ]);

        // Expired demo doesn't block a new one.
        $this->service->assertCanCreate($user, 'costos');
        $this->addToAssertionCount(1);
    }

    public function test_paid_plan_allows_up_to_the_configured_limit_then_blocks(): void
    {
        $user = User::factory()->create(['plan' => 'mensual']);

        CostoProject::factory()->count(9)->create(['user_id' => $user->id]);
        $this->service->assertCanCreate($user, 'costos');
        $this->addToAssertionCount(1);

        CostoProject::factory()->create(['user_id' => $user->id]);

        $this->expectException(HttpException::class);
        $this->service->assertCanCreate($user, 'costos');
    }

    public function test_paid_plan_uses_resto_limit_for_untracked_modules(): void
    {
        $user = User::factory()->create(['plan' => 'anual']);

        // 'resto' limit is 50 — well below that should never throw.
        $this->service->assertCanCreate($user, 'agua');
        $this->addToAssertionCount(1);
    }

    public function test_demo_attributes_for_free_user_include_expiry(): void
    {
        $user = User::factory()->create(['plan' => 'free']);

        $attributes = $this->service->demoAttributesFor($user);

        $this->assertTrue($attributes['is_demo']);
        $this->assertTrue($attributes['demo_expires_at']->isFuture());
    }

    public function test_demo_attributes_for_paid_user_are_empty(): void
    {
        $user = User::factory()->create(['plan' => 'lifetime']);

        $this->assertSame([], $this->service->demoAttributesFor($user));
    }

    public function test_expired_demo_blocks_access_via_set_costos_database_middleware(): void
    {
        $user = User::factory()->create(['plan' => 'free']);
        $project = CostoProject::factory()->create([
            'user_id' => $user->id,
            'is_demo' => true,
            'demo_expires_at' => now()->subDay(),
        ]);

        $this->actingAs($user);
        $request = Request::create('/?project='.$project->id, 'GET');
        $request->setUserResolver(fn () => $user);

        try {
            app(SetCostosDatabase::class)->handle($request, fn ($req) => response('ok'));
            $this->fail('Expected the expired demo to be blocked with a 403.');
        } catch (HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }
    }

    public function test_active_demo_is_not_blocked_by_ownership_and_expiry_checks(): void
    {
        $user = User::factory()->create(['plan' => 'free']);
        $project = CostoProject::factory()->create([
            'user_id' => $user->id,
            'is_demo' => true,
            'demo_expires_at' => now()->addDays(5),
            'database_name' => 'nonexistent_db_for_this_test',
        ]);

        $this->actingAs($user);
        $request = Request::create('/?project='.$project->id, 'GET');
        $request->setUserResolver(fn () => $user);

        // Ownership + demo-expiry pass; it should only fail later on the
        // (unrelated) "database doesn't exist" check, proving the demo gate
        // itself isn't the blocker for a still-active demo.
        try {
            app(SetCostosDatabase::class)->handle($request, fn ($req) => response('ok'));
            $this->fail('Expected the missing tenant database to abort.');
        } catch (HttpException $e) {
            $this->assertSame(500, $e->getStatusCode());
        }
    }

    public function test_organization_quota_is_a_shared_pool_across_members(): void
    {
        $org = Organization::factory()->create(['plan' => 'negocios']); // 5 costos, shared
        $userA = User::factory()->create(['organization_id' => $org->id]);
        $userB = User::factory()->create(['organization_id' => $org->id]);

        // 4 projects created by A, 1 by B — pool is at 5/5 total.
        CostoProject::factory()->count(4)->create(['user_id' => $userA->id]);
        CostoProject::factory()->create(['user_id' => $userB->id]);

        // Doesn't matter which member tries next — the shared pool is full.
        $this->expectException(HttpException::class);
        $this->service->assertCanCreate($userA, 'costos');
    }

    public function test_organization_member_can_create_below_the_shared_limit(): void
    {
        $org = Organization::factory()->create(['plan' => 'negocios']);
        $userA = User::factory()->create(['organization_id' => $org->id]);
        $userB = User::factory()->create(['organization_id' => $org->id]);

        CostoProject::factory()->count(3)->create(['user_id' => $userA->id]);

        // 3/5 used across the org — userB can still create.
        $this->service->assertCanCreate($userB, 'costos');
        $this->addToAssertionCount(1);
    }

    public function test_organization_plan_resto_modules_are_unlimited(): void
    {
        $org = Organization::factory()->create(['plan' => 'empresarial']);
        $user = User::factory()->create(['organization_id' => $org->id]);

        $this->service->assertCanCreate($user, 'agua');
        $this->addToAssertionCount(1);
    }

    public function test_user_without_organization_is_unaffected_by_org_logic(): void
    {
        $user = User::factory()->create(['plan' => 'mensual']);

        CostoProject::factory()->count(10)->create(['user_id' => $user->id]);

        $this->expectException(HttpException::class);
        $this->service->assertCanCreate($user, 'costos');
    }

    public function test_expired_demo_blocks_access_to_gestor_proyecto(): void
    {
        $user = User::factory()->create(['plan' => 'free']);
        $proyecto = GestorProyecto::factory()->create([
            'user_id' => $user->id,
            'is_demo' => true,
            'demo_expires_at' => now()->subDay(),
        ]);

        $this->actingAs($user)
            ->get(route('gestor-proyectos.show', $proyecto))
            ->assertForbidden();
    }
}
