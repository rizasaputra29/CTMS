import { useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

// Query keys for prefetching
const queryKeys = {
  admin: {
    dashboard: ["admin", "dashboard"],
    periods: ["admin", "periods"],
    groups: ["admin", "groups"],
  },
  dosen: {
    dashboard: (periodId?: string) => ["dosen", "dashboard", periodId],
    supervised: (periodId?: string) => ["dosen", "supervised", periodId],
    evalCount: ["dosen", "eval-count"],
  },
  mahasiswa: {
    myPeriod: ["mahasiswa", "my-period"],
    dashboard: ["mahasiswa", "dashboard"],
    workflow: ["mahasiswa", "workflow"],
  },
};

// Fetch functions
const fetchAdminDashboard = async () => {
  const response = await api.get("/admin/dashboard");
  return response.data;
};

const fetchAdminPeriods = async () => {
  const response = await api.get("/admin/periods");
  return response.data;
};

const fetchAdminGroups = async () => {
  const response = await api.get("/admin/groups", { params: { per_page: 5 } });
  return response.data;
};

const fetchDosenDashboard = async (periodId?: string) => {
  const params = periodId ? { period_id: periodId } : undefined;
  const response = await api.get("/dosen/dashboard", { params });
  return response.data;
};

const fetchDosenSupervised = async (periodId?: string) => {
  const params = periodId ? { period_id: periodId } : undefined;
  const response = await api.get("/dosen/groups/supervised", { params });
  return response.data;
};

const fetchDosenEvalCount = async () => {
  const response = await api.get("/dosen/supervisor-evaluation/pending-count");
  return response.data;
};

const fetchMahasiswaMyPeriod = async () => {
  const response = await api.get("/mahasiswa/my-period");
  return response.data;
};

const fetchMahasiswaDashboard = async () => {
  const response = await api.get("/mahasiswa/dashboard");
  return response.data;
};

const fetchMahasiswaWorkflow = async () => {
  const response = await api.get("/mahasiswa/dashboard/workflow");
  return response.data;
};

export function usePrefetchDashboards() {
  const queryClient = useQueryClient();

  const prefetchAdminDashboards = async () => {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.admin.dashboard,
        queryFn: fetchAdminDashboard,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.admin.periods,
        queryFn: fetchAdminPeriods,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.admin.groups,
        queryFn: fetchAdminGroups,
      }),
    ]);
  };

  const prefetchDosenDashboards = async () => {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.dosen.dashboard(undefined),
        queryFn: () => fetchDosenDashboard(undefined),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.dosen.supervised(undefined),
        queryFn: () => fetchDosenSupervised(undefined),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.dosen.evalCount,
        queryFn: fetchDosenEvalCount,
      }),
    ]);
  };

  const prefetchMahasiswaDashboards = async () => {
    const [periodData, _dashboardData] = await Promise.all([
      queryClient.fetchQuery({
        queryKey: queryKeys.mahasiswa.myPeriod,
        queryFn: fetchMahasiswaMyPeriod,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.mahasiswa.dashboard,
        queryFn: fetchMahasiswaDashboard,
      }),
    ]);

    // Also prefetch workflow if group is approved
    if (periodData?.period) {
      const dashboardData = (await queryClient.getQueryData(
        queryKeys.mahasiswa.dashboard
      )) as { has_group?: boolean; group_status?: string } | undefined;
      if (dashboardData?.has_group) {
        const isGroupApproved = ![
          "FORMING",
          "FORMING_SOLO",
          "READY_FOR_BIDDING",
          "REJECTED",
        ].includes(dashboardData.group_status ?? "");
        if (isGroupApproved) {
          await queryClient.prefetchQuery({
            queryKey: queryKeys.mahasiswa.workflow,
            queryFn: fetchMahasiswaWorkflow,
          });
        }
      }
    }
  };

  const prefetchAllDashboards = async (roles: string[]) => {
    const prefetchPromises: Promise<void>[] = [];

    if (roles.includes("admin")) {
      prefetchPromises.push(prefetchAdminDashboards());
    }

    if (roles.includes("dosen")) {
      prefetchPromises.push(prefetchDosenDashboards());
    }

    if (roles.includes("mahasiswa")) {
      prefetchPromises.push(prefetchMahasiswaDashboards());
    }

    await Promise.all(prefetchPromises);
  };

  return {
    prefetchAdminDashboards,
    prefetchDosenDashboards,
    prefetchMahasiswaDashboards,
    prefetchAllDashboards,
  };
}
