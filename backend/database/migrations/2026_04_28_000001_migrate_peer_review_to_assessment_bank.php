<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Step 1: Create migration tracking table first
        Schema::create('peer_review_migration_log', function (Blueprint $table) {
            $table->id();
            $table->integer('old_template_id');
            $table->integer('new_template_id');
            $table->string('template_name');
            $table->timestamps();
        });

        // Step 2: Add new column for assessment_template_id
        Schema::table('period_peer_review_indicators', function (Blueprint $table) {
            $table->foreignId('assessment_template_id')->nullable()->after('template_id')->constrained('assessment_component_templates')->nullOnDelete();
        });

        // Step 3: Migrate data from PeerReviewIndicatorTemplate to AssessmentComponentTemplate
        $this->migrateTemplates();

        // Step 4: Update period_peer_review_indicators to reference new templates
        $this->updatePeriodIndicators();

        // Step 5: Drop old unique index, foreign key and column
        Schema::table('period_peer_review_indicators', function (Blueprint $table) {
            $table->dropUnique(['period_id', 'template_id']);
            $table->dropForeign(['template_id']);
            $table->dropColumn('template_id');
        });

        // Step 6: Rename assessment_template_id to template_id
        Schema::table('period_peer_review_indicators', function (Blueprint $table) {
            $table->renameColumn('assessment_template_id', 'template_id');
        });

        // Step 7: Make template_id not nullable and add foreign key constraint
        Schema::table('period_peer_review_indicators', function (Blueprint $table) {
            $table->foreign('template_id')->references('id')->on('assessment_component_templates')->onDelete('cascade');
            $table->unique(['period_id', 'template_id']);
        });
    }

    public function down(): void
    {
        // Reverse the migration
        Schema::table('period_peer_review_indicators', function (Blueprint $table) {
            $table->dropForeign(['template_id']);
            $table->renameColumn('template_id', 'assessment_template_id');
            $table->foreignId('template_id')->nullable()->constrained('peer_review_indicator_templates')->nullOnDelete();
        });

        // Note: Restoring data would require the migration log
        Schema::dropIfExists('peer_review_migration_log');
    }

    private function migrateTemplates(): void
    {
        $oldTemplates = DB::table('peer_review_indicator_templates')->get();
        
        foreach ($oldTemplates as $oldTemplate) {
            // Generate code from name (kebab-case uppercase with PR- prefix)
            $code = $this->generateCode($oldTemplate->name);
            
            // Check if assessment template with this code already exists
            $existingTemplate = DB::table('assessment_component_templates')
                ->where('code', $code)
                ->first();
            
            if ($existingTemplate) {
                // Use existing template
                $newTemplateId = $existingTemplate->id;
            } else {
                // Create new assessment component template
                $newTemplateId = DB::table('assessment_component_templates')->insertGetId([
                    'code' => $code,
                    'name' => $oldTemplate->name,
                    'description' => $oldTemplate->description,
                    'weight' => $oldTemplate->weight,
                    'is_active' => $oldTemplate->is_active,
                    'created_by' => $oldTemplate->created_by,
                    'sort_order' => $oldTemplate->sort_order,
                    'created_at' => $oldTemplate->created_at,
                    'updated_at' => now(),
                ]);
            }
            
            // Log the migration
            DB::table('peer_review_migration_log')->insert([
                'old_template_id' => $oldTemplate->id,
                'new_template_id' => $newTemplateId,
                'template_name' => $oldTemplate->name,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function updatePeriodIndicators(): void
    {
        $migrationLog = DB::table('peer_review_migration_log')->get();
        
        foreach ($migrationLog as $log) {
            DB::table('period_peer_review_indicators')
                ->where('template_id', $log->old_template_id)
                ->update(['assessment_template_id' => $log->new_template_id]);
        }
    }

    private function generateCode(string $name): string
    {
        // Convert to kebab-case uppercase
        $code = strtoupper(
            preg_replace('/[^a-zA-Z0-9]+/', '-', $name)
        );
        
        // Remove leading/trailing dashes
        $code = trim($code, '-');
        
        // Add PR- prefix
        return 'PR-' . $code;
    }
};
