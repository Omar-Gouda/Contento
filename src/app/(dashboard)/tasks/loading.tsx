import { RouteLoadingSkeleton } from "@/components/dashboard/route-loading-skeleton";

export default function TasksLoading() {
  return <RouteLoadingSkeleton variant="cards" rows={5} />;
}
