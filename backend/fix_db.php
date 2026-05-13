<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

Schema::table('period_peer_review_indicators', function (Blueprint $table) {
    $table->dropForeign(['assessment_template_id']);
    $table->dropColumn('assessment_template_id');
});
