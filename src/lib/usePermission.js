import { useCallback } from "react";
import { useAuth } from "./AuthContext.jsx";
import { useData } from "./DataContext.jsx";
import { allows } from "./permissions.js";

/** can("students") → may view; can("students", "edit") → may add/edit/delete. */
export function usePermission() {
  const { user } = useAuth();
  const { permissions } = useData();
  return useCallback((module, need = "view") => !!user && allows(permissions, module, user.role, need), [user, permissions]);
}
