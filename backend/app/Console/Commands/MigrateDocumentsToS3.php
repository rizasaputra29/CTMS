<?php

namespace App\Console\Commands;

use App\Models\Document;
use App\Models\ExpoStudentDocument;
use App\Services\DocumentStorageService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class MigrateDocumentsToS3 extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'documents:migrate-to-s3 
                            {--batch=100 : Number of documents to process per batch}
                            {--dry-run : Show what would be migrated without making changes}
                            {--type=all : Type of documents to migrate (all, documents, expo)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Migrate existing local documents to MinIO S3 storage';

    protected DocumentStorageService $documentStorage;

    public function __construct(DocumentStorageService $documentStorage)
    {
        parent::__construct();
        $this->documentStorage = $documentStorage;
    }

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $isDryRun = $this->option('dry-run');
        $batchSize = (int) $this->option('batch');
        $type = $this->option('type');

        $this->info('=== Document Migration to S3 ===');
        $this->info('Mode: '.($isDryRun ? 'DRY RUN' : 'LIVE'));
        $this->info("Batch size: {$batchSize}");
        $this->info("Document types: {$type}");
        $this->newLine();

        $totalStats = [
            'documents' => ['processed' => 0, 'success' => 0, 'failed' => 0],
            'expo_documents' => ['processed' => 0, 'success' => 0, 'failed' => 0],
        ];

        // Migrate Documents table
        if ($type === 'all' || $type === 'documents') {
            $totalStats['documents'] = $this->migrateDocuments($isDryRun, $batchSize);
        }

        // Migrate ExpoStudentDocuments table
        if ($type === 'all' || $type === 'expo') {
            $totalStats['expo_documents'] = $this->migrateExpoDocuments($isDryRun, $batchSize);
        }

        // Summary
        $this->newLine();
        $this->info('=== Migration Summary ===');
        $this->table(
            ['Table', 'Processed', 'Success', 'Failed', 'Remaining'],
            [
                [
                    'documents',
                    $totalStats['documents']['processed'],
                    $totalStats['documents']['success'],
                    $totalStats['documents']['failed'],
                    Document::whereNull('storage_location')
                        ->orWhere('storage_location', 'local')
                        ->count(),
                ],
                [
                    'expo_student_documents',
                    $totalStats['expo_documents']['processed'],
                    $totalStats['expo_documents']['success'],
                    $totalStats['expo_documents']['failed'],
                    ExpoStudentDocument::whereNull('storage_location')
                        ->orWhere('storage_location', 'local')
                        ->count(),
                ],
            ]
        );

        $totalProcessed = $totalStats['documents']['processed'] + $totalStats['expo_documents']['processed'];
        $totalSuccess = $totalStats['documents']['success'] + $totalStats['expo_documents']['success'];
        $totalFailed = $totalStats['documents']['failed'] + $totalStats['expo_documents']['failed'];

        $this->newLine();
        if ($isDryRun) {
            $this->info("Dry run complete. {$totalProcessed} files would be migrated.");
        } else {
            if ($totalFailed === 0) {
                $this->info("✓ Migration complete! {$totalSuccess}/{$totalProcessed} files migrated successfully.");
            } else {
                $this->warn("Migration complete with issues: {$totalSuccess} success, {$totalFailed} failed.");
            }
        }

        return $totalFailed === 0 ? self::SUCCESS : self::FAILURE;
    }

    /**
     * Migrate documents from the documents table.
     *
     * @return array{processed: int, success: int, failed: int}
     */
    private function migrateDocuments(bool $isDryRun, int $batchSize): array
    {
        $this->info('Migrating documents table...');

        $stats = ['processed' => 0, 'success' => 0, 'failed' => 0];

        $query = Document::whereNull('storage_location')
            ->orWhere('storage_location', 'local')
            ->whereNotNull('file_path');

        $totalToMigrate = $query->count();
        $this->info("Found {$totalToMigrate} documents to migrate");

        if ($totalToMigrate === 0) {
            return $stats;
        }

        $bar = $this->output->createProgressBar($totalToMigrate);
        $bar->start();

        $query->chunkById($batchSize, function ($documents) use ($isDryRun, &$stats, $bar) {
            foreach ($documents as $document) {
                $stats['processed']++;

                // Check if file exists locally
                if (! Storage::disk('public')->exists($document->file_path)) {
                    $bar->setMessage("File not found: {$document->file_path}");
                    $stats['failed']++;
                    $bar->advance();

                    continue;
                }

                if ($isDryRun) {
                    $bar->setMessage("Would migrate: {$document->file_path}");
                    $bar->advance();

                    continue;
                }

                // Migrate file to S3
                $success = $this->documentStorage->migrateToS3($document->file_path);

                if ($success) {
                    // Update database record
                    $document->update(['storage_location' => 's3']);
                    $stats['success']++;
                    $bar->setMessage("Migrated: {$document->file_path}");
                } else {
                    $stats['failed']++;
                    $bar->setMessage("Failed: {$document->file_path}");
                }

                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine();

        return $stats;
    }

    /**
     * Migrate documents from the expo_student_documents table.
     *
     * @return array{processed: int, success: int, failed: int}
     */
    private function migrateExpoDocuments(bool $isDryRun, int $batchSize): array
    {
        $this->info('Migrating expo_student_documents table...');

        $stats = ['processed' => 0, 'success' => 0, 'failed' => 0];

        $query = ExpoStudentDocument::whereNull('storage_location')
            ->orWhere('storage_location', 'local')
            ->whereNotNull('file_path');

        $totalToMigrate = $query->count();
        $this->info("Found {$totalToMigrate} expo documents to migrate");

        if ($totalToMigrate === 0) {
            return $stats;
        }

        $bar = $this->output->createProgressBar($totalToMigrate);
        $bar->start();

        $query->chunkById($batchSize, function ($documents) use ($isDryRun, &$stats, $bar) {
            foreach ($documents as $document) {
                $stats['processed']++;

                // Check if file exists locally
                if (! Storage::disk('public')->exists($document->file_path)) {
                    $bar->setMessage("File not found: {$document->file_path}");
                    $stats['failed']++;
                    $bar->advance();

                    continue;
                }

                if ($isDryRun) {
                    $bar->setMessage("Would migrate: {$document->file_path}");
                    $bar->advance();

                    continue;
                }

                // Migrate file to S3
                $success = $this->documentStorage->migrateToS3($document->file_path);

                if ($success) {
                    // Update database record
                    $document->update(['storage_location' => 's3']);
                    $stats['success']++;
                    $bar->setMessage("Migrated: {$document->file_path}");
                } else {
                    $stats['failed']++;
                    $bar->setMessage("Failed: {$document->file_path}");
                }

                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine();

        return $stats;
    }
}
