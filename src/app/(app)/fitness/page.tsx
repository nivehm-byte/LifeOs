import { todayInSAST }                from "@/lib/utils/date";
import { getActivePlanWithSessions } from "@/lib/fitness/queries";
import { FitnessDashboard }          from "@/components/fitness/FitnessDashboard";

export const dynamic = "force-dynamic";

export default async function FitnessPage() {
  const today = todayInSAST();
  const data  = await getActivePlanWithSessions().catch(() => null);

  return <FitnessDashboard data={data} today={today} />;
}
