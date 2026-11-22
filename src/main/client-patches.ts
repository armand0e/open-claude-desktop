// The retained-client patch catalog and matcher. Each stable patch intent has
// an exact retained-snapshot anchor and may add exact anchors for later
// renderer families. Edits are applied only to the served in-memory copy; the
// strict matcher throws unless exactly one variant matches its declared count.
// Electron-free so tests and the snapshot migrator exercise the same engine.
import { constants as fsConstants } from "node:fs";
import { open, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { resolveInside } from "../shared/security";

const MAX_PATCH_ASSET_BYTES = 64 * 1024 * 1024;

function pathIsInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!path.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`))
  );
}

async function readPatchAsset(
  canonicalRoot: string,
  candidate: string,
): Promise<{ path: string; source: string } | null> {
  try {
    const canonical = await realpath(candidate);
    if (!pathIsInside(canonicalRoot, canonical)) return null;
    const handle = await open(
      canonical,
      fsConstants.O_RDONLY |
        (process.platform === "win32" ? 0 : fsConstants.O_NOFOLLOW),
    );
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size > MAX_PATCH_ASSET_BYTES) return null;
      const confirmed = await realpath(canonical);
      if (!pathIsInside(canonicalRoot, confirmed)) return null;
      const confirmedInfo = await stat(confirmed);
      if (confirmedInfo.dev !== info.dev || confirmedInfo.ino !== info.ino)
        return null;
      const bytes = await handle.readFile();
      if (bytes.byteLength > MAX_PATCH_ASSET_BYTES) return null;
      return {
        path: confirmed,
        source: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      };
    } finally {
      await handle.close();
    }
  } catch {
    return null;
  }
}

export interface ClientPatchVariant {
  /** Human-readable renderer family or migration note for this anchor. */
  label?: string;
  find: string | RegExp;
  replace: string;
  assetUrlPath?: string;
  expectedMatches?: number;
  scopeToAsset?: boolean;
}

export interface ClientPatch extends ClientPatchVariant {
  id: string;
  /**
   * Alternate semantic anchors for later renderer families. The first entry
   * above remains the retained-snapshot anchor; migrations add a variant
   * instead of replacing history or cloning the entire patch table.
   */
  variants?: readonly ClientPatchVariant[];
  /**
   * Exact renderer releases where the old mutation is no longer applicable.
   * These dispositions are deliberately version-scoped: a new snapshot must
   * be audited again instead of inheriting an optimistic skip.
   */
  satisfiedVersions?: Readonly<Record<string, string>>;
}

export type ClientPatchStatus =
  "applied" | "satisfied" | "missing" | "ambiguous" | "asset-unavailable";

export interface ClientPatchVariantResult {
  label: string;
  assetUrlPath?: string;
  expectedMatches: number;
  occurrences: number;
  matchedAssets: string[];
  assetAvailable: boolean;
}

export interface ClientPatchResult {
  id: string;
  status: ClientPatchStatus;
  selectedVariant?: string;
  satisfiedReason?: string;
  variants: ClientPatchVariantResult[];
}

export interface ClientPatchReport {
  mode: "strict" | "compatible";
  total: number;
  applied: number;
  satisfied: number;
  unresolved: number;
  results: ClientPatchResult[];
}

export interface ApplyClientPatchOptions {
  /** Strict is mandatory for normal runtime and packaging. */
  mode?: "strict" | "compatible";
  /** Migration analysis can search lazy chunks when a feature moved files. */
  scanAllAssets?: boolean;
  /** Exact retained renderer release used for version-scoped dispositions. */
  rendererVersion?: string;
  /** Receives the complete report even when strict mode is about to throw. */
  onReport?: (report: ClientPatchReport) => void;
}

// The packaged desktop web client defaults /new into a VM-backed task flow.
// Local mode needs the ordinary web-chat route, whose HTTP/SSE contract
// can be implemented by LocalBackend. Apply this only while serving our private
// in-memory copy; the installed Anthropic asset is never modified.
export const DISABLED_PATCH_IDS = new Set(
  (process.env.CLAUDE_LOCAL_DISABLE_PATCHES ?? "").split(","),
);

const RETAINED_I18N_LOCALES = [
  "de-DE",
  "en-US",
  "es-419",
  "es-ES",
  "fr-FR",
  "hi-IN",
  "id-ID",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "pt-BR",
] as const;

const RETAINED_I18N_NAMESPACE_PATCHES: readonly ClientPatch[] =
  RETAINED_I18N_LOCALES.flatMap((locale) => [
    {
      id: `reserve-claude-namespace-in-${locale}-messages`,
      assetUrlPath: `/i18n/${locale}.json`,
      find: /(?<![A-Za-z0-9])\.claude(?=(?:\\[\\/]|[\\/\[]))/gu,
      replace: ".open-claude",
      expectedMatches: 5,
      scopeToAsset: true,
    },
    {
      id: `replace-claude-local-namespace-in-${locale}-messages`,
      assetUrlPath: `/i18n/${locale}.json`,
      find: /(?<![A-Za-z0-9])\.claude\.local(?=(?:\\[\\/]|[\\/\[]))/gu,
      replace: ".open-claude/local",
      expectedMatches: 1,
      scopeToAsset: true,
    },
  ]);

const SATISFIED_12401211_EXTENSIONS = Object.freeze({
  "1.24012.11":
    "Desktop Extensions is explicitly unavailable in the standalone product: its capability reports false and mutation handlers reject, so its unreachable modal subroutes are retired.",
});
const SATISFIED_12401211_CONNECTORS = Object.freeze({
  "1.24012.11":
    "The native Connectors surface and unified directory render their Browse action and local connector inventory in the release-specific settings and connector probes.",
});
const SATISFIED_12401211_SKILL_ROWS = Object.freeze({
  "1.24012.11":
    "The moved native Code tool-row implementation already renders the locally backed Skill tool treatment; the retained cosmetic row mutations no longer match this release family.",
});
const SATISFIED_12401211_ATTACHMENTS = Object.freeze({
  "1.24012.11":
    "The release-specific attachment smoke sends the selected local file body to the provider and persists the completed conversation without the old targetStore mutation.",
});
const SATISFIED_12401211_CODE = Object.freeze({
  "1.24012.11":
    "The native Code route launches and resolves UUID local sessions through LocalSessions in the release-specific Code smoke.",
});
const SATISFIED_12401211_BROWSER = Object.freeze({
  "1.24012.11":
    "The release-specific native Browser probe opens, activates, navigates, captures, and closes multiple local preview tabs, including the New tab control.",
});
const SATISFIED_12401211_SCHEDULED = Object.freeze({
  "1.24012.11":
    "The native Scheduled route lists, creates, runs, persists, and deletes locally backed routines in the release-specific scheduled probes.",
});
const SATISFIED_12401211_MCP = Object.freeze({
  "1.24012.11":
    "The native Connectors UI and MCP initialize, tools/list, and tools/call lifecycle pass against the local bridge in this release.",
});
const SATISFIED_12401211_PROJECTS = Object.freeze({
  "1.24012.11":
    "The native project page exposes edit/upload controls and persists and rehydrates uploaded knowledge files in the release-specific project probe.",
});

export const LOCAL_CLIENT_PATCHES: readonly ClientPatch[] = [
  ...RETAINED_I18N_NAMESPACE_PATCHES,
  {
    id: "localize-general-instructions-copy",
    assetUrlPath: "/i18n/en-US.json",
    find: '"9t2atF49M0": "Claude will keep these in mind across chats and Cowork within <aupLink>Anthropic’s guidelines</aupLink>. <learnMoreLink>Learn more</learnMoreLink>"',
    replace:
      '"9t2atF49M0": "Claude Local will keep these in mind across chats on this device."',
  },
  {
    id: "simplify-local-artifact-publish-copy",
    assetUrlPath: "/i18n/en-US.json",
    find: '"zG4O5rdNXZ": "Publishing this Artifact will make it accessible to anyone on the internet and potentially visible in search engine results. Your chat will remain private."',
    replace:
      '"zG4O5rdNXZ": "Create a link that opens this artifact. Your chat will remain private."',
  },
  {
    id: "rename-local-artifact-publish-action",
    assetUrlPath: "/i18n/en-US.json",
    find: '"q8Svey6avC": "Publish & copy link"',
    replace: '"q8Svey6avC": "Create & copy link"',
  },
  {
    id: "define-local-chat-route-component",
    find: "Yrs={withSidebar:[],root:[]},Qrs=(()=>",
    // Keying the chat route on the artifact URL parameters lets the local
    // shell remount a chat in place with a single same-path navigation when
    // the retained pane store has gone stale (see local-workbench.ts), with
    // no visible detour through another route.
    replace:
      'Yrs={withSidebar:[],root:[]},Lcs=()=>{const{uuid:e}=fO(),a=new URLSearchParams(location.search);return t.jsx(onn,{uuid:e},e+"|"+(a.get("artifactId")||"")+"|"+(a.get("localReopen")||""))},Qrs=(()=>',
    variants: [
      {
        label: "1.24012.9 chat route component",
        assetUrlPath: "/assets/v1/index-C9LAU4f-.js",
        scopeToAsset: true,
        find: "K5={withSidebar:[],root:[]},Y5=(()=>",
        replace:
          'K5={withSidebar:[],root:[]},openClaudeChatRoute=()=>{const{uuid:e}=Es(),t=new URLSearchParams(location.search);return(0,RT.jsx)(rL,{uuid:e},e+"|"+(t.get("artifactId")||"")+"|"+(t.get("localReopen")||""))},Y5=(()=>',
      },
    ],
  },
  {
    id: "restore-web-chat-routes",
    find: "t=t=>fZ({getParentRoute:()=>yns,path:t,beforeLoad:e})",
    replace:
      't=t=>fZ({getParentRoute:()=>yns,path:t,...("new"===t?{component:$rn}:"chat/$uuid"===t?{component:Lcs}:{beforeLoad:e})})',
    variants: [
      {
        label: "1.24012.9 web chat routes",
        assetUrlPath: "/assets/v1/index-C9LAU4f-.js",
        scopeToAsset: true,
        find: "t=t=>Pu({getParentRoute:()=>C2,path:t,beforeLoad:e})",
        replace:
          't=t=>Pu({getParentRoute:()=>C2,path:t,...("new"===t?{component:xP}:"chat/$uuid"===t?{component:openClaudeChatRoute}:{beforeLoad:e})})',
      },
    ],
  },
  {
    id: "mount-web-chat-composer-on-restored-new-route",
    // The stable .9 router anchor still exists in .11, but its xP symbol was
    // reassigned to a task-only composer that supplies onSessionCreate and no
    // web-chat onCreate callback. Rewrite the result of the portable route
    // patch to .11's native web-chat composer instead.
    find: /t=t=>Pu\(\{getParentRoute:\(\)=>C2,path:t,(?:beforeLoad:e|\.\.\.\("new"===t\?\{component:xP\}:"chat\/\$uuid"===t\?\{component:openClaudeChatRoute\}:\{beforeLoad:e\}\))\}\)/gu,
    replace:
      't=t=>Pu({getParentRoute:()=>C2,path:t,...("new"===t?{component:vO}:"chat/$uuid"===t?{component:openClaudeChatRoute}:{beforeLoad:e})})',
    satisfiedVersions: {
      "1.22209.0":
        "The retained route patch already mounts its native web-chat composer symbol.",
      "1.24012.9":
        "In this release xP is the native web-chat composer and passed local conversation creation.",
    },
  },
  {
    id: "keep-chat-new-on-native-chat-landing",
    find: 'n=_O?fZ({getParentRoute:()=>yns,path:"chat/new",component:fXt}):null',
    replace:
      'n=_O?fZ({getParentRoute:()=>yns,path:"chat/new",component:$rn}):null',
    variants: [
      {
        label: "1.24012.9 native chat landing",
        assetUrlPath: "/assets/v1/index-C9LAU4f-.js",
        scopeToAsset: true,
        find: 's=rs?Pu({getParentRoute:()=>C2,path:"chat/new",component:xP}):null',
        replace: 's=Pu({getParentRoute:()=>C2,path:"chat/new",component:xP})',
      },
    ],
  },
  {
    id: "mount-web-chat-composer-on-chat-new",
    find: /s=(?:rs\?Pu\(\{getParentRoute:\(\)=>C2,path:"chat\/new",component:xP\}\):null|Pu\(\{getParentRoute:\(\)=>C2,path:"chat\/new",component:xP\}\))/gu,
    replace: 's=Pu({getParentRoute:()=>C2,path:"chat/new",component:vO})',
    satisfiedVersions: {
      "1.22209.0":
        "The retained native chat landing already mounts its web-chat composer symbol.",
      "1.24012.9":
        "In this release xP is the native web-chat composer and passed local conversation creation.",
    },
  },
  {
    id: "keep-new-route-in-web-chat",
    find: "}(l);e.useEffect(()=>{u&&!l&&d.replace(u)},[u,l,d]);",
    replace: "}(true);e.useEffect(()=>{u&&!l&&d.replace(u)},[u,l,d]);",
    satisfiedVersions: {
      "1.24012.9":
        "The restored /new route mounts the native xP chat composer directly and no longer enters the legacy landing redirect hook.",
      "1.24012.11":
        "The restored /new route mounts the native chat composer directly and no longer enters the legacy landing redirect hook.",
    },
  },
  {
    id: "treat-restored-new-route-as-web-chat",
    assetUrlPath: "/assets/v1/shared-4-aQIEM2lk.js",
    // The .11 composer still classifies the restored /new descriptor as an
    // agent task after the router mounts ordinary chat. Preserve real local
    // sessions while routing a new web chat through onCreate, not the
    // VM-backed onSessionCreate path.
    find: 'B=!!h,K="new"===h?.type,Q="local_session"===h?.type',
    replace: 'B=!!h&&"new"!==h?.type,K=!1,Q="local_session"===h?.type',
    satisfiedVersions: {
      "1.22209.0":
        "The retained renderer uses the original web-chat route and has no 1.24012.11 agent-new composer classification.",
      "1.24012.9":
        "The release-specific restored route passed local chat creation without the 1.24012.11 agent-new composer classification.",
    },
  },
  {
    id: "classify-restored-chat-routes-as-chat",
    assetUrlPath: "/assets/v1/shared-3-CCOtVGzm.js",
    // The .11 global surface resolver prioritizes account-level Cowork access
    // over the URL. The restored /new and /chat routes must resolve their
    // model selector against the local chat catalog, while genuine Code and
    // local-session routes retain their native surface classification.
    find: 'function Kg(){const e=Cr(),t=or(),n=Xs(),s=us(e=>e.startsWith("/code")||e.startsWith("/epitaxy")),r=us(e=>e.startsWith("/claude-ship")||!1);return e?"cowork":t||n||s?"code":r?"baku":"chat"}',
    replace:
      'function Kg(){const e=Cr(),t=or(),n=Xs(),s=us(e=>e.startsWith("/code")||e.startsWith("/epitaxy")),r=us(e=>e.startsWith("/claude-ship")||!1),o=us(e=>"/new"===e||e.startsWith("/chat"));return o?"chat":e?"cowork":t||n||s?"code":r?"baku":"chat"}',
    satisfiedVersions: {
      "1.22209.0":
        "The retained renderer resolves its original web-chat routes against the chat model surface.",
      "1.24012.9":
        "The release-specific restored routes passed local chat model selection without the 1.24012.11 Cowork-first surface resolver.",
    },
  },
  {
    id: "bind-native-greeting-to-local-account",
    find: "function Rrn({incognito:e=!1}){const t=CZ(),{data:n}=jT(),s=Lf(()=>new Date,null);",
    replace:
      "function Rrn({incognito:e=!1}){const t=CZ(),{data:n}=jT(),{account:a}=J(),s=Lf(()=>new Date,null);",
    satisfiedVersions: {
      "1.24012.9":
        "The native composer consumes bootstrap personalized_greeting data containing the local display name.",
      "1.24012.11":
        "The native composer consumes bootstrap personalized_greeting data containing the local display name.",
    },
  },
  {
    id: "fallback-native-greeting-to-local-schedule",
    find: '}(n.personalized_greeting,"chat",s)||t.formatMessage({defaultMessage:"How can I help you today?",id:"XLcM6WHfQR"}):""}',
    // Conditional greeting pools: casual/re-engagement lines are always
    // eligible, {Name} variants join only when the profile has a name, the
    // current weekday line joins, and exactly one time-block pool joins based
    // on the local clock. A random qualifying entry is shown.
    replace:
      '}(n.personalized_greeting,"chat",s)||t.formatMessage({defaultMessage:"How can I help you today?",id:"XLcM6WHfQR"}):(()=>{const e=a?.display_name||a?.full_name||"",t=s.getHours(),n=s.getDay(),r=["How’s it going?","Coffee and Claude time?","Ready for another session?"];e&&r.push("Back at it, "+e,"Hey there, "+e,e+" returns!");r.push("Happy "+["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][n]+(6===n?"!":""));5===n&&r.push("That Friday feeling");if(t>=22||t<5)r.push("Good evening, night owl","Hello, night owl","Moonlit chat?","What’s on your mind tonight?");else if(t<12)r.push(e?"Good morning, "+e:"Good morning");else if(t<17)r.push(e?"What are we working on today, "+e+"?":"Good afternoon");else r.push(e?"Good evening, "+e:"Good evening");return r[Math.floor(Math.random()*r.length)]})()}',
    satisfiedVersions: {
      "1.24012.9":
        "The bootstrap payload supplies a complete time-aware personalized greeting, and the native composer renders it without a renderer fallback patch.",
      "1.24012.11":
        "The bootstrap payload supplies a complete time-aware personalized greeting, and the native composer renders it without a renderer fallback patch.",
    },
  },
  {
    // Add Capabilities to the settings nav so it lives in the modal like
    // every other section (the modal's content registry already maps
    // "capabilities" to its component; it was just missing from the nav, so
    // links fell through to the fullscreen /settings page). Placed right
    // after Claude Code, reusing an in-scope icon.
    id: "add-capabilities-settings-nav-entry",
    find: 'icon:zvt,testId:"claude-code-settings"}),',
    replace:
      'icon:zvt,testId:"claude-code-settings"}),n.push({id:"capabilities",href:"/settings/capabilities",label:r.jsx(Q,{defaultMessage:"Capabilities",id:"localCapabilitiesNav"}),name:t.formatMessage({defaultMessage:"Capabilities",id:"localCapabilitiesNav"}),icon:ryt,testId:"capabilities-settings"}),',
    variants: [
      {
        label: "1.24012.9 capabilities navigation",
        assetUrlPath: "/assets/v1/shared-5-UQAFGbWu.js",
        scopeToAsset: true,
        find: 'icon:Sp,testId:"claude-code-settings"}),',
        replace:
          'icon:Sp,testId:"claude-code-settings"}),r.push({id:"capabilities",href:"/settings/capabilities",label:(0,ql.jsx)(po,{defaultMessage:"Capabilities",id:"localCapabilitiesNav"}),name:t.formatMessage({defaultMessage:"Capabilities",id:"localCapabilitiesNav"}),icon:Sp,testId:"capabilities-settings"}),',
      },
    ],
  },
  {
    // This build ships the Capabilities settings page fully assembled but
    // dead: in the dialog it renders null, and as a page it throws a
    // redirect to /settings before reaching its content. Drop the guard so
    // the section renders (the local build adds its own nav entry).
    id: "unlock-capabilities-settings-page",
    assetUrlPath: "/assets/v1/c71860c77-BpXhwBVe.js",
    find: 'function V(){return S()?null:(A("/settings"),s.jsxs("main",{className:"flex flex-col pb-10",children:[s.jsx(N,{}),s.jsx(W,{}),s.jsx(G,{}),s.jsx(U,{}),s.jsx(t,{includeTitle:!0}),s.jsx(D,{})]}))}',
    replace:
      'function V(){return s.jsxs("main",{className:"flex flex-col pb-10",children:[s.jsx(N,{}),s.jsx(W,{}),s.jsx(G,{}),s.jsx(U,{}),s.jsx(t,{includeTitle:!0}),s.jsx(D,{})]})}',
    variants: [
      {
        label: "1.24012.9 capabilities content",
        assetUrlPath: "/assets/v1/c71860c77-C7aIrG2v.js",
        scopeToAsset: true,
        find: 'function Q(){return j()?null:(c("/settings"),(0,X.jsxs)("main",{className:"flex flex-col pb-10",children:[(0,X.jsx)(J,{}),(0,X.jsx)(Z,{}),(0,X.jsx)(D,{}),(0,X.jsx)(Y,{}),(0,X.jsx)(E,{includeTitle:!0}),(0,X.jsx)(B,{})]}))}',
        replace:
          'function Q(){return(0,X.jsxs)("main",{className:"flex flex-col pb-10",children:[(0,X.jsx)(J,{}),(0,X.jsx)(Z,{}),(0,X.jsx)(D,{}),(0,X.jsx)(Y,{}),(0,X.jsx)(E,{includeTitle:!0}),(0,X.jsx)(B,{})]})}',
      },
      {
        label: "1.24012.11 capabilities content",
        assetUrlPath: "/assets/v1/c71860c77-CqW2wUou.js",
        scopeToAsset: true,
        find: 'function Q(){return j()?null:(c("/settings"),(0,W.jsxs)("main",{className:"flex flex-col pb-10",children:[(0,W.jsx)(J,{}),(0,W.jsx)(Z,{}),(0,W.jsx)(O,{}),(0,W.jsx)(D,{}),(0,W.jsx)(E,{includeTitle:!0}),(0,W.jsx)(B,{})]}))}',
        replace:
          'function Q(){return(0,W.jsxs)("main",{className:"flex flex-col pb-10",children:[(0,W.jsx)(J,{}),(0,W.jsx)(Z,{}),(0,W.jsx)(O,{}),(0,W.jsx)(D,{}),(0,W.jsx)(E,{includeTitle:!0}),(0,W.jsx)(B,{})]})}',
      },
    ],
  },
  {
    id: "import-native-settings-modal-router-for-extensions",
    assetUrlPath: "/assets/v1/c71860c77-MIJzCkn9.js",
    // The Extensions chunk used the page router even while mounted inside
    // the Settings dialog. Import the dialog-aware route bridge already used
    // by the rest of the retained Settings UI.
    find: "cX as m,w as f,q as u,cm as h",
    replace: "cX as m,w as f,dO as localSettingsStore,q as u,cm as h",
    satisfiedVersions: SATISFIED_12401211_EXTENSIONS,
  },
  {
    id: "route-extension-settings-inside-native-modal",
    assetUrlPath: "/assets/v1/c71860c77-MIJzCkn9.js",
    // Advanced settings, extension details, and directory administration are
    // Settings-dialog subroutes. Calling the ordinary history object silently
    // navigated /new instead of changing the active modal panel.
    find: 'const g=u("extension_directory_management"),j=C.useCallback(e=>{s.push(`/settings/desktop/extensions/${e.id}`)},[s]),v=C.useCallback(()=>{c(null)},[]),w=C.useCallback(()=>{s.push("/settings/desktop/extensions/advanced")},[s]),M=C.useCallback(()=>{x({section:"connectors"},{connectorTypeFilter:["desktop"]})},[x]),y=C.useCallback(()=>{s.push("/settings/desktop/extensions/manage-directory")},[s]);',
    replace:
      'const g=u("extension_directory_management"),j=C.useCallback(e=>{localSettingsStore.getState().open("desktop/extensions",e.id)},[]),v=C.useCallback(()=>{c(null)},[]),w=C.useCallback(()=>{localSettingsStore.getState().open("desktop/extensions","advanced")},[]),M=C.useCallback(()=>{x({section:"connectors"},{connectorTypeFilter:["desktop"]})},[x]),y=C.useCallback(()=>{localSettingsStore.getState().open("desktop/extensions","manage-directory")},[]);',
    satisfiedVersions: SATISFIED_12401211_EXTENSIONS,
  },
  {
    id: "load-extension-subpages-in-native-settings-modal",
    assetUrlPath: "/assets/v1/cc011544b-DNANE8Bs.js",
    // The modal's component table only included the Extensions overview. Its
    // complete Advanced and directory-management panes are retained in the
    // full Settings route chunk, so expose those same components to the modal.
    find: '"desktop/extensions":e.lazy(()=>s(()=>import("./c71860c77-MIJzCkn9.js").then(e=>e.p),__vite__mapDeps([0,1,2]))),"desktop/developer":',
    replace:
      '"desktop/extensions":e.lazy(()=>s(()=>import("./c71860c77-MIJzCkn9.js").then(e=>e.p),__vite__mapDeps([0,1,2]))),"desktop/extensions/advanced":e.lazy(()=>s(()=>import("./cf4f70727-CwoxIRQl.js"),__vite__mapDeps([0,1,2,3,4])).then(e=>({default:e.settingsComponentsByPath["desktop/extensions/advanced"]}))),"desktop/extensions/manage-directory":e.lazy(()=>s(()=>import("./cf4f70727-CwoxIRQl.js"),__vite__mapDeps([0,1,2,3,4])).then(e=>({default:e.settingsComponentsByPath["desktop/extensions/manage-directory"]}))),"desktop/developer":',
    satisfiedVersions: SATISFIED_12401211_EXTENSIONS,
  },
  {
    id: "honor-settings-subpath-in-native-modal",
    assetUrlPath: "/assets/v1/cc011544b-DNANE8Bs.js",
    find: "const o=m(),{groups:l}=V({forModal:!0}),c=L(e=>e.section),d=a?s:c,f=e.useMemo(()=>l.flatMap(e=>e.sections).find(e=>e.id===s),[l,s]),h=s?te[s]:void 0,x=null!==s&&b(s)&&void 0!==h,",
    replace:
      "const o=m(),{groups:l}=V({forModal:!0}),c=L(e=>e.section),subpath=L(e=>e.subpath),d=a?s:c,f=e.useMemo(()=>l.flatMap(e=>e.sections).find(e=>e.id===s),[l,s]),h=s?te[subpath?`${s}/${subpath}`:s]??te[s]:void 0,x=null!==s&&b(s)&&void 0!==h,",
    satisfiedVersions: SATISFIED_12401211_EXTENSIONS,
  },
  {
    id: "route-extension-subpage-backs-inside-native-modal",
    assetUrlPath: "/assets/v1/cf4f70727-CwoxIRQl.js",
    find: 'f=async()=>{const e=!d;c(e);try{await(z?.setIsDxtAutoUpdatesEnabled?.(e))}catch(s){i(t.formatMessage({defaultMessage:"Failed to save auto-update setting",id:"01AM3gDtkx",description:"Error message when saving auto-update setting fails"}),{error:s,messageForLogging:"Failed to save auto-update setting"}),c(!e)}},p=e=>{n.push(`/settings/desktop/extensions/${e}`)},j=()=>{n.push("/settings/desktop/extensions")};',
    replace:
      'f=async()=>{const e=!d;c(e);try{await(z?.setIsDxtAutoUpdatesEnabled?.(e))}catch(s){i(t.formatMessage({defaultMessage:"Failed to save auto-update setting",id:"01AM3gDtkx",description:"Error message when saving auto-update setting fails"}),{error:s,messageForLogging:"Failed to save auto-update setting"}),c(!e)}},p=e=>{Z.getState().open("desktop/extensions",e)},j=()=>{Z.getState().open("desktop/extensions")};',
    satisfiedVersions: SATISFIED_12401211_EXTENSIONS,
  },
  {
    id: "enable-native-unified-directory-sections",
    assetUrlPath: "/assets/v1/index-XoaBlZfC.js",
    // The desktop snapshot compiles the Skills and Connectors directory
    // sections to false, then forcibly redirects Skills to Plugins. Their
    // native data hooks and card renderer remain in this same chunk.
    find: 'nBn=!1;const sBn=e.memo(function(){const n=CZ(),{track:s}=ot();Dl();const a=dIt(),{target:r,navigate:i}=rIt(),o=pt("mcp_connector_directory_cxdir_v2"),l=pt("claude_ai_winnow_enabled"),c=f6(e=>e.isOpen),d=f6(e=>e.section),u=f6(e=>e.itemId),m="allowlist"===f6(e=>e.openerProps?.connectorAdminMode??null),p=a&&null!==r&&!m,f=a&&null!==r||c,h=p?r.section:d;KS();const g=false,x="skills"===h&&!0,C=x?"plugins":h,',
    replace:
      'nBn=!0;const sBn=e.memo(function(){const n=CZ(),{track:s}=ot();Dl();const a=dIt(),{target:r,navigate:i}=rIt(),o=pt("mcp_connector_directory_cxdir_v2"),l=pt("claude_ai_winnow_enabled"),c=f6(e=>e.isOpen),d=f6(e=>e.section),u=f6(e=>e.itemId),m="allowlist"===f6(e=>e.openerProps?.connectorAdminMode??null),p=a&&null!==r&&!m,f=a&&null!==r||c,h=p?r.section:d;KS();const g=true,x="skills"===h&&!g,C=x?"plugins":h,',
    variants: [
      {
        label: "1.24012.9 unified directory sections",
        assetUrlPath: "/assets/v1/index-C9LAU4f-.js",
        scopeToAsset: true,
        find: 'const x=false,y="skills"===h&&!0,v=y?"plugins":h,',
        replace: 'const x=true,y="skills"===h&&!x,v=y?"plugins":h,',
      },
    ],
  },
  {
    id: "preserve-native-directory-section-selection",
    assetUrlPath: "/assets/v1/index-XoaBlZfC.js",
    // The compiled store normalized Skills and Connectors to Plugins before
    // the unified directory could render them, which made every Browse/Add
    // action look like the Plugins catalog even though all tabs were visible.
    find: 'function m6(e){return"skills"===e||"connectors"===e?"plugins":e}',
    replace: "function m6(e){return e}",
    variants: [
      {
        label: "1.24012.9 directory section selection",
        assetUrlPath: "/assets/v1/shared-0-C4kdVF7Y.js",
        scopeToAsset: true,
        find: 'function KE(e){return"skills"===e||"connectors"===e?"plugins":e}',
        replace: "function KE(e){return e}",
      },
    ],
  },
  {
    id: "render-native-unified-directory-navigation",
    assetUrlPath: "/assets/v1/index-XoaBlZfC.js",
    find: 'children:[g,nBn,t.jsx(sUn,{icon:t.jsx(c7,{size:16}),isActive:"plugins"===C,onClick:()=>X("plugins"),className:"max-sm:gap-2 max-sm:px-3",children:t.jsx(vZ,{defaultMessage:"Plugins",id:"QJAllUAc2k"})})]',
    replace:
      'children:[t.jsx(sUn,{icon:t.jsx(f7,{size:16}),isActive:"skills"===C,onClick:()=>X("skills"),className:"max-sm:gap-2 max-sm:px-3",children:t.jsx(vZ,{defaultMessage:"Skills",id:"EJSVsOA19u"})}),t.jsx(sUn,{icon:t.jsx(e7,{size:16}),isActive:"connectors"===C,onClick:()=>X("connectors"),className:"max-sm:gap-2 max-sm:px-3",children:t.jsx(vZ,{defaultMessage:"Connectors",id:"2mMJRvsAg1"})}),t.jsx(sUn,{icon:t.jsx(c7,{size:16}),isActive:"plugins"===C,onClick:()=>X("plugins"),className:"max-sm:gap-2 max-sm:px-3",children:t.jsx(vZ,{defaultMessage:"Plugins",id:"QJAllUAc2k"})})]',
    variants: [
      {
        label: "1.24012.9 directory navigation",
        assetUrlPath: "/assets/v1/index-C9LAU4f-.js",
        scopeToAsset: true,
        find: 'children:[x,TJ,(0,RT.jsx)(cQ,{icon:(0,RT.jsx)(hd,{size:16}),isActive:"plugins"===v,onClick:()=>te("plugins"),className:"max-sm:gap-2 max-sm:px-3",children:(0,RT.jsx)(tp,{defaultMessage:"Plugins",id:"QJAllUAc2k"})})]',
        replace:
          'children:[(0,RT.jsx)(cQ,{icon:(0,RT.jsx)(hd,{size:16}),isActive:"skills"===v,onClick:()=>te("skills"),className:"max-sm:gap-2 max-sm:px-3",children:(0,RT.jsx)(tp,{defaultMessage:"Skills",id:"EJSVsOA19u"})}),(0,RT.jsx)(cQ,{icon:(0,RT.jsx)(hd,{size:16}),isActive:"connectors"===v,onClick:()=>te("connectors"),className:"max-sm:gap-2 max-sm:px-3",children:(0,RT.jsx)(tp,{defaultMessage:"Connectors",id:"2mMJRvsAg1"})}),(0,RT.jsx)(cQ,{icon:(0,RT.jsx)(hd,{size:16}),isActive:"plugins"===v,onClick:()=>te("plugins"),className:"max-sm:gap-2 max-sm:px-3",children:(0,RT.jsx)(tp,{defaultMessage:"Plugins",id:"QJAllUAc2k"})})]',
      },
    ],
  },
  {
    id: "render-native-unified-directory-results",
    assetUrlPath: "/assets/v1/index-XoaBlZfC.js",
    find: '!ce&&!le&&"skills"===C&&g,!ce&&!le&&"connectors"===C&&nBn,!ce&&!le&&"plugins"===C&&t.jsx(EHn,{',
    replace:
      '!ce&&!le&&"skills"===C&&t.jsx(WHn,{query:V,skillsSectionAvailable:g,onOpenSkill:ae,onOpenPlugin:re}),!ce&&!le&&"connectors"===C&&t.jsx(GHn,{query:V,onOpenConnector:se}),!ce&&!le&&"plugins"===C&&t.jsx(EHn,{',
    variants: [
      {
        label: "1.24012.9 directory results",
        assetUrlPath: "/assets/v1/index-C9LAU4f-.js",
        scopeToAsset: true,
        find: 'children:["skills"===v&&x,"connectors"===v&&TJ,"plugins"===v&&(0,RT.jsx)(lJ,{',
        replace:
          'children:["skills"===v&&(0,RT.jsx)(kJ,{query:le,skillsSectionAvailable:x,onOpenSkill:pe,onOpenPlugin:fe}),"connectors"===v&&(0,RT.jsx)(MJ,{query:le,onOpenConnector:me}),"plugins"===v&&(0,RT.jsx)(lJ,{',
      },
    ],
  },
  {
    id: "enable-native-skills-directory-data",
    assetUrlPath: "/assets/v1/index-XoaBlZfC.js",
    // The native Skills query is present but gated by cloud account flags.
    // LocalBackend implements the same list-skills response contract.
    find: 'o=i?"?include_wiggle_skills=true":"",l=i||a,c=pt("claudeai_skill_content_scan")',
    replace:
      'o=i?"?include_wiggle_skills=true":"",l=!0,c=pt("claudeai_skill_content_scan")',
    variants: [
      {
        label: "1.24012.9 native skills directory data",
        assetUrlPath: "/assets/v1/shared-4-6CEyRAHb.js",
        scopeToAsset: true,
        find: 'i=o?"?include_wiggle_skills=true":"",c=o||s,l=ie("claudeai_skill_content_scan")',
        replace:
          'i=o?"?include_wiggle_skills=true":"",c=!0,l=ie("claudeai_skill_content_scan")',
      },
    ],
  },
  {
    id: "ignore-cloud-skills-directory-kill-switch",
    assetUrlPath: "/assets/v1/index-XoaBlZfC.js",
    // The cloud disabled-product map can suppress the query even after the
    // local Skills section is enabled. It does not apply to the local source.
    find: "enabled:!!s&&l&&e&&!r.claudeai_skills_list,staleTime:",
    replace: "custom3pCompatible:!0,enabled:!!s&&l&&e,staleTime:",
    variants: [
      {
        label: "1.24012.9 local skills kill-switch bypass",
        assetUrlPath: "/assets/v1/shared-4-6CEyRAHb.js",
        scopeToAsset: true,
        find: "enabled:!!r&&c&&e&&!n.claudeai_skills_list,staleTime:",
        replace: "custom3pCompatible:!0,enabled:!!r&&c&&e,staleTime:",
      },
    ],
  },
  {
    id: "enable-native-connectors-directory-data",
    assetUrlPath: "/assets/v1/c2ee0272b-DPDuX889.js",
    // The retained native hook is compiled off in this snapshot. Its fallback
    // query below is backed by the bundled, one-time official MCP snapshot.
    find: "const iBe=!1,cBe=ie(te()),lBe=[];",
    replace: "const iBe=!0,cBe=ie(te()),lBe=[];",
    variants: [
      {
        label: "1.24012.9 connectors directory data",
        assetUrlPath: "/assets/v1/index-C9LAU4f-.js",
        scopeToAsset: true,
        find: "TJ=!1;var PJ=",
        replace: "TJ=!0;var PJ=",
      },
    ],
  },
  {
    id: "use-local-native-connectors-directory-data",
    assetUrlPath: "/assets/v1/c2ee0272b-DPDuX889.js",
    // Never poll Anthropic's directory from the app. The native query uses
    // the local backend's compatible snapshot endpoint instead.
    find: "const a=new URL(`${Qze()}/mcp-registry/v0/servers`);",
    replace: 'const a=new URL("/mcp-registry/v0/servers",location.origin);',
    variants: [
      {
        label: "1.24012.9 local connectors directory endpoint",
        assetUrlPath: "/assets/v1/shared-4-6CEyRAHb.js",
        scopeToAsset: true,
        find: "const n=new URL(`${rd()}/mcp-registry/v0/servers`);",
        replace: 'const n=new URL("/mcp-registry/v0/servers",location.origin);',
      },
      {
        label: "1.24012.11 local connectors directory endpoint",
        assetUrlPath: "/assets/v1/shared-4-aQIEM2lk.js",
        scopeToAsset: true,
        find: "const n=new URL(`${sd()}/mcp-registry/v0/servers`);",
        replace: 'const n=new URL("/mcp-registry/v0/servers",location.origin);',
      },
    ],
  },
  {
    id: "enable-native-connectors-directory-query",
    assetUrlPath: "/assets/v1/c2ee0272b-DPDuX889.js",
    // The Directory component and its local endpoint can both be enabled while
    // the retained TanStack query remains independently compiled off. Keep
    // this as a distinct intent so migration cannot mistake a visible empty
    // Connectors tab for a working data path.
    find: "var iBe=!1,cBe=ie(te()),lBe=[];",
    replace: "var iBe=!0,cBe=ie(te()),lBe=[];",
    variants: [
      {
        label: "1.24012.11 connectors directory query",
        assetUrlPath: "/assets/v1/shared-4-aQIEM2lk.js",
        scopeToAsset: true,
        find: "var hd=!1,yd=o(b()),_d=[]",
        replace: "var hd=!0,yd=o(b()),_d=[]",
      },
    ],
  },
  {
    id: "prefer-local-native-connectors-directory-data",
    assetUrlPath: "/assets/v1/c2ee0272b-DPDuX889.js",
    find: "d=!0===e?.pinToBffRegardlessOfGate||u",
    replace: "d=!1",
    variants: [
      {
        label: "1.24012.9 prefer local registry snapshot",
        assetUrlPath: "/assets/v1/shared-4-6CEyRAHb.js",
        scopeToAsset: true,
        find: "d=!0===e?.pinToBffRegardlessOfGate||l",
        replace: "d=!1",
      },
    ],
  },
  {
    id: "wire-native-skills-directory-action",
    assetUrlPath: "/assets/v1/c5e558aae-BFRrCNDr.js",
    // The retained Skills panel creates the native Directory callback but
    // drops its return value, so there is no way to invoke it from Settings.
    find: 'const M=w(e=>e.open);e.useCallback(()=>{M("skills",{source:"customize_skills_panel"})},[M]);const y=R(),',
    replace:
      'const M=w(e=>e.open),openSkillsDirectory=e.useCallback(()=>{M("skills",{source:"customize_skills_panel"})},[M]);const y=R(),',
    variants: [
      {
        label: "1.24012.9 Skills directory callback",
        assetUrlPath: "/assets/v1/c5e558aae-s3PAEnF5.js",
        scopeToAsset: true,
        find: 'const f=o(e=>e.open);(0,ls.useCallback)(()=>{f("skills",{source:"customize_skills_panel"})},[f]);const h=V(),',
        replace:
          'const f=o(e=>e.open),openSkillsDirectory=(0,ls.useCallback)(()=>{f("skills",{source:"customize_skills_panel"})},[f]);const h=V(),',
      },
    ],
  },
  {
    id: "show-native-skills-directory-action",
    assetUrlPath: "/assets/v1/c5e558aae-BFRrCNDr.js",
    find: "actions:m?s.jsx(re,{handleRef:b}):null,children:",
    replace:
      'actions:s.jsxs("div",{className:"flex items-center gap-2",children:[s.jsx(te,{variant:"secondary",onClick:openSkillsDirectory,children:s.jsx(C,{defaultMessage:"Browse",id:"localBrowseSkills"})}),m?s.jsx(re,{handleRef:b}):null]}),children:',
    variants: [
      {
        label: "1.24012.9 Skills Browse action",
        assetUrlPath: "/assets/v1/c5e558aae-s3PAEnF5.js",
        scopeToAsset: true,
        find: "actions:r?(0,ts.jsx)(js,{handleRef:u}):null,children:",
        replace:
          'actions:(0,ts.jsxs)("div",{className:"flex items-center gap-2",children:[(0,ts.jsx)(ae,{variant:"secondary",onClick:openSkillsDirectory,children:(0,ts.jsx)(L,{defaultMessage:"Browse",id:"localBrowseSkills"})}),r?(0,ts.jsx)(js,{handleRef:u}):null]}),children:',
      },
    ],
  },
  {
    id: "show-native-connectors-empty-state-actions",
    assetUrlPath: "/assets/v1/c63a78ed4-C202DsUQ.js",
    // Local mode owns its connector configuration, so the native empty page
    // must not hide its controls behind cloud organization permissions.
    find: 'd=(t||a)&&n;return s.jsx("div",{className:"flex h-full w-full items-center justify-center"',
    replace:
      'd=!0;return s.jsx("div",{className:"flex h-full w-full items-center justify-center"',
    variants: [
      {
        label: "1.24012.9 connector empty-state permissions",
        assetUrlPath: "/assets/v1/c40525e86-CXbT-385.js",
        scopeToAsset: true,
        find: "x=(g||p)&&m,{showCustomConnectorOption:f",
        replace: "x=!0,{showCustomConnectorOption:f",
      },
    ],
  },
  {
    id: "show-native-connectors-directory-action",
    assetUrlPath: "/assets/v1/c63a78ed4-C202DsUQ.js",
    find: 'children:[i&&s.jsx(p,{variant:"primary",onClick:e,children:s.jsx(Le,{defaultMessage:"Browse connectors",id:"8Q+Q5LuGum"})}),c&&s.jsx(Us,',
    replace:
      'children:[s.jsx(p,{variant:"primary",onClick:e,children:s.jsx(Le,{defaultMessage:"Browse connectors",id:"8Q+Q5LuGum"})}),c&&s.jsx(Us,',
    variants: [
      {
        label: "1.24012.9 connector empty-state Browse action",
        assetUrlPath: "/assets/v1/c40525e86-CXbT-385.js",
        scopeToAsset: true,
        find: 'children:[u&&(0,xs.jsx)(G,{variant:"primary",onClick:y,children:(0,xs.jsx)(D,{defaultMessage:"Browse connectors",id:"8Q+Q5LuGum"})}),f&&(0,xs.jsx)(G,',
        replace:
          'children:[(0,xs.jsx)(G,{variant:"primary",onClick:y,children:(0,xs.jsx)(D,{defaultMessage:"Browse connectors",id:"8Q+Q5LuGum"})}),f&&(0,xs.jsx)(G,',
      },
    ],
  },
  {
    id: "show-native-connectors-directory-in-header",
    assetUrlPath: "/assets/v1/ce6f11143-DPc04jaK.js",
    // Local mode supports the directory even when the upstream account flag
    // is absent. Keep the native Add menu and expose its Browse entry instead
    // of collapsing it to the custom-connector action.
    find: "e.jsx(we,{showBrowse:h,showAddCustom:S&&j,addCustomDisabled:y,onBrowse:o,onAddCustom:r})",
    replace:
      "e.jsx(we,{showBrowse:!0,showAddCustom:S&&j,addCustomDisabled:y,onBrowse:o,onAddCustom:r})",
    satisfiedVersions: SATISFIED_12401211_CONNECTORS,
  },
  {
    id: "show-native-modal-connectors-directory-in-header",
    assetUrlPath: "/assets/v1/c40525e86-D3fCSCrC.js",
    // The Settings-modal Connectors implementation has its own feature flag
    // and Add menu separate from the full-page component above.
    find: 'p=de(),f=c,C=(d||m)&&l&&u,[v,y]=s.useState(!1),N=i.get("connectorName")',
    replace:
      'p=de(),f=!0,C=(d||m)&&l&&u,[v,y]=s.useState(!1),N=i.get("connectorName")',
    variants: [
      {
        label: "1.24012.9 connector header Browse action",
        assetUrlPath: "/assets/v1/c40525e86-CXbT-385.js",
        scopeToAsset: true,
        find: "g=Ee(),p=i,x=(c||d)&&o&&u,",
        replace: "g=Ee(),p=!0,x=(c||d)&&o&&u,",
      },
    ],
  },
  {
    id: "dispatch-local-chat-after-navigation",
    find: "P=j&&void 0!==r&&void 0!==p?.uuid&&!w&&!t.skipNavigation&&!b&&!(!1===d?.settings?.has_finished_claudeai_onboarding)",
    replace: "P=!1",
    variants: [
      {
        label: "1.24012.11 local chat navigation dispatch",
        assetUrlPath: "/assets/v1/shared-5-BtCN4PB_.js",
        scopeToAsset: true,
        find: "L=E&&void 0!==s&&void 0!==u?.uuid&&!_&&!t.skipNavigation&&!b&&!(!1===d?.settings?.has_finished_claudeai_onboarding)",
        replace: "L=!1",
      },
    ],
  },
  {
    id: "disable-service-workers-on-app-protocol",
    find: '_yn="undefined"!=typeof navigator&&"serviceWorker"in navigator',
    replace: "_yn=!1",
    variants: [
      {
        label: "1.24012.11 app protocol service worker guard",
        assetUrlPath: "/assets/v1/index-Dh0MX4cp.js",
        scopeToAsset: true,
        find: 'XB="undefined"!=typeof navigator&&"serviceWorker"in navigator',
        replace: "XB=!1",
      },
    ],
  },
  {
    id: "enable-local-chat-tree-fetch",
    find: "enabled:!!a&&!!e&&r&&!l,forceExplicitCache:!0,meta:",
    replace:
      "enabled:!!a&&!!e&&r&&!l,custom3pCompatible:!0,forceExplicitCache:!0,meta:",
    variants: [
      {
        label: "1.24012.11 local chat tree query",
        assetUrlPath: "/assets/v1/shared-1-DvXOh9-L.js",
        scopeToAsset: true,
        find: "enabled:!!s&&!!e&&n&&!c,forceExplicitCache:!0,meta:",
        replace:
          "enabled:!!s&&!!e&&n&&!c,custom3pCompatible:!0,forceExplicitCache:!0,meta:",
      },
    ],
  },
  {
    id: "use-local-artifact-renderer",
    find: 'userContentRendererUrl:"https://www.claudeusercontent.com"',
    replace: 'userContentRendererUrl:"app://artifacts.local"',
  },
  {
    id: "use-local-published-artifact-links",
    find: 'publishedArtifactsBaseUrl:"https://claude.ai",publishedArtifactsEmbedBaseUrl:"https://claude.site"',
    replace:
      'publishedArtifactsBaseUrl:"app://localhost",publishedArtifactsEmbedBaseUrl:"app://localhost"',
  },
  {
    id: "remove-local-publish-policy-card",
    assetUrlPath: "/assets/v1/cf774f0c4-BGDGm7sd.js",
    find: ',b=e.jsxs("div",{className:"bg-bg-300 text-text-300 mt-3 flex gap-3 rounded-xl px-4 py-3 text-sm leading-normal"',
    replace:
      ',b=null&&e.jsxs("div",{className:"bg-bg-300 text-text-300 mt-3 flex gap-3 rounded-xl px-4 py-3 text-sm leading-normal"',
    variants: [
      {
        label: "1.24012.11 local publish policy card",
        assetUrlPath: "/assets/v1/c147e6f61-B21CySmg.js",
        scopeToAsset: true,
        find: ',f=(0,T.jsxs)("div",{className:"bg-bg-300 text-text-300 mt-3 flex gap-3 rounded-xl px-4 py-3 text-sm leading-normal"',
        replace:
          ',f=null&&(0,T.jsxs)("div",{className:"bg-bg-300 text-text-300 mt-3 flex gap-3 rounded-xl px-4 py-3 text-sm leading-normal"',
      },
    ],
  },
  {
    id: "use-local-artifact-screenshot-capture",
    // The cloud renderer answers GetScreenshot from inside the sandbox; the
    // local renderer cannot rasterize itself, so capture the artifact iframe
    // through the Electron compositor instead.
    find: 'if(!ue)return void t("aborted","screenshot_no_communicator");const n=Symbol("timeout");',
    replace:
      'if(window.localClaude?.captureArtifactScreenshot){try{const e=await window.localClaude.captureArtifactScreenshot(window.__localArtifactPublishSource||{});if(e)return t("success"),e}catch{}}if(!ue)return void t("aborted","screenshot_no_communicator");const n=Symbol("timeout");',
    variants: [
      {
        label: "1.24012.11 local artifact screenshot capture",
        assetUrlPath: "/assets/v1/shared-6-DjYSPnxD.js",
        scopeToAsset: true,
        find: 'if(!ce)return void t("aborted","screenshot_no_communicator");const n=Symbol("timeout");',
        replace:
          'if(window.localClaude?.captureArtifactScreenshot){try{const e=await window.localClaude.captureArtifactScreenshot(window.__localArtifactPublishSource||{});if(e)return t("success"),e}catch{}}if(!ce)return void t("aborted","screenshot_no_communicator");const n=Symbol("timeout");',
      },
    ],
  },
  {
    id: "stash-artifact-content-for-screenshot",
    // Records the displayed artifact's content/type for the offscreen
    // publish-screenshot capture (fe cannot reach these directly because its
    // local `n` shadows the component's content variable).
    find: "e.useEffect(()=>{N&&n&&a&&(d?.(),Object.values(Zs).includes(a),ue?.(kr.SetContent,",
    replace:
      "e.useEffect(()=>{N&&n&&a&&(window.__localArtifactPublishSource={content:n,type:a},d?.(),Object.values(Zs).includes(a),ue?.(kr.SetContent,",
    variants: [
      {
        label: "1.24012.11 artifact screenshot source",
        assetUrlPath: "/assets/v1/shared-6-DjYSPnxD.js",
        scopeToAsset: true,
        find: "(0,nc.useEffect)(()=>{S&&e&&s&&(l?.(),Object.values(Ds).includes(s),ce?.($a.SetContent,",
        replace:
          "(0,nc.useEffect)(()=>{S&&e&&s&&(window.__localArtifactPublishSource={content:e,type:s},l?.(),Object.values(Ds).includes(s),ce?.($a.SetContent,",
      },
    ],
  },
  {
    id: "remove-local-publish-embed-settings",
    assetUrlPath: "/assets/v1/cf774f0c4-BGDGm7sd.js",
    find: ",e.jsx(X,{isPublished:b,isEmbedSettingsOpen:g,onOpen:()=>{N(!0)}})",
    replace: ",null",
    variants: [
      {
        label: "1.24012.11 local publish embed settings",
        assetUrlPath: "/assets/v1/c147e6f61-B21CySmg.js",
        scopeToAsset: true,
        find: ",(0,T.jsx)(Y,{isPublished:g,isEmbedSettingsOpen:j,onOpen:()=>{v(!0)}})",
        replace: ",null",
      },
    ],
  },
  {
    id: "use-skill-icon-for-local-skill-tool",
    // The local chat skill tool renders with the generic wrench because the
    // retained icon predicates don't know its name; route it to the native
    // skill scroll icon.
    find: 'if(yg(e)||Jf(e))return t.jsx(f7,{size:n,className:"text-text-500"})',
    replace:
      'if(yg(e)||Jf(e)||"skill"===e)return t.jsx(f7,{size:n,className:"text-text-500"})',
    satisfiedVersions: SATISFIED_12401211_SKILL_ROWS,
  },
  {
    id: "label-code-skill-row-loaded",
    assetUrlPath: "/assets/v1/c06173196-DmnMdctC.js",
    scopeToAsset: true,
    // The Code chain renders Skill calls as "Ran skill" and reads the input
    // field "skill", but the local Skill tool's argument is "name". Show
    // "Loaded {skill-name} skill" instead (the " skill" suffix and the link
    // are rendered by label-code-skill-row-link below).
    find: 'case"Skill":{const t=a("skill");return{verb:e.formatMessage({defaultMessage:"Ran skill",id:"sSRWkTrDlY"}),runningVerb:e.formatMessage({defaultMessage:"Running skill",id:"kNX7UtF75g"}),meta:t?`/${t}`:void 0,metaIsCode:!0,failedVerb:e.formatMessage({defaultMessage:"Failed to run skill",id:"f7JoMbaMVQ"}),kind:o}}',
    replace:
      'case"Skill":{const t=a("skill")??a("name");return{verb:"Loaded",runningVerb:"Loading",meta:"string"==typeof t&&t?t:void 0,failedVerb:"Failed to load skill",kind:o}}',
    variants: [
      {
        label: "1.24xxx-moved-code-tool-row",
        assetUrlPath: "/assets/v1/c360a9e1c-CwX96mL8.js",
        find: 'case"Skill":{const t=a("skill");return{verb:e.formatMessage({defaultMessage:"Ran skill",id:"sSRWkTrDlY"}),runningVerb:e.formatMessage({defaultMessage:"Running skill",id:"kNX7UtF75g"}),meta:t?`/${t}`:void 0,metaIsCode:!0,failedVerb:e.formatMessage({defaultMessage:"Failed to run skill",id:"f7JoMbaMVQ"}),kind:o}}',
        replace:
          'case"Skill":{const t=a("skill")??a("name");return{verb:"Loaded",runningVerb:"Loading",meta:"string"==typeof t&&t?t:void 0,failedVerb:"Failed to load skill",kind:o}}',
      },
    ],
  },
  {
    id: "disable-code-skill-row-expansion",
    assetUrlPath: "/assets/v1/c06173196-DmnMdctC.js",
    // Skill rows show only the "Loaded {skill-name} skill" line; there is no
    // expandable result body for them.
    find: 'O=!("todos"===l.kind&&0===VK(t.input).length||"agent_status"===l.kind&&0===r$(t.input).length||"peerMessage"===l.kind&&!L&&void 0===mK(t.input)&&xK(t.input))',
    replace:
      'O=!("Skill"===t.name||"todos"===l.kind&&0===VK(t.input).length||"agent_status"===l.kind&&0===r$(t.input).length||"peerMessage"===l.kind&&!L&&void 0===mK(t.input)&&xK(t.input))',
    satisfiedVersions: SATISFIED_12401211_SKILL_ROWS,
  },
  {
    id: "label-code-skill-row-link",
    assetUrlPath: "/assets/v1/c06173196-DmnMdctC.js",
    // Renders the Skill row meta as "{skill-name} skill" where the name links
    // to the Customize screen for that skill (SPA navigation; the preload
    // auto-selects the skill from the ?skill= query parameter).
    find: ':l.meta&&!ne?C?s.jsx("a",{href:C,target:"_blank",rel:"noreferrer",',
    replace:
      ':l.meta&&!ne?"Skill"===t.name?s.jsxs("span",{className:"text-body text-assistant-primary truncate min-w-0",children:[s.jsx("a",{href:"/customize/skills?skill="+encodeURIComponent(String(l.meta)),onClick:n=>{n.preventDefault(),n.stopPropagation();const a="/customize/skills?skill="+encodeURIComponent(String(l.meta));history.pushState({},"",a),window.dispatchEvent(new PopStateEvent("popstate"))},onKeyDown:n=>n.stopPropagation(),className:"underline underline-offset-[3px] hover:text-assistant-primary",children:String(l.meta)})," skill"]}):C?s.jsx("a",{href:C,target:"_blank",rel:"noreferrer",',
    satisfiedVersions: SATISFIED_12401211_SKILL_ROWS,
  },
  {
    id: "keep-projects-routes",
    assetUrlPath: "/assets/v1/c1b9abf13-bG6VlbXV.js",
    // The projects layout redirects home unless a cloud access check
    // allows it; the local backend serves the projects API.
    find: 'function Qe({children:s}){const t=_();B();const n=He(),o=$e();if("redirecting"===a(!0))return null;const i=n&&(o.loading||o.spacesAvailable);return"allowed"===t||i?',
    replace:
      'function Qe({children:s}){const t=_();B();const n=He(),o=$e();if("redirecting"===a(!0))return null;const i=n&&(o.loading||o.spacesAvailable);return!0?',
    variants: [
      {
        label: "1.24012.9 projects layout",
        assetUrlPath: "/assets/v1/c1b9abf13-Bki1JsZ6.js",
        scopeToAsset: true,
        find: 'function J({children:e}){const s=g();u();const r=H(),t=N();if("redirecting"===d(!0))return null;const a=r&&(t.loading||t.spacesAvailable);return"allowed"===s||a?',
        replace:
          'function J({children:e}){const s=g();u();const r=H(),t=N();if("redirecting"===d(!0))return null;const a=r&&(t.loading||t.spacesAvailable);return!0?',
      },
    ],
  },
  {
    id: "show-projects-nav-entry",
    // Projects are cloud-gated in the retained build; the local backend now
    // serves the projects API.
    find: 'priority:lqn}),d.isAvailable&&a&&e.push({id:"projects",href:"/projects"',
    replace: 'priority:lqn}),e.push({id:"projects",href:"/projects"',
    satisfiedVersions: {
      "1.24012.9":
        "The chat sidebar already renders the native Projects navigation entry in the local bootstrap probe.",
      "1.24012.11":
        "The chat sidebar includes the native Projects navigation entry; the final local bootstrap probe revalidates it for this release.",
    },
  },
  {
    id: "unblock-projects-list-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // The shared query wrapper force-disables queries not marked
    // custom3pCompatible; the projects queries hit the local backend.
    find: "YT(`/api/organizations/${p}/projects_v2?${g.toString()}`,{queryKey:[ZM,{orgUuid:p},{limit:t,offset:r,starred:o,creatorFilter:a,projectFilter:s,orderBy:i,searchQuery:c,isArchived:l}],enabled:Boolean(e&&u&&d),select:h})",
    replace:
      "YT(`/api/organizations/${p}/projects_v2?${g.toString()}`,{queryKey:[ZM,{orgUuid:p},{limit:t,offset:r,starred:o,creatorFilter:a,projectFilter:s,orderBy:i,searchQuery:c,isArchived:l}],custom3pCompatible:!0,enabled:Boolean(e),select:h})",
    variants: [
      {
        label: "1.24012.9 projects v2 query",
        assetUrlPath: "/assets/v1/shared-1-3-6x7RKF.js",
        scopeToAsset: true,
        find: "ct(`/api/organizations/${p}/projects_v2?${h.toString()}`,{queryKey:[A,{orgUuid:p},{limit:t,offset:n,starred:a,creatorFilter:s,projectFilter:r,orderBy:o,searchQuery:i,isArchived:c}],enabled:Boolean(e&&l&&u&&d.isAvailable),select:g})",
        replace:
          "ct(`/api/organizations/${p}/projects_v2?${h.toString()}`,{queryKey:[A,{orgUuid:p},{limit:t,offset:n,starred:a,creatorFilter:s,projectFilter:r,orderBy:o,searchQuery:i,isArchived:c}],custom3pCompatible:!0,enabled:Boolean(e),select:g})",
      },
    ],
  },
  {
    id: "unblock-project-detail-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    find: "YT(`/api/organizations/${r}/projects/${e}`,{queryKey:[WM,{orgUuid:r,projectUuid:e}],enabled:Boolean(t&&n&&e),staleTime:0,",
    replace:
      "YT(`/api/organizations/${r}/projects/${e}`,{queryKey:[WM,{orgUuid:r,projectUuid:e}],custom3pCompatible:!0,enabled:Boolean(t&&e),staleTime:0,",
    variants: [
      {
        label: "1.24012.9 project detail query",
        assetUrlPath: "/assets/v1/shared-1-3-6x7RKF.js",
        scopeToAsset: true,
        find: "ct(`/api/organizations/${a}/projects/${e}`,{queryKey:[ja,{orgUuid:a,projectUuid:e}],enabled:Boolean(t&&n&&e),staleTime:0,",
        replace:
          "ct(`/api/organizations/${a}/projects/${e}`,{queryKey:[ja,{orgUuid:a,projectUuid:e}],custom3pCompatible:!0,enabled:Boolean(t&&e),staleTime:0,",
      },
    ],
  },
  {
    id: "unblock-project-docs-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    find: "YT(`/api/organizations/${r}/projects/${e}/docs`,{queryKey:[nA,{orgUuid:r,projectUuid:e}],enabled:!!n&&!!e&&t})",
    replace:
      "YT(`/api/organizations/${r}/projects/${e}/docs`,{queryKey:[nA,{orgUuid:r,projectUuid:e}],custom3pCompatible:!0,enabled:!!e&&t})",
    variants: [
      {
        label: "1.24012.9 project docs query",
        assetUrlPath: "/assets/v1/shared-4-6CEyRAHb.js",
        scopeToAsset: true,
        find: "Oe(`/api/organizations/${r}/projects/${e}/docs`,{queryKey:[ye,{orgUuid:r,projectUuid:e}],enabled:!!a&&!!e&&t})",
        replace:
          "Oe(`/api/organizations/${r}/projects/${e}/docs`,{queryKey:[ye,{orgUuid:r,projectUuid:e}],custom3pCompatible:!0,enabled:!!e&&t})",
      },
    ],
  },
  {
    id: "unblock-project-count-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    find: "YT(`/api/organizations/${t}/projects/count`,{queryKey:[GM,{orgUuid:t}],staleTime:3e5,enabled:!!e,",
    replace:
      "YT(`/api/organizations/${t}/projects/count`,{queryKey:[GM,{orgUuid:t}],custom3pCompatible:!0,staleTime:3e5,enabled:!0,",
    variants: [
      {
        label: "1.24012.9 project count query",
        assetUrlPath: "/assets/v1/shared-1-3-6x7RKF.js",
        scopeToAsset: true,
        find: "ct(`/api/organizations/${n}/projects/count`,{queryKey:[Pe,{orgUuid:n}],staleTime:3e5,enabled:!!t&&e,",
        replace:
          "ct(`/api/organizations/${n}/projects/count`,{queryKey:[Pe,{orgUuid:n}],custom3pCompatible:!0,staleTime:3e5,enabled:e,",
      },
    ],
  },
  {
    id: "enable-memory-feature-gate",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // Memory ("saffron") is feature-gated off in the retained build; the
    // local backend implements the full /memory API.
    find: 'O3=()=>tv("claudeai_saffron_enabled")',
    replace: "O3=()=>!0",
    variants: [
      {
        label: "1.24012.9 memory feature gate",
        assetUrlPath: "/assets/v1/shared-1-3-6x7RKF.js",
        scopeToAsset: true,
        find: 'Td=()=>ve("claudeai_saffron_enabled")',
        replace: "Td=()=>!0",
      },
    ],
  },
  {
    id: "enable-memory-feature-registration",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // The feature-registry entry keeps its own client-side gate; open it so
    // the Settings surface shows the native memory controls.
    find: 'saffron:uD({feature:"saffron",useClientSideGate:()=>tv("claudeai_saffron_enabled")',
    replace: 'saffron:uD({feature:"saffron",useClientSideGate:()=>!0',
    variants: [
      {
        label: "1.24012.9 memory registry gate",
        assetUrlPath: "/assets/v1/shared-0-C4kdVF7Y.js",
        scopeToAsset: true,
        find: 'saffron:jy({feature:"saffron",useClientSideGate:()=>zo("claudeai_saffron_enabled")',
        replace: 'saffron:jy({feature:"saffron",useClientSideGate:()=>!0',
      },
    ],
  },
  {
    id: "keep-customize-connectors-route",
    assetUrlPath: "/assets/v1/c63a78ed4-C202DsUQ.js",
    // The Connectors page redirects to /customize when its cloud gate is
    // off; the local MCP client backs the connectors surface.
    find: 'path:"connectors",component:function(){return b()||S("/customize"),s.jsx(Tl,{})}}',
    replace: 'path:"connectors",component:function(){return s.jsx(Tl,{})}}',
    satisfiedVersions: SATISFIED_12401211_CONNECTORS,
  },
  {
    id: "keep-customize-memory-route",
    assetUrlPath: "/assets/v1/c63a78ed4-C202DsUQ.js",
    // The Customize > Memory route redirects to /settings/capabilities when
    // its statsig gates are off; the local backend serves the memory API.
    find: '{isPending:n}=E({forModal:!0}),i=A(),c=O(),o=!(i||c||n||t&&a);return e.useEffect(()=>{o&&l.replace("/settings/capabilities")},[o,l]),o?null:s.jsx(rl,{})',
    replace:
      '{isPending:n}=E({forModal:!0}),i=A(),c=O(),o=!1;return e.useEffect(()=>{o&&l.replace("/settings/capabilities")},[o,l]),o?null:s.jsx(rl,{})',
    satisfiedVersions: {
      "1.24012.9":
        "Customize routing is driven by the native modal section registry; the version-specific memory navigation patch adds the implemented memory section to that registry.",
      "1.24012.11":
        "Customize routing is driven by the native modal section registry; the version-specific memory navigation patch adds the implemented memory section to that registry.",
    },
  },
  {
    id: "force-memory-page-summary-view",
    assetUrlPath: "/assets/v1/c06a0b3df-DP2HU9yQ.js",
    // The Customize > Memory page picks between a file-memory view and the
    // account "Summary" view behind statsig gates. Local mode
    // implements the summary API (/memory, /memory/controls, /synthesize),
    // so pin the page to that view.
    find: 'function le(){const a=S("claudeai_customize_memory_tab_main"),t=z(),l=D(),',
    replace: "function le(){const a=!0,t=!1,l=!0,",
    satisfiedVersions: {
      "1.24012.9":
        "The new native memory panel selects its supported view from the local account memory settings instead of the removed 1.22 summary/file branch.",
      "1.24012.11":
        "The current native memory panel selects its supported view from local account memory settings instead of the removed 1.22 summary/file branch.",
    },
  },
  {
    id: "force-memory-summary-query",
    assetUrlPath: "/assets/v1/c06a0b3df-DP2HU9yQ.js",
    // The Summary panel's memory fetch chains through cloud availability
    // hooks; the local /memory endpoint is always available.
    find: "J=s.memo(()=>{const a=T(),t=n(),{isAvailable:l}=v(),{data:i,isLoading:r}=M(void 0,{enabled:l}),",
    replace:
      "J=s.memo(()=>{const a=T(),t=n(),{isAvailable:l}=v(),{data:i,isLoading:r}=M(void 0,{enabled:!0}),",
    satisfiedVersions: {
      "1.24012.9":
        "The 1.24012 memory panel consumes the shared Md memory query directly; that query is ported separately for local custom-provider mode.",
      "1.24012.11":
        "The current memory panel consumes the shared memory query directly; that query is ported separately for local custom-provider mode.",
    },
  },
  {
    id: "unblock-memory-query-gates",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // The shared query wrapper force-disables queries not marked
    // custom3pCompatible, and the enabled chain requires cloud org state the
    // local build does not model. The local /memory endpoint is always safe.
    find: "enabled:Boolean(r)&&(t?.enabled??!0)&&s&&!i},e=>S3.parse(e))",
    replace:
      'custom3pCompatible:!0,refetchOnMount:"always",refetchOnWindowFocus:!0,enabled:t?.enabled??!0},e=>S3.parse(e))',
    variants: [
      {
        label: "1.24012.9 memory query",
        assetUrlPath: "/assets/v1/shared-1-3-6x7RKF.js",
        scopeToAsset: true,
        find: "enabled:Boolean(a)&&(t?.enabled??!0)&&o&&!i},e=>Cd.parse(e))",
        replace:
          'custom3pCompatible:!0,refetchOnMount:"always",refetchOnWindowFocus:!0,enabled:Boolean(a)&&(t?.enabled??!0)},e=>Cd.parse(e))',
      },
    ],
  },
  {
    id: "enable-memory-edit-resynthesize",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // Without this gate, saving a memory edit stores the controls but never
    // regenerates the summary, so edits look like they did nothing.
    find: 'h=iv("claudeai_saffron_frontend","edit_resynthesize_enabled",!1,hv)',
    replace: "h=!0",
    variants: [
      {
        label: "1.24012.9 memory edit resynthesize",
        assetUrlPath: "/assets/v1/shared-1-3-6x7RKF.js",
        scopeToAsset: true,
        find: 'Ed=()=>fn("claudeai_saffron_frontend","edit_resynthesize_enabled",!1,ma)',
        replace: "Ed=()=>!0",
      },
    ],
  },
  {
    id: "unblock-memory-settings-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // Same custom3p kill-switch for the memory settings query backing the
    // native Settings toggles.
    find: "{queryKey:v3(n),enabled:e&&!!n,staleTime:6e4,meta:{noToast:!0}}",
    replace:
      "{queryKey:v3(n),custom3pCompatible:!0,enabled:e&&!!n,staleTime:6e4,meta:{noToast:!0}}",
    variants: [
      {
        label: "1.24012.9 memory settings query",
        assetUrlPath: "/assets/v1/shared-1-3-6x7RKF.js",
        scopeToAsset: true,
        find: "{queryKey:yd(n),enabled:e&&!!n,staleTime:6e4,meta:{noToast:!0}}",
        replace:
          "{queryKey:yd(n),custom3pCompatible:!0,enabled:e&&!!n,staleTime:6e4,meta:{noToast:!0}}",
      },
    ],
  },
  {
    id: "show-customize-memory-nav-entry",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    find: 'a&&s&&n.push({id:"customize-memory",href:"/customize/memory"',
    replace: 'n.push({id:"customize-memory",href:"/customize/memory"',
    variants: [
      {
        label: "1.24012.9 customize memory navigation",
        assetUrlPath: "/assets/v1/shared-5-UQAFGbWu.js",
        scopeToAsset: true,
        find: 'n&&a&&o.push({id:"customize-memory",testId:"customize-memory-settings",href:"/customize/memory"',
        replace:
          'o.push({id:"customize-memory",testId:"customize-memory-settings",href:"/customize/memory"',
      },
    ],
  },
  {
    id: "enable-incognito-feature-gate",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // The incognito ("saffron ghost") feature flag is off in the retained
    // build; the local backend implements temporary conversations.
    find: 'V3=()=>tv("claudeai_saffron_ghost_enabled")',
    replace: "V3=()=>!0",
    variants: [
      {
        label: "1.24012.11 incognito feature gate",
        assetUrlPath: "/assets/v1/shared-1-DvXOh9-L.js",
        scopeToAsset: true,
        find: 'Qd=()=>ve("claudeai_saffron_ghost_enabled")',
        replace: "Qd=()=>!0",
      },
    ],
  },
  {
    id: "enable-incognito-chat-toggle",
    // The incognito (temporary chat) toggle is gated off in the retained
    // desktop build. The local backend implements temporary conversations
    // (memory-only, never persisted, never listed, never exported), so
    // surface the native toggle.
    find: 'l=Ye(),c=ct(),d=yC();return l||!i||c&&d?null:t.jsx("div",{children:t.jsx(BZ,{hoverable:!1,side:"left",shortcut:o,content:r?t.jsx(vZ,{defaultMessage:"Exit incognito",id:"ItG+wlzX/s"})',
    replace:
      'l=Ye(),c=ct(),d=yC();return!1?null:t.jsx("div",{children:t.jsx(BZ,{hoverable:!1,side:"left",shortcut:o,content:r?t.jsx(vZ,{defaultMessage:"Exit incognito",id:"ItG+wlzX/s"})',
    satisfiedVersions: {
      "1.24012.11":
        "The native desktop title bar now owns the incognito toggle and consumes the release-specific feature gate; the obsolete in-content duplicate remains intentionally suppressed.",
    },
  },
  {
    id: "enable-chat-artifacts-gallery-route",
    assetUrlPath: "/assets/v1/c1b9abf13-bG6VlbXV.js",
    // The /artifacts chat-surface gallery route is feature-gated off in the
    // retained desktop build; the local gallery data sources are implemented,
    // so open the gate.
    find: "function ps({children:s}){const t=v(),n=oe(),",
    replace: "function ps({children:s}){const t=!0,n=oe(),",
    variants: [
      {
        label: "1.24012.9 artifacts navigation layout",
        assetUrlPath: "/assets/v1/c1b9abf13-Bki1JsZ6.js",
        scopeToAsset: true,
        find: "function I({children:e}){const s=U(),a=r(),{account:i}=t();",
        replace: "function I({children:e}){const s=!0,a=r(),{account:i}=t();",
      },
    ],
  },
  {
    id: "enable-native-chat-artifacts-tab",
    // The desktop build hardcodes the chat sidebar's Artifacts tab off. The
    // local gallery data sources are implemented, so surface the native tab
    // (correct icon, chat-surface /artifacts route) instead of injecting one.
    find: "hasArtifactsGallery:false",
    replace: "hasArtifactsGallery:true",
    satisfiedVersions: {
      "1.24012.9":
        "The chat sidebar already renders its native Artifacts navigation item in the local route probe.",
      "1.24012.11":
        "The chat sidebar includes its native Artifacts navigation item; the final route probe revalidates it for this release.",
    },
  },
  {
    id: "derive-local-chat-attachments",
    find: "wiggleEnabled:pn,targetStore:void 0,isLocalAgentMode:W||G",
    replace: 'wiggleEnabled:pn,targetStore:"org",isLocalAgentMode:W||G',
    satisfiedVersions: SATISFIED_12401211_ATTACHMENTS,
  },
  {
    id: "enable-local-claude-code-surface",
    find: 'claude_code_web:uD({feature:"claude_code_web",useClientSideGate:()=>(tv("bad_moon_rising"),!1)})',
    replace:
      'claude_code_web:uD({feature:"claude_code_web",useClientSideGate:()=>!0})',
    satisfiedVersions: SATISFIED_12401211_CODE,
  },
  {
    id: "classify-local-code-routes-as-local",
    assetUrlPath: "/assets/v1/c11959232-PSRJllna.js",
    // The upstream desktop client recognizes local sessions solely by a
    // `local_` id prefix. Open-Claude has always persisted UUID session ids,
    // so the upgraded renderer otherwise mounts the cloud Code transport and
    // cloud preview pane for a session that is already present locally. This
    // build has no cloud Code service; every /epitaxy task is local.
    find: 'function(e){const t=!e||e.startsWith("local_"),s=Ps(!t),{data:n}=ds(!t),{data:r}=le(e??"",!t);if(t)return{type:"local",resolved:!0};',
    replace:
      'function(e){const t=!0,s=Ps(!t),{data:n}=ds(!t),{data:r}=le(e??"",!t);if(t)return{type:"local",resolved:!0};',
    variants: [
      {
        label: "1.24012.11 UUID local Code route classification",
        assetUrlPath: "/assets/v1/c11959232-INhV7XSD.js",
        scopeToAsset: true,
        find: 'function(e){const t=!e||e.startsWith("local_"),s=yt(!t),{data:n}=jt(!t),{data:r}=_t(e??"",!t);if(e&&rs(e))return{type:"cli",resolved:!0};if(t)return{type:"local",resolved:!0};',
        replace:
          'function(e){const t=!0,s=yt(!t),{data:n}=jt(!t),{data:r}=_t(e??"",!t);if(e&&rs(e))return{type:"cli",resolved:!0};if(t)return{type:"local",resolved:!0};',
      },
    ],
  },
  {
    id: "start-local-code-browser-from-toggle",
    assetUrlPath: "/assets/v1/c06173196-DmnMdctC.js",
    // Cloud sessions pre-bind a browser server before this toolbar action is
    // used. Local Code has already created its deterministic browser, so ask
    // Launch for that server id and then use the renderer's native bind/open
    // actions. This does not depend on cloud session metadata arriving first.
    find: 'c=e.useMemo(()=>p2(l),[l]),u=e.useCallback(e=>{Sl({pane:e,opened:"diff"===e?!d:!l.has(e),via:s}),r(e)},[r,l,d,s]),f=e.useCallback',
    replace:
      'c=e.useMemo(()=>p2(l),[l]),B=hl(e=>e.bindPreviewServer),P=hl(e=>e.setSidePane),u=e.useCallback(e=>{"preview"===e&&!i&&!l.has(e)&&t?xt?.startBrowserPreview?.("",t.id)?.then(e=>{e&&(B(e),P("preview"))}):(Sl({pane:e,opened:"diff"===e?!d:!l.has(e),via:s}),r(e))},[r,l,d,s,i,t,B,P]),f=e.useCallback',
    satisfiedVersions: SATISFIED_12401211_BROWSER,
  },
  {
    id: "show-local-code-browser-toggle",
    assetUrlPath: "/assets/v1/c06173196-DmnMdctC.js",
    // Upstream only adds the preview toolbar item after a cloud session
    // advertises preview capability or a preview is already bound. Local Code
    // owns a Launch-backed browser for every session, so expose the native
    // globe control immediately instead of requiring a model tool call first.
    find: 'g=gt(),x=aa(t?.type),v=p||!!i||"remote"===t?.type&&x',
    replace: "g=gt(),x=!0,v=!0",
    satisfiedVersions: SATISFIED_12401211_BROWSER,
  },
  {
    id: "host-local-code-browser-native-view",
    assetUrlPath: "/assets/v1/c06173196-DmnMdctC.js",
    // The retained fallback path polls screenshots when its cloud-computed
    // native-view capability bit is false. Electron on the local Windows app
    // does host WebContentsView, so attach it to the measured browser pane.
    find: "if(!(t&&H&&e&&!x&&!q&&!B))return void(t&&xt?.hidePreview?.(t,U));",
    replace: "if(!(t&&H&&e&&!q&&!B))return void(t&&xt?.hidePreview?.(t,U));",
    satisfiedVersions: SATISFIED_12401211_BROWSER,
  },
  {
    id: "enable-local-claude-code-routines",
    // 1.22 ships the complete local-routine list/create/detail stack but its
    // capability hook is followed by a literal `return false`. Local mode
    // implements the CCDScheduledTasks service, so expose the native Routines
    // treatment and keep its create/run/delete actions on that local service.
    find: 'function bKn(){const{isAvailable:e}=Vs("claude_code_routines");return false}',
    replace:
      'function bKn(){const{isAvailable:e}=Vs("claude_code_routines");return!0}',
    satisfiedVersions: SATISFIED_12401211_SCHEDULED,
  },
  {
    id: "keep-scheduled-tasks-local",
    assetUrlPath: "/assets/v1/index-XoaBlZfC.js",
    // The upgraded renderer combines local CCDScheduledTasks with a remote
    // organization fetch whenever its synthetic local organization exists.
    // Open-Claude has no cloud scheduler, so the remote half can remain
    // pending forever and hold the otherwise successful local [] result
    // behind Promise.allSettled. Keep the native screen on the local service.
    find: "return n?m??Ou:Ou}function WNe(e,t){return FNe(e,ZNe(),t,!0)}",
    replace: "return Ou}function WNe(e,t){return FNe(e,ZNe(),t,!0)}",
    satisfiedVersions: SATISFIED_12401211_SCHEDULED,
  },
  {
    id: "settle-empty-local-scheduled-page",
    assetUrlPath: "/assets/v1/ca82bcec9-Bk8L5wm9.js",
    // In the native Code Scheduled page, enabling the routines capability
    // incorrectly keeps an empty local result on the loading branch. Once the
    // local list hook has settled, render its empty state just as the
    // non-routines path does.
    find: "!n&&!b||X?D&&!X?",
    replace: "!n||X?D&&!X?",
    satisfiedVersions: SATISFIED_12401211_SCHEDULED,
  },
  {
    id: "enable-native-local-code-artifacts",
    assetUrlPath: "/assets/v1/ca82bcec9-BHaPdnp0.js",
    find: "function gn(){const e=zt(),{data:t}=B(),a=void 0===t;return e||a?",
    replace: "function gn(){const e=!0,{data:t}=B(),a=void 0===t;return e||a?",
    satisfiedVersions: {
      "1.24012.9":
        "The native Code Artifacts route mounts and renders its empty state in the local route probe.",
      "1.24012.11":
        "The native Code Artifacts route is present; the final route probe revalidates its local empty state for this release.",
    },
  },
  {
    id: "enable-local-artifact-gallery-data",
    assetUrlPath: "/assets/v1/c47ad434c-D_dYPjVp.js",
    find: 'function se(){const e=Boolean(""),{isAvailable:t}=i("cobalt_plinth");return!d(()=>!1,!1)&&(e||t)}',
    replace: "function se(){return!0}",
    variants: [
      {
        label: "1.24012.9 chat artifacts page gate",
        assetUrlPath: "/assets/v1/ce569194f-C3zDrMgh.js",
        scopeToAsset: true,
        find: 'function p(){const r=o(),p=a(),v=j("chat",{relTabs:!0});',
        replace: 'function p(){const r=!0,p=a(),v=j("chat",{relTabs:!0});',
      },
    ],
  },
  {
    id: "bind-native-artifact-gallery-to-local-desktop-store",
    assetUrlPath: "/assets/v1/c47ad434c-D_dYPjVp.js",
    find: "function oe(e=!1,t){const r=!0===t?.starredOnly,a=!1!==t?.enabled,{activeOrganization:s}=u(),o=U(),n=s?.uuid,i=c(),d=se(),m=l(",
    replace:
      'function oe(e=!1,t){const r=c(),[a,s]=p.useState({artifacts:[],isPending:!0,isError:!1});return p.useEffect(()=>{let e=!1;const t=window["claude.web"]?.LocalSessions?.getAllArtifacts?.();return Promise.resolve(t).then(t=>{e||s({artifacts:Array.isArray(t)?t:[],isPending:!1,isError:!1})}).catch(()=>{e||s({artifacts:[],isPending:!1,isError:!0})}),()=>{e=!0}},[]),{enabled:!0,includeShared:!1,items:a.artifacts.map(e=>({key:`frame:${e.sessionId}:${e.id}`,source:"frame",rel:"mine",title:e.title??"Artifact",description:e.sessionTitle,extraSearchText:[e.sessionTitle,e.path].filter(e=>"string"==typeof e),href:"chat"===e.sourceSurface?`/chat/${encodeURIComponent(e.sessionId)}?artifactId=${encodeURIComponent(e.id)}`:`/epitaxy/${encodeURIComponent(e.sessionId)}?open_local_artifact=${encodeURIComponent(e.id)}`,newTab:!1,updatedAtMs:e.updatedAt?Date.parse(e.updatedAt):void 0,createdAtMs:e.updatedAt?Date.parse(e.updatedAt):void 0,audience:"owner",softDeleted:!1,starred:!1})),isPending:a.isPending,isError:a.isError,capped:!1,isPartial:!1,isPartialError:!1,starsEnabled:!1}}function oeCloudUnused(e=!1,t){const r=!0===t?.starredOnly,a=!1!==t?.enabled,{activeOrganization:s}=u(),o=U(),n=s?.uuid,i=c(),d=se(),m=l(',
    variants: [
      {
        label: "1.24012.11 local desktop artifact gallery store",
        assetUrlPath: "/assets/v1/c47ad434c-H0QO7_Kw.js",
        scopeToAsset: true,
        find: "function K(e=!1,t){const a=!0===t?.starredOnly,n=!1!==t?.enabled,{activeOrganization:i}=s(),u=m(),l=i?.uuid,c=r(),f=I(),",
        replace:
          'function K(e=!1,t){const a=r(),[n,i]=(0,_.useState)({artifacts:[],isPending:!0,isError:!1});return(0,_.useEffect)(()=>{let e=!1;const t=window["claude.web"]?.LocalSessions?.getAllArtifacts?.();return Promise.resolve(t).then(t=>{e||i({artifacts:Array.isArray(t)?t:[],isPending:!1,isError:!1})}).catch(()=>{e||i({artifacts:[],isPending:!1,isError:!0})}),()=>{e=!0}},[]),{enabled:!0,includeShared:!1,items:n.artifacts.map(e=>({key:`frame:${e.sessionId}:${e.id}`,source:"frame",rel:"mine",title:e.title??"Artifact",description:e.sessionTitle,extraSearchText:[e.sessionTitle,e.path].filter(e=>"string"==typeof e),href:"chat"===e.sourceSurface?`/chat/${encodeURIComponent(e.sessionId)}?artifactId=${encodeURIComponent(e.id)}`:`/epitaxy/${encodeURIComponent(e.sessionId)}?open_local_artifact=${encodeURIComponent(e.id)}`,newTab:!1,updatedAtMs:e.updatedAt?Date.parse(e.updatedAt):void 0,createdAtMs:e.updatedAt?Date.parse(e.updatedAt):void 0,audience:"owner",softDeleted:!1,starred:!1})),isPending:n.isPending,isError:n.isError,capped:!1,isPartial:!1,isPartialError:!1,starsEnabled:!1}}function KCloudUnused(e=!1,t){const a=!0===t?.starredOnly,n=!1!==t?.enabled,{activeOrganization:i}=s(),u=m(),l=i?.uuid,c=r(),f=I(),',
      },
    ],
    satisfiedVersions: {
      "1.24012.9":
        "The local app protocol now backs the native frame gallery endpoints from LocalSessions, so the renderer no longer needs a direct bridge-store replacement.",
    },
  },
  {
    id: "use-local-code-artifact-gallery-source",
    assetUrlPath: "/assets/v1/ce569194f-YKjvV2xt.js",
    // Also force the gallery-enabled gate (e) on: the desktop build ships
    // the /artifacts chat-surface page feature-gated off.
    find: 'function Ke(){const e=z(),s=n(),r=We("chat",{relTabs:!0});',
    replace: 'function Ke(){const e=!0||z(),s=n(),r=We("frame",{relTabs:!0});',
    variants: [
      {
        label: "1.24012.9 local frame gallery source",
        assetUrlPath: "/assets/v1/ce569194f-C3zDrMgh.js",
        scopeToAsset: true,
        find: 'v=j("chat",{relTabs:!0})',
        replace: 'v=j("frame",{relTabs:!0})',
      },
    ],
  },
  {
    id: "expose-local-code-artifact-pane-opener",
    assetUrlPath: "/assets/v1/c06173196-DmnMdctC.js",
    find: "c=e.useState(()=>o??$o())[0],u=e.useState(()=>!o)[0];return e.useEffect(()=>Uo(l,d),[l,d]),",
    replace:
      'c=e.useState(()=>o??$o())[0],u=e.useState(()=>!o)[0];return e.useEffect(()=>Uo(l,d),[l,d]),e.useEffect(()=>{const e=e=>{const t=l.getState();t.setPendingArtifactOpenUrl(e),t.setSidePane("artifact")},t=()=>{const t=document.documentElement.dataset.openClaudeCodeArtifact;t&&(delete document.documentElement.dataset.openClaudeCodeArtifact,e(t))};return window.__openLocalCodeArtifact=e,window.addEventListener("open-claude-code-artifact",t),t(),()=>{window.removeEventListener("open-claude-code-artifact",t),window.__openLocalCodeArtifact===e&&delete window.__openLocalCodeArtifact}},[l]),',
    variants: [
      {
        label: "1.24012.11 local Code artifact pane opener",
        assetUrlPath: "/assets/v1/c360a9e1c-pT3aoO21.js",
        scopeToAsset: true,
        find: 'function AU(e){const t=_U(),n=EU(),s=sb(),a=ov(e=>e.hasSidePanes)&&null!==s,i=(0,VS.useCallback)(t=>{if(!s)return;const n=s.getState();ob(n,"artifact",e),n.setPendingArtifactOpenUrl(t),n.setSidePane("artifact")},[s,e]);return null!==n?n:t&&a?i:null}',
        replace:
          'function AU(e){const t=_U(),n=EU(),s=sb(),a=ov(e=>e.hasSidePanes)&&null!==s,i=(0,VS.useCallback)(t=>{if(!s)return;const n=s.getState();ob(n,"artifact",e),n.setPendingArtifactOpenUrl(t),n.setSidePane("artifact")},[s,e]);return(0,VS.useEffect)(()=>{const e=()=>{const t=new URL(location.href).searchParams.get("open_local_artifact");t&&i(`/code/artifact/${encodeURIComponent(t)}`)};return window.addEventListener("popstate",e),e(),()=>window.removeEventListener("popstate",e)},[i]),null!==n?n:a?i:null}',
      },
    ],
  },
  {
    id: "allow-local-code-artifact-pane-urls",
    assetUrlPath: "/assets/v1/c06173196-DmnMdctC.js",
    // Local artifact routes are not public Claude-page URLs, so the retained
    // artifact pane normally rejects them before calling the desktop preview
    // loader. Once the loader returns its local server, bind that same server
    // to the Browser/Preview tile as well. Element selection is owned by that
    // tile; leaving it on the session's seed browser keeps the toolbar visible
    // but disabled over about:blank.
    find: 'e.useEffect(()=>{const e=Q;if(e)if(hp(e)&&$b(e))if(d){Z(null),K.current=!0;const t=q.find(t=>t.url===e)??{url:e,slug:Ip(e)??e,kind:"claudePage"};U(t).then(s=>{null===s&&(D(t.url),K.current=!1,window.open(e,"_blank","noopener,noreferrer"))})}',
    replace:
      'e.useEffect(()=>{const e=Q;if(e)if(hp(e)&&$b(e)||/^\\/code\\/artifact\\/[0-9a-f-]{36}$/i.test(e))if(d){Z(null),K.current=!0;const t=q.find(t=>t.url===e)??{url:e,slug:Ip(e)??e,kind:"claudePage"};U(t).then(s=>{if(null===s)D(t.url),K.current=!1,window.open(e,"_blank","noopener,noreferrer");else if(/^\\/code\\/artifact\\/[0-9a-f-]{36}$/i.test(e)&&N){const e=N.getState();e.bindPreviewServer(s),e.setSidePane("preview")}})}',
    variants: [
      {
        label: "1.24012.11 local Code artifact URLs",
        assetUrlPath: "/assets/v1/c360a9e1c-pT3aoO21.js",
        scopeToAsset: true,
        find: '(0,VS.useEffect)(()=>{const e=q;if(e)if(Za(e)&&ka(e))if(o){V(null),H.current=!0;const t=z.find(t=>t.url===e)??{url:e,slug:Ci(e)??e,kind:"claudePage"};',
        replace:
          '(0,VS.useEffect)(()=>{const e=q;if(e)if(Za(e)&&ka(e)||/^\\/code\\/artifact\\/[0-9a-f-]{36}$/i.test(e))if(o){V(null),H.current=!0;const t=z.find(t=>t.url===e)??{url:e,slug:Ci(e)??e,kind:"claudePage"};',
      },
    ],
  },
  {
    id: "open-local-code-artifact-deep-links",
    assetUrlPath: "/assets/v1/c11959232-INhV7XSD.js",
    scopeToAsset: true,
    // The .11 route keeps its session pane store mounted independently from
    // artifact links. Consume the local gallery/probe deep link there so a
    // restored URL opens the artifact tile even before an artifact component
    // has mounted and registered its own click callback.
    find: "return()=>e?.()},[t,o,i]);const m=(0,dr.useRef)(new Set)",
    replace:
      'return()=>e?.()},[t,o,i]),(0,dr.useEffect)(()=>{if(!i)return;const e=()=>{const t=new URL(location.href).searchParams.get("open_local_artifact");if(!t||!/^[0-9a-f-]{36}$/i.test(t))return;const e=i.getState();e.setPendingArtifactOpenUrl(`/code/artifact/${encodeURIComponent(t)}`),e.setSidePane("artifact")};return window.addEventListener("popstate",e),e(),()=>window.removeEventListener("popstate",e)},[i,o]);const m=(0,dr.useRef)(new Set)',
  },
  {
    id: "use-random-local-code-activity-label",
    assetUrlPath: "/assets/v1/c5610fbe3-QnNBykKf.js",
    find: 'w.formatMessage({defaultMessage:"Reconnecting\\u2026",id:"Yyp8xwgnUo"})',
    replace:
      '(document.documentElement.dataset.openClaudeActivityWord??"Working")+"\\u2026"',
    variants: [
      {
        label: "1.24012.11 local activity label",
        assetUrlPath: "/assets/v1/c5610fbe3-BdzIubgw.js",
        scopeToAsset: true,
        find: 'y.formatMessage({defaultMessage:"Reconnecting\\u2026",id:"Yyp8xwgnUo"})',
        replace:
          '(document.documentElement.dataset.openClaudeActivityWord??"Working")+"\\u2026"',
      },
    ],
  },
  {
    id: "remove-cloud-model-switch-setting",
    assetUrlPath: "/assets/v1/c71860c77-QKSs-TTD.js",
    find: 'qe=["enabled_model_auto_fallback","enabled_web_search","tool_search_mode"],ze=e.memo(()=>{',
    replace:
      'qe=["enabled_model_auto_fallback","enabled_web_search","tool_search_mode"],ze=e.memo(()=>null),zeCloudUnused=e.memo(()=>{',
    variants: [
      {
        label: "1.24012.11 cloud model switch",
        assetUrlPath: "/assets/v1/c71860c77-BhxGdU0q.js",
        scopeToAsset: true,
        find: "var Ge=(0,Ne.memo)(()=>{const{account:e}=f(),s=v(),a=e?.settings?.ccr_switch_models_on_flag??!0,",
        replace:
          "var Ge=(0,Ne.memo)(()=>null),GeCloudUnused=(0,Ne.memo)(()=>{const{account:e}=f(),s=v(),a=e?.settings?.ccr_switch_models_on_flag??!0,",
      },
    ],
  },
  {
    id: "remove-local-model-switch-setting",
    assetUrlPath: "/assets/v1/c71860c77-QKSs-TTD.js",
    find: "We=e.memo(()=>{const a=n(),{resolved:t,patch:l,isPatchAvailable:o}=Te(),",
    replace:
      "We=e.memo(()=>null),WeCloudUnused=e.memo(()=>{const a=n(),{resolved:t,patch:l,isPatchAvailable:o}=Te(),",
    variants: [
      {
        label: "1.24012.11 local model switch",
        assetUrlPath: "/assets/v1/c71860c77-BhxGdU0q.js",
        scopeToAsset: true,
        find: "Je=(0,Ne.memo)(()=>{const e=v(),{resolved:s,patch:a,isPatchAvailable:t}=Ye(),",
        replace:
          "Je=(0,Ne.memo)(()=>null),JeLocalUnused=(0,Ne.memo)(()=>{const e=v(),{resolved:s,patch:a,isPatchAvailable:t}=Ye(),",
      },
    ],
  },
  {
    id: "enable-local-published-artifacts-query",
    // The publish modal decides between its "Create & copy link" and
    // "Artifact published" (link + Unpublish) views from this per-message
    // published-artifacts query. Kill-switched, it never runs locally, so
    // publishing gave no feedback and unpublish was unreachable.
    find: "te(`/api/organizations/${s}/published_artifacts?${a.toString()}`,{staleTime:0,queryKey:[Bv,{orgUuid:s,includeDeletedArtifacts:t?.includeDeletedArtifacts,noToast:t?.noToast}],enabled:!!s&&(t?.enabled??!0),meta:{noToast:t?.noToast}})",
    replace:
      "te(`/api/organizations/${s}/published_artifacts?${a.toString()}`,{custom3pCompatible:!0,staleTime:0,queryKey:[Bv,{orgUuid:s,includeDeletedArtifacts:t?.includeDeletedArtifacts,noToast:t?.noToast}],enabled:!!s&&(t?.enabled??!0),meta:{noToast:t?.noToast}})",
    variants: [
      {
        label: "1.24012.11 local published artifact query",
        assetUrlPath: "/assets/v1/shared-8-CXotDwX0.js",
        scopeToAsset: true,
        find: "we(`/api/organizations/${s}/published_artifacts?${n.toString()}`,{staleTime:e?.staleTime??0,queryKey:[ft,{orgUuid:s,includeDeletedArtifacts:e?.includeDeletedArtifacts,noToast:e?.noToast}],enabled:!!s&&(e?.enabled??!0),meta:{noToast:e?.noToast}})",
        replace:
          "we(`/api/organizations/${s}/published_artifacts?${n.toString()}`,{custom3pCompatible:!0,staleTime:e?.staleTime??0,queryKey:[ft,{orgUuid:s,includeDeletedArtifacts:e?.includeDeletedArtifacts,noToast:e?.noToast}],enabled:!!s&&(e?.enabled??!0),meta:{noToast:e?.noToast}})",
      },
    ],
  },
  {
    id: "enable-local-mcp-connectors-feature",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // The whole Connectors surface hangs off the papi_mcp statsig gate,
    // which the empty local statsig payload leaves false — hence the
    // "add connector" bounce to the skills page.
    find: 'const MBe=()=>tv("papi_mcp"),ABe=()=>!tv("papi_disable_mcp_ui")',
    replace: 'const MBe=()=>!0,ABe=()=>!tv("papi_disable_mcp_ui")',
    satisfiedVersions: SATISFIED_12401211_MCP,
  },
  {
    id: "enable-local-mcp-connectors-list-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    find: "return YT(`/api/organizations/${e}/mcp/remote_servers`,{queryKey:[fI,e],enabled:!r&&n&&!!e,",
    replace:
      "return YT(`/api/organizations/${e}/mcp/remote_servers`,{custom3pCompatible:!0,queryKey:[fI,e],enabled:!r&&n&&!!e,",
    satisfiedVersions: SATISFIED_12401211_MCP,
  },
  {
    id: "enable-local-mcp-connectors-connection-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    find: 'return YT(`/api/organizations/${e}/mcp/remote_servers_with_connection`,{queryKey:[fI,e,"with-connection"],',
    replace:
      'return YT(`/api/organizations/${e}/mcp/remote_servers_with_connection`,{custom3pCompatible:!0,queryKey:[fI,e,"with-connection"],',
    satisfiedVersions: SATISFIED_12401211_MCP,
  },
  {
    id: "enable-local-mcp-connector-item-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    find: "return YT(`/api/organizations/${e}/mcp/remote_servers/${t}`,{queryKey:[mI,e,t],",
    replace:
      "return YT(`/api/organizations/${e}/mcp/remote_servers/${t}`,{custom3pCompatible:!0,queryKey:[mI,e,t],",
    satisfiedVersions: SATISFIED_12401211_MCP,
  },
  {
    id: "enable-local-code-plugins-access",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // The plugins section on the Code surface needs this statsig-backed
    // skills-access gate; the local bootstrap ships empty statsig values,
    // so it read false and the (fully backed) LocalPlugins UI never
    // rendered.
    find: 'function EPe(){const e=tv("claudeai_skills_claude_code_access"),t=Sfe(),n=mD();return e&&t&&n}',
    replace: "function EPe(){return!0}",
    variants: [
      {
        label: "1.24012.11 local Code plugins access",
        assetUrlPath: "/assets/v1/shared-2-BPyhP5ka.js",
        scopeToAsset: true,
        find: 'function nm(){const e=Se("claudeai_skills_claude_code_access"),t=wi(),n=he();return e&&t&&n}',
        replace: "function nm(){return!0}",
      },
    ],
  },
  {
    id: "use-local-plugin-inventory-in-every-surface",
    assetUrlPath: "/assets/v1/c2ee0272b-DPDuX889.js",
    // The native plugin settings hook selects the local (CCD) inventory only
    // while the route itself is Code. Settings is normally opened over /new,
    // so an installed plugin disappears and the screen falls back to a cloud
    // account query. Open-Claude has one device-local plugin store shared by
    // Chat and Code; always use that store regardless of the underlying route.
    find: 'function _Pe(){const e=Wie();return!!Yy?.getPlugins&&("code"===e||"epitaxy"===e)}',
    replace: "function _Pe(){return!!Yy?.getPlugins}",
    variants: [
      {
        label: "1.24012.11 local plugin inventory on every surface",
        assetUrlPath: "/assets/v1/shared-1-DvXOh9-L.js",
        scopeToAsset: true,
        find: 'function gA(){const e=ZM();return!!mt?.getPlugins&&("code"===e||"epitaxy"===e)}',
        replace: "function gA(){return!!mt?.getPlugins}",
      },
    ],
  },
  {
    id: "enable-local-plugin-capability-without-cloud-account",
    assetUrlPath: "/assets/v1/c2ee0272b-DPDuX889.js",
    // The inventory hook applies a second cloud capability check after it has
    // selected LocalPlugins. An account-free local profile has no CCD org
    // capability document, so this gate hid a valid local inventory and also
    // disabled its toggle/delete mutations. Bridge completeness is the local
    // capability boundary.
    find: 'function NPe(){const e=_Pe(),t=Efe(),n=EPe(),r=MPe(),o=l$(),a=CF(),{status:s,unsupportedCode:i}=_$(),c=!!(Yy?.getPlugins&&Yy?.uploadPlugin&&Yy?.deletePlugin&&Yy?.setPluginEnabled);if(e){const e=null!==a&&"supported"===yF(a,"ccdPlugins").status,r=c&&e;return{isVisible:r,isEnabled:r&&(t||n),disabledReason:void 0}}const l=c&&o,u=l&&"supported"===s;return{isVisible:u,isEnabled:u&&(t||r),disabledReason:l&&"unsupported"===s?i:void 0}}',
    replace:
      "function NPe(){const e=!!(Yy?.getPlugins&&Yy?.uploadPlugin&&Yy?.deletePlugin&&Yy?.setPluginEnabled);return{isVisible:e,isEnabled:e,disabledReason:void 0}}",
    variants: [
      {
        label: "1.24012.11 local plugin capability",
        assetUrlPath: "/assets/v1/shared-2-BPyhP5ka.js",
        scopeToAsset: true,
        find: 'function dm(){const e=Qn(),t=ki(),n=nm(),a=rm(),r=Gn(),s=It(),{status:o,unsupportedCode:i}=Bn(),c=!!(ct?.getPlugins&&ct?.uploadPlugin&&ct?.deletePlugin&&ct?.setPluginEnabled);if(e){const e=null!==s&&"supported"===He(s,"ccdPlugins").status,a=c&&e;return{isVisible:a,isEnabled:a&&(t||n),disabledReason:void 0}}const u=c&&r,l=u&&"supported"===o;return{isVisible:l,isEnabled:l&&(t||a),disabledReason:u&&"unsupported"===o?i:void 0}}',
        replace:
          "function dm(){const e=!!(ct?.getPlugins&&ct?.uploadPlugin&&ct?.deletePlugin&&ct?.setPluginEnabled);return{isVisible:e,isEnabled:e,disabledReason:void 0}}",
      },
    ],
  },
  {
    id: "refresh-local-plugin-inventory-on-settings-mount",
    assetUrlPath: "/assets/v1/c2ee0272b-DPDuX889.js",
    // The Customize sidebar mounts the same query before an installation can
    // complete. Its five-minute stale window otherwise leaves the Plugins
    // settings page showing the launch-time empty array after a successful
    // install performed by Directory or another bridge consumer.
    find: "meta:{noToast:INe,silent:INe},staleTime:MNe,gcTime:ANe,refetchOnWindowFocus:!1})}function jNe()",
    replace:
      'meta:{noToast:INe,silent:INe},staleTime:0,gcTime:ANe,refetchOnMount:"always",refetchOnWindowFocus:!1})}function jNe()',
    variants: [
      {
        label: "1.24012.11 refresh local plugin inventory",
        assetUrlPath: "/assets/v1/shared-2-BPyhP5ka.js",
        scopeToAsset: true,
        find: "meta:{noToast:qm,silent:qm},staleTime:jm,gcTime:zm,refetchOnWindowFocus:!1})}function Dm()",
        replace:
          'meta:{noToast:qm,silent:qm},staleTime:0,gcTime:zm,refetchOnMount:"always",refetchOnWindowFocus:!1})}function Dm()',
      },
    ],
  },
  {
    id: "grant-local-project-edit-permissions",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // The permission hook derives knowledge/settings edit rights from
    // membership and permissions queries that the custom3pCompatible
    // kill-switch never lets run locally, so every project rendered
    // read-only: no Files upload UI, no instructions editor. The single
    // local user owns every project.
    find: 'return{hasSettingsEditPermission:u,isProjectShared:d||(a?.group_assignments?.length??0)>0||!1===r?.is_private,hasKBEditPermissions:"user"===l||!r?.is_private&&"user"===r?.organization_role||!!s?.permissions.includes(YO.KnowledgeEdit),canManageMembers:"user"===l||!r?.is_private&&"user"===r?.organization_role||!!s?.permissions.includes(YO.MembersManage),isPermissionLoading:c}',
    replace:
      "return{hasSettingsEditPermission:!0,isProjectShared:!1,hasKBEditPermissions:!0,canManageMembers:!0,isPermissionLoading:!1}",
    satisfiedVersions: SATISFIED_12401211_PROJECTS,
  },
  {
    id: "activate-new-local-code-browser-tab",
    assetUrlPath: "/assets/v1/c06173196-BO3xYnQU.js",
    // The retained browser's New tab control created a native tab but dropped
    // its ID. That leaves the currently selected tab unchanged, making the
    // control appear to do nothing. Activate every tab it opens, including
    // the extra initial tab retained by the upstream empty-state flow.
    find: "const v=e.useCallback(()=>{if(n){const e=0===l.length;(async()=>{await(xt?.openPreviewTab?.(n,g)),e&&await(xt?.openPreviewTab?.(n,g))})()}else u()},[n,g,l.length,u]),b=e.useCallback(e=>{n&&xt?.setActivePreviewTab?.(n,e)},[n]),",
    replace:
      "const v=e.useCallback(()=>{if(n){const e=0===l.length;(async()=>{const t=await xt?.openPreviewTab?.(n,g);t&&await xt?.setActivePreviewTab?.(n,t);if(e){const t=await xt?.openPreviewTab?.(n,g);t&&await xt?.setActivePreviewTab?.(n,t)}})()}else u()},[n,g,l.length,u]),b=e.useCallback(e=>{n&&xt?.setActivePreviewTab?.(n,e)},[n]),",
    scopeToAsset: true,
    satisfiedVersions: SATISFIED_12401211_BROWSER,
  },
  {
    id: "reserve-claude-namespace-in-code-client",
    assetUrlPath: "/assets/v1/c06173196-BO3xYnQU.js",
    // The retained Code client embeds upstream paths in its dev-server setup
    // prompt, launch controls, worktree handling, plan rendering, and remote
    // progress copy. Rewrite every path-shaped namespace token while leaving
    // domains and the explicit reserved-folder warning untouched.
    find: /(?<![A-Za-z0-9])\.claude(?=(?:\\[\\/]|[\\/\[]))/gu,
    replace: ".open-claude",
    expectedMatches: 12,
    scopeToAsset: true,
    variants: [
      {
        label: "1.24012.11 Code namespace boundary",
        assetUrlPath: "/assets/v1/c360a9e1c-pT3aoO21.js",
        scopeToAsset: true,
        find: /(?<![A-Za-z0-9])\.claude(?=(?:\\[\\/]|[\\/\[]))/gu,
        replace: ".open-claude",
        expectedMatches: 12,
      },
    ],
  },
  {
    id: "reserve-claude-namespace-in-shared-client",
    assetUrlPath: "/assets/v1/c2ee0272b-DPDuX889.js",
    // Shared file/memory classifiers also carry upstream .claude paths. They
    // must classify only Open-Claude-owned state in this standalone runtime.
    find: /(?<![A-Za-z0-9])\.claude(?=(?:\\[\\/]|[\\/\[]))/gu,
    replace: ".open-claude",
    expectedMatches: 9,
    scopeToAsset: true,
    variants: [
      {
        label: "1.24012.11 shared namespace boundary",
        assetUrlPath: "/assets/v1/shared-0-C4kdVF7Y.js",
        scopeToAsset: true,
        find: /(?<![A-Za-z0-9])\.claude(?=(?:\\[\\/]|[\\/\[]))/gu,
        replace: ".open-claude",
        expectedMatches: 9,
      },
    ],
  },
  {
    id: "reserve-claude-namespace-in-code-settings",
    assetUrlPath: "/assets/v1/c71860c77-DALji115.js",
    find: /(?<![A-Za-z0-9])\.claude(?=(?:\\[\\/]|[\\/\[]))/gu,
    replace: ".open-claude",
    expectedMatches: 1,
    scopeToAsset: true,
  },
  {
    id: "reserve-claude-namespace-in-directory-insights",
    assetUrlPath: "/assets/v1/ca768caa9-DXjGMACc.js",
    find: /(?<![A-Za-z0-9])\.claude(?=(?:\\[\\/]|[\\/\[]))/gu,
    replace: ".open-claude",
    expectedMatches: 1,
    scopeToAsset: true,
  },
  {
    id: "reserve-claude-namespace-in-main-client",
    assetUrlPath: "/assets/v1/index-XoaBlZfC.js",
    // Covers plugin install copy, project-settings prompts, and agent release
    // notes that otherwise direct the user or model to Anthropic's directory.
    find: /(?<![A-Za-z0-9])\.claude(?=(?:\\[\\/]|[\\/\[]))/gu,
    replace: ".open-claude",
    expectedMatches: 5,
    scopeToAsset: true,
    variants: [
      {
        label: "1.24012.11 main namespace boundary",
        assetUrlPath: "/assets/v1/index-Dh0MX4cp.js",
        scopeToAsset: true,
        find: /(?<![A-Za-z0-9])\.claude(?=(?:\\[\\/]|[\\/\[]))/gu,
        replace: ".open-claude",
        expectedMatches: 4,
      },
    ],
  },
  {
    id: "reserve-claude-namespace-in-release-notes",
    assetUrlPath: "/assets/v1/shared-14-CqcCbqpV.js",
    // The retained Code release-note copy is rendered inside this standalone
    // product and must point at its owned agent directory as well.
    find: /(?<![A-Za-z0-9])\.claude(?=(?:\\[\\/]|[\\/\[]))/gu,
    replace: ".open-claude",
    expectedMatches: 1,
    scopeToAsset: true,
  },
  {
    id: "replace-claude-local-project-namespace",
    assetUrlPath: "/assets/v1/index-XoaBlZfC.js",
    find: /(?<![A-Za-z0-9])\.claude\.local(?=(?:\\[\\/]|[\\/\[]))/gu,
    replace: ".open-claude/local",
    expectedMatches: 1,
    scopeToAsset: true,
  },
  {
    id: "clarify-reserved-claude-folder-warning",
    assetUrlPath: "/assets/v1/c06173196-BO3xYnQU.js",
    find: "This folder is inside a .claude directory. Claude will ask before every file edit, even in bypass mode.",
    replace:
      "This folder belongs to Anthropic Claude and cannot be used by Open-Claude tools.",
    scopeToAsset: true,
    variants: [
      {
        label: "1.24012.11 reserved-folder warning",
        assetUrlPath: "/assets/v1/c360a9e1c-pT3aoO21.js",
        scopeToAsset: true,
        find: "This folder is inside a .claude directory. Claude will ask before every file edit, even in bypass mode.",
        replace:
          "This folder belongs to Anthropic Claude and cannot be used by Open-Claude tools.",
      },
    ],
  },
  {
    id: "clarify-reserved-claude-folder-warning-en-US",
    assetUrlPath: "/i18n/en-US.json",
    find: "This folder is inside a .claude directory. Claude will ask before every file edit, even in bypass mode.",
    replace:
      "This folder belongs to Anthropic Claude and cannot be used by Open-Claude tools.",
    scopeToAsset: true,
  },
  {
    id: "defer-local-terminal-pty-delivery",
    find: 'for(const n of Jmt)try{n(e)}catch(t){ht.error(gt.DESKTOP_API,"localShellPtyTransport subscriber threw",{err:t})}',
    replace:
      'for(const n of Jmt)setTimeout(()=>{try{n(e)}catch(t){ht.error(gt.DESKTOP_API,"localShellPtyTransport subscriber threw",{err:t})}},0)',
    variants: [
      {
        label: "1.24012.11 deferred terminal delivery",
        assetUrlPath: "/assets/v1/shared-9-PXQDd6y1.js",
        scopeToAsset: true,
        find: 'for(const t of zS)try{t(e)}catch(MT){O.error(de.DESKTOP_API,"localShellPtyTransport subscriber threw",{err:MT})}',
        replace:
          'for(const t of zS)setTimeout(()=>{try{t(e)}catch(MT){O.error(de.DESKTOP_API,"localShellPtyTransport subscriber threw",{err:MT})}},0)',
      },
    ],
  },
];

export function moduleAssetPaths(indexHtml: string): string[] {
  const paths = new Set<string>();
  const attribute = (tag: string, name: string): string | undefined =>
    tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "iu"))?.[1];
  for (const match of indexHtml.matchAll(/<script\b[^>]*>/giu)) {
    const tag = match[0];
    if (attribute(tag, "type")?.toLowerCase() !== "module") continue;
    const source = attribute(tag, "src");
    if (source) paths.add(source);
  }
  for (const match of indexHtml.matchAll(/<link\b[^>]*>/giu)) {
    const tag = match[0];
    if (attribute(tag, "rel")?.toLowerCase() !== "modulepreload") continue;
    const href = attribute(tag, "href");
    if (href) paths.add(href);
  }
  if (paths.size === 0)
    throw new Error("Packaged UI module assets were not found");
  return [...paths];
}

interface EffectiveClientPatchVariant extends ClientPatchVariant {
  label: string;
}

function effectiveVariants(patch: ClientPatch): EffectiveClientPatchVariant[] {
  const inherited = {
    assetUrlPath: patch.assetUrlPath,
    expectedMatches: patch.expectedMatches,
    scopeToAsset: patch.scopeToAsset,
  };
  return [
    {
      ...inherited,
      label: patch.label ?? "retained",
      find: patch.find,
      replace: patch.replace,
    },
    ...(patch.variants ?? []).map((variant, index) => ({
      ...inherited,
      ...variant,
      label: variant.label ?? `variant-${index + 1}`,
    })),
  ];
}

async function allPatchAssetPaths(root: string): Promise<string[]> {
  const assets: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (
        entry.isFile() &&
        [".js", ".json"].includes(path.extname(entry.name).toLowerCase())
      )
        assets.push(absolute);
    }
  };
  await visit(root);
  return assets;
}

function matchExpression(find: string | RegExp): RegExp | null {
  if (!(find instanceof RegExp)) return null;
  return new RegExp(
    find.source,
    find.flags.includes("g") ? find.flags : `${find.flags}g`,
  );
}

function countOccurrences(source: string, find: string | RegExp): number {
  const expression = matchExpression(find);
  return expression
    ? [...source.matchAll(expression)].length
    : source.split(find as string).length - 1;
}

function applyReplacement(
  source: string,
  find: string | RegExp,
  replacement: string,
): string {
  const expression = matchExpression(find);
  return expression
    ? source.replace(expression, () => replacement)
    : source.split(find as string).join(replacement);
}

export async function applyClientPatchSet(
  root: string,
  indexHtml: string,
  patches: readonly ClientPatch[],
  options: ApplyClientPatchOptions = {},
): Promise<{
  assets: Map<string, { source: string; ids: string[] }>;
  report: ClientPatchReport;
}> {
  const mode = options.mode ?? "strict";
  const sources = new Map<string, string>();
  const explicitAssetPaths = new Map<string, Set<string>>();
  const rememberExplicitAsset = (assetUrlPath: string, assetPath: string) => {
    const existing = explicitAssetPaths.get(assetUrlPath) ?? new Set<string>();
    existing.add(path.resolve(assetPath));
    explicitAssetPaths.set(assetUrlPath, existing);
  };
  const canonicalRoot = await realpath(root);
  for (const assetUrlPath of moduleAssetPaths(indexHtml)) {
    const assetPath = resolveInside(root, assetUrlPath);
    const asset = assetPath
      ? await readPatchAsset(canonicalRoot, assetPath)
      : null;
    if (!asset)
      throw new Error(`Packaged UI module is unavailable: ${assetUrlPath}`);
    sources.set(path.resolve(asset.path), asset.source);
  }
  const referencedAssetUrls = new Set(
    patches.flatMap((patch) =>
      effectiveVariants(patch)
        .map((variant) => variant.assetUrlPath)
        .filter(Boolean),
    ) as string[],
  );
  for (const assetUrlPath of referencedAssetUrls) {
    const assetPath = resolveInside(root, assetUrlPath);
    const asset = assetPath
      ? await readPatchAsset(canonicalRoot, assetPath)
      : null;
    if (asset) {
      sources.set(path.resolve(asset.path), asset.source);
      rememberExplicitAsset(assetUrlPath, asset.path);
      continue;
    }

    // Vite keeps the stable chunk id before the final content hash. A Claude
    // point release can therefore rename `chunk-HASH.js` without changing the
    // code pattern we patch. Resolve that compatible rename instead of making
    // the whole local app fail before its first window appears.
    const directoryUrl = path.posix.dirname(assetUrlPath);
    const requestedName = path.posix.basename(assetUrlPath);
    const stablePrefix = requestedName.match(/^([^-]+)-/u)?.[1];
    const directory = resolveInside(root, directoryUrl);
    const compatible =
      stablePrefix && directory
        ? (await readdir(directory, { withFileTypes: true }).catch(() => []))
            .filter(
              (entry) =>
                entry.isFile() &&
                entry.name.startsWith(`${stablePrefix}-`) &&
                path.extname(entry.name) === path.extname(requestedName),
            )
            .map((entry) => path.join(directory, entry.name))
        : [];
    for (const candidate of compatible) {
      const fallback = await readPatchAsset(canonicalRoot, candidate);
      if (fallback) {
        sources.set(path.resolve(fallback.path), fallback.source);
        rememberExplicitAsset(assetUrlPath, fallback.path);
      }
    }
  }

  if (options.scanAllAssets) {
    for (const candidate of await allPatchAssetPaths(canonicalRoot)) {
      const asset = await readPatchAsset(canonicalRoot, candidate);
      if (asset && !sources.has(path.resolve(asset.path)))
        sources.set(path.resolve(asset.path), asset.source);
    }
  }

  const idsByPath = new Map<string, string[]>();
  const results: ClientPatchResult[] = [];
  for (const patch of patches) {
    const satisfiedReason = options.rendererVersion
      ? patch.satisfiedVersions?.[options.rendererVersion]
      : undefined;
    if (satisfiedReason) {
      results.push({
        id: patch.id,
        status: "satisfied",
        satisfiedReason,
        variants: [],
      });
      continue;
    }
    const variants = effectiveVariants(patch);
    const variantResults = variants.map((variant) => {
      const explicitPaths = variant.assetUrlPath
        ? explicitAssetPaths.get(variant.assetUrlPath)
        : undefined;
      let candidates =
        variant.assetUrlPath && variant.scopeToAsset
          ? [...(explicitPaths ?? [])].flatMap((assetPath) => {
              const source = sources.get(assetPath);
              return source === undefined ? [] : [[assetPath, source] as const];
            })
          : [...sources.entries()];
      const matchedAssets: string[] = [];
      let occurrences = 0;
      const inspect = () => {
        for (const [assetPath, source] of candidates) {
          const count = countOccurrences(source, variant.find);
          occurrences += count;
          if (count > 0) matchedAssets.push(assetPath);
        }
      };
      inspect();
      if (
        options.scanAllAssets &&
        variant.scopeToAsset &&
        variants.length === 1 &&
        occurrences === 0
      ) {
        // A deep migration scan may discover that an otherwise unchanged
        // semantic anchor moved to another lazy chunk. Normal runtime never
        // broadens a scoped rule this way.
        candidates = [...sources.entries()];
        inspect();
      }
      return {
        variant,
        result: {
          label: variant.label,
          assetUrlPath: variant.assetUrlPath,
          expectedMatches: variant.expectedMatches ?? 1,
          occurrences,
          matchedAssets: matchedAssets
            .map((assetPath) =>
              path.relative(canonicalRoot, assetPath).replaceAll("\\", "/"),
            )
            .sort(),
          assetAvailable:
            !variant.assetUrlPath ||
            Boolean(explicitPaths?.size) ||
            matchedAssets.length > 0,
        } satisfies ClientPatchVariantResult,
        matchedAssets,
      };
    });
    const compatible = variantResults.filter(
      ({ result }) =>
        result.occurrences === result.expectedMatches &&
        result.matchedAssets.length > 0,
    );
    let status: ClientPatchStatus;
    if (compatible.length === 1) status = "applied";
    else if (compatible.length > 1) status = "ambiguous";
    else if (
      variantResults.every(
        ({ result }) => result.assetUrlPath && !result.assetAvailable,
      )
    )
      status = "asset-unavailable";
    else if (variantResults.some(({ result }) => result.occurrences > 0))
      status = "ambiguous";
    else status = "missing";

    const selected = compatible.length === 1 ? compatible[0] : undefined;
    results.push({
      id: patch.id,
      status,
      selectedVariant: selected?.result.label,
      variants: variantResults.map(({ result }) => result),
    });
    if (!selected) continue;
    for (const matchedPath of selected.matchedAssets) {
      const source = sources.get(matchedPath)!;
      sources.set(
        matchedPath,
        applyReplacement(
          source,
          selected.variant.find,
          selected.variant.replace,
        ),
      );
      idsByPath.set(matchedPath, [
        ...(idsByPath.get(matchedPath) ?? []),
        patch.id,
      ]);
    }
  }

  const assets = new Map(
    [...idsByPath].map(([assetPath, ids]) => [
      assetPath,
      { source: sources.get(assetPath)!, ids },
    ]),
  );
  const report: ClientPatchReport = {
    mode,
    total: results.length,
    applied: results.filter((result) => result.status === "applied").length,
    satisfied: results.filter((result) => result.status === "satisfied").length,
    unresolved: results.filter(
      (result) => result.status !== "applied" && result.status !== "satisfied",
    ).length,
    results,
  };
  options.onReport?.(report);
  if (mode === "strict" && report.unresolved > 0) {
    const failures = results
      .filter(
        (result) =>
          result.status !== "applied" && result.status !== "satisfied",
      )
      .map((result) => {
        const observed = result.variants
          .map(
            (variant) =>
              `${variant.label}=${variant.occurrences}/${variant.expectedMatches}${variant.assetAvailable ? "" : " asset-unavailable"}`,
          )
          .join(", ");
        return `${result.id} (${result.status}; ${observed})`;
      });
    throw new Error(
      `Client patch compatibility failed (${report.unresolved}/${report.total} unresolved):\n${failures.join("\n")}`,
    );
  }
  return { assets, report };
}

export async function patchedClientAssets(
  root: string,
  indexHtml: string,
  patches: readonly ClientPatch[],
  rendererVersion?: string,
): Promise<Map<string, { source: string; ids: string[] }>> {
  return (
    await applyClientPatchSet(root, indexHtml, patches, { rendererVersion })
  ).assets;
}
