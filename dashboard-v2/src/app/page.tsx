import { auth } from "@/auth";
import Dashboard from "@/components/Dashboard";
import LandingPage from "@/components/LandingPage";
import { getDashboardData } from "@/lib/data-fetcher";

export default async function Page() {
  const session = await auth();

  if (!session?.user?.id) {
    return <LandingPage />;
  }

  const initialData = await getDashboardData(session.user.id);

  return <Dashboard initialData={initialData} />;
}
