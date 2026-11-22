import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const POLICY_PATH = path.resolve("analysis/compatibility-policy.json");
const COMPATIBILITY_ONLY_SERVICES = [
  "claude.buddy.Buddy",
  "claude.buddy.BuddyBleTransport",
  "claude.coworkArtifact.CoworkArtifactBridge",
  "claude.internal.ui.QuickWindow",
  "claude.officeAddin.OfficeAddinFiles",
  "claude.settings.CcdCli",
  "claude.settings.ClaudeAiImport",
  "claude.settings.Custom3pHelperRun",
  "claude.settings.Custom3pSetup",
  "claude.settings.SupportBundle",
  "claude.settings.WakeScheduler",
  "claude.skills.Skills",
  "claude.web.Account",
  "claude.web.AgentModeFeedback",
  "claude.web.BuddyRemoteFeed",
  "claude.web.ChromeExtension",
  "claude.web.ClaudeVM",
  "claude.web.ComputerUseTcc",
  "claude.web.CoworkArtifacts",
  "claude.web.CoworkFeedback",
  "claude.web.CoworkFilePreview",
  "claude.web.CoworkMemory",
  "claude.web.CoworkScheduledTasks",
  "claude.web.CoworkSpaces",
  "claude.web.CoworkUserFiles",
  "claude.web.DeviceRegistry",
  "claude.web.DocumentFunnel",
  "claude.web.FindInPageProvider",
  "claude.web.FloatingPenguinMini",
  "claude.web.FramebufferPreview",
  "claude.web.GrandPrix",
  "claude.web.NestDev",
  "claude.web.OpenDocuments",
  "claude.web.QuickEntry",
  "claude.web.Resources",
  "claude.web.Toast",
  "claude.web.WebBuild",
];
const FALLBACK_SERVICES = [
  "claude.web.CCDScheduledTasks",
  "claude.web.CustomPlugins",
  "claude.web.Launch",
  "claude.web.LocalPlugins",
];
const SIGNALS = new Set([
  "claude.web.Account.setAccountDetails",
  "claude.web.CustomPlugins.syncLocalOrgPlugins",
  "claude.web.FindInPageProvider.reportFindResult",
  "claude.web.FindInPageProvider.setProviderActive",
  "claude.web.QuickEntry.setRecentChats",
  "claude.web.Resources.setFindInPageClaimed",
  "claude.web.Resources.setFocusedCwd",
  "claude.web.Resources.setFocusedSshTarget",
  "claude.web.WebBuild.reportCommitHash",
]);
const LIST =
  /^(?:list|getAll|getAgents|getDetectedProjects|getPlugins|getExtensions|getInstalled|getAvailable|getRunningLocalSessions|getTrusted|getSupportedCommands|getSSHConfigs|getLocalBranches|getGitCommits|getPrCommits|getCheckRunAnnotations|getWatcherHistory|getConfiguredServices|getPreviewTabs|getPreviewAllowedOrigins|getConnectedFiles|getOpenDocuments|scanDevices)/;
const BOOLEAN = /^(?:is|has|check|can|should)/;
const MUTATION =
  /^(?:delete|remove|set|update|write|save|archive|unarchive|stop|interrupt|cancel|clear|report|notify|mark|revoke|respond|replace|disconnect|detach|close|hide|show|focus|resize|navigate|open|request|submit|sync|warm|prepare|patch|apply|add|install|uninstall|start|run)/;

function initialPolicy(key, method) {
  if (SIGNALS.has(key)) return "renderer-signal";
  // Mutation prefixes win over ambiguous read prefixes (for example,
  // cancelScan must never be treated as a `can*` boolean query).
  if (MUTATION.test(method)) return "unavailable";
  if (LIST.test(method)) return "empty-array";
  if (BOOLEAN.test(method)) return "false";
  return "null";
}

const contract = JSON.parse(
  await readFile("analysis/ipc-contract.json", "utf8"),
);
const referenceMetadata = JSON.parse(
  await readFile("analysis/reference-metadata.json", "utf8"),
);
const declaredServices = [...COMPATIBILITY_ONLY_SERVICES, ...FALLBACK_SERVICES]
  .filter((service) => Object.hasOwn(contract.services, service))
  .sort();
const expectedCompatibilityOnlyServices = COMPATIBILITY_ONLY_SERVICES.filter(
  (service) => Object.hasOwn(contract.services, service),
).sort();
const expectedFallbackServices = FALLBACK_SERVICES.filter((service) =>
  Object.hasOwn(contract.services, service),
).sort();
const expectedKeys = declaredServices.flatMap((service) =>
  contract.services[service].methods.map(
    ({ method }) => `${service}.${method}`,
  ),
);

if (process.argv.includes("--bootstrap")) {
  const methods = Object.fromEntries(
    expectedKeys.sort().map((key) => {
      const method = key.slice(key.lastIndexOf(".") + 1);
      return [key, initialPolicy(key, method)];
    }),
  );
  await writeFile(
    POLICY_PATH,
    `${JSON.stringify(
      {
        contractVersion: referenceMetadata.version,
        compatibilityOnlyServices: expectedCompatibilityOnlyServices,
        fallbackServices: expectedFallbackServices,
        rendererSignals: [...SIGNALS].filter((key) => key in methods).sort(),
        methods,
      },
      null,
      2,
    )}\n`,
  );
}

const policy = JSON.parse(await readFile(POLICY_PATH, "utf8"));
const actualKeys = Object.keys(policy.methods ?? {}).sort();
const expected = [...new Set(expectedKeys)].sort();
const missing = expected.filter((key) => !actualKeys.includes(key));
const stale = actualKeys.filter((key) => !expected.includes(key));
const invalid = actualKeys.filter(
  (key) =>
    ![
      "empty-array",
      "false",
      "null",
      "renderer-signal",
      "unavailable",
    ].includes(policy.methods[key]),
);
const contractVersionMismatch =
  policy.contractVersion !== referenceMetadata.version
    ? {
        expected: referenceMetadata.version,
        actual: policy.contractVersion ?? null,
      }
    : null;
const serviceListMismatch =
  JSON.stringify(policy.compatibilityOnlyServices ?? []) !==
    JSON.stringify(expectedCompatibilityOnlyServices) ||
  JSON.stringify(policy.fallbackServices ?? []) !==
    JSON.stringify(expectedFallbackServices)
    ? {
        expectedCompatibilityOnlyServices,
        actualCompatibilityOnlyServices:
          policy.compatibilityOnlyServices ?? null,
        expectedFallbackServices,
        actualFallbackServices: policy.fallbackServices ?? null,
      }
    : null;
if (
  missing.length ||
  stale.length ||
  invalid.length ||
  contractVersionMismatch ||
  serviceListMismatch
)
  throw new Error(
    `Compatibility policy drifted from the recovered contract: ${JSON.stringify({ missing, stale, invalid, contractVersionMismatch, serviceListMismatch })}`,
  );
process.stdout.write(
  `Verified explicit compatibility policy for ${actualKeys.length} methods across ${declaredServices.length} services.\n`,
);
