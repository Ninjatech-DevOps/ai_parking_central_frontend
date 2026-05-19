import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  /** Single permission key (e.g. "users:create") */
  permission?: string;
  /** Pass multiple — user needs at least one */
  anyOf?: string[];
  /** What to render if the user lacks permission (default: nothing) */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Conditionally renders children based on user permissions.
 *
 * Usage:
 *   <RequirePermission permission="users:create">
 *     <Button>Add User</Button>
 *   </RequirePermission>
 *
 *   <RequirePermission anyOf={["roles:view", "roles:manage"]}>
 *     <RolesPage />
 *   </RequirePermission>
 */
export default function RequirePermission({ permission, anyOf, fallback = null, children }: Props) {
  const { hasPermission, hasAnyPermission } = useAuth();

  if (permission && !hasPermission(permission)) return <>{fallback}</>;
  if (anyOf && !hasAnyPermission(...anyOf)) return <>{fallback}</>;

  return <>{children}</>;
}
