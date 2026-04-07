<?php

return [
    App\Providers\AppServiceProvider::class,
    // Custom Neon PostgreSQL connection provider - MUST be registered early
    // to fix boolean casting issues with ATTR_EMULATE_PREPARES
    App\Providers\NeonConnectionServiceProvider::class,
];
