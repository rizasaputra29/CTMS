<?php

namespace App\Database;

use Illuminate\Database\PostgresConnection;

/**
 * Custom PostgreSQL connection for Neon Database with PgBouncer.
 *
 * This class fixes the boolean casting issue when using ATTR_EMULATE_PREPARES => true
 * with PostgreSQL. The default Laravel behavior converts booleans to integers (0/1),
 * but PostgreSQL requires actual boolean values (true/false).
 *
 * This connection overrides prepareBindings to convert boolean values to their
 * string representation ('true'/'false') which PostgreSQL interprets correctly.
 */
class NeonPostgresConnection extends PostgresConnection
{
    /**
     * Prepare the query bindings for execution.
     *
     * Overrides the parent method to convert boolean values to 'true'/'false' strings
     * instead of integers (1/0), which is necessary for proper PostgreSQL boolean
     * handling with emulated prepared statements.
     */
    public function prepareBindings(array $bindings): array
    {
        $grammar = $this->getQueryGrammar();

        foreach ($bindings as $key => $value) {
            // Transform DateTimeInterface instances to date strings
            if ($value instanceof \DateTimeInterface) {
                $bindings[$key] = $value->format($grammar->getDateFormat());
            } elseif (is_bool($value)) {
                // Convert boolean to 'true'/'false' string for PostgreSQL compatibility
                // When using ATTR_EMULATE_PREPARES, PDO converts booleans to integers (1/0)
                // but PostgreSQL requires actual boolean literals 'true'/'false'
                $bindings[$key] = $value ? 'true' : 'false';
            }
        }

        return $bindings;
    }
}
