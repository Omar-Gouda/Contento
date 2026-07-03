import { RouteLoadingSkeleton } from "@/components/dashboard/route-loading-skeleton";

export default function ClientsLoading() {
  return <RouteLoadingSkeleton variant="cards" rows={4} />;
}
