/* eslint-disable @typescript-eslint/no-explicit-any */
import { useAuthUser, useIsAuthenticated } from "react-auth-kit";
import { UserRole, UserIndustry } from "@/types";

interface PermissionConfig {
  allowedRoles?: UserRole[];
  allowedIndustries?: UserIndustry[];
  requireAll?: boolean; // If true, user must match both role AND industry (if both provided)
}

const isLearnerRole = (role?: UserRole) => role === "TRAINEE" || role === "TESTER";

// Normalize legacy role names to their current equivalents
const normalizeRole = (role: string): string =>
  role === "CEHO" ? "CEHO" : role;

// Hook to check if the current user has permission based on roles and/or industries
export const usePermission = (config: PermissionConfig = {}) => {
  const { allowedRoles, allowedIndustries, requireAll = true } = config;
  const isAuthenticated = useIsAuthenticated();
  const auth = useAuthUser();

  // If user is not authenticated, they have no permissions
  if (!isAuthenticated()) {
    return {
      hasPermission: false,
      isAuthenticated: false,
      userRole: undefined,
      userIndustry: undefined,
    };
  }

  const user = auth();
  const userRoles = (
    user?.roles
      ? Array.isArray(user.roles)
        ? user.roles
        : [user.roles]
      : []
  ).map(normalizeRole);
  const userIndustry = user?.industry;

  // If no restrictions provided, user has permission (authenticated only)
  if (!allowedRoles && !allowedIndustries) {
    return {
      hasPermission: true,
      isAuthenticated: true,
      userRole: userRoles[0],
      userIndustry,
    };
  }

  // Check role permission
  const hasRolePermission = allowedRoles
    ? userRoles.some((role: any) =>
        allowedRoles.some(
          (allowedRole) =>
            allowedRole === role ||
            (isLearnerRole(allowedRole) && isLearnerRole(role)),
        ),
      )
    : true;

  // Check industry permission
  const hasIndustryPermission = allowedIndustries
    ? userIndustry && allowedIndustries.includes(userIndustry)
    : true;

  // Determine final permission based on requireAll flag
  let hasPermission = false;

  if (allowedRoles && allowedIndustries) {
    // Both roles and industries are specified
    hasPermission = requireAll
      ? hasRolePermission && hasIndustryPermission
      : hasRolePermission || hasIndustryPermission;
  } else if (allowedRoles) {
    // Only roles specified
    hasPermission = hasRolePermission;
  } else if (allowedIndustries) {
    // Only industries specified
    hasPermission = hasIndustryPermission;
  }

  return {
    hasPermission,
    isAuthenticated: true,
    userRole: userRoles[0],
    userIndustry,
  };
};
