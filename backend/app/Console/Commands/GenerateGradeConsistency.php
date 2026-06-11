<?php

namespace App\Console\Commands;

use App\Http\Controllers\GradeConsistencyController;
use App\Models\Period;
use Illuminate\Console\Command;
use Illuminate\Http\Request;

class GenerateGradeConsistency extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'grade-consistency:generate 
                            {--period= : Period ID (default: active period)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Auto-generate grade consistency checks from existing assessment scores';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $periodId = $this->option('period');

        if (! $periodId) {
            $periodId = $this->getActivePeriod();
            if (! $periodId) {
                $this->error('No active period found. Please specify --period=<id>');

                return 1;
            }
        }

        // Verify period exists
        $period = Period::find($periodId);
        if (! $period) {
            $this->error("Period {$periodId} not found.");

            return 1;
        }

        $this->info("Generating grade consistency checks for period: {$period->name} (ID: {$periodId})");
        $this->info('This may take a moment...');

        $controller = new GradeConsistencyController;
        $request = new Request(['period_id' => $periodId]);

        try {
            $response = $controller->generate($request);
            $data = json_decode($response->getContent(), true);

            if (isset($data['message'])) {
                $this->info('');
                $this->info('✓ '.$data['message']);
                $this->info('');

                // Show current count
                $count = \App\Models\GradeConsistencyCheck::count();
                $this->info("Total consistency checks in database: {$count}");

                return 0;
            } else {
                $this->error('Unexpected response from controller');

                return 1;
            }
        } catch (\Exception $e) {
            $this->error('Failed: '.$e->getMessage());
            $this->error($e->getTraceAsString());

            return 1;
        }
    }

    /**
     * Get the active period ID.
     */
    private function getActivePeriod(): ?int
    {
        $period = Period::where('is_active', true)->first();

        return $period ? $period->id : null;
    }
}
