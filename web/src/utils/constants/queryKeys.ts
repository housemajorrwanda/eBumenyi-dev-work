export const USER_PROFILE = ["userProfile"];
export const ALL_GROUPED_PERMISSIONS = ["groupedPermissions"];
export const ALL_APP_PERMISSIONS = ["appPermissions"];
export const ALL_USERS = ["users"];
export const UPDATE_PASSWORD = ["updatePassword"];
export const COURSES = ["courses"];
export const STUDENTS = ["students"];
// Query key factory for courses with filters
export const courseKeys = {
  all: ["courses"] as const,
  lists: () => [...courseKeys.all, "list"] as const,
  list: (filter?: string) => [...courseKeys.lists(), filter] as const,
};

// Query key factory for hospitals with filters
export const hospitalKeys = {
  all: ["hospitals"] as const,
  lists: () => [...hospitalKeys.all, "list"] as const,
  list: (filter?: string) => [...hospitalKeys.lists(), filter] as const,
};

// Query key factory for students with filters
export const studentKeys = {
  all: ["students"] as const,
  lists: () => [...studentKeys.all, "list"] as const,
  list: (filter?: string) => [...studentKeys.lists(), filter] as const,
  stats: (filter?: string) => [...studentKeys.all, "stats", filter] as const,
};

export const dashboardKeys = {
  all: ["dashboard"] as const,
  stats: (filters: readonly string[]) =>
    [...dashboardKeys.all, "stats", ...filters] as const,
  adoption: (filters: readonly string[]) =>
    [...dashboardKeys.all, "adoption", ...filters] as const,
  filterOptions: () => [...dashboardKeys.all, "filter-options"] as const,
  learner: () => [...dashboardKeys.all, "learner"] as const,
};
