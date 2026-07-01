import { redirect } from "next/navigation";

import { routes } from "@/constants/routes";

export default function LegacyContentReviewsPage() {
  redirect(routes.reviews.content);
}
