import { auth } from "@/auth";
import LandingPage from "@/components/LandingPage";

export default async function Page() {
  const session = await auth();

  if (!session?.user?.id) {
    return <LandingPage />;
  }

  const [{ default: Dashboard }, { getDashboardData }] = await Promise.all([
    import("@/components/Dashboard"),
    import("@/lib/data-fetcher"),
  ]);

  const initialData = await getDashboardData(session.user.id);

  return <Dashboard initialData={initialData} />;
}
