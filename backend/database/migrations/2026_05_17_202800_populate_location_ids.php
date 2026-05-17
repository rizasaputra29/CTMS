<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Populate location_id for existing schedules by matching room names to locations.
     */
    public function up(): void
    {
        // Get all locations for reference
        $locations = DB::table('locations')->get();
        $locationMap = [];
        
        foreach ($locations as $location) {
            $locationMap[strtolower(trim($location->name))] = $location->id;
        }
        
        // Update SEMPRO schedules
        $semproSchedules = DB::table('seminar_schedules')
            ->whereNull('location_id')
            ->whereNotNull('room')
            ->get();
            
        foreach ($semproSchedules as $schedule) {
            $roomName = strtolower(trim($schedule->room));
            $locationId = $locationMap[$roomName] ?? null;
            
            if ($locationId) {
                DB::table('seminar_schedules')
                    ->where('id', $schedule->id)
                    ->update(['location_id' => $locationId]);
            }
        }
        
        // Update TA_DEFENSE schedules
        $taSchedules = DB::table('ta_defense_schedules')
            ->whereNull('location_id')
            ->whereNotNull('room')
            ->get();
            
        foreach ($taSchedules as $schedule) {
            $roomName = strtolower(trim($schedule->room));
            $locationId = $locationMap[$roomName] ?? null;
            
            if ($locationId) {
                DB::table('ta_defense_schedules')
                    ->where('id', $schedule->id)
                    ->update(['location_id' => $locationId]);
            }
        }
        
        // Log results
        $semproUpdated = DB::table('seminar_schedules')->whereNotNull('location_id')->count();
        $taUpdated = DB::table('ta_defense_schedules')->whereNotNull('location_id')->count();
        
        echo "Migration completed: {$semproUpdated} SEMPRO and {$taUpdated} TA_DEFENSE schedules have location_id.\n";
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No need to reverse - location_id population is idempotent
    }
};