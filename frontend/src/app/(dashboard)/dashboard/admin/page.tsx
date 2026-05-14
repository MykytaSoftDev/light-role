import { redirect } from "next/navigation";

import { DASHBOARD_PAGES } from "@/constants/nav.constants";

export default function AdminIndexPage() {
  redirect(DASHBOARD_PAGES.ADMIN_USERS);
}
