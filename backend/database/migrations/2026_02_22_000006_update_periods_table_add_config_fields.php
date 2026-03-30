<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('periods', function (Blueprint $table) {
            $table->dateTime('bidding_start')->nullable()->after('end_date');
            $table->dateTime('bidding_end')->nullable()->after('bidding_start');
            $table->timestamp('bidding_locked_at')->nullable()->after('bidding_end');
            $table->date('pdc1_start')->nullable()->after('bidding_locked_at');
            $table->date('pdc1_end')->nullable()->after('pdc1_start');
            $table->date('pdc2_start')->nullable()->after('pdc1_end');
            $table->date('pdc2_end')->nullable()->after('pdc2_start');
            $table->date('expo_date')->nullable()->after('pdc2_end');
            $table->date('ta_start')->nullable()->after('expo_date');
            $table->date('ta_end')->nullable()->after('ta_start');
            $table->integer('min_group_size')->default(2)->after('ta_end');
            $table->integer('max_group_size')->default(4)->after('min_group_size');
            $table->integer('max_supervise_load')->default(8)->after('max_group_size');
        });
    }

    public function down(): void
    {
        Schema::table('periods', function (Blueprint $table) {
            $table->dropColumn([
                'bidding_start',
                'bidding_end',
                'bidding_locked_at',
                'pdc1_start',
                'pdc1_end',
                'pdc2_start',
                'pdc2_end',
                'expo_date',
                'ta_start',
                'ta_end',
                'min_group_size',
                'max_group_size',
                'max_supervise_load',
            ]);
        });
    }
};
