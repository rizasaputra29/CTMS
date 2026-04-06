<?php

namespace Tests\Unit;

use App\Models\Group;
use App\Models\Period;
use App\Services\GroupStateMachine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class GroupStateMachineTest extends TestCase
{
    use RefreshDatabase;

    protected GroupStateMachine $sm;

    protected function setUp(): void
    {
        parent::setUp();
        $this->sm = new GroupStateMachine();
    }

    private function makeGroup(string $status): Group
    {
        $period = Period::create([
            'name' => 'Test Period',
            'start_date' => now(),
            'end_date' => now()->addMonths(6),
            'is_active' => true,
            'is_finalized' => false,
            'min_group_size' => 2,
            'max_group_size' => 4,
        ]);

        return Group::create([
            'period_id' => $period->id,
            'status' => $status,
        ]);
    }

    // ══════════════════════════════════════════
    // Valid transitions
    // ══════════════════════════════════════════

    public function test_forming_to_ready_for_bidding(): void
    {
        $group = $this->makeGroup('FORMING');
        $this->sm->transition($group, 'READY_FOR_BIDDING');
        $this->assertEquals('READY_FOR_BIDDING', $group->fresh()->status);
    }

    public function test_ready_for_bidding_to_ready_for_finalization(): void
    {
        $group = $this->makeGroup('READY_FOR_BIDDING');
        $this->sm->transition($group, 'READY_FOR_FINALIZATION');
        $this->assertEquals('READY_FOR_FINALIZATION', $group->fresh()->status);
    }

    public function test_ready_for_finalization_to_kelompok_final(): void
    {
        $group = $this->makeGroup('READY_FOR_FINALIZATION');
        $this->sm->transition($group, 'KELOMPOK_FINAL');
        $this->assertEquals('KELOMPOK_FINAL', $group->fresh()->status);
    }

    public function test_kelompok_final_to_pdc1_active(): void
    {
        $group = $this->makeGroup('KELOMPOK_FINAL');
        $group->period->update(['is_finalized' => true]);
        $this->sm->transition($group, 'PDC1_ACTIVE');
        $this->assertEquals('PDC1_ACTIVE', $group->fresh()->status);
    }

    public function test_pdc1_active_to_ready_for_sempro(): void
    {
        $group = $this->makeGroup('PDC1_ACTIVE');
        $this->sm->transition($group, 'READY_FOR_SEMPRO');
        $this->assertEquals('READY_FOR_SEMPRO', $group->fresh()->status);
    }

    public function test_ready_for_sempro_to_sempro_done(): void
    {
        $group = $this->makeGroup('READY_FOR_SEMPRO');
        $this->sm->transition($group, 'SEMPRO_DONE');
        $this->assertEquals('SEMPRO_DONE', $group->fresh()->status);
    }

    public function test_sempro_fail_returns_to_pdc1(): void
    {
        $group = $this->makeGroup('READY_FOR_SEMPRO');
        $group->period->update(['is_finalized' => true]);
        $this->sm->transition($group, 'PDC1_ACTIVE');
        $this->assertEquals('PDC1_ACTIVE', $group->fresh()->status);
    }

    public function test_pdc2_active_to_expo_ready(): void
    {
        $group = $this->makeGroup('PDC2_ACTIVE');
        $this->sm->transition($group, 'PDC2_READY_FOR_EXPO');
        $this->assertEquals('PDC2_READY_FOR_EXPO', $group->fresh()->status);
    }

    public function test_expo_registered_to_expo_done(): void
    {
        $group = $this->makeGroup('EXPO_REGISTERED');
        $this->sm->transition($group, 'EXPO_DONE');
        $this->assertEquals('EXPO_DONE', $group->fresh()->status);
    }

    public function test_expo_done_to_pdc2_completed(): void
    {
        $group = $this->makeGroup('EXPO_DONE');
        $this->sm->transition($group, 'PDC2_COMPLETED');
        $this->assertEquals('PDC2_COMPLETED', $group->fresh()->status);
    }

    public function test_pdc2_completed_to_closed(): void
    {
        $group = $this->makeGroup('PDC2_COMPLETED');
        $this->sm->transition($group, 'CLOSED');
        $this->assertEquals('CLOSED', $group->fresh()->status);
    }

    public function test_ready_for_bidding_back_to_forming(): void
    {
        $group = $this->makeGroup('READY_FOR_BIDDING');
        $this->sm->transition($group, 'FORMING');
        $this->assertEquals('FORMING', $group->fresh()->status);
    }

    // ══════════════════════════════════════════
    // Illegal transitions — must throw
    // ══════════════════════════════════════════

    public function test_forming_to_pdc1_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $group = $this->makeGroup('FORMING');
        $this->sm->transition($group, 'PDC1_ACTIVE');
    }

    public function test_pdc1_active_to_expo_done_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $group = $this->makeGroup('PDC1_ACTIVE');
        $this->sm->transition($group, 'EXPO_DONE');
    }

    public function test_closed_to_anything_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $group = $this->makeGroup('CLOSED');
        $this->sm->transition($group, 'FORMING');
    }

    public function test_pdc2_active_to_kelompok_final_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $group = $this->makeGroup('PDC2_ACTIVE');
        $this->sm->transition($group, 'KELOMPOK_FINAL');
    }

    public function test_expo_done_to_pdc1_active_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $group = $this->makeGroup('EXPO_DONE');
        $this->sm->transition($group, 'PDC1_ACTIVE');
    }

    // ══════════════════════════════════════════
    // Helper methods
    // ══════════════════════════════════════════

    public function test_can_transition_returns_true_for_valid(): void
    {
        $this->assertTrue($this->sm->canTransition('FORMING', 'READY_FOR_BIDDING'));
    }

    public function test_can_transition_returns_false_for_invalid(): void
    {
        $this->assertFalse($this->sm->canTransition('FORMING', 'EXPO_DONE'));
    }

    public function test_get_available_transitions(): void
    {
        $group = $this->makeGroup('READY_FOR_BIDDING');
        $transitions = $this->sm->getAvailableTransitions($group);
        $this->assertContains('READY_FOR_FINALIZATION', $transitions);
        $this->assertContains('FORMING', $transitions);
    }

    public function test_is_at_least_ordering(): void
    {
        $group = $this->makeGroup('PDC2_ACTIVE');
        $this->assertTrue($this->sm->isAtLeast($group, 'KELOMPOK_FINAL'));
        $this->assertTrue($this->sm->isAtLeast($group, 'PDC1_ACTIVE'));
        $this->assertFalse($this->sm->isAtLeast($group, 'EXPO_DONE'));
    }

    public function test_status_order_consistency(): void
    {
        // FORMING < READY_FOR_BIDDING < KELOMPOK_FINAL < ... < CLOSED
        $this->assertLessThan(
            $this->sm->statusOrder('PDC1_ACTIVE'),
            $this->sm->statusOrder('FORMING')
        );
        $this->assertLessThan(
            $this->sm->statusOrder('CLOSED'),
            $this->sm->statusOrder('PDC2_COMPLETED')
        );
    }
}
