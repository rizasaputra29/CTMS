<?php

namespace App\Services;

use App\Models\Period;

class BiddingService
{
    /**
     * Check if bidding window is currently open.
     */
    public function isWindowOpen(Period $period): bool
    {
        return $period->isBiddingOpen();
    }

    /**
     * Check if bidding is locked (admin locked or bidding_end passed).
     */
    public function isBiddingLocked(Period $period): bool
    {
        return $period->isBiddingLocked();
    }

    /**
     * Manually lock bidding (admin action).
     */
    public function lockBidding(Period $period): void
    {
        $period->update(['bidding_locked_at' => now()]);
    }

    /**
     * Manually unlock bidding (admin action).
     */
    public function unlockBidding(Period $period): void
    {
        $period->update(['bidding_locked_at' => null]);
    }
}
