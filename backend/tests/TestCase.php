<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    public function actingAs($user, $guard = null)
    {
        return parent::actingAs($user, $guard ?? 'sanctum');
    }
}
