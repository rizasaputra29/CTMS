import { Suspense } from 'react';
import { getAdminDashboardData, getPeriods } from '@/lib/server-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PeriodSelector } from '@/components/examples/period-selector';

// Loading skeleton for the dashboard
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[60px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Stats card component (can be Server Component)
async function StatsCards() {
  const data = await getAdminDashboardData();
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Periods</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.periods?.data?.length || 0}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Groups</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.activeGroups?.data?.length || 0}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Scheduled Sempro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.recentSchedules?.data?.length || 0}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.stats?.total_users || 0}</div>
        </CardContent>
      </Card>
    </div>
  );
}

// Period selector wrapper (Server Component fetching data)
async function PeriodSelectorSection() {
  const periods = await getPeriods();
  const activePeriod = periods.data?.find((p: { is_active: boolean }) => p.is_active);
  
  return (
    <PeriodSelector 
      periods={periods.data || []} 
      activePeriod={activePeriod}
    />
  );
}

// Main page component - Server Component
export default async function ExampleServerDashboardPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard (Server Component)</h1>
        
        {/* This component needs client interactivity, so it's a Client Component */}
        <Suspense fallback={<Skeleton className="h-10 w-[200px]" />}>
          <PeriodSelectorSection />
        </Suspense>
      </div>
      
      <Suspense fallback={<DashboardSkeleton />}>
        <StatsCards />
      </Suspense>
    </div>
  );
}
