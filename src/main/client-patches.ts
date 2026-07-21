// The retained-client patch table and matcher. Patches are exact
// find/replace edits applied to the served UI snapshot in memory; the
// matcher throws unless every patch matches its declared exact count, so a renderer
// snapshot upgrade fails loudly instead of silently shipping unpatched
// surfaces. Electron-free so tests can audit the table against the staged
// snapshot (see tests/client-patches.test.ts).
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

export interface ClientPatch {
  id: string;
  find: string | RegExp;
  replace: string;
  assetUrlPath?: string;
  expectedMatches?: number;
  scopeToAsset?: boolean;
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
  },
  {
    id: "restore-web-chat-routes",
    find: "t=t=>fZ({getParentRoute:()=>yns,path:t,beforeLoad:e})",
    replace:
      't=t=>fZ({getParentRoute:()=>yns,path:t,...("new"===t?{component:$rn}:"chat/$uuid"===t?{component:Lcs}:{beforeLoad:e})})',
  },
  {
    id: "keep-chat-new-on-native-chat-landing",
    find: 'n=_O?fZ({getParentRoute:()=>yns,path:"chat/new",component:fXt}):null',
    replace:
      'n=_O?fZ({getParentRoute:()=>yns,path:"chat/new",component:$rn}):null',
  },
  {
    id: "keep-new-route-in-web-chat",
    find: "}(l);e.useEffect(()=>{u&&!l&&d.replace(u)},[u,l,d]);",
    replace: "}(true);e.useEffect(()=>{u&&!l&&d.replace(u)},[u,l,d]);",
  },
  {
    id: "bind-native-greeting-to-local-account",
    find: "function Rrn({incognito:e=!1}){const t=CZ(),{data:n}=jT(),s=Lf(()=>new Date,null);",
    replace:
      "function Rrn({incognito:e=!1}){const t=CZ(),{data:n}=jT(),{account:a}=J(),s=Lf(()=>new Date,null);",
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
  },
  {
    id: "import-native-settings-modal-router-for-extensions",
    assetUrlPath: "/assets/v1/c71860c77-MIJzCkn9.js",
    // The Extensions chunk used the page router even while mounted inside
    // the Settings dialog. Import the dialog-aware route bridge already used
    // by the rest of the retained Settings UI.
    find: "cX as m,w as f,q as u,cm as h",
    replace: "cX as m,w as f,dO as localSettingsStore,q as u,cm as h",
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
  },
  {
    id: "honor-settings-subpath-in-native-modal",
    assetUrlPath: "/assets/v1/cc011544b-DNANE8Bs.js",
    find: "const o=m(),{groups:l}=V({forModal:!0}),c=L(e=>e.section),d=a?s:c,f=e.useMemo(()=>l.flatMap(e=>e.sections).find(e=>e.id===s),[l,s]),h=s?te[s]:void 0,x=null!==s&&b(s)&&void 0!==h,",
    replace:
      "const o=m(),{groups:l}=V({forModal:!0}),c=L(e=>e.section),subpath=L(e=>e.subpath),d=a?s:c,f=e.useMemo(()=>l.flatMap(e=>e.sections).find(e=>e.id===s),[l,s]),h=s?te[subpath?`${s}/${subpath}`:s]??te[s]:void 0,x=null!==s&&b(s)&&void 0!==h,",
  },
  {
    id: "route-extension-subpage-backs-inside-native-modal",
    assetUrlPath: "/assets/v1/cf4f70727-CwoxIRQl.js",
    find: 'f=async()=>{const e=!d;c(e);try{await(z?.setIsDxtAutoUpdatesEnabled?.(e))}catch(s){i(t.formatMessage({defaultMessage:"Failed to save auto-update setting",id:"01AM3gDtkx",description:"Error message when saving auto-update setting fails"}),{error:s,messageForLogging:"Failed to save auto-update setting"}),c(!e)}},p=e=>{n.push(`/settings/desktop/extensions/${e}`)},j=()=>{n.push("/settings/desktop/extensions")};',
    replace:
      'f=async()=>{const e=!d;c(e);try{await(z?.setIsDxtAutoUpdatesEnabled?.(e))}catch(s){i(t.formatMessage({defaultMessage:"Failed to save auto-update setting",id:"01AM3gDtkx",description:"Error message when saving auto-update setting fails"}),{error:s,messageForLogging:"Failed to save auto-update setting"}),c(!e)}},p=e=>{Z.getState().open("desktop/extensions",e)},j=()=>{Z.getState().open("desktop/extensions")};',
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
  },
  {
    id: "preserve-native-directory-section-selection",
    assetUrlPath: "/assets/v1/index-XoaBlZfC.js",
    // The compiled store normalized Skills and Connectors to Plugins before
    // the unified directory could render them, which made every Browse/Add
    // action look like the Plugins catalog even though all tabs were visible.
    find: 'function m6(e){return"skills"===e||"connectors"===e?"plugins":e}',
    replace: "function m6(e){return e}",
  },
  {
    id: "render-native-unified-directory-navigation",
    assetUrlPath: "/assets/v1/index-XoaBlZfC.js",
    find: 'children:[g,nBn,t.jsx(sUn,{icon:t.jsx(c7,{size:16}),isActive:"plugins"===C,onClick:()=>X("plugins"),className:"max-sm:gap-2 max-sm:px-3",children:t.jsx(vZ,{defaultMessage:"Plugins",id:"QJAllUAc2k"})})]',
    replace:
      'children:[t.jsx(sUn,{icon:t.jsx(f7,{size:16}),isActive:"skills"===C,onClick:()=>X("skills"),className:"max-sm:gap-2 max-sm:px-3",children:t.jsx(vZ,{defaultMessage:"Skills",id:"EJSVsOA19u"})}),t.jsx(sUn,{icon:t.jsx(e7,{size:16}),isActive:"connectors"===C,onClick:()=>X("connectors"),className:"max-sm:gap-2 max-sm:px-3",children:t.jsx(vZ,{defaultMessage:"Connectors",id:"2mMJRvsAg1"})}),t.jsx(sUn,{icon:t.jsx(c7,{size:16}),isActive:"plugins"===C,onClick:()=>X("plugins"),className:"max-sm:gap-2 max-sm:px-3",children:t.jsx(vZ,{defaultMessage:"Plugins",id:"QJAllUAc2k"})})]',
  },
  {
    id: "render-native-unified-directory-results",
    assetUrlPath: "/assets/v1/index-XoaBlZfC.js",
    find: '!ce&&!le&&"skills"===C&&g,!ce&&!le&&"connectors"===C&&nBn,!ce&&!le&&"plugins"===C&&t.jsx(EHn,{',
    replace:
      '!ce&&!le&&"skills"===C&&t.jsx(WHn,{query:V,skillsSectionAvailable:g,onOpenSkill:ae,onOpenPlugin:re}),!ce&&!le&&"connectors"===C&&t.jsx(GHn,{query:V,onOpenConnector:se}),!ce&&!le&&"plugins"===C&&t.jsx(EHn,{',
  },
  {
    id: "enable-native-skills-directory-data",
    assetUrlPath: "/assets/v1/index-XoaBlZfC.js",
    // The native Skills query is present but gated by cloud account flags.
    // LocalBackend implements the same list-skills response contract.
    find: 'o=i?"?include_wiggle_skills=true":"",l=i||a,c=pt("claudeai_skill_content_scan")',
    replace:
      'o=i?"?include_wiggle_skills=true":"",l=!0,c=pt("claudeai_skill_content_scan")',
  },
  {
    id: "ignore-cloud-skills-directory-kill-switch",
    assetUrlPath: "/assets/v1/index-XoaBlZfC.js",
    // The cloud disabled-product map can suppress the query even after the
    // local Skills section is enabled. It does not apply to the local source.
    find: "enabled:!!s&&l&&e&&!r.claudeai_skills_list,staleTime:",
    replace: "custom3pCompatible:!0,enabled:!!s&&l&&e,staleTime:",
  },
  {
    id: "enable-native-connectors-directory-data",
    assetUrlPath: "/assets/v1/c2ee0272b-DPDuX889.js",
    // The retained native hook is compiled off in this snapshot. Its fallback
    // query below is backed by the bundled, one-time official MCP snapshot.
    find: "const iBe=!1,cBe=ie(te()),lBe=[];",
    replace: "const iBe=!0,cBe=ie(te()),lBe=[];",
  },
  {
    id: "use-local-native-connectors-directory-data",
    assetUrlPath: "/assets/v1/c2ee0272b-DPDuX889.js",
    // Never poll Anthropic's directory from the app. The native query uses
    // the local backend's compatible snapshot endpoint instead.
    find: "const a=new URL(`${Qze()}/mcp-registry/v0/servers`);",
    replace: 'const a=new URL("/mcp-registry/v0/servers",location.origin);',
  },
  {
    id: "prefer-local-native-connectors-directory-data",
    assetUrlPath: "/assets/v1/c2ee0272b-DPDuX889.js",
    find: "d=!0===e?.pinToBffRegardlessOfGate||u",
    replace: "d=!1",
  },
  {
    id: "wire-native-skills-directory-action",
    assetUrlPath: "/assets/v1/c5e558aae-BFRrCNDr.js",
    // The retained Skills panel creates the native Directory callback but
    // drops its return value, so there is no way to invoke it from Settings.
    find: 'const M=w(e=>e.open);e.useCallback(()=>{M("skills",{source:"customize_skills_panel"})},[M]);const y=R(),',
    replace:
      'const M=w(e=>e.open),openSkillsDirectory=e.useCallback(()=>{M("skills",{source:"customize_skills_panel"})},[M]);const y=R(),',
  },
  {
    id: "show-native-skills-directory-action",
    assetUrlPath: "/assets/v1/c5e558aae-BFRrCNDr.js",
    find: "actions:m?s.jsx(re,{handleRef:b}):null,children:",
    replace:
      'actions:s.jsxs("div",{className:"flex items-center gap-2",children:[s.jsx(te,{variant:"secondary",onClick:openSkillsDirectory,children:s.jsx(C,{defaultMessage:"Browse",id:"localBrowseSkills"})}),m?s.jsx(re,{handleRef:b}):null]}),children:',
  },
  {
    id: "show-native-connectors-empty-state-actions",
    assetUrlPath: "/assets/v1/c63a78ed4-C202DsUQ.js",
    // Local mode owns its connector configuration, so the native empty page
    // must not hide its controls behind cloud organization permissions.
    find: 'd=(t||a)&&n;return s.jsx("div",{className:"flex h-full w-full items-center justify-center"',
    replace:
      'd=!0;return s.jsx("div",{className:"flex h-full w-full items-center justify-center"',
  },
  {
    id: "show-native-connectors-directory-action",
    assetUrlPath: "/assets/v1/c63a78ed4-C202DsUQ.js",
    find: 'children:[i&&s.jsx(p,{variant:"primary",onClick:e,children:s.jsx(Le,{defaultMessage:"Browse connectors",id:"8Q+Q5LuGum"})}),c&&s.jsx(Us,',
    replace:
      'children:[s.jsx(p,{variant:"primary",onClick:e,children:s.jsx(Le,{defaultMessage:"Browse connectors",id:"8Q+Q5LuGum"})}),c&&s.jsx(Us,',
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
  },
  {
    id: "show-native-modal-connectors-directory-in-header",
    assetUrlPath: "/assets/v1/c40525e86-D3fCSCrC.js",
    // The Settings-modal Connectors implementation has its own feature flag
    // and Add menu separate from the full-page component above.
    find: 'p=de(),f=c,C=(d||m)&&l&&u,[v,y]=s.useState(!1),N=i.get("connectorName")',
    replace:
      'p=de(),f=!0,C=(d||m)&&l&&u,[v,y]=s.useState(!1),N=i.get("connectorName")',
  },
  {
    id: "dispatch-local-chat-after-navigation",
    find: "P=j&&void 0!==r&&void 0!==p?.uuid&&!w&&!t.skipNavigation&&!b&&!(!1===d?.settings?.has_finished_claudeai_onboarding)",
    replace: "P=!1",
  },
  {
    id: "disable-service-workers-on-app-protocol",
    find: '_yn="undefined"!=typeof navigator&&"serviceWorker"in navigator',
    replace: "_yn=!1",
  },
  {
    id: "enable-local-chat-tree-fetch",
    find: "enabled:!!a&&!!e&&r&&!l,forceExplicitCache:!0,meta:",
    replace:
      "enabled:!!a&&!!e&&r&&!l,custom3pCompatible:!0,forceExplicitCache:!0,meta:",
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
  },
  {
    id: "use-local-artifact-screenshot-capture",
    // The cloud renderer answers GetScreenshot from inside the sandbox; the
    // local renderer cannot rasterize itself, so capture the artifact iframe
    // through the Electron compositor instead.
    find: 'if(!ue)return void t("aborted","screenshot_no_communicator");const n=Symbol("timeout");',
    replace:
      'if(window.localClaude?.captureArtifactScreenshot){try{const e=await window.localClaude.captureArtifactScreenshot(window.__localArtifactPublishSource||{});if(e)return t("success"),e}catch{}}if(!ue)return void t("aborted","screenshot_no_communicator");const n=Symbol("timeout");',
  },
  {
    id: "stash-artifact-content-for-screenshot",
    // Records the displayed artifact's content/type for the offscreen
    // publish-screenshot capture (fe cannot reach these directly because its
    // local `n` shadows the component's content variable).
    find: "e.useEffect(()=>{N&&n&&a&&(d?.(),Object.values(Zs).includes(a),ue?.(kr.SetContent,",
    replace:
      "e.useEffect(()=>{N&&n&&a&&(window.__localArtifactPublishSource={content:n,type:a},d?.(),Object.values(Zs).includes(a),ue?.(kr.SetContent,",
  },
  {
    id: "remove-local-publish-embed-settings",
    assetUrlPath: "/assets/v1/cf774f0c4-BGDGm7sd.js",
    find: ",e.jsx(X,{isPublished:b,isEmbedSettingsOpen:g,onOpen:()=>{N(!0)}})",
    replace: ",null",
  },
  {
    id: "use-skill-icon-for-local-skill-tool",
    // The local chat skill tool renders with the generic wrench because the
    // retained icon predicates don't know its name; route it to the native
    // skill scroll icon.
    find: 'if(yg(e)||Jf(e))return t.jsx(f7,{size:n,className:"text-text-500"})',
    replace:
      'if(yg(e)||Jf(e)||"skill"===e)return t.jsx(f7,{size:n,className:"text-text-500"})',
  },
  {
    id: "label-code-skill-row-loaded",
    assetUrlPath: "/assets/v1/c06173196-DmnMdctC.js",
    // The Code chain renders Skill calls as "Ran skill" and reads the input
    // field "skill", but the local Skill tool's argument is "name". Show
    // "Loaded {skill-name} skill" instead (the " skill" suffix and the link
    // are rendered by label-code-skill-row-link below).
    find: 'case"Skill":{const t=a("skill");return{verb:e.formatMessage({defaultMessage:"Ran skill",id:"sSRWkTrDlY"}),runningVerb:e.formatMessage({defaultMessage:"Running skill",id:"kNX7UtF75g"}),meta:t?`/${t}`:void 0,metaIsCode:!0,failedVerb:e.formatMessage({defaultMessage:"Failed to run skill",id:"f7JoMbaMVQ"}),kind:o}}',
    replace:
      'case"Skill":{const t=a("skill")??a("name");return{verb:"Loaded",runningVerb:"Loading",meta:"string"==typeof t&&t?t:void 0,failedVerb:"Failed to load skill",kind:o}}',
  },
  {
    id: "disable-code-skill-row-expansion",
    assetUrlPath: "/assets/v1/c06173196-DmnMdctC.js",
    // Skill rows show only the "Loaded {skill-name} skill" line; there is no
    // expandable result body for them.
    find: 'O=!("todos"===l.kind&&0===VK(t.input).length||"agent_status"===l.kind&&0===r$(t.input).length||"peerMessage"===l.kind&&!L&&void 0===mK(t.input)&&xK(t.input))',
    replace:
      'O=!("Skill"===t.name||"todos"===l.kind&&0===VK(t.input).length||"agent_status"===l.kind&&0===r$(t.input).length||"peerMessage"===l.kind&&!L&&void 0===mK(t.input)&&xK(t.input))',
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
  },
  {
    id: "keep-projects-routes",
    assetUrlPath: "/assets/v1/c1b9abf13-bG6VlbXV.js",
    // The projects layout redirects home unless a cloud access check
    // allows it; the local backend serves the projects API.
    find: 'function Qe({children:s}){const t=_();B();const n=He(),o=$e();if("redirecting"===a(!0))return null;const i=n&&(o.loading||o.spacesAvailable);return"allowed"===t||i?',
    replace:
      'function Qe({children:s}){const t=_();B();const n=He(),o=$e();if("redirecting"===a(!0))return null;const i=n&&(o.loading||o.spacesAvailable);return!0?',
  },
  {
    id: "show-projects-nav-entry",
    // Projects are cloud-gated in the retained build; the local backend now
    // serves the projects API.
    find: 'priority:lqn}),d.isAvailable&&a&&e.push({id:"projects",href:"/projects"',
    replace: 'priority:lqn}),e.push({id:"projects",href:"/projects"',
  },
  {
    id: "unblock-projects-list-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // The shared query wrapper force-disables queries not marked
    // custom3pCompatible; the projects queries hit the local backend.
    find: "YT(`/api/organizations/${p}/projects_v2?${g.toString()}`,{queryKey:[ZM,{orgUuid:p},{limit:t,offset:r,starred:o,creatorFilter:a,projectFilter:s,orderBy:i,searchQuery:c,isArchived:l}],enabled:Boolean(e&&u&&d),select:h})",
    replace:
      "YT(`/api/organizations/${p}/projects_v2?${g.toString()}`,{queryKey:[ZM,{orgUuid:p},{limit:t,offset:r,starred:o,creatorFilter:a,projectFilter:s,orderBy:i,searchQuery:c,isArchived:l}],custom3pCompatible:!0,enabled:Boolean(e),select:h})",
  },
  {
    id: "unblock-project-detail-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    find: "YT(`/api/organizations/${r}/projects/${e}`,{queryKey:[WM,{orgUuid:r,projectUuid:e}],enabled:Boolean(t&&n&&e),staleTime:0,",
    replace:
      "YT(`/api/organizations/${r}/projects/${e}`,{queryKey:[WM,{orgUuid:r,projectUuid:e}],custom3pCompatible:!0,enabled:Boolean(t&&e),staleTime:0,",
  },
  {
    id: "unblock-project-docs-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    find: "YT(`/api/organizations/${r}/projects/${e}/docs`,{queryKey:[nA,{orgUuid:r,projectUuid:e}],enabled:!!n&&!!e&&t})",
    replace:
      "YT(`/api/organizations/${r}/projects/${e}/docs`,{queryKey:[nA,{orgUuid:r,projectUuid:e}],custom3pCompatible:!0,enabled:!!e&&t})",
  },
  {
    id: "unblock-project-count-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    find: "YT(`/api/organizations/${t}/projects/count`,{queryKey:[GM,{orgUuid:t}],staleTime:3e5,enabled:!!e,",
    replace:
      "YT(`/api/organizations/${t}/projects/count`,{queryKey:[GM,{orgUuid:t}],custom3pCompatible:!0,staleTime:3e5,enabled:!0,",
  },
  {
    id: "enable-memory-feature-gate",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // Memory ("saffron") is feature-gated off in the retained build; the
    // local backend implements the full /memory API.
    find: 'O3=()=>tv("claudeai_saffron_enabled")',
    replace: "O3=()=>!0",
  },
  {
    id: "enable-memory-feature-registration",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // The feature-registry entry keeps its own client-side gate; open it so
    // the Settings surface shows the native memory controls.
    find: 'saffron:uD({feature:"saffron",useClientSideGate:()=>tv("claudeai_saffron_enabled")',
    replace: 'saffron:uD({feature:"saffron",useClientSideGate:()=>!0',
  },
  {
    id: "keep-customize-connectors-route",
    assetUrlPath: "/assets/v1/c63a78ed4-C202DsUQ.js",
    // The Connectors page redirects to /customize when its cloud gate is
    // off; the local MCP client backs the connectors surface.
    find: 'path:"connectors",component:function(){return b()||S("/customize"),s.jsx(Tl,{})}}',
    replace: 'path:"connectors",component:function(){return s.jsx(Tl,{})}}',
  },
  {
    id: "keep-customize-memory-route",
    assetUrlPath: "/assets/v1/c63a78ed4-C202DsUQ.js",
    // The Customize > Memory route redirects to /settings/capabilities when
    // its statsig gates are off; the local backend serves the memory API.
    find: '{isPending:n}=E({forModal:!0}),i=A(),c=O(),o=!(i||c||n||t&&a);return e.useEffect(()=>{o&&l.replace("/settings/capabilities")},[o,l]),o?null:s.jsx(rl,{})',
    replace:
      '{isPending:n}=E({forModal:!0}),i=A(),c=O(),o=!1;return e.useEffect(()=>{o&&l.replace("/settings/capabilities")},[o,l]),o?null:s.jsx(rl,{})',
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
  },
  {
    id: "force-memory-summary-query",
    assetUrlPath: "/assets/v1/c06a0b3df-DP2HU9yQ.js",
    // The Summary panel's memory fetch chains through cloud availability
    // hooks; the local /memory endpoint is always available.
    find: "J=s.memo(()=>{const a=T(),t=n(),{isAvailable:l}=v(),{data:i,isLoading:r}=M(void 0,{enabled:l}),",
    replace:
      "J=s.memo(()=>{const a=T(),t=n(),{isAvailable:l}=v(),{data:i,isLoading:r}=M(void 0,{enabled:!0}),",
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
  },
  {
    id: "enable-memory-edit-resynthesize",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // Without this gate, saving a memory edit stores the controls but never
    // regenerates the summary, so edits look like they did nothing.
    find: 'h=iv("claudeai_saffron_frontend","edit_resynthesize_enabled",!1,hv)',
    replace: "h=!0",
  },
  {
    id: "unblock-memory-settings-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // Same custom3p kill-switch for the memory settings query backing the
    // native Settings toggles.
    find: "{queryKey:v3(n),enabled:e&&!!n,staleTime:6e4,meta:{noToast:!0}}",
    replace:
      "{queryKey:v3(n),custom3pCompatible:!0,enabled:e&&!!n,staleTime:6e4,meta:{noToast:!0}}",
  },
  {
    id: "show-customize-memory-nav-entry",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    find: 'a&&s&&n.push({id:"customize-memory",href:"/customize/memory"',
    replace: 'n.push({id:"customize-memory",href:"/customize/memory"',
  },
  {
    id: "enable-incognito-feature-gate",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // The incognito ("saffron ghost") feature flag is off in the retained
    // build; the local backend implements temporary conversations.
    find: 'V3=()=>tv("claudeai_saffron_ghost_enabled")',
    replace: "V3=()=>!0",
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
  },
  {
    id: "enable-chat-artifacts-gallery-route",
    assetUrlPath: "/assets/v1/c1b9abf13-bG6VlbXV.js",
    // The /artifacts chat-surface gallery route is feature-gated off in the
    // retained desktop build; the local gallery data sources are implemented,
    // so open the gate.
    find: "function ps({children:s}){const t=v(),n=oe(),",
    replace: "function ps({children:s}){const t=!0,n=oe(),",
  },
  {
    id: "enable-native-chat-artifacts-tab",
    // The desktop build hardcodes the chat sidebar's Artifacts tab off. The
    // local gallery data sources are implemented, so surface the native tab
    // (correct icon, chat-surface /artifacts route) instead of injecting one.
    find: "hasArtifactsGallery:false",
    replace: "hasArtifactsGallery:true",
  },
  {
    id: "derive-local-chat-attachments",
    find: "wiggleEnabled:pn,targetStore:void 0,isLocalAgentMode:W||G",
    replace: 'wiggleEnabled:pn,targetStore:"org",isLocalAgentMode:W||G',
  },
  {
    id: "enable-local-claude-code-surface",
    find: 'claude_code_web:uD({feature:"claude_code_web",useClientSideGate:()=>(tv("bad_moon_rising"),!1)})',
    replace:
      'claude_code_web:uD({feature:"claude_code_web",useClientSideGate:()=>!0})',
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
  },
  {
    id: "host-local-code-browser-native-view",
    assetUrlPath: "/assets/v1/c06173196-DmnMdctC.js",
    // The retained fallback path polls screenshots when its cloud-computed
    // native-view capability bit is false. Electron on the local Windows app
    // does host WebContentsView, so attach it to the measured browser pane.
    find: "if(!(t&&H&&e&&!x&&!q&&!B))return void(t&&xt?.hidePreview?.(t,U));",
    replace: "if(!(t&&H&&e&&!q&&!B))return void(t&&xt?.hidePreview?.(t,U));",
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
  },
  {
    id: "enable-native-local-code-artifacts",
    assetUrlPath: "/assets/v1/ca82bcec9-BHaPdnp0.js",
    find: "function gn(){const e=zt(),{data:t}=B(),a=void 0===t;return e||a?",
    replace: "function gn(){const e=!0,{data:t}=B(),a=void 0===t;return e||a?",
  },
  {
    id: "enable-local-artifact-gallery-data",
    assetUrlPath: "/assets/v1/c47ad434c-D_dYPjVp.js",
    find: 'function se(){const e=Boolean(""),{isAvailable:t}=i("cobalt_plinth");return!d(()=>!1,!1)&&(e||t)}',
    replace: "function se(){return!0}",
  },
  {
    id: "bind-native-artifact-gallery-to-local-desktop-store",
    assetUrlPath: "/assets/v1/c47ad434c-D_dYPjVp.js",
    find: "function oe(e=!1,t){const r=!0===t?.starredOnly,a=!1!==t?.enabled,{activeOrganization:s}=u(),o=U(),n=s?.uuid,i=c(),d=se(),m=l(",
    replace:
      'function oe(e=!1,t){const r=c(),[a,s]=p.useState({artifacts:[],isPending:!0,isError:!1});return p.useEffect(()=>{let e=!1;const t=window["claude.web"]?.LocalSessions?.getAllArtifacts?.();return Promise.resolve(t).then(t=>{e||s({artifacts:Array.isArray(t)?t:[],isPending:!1,isError:!1})}).catch(()=>{e||s({artifacts:[],isPending:!1,isError:!0})}),()=>{e=!0}},[]),{enabled:!0,includeShared:!1,items:a.artifacts.map(e=>({key:`frame:${e.sessionId}:${e.id}`,source:"frame",rel:"mine",title:e.title??"Artifact",description:e.sessionTitle,extraSearchText:[e.sessionTitle,e.path].filter(e=>"string"==typeof e),href:"chat"===e.sourceSurface?`/chat/${encodeURIComponent(e.sessionId)}?artifactId=${encodeURIComponent(e.id)}`:`/epitaxy/${encodeURIComponent(e.sessionId)}?open_local_artifact=${encodeURIComponent(e.id)}`,newTab:!1,updatedAtMs:e.updatedAt?Date.parse(e.updatedAt):void 0,createdAtMs:e.updatedAt?Date.parse(e.updatedAt):void 0,audience:"owner",softDeleted:!1,starred:!1})),isPending:a.isPending,isError:a.isError,capped:!1,isPartial:!1,isPartialError:!1,starsEnabled:!1}}function oeCloudUnused(e=!1,t){const r=!0===t?.starredOnly,a=!1!==t?.enabled,{activeOrganization:s}=u(),o=U(),n=s?.uuid,i=c(),d=se(),m=l(',
  },
  {
    id: "use-local-code-artifact-gallery-source",
    assetUrlPath: "/assets/v1/ce569194f-YKjvV2xt.js",
    // Also force the gallery-enabled gate (e) on: the desktop build ships
    // the /artifacts chat-surface page feature-gated off.
    find: 'function Ke(){const e=z(),s=n(),r=We("chat",{relTabs:!0});',
    replace: 'function Ke(){const e=!0||z(),s=n(),r=We("frame",{relTabs:!0});',
  },
  {
    id: "expose-local-code-artifact-pane-opener",
    assetUrlPath: "/assets/v1/c06173196-DmnMdctC.js",
    find: "c=e.useState(()=>o??$o())[0],u=e.useState(()=>!o)[0];return e.useEffect(()=>Uo(l,d),[l,d]),",
    replace:
      'c=e.useState(()=>o??$o())[0],u=e.useState(()=>!o)[0];return e.useEffect(()=>Uo(l,d),[l,d]),e.useEffect(()=>{const e=e=>{const t=l.getState();t.setPendingArtifactOpenUrl(e),t.setSidePane("artifact")},t=()=>{const t=document.documentElement.dataset.openClaudeCodeArtifact;t&&(delete document.documentElement.dataset.openClaudeCodeArtifact,e(t))};return window.__openLocalCodeArtifact=e,window.addEventListener("open-claude-code-artifact",t),t(),()=>{window.removeEventListener("open-claude-code-artifact",t),window.__openLocalCodeArtifact===e&&delete window.__openLocalCodeArtifact}},[l]),',
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
  },
  {
    id: "use-random-local-code-activity-label",
    assetUrlPath: "/assets/v1/c5610fbe3-QnNBykKf.js",
    find: 'w.formatMessage({defaultMessage:"Reconnecting\\u2026",id:"Yyp8xwgnUo"})',
    replace:
      '(document.documentElement.dataset.openClaudeActivityWord??"Working")+"\\u2026"',
  },
  {
    id: "remove-cloud-model-switch-setting",
    assetUrlPath: "/assets/v1/c71860c77-QKSs-TTD.js",
    find: 'qe=["enabled_model_auto_fallback","enabled_web_search","tool_search_mode"],ze=e.memo(()=>{',
    replace:
      'qe=["enabled_model_auto_fallback","enabled_web_search","tool_search_mode"],ze=e.memo(()=>null),zeCloudUnused=e.memo(()=>{',
  },
  {
    id: "remove-local-model-switch-setting",
    assetUrlPath: "/assets/v1/c71860c77-QKSs-TTD.js",
    find: "We=e.memo(()=>{const a=n(),{resolved:t,patch:l,isPatchAvailable:o}=Te(),",
    replace:
      "We=e.memo(()=>null),WeCloudUnused=e.memo(()=>{const a=n(),{resolved:t,patch:l,isPatchAvailable:o}=Te(),",
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
  },
  {
    id: "enable-local-mcp-connectors-feature",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // The whole Connectors surface hangs off the papi_mcp statsig gate,
    // which the empty local statsig payload leaves false — hence the
    // "add connector" bounce to the skills page.
    find: 'const MBe=()=>tv("papi_mcp"),ABe=()=>!tv("papi_disable_mcp_ui")',
    replace: 'const MBe=()=>!0,ABe=()=>!tv("papi_disable_mcp_ui")',
  },
  {
    id: "enable-local-mcp-connectors-list-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    find: "return YT(`/api/organizations/${e}/mcp/remote_servers`,{queryKey:[fI,e],enabled:!r&&n&&!!e,",
    replace:
      "return YT(`/api/organizations/${e}/mcp/remote_servers`,{custom3pCompatible:!0,queryKey:[fI,e],enabled:!r&&n&&!!e,",
  },
  {
    id: "enable-local-mcp-connectors-connection-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    find: 'return YT(`/api/organizations/${e}/mcp/remote_servers_with_connection`,{queryKey:[fI,e,"with-connection"],',
    replace:
      'return YT(`/api/organizations/${e}/mcp/remote_servers_with_connection`,{custom3pCompatible:!0,queryKey:[fI,e,"with-connection"],',
  },
  {
    id: "enable-local-mcp-connector-item-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    find: "return YT(`/api/organizations/${e}/mcp/remote_servers/${t}`,{queryKey:[mI,e,t],",
    replace:
      "return YT(`/api/organizations/${e}/mcp/remote_servers/${t}`,{custom3pCompatible:!0,queryKey:[mI,e,t],",
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

export async function patchedClientAssets(
  root: string,
  indexHtml: string,
  patches: readonly ClientPatch[],
): Promise<Map<string, { source: string; ids: string[] }>> {
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
  for (const assetUrlPath of new Set(
    patches.map((patch) => patch.assetUrlPath).filter(Boolean) as string[],
  )) {
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
    if (compatible.length === 0)
      throw new Error(
        `Packaged UI patch asset is unavailable: ${assetUrlPath}`,
      );
    for (const candidate of compatible) {
      const fallback = await readPatchAsset(canonicalRoot, candidate);
      if (fallback) {
        sources.set(path.resolve(fallback.path), fallback.source);
        rememberExplicitAsset(assetUrlPath, fallback.path);
      }
    }
  }

  const idsByPath = new Map<string, string[]>();
  for (const patch of patches) {
    const candidates =
      patch.assetUrlPath && patch.scopeToAsset
        ? [...(explicitAssetPaths.get(patch.assetUrlPath) ?? [])].flatMap(
            (assetPath) => {
              const source = sources.get(assetPath);
              return source === undefined ? [] : [[assetPath, source] as const];
            },
          )
        : [...sources.entries()];
    const expression =
      patch.find instanceof RegExp
        ? new RegExp(
            patch.find.source,
            patch.find.flags.includes("g")
              ? patch.find.flags
              : `${patch.find.flags}g`,
          )
        : null;
    let occurrences = 0;
    const matchesByPath = new Map<string, number>();
    for (const [assetPath, source] of candidates) {
      const count = expression
        ? [...source.matchAll(new RegExp(expression.source, expression.flags))]
            .length
        : source.split(patch.find as string).length - 1;
      occurrences += count;
      if (count > 0) matchesByPath.set(assetPath, count);
    }
    const expectedMatches = patch.expectedMatches ?? 1;
    if (occurrences !== expectedMatches || matchesByPath.size === 0) {
      throw new Error(
        `Client patch ${patch.id} expected exactly ${expectedMatches} match${expectedMatches === 1 ? "" : "es"}, found ${occurrences}`,
      );
    }
    for (const matchedPath of matchesByPath.keys()) {
      const source = sources.get(matchedPath)!;
      sources.set(
        matchedPath,
        expression
          ? source.replace(
              new RegExp(expression.source, expression.flags),
              () => patch.replace,
            )
          : source.split(patch.find as string).join(patch.replace),
      );
      idsByPath.set(matchedPath, [
        ...(idsByPath.get(matchedPath) ?? []),
        patch.id,
      ]);
    }
  }

  return new Map(
    [...idsByPath].map(([assetPath, ids]) => [
      assetPath,
      { source: sources.get(assetPath)!, ids },
    ]),
  );
}
