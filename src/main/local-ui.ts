import { access, readdir, stat } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { app, dialog, net, protocol, shell } from "electron";
import { resolveInside } from "../shared/security";
import { LocalBackend } from "./local-backend";
import { LocalCodeSessionManager } from "./local-code";
import {
  DEFAULT_EXPORT_OPTIONS,
  ExportCodeSession,
  ExportConversation,
  TrainingExportOptions,
  buildTrainingExport,
  conversationMarkdown,
  safeFileName,
} from "./local-export";
import {
  bundledWhisperPaths,
  transcribeWithBundledWhisper,
} from "./local-whisper";
import { LocalArtifactTunnel } from "./local-tunnel";

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

interface ClientPatch {
  id: string;
  find: string;
  replace: string;
  assetUrlPath?: string;
}

// The packaged desktop web client defaults /new into Cowork's VM-backed task
// flow. Local mode needs the ordinary web-chat route, whose HTTP/SSE contract
// can be implemented by LocalBackend. Apply this only while serving our private
// in-memory copy; the installed Anthropic asset is never modified.
const DISABLED_PATCH_IDS = new Set(
  (process.env.CLAUDE_LOCAL_DISABLE_PATCHES ?? "").split(","),
);
const LOCAL_CLIENT_PATCHES: readonly ClientPatch[] = [
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
    find: "lts={withSidebar:[],root:[]},cts=(()=>",
    // Keying the chat route on the artifact URL parameters lets the local
    // shell remount a chat in place with a single same-path navigation when
    // the retained pane store has gone stale (see local-workbench.ts), with
    // no visible detour through another route.
    replace:
      'lts={withSidebar:[],root:[]},Lcs=()=>{const{uuid:e}=hR(),a=new URLSearchParams(location.search);return t.jsx(m2t,{uuid:e},e+"|"+(a.get("artifactId")||"")+"|"+(a.get("localReopen")||""))},cts=(()=>',
  },
  {
    id: "restore-web-chat-routes",
    find: "t=t=>q$({getParentRoute:()=>A7n,path:t,beforeLoad:e})",
    replace:
      't=t=>q$({getParentRoute:()=>A7n,path:t,...("new"===t?{component:K3t}:"chat/$uuid"===t?{component:Lcs}:{beforeLoad:e})})',
  },
  {
    id: "keep-chat-new-on-native-chat-landing",
    find: 'n=ER?q$({getParentRoute:()=>A7n,path:"chat/new",component:ABt}):null',
    replace:
      'n=ER?q$({getParentRoute:()=>A7n,path:"chat/new",component:K3t}):null',
  },
  {
    id: "keep-new-route-in-web-chat",
    find: "}(l);e.useEffect(()=>{u&&!l&&d.replace(u)},[u,l,d]);",
    replace: "}(true);e.useEffect(()=>{u&&!l&&d.replace(u)},[u,l,d]);",
  },
  {
    id: "bind-native-greeting-to-local-account",
    find: "function F3t({incognito:e=!1}){const t=G$(),{data:n}=IT(),s=uf(()=>new Date,null);",
    replace:
      "function F3t({incognito:e=!1}){const t=G$(),{data:n}=IT(),{account:a}=Y(),s=uf(()=>new Date,null);",
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
    id: "dispatch-local-chat-after-navigation",
    find: "j=N&&void 0!==r&&void 0!==p?.uuid&&!w&&!t.skipNavigation&&!b&&!(!1===d?.settings?.has_finished_claudeai_onboarding)",
    replace: "j=!1",
  },
  {
    id: "disable-service-workers-on-app-protocol",
    find: 'qdn="undefined"!=typeof navigator&&"serviceWorker"in navigator',
    replace: "qdn=!1",
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
    find: "e.useEffect(()=>{N&&n&&a&&(d?.(),Object.values(Zs).includes(a),ue?.(Ur.SetContent,",
    replace:
      "e.useEffect(()=>{N&&n&&a&&(window.__localArtifactPublishSource={content:n,type:a},d?.(),Object.values(Zs).includes(a),ue?.(Ur.SetContent,",
  },
  {
    id: "remove-local-publish-embed-settings",
    assetUrlPath: "/assets/v1/cf774f0c4-BGDGm7sd.js",
    find: ",e.jsx(X,{isPublished:b,isEmbedSettingsOpen:g,onOpen:()=>{j(!0)}})",
    replace: ",null",
  },
  {
    id: "use-skill-icon-for-local-skill-tool",
    // The local chat skill tool renders with the generic wrench because the
    // retained icon predicates don't know its name; route it to the native
    // skill scroll icon.
    find: 'if(rg(e)||Rf(e))return t.jsx($6,{size:n,className:"text-text-500"})',
    replace:
      'if(rg(e)||Rf(e)||"skill"===e)return t.jsx($6,{size:n,className:"text-text-500"})',
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
    find: 'D=!("todos"===l.kind&&0===Lq(s.input).length||"agent_status"===l.kind&&0===ZB(s.input).length||"peerMessage"===l.kind&&!_&&void 0===oq(s.input)&&cq(s.input))',
    replace:
      'D=!("Skill"===s.name||"todos"===l.kind&&0===Lq(s.input).length||"agent_status"===l.kind&&0===ZB(s.input).length||"peerMessage"===l.kind&&!_&&void 0===oq(s.input)&&cq(s.input))',
  },
  {
    id: "label-code-skill-row-link",
    assetUrlPath: "/assets/v1/c06173196-DmnMdctC.js",
    // Renders the Skill row meta as "{skill-name} skill" where the name links
    // to the Customize screen for that skill (SPA navigation; the preload
    // auto-selects the skill from the ?skill= query parameter).
    find: ':l.meta&&!se?C?t.jsx("a",{href:C,target:"_blank",rel:"noreferrer",',
    replace:
      ':l.meta&&!se?"Skill"===s.name?t.jsxs("span",{className:"text-body text-assistant-primary truncate min-w-0",children:[t.jsx("a",{href:"/customize/skills?skill="+encodeURIComponent(String(l.meta)),onClick:n=>{n.preventDefault(),n.stopPropagation();const a="/customize/skills?skill="+encodeURIComponent(String(l.meta));history.pushState({},"",a),window.dispatchEvent(new PopStateEvent("popstate"))},onKeyDown:n=>n.stopPropagation(),className:"underline underline-offset-[3px] hover:text-assistant-primary",children:String(l.meta)})," skill"]}):C?t.jsx("a",{href:C,target:"_blank",rel:"noreferrer",',
  },
  {
    id: "keep-projects-routes",
    assetUrlPath: "/assets/v1/c1b9abf13-bG6VlbXV.js",
    // The projects layout redirects home unless a cloud access check
    // allows it; the local backend serves the projects API.
    find: 'function He({children:s}){const t=_(),i=a(!0),n=Ye(),o=Xe();if("redirecting"===i)return null;const c=n&&(o.loading||o.spacesAvailable);return"allowed"===t||c?',
    replace:
      'function He({children:s}){const t=_(),i=a(!0),n=Ye(),o=Xe();if("redirecting"===i)return null;const c=n&&(o.loading||o.spacesAvailable);return!0?',
  },
  {
    id: "show-projects-nav-entry",
    // Projects are cloud-gated in the retained build; the local backend now
    // serves the projects API.
    find: 'priority:LAn}),m.isAvailable&&a&&e.push({id:"projects",href:"/projects"',
    replace: 'priority:LAn}),e.push({id:"projects",href:"/projects"',
  },
  {
    id: "unblock-projects-list-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // The shared query wrapper force-disables queries not marked
    // custom3pCompatible; the projects queries hit the local backend.
    find: "IM(`/api/organizations/${p}/projects_v2?${h.toString()}`,{queryKey:[TT,{orgUuid:p},{limit:t,offset:r,starred:o,creatorFilter:a,projectFilter:s,orderBy:i,searchQuery:c,isArchived:l}],enabled:Boolean(e&&u&&d),select:g})",
    replace:
      "IM(`/api/organizations/${p}/projects_v2?${h.toString()}`,{queryKey:[TT,{orgUuid:p},{limit:t,offset:r,starred:o,creatorFilter:a,projectFilter:s,orderBy:i,searchQuery:c,isArchived:l}],custom3pCompatible:!0,enabled:Boolean(e),select:g})",
  },
  {
    id: "unblock-project-detail-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    find: "IM(`/api/organizations/${r}/projects/${e}`,{queryKey:[xT,{orgUuid:r,projectUuid:e}],enabled:Boolean(t&&n&&e),staleTime:0,",
    replace:
      "IM(`/api/organizations/${r}/projects/${e}`,{queryKey:[xT,{orgUuid:r,projectUuid:e}],custom3pCompatible:!0,enabled:Boolean(t&&e),staleTime:0,",
  },
  {
    id: "unblock-project-docs-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    find: "IM(`/api/organizations/${r}/projects/${e}/docs`,{queryKey:[jT,{orgUuid:r,projectUuid:e}],enabled:!!n&&!!e&&t})",
    replace:
      "IM(`/api/organizations/${r}/projects/${e}/docs`,{queryKey:[jT,{orgUuid:r,projectUuid:e}],custom3pCompatible:!0,enabled:!!e&&t})",
  },
  {
    id: "unblock-project-count-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    find: "IM(`/api/organizations/${t}/projects/count`,{queryKey:[CT,{orgUuid:t}],staleTime:3e5,enabled:!!e,",
    replace:
      "IM(`/api/organizations/${t}/projects/count`,{queryKey:[CT,{orgUuid:t}],custom3pCompatible:!0,staleTime:3e5,enabled:!0,",
  },
  {
    id: "enable-memory-feature-gate",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // Memory ("saffron") is feature-gated off in the retained build; the
    // local backend implements the full /memory API.
    find: 'P2=()=>av("claudeai_saffron_enabled")',
    replace: "P2=()=>!0",
  },
  {
    id: "enable-memory-feature-registration",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // The feature-registry entry keeps its own client-side gate; open it so
    // the Settings surface shows the native memory controls.
    find: 'saffron:FL({feature:"saffron",useClientSideGate:()=>av("claudeai_saffron_enabled")',
    replace: 'saffron:FL({feature:"saffron",useClientSideGate:()=>!0',
  },
  {
    id: "keep-customize-connectors-route",
    assetUrlPath: "/assets/v1/c63a78ed4-C202DsUQ.js",
    // The Connectors page redirects to /customize when its cloud gate is
    // off; the local MCP client backs the connectors surface.
    find: 'path:"connectors",component:function(){return S()||b("/customize"),s.jsx(_l,{})}}',
    replace: 'path:"connectors",component:function(){return s.jsx(_l,{})}}',
  },
  {
    id: "keep-customize-memory-route",
    assetUrlPath: "/assets/v1/c63a78ed4-C202DsUQ.js",
    // The Customize > Memory route redirects to /settings/capabilities when
    // its statsig gates are off; the local backend serves the memory API.
    find: '{isPending:a}=E({forModal:!0}),n=O(),c=R(),o=!(n||c||a||t&&i);return e.useEffect(()=>{o&&l.replace("/settings/capabilities")},[o,l]),o?null:s.jsx(dl,{})',
    replace:
      '{isPending:a}=E({forModal:!0}),n=O(),c=R(),o=!1;return e.useEffect(()=>{o&&l.replace("/settings/capabilities")},[o,l]),o?null:s.jsx(dl,{})',
  },
  {
    id: "force-memory-page-summary-view",
    assetUrlPath: "/assets/v1/c06a0b3df-DP2HU9yQ.js",
    // The Customize > Memory page picks between the Cowork file-memory view
    // and the account "Summary" view behind statsig gates. Local mode
    // implements the summary API (/memory, /memory/controls, /synthesize),
    // so pin the page to that view.
    find: 'function le(){const a=k("claudeai_customize_memory_tab_main"),t=S(),l=z(),',
    replace: "function le(){const a=!0,t=!1,l=!0,",
  },
  {
    id: "force-memory-summary-query",
    assetUrlPath: "/assets/v1/c06a0b3df-DP2HU9yQ.js",
    // The Summary panel's memory fetch chains through cloud availability
    // hooks; the local /memory endpoint is always available.
    find: "const K=s.memo(()=>{const a=L(),t=n(),{isAvailable:l}=b(),{data:i,isLoading:r}=v(void 0,{enabled:l}),",
    replace:
      "const K=s.memo(()=>{const a=L(),t=n(),{isAvailable:l}=b(),{data:i,isLoading:r}=v(void 0,{enabled:!0}),",
  },
  {
    id: "unblock-memory-query-gates",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // The shared query wrapper force-disables queries not marked
    // custom3pCompatible, and the enabled chain requires cloud org state the
    // local build does not model. The local /memory endpoint is always safe.
    find: "enabled:Boolean(r)&&(t?.enabled??!0)&&s&&!i},e=>E2.parse(e))",
    replace:
      'custom3pCompatible:!0,refetchOnMount:"always",refetchOnWindowFocus:!0,enabled:t?.enabled??!0},e=>E2.parse(e))',
  },
  {
    id: "enable-memory-edit-resynthesize",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // Without this gate, saving a memory edit stores the controls but never
    // regenerates the summary, so edits look like they did nothing.
    find: 'I2=()=>dv("claudeai_saffron_frontend","edit_resynthesize_enabled",!1,yv)',
    replace: "I2=()=>!0",
  },
  {
    id: "unblock-memory-settings-query",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // Same custom3p kill-switch for the memory settings query backing the
    // native Settings toggles.
    find: "{queryKey:y2(n),enabled:e&&!!n,staleTime:6e4,meta:{noToast:!0}}",
    replace:
      "{queryKey:y2(n),custom3pCompatible:!0,enabled:e&&!!n,staleTime:6e4,meta:{noToast:!0}}",
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
    find: 'H2=()=>av("claudeai_saffron_ghost_enabled")',
    replace: "H2=()=>!0",
  },
  {
    id: "enable-incognito-chat-toggle",
    // The incognito (temporary chat) toggle is gated off in the retained
    // desktop build. The local backend implements temporary conversations
    // (memory-only, never persisted, never listed, never exported), so
    // surface the native toggle.
    find: 'l=Ge(),c=ot(),d=SC();return l||!i||c&&d?null:t.jsx("div",{children:t.jsx(CZ,{hoverable:!1,side:"left",shortcut:o,content:r?t.jsx(K$,{defaultMessage:"Exit incognito",id:"ItG+wlzX/s"})',
    replace:
      'l=Ge(),c=ot(),d=SC();return!1?null:t.jsx("div",{children:t.jsx(CZ,{hoverable:!1,side:"left",shortcut:o,content:r?t.jsx(K$,{defaultMessage:"Exit incognito",id:"ItG+wlzX/s"})',
  },
  {
    id: "enable-chat-artifacts-gallery-route",
    assetUrlPath: "/assets/v1/c1b9abf13-bG6VlbXV.js",
    // The /artifacts chat-surface gallery route is feature-gated off in the
    // retained desktop build; the local gallery data sources are implemented,
    // so open the gate.
    find: "function os({children:s}){const t=v(),",
    replace: "function os({children:s}){const t=!0,",
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
    find: "wiggleEnabled:dn,targetStore:void 0,isLocalAgentMode:W||G",
    replace: 'wiggleEnabled:dn,targetStore:"org",isLocalAgentMode:W||G',
  },
  {
    id: "enable-local-claude-code-surface",
    find: 'claude_code_web:FL({feature:"claude_code_web",useClientSideGate:()=>(av("bad_moon_rising"),!1)})',
    replace:
      'claude_code_web:FL({feature:"claude_code_web",useClientSideGate:()=>!0})',
  },
  {
    id: "enable-native-local-code-artifacts",
    assetUrlPath: "/assets/v1/ca82bcec9-BHaPdnp0.js",
    find: "function pn(){const e=At(),{data:t}=G(),a=void 0===t;return e||a?",
    replace: "function pn(){const e=!0,{data:t}=G(),a=void 0===t;return e||a?",
  },
  {
    id: "enable-local-artifact-gallery-data",
    assetUrlPath: "/assets/v1/c47ad434c-D_dYPjVp.js",
    find: 'function ne(){const e=Boolean(""),{isAvailable:t}=i("cobalt_plinth");return!d(()=>!1,!1)&&(e||t)}',
    replace: "function ne(){return!0}",
  },
  {
    id: "bind-native-artifact-gallery-to-local-desktop-store",
    assetUrlPath: "/assets/v1/c47ad434c-D_dYPjVp.js",
    find: "function ie(e=!1,t){const r=!0===t?.starredOnly,a=!1!==t?.enabled,{activeOrganization:s}=u(),o=F(),n=s?.uuid,i=c(),d=ne(),p=f(",
    replace:
      'function ie(e=!1,t){const r=c(),[a,s]=g.useState({artifacts:[],isPending:!0,isError:!1});return g.useEffect(()=>{let e=!1;const t=window["claude.web"]?.CoworkArtifacts?.getAllArtifacts?.();return Promise.resolve(t).then(t=>{e||s({artifacts:Array.isArray(t)?t:[],isPending:!1,isError:!1})}).catch(()=>{e||s({artifacts:[],isPending:!1,isError:!0})}),()=>{e=!0}},[]),{enabled:!0,includeShared:!1,items:a.artifacts.map(e=>({key:`frame:${e.sessionId}:${e.id}`,source:"frame",rel:"mine",title:e.title??"Artifact",description:e.sessionTitle,extraSearchText:[e.sessionTitle,e.path].filter(e=>"string"==typeof e),href:"chat"===e.sourceSurface?`/chat/${encodeURIComponent(e.sessionId)}?artifactId=${encodeURIComponent(e.id)}`:`/epitaxy/${encodeURIComponent(e.sessionId)}?open_local_artifact=${encodeURIComponent(e.id)}`,newTab:!1,updatedAtMs:e.updatedAt?Date.parse(e.updatedAt):void 0,createdAtMs:e.updatedAt?Date.parse(e.updatedAt):void 0,audience:"owner",softDeleted:!1,starred:!1})),isPending:a.isPending,isError:a.isError,capped:!1,isPartial:!1,isPartialError:!1,starsEnabled:!1}}function ieCloudUnused(e=!1,t){const r=!0===t?.starredOnly,a=!1!==t?.enabled,{activeOrganization:s}=u(),o=F(),n=s?.uuid,i=c(),d=ne(),p=f(',
  },
  {
    id: "use-local-code-artifact-gallery-source",
    assetUrlPath: "/assets/v1/ce569194f-YKjvV2xt.js",
    // Also force the gallery-enabled gate (e) on: the desktop build ships
    // the /artifacts chat-surface page feature-gated off.
    find: 'function Je(){const e=z(),s=i(),r=Ke("chat",{relTabs:!0});',
    replace: 'function Je(){const e=!0||z(),s=i(),r=Ke("frame",{relTabs:!0});',
  },
  {
    id: "expose-local-code-artifact-pane-opener",
    assetUrlPath: "/assets/v1/c06173196-DmnMdctC.js",
    find: "d=e.useState(()=>o??So())[0],u=e.useState(()=>!o)[0];return e.useEffect(()=>No(l,c),[l,c]),",
    replace:
      'd=e.useState(()=>o??So())[0],u=e.useState(()=>!o)[0];return e.useEffect(()=>No(l,c),[l,c]),e.useEffect(()=>{const e=e=>{const t=l.getState();t.setPendingArtifactOpenUrl(e),t.setSidePane("artifact")},t=()=>{const t=document.documentElement.dataset.openClaudeCodeArtifact;t&&(delete document.documentElement.dataset.openClaudeCodeArtifact,e(t))};return window.__openLocalCodeArtifact=e,window.addEventListener("open-claude-code-artifact",t),t(),()=>{window.removeEventListener("open-claude-code-artifact",t),window.__openLocalCodeArtifact===e&&delete window.__openLocalCodeArtifact}},[l]),',
  },
  {
    id: "allow-local-code-artifact-pane-urls",
    assetUrlPath: "/assets/v1/c06173196-DmnMdctC.js",
    find: "e.useEffect(()=>{const e=Z;if(e)if(Ap(e)&&vb(e))if(c){",
    replace:
      "e.useEffect(()=>{const e=Z;if(e)if(Ap(e)&&vb(e)||/^\\/code\\/artifact\\/[0-9a-f-]{36}$/i.test(e))if(c){",
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
    find: 'const qe=["enabled_model_auto_fallback","enabled_web_search","tool_search_mode"],ze=e.memo(()=>{',
    replace:
      'const qe=["enabled_model_auto_fallback","enabled_web_search","tool_search_mode"],ze=e.memo(()=>null),zeCloudUnused=e.memo(()=>{',
  },
  {
    id: "remove-local-model-switch-setting",
    assetUrlPath: "/assets/v1/c71860c77-QKSs-TTD.js",
    find: "const We=e.memo(()=>{const a=n(),{resolved:t,patch:l,isPatchAvailable:o}=Te(),",
    replace:
      "const We=e.memo(()=>null),WeCloudUnused=e.memo(()=>{const a=n(),{resolved:t,patch:l,isPatchAvailable:o}=Te(),",
  },
  {
    id: "enable-local-published-artifacts-query",
    // The publish modal decides between its "Create & copy link" and
    // "Artifact published" (link + Unpublish) views from this per-message
    // published-artifacts query. Kill-switched, it never runs locally, so
    // publishing gave no feedback and unpublish was unreachable.
    find: "X(`/api/organizations/${s}/published_artifacts?${a.toString()}`,{staleTime:0,queryKey:[sb,{orgUuid:s,includeDeletedArtifacts:t?.includeDeletedArtifacts,noToast:t?.noToast}],enabled:!!s&&(t?.enabled??!0),meta:{noToast:t?.noToast}})",
    replace:
      "X(`/api/organizations/${s}/published_artifacts?${a.toString()}`,{custom3pCompatible:!0,staleTime:0,queryKey:[sb,{orgUuid:s,includeDeletedArtifacts:t?.includeDeletedArtifacts,noToast:t?.noToast}],enabled:!!s&&(t?.enabled??!0),meta:{noToast:t?.noToast}})",
  },
  {
    id: "enable-local-code-plugins-access",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // The plugins section on the Code surface needs this statsig-backed
    // skills-access gate; the local bootstrap ships empty statsig values,
    // so it read false and the (fully backed) LocalPlugins UI never
    // rendered.
    find: 'function aNe(){const e=av("claudeai_skills_claude_code_access"),t=gpe(),n=BL();return e&&t&&n}',
    replace: "function aNe(){return!0}",
  },
  {
    id: "grant-local-project-edit-permissions",
    assetUrlPath: "/assets/v1/c6eedc03a-CsEFTfjy.js",
    // The permission hook derives knowledge/settings edit rights from
    // membership and permissions queries that the custom3pCompatible
    // kill-switch never lets run locally, so every project rendered
    // read-only: no Files upload UI, no instructions editor. The single
    // local user owns every project.
    find: 'return{hasSettingsEditPermission:u,isProjectShared:d||(a?.group_assignments?.length??0)>0||!1===r?.is_private,hasKBEditPermissions:"user"===l||!r?.is_private&&"user"===r?.organization_role||!!s?.permissions.includes(AO.KnowledgeEdit),canManageMembers:"user"===l||!r?.is_private&&"user"===r?.organization_role||!!s?.permissions.includes(AO.MembersManage),isPermissionLoading:c}',
    replace:
      "return{hasSettingsEditPermission:!0,isProjectShared:!1,hasKBEditPermissions:!0,canManageMembers:!0,isPermissionLoading:!1}",
  },
  {
    id: "defer-local-terminal-pty-delivery",
    find: 'for(const n of nBn)try{n(e)}catch(t){dt.error(ut.DESKTOP_API,"localShellPtyTransport subscriber threw",{err:t})}',
    replace:
      'for(const n of nBn)setTimeout(()=>{try{n(e)}catch(t){dt.error(ut.DESKTOP_API,"localShellPtyTransport subscriber threw",{err:t})}},0)',
  },
];

function localArtifactRendererHtml(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Local artifact renderer</title>
  <style>
    html,body,#mount{width:100%;height:100%;margin:0;overflow:auto;background:#fff;color:#181817}
    body{font:14px/1.5 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    #mount>iframe{display:block;width:100%;height:100%;border:0;background:#fff}
    pre{box-sizing:border-box;min-height:100%;margin:0;padding:24px;white-space:pre-wrap;overflow:auto;font:13px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace}
    article{box-sizing:border-box;max-width:900px;margin:0 auto;padding:32px;font-size:16px;line-height:1.7}
    article pre{min-height:0;padding:16px;border-radius:10px;background:#f2f1ed}
    .notice{margin:16px;padding:12px 14px;border:1px solid #d8d5ce;border-radius:10px;background:#f7f6f2;color:#5f5d58}
  </style>
</head>
<body><div id="mount"></div>
<script>
(function(){
  "use strict";
  var EMPTY={"@type":"type.googleapis.com/google.protobuf.Empty"};
  var READY="anthropic.claude.usercontent.sandbox.ReadyForContent";
  var SET_CONTENT="anthropic.claude.usercontent.sandbox.SetContent";
  var DOM_LOADED="anthropic.claude.usercontent.sandbox.DOMContentLoaded";
  var parentOrigin=new URLSearchParams(location.search).get("parentOrigin")||"app://localhost";
  var channel=null;
  var mount=document.getElementById("mount");
  var currentContent="";
  var currentType="text/plain";
  var requestSequence=0;

  function send(message){
    if(channel) channel.postMessage(message);
    else window.parent.postMessage(message,parentOrigin);
  }
  function request(method,payload){
    send({channel:"request",requestId:"local-renderer-"+(++requestSequence)+"-"+Date.now(),method:method,payload:payload||EMPTY});
  }
  function respond(requestId,payload,status){
    send({channel:"response",requestId:requestId,status:status||200,payload:payload||EMPTY});
  }
  function escapeHtml(value){
    return String(value).replace(/[&<>\"]/g,function(character){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[character]});
  }
  function notifyRendered(){
    window.parent.postMessage({type:"local-artifact-rendered",artifactType:currentType,contentLength:currentContent.length},parentOrigin);
  }
  function renderMarkdown(content){
    var escaped=escapeHtml(content);
    var html=escaped
      .replace(/\`\`\`([\\w-]*)\\n([\\s\\S]*?)\`\`\`/g,"<pre><code>$2</code></pre>")
      .replace(/^### (.+)$/gm,"<h3>$1</h3>")
      .replace(/^## (.+)$/gm,"<h2>$1</h2>")
      .replace(/^# (.+)$/gm,"<h1>$1</h1>")
      .replace(/\\*\\*([^*]+)\\*\\*/g,"<strong>$1</strong>")
      .replace(/\\*([^*]+)\\*/g,"<em>$1</em>")
      .replace(/\\n{2,}/g,"</p><p>")
      .replace(/\\n/g,"<br>");
    mount.innerHTML="<article><p>"+html+"</p></article>";
  }
  function render(content,type){
    currentContent=typeof content==="string"?content:"";
    currentType=type||"text/plain";
    mount.replaceChildren();
    if(currentType==="text/html"||currentType==="image/svg+xml"){
      var frame=document.createElement("iframe");
      frame.setAttribute("sandbox","allow-scripts allow-forms allow-modals allow-popups allow-downloads");
      frame.setAttribute("title","Artifact preview content");
      frame.srcdoc=currentType==="image/svg+xml"
        ? "<!doctype html><style>html,body{margin:0;width:100%;height:100%}svg{max-width:100%;height:auto}</style>"+currentContent
        : currentContent;
      frame.addEventListener("load",function(){request(DOM_LOADED,EMPTY);notifyRendered();},{once:true});
      mount.appendChild(frame);
      return;
    }
    if(currentType==="text/markdown"){
      renderMarkdown(currentContent);
      request(DOM_LOADED,EMPTY);
      notifyRendered();
      return;
    }
    if(currentType==="application/vnd.ant.react"||currentType==="application/vnd.ant.mermaid"){
      var notice=document.createElement("div");
      notice.className="notice";
      notice.textContent=currentType==="application/vnd.ant.react"
        ? "Local React preview is shown as source until its imports can be resolved."
        : "Local Mermaid preview is shown as source.";
      var source=document.createElement("pre");
      source.textContent=currentContent;
      mount.append(notice,source);
      request(DOM_LOADED,EMPTY);
      notifyRendered();
      return;
    }
    var pre=document.createElement("pre");
    pre.textContent=currentContent;
    mount.appendChild(pre);
    request(DOM_LOADED,EMPTY);
    notifyRendered();
  }
  function handle(message){
    if(!message||message.channel!=="request"||typeof message.requestId!=="string") return;
    if(message.method===SET_CONTENT){
      render(message.payload&&message.payload.content,message.payload&&message.payload.type);
      respond(message.requestId,EMPTY);
      return;
    }
    if(message.method==="anthropic.claude.usercontent.sandbox.GetScreenshot"){
      respond(message.requestId,{"@type":"type.googleapis.com/anthropic.claude.usercontent.sandbox.GetScreenshotResponse",screenshot:null});
      return;
    }
    if(message.method==="anthropic.claude.usercontent.sandbox.CopyHtmlContent"){
      respond(message.requestId,{"@type":"type.googleapis.com/anthropic.claude.usercontent.sandbox.CopyHtmlContentResponse",reportHTMLContent:currentType==="text/html"?currentContent:mount.innerHTML});
      return;
    }
    if(message.method==="anthropic.claude.usercontent.sandbox.GetDOMSnapshot"){
      respond(message.requestId,{"@type":"type.googleapis.com/anthropic.claude.usercontent.sandbox.GetDOMSnapshotResponse",domSnapshot:mount.innerHTML});
      return;
    }
    respond(message.requestId,EMPTY);
  }
  window.addEventListener("message",function(event){
    if(event.origin!==parentOrigin||event.source!==window.parent) return;
    if(event.data&&event.data.type==="__sandbox_handshake__"&&event.ports&&event.ports[0]){
      channel=event.ports[0];
      channel.onmessage=function(portEvent){handle(portEvent.data);};
      channel.start();
      request(READY,EMPTY);
      return;
    }
    handle(event.data);
  });
  window.parent.postMessage({type:"__sandbox_handshake_request__"},parentOrigin);
  setTimeout(function(){if(!channel)request(READY,EMPTY);},250);
})();
<\/script></body></html>`;
}

function moduleAssetPaths(indexHtml: string): string[] {
  const paths = new Set<string>();
  for (const match of indexHtml.matchAll(
    /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["']/gi,
  )) {
    if (match[1]) paths.add(match[1]);
  }
  for (const match of indexHtml.matchAll(
    /<link\b[^>]*\brel=["']modulepreload["'][^>]*\bhref=["']([^"']+)["']/gi,
  )) {
    if (match[1]) paths.add(match[1]);
  }
  if (paths.size === 0)
    throw new Error("Packaged UI module assets were not found");
  return [...paths];
}

async function patchedClientAssets(
  root: string,
  indexHtml: string,
  patches: readonly ClientPatch[],
): Promise<Map<string, { source: string; ids: string[] }>> {
  const sources = new Map<string, string>();
  for (const assetUrlPath of moduleAssetPaths(indexHtml)) {
    const assetPath = resolveInside(root, assetUrlPath);
    if (!assetPath || !(await regularFile(assetPath)))
      throw new Error(`Packaged UI module is unavailable: ${assetUrlPath}`);
    sources.set(path.resolve(assetPath), await readFile(assetPath, "utf8"));
  }
  for (const assetUrlPath of new Set(
    patches.map((patch) => patch.assetUrlPath).filter(Boolean) as string[],
  )) {
    const assetPath = resolveInside(root, assetUrlPath);
    if (assetPath && (await regularFile(assetPath))) {
      sources.set(path.resolve(assetPath), await readFile(assetPath, "utf8"));
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
    for (const candidate of compatible)
      sources.set(path.resolve(candidate), await readFile(candidate, "utf8"));
  }

  const idsByPath = new Map<string, string[]>();
  for (const patch of patches) {
    let occurrences = 0;
    let matchedPath: string | undefined;
    for (const [assetPath, source] of sources) {
      const count = source.split(patch.find).length - 1;
      occurrences += count;
      if (count > 0) matchedPath = assetPath;
    }
    if (occurrences !== 1 || !matchedPath) {
      throw new Error(
        `Client patch ${patch.id} expected exactly one match, found ${occurrences}`,
      );
    }
    sources.set(
      matchedPath,
      sources.get(matchedPath)!.replace(patch.find, patch.replace),
    );
    idsByPath.set(matchedPath, [
      ...(idsByPath.get(matchedPath) ?? []),
      patch.id,
    ]);
  }

  return new Map(
    [...idsByPath].map(([assetPath, ids]) => [
      assetPath,
      { source: sources.get(assetPath)!, ids },
    ]),
  );
}

export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "app",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: false,
      },
    },
    {
      scheme: "claude-local-preview",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
    {
      scheme: "claude-local-launch",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
  ]);
}

async function regularFile(candidate: string): Promise<boolean> {
  try {
    return (await stat(candidate)).isFile();
  } catch {
    return false;
  }
}

const API_PREFIXES = [
  "/api/",
  "/edge-api/",
  "/v1/",
  "/v2/",
  "/mcp-registry/",
  "/sandbox/",
];

function isApiPath(pathname: string): boolean {
  return (
    !/\.(?:m?[jt]sx?|css|map)$/.test(pathname) &&
    API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function currentUserAccess(): Record<string, unknown> {
  return {
    features: [
      "chat",
      "claude_code",
      "claude_code_web",
      "claude_code_desktop",
      "skills",
      "cobalt_plinth",
      "web_search",
    ].map((feature) => ({
      feature,
      status: "available",
    })),
  };
}

const LOCAL_ORG_UUID = "00000000-0000-4000-8000-000000000001";
const LOCAL_ACCOUNT_UUID = "00000000-0000-4000-8000-000000000002";
const LOCAL_CREATED_AT = "2026-01-01T00:00:00.000Z";

let cachedLocalDisplayName: string | undefined;

function localDisplayName(): string {
  if (cachedLocalDisplayName) return cachedLocalDisplayName;
  const configured = process.env.CLAUDE_LOCAL_USER_NAME?.trim();
  if (configured) return (cachedLocalDisplayName = configured);
  if (process.platform === "win32") {
    try {
      const fullName = execFileSync(
        "powershell.exe",
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "(Get-LocalUser -Name $env:USERNAME).FullName",
        ],
        {
          encoding: "utf8",
          timeout: 2_000,
          windowsHide: true,
          stdio: ["ignore", "pipe", "ignore"],
        },
      ).trim();
      const firstName = fullName.split(/\s+/u)[0]?.trim();
      if (firstName) return (cachedLocalDisplayName = firstName);
    } catch {
      // Fall through to the portable username-derived label.
    }
  }
  const username = (process.env.USERNAME || process.env.USER || "").trim();
  if (!username) return (cachedLocalDisplayName = "Local User");
  return (cachedLocalDisplayName = username
    .replace(/[._-]+/gu, " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase()));
}

function personalizedGreeting(
  name = localDisplayName(),
): Array<Record<string, unknown>> {
  return [
    {
      surface: "chat",
      default_slots: [
        { until: 5, text: "Moonlit chat?" },
        { until: 11, text: `Good morning, ${name}.` },
        { until: 14, text: `What are we working on today, ${name}?` },
        { until: 18, text: `What’s next, ${name}?` },
        { until: 22, text: `Good evening, ${name}. What can I help with?` },
        { until: 24, text: "Moonlit chat?" },
      ],
    },
  ];
}

function localModelId(configuredModel?: string): string {
  return (
    process.env.CLAUDE_LOCAL_MODEL?.trim() || configuredModel || "local-model"
  );
}

function localOrganization(configuredModel?: string): Record<string, unknown> {
  const model = localModelId(configuredModel);
  return {
    uuid: LOCAL_ORG_UUID,
    id: 0,
    name: "Local",
    settings: {},
    parent_organization_uuid: null,
    capabilities: ["chat", "claude_pro"],
    billing_type: "stripe_subscription",
    free_credits_status: null,
    api_disabled_reason: null,
    api_disabled_until: null,
    rate_limit_tier: null,
    data_retention: null,
    raven_type: null,
    claude_ai_bootstrap_models_config: [
      { model, name: model, label_override: model },
    ],
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function localAccount(
  configuredModel?: string,
  profile: Record<string, unknown> = {},
  accountSettings: Record<string, unknown> = {},
): Record<string, unknown> {
  const fullName =
    (typeof profile.full_name === "string" && profile.full_name.trim()) ||
    localDisplayName();
  const displayName =
    (typeof profile.display_name === "string" && profile.display_name.trim()) ||
    fullName;
  const profileSettings = objectValue(profile.settings);
  return {
    ...profile,
    tagged_id: `local_${LOCAL_ACCOUNT_UUID}`,
    uuid: LOCAL_ACCOUNT_UUID,
    email_address: "local@localhost",
    full_name: fullName,
    display_name: displayName,
    created_at: LOCAL_CREATED_AT,
    updated_at: LOCAL_CREATED_AT,
    accepted_clickwrap_versions: {},
    is_verified: true,
    age_is_verified: true,
    memberships: [
      {
        role: "admin",
        seat_tier: "unassigned",
        created_at: LOCAL_CREATED_AT,
        updated_at: LOCAL_CREATED_AT,
        organization: localOrganization(configuredModel),
      },
    ],
    workspace_memberships: [],
    invites: [],
    settings: {
      enabled_geolocation: false,
      enabled_web_search: true,
      // The retained chat renderer gates the artifact pane on this account
      // flag when a stored conversation is rehydrated; without it, artifact
      // cards render but clicking them cannot open the panel after a restart
      // or when returning to an old chat.
      preview_feature_uses_artifacts: true,
      // Memory ("saffron") defaults on; the native Settings/Customize
      // toggles persist overrides through the account-settings endpoint.
      enabled_saffron: true,
      // Code execution ("wiggle") defaults off until the user turns on the
      // Docker-backed sandbox in the local settings panel.
      enabled_wiggle: false,
      enabled_wiggle_egress: false,
      ...accountSettings,
      ...profileSettings,
    },
  };
}

function modelSelectorConfig(
  configuredModel?: string,
): Array<Record<string, unknown>> {
  const model = localModelId(configuredModel);
  const models = [
    {
      id: model,
      name: model,
      description: "Configured OpenAI-compatible model",
      thinking: {
        description: "Control whether the local model uses thinking",
        mode_options: [
          {
            id: "off",
            name: "Instant",
            description: "Respond without extended thinking",
          },
          {
            id: "extended",
            name: "Thinking",
            description: "Enable thinking for complex work",
          },
        ],
      },
    },
  ];
  return ["cowork", "code", "chat"].map((id) => ({ id, models }));
}

function modelSelectorState(
  configuredModel?: string,
  enableThinking = false,
): Array<Record<string, unknown>> {
  const model = localModelId(configuredModel);
  const thinking = {
    type: "mode",
    mode: enableThinking ? "extended" : "off",
  };
  return ["cowork", "code", "chat"].map((id) => ({
    id,
    model,
    source: "global_default",
    thinking,
    thinking_by_model: [{ id: model, thinking }],
  }));
}

function growthbookFeatures(configuredModel?: string): Record<string, unknown> {
  const enabled = (defaultValue: unknown) => ({ defaultValue });
  return {
    "574905726": enabled(true),
    "1101873029": enabled(false),
    "3150971238": enabled(false),
    "3007887412": enabled(false),
    "350336616": enabled(false),
    "1138175852": enabled(false),
    "954625922": enabled(true),
    "1441987769": enabled(false),
    "3086952380": enabled(false),
    "986399546": enabled(true),
    "2895944283": enabled(true),
    "2547348043": enabled(true),
    "1215221242": enabled(true),
    "1588340729": enabled(true),
    "4085357330": enabled(true),
    "3368286709": enabled(true),
    "3615229285": enabled(true),
    "3353525254": enabled(true),
    "700397605": enabled(true),
    "3356268835": enabled({
      showGsuiteConnectors: false,
      enableAdditionalDirectoriesClaudeMd: true,
    }),
    "1868684740": enabled(true),
    "4108768567": enabled(true),
    "3070110303": enabled(true),
    "2431502897": enabled("inherit"),
    "2973881027": enabled({
      model: localModelId(configuredModel),
      overrideSticky: false,
      nuxId: null,
    }),
  };
}

function bootstrapPayload(
  configuredModel?: string,
  profile: Record<string, unknown> = {},
  accountSettings: Record<string, unknown> = {},
  enableThinking = false,
): Record<string, unknown> {
  const account = localAccount(configuredModel, profile, accountSettings);
  return {
    account,
    current_user_access: currentUserAccess(),
    locale: null,
    statsig: {
      user: { userID: randomUUID() },
      values: {},
      values_hash: "custom3p",
    },
    growthbook: { features: growthbookFeatures(configuredModel) },
    model_selector_config: modelSelectorConfig(configuredModel),
    model_selector_state: modelSelectorState(configuredModel, enableThinking),
    personalized_greeting: personalizedGreeting(
      typeof account.display_name === "string"
        ? account.display_name
        : localDisplayName(),
    ),
    intercom_account_hash: null,
    system_prompts: {},
  };
}

function traceLocalApi(request: Request, pathname: string): void {
  if (process.env.CLAUDE_TRACE_LOCAL_API === "1")
    console.error(`[local-api] ${request.method} ${pathname}`);
}

async function localApiResponse(
  request: Request,
  url: URL,
  backend: LocalBackend,
  codeSessions: LocalCodeSessionManager,
): Promise<Response | null> {
  const pathname = url.pathname;
  traceLocalApi(request, pathname);
  const normalized = pathname.startsWith("/edge-api/")
    ? `/api/${pathname.slice(10)}`
    : pathname;
  if (normalized === "/api/frame/frames" && request.method === "GET") {
    const artifacts = (await codeSessions.invoke(
      "getAllArtifacts",
      [],
    )) as Array<Record<string, unknown>>;
    return jsonResponse({
      frames: artifacts.map((artifact) => ({
        slug: artifact.id,
        title: artifact.title,
        label: artifact.title,
        description: artifact.sessionTitle,
        source_surface: "code",
        rel: "mine",
        audience: "owner",
        updatedAt: artifact.updatedAt,
        created_at: artifact.updatedAt,
        last_viewed_at: artifact.updatedAt,
        softDeleted: false,
        starred: false,
      })),
      starsEnabled: false,
    });
  }
  if (normalized === "/api/frame/track" && request.method === "POST")
    return new Response(null, { status: 204 });
  if (
    request.method === "GET" &&
    normalized === "/api/published_artifacts/view_counts"
  )
    return jsonResponse([]);
  const localFrameMatch = normalized.match(/^\/api\/frame\/([0-9a-f-]{36})$/i);
  if (localFrameMatch) {
    if (request.method === "DELETE") {
      const deleted = await codeSessions.invoke("deleteArtifactById", [
        localFrameMatch[1].toLowerCase(),
      ]);
      return new Response(null, { status: deleted ? 204 : 404 });
    }
    if (request.method === "GET") {
      const artifact = (await codeSessions.invoke("readArtifactById", [
        localFrameMatch[1].toLowerCase(),
      ])) as Record<string, unknown> | null;
      return artifact
        ? jsonResponse({
            uuid: localFrameMatch[1].toLowerCase(),
            title: artifact.title,
            updated_at: artifact.updatedAt,
            perm: {
              role: "owner",
              mode: "private",
              writersEnabled: false,
              assignableReadModes: ["private"],
              mayWiden: false,
            },
            author: { display_name: "Local User" },
          })
        : jsonResponse(
            { error: { type: "not_found_error", message: "Not found" } },
            404,
          );
    }
  }
  if (normalized === "/api/local/code/artifacts" && request.method === "GET") {
    return jsonResponse({
      artifacts: await codeSessions.invoke("getAllArtifacts", []),
    });
  }
  if (normalized === "/api/local/code/artifact" && request.method === "GET") {
    const artifact = await codeSessions.invoke("readArtifact", [
      url.searchParams.get("sessionId"),
      url.searchParams.get("url"),
    ]);
    return artifact
      ? jsonResponse({ artifact })
      : jsonResponse({ error: { message: "Artifact not found" } }, 404);
  }
  if (
    normalized === "/api/local/code/artifact/open" &&
    request.method === "POST"
  ) {
    const input = (await request.json()) as Record<string, unknown>;
    const artifact = (await codeSessions.invoke("readArtifact", [
      input.sessionId,
      input.url,
    ])) as Record<string, unknown> | null;
    if (!artifact || typeof artifact.path !== "string")
      return jsonResponse({ error: { message: "Artifact not found" } }, 404);
    const action = input.action === "reveal" ? "reveal" : "open";
    if (action === "reveal") shell.showItemInFolder(artifact.path);
    else {
      const error = await shell.openPath(artifact.path);
      if (error) return jsonResponse({ error: { message: error } }, 500);
    }
    return jsonResponse({ ok: true });
  }
  if (
    normalized === "/api/local/dictation/transcribe" &&
    request.method === "POST"
  ) {
    // Batch speech-to-text: the bundled whisper.cpp model transcribes fully
    // offline; a provider /audio/transcriptions endpoint is the fallback
    // when the bundled model is absent or fails.
    try {
      const provider = backend.provider();
      const audio = Buffer.from(await request.arrayBuffer());
      if (audio.length === 0)
        return jsonResponse({ error: { message: "Empty recording" } }, 400);
      if (audio.length > 25_000_000)
        return jsonResponse({ error: { message: "Recording too long" } }, 400);
      const mime = request.headers.get("content-type") || "audio/webm";
      if (
        mime.includes("wav") &&
        bundledWhisperPaths() &&
        process.env.CLAUDE_LOCAL_TRANSCRIBE_PREFER !== "provider"
      ) {
        try {
          return jsonResponse({
            text: await transcribeWithBundledWhisper(audio),
          });
        } catch {
          // The provider path below is the fallback.
        }
      }
      const form = new FormData();
      form.append(
        "file",
        new Blob([audio], { type: mime }),
        mime.includes("ogg") ? "recording.ogg" : "recording.webm",
      );
      form.append(
        "model",
        process.env.CLAUDE_LOCAL_TRANSCRIBE_MODEL || "whisper-1",
      );
      const upstream = await fetch(`${provider.baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: provider.apiKey
          ? { Authorization: `Bearer ${provider.apiKey}` }
          : {},
        body: form,
        signal: AbortSignal.timeout(120_000),
      });
      if (!upstream.ok) {
        const detail = (await upstream.text().catch(() => "")).slice(0, 300);
        return jsonResponse(
          {
            error: {
              message:
                upstream.status === 404
                  ? "The provider has no /audio/transcriptions endpoint. Run a Whisper-compatible server (for example faster-whisper-server) at the same base URL, or set CLAUDE_LOCAL_TRANSCRIBE_MODEL."
                  : `Transcription failed: HTTP ${upstream.status}${detail ? ` — ${detail}` : ""}`,
            },
          },
          502,
        );
      }
      const payload = (await upstream.json()) as { text?: unknown };
      return jsonResponse({
        text: typeof payload.text === "string" ? payload.text : "",
      });
    } catch (error) {
      return jsonResponse(
        {
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        },
        502,
      );
    }
  }
  // Client telemetry batches have no local sink; acknowledge them so the
  // console stays free of 503 noise on every surface.
  if (normalized.startsWith("/api/event_logging/"))
    return jsonResponse({ ok: true });
  // Session inventory for the preload's directory-grouped Code sidebar.
  if (normalized === "/api/local/code/sessions") {
    const sessions = (await codeSessions.invoke("getAll", [])) as Array<
      Record<string, unknown>
    >;
    return jsonResponse({
      sessions: sessions.map((session) => ({
        sessionId: session.sessionId,
        title: session.title,
        cwd: session.cwd,
        lastActivityAt: session.lastActivityAt,
        isRunning: session.isRunning === true,
        isArchived: session.isArchived === true,
      })),
    });
  }
  if (normalized === "/api/local/export/conversations") {
    return jsonResponse({
      conversations: backend
        .exportConversations()
        .filter((conversation) => !conversation.is_temporary)
        .map((conversation) => ({
          uuid: conversation.uuid,
          name: conversation.name || "Untitled chat",
          updated_at: conversation.updated_at,
          messages: conversation.chat_messages.length,
        })),
    });
  }
  if (normalized === "/api/local/export" && request.method === "POST") {
    try {
      const input = (await request.json()) as Partial<TrainingExportOptions>;
      const options: TrainingExportOptions = {
        ...DEFAULT_EXPORT_OPTIONS,
        ...input,
      };
      const conversations = backend
        .exportConversations()
        .filter(
          (conversation) => !conversation.is_temporary,
        ) as unknown as ExportConversation[];
      const stamp = new Date().toISOString().slice(0, 10);
      // Test harnesses point this at a directory to bypass the native file
      // dialogs, which would otherwise block an automated renderer.
      const unattendedDir = process.env.CLAUDE_LOCAL_EXPORT_DIR;
      if (options.format === "markdown") {
        const selected = conversations.filter(
          (conversation) =>
            !options.conversationUuid ||
            conversation.uuid === options.conversationUuid,
        );
        if (selected.length === 0)
          return jsonResponse(
            { error: { message: "No conversations to export" } },
            400,
          );
        if (selected.length === 1) {
          const { canceled, filePath } = unattendedDir
            ? {
                canceled: false,
                filePath: path.join(
                  unattendedDir,
                  `${safeFileName(selected[0].name)}.md`,
                ),
              }
            : await dialog.showSaveDialog({
                title: "Export chat as Markdown",
                defaultPath: path.join(
                  app.getPath("downloads"),
                  `${safeFileName(selected[0].name)}.md`,
                ),
                filters: [{ name: "Markdown", extensions: ["md"] }],
              });
          if (canceled || !filePath) return jsonResponse({ canceled: true });
          await writeFile(
            filePath,
            conversationMarkdown(selected[0], options),
            "utf8",
          );
          return jsonResponse({ path: filePath, conversations: 1 });
        }
        const { canceled, filePaths } = unattendedDir
          ? { canceled: false, filePaths: [unattendedDir] }
          : await dialog.showOpenDialog({
              title: "Choose a folder for the Markdown export",
              defaultPath: app.getPath("downloads"),
              properties: ["openDirectory", "createDirectory"],
            });
        if (canceled || filePaths.length === 0)
          return jsonResponse({ canceled: true });
        const target = path.join(filePaths[0], `open-claude-export-${stamp}`);
        await mkdir(target, { recursive: true });
        let written = 0;
        const used = new Set<string>();
        for (const conversation of selected) {
          if (conversation.chat_messages.length === 0) continue;
          let base = safeFileName(conversation.name);
          if (used.has(base)) base = `${base}-${conversation.uuid.slice(0, 8)}`;
          used.add(base);
          await writeFile(
            path.join(target, `${base}.md`),
            conversationMarkdown(conversation, options),
            "utf8",
          );
          written += 1;
        }
        return jsonResponse({ path: target, conversations: written });
      }
      const sessions = (
        options.includeCode
          ? await codeSessions.invoke("exportSessions", [])
          : []
      ) as ExportCodeSession[];
      const result = buildTrainingExport(conversations, sessions, options);
      if (result.rows.length === 0)
        return jsonResponse(
          {
            error: {
              message: `No conversations matched the filters (${result.skipped} skipped)`,
            },
          },
          400,
        );
      const { canceled, filePath } = unattendedDir
        ? {
            canceled: false,
            filePath: path.join(
              unattendedDir,
              `open-claude-training-${options.format}-${stamp}.jsonl`,
            ),
          }
        : await dialog.showSaveDialog({
            title: "Export training data",
            defaultPath: path.join(
              app.getPath("downloads"),
              `open-claude-training-${options.format}-${stamp}.jsonl`,
            ),
            filters: [{ name: "JSON Lines", extensions: ["jsonl"] }],
          });
      if (canceled || !filePath) return jsonResponse({ canceled: true });
      await writeFile(filePath, result.rows.join("\n") + "\n", "utf8");
      return jsonResponse({
        path: filePath,
        conversations: result.conversations,
        skipped: result.skipped,
      });
    } catch (error) {
      return jsonResponse(
        {
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        },
        500,
      );
    }
  }
  if (normalized === "/api/local/code/customization") {
    try {
      if (request.method === "GET") {
        return jsonResponse(
          await codeSessions.invoke("getCustomization", [
            url.searchParams.get("cwd"),
          ]),
        );
      }
      if (request.method === "PUT" || request.method === "DELETE") {
        const input = await request.json();
        return jsonResponse(
          await codeSessions.invoke(
            request.method === "PUT"
              ? "saveCustomization"
              : "deleteCustomization",
            [input],
          ),
        );
      }
      return new Response(null, { status: 405 });
    } catch (error) {
      return jsonResponse(
        {
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        },
        400,
      );
    }
  }
  if (
    normalized === "/api/bootstrap" ||
    (normalized.startsWith("/api/bootstrap/") &&
      normalized.endsWith("/app_start"))
  )
    return jsonResponse(
      bootstrapPayload(
        backend.provider().model,
        backend.accountProfile(),
        backend.accountSettings(),
        backend.provider().enableThinking ?? false,
      ),
    );
  if (
    normalized.startsWith("/api/bootstrap/") &&
    normalized.endsWith("/current_user_access")
  ) {
    return jsonResponse(currentUserAccess());
  }
  if (
    normalized.startsWith("/api/bootstrap/") &&
    normalized.endsWith("/system_prompts")
  ) {
    return jsonResponse({});
  }
  if (normalized === "/api/account_profile") {
    if (request.method === "PUT")
      await backend.updateAccountProfile(await request.json());
    if (request.method === "GET" || request.method === "PUT")
      return jsonResponse({
        ...localAccount(
          backend.provider().model,
          backend.accountProfile(),
          backend.accountSettings(),
        ),
        locale: null,
      });
    return new Response(null, { status: 405 });
  }
  if (normalized === "/v1/privacy-consents") {
    return request.method === "GET"
      ? jsonResponse({ consents: [] })
      : jsonResponse({});
  }
  if (normalized === "/api/account/settings" && request.method === "PATCH")
    return jsonResponse(
      await backend.updateAccountSettings(await request.json()),
    );
  if (normalized === "/api/account" && request.method === "PUT") {
    const input = objectValue(await request.json());
    await backend.updateAccountProfile(input);
    if (input.settings) await backend.updateAccountSettings(input.settings);
    return jsonResponse(
      localAccount(
        backend.provider().model,
        backend.accountProfile(),
        backend.accountSettings(),
      ),
    );
  }
  if (
    request.method === "GET" &&
    /^\/api\/organizations\/[^/]+\/notification\/preferences$/.test(normalized)
  ) {
    return jsonResponse({
      preferences: { feature_preference: {} },
      push_reachability: null,
    });
  }
  if (
    request.method === "PATCH" &&
    /^\/api\/organizations\/[^/]+\/model_selector_state\/[^/]+$/.test(
      normalized,
    )
  ) {
    const surface = normalized.split("/").at(-1) ?? "chat";
    const input = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const thinking =
      input.thinking && typeof input.thinking === "object"
        ? (input.thinking as Record<string, unknown>)
        : null;
    const mode =
      typeof thinking?.mode === "string" ? thinking.mode.toLowerCase() : "off";
    const enableThinking = mode === "extended" || mode === "enabled";
    await backend.setThinkingEnabled(enableThinking);
    const model = backend.provider().model;
    const storedThinking = {
      type: "mode",
      mode: enableThinking ? "extended" : "off",
    };
    return jsonResponse({
      id: surface,
      model,
      source: "user_setting",
      thinking: storedThinking,
      thinking_by_model: [{ id: model, thinking: storedThinking }],
    });
  }
  if (normalized.endsWith("/plugins/list-plugins"))
    return jsonResponse({ plugins: [], has_more: false });
  if (normalized.includes("/marketplaces/list-"))
    return jsonResponse({ marketplaces: [] });
  if (normalized.endsWith("/dust/command_display_names"))
    return jsonResponse({ results: [] });
  if (normalized.startsWith("/v1/code/github/"))
    return jsonResponse({ branch_statuses: [] });
  if (pathname === "/healthcheck")
    return jsonResponse({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  const backendResponse = await backend.handle(request, url);
  if (backendResponse) return backendResponse;
  if (isApiPath(normalized)) {
    return jsonResponse(
      {
        error: {
          type: "custom_3p_not_available",
          message: "This functionality is not available in third-party mode.",
        },
      },
      503,
    );
  }
  return null;
}

function inlineScriptHashes(html: string): string[] {
  return [
    ...html.matchAll(/<script(?![^>]*\ssrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi),
  ]
    .map((match) => match[1])
    .filter(Boolean)
    .map(
      (script) =>
        `'sha256-${createHash("sha256").update(script, "utf8").digest("base64")}'`,
    );
}

function contentSecurityPolicy(scriptHashes: readonly string[]): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' ${scriptHashes.join(" ")}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-src 'self' app://artifacts.local",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "block-all-mixed-content",
  ].join("; ");
}

export async function installLocalUiProtocol(
  root: string,
  backend: LocalBackend,
  codeSessions: LocalCodeSessionManager,
  tunnel?: LocalArtifactTunnel,
): Promise<void> {
  const indexPath = path.join(root, "index.html");
  await access(indexPath);
  const absoluteRoot = path.resolve(root);
  // base-ui only unmounts a closing dialog after its exit transition ends,
  // and Chromium stops the frame clock entirely while a document is hidden
  // or fully occluded, so a Settings/publish dialog closed while the window
  // is covered would deadlock open. base-ui checks this global before
  // waiting on animations; keep it in sync with document visibility so
  // hidden closes complete instantly while visible closes stay animated.
  const visibilityGuard =
    '<script>(()=>{const sync=()=>{globalThis.BASE_UI_ANIMATIONS_DISABLED=document.visibilityState==="hidden"};document.addEventListener("visibilitychange",sync);sync()})();</script>';
  // The artifact pane bridge must run in the page's JavaScript world (React
  // fiber expandos are invisible from the isolated preload world). It fixes
  // two retained-client defects at their contract level:
  // 1. An inline artifact card rendered by a cold-mounted chat can capture a
  //    replaced dispatcher, so its click never reaches the live chat-resource
  //    reducer. The bridge locates the live context through React fibers and
  //    dispatches the app's own SELECT_ARTIFACT / CLEAR_SELECTED instead.
  // 2. The pane layout's width comes from a resize effect whose dependency
  //    list omits the open flag, so a pane opened without a simultaneous
  //    container resize stays at width zero. The bridge reconciles the
  //    drawer wrapper's inline flex with the open state the app exposes via
  //    aria-hidden — the same style channel the app's own resizer writes.
  // Published-artifact links copy as app://localhost URLs, which only work
  // inside this app. When the share tunnel is up, rewrite the copied link to
  // the public https URL (waiting briefly for the tunnel to establish after
  // a publish).
  const tunnelClipboard = `<script>(() => {
  "use strict";
  const original = navigator.clipboard.writeText.bind(navigator.clipboard);
  navigator.clipboard.writeText = async (text) => {
    try {
      if (typeof text === "string" && text.startsWith("app://localhost/public/artifacts/")) {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const status = await (await fetch("/api/local/tunnel/status")).json();
          if (status.url)
            return original(text.replace("app://localhost", status.url));
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    } catch {}
    return original(text);
  };
})();</script>`;
  const artifactBridge = `<script>(() => {
  window.__localArtifactBridge = { ready: true, opens: 0, closes: 0 };
  const fiberOf = (element) => {
    const key = Object.keys(element).find((k) => k.startsWith("__reactFiber$"));
    return key ? element[key] : undefined;
  };
  const paneRegion = () =>
    document.querySelector('[role="region"][aria-label^="Artifact panel"]');
  const paneVisible = () => {
    const region = paneRegion();
    if (!region) return false;
    const rect = region.getBoundingClientRect();
    return rect.width > 40 && rect.height > 0;
  };
  const cardArtifactId = (button) => {
    let fiber = fiberOf(button);
    for (let depth = 0; fiber && depth < 80; depth += 1, fiber = fiber.return) {
      const properties = fiber.memoizedProps && fiber.memoizedProps.properties;
      if (properties && typeof properties.id === "string" && properties.id)
        return properties.id;
    }
    return null;
  };
  // The live chat tree provides two context values that together control the
  // artifact drawer: the chat-resource reducer (selection) and the drawer
  // context (expanded flag). Both are located from a live element because a
  // cached card element can hold handlers bound to an unmounted instance.
  const liveDrawerControls = (preferred) => {
    const controls = { dispatch: null, setExpanded: null };
    const roots = [
      preferred,
      document.querySelector(
        '[contenteditable="true"][aria-label="Write your prompt to Claude"]',
      ),
      paneRegion(),
      document.querySelector('button[aria-label="Close artifact"]'),
    ];
    for (const root of roots) {
      if (!root) continue;
      let fiber = fiberOf(root);
      for (let depth = 0; fiber && depth < 500; depth += 1, fiber = fiber.return) {
        const value = fiber.memoizedProps && fiber.memoizedProps.value;
        if (!value || typeof value !== "object") continue;
        if (!controls.dispatch && typeof value.dispatchChatResource === "function")
          controls.dispatch = value.dispatchChatResource;
        if (!controls.setExpanded && typeof value.setIsDrawerExpanded === "function")
          controls.setExpanded = value.setIsDrawerExpanded;
      }
      if (controls.dispatch && controls.setExpanded) break;
    }
    return controls;
  };
  // A card click on a cold-mounted chat can run a cached closure bound to a
  // replaced instance, so neither the selection nor the expanded flag gets
  // set. When the pane has not appeared shortly after a click, set both
  // through the live contexts — the same two writes the app's handler makes.
  const ensureOpen = (button) => {
    setTimeout(() => {
      if (paneVisible()) return;
      const artifactId = cardArtifactId(button);
      if (!artifactId) return;
      const { dispatch, setExpanded } = liveDrawerControls(button);
      if (!dispatch || !setExpanded) return;
      window.__localArtifactBridge.opens += 1;
      setExpanded(true);
      dispatch({ type: "SELECT_ARTIFACT", id: artifactId });
    }, 300);
  };
  const ensureClosed = () => {
    setTimeout(() => {
      if (!paneRegion() && !paneVisible()) return;
      const { dispatch, setExpanded } = liveDrawerControls(null);
      if (!dispatch) return;
      window.__localArtifactBridge.closes += 1;
      dispatch({ type: "CLEAR_SELECTED" });
      if (setExpanded) setExpanded(false);
    }, 300);
  };
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button[aria-label]");
      const label = (button && button.getAttribute("aria-label")) || "";
      if (label === "Close artifact") ensureClosed();
      else if (label.startsWith("View ") && label !== "View all" && button)
        ensureOpen(button);
    },
    true,
  );
  // When the route changes away from a chat, close any drawer the previous
  // route left open — unless the new route itself requests an artifact.
  let lastPath = location.pathname;
  const lifecycle = () => {
    window.__localArtifactBridge.ticks = (window.__localArtifactBridge.ticks || 0) + 1;
    const path = location.pathname;
    if (path === lastPath) return;
    const previous = lastPath;
    lastPath = path;
    window.__localArtifactBridge.pathChanges = (window.__localArtifactBridge.pathChanges || 0) + 1;
    // Only leaving an established chat closes its drawer; the /new to
    // /chat/<uuid> hop right after a conversation is created must not.
    if (!/^\\/chat\\/[0-9a-f-]{36}/i.test(previous)) return;
    if (new URLSearchParams(location.search).has("artifactId")) return;
    const close = document.querySelector(
      'button[aria-label="Close artifact"]',
    );
    if (!close) return;
    // The in-session close handler is reliable for a route the user just
    // left; the live-context dispatch reinforces it when the handler was a
    // cached closure.
    close.click();
    const { dispatch, setExpanded } = liveDrawerControls(close);
    if (dispatch) {
      dispatch({ type: "CLEAR_SELECTED" });
      if (setExpanded) setExpanded(false);
    }
  };
  let scheduled = false;
  const tick = () => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      lifecycle();
    }, 40);
  };
  const start = () => {
    new MutationObserver(tick).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    window.addEventListener("popstate", tick);
    tick();
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();</script>`;
  const indexHtml = (await readFile(indexPath, "utf8")).replace(
    "<head>",
    `<head>${visibilityGuard}${artifactBridge}${tunnelClipboard}`,
  );
  const csp = contentSecurityPolicy(inlineScriptHashes(indexHtml));
  const patchedAssets = await patchedClientAssets(
    absoluteRoot,
    indexHtml,
    LOCAL_CLIENT_PATCHES.filter((patch) => !DISABLED_PATCH_IDS.has(patch.id)),
  );
  protocol.handle("app", async (request) => {
    const url = new URL(request.url);
    if (url.hostname === "artifacts.local") {
      if (request.method !== "GET") return new Response(null, { status: 405 });
      return new Response(localArtifactRendererHtml(), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": [
            "default-src 'none'",
            "script-src 'unsafe-inline'",
            "style-src 'unsafe-inline'",
            "img-src data: blob: https:",
            "frame-src data: blob:",
            "connect-src 'none'",
            "object-src 'none'",
            "base-uri 'none'",
          ].join("; "),
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "no-store",
        },
      });
    }
    if (url.hostname !== "localhost")
      return new Response(null, { status: 404 });
    const origin = request.headers.get("Origin");
    if (origin && origin !== "app://localhost")
      return new Response(null, { status: 403 });

    if (url.pathname === "/api/local/tunnel/status")
      return new Response(
        JSON.stringify(tunnel?.status() ?? { url: null, active: false }),
        { headers: { "Content-Type": "application/json" } },
      );
    const apiResponse = await localApiResponse(
      request,
      url,
      backend,
      codeSessions,
    );
    if (apiResponse) {
      // Publishing spins up the public share tunnel; it tears down whenever
      // nothing remains published — explicit unpublish OR deleting a chat
      // that owned the published artifact (even when the request 404s
      // because the content is already gone).
      if (tunnel) {
        if (
          apiResponse.status < 400 &&
          request.method === "POST" &&
          /\/publish_artifact$/.test(url.pathname)
        )
          void tunnel.ensureStarted();
        else if (
          request.method === "DELETE" &&
          /\/(published_artifacts|chat_conversations)\//.test(url.pathname)
        )
          tunnel.stopIfIdle();
      }
      return apiResponse;
    }

    const requested = resolveInside(absoluteRoot, url.pathname);
    if (!requested) return new Response(null, { status: 403 });
    const candidate = (await regularFile(requested))
      ? requested
      : path.join(absoluteRoot, "index.html");
    const patchedAsset = patchedAssets.get(path.resolve(candidate));
    // Asset URLs keep the same version-hashed filenames across Open-Claude
    // releases while their patched contents change, so the renderer must
    // never revive them from its profile HTTP cache after an upgrade.
    if (patchedAsset) {
      return new Response(patchedAsset.source, {
        status: 200,
        headers: {
          "Content-Type": MIME_TYPES[".js"],
          "Content-Security-Policy": csp,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "X-Local-Claude-Patches": patchedAsset.ids.join(","),
        },
      });
    }
    if (path.resolve(candidate) === path.resolve(indexPath)) {
      return new Response(indexHtml, {
        status: 200,
        headers: {
          "Content-Type": MIME_TYPES[".html"],
          "Content-Security-Policy": csp,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const response = await net.fetch(pathToFileURL(candidate).href);
    const headers = new Headers(response.headers);
    const mime = MIME_TYPES[path.extname(candidate).toLowerCase()];
    if (mime) headers.set("Content-Type", mime);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Content-Security-Policy", csp);
    return new Response(response.body, { status: response.status, headers });
  });
}
