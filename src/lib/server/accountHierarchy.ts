/**
 * Compatibility shim — project/Twilio/tenant resolution lives in twilio-mappings.
 * Prefer importing from `@/lib/server/twilioMappings`.
 */
export {
  accountHasHierarchyProjects,
  accountHasMappedProjects,
  accountRoleHasMappedProjects,
  getDefaultProjectIdForRole,
  getDefaultProjectIdFromHierarchy,
  getHierarchyProject,
  getMappedProjectScope,
  getTenantIdForMappedProject,
  getTenantIdFromHierarchy,
  getTwilioConfigForMappedProject,
  getTwilioConfigFromHierarchy,
  listHierarchyProjectsForAccount,
  listMappedProjectScopes,
  projectHasTwilio,
  requireTwilioConfigForMappedProject,
  requireTwilioConfigFromHierarchy,
  resolveActiveHierarchyProjectId,
  resolveActiveMappedProjectId,
} from "@/lib/server/twilioMappings";

export type { MappedProjectScope } from "@/lib/twilioMappings";
