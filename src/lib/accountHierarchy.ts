/**
 * Compatibility shim — mapping types and helpers live in `@/lib/twilioMappings`.
 * Legacy account-hierarchy.json helpers are no longer used at runtime.
 */
export type {
  HierarchyProjectPublic,
  MappedProjectPublic,
  MappedProjectScope,
  MappedScopeAccount,
  TwilioMappingEntry,
  TwilioMappingProject,
  TwilioMappingsFile,
} from "@/lib/twilioMappings";

export {
  getMappedDefaultProjectId,
  getMappedProject,
  getMappedTenantId,
  getMappingEntry,
  isTwilioMappingsFile,
  listMappedProjects,
  listMappedRolesForAccount,
  listMappedScope,
  mappedProjectHasTwilio,
  mappingKey,
  parseMappingKey,
  toMappedProjectScope,
  toPublicHierarchyProject,
} from "@/lib/twilioMappings";
