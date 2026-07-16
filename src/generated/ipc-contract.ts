// Generated from the locally installed Claude Desktop bundle.
// Re-run `npm run reference:generate` after `npm run reference:analyze`.

export type IpcMethodKind = "message" | "event" | "unknown";

export interface IpcMethodContract {
  readonly kind: IpcMethodKind;
  readonly method: string;
  readonly channel: string;
}

export interface IpcServiceContract {
  readonly namespace?: string;
  readonly service?: string;
  readonly methods: readonly IpcMethodContract[];
}

export const IPC_CHANNEL_COUNT = 831 as const;
export const IPC_SERVICE_COUNT = 71 as const;

export const IPC_SERVICES = {
  "claude.buddy.Buddy": {
    "namespace": "claude.buddy",
    "service": "Buddy",
    "methods": [
      {
        "kind": "message",
        "method": "cancelScan",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_cancelScan"
      },
      {
        "kind": "message",
        "method": "deviceStatus",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_deviceStatus"
      },
      {
        "kind": "message",
        "method": "forgetDevice",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_forgetDevice"
      },
      {
        "kind": "message",
        "method": "install",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_install"
      },
      {
        "kind": "message",
        "method": "pairDevice",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_pairDevice"
      },
      {
        "kind": "message",
        "method": "pairingPrompt",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_pairingPrompt"
      },
      {
        "kind": "message",
        "method": "pickDevice",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_pickDevice"
      },
      {
        "kind": "message",
        "method": "pickFolder",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_pickFolder"
      },
      {
        "kind": "message",
        "method": "preview",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_preview"
      },
      {
        "kind": "message",
        "method": "progress",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_progress"
      },
      {
        "kind": "message",
        "method": "scanDevices",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_scanDevices"
      },
      {
        "kind": "message",
        "method": "setName",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_setName"
      },
      {
        "kind": "message",
        "method": "status",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_status"
      },
      {
        "kind": "message",
        "method": "submitPin",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_submitPin"
      }
    ]
  },
  "claude.buddy.BuddyBleTransport": {
    "namespace": "claude.buddy",
    "service": "BuddyBleTransport",
    "methods": [
      {
        "kind": "message",
        "method": "log",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_BuddyBleTransport_$_log"
      },
      {
        "kind": "message",
        "method": "reportState",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_BuddyBleTransport_$_reportState"
      },
      {
        "kind": "message",
        "method": "rx",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_BuddyBleTransport_$_rx"
      },
      {
        "kind": "message",
        "method": "tx",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_BuddyBleTransport_$_tx"
      }
    ]
  },
  "claude.coworkArtifact.CoworkArtifactBridge": {
    "namespace": "claude.coworkArtifact",
    "service": "CoworkArtifactBridge",
    "methods": [
      {
        "kind": "message",
        "method": "askClaude",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.coworkArtifact_$_CoworkArtifactBridge_$_askClaude"
      },
      {
        "kind": "message",
        "method": "callMcpTool",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.coworkArtifact_$_CoworkArtifactBridge_$_callMcpTool"
      },
      {
        "kind": "message",
        "method": "navigateHost",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.coworkArtifact_$_CoworkArtifactBridge_$_navigateHost"
      },
      {
        "kind": "message",
        "method": "openExternalUrl",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.coworkArtifact_$_CoworkArtifactBridge_$_openExternalUrl"
      },
      {
        "kind": "message",
        "method": "runScheduledTask",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.coworkArtifact_$_CoworkArtifactBridge_$_runScheduledTask"
      }
    ]
  },
  "claude.hybrid.DesktopIntl": {
    "namespace": "claude.hybrid",
    "service": "DesktopIntl",
    "methods": [
      {
        "kind": "message",
        "method": "getInitialLocale",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.hybrid_$_DesktopIntl_$_getInitialLocale"
      },
      {
        "kind": "message",
        "method": "localeChanged",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.hybrid_$_DesktopIntl_$_localeChanged"
      },
      {
        "kind": "message",
        "method": "requestLocaleChange",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.hybrid_$_DesktopIntl_$_requestLocaleChange"
      }
    ]
  },
  "claude.internal.findInPage.FindInPage": {
    "namespace": "claude.internal.findInPage",
    "service": "FindInPage",
    "methods": [
      {
        "kind": "message",
        "method": "blurInput",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.findInPage_$_FindInPage_$_blurInput"
      },
      {
        "kind": "message",
        "method": "endFindSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.findInPage_$_FindInPage_$_endFindSession"
      },
      {
        "kind": "message",
        "method": "findInPage",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.findInPage_$_FindInPage_$_findInPage"
      },
      {
        "kind": "message",
        "method": "focusInput",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.findInPage_$_FindInPage_$_focusInput"
      },
      {
        "kind": "message",
        "method": "stepToMatch",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.findInPage_$_FindInPage_$_stepToMatch"
      },
      {
        "kind": "message",
        "method": "stopFindInPage",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.findInPage_$_FindInPage_$_stopFindInPage"
      }
    ]
  },
  "claude.internal.ui.AboutWindow": {
    "namespace": "claude.internal.ui",
    "service": "AboutWindow",
    "methods": [
      {
        "kind": "message",
        "method": "getAppName",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_AboutWindow_$_getAppName"
      },
      {
        "kind": "message",
        "method": "getBuildProps",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_AboutWindow_$_getBuildProps"
      },
      {
        "kind": "message",
        "method": "getSupport",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_AboutWindow_$_getSupport"
      },
      {
        "kind": "message",
        "method": "openHelp",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_AboutWindow_$_openHelp"
      }
    ]
  },
  "claude.internal.ui.MainWindowTitleBar": {
    "namespace": "claude.internal.ui",
    "service": "MainWindowTitleBar",
    "methods": [
      {
        "kind": "message",
        "method": "hideLoadError",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_MainWindowTitleBar_$_hideLoadError"
      },
      {
        "kind": "message",
        "method": "isClaudeCurrentlyHealthy",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_MainWindowTitleBar_$_isClaudeCurrentlyHealthy"
      },
      {
        "kind": "message",
        "method": "requestMainMenuPopup",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_MainWindowTitleBar_$_requestMainMenuPopup"
      },
      {
        "kind": "message",
        "method": "requestReloadMainView",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_MainWindowTitleBar_$_requestReloadMainView"
      },
      {
        "kind": "message",
        "method": "showLoadError",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_MainWindowTitleBar_$_showLoadError"
      },
      {
        "kind": "message",
        "method": "titleBarReady",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_MainWindowTitleBar_$_titleBarReady"
      },
      {
        "kind": "message",
        "method": "updateTitleBar",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_MainWindowTitleBar_$_updateTitleBar"
      }
    ]
  },
  "claude.internal.ui.QuickWindow": {
    "namespace": "claude.internal.ui",
    "service": "QuickWindow",
    "methods": [
      {
        "kind": "message",
        "method": "requestDismiss",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_QuickWindow_$_requestDismiss"
      },
      {
        "kind": "message",
        "method": "requestDismissWithPayload",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_QuickWindow_$_requestDismissWithPayload"
      },
      {
        "kind": "message",
        "method": "requestSkooch",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_QuickWindow_$_requestSkooch"
      }
    ]
  },
  "claude.officeAddin.OfficeAddinFiles": {
    "namespace": "claude.officeAddin",
    "service": "OfficeAddinFiles",
    "methods": [
      {
        "kind": "message",
        "method": "connectedFilesState_$store$_getState",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_connectedFilesState_$store$_getState"
      },
      {
        "kind": "message",
        "method": "connectedFilesState_$store$_getStateSync",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_connectedFilesState_$store$_getStateSync"
      },
      {
        "kind": "message",
        "method": "connectedFilesState_$store$_update",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_connectedFilesState_$store$_update"
      },
      {
        "kind": "message",
        "method": "focusFile",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_focusFile"
      },
      {
        "kind": "message",
        "method": "getConnectedFiles",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_getConnectedFiles"
      },
      {
        "kind": "message",
        "method": "isFeatureEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_isFeatureEnabled"
      },
      {
        "kind": "message",
        "method": "onAddinNeedsContext",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_onAddinNeedsContext"
      },
      {
        "kind": "message",
        "method": "onFileAdded",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_onFileAdded"
      },
      {
        "kind": "message",
        "method": "onFileRemoved",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_onFileRemoved"
      },
      {
        "kind": "message",
        "method": "onFileStateChanged",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_onFileStateChanged"
      },
      {
        "kind": "message",
        "method": "selectFile",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_selectFile"
      },
      {
        "kind": "message",
        "method": "updateActiveConversationSummary",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_updateActiveConversationSummary"
      }
    ]
  },
  "claude.settings.AppConfig": {
    "namespace": "claude.settings",
    "service": "AppConfig",
    "methods": [
      {
        "kind": "message",
        "method": "getAppConfig",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_AppConfig_$_getAppConfig"
      },
      {
        "kind": "message",
        "method": "setAppFeature",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_AppConfig_$_setAppFeature"
      },
      {
        "kind": "message",
        "method": "setIsDxtAutoUpdatesEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_AppConfig_$_setIsDxtAutoUpdatesEnabled"
      },
      {
        "kind": "message",
        "method": "setIsUsingBuiltInNodeForMcp",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_AppConfig_$_setIsUsingBuiltInNodeForMcp"
      }
    ]
  },
  "claude.settings.AppFeatures": {
    "namespace": "claude.settings",
    "service": "AppFeatures",
    "methods": [
      {
        "kind": "message",
        "method": "getSupportedFeatures",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_AppFeatures_$_getSupportedFeatures"
      }
    ]
  },
  "claude.settings.AppPreferences": {
    "namespace": "claude.settings",
    "service": "AppPreferences",
    "methods": [
      {
        "kind": "message",
        "method": "getPreferences",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_AppPreferences_$_getPreferences"
      },
      {
        "kind": "message",
        "method": "preferencesChanged",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_AppPreferences_$_preferencesChanged"
      },
      {
        "kind": "message",
        "method": "setPreference",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_AppPreferences_$_setPreference"
      }
    ]
  },
  "claude.settings.CcdCli": {
    "namespace": "claude.settings",
    "service": "CcdCli",
    "methods": [
      {
        "kind": "message",
        "method": "getCcdCliStatus",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_CcdCli_$_getCcdCliStatus"
      },
      {
        "kind": "message",
        "method": "installCcdCli",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_CcdCli_$_installCcdCli"
      },
      {
        "kind": "message",
        "method": "uninstallCcdCli",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_CcdCli_$_uninstallCcdCli"
      }
    ]
  },
  "claude.settings.ClaudeAiImport": {
    "namespace": "claude.settings",
    "service": "ClaudeAiImport",
    "methods": [
      {
        "kind": "message",
        "method": "clearAuth",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_ClaudeAiImport_$_clearAuth"
      },
      {
        "kind": "message",
        "method": "getAuthState",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_ClaudeAiImport_$_getAuthState"
      },
      {
        "kind": "message",
        "method": "isAvailable",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_ClaudeAiImport_$_isAvailable"
      },
      {
        "kind": "message",
        "method": "onAuthStateChange",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_ClaudeAiImport_$_onAuthStateChange"
      },
      {
        "kind": "message",
        "method": "onAuthUserCode",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_ClaudeAiImport_$_onAuthUserCode"
      },
      {
        "kind": "message",
        "method": "reopenAuthTab",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_ClaudeAiImport_$_reopenAuthTab"
      },
      {
        "kind": "message",
        "method": "runImport",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_ClaudeAiImport_$_runImport"
      },
      {
        "kind": "message",
        "method": "startAuth",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_ClaudeAiImport_$_startAuth"
      }
    ]
  },
  "claude.settings.Custom3pHelperRun": {
    "namespace": "claude.settings",
    "service": "Custom3pHelperRun",
    "methods": [
      {
        "kind": "message",
        "method": "discoverModels",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pHelperRun_$_discoverModels"
      },
      {
        "kind": "message",
        "method": "probeDeviceCode",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pHelperRun_$_probeDeviceCode"
      },
      {
        "kind": "message",
        "method": "probeInference",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pHelperRun_$_probeInference"
      },
      {
        "kind": "message",
        "method": "runCredentialHelper",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pHelperRun_$_runCredentialHelper"
      }
    ]
  },
  "claude.settings.Custom3pSetup": {
    "namespace": "claude.settings",
    "service": "Custom3pSetup",
    "methods": [
      {
        "kind": "message",
        "method": "applyAnthropicApiShortcut",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_applyAnthropicApiShortcut"
      },
      {
        "kind": "message",
        "method": "authorizeAndProbeMcpServer",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_authorizeAndProbeMcpServer"
      },
      {
        "kind": "message",
        "method": "bootstrapState_$store$_getState",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_bootstrapState_$store$_getState"
      },
      {
        "kind": "message",
        "method": "bootstrapState_$store$_getStateSync",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_bootstrapState_$store$_getStateSync"
      },
      {
        "kind": "message",
        "method": "bootstrapState_$store$_update",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_bootstrapState_$store$_update"
      },
      {
        "kind": "message",
        "method": "createConfig",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_createConfig"
      },
      {
        "kind": "message",
        "method": "deleteConfig",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_deleteConfig"
      },
      {
        "kind": "message",
        "method": "duplicateConfig",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_duplicateConfig"
      },
      {
        "kind": "message",
        "method": "exportConfig",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_exportConfig"
      },
      {
        "kind": "message",
        "method": "forgetMcpOAuth",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_forgetMcpOAuth"
      },
      {
        "kind": "message",
        "method": "getConfigHealth",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_getConfigHealth"
      },
      {
        "kind": "message",
        "method": "getLoginDesktop3pStatus",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_getLoginDesktop3pStatus"
      },
      {
        "kind": "message",
        "method": "listConfigs",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_listConfigs"
      },
      {
        "kind": "message",
        "method": "openDeviceCodeWindowForE2e",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_openDeviceCodeWindowForE2e"
      },
      {
        "kind": "message",
        "method": "openSetupWindow",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_openSetupWindow"
      },
      {
        "kind": "message",
        "method": "probeEgressHosts",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_probeEgressHosts"
      },
      {
        "kind": "message",
        "method": "probeMcpServer",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_probeMcpServer"
      },
      {
        "kind": "message",
        "method": "readConfig",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_readConfig"
      },
      {
        "kind": "message",
        "method": "recheckConfigHealth",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_recheckConfigHealth"
      },
      {
        "kind": "message",
        "method": "relaunchApp",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_relaunchApp"
      },
      {
        "kind": "message",
        "method": "renameConfig",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_renameConfig"
      },
      {
        "kind": "message",
        "method": "revealConfig",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_revealConfig"
      },
      {
        "kind": "message",
        "method": "scanOrgPlugins",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_scanOrgPlugins"
      },
      {
        "kind": "message",
        "method": "setAppliedConfig",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_setAppliedConfig"
      },
      {
        "kind": "message",
        "method": "setDeploymentMode",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_setDeploymentMode"
      },
      {
        "kind": "message",
        "method": "signInWithAnthropicApi",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_signInWithAnthropicApi"
      },
      {
        "kind": "message",
        "method": "triggerBootstrapAuth",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_triggerBootstrapAuth"
      },
      {
        "kind": "message",
        "method": "writeConfig",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_writeConfig"
      }
    ]
  },
  "claude.settings.DesktopInfo": {
    "namespace": "claude.settings",
    "service": "DesktopInfo",
    "methods": [
      {
        "kind": "message",
        "method": "getSystemInfo",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_DesktopInfo_$_getSystemInfo"
      },
      {
        "kind": "message",
        "method": "showLogsInFileManager",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_DesktopInfo_$_showLogsInFileManager"
      }
    ]
  },
  "claude.settings.Extensions": {
    "namespace": "claude.settings",
    "service": "Extensions",
    "methods": [
      {
        "kind": "message",
        "method": "deleteExtension",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_deleteExtension"
      },
      {
        "kind": "message",
        "method": "extensionDownloadProgress",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_extensionDownloadProgress"
      },
      {
        "kind": "message",
        "method": "extensionsChanged",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_extensionsChanged"
      },
      {
        "kind": "message",
        "method": "extensionSettingsChanged",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_extensionSettingsChanged"
      },
      {
        "kind": "message",
        "method": "getAvailableExtensionRuntimes",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_getAvailableExtensionRuntimes"
      },
      {
        "kind": "message",
        "method": "getDirectoryUrl",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_getDirectoryUrl"
      },
      {
        "kind": "message",
        "method": "getExtension",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_getExtension"
      },
      {
        "kind": "message",
        "method": "getExtensions",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_getExtensions"
      },
      {
        "kind": "message",
        "method": "getExtensionSettings",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_getExtensionSettings"
      },
      {
        "kind": "message",
        "method": "getExtensionVersion",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_getExtensionVersion"
      },
      {
        "kind": "message",
        "method": "getExtensionVersions",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_getExtensionVersions"
      },
      {
        "kind": "message",
        "method": "getInstalledExtensionsWithState",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_getInstalledExtensionsWithState"
      },
      {
        "kind": "message",
        "method": "getIsUpdateAvailable",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_getIsUpdateAvailable"
      },
      {
        "kind": "message",
        "method": "getManifestCompatibilityResult",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_getManifestCompatibilityResult"
      },
      {
        "kind": "message",
        "method": "handleDxtFile",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_handleDxtFile"
      },
      {
        "kind": "message",
        "method": "installDxt",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_installDxt"
      },
      {
        "kind": "message",
        "method": "installDxtFromDirectory",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_installDxtFromDirectory"
      },
      {
        "kind": "message",
        "method": "installDxtUnpacked",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_installDxtUnpacked"
      },
      {
        "kind": "message",
        "method": "installExtensionFromPreview",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_installExtensionFromPreview"
      },
      {
        "kind": "message",
        "method": "isDesktopExtensionDirectoryEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_isDesktopExtensionDirectoryEnabled"
      },
      {
        "kind": "message",
        "method": "isDesktopExtensionSignatureRequired",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_isDesktopExtensionSignatureRequired"
      },
      {
        "kind": "message",
        "method": "isDirectoryEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_isDirectoryEnabled"
      },
      {
        "kind": "message",
        "method": "isExtensionsEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_isExtensionsEnabled"
      },
      {
        "kind": "message",
        "method": "isLocalExtensionInstallAllowed",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_isLocalExtensionInstallAllowed"
      },
      {
        "kind": "message",
        "method": "openExtensionSettingsFolder",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_openExtensionSettingsFolder"
      },
      {
        "kind": "message",
        "method": "openExtensionsFolder",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_openExtensionsFolder"
      },
      {
        "kind": "message",
        "method": "previewExtensionInstallation",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_previewExtensionInstallation"
      },
      {
        "kind": "message",
        "method": "refreshAllowlistCheck",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_refreshAllowlistCheck"
      },
      {
        "kind": "message",
        "method": "setExtensionSettings",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_setExtensionSettings"
      },
      {
        "kind": "message",
        "method": "showExtensionInFolder",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_showExtensionInFolder"
      },
      {
        "kind": "message",
        "method": "showInstallDxtDialog",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_showInstallDxtDialog"
      }
    ]
  },
  "claude.settings.FilePickers": {
    "namespace": "claude.settings",
    "service": "FilePickers",
    "methods": [
      {
        "kind": "message",
        "method": "getDirectoryPath",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_FilePickers_$_getDirectoryPath"
      },
      {
        "kind": "message",
        "method": "getFilePath",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_FilePickers_$_getFilePath"
      }
    ]
  },
  "claude.settings.GlobalShortcut": {
    "namespace": "claude.settings",
    "service": "GlobalShortcut",
    "methods": [
      {
        "kind": "message",
        "method": "getGlobalShortcut",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_GlobalShortcut_$_getGlobalShortcut"
      },
      {
        "kind": "message",
        "method": "globalShortcutChange",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_GlobalShortcut_$_globalShortcutChange"
      },
      {
        "kind": "message",
        "method": "setGlobalShortcut",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_GlobalShortcut_$_setGlobalShortcut"
      }
    ]
  },
  "claude.settings.MCP": {
    "namespace": "claude.settings",
    "service": "MCP",
    "methods": [
      {
        "kind": "message",
        "method": "getMcpServersConfig",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_MCP_$_getMcpServersConfig"
      },
      {
        "kind": "message",
        "method": "getMcpServersConfigWithStatus",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_MCP_$_getMcpServersConfigWithStatus"
      },
      {
        "kind": "message",
        "method": "isLocalDevMcpEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_MCP_$_isLocalDevMcpEnabled"
      },
      {
        "kind": "message",
        "method": "mcpConfigChange",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_MCP_$_mcpConfigChange"
      },
      {
        "kind": "message",
        "method": "mcpStatusChanged",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_MCP_$_mcpStatusChanged"
      },
      {
        "kind": "message",
        "method": "revealConfig",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_MCP_$_revealConfig"
      },
      {
        "kind": "message",
        "method": "revealLogs",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_MCP_$_revealLogs"
      },
      {
        "kind": "message",
        "method": "revealMcpServerSettingsRequested",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_MCP_$_revealMcpServerSettingsRequested"
      },
      {
        "kind": "message",
        "method": "revealServerLog",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_MCP_$_revealServerLog"
      },
      {
        "kind": "message",
        "method": "setMcpServerConfigs",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_MCP_$_setMcpServerConfigs"
      }
    ]
  },
  "claude.settings.Startup": {
    "namespace": "claude.settings",
    "service": "Startup",
    "methods": [
      {
        "kind": "message",
        "method": "isMenuBarEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Startup_$_isMenuBarEnabled"
      },
      {
        "kind": "message",
        "method": "isStartupOnLoginEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Startup_$_isStartupOnLoginEnabled"
      },
      {
        "kind": "message",
        "method": "setMenuBarEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Startup_$_setMenuBarEnabled"
      },
      {
        "kind": "message",
        "method": "setStartupOnLoginEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Startup_$_setStartupOnLoginEnabled"
      }
    ]
  },
  "claude.settings.SupportBundle": {
    "namespace": "claude.settings",
    "service": "SupportBundle",
    "methods": [
      {
        "kind": "message",
        "method": "submitAction",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_SupportBundle_$_submitAction"
      },
      {
        "kind": "message",
        "method": "supportBundleState_$store$_getState",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_SupportBundle_$_supportBundleState_$store$_getState"
      },
      {
        "kind": "message",
        "method": "supportBundleState_$store$_getStateSync",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_SupportBundle_$_supportBundleState_$store$_getStateSync"
      },
      {
        "kind": "message",
        "method": "supportBundleState_$store$_update",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_SupportBundle_$_supportBundleState_$store$_update"
      }
    ]
  },
  "claude.settings.WakeScheduler": {
    "namespace": "claude.settings",
    "service": "WakeScheduler",
    "methods": [
      {
        "kind": "message",
        "method": "getStatus",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_WakeScheduler_$_getStatus"
      },
      {
        "kind": "message",
        "method": "openSettings",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_WakeScheduler_$_openSettings"
      }
    ]
  },
  "claude.simulator.Simulator": {
    "namespace": "claude.simulator",
    "service": "Simulator",
    "methods": [
      {
        "kind": "message",
        "method": "attach",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_attach"
      },
      {
        "kind": "message",
        "method": "attachment_$store$_getState",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_attachment_$store$_getState"
      },
      {
        "kind": "message",
        "method": "attachment_$store$_getStateSync",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_attachment_$store$_getStateSync"
      },
      {
        "kind": "message",
        "method": "attachment_$store$_update",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_attachment_$store$_update"
      },
      {
        "kind": "message",
        "method": "detach",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_detach"
      },
      {
        "kind": "message",
        "method": "gesture",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_gesture"
      },
      {
        "kind": "message",
        "method": "installAndLaunch",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_installAndLaunch"
      },
      {
        "kind": "message",
        "method": "listDevices",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_listDevices"
      },
      {
        "kind": "message",
        "method": "saveScreenshot",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_saveScreenshot"
      },
      {
        "kind": "message",
        "method": "startRecording",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_startRecording"
      },
      {
        "kind": "message",
        "method": "stopRecording",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_stopRecording"
      }
    ]
  },
  "claude.skills.Skills": {
    "namespace": "claude.skills",
    "service": "Skills",
    "methods": [
      {
        "kind": "message",
        "method": "previewSkillFile",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.skills_$_Skills_$_previewSkillFile"
      }
    ]
  },
  "claude.web.Account": {
    "namespace": "claude.web",
    "service": "Account",
    "methods": [
      {
        "kind": "message",
        "method": "setAccountDetails",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Account_$_setAccountDetails"
      }
    ]
  },
  "claude.web.AgentModeFeedback": {
    "namespace": "claude.web",
    "service": "AgentModeFeedback",
    "methods": [
      {
        "kind": "message",
        "method": "openFeedbackAndConfirmReinstall",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AgentModeFeedback_$_openFeedbackAndConfirmReinstall"
      },
      {
        "kind": "message",
        "method": "openFeedbackWindow",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AgentModeFeedback_$_openFeedbackWindow"
      },
      {
        "kind": "message",
        "method": "reportErrorToSlack",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AgentModeFeedback_$_reportErrorToSlack"
      }
    ]
  },
  "claude.web.Auth": {
    "namespace": "claude.web",
    "service": "Auth",
    "methods": [
      {
        "kind": "message",
        "method": "doAuthInBrowser",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Auth_$_doAuthInBrowser"
      }
    ]
  },
  "claude.web.AutoUpdater": {
    "namespace": "claude.web",
    "service": "AutoUpdater",
    "methods": [
      {
        "kind": "message",
        "method": "cancelPendingRestart",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AutoUpdater_$_cancelPendingRestart"
      },
      {
        "kind": "message",
        "method": "checkForUpdates",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AutoUpdater_$_checkForUpdates"
      },
      {
        "kind": "message",
        "method": "getRunningLocalSessionCount",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AutoUpdater_$_getRunningLocalSessionCount"
      },
      {
        "kind": "message",
        "method": "getRunningLocalSessions",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AutoUpdater_$_getRunningLocalSessions"
      },
      {
        "kind": "message",
        "method": "restartToUpdate",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AutoUpdater_$_restartToUpdate"
      },
      {
        "kind": "message",
        "method": "restartToUpdateWhenIdle",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AutoUpdater_$_restartToUpdateWhenIdle"
      },
      {
        "kind": "message",
        "method": "updaterState_$store$_getState",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AutoUpdater_$_updaterState_$store$_getState"
      },
      {
        "kind": "message",
        "method": "updaterState_$store$_getStateSync",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AutoUpdater_$_updaterState_$store$_getStateSync"
      },
      {
        "kind": "message",
        "method": "updaterState_$store$_update",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AutoUpdater_$_updaterState_$store$_update"
      }
    ]
  },
  "claude.web.BrowserNavigation": {
    "namespace": "claude.web",
    "service": "BrowserNavigation",
    "methods": [
      {
        "kind": "message",
        "method": "goBack",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_BrowserNavigation_$_goBack"
      },
      {
        "kind": "message",
        "method": "goForward",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_BrowserNavigation_$_goForward"
      },
      {
        "kind": "message",
        "method": "navigationState_$store$_getState",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_BrowserNavigation_$_navigationState_$store$_getState"
      },
      {
        "kind": "message",
        "method": "navigationState_$store$_getStateSync",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_BrowserNavigation_$_navigationState_$store$_getStateSync"
      },
      {
        "kind": "message",
        "method": "navigationState_$store$_update",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_BrowserNavigation_$_navigationState_$store$_update"
      },
      {
        "kind": "message",
        "method": "reportNavigationState",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_BrowserNavigation_$_reportNavigationState"
      },
      {
        "kind": "message",
        "method": "requestMainMenuPopup",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_BrowserNavigation_$_requestMainMenuPopup"
      }
    ]
  },
  "claude.web.BuddyRemoteFeed": {
    "namespace": "claude.web",
    "service": "BuddyRemoteFeed",
    "methods": [
      {
        "kind": "message",
        "method": "permissionDecision",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_BuddyRemoteFeed_$_permissionDecision"
      },
      {
        "kind": "message",
        "method": "sync",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_BuddyRemoteFeed_$_sync"
      }
    ]
  },
  "claude.web.CCDScheduledTasks": {
    "namespace": "claude.web",
    "service": "CCDScheduledTasks",
    "methods": [
      {
        "kind": "message",
        "method": "createScheduledTask",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CCDScheduledTasks_$_createScheduledTask"
      },
      {
        "kind": "message",
        "method": "getAllScheduledTasks",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CCDScheduledTasks_$_getAllScheduledTasks"
      },
      {
        "kind": "message",
        "method": "getScheduledTaskFileContent",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CCDScheduledTasks_$_getScheduledTaskFileContent"
      },
      {
        "kind": "message",
        "method": "getWatcherHistory",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CCDScheduledTasks_$_getWatcherHistory"
      },
      {
        "kind": "message",
        "method": "markListenerReady",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CCDScheduledTasks_$_markListenerReady"
      },
      {
        "kind": "message",
        "method": "onScheduledTaskEvent",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CCDScheduledTasks_$_onScheduledTaskEvent"
      },
      {
        "kind": "message",
        "method": "removeApprovedPermission",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CCDScheduledTasks_$_removeApprovedPermission"
      },
      {
        "kind": "message",
        "method": "updateScheduledTask",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CCDScheduledTasks_$_updateScheduledTask"
      },
      {
        "kind": "message",
        "method": "updateScheduledTaskFileContent",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CCDScheduledTasks_$_updateScheduledTaskFileContent"
      },
      {
        "kind": "message",
        "method": "updateScheduledTaskStatus",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CCDScheduledTasks_$_updateScheduledTaskStatus"
      }
    ]
  },
  "claude.web.ChromeExtension": {
    "namespace": "claude.web",
    "service": "ChromeExtension",
    "methods": [
      {
        "kind": "message",
        "method": "installExtension",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ChromeExtension_$_installExtension"
      },
      {
        "kind": "message",
        "method": "isInstalled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ChromeExtension_$_isInstalled"
      },
      {
        "kind": "message",
        "method": "restartChrome",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ChromeExtension_$_restartChrome"
      }
    ]
  },
  "claude.web.ClaudeCode": {
    "namespace": "claude.web",
    "service": "ClaudeCode",
    "methods": [
      {
        "kind": "message",
        "method": "checkGitAvailable",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeCode_$_checkGitAvailable"
      },
      {
        "kind": "message",
        "method": "getPeriodUsage",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeCode_$_getPeriodUsage"
      },
      {
        "kind": "message",
        "method": "getStatus",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeCode_$_getStatus"
      },
      {
        "kind": "message",
        "method": "patchUserSettings",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeCode_$_patchUserSettings"
      },
      {
        "kind": "message",
        "method": "prepare",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeCode_$_prepare"
      },
      {
        "kind": "message",
        "method": "resolveLocalSettings",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeCode_$_resolveLocalSettings"
      },
      {
        "kind": "message",
        "method": "setEnableWorkflows",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeCode_$_setEnableWorkflows"
      }
    ]
  },
  "claude.web.ClaudeVM": {
    "namespace": "claude.web",
    "service": "ClaudeVM",
    "methods": [
      {
        "kind": "message",
        "method": "apiReachability_$store$_getState",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_apiReachability_$store$_getState"
      },
      {
        "kind": "message",
        "method": "apiReachability_$store$_getStateSync",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_apiReachability_$store$_getStateSync"
      },
      {
        "kind": "message",
        "method": "apiReachability_$store$_update",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_apiReachability_$store$_update"
      },
      {
        "kind": "message",
        "method": "checkVirtualMachinePlatform",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_checkVirtualMachinePlatform"
      },
      {
        "kind": "message",
        "method": "deleteAndReinstall",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_deleteAndReinstall"
      },
      {
        "kind": "message",
        "method": "download",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_download"
      },
      {
        "kind": "message",
        "method": "downloadProgress",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_downloadProgress"
      },
      {
        "kind": "message",
        "method": "downloadStatusChanged",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_downloadStatusChanged"
      },
      {
        "kind": "message",
        "method": "enableVirtualMachinePlatform",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_enableVirtualMachinePlatform"
      },
      {
        "kind": "message",
        "method": "getDownloadStatus",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_getDownloadStatus"
      },
      {
        "kind": "message",
        "method": "getRunningStatus",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_getRunningStatus"
      },
      {
        "kind": "message",
        "method": "isHostLoopDevOverrideActive",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_isHostLoopDevOverrideActive"
      },
      {
        "kind": "message",
        "method": "isHostLoopModeEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_isHostLoopModeEnabled"
      },
      {
        "kind": "message",
        "method": "restartAfterVMPInstall",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_restartAfterVMPInstall"
      },
      {
        "kind": "message",
        "method": "runningStatusChanged",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_runningStatusChanged"
      },
      {
        "kind": "message",
        "method": "setForceDisableHostLoop",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_setForceDisableHostLoop"
      },
      {
        "kind": "message",
        "method": "setYukonSilverConfig",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_setYukonSilverConfig"
      },
      {
        "kind": "message",
        "method": "startupError",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_startupError"
      },
      {
        "kind": "message",
        "method": "startVM",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_startVM"
      }
    ]
  },
  "claude.web.ComputerUseTcc": {
    "namespace": "claude.web",
    "service": "ComputerUseTcc",
    "methods": [
      {
        "kind": "message",
        "method": "getCurrentSessionGrants",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ComputerUseTcc_$_getCurrentSessionGrants"
      },
      {
        "kind": "message",
        "method": "getState",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ComputerUseTcc_$_getState"
      },
      {
        "kind": "message",
        "method": "listInstalledApps",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ComputerUseTcc_$_listInstalledApps"
      },
      {
        "kind": "message",
        "method": "openSystemSettings",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ComputerUseTcc_$_openSystemSettings"
      },
      {
        "kind": "message",
        "method": "requestAccessibility",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ComputerUseTcc_$_requestAccessibility"
      },
      {
        "kind": "message",
        "method": "requestScreenRecording",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ComputerUseTcc_$_requestScreenRecording"
      },
      {
        "kind": "message",
        "method": "revokeGrant",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ComputerUseTcc_$_revokeGrant"
      }
    ]
  },
  "claude.web.CoworkArtifacts": {
    "namespace": "claude.web",
    "service": "CoworkArtifacts",
    "methods": [
      {
        "kind": "message",
        "method": "deleteArtifact",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_deleteArtifact"
      },
      {
        "kind": "message",
        "method": "getAllArtifacts",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_getAllArtifacts"
      },
      {
        "kind": "message",
        "method": "getArtifactIndexHtmlPath",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_getArtifactIndexHtmlPath"
      },
      {
        "kind": "message",
        "method": "getArtifactMetadata",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_getArtifactMetadata"
      },
      {
        "kind": "message",
        "method": "getArtifactThumbnail",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_getArtifactThumbnail"
      },
      {
        "kind": "message",
        "method": "hideArtifact",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_hideArtifact"
      },
      {
        "kind": "message",
        "method": "importArtifact",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_importArtifact"
      },
      {
        "kind": "message",
        "method": "isAutoPublishEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_isAutoPublishEnabled"
      },
      {
        "kind": "message",
        "method": "isSharingEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_isSharingEnabled"
      },
      {
        "kind": "message",
        "method": "onArtifactsChanged",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_onArtifactsChanged"
      },
      {
        "kind": "message",
        "method": "parkAndCaptureArtifact",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_parkAndCaptureArtifact"
      },
      {
        "kind": "message",
        "method": "printArtifactToPdf",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_printArtifactToPdf"
      },
      {
        "kind": "message",
        "method": "refreshImportedArtifact",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_refreshImportedArtifact"
      },
      {
        "kind": "message",
        "method": "reloadArtifactView",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_reloadArtifactView"
      },
      {
        "kind": "message",
        "method": "restoreArtifactVersion",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_restoreArtifactVersion"
      },
      {
        "kind": "message",
        "method": "setArtifactAutoPublish",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_setArtifactAutoPublish"
      },
      {
        "kind": "message",
        "method": "setArtifactLastModifiedSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_setArtifactLastModifiedSession"
      },
      {
        "kind": "message",
        "method": "setArtifactMcpTools",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_setArtifactMcpTools"
      },
      {
        "kind": "message",
        "method": "setArtifactStarred",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_setArtifactStarred"
      },
      {
        "kind": "message",
        "method": "shareArtifact",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_shareArtifact"
      },
      {
        "kind": "message",
        "method": "showArtifact",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_showArtifact"
      },
      {
        "kind": "message",
        "method": "unshareArtifact",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_unshareArtifact"
      }
    ]
  },
  "claude.web.CoworkFeedback": {
    "namespace": "claude.web",
    "service": "CoworkFeedback",
    "methods": [
      {
        "kind": "message",
        "method": "captureScreenshot",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFeedback_$_captureScreenshot"
      },
      {
        "kind": "message",
        "method": "discardScreenshot",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFeedback_$_discardScreenshot"
      },
      {
        "kind": "message",
        "method": "getScreenshotDataUrl",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFeedback_$_getScreenshotDataUrl"
      },
      {
        "kind": "message",
        "method": "getSystemInfo",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFeedback_$_getSystemInfo"
      },
      {
        "kind": "message",
        "method": "submitFeedback",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFeedback_$_submitFeedback"
      }
    ]
  },
  "claude.web.CoworkFilePreview": {
    "namespace": "claude.web",
    "service": "CoworkFilePreview",
    "methods": [
      {
        "kind": "message",
        "method": "hide",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFilePreview_$_hide"
      },
      {
        "kind": "message",
        "method": "isEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFilePreview_$_isEnabled"
      },
      {
        "kind": "message",
        "method": "isEpitaxyPreviewEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFilePreview_$_isEpitaxyPreviewEnabled"
      },
      {
        "kind": "message",
        "method": "isOpenInDefaultAppEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFilePreview_$_isOpenInDefaultAppEnabled"
      },
      {
        "kind": "message",
        "method": "isVmReady",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFilePreview_$_isVmReady"
      },
      {
        "kind": "message",
        "method": "parkAndCapture",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFilePreview_$_parkAndCapture"
      },
      {
        "kind": "message",
        "method": "show",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFilePreview_$_show"
      }
    ]
  },
  "claude.web.CoworkMemory": {
    "namespace": "claude.web",
    "service": "CoworkMemory",
    "methods": [
      {
        "kind": "message",
        "method": "deleteAccountMemory",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkMemory_$_deleteAccountMemory"
      },
      {
        "kind": "message",
        "method": "listAccountMemories",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkMemory_$_listAccountMemories"
      },
      {
        "kind": "message",
        "method": "readAccountMemory",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkMemory_$_readAccountMemory"
      },
      {
        "kind": "message",
        "method": "readGlobalMemory",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkMemory_$_readGlobalMemory"
      },
      {
        "kind": "message",
        "method": "resetMemories",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkMemory_$_resetMemories"
      },
      {
        "kind": "message",
        "method": "writeAccountMemory",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkMemory_$_writeAccountMemory"
      },
      {
        "kind": "message",
        "method": "writeGlobalMemory",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkMemory_$_writeGlobalMemory"
      }
    ]
  },
  "claude.web.CoworkScheduledTasks": {
    "namespace": "claude.web",
    "service": "CoworkScheduledTasks",
    "methods": [
      {
        "kind": "message",
        "method": "clearChromePermissions",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_clearChromePermissions"
      },
      {
        "kind": "message",
        "method": "createScheduledTask",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_createScheduledTask"
      },
      {
        "kind": "message",
        "method": "getAllScheduledTasks",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_getAllScheduledTasks"
      },
      {
        "kind": "message",
        "method": "getScheduledTaskFileContent",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_getScheduledTaskFileContent"
      },
      {
        "kind": "message",
        "method": "getWatcherHistory",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_getWatcherHistory"
      },
      {
        "kind": "message",
        "method": "markListenerReady",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_markListenerReady"
      },
      {
        "kind": "message",
        "method": "onScheduledTaskEvent",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_onScheduledTaskEvent"
      },
      {
        "kind": "message",
        "method": "removeApprovedPermission",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_removeApprovedPermission"
      },
      {
        "kind": "message",
        "method": "updateScheduledTask",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_updateScheduledTask"
      },
      {
        "kind": "message",
        "method": "updateScheduledTaskFileContent",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_updateScheduledTaskFileContent"
      },
      {
        "kind": "message",
        "method": "updateScheduledTaskStatus",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_updateScheduledTaskStatus"
      }
    ]
  },
  "claude.web.CoworkSpaces": {
    "namespace": "claude.web",
    "service": "CoworkSpaces",
    "methods": [
      {
        "kind": "message",
        "method": "addFolderToSpace",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_addFolderToSpace"
      },
      {
        "kind": "message",
        "method": "addLinkToSpace",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_addLinkToSpace"
      },
      {
        "kind": "message",
        "method": "addProjectToSpace",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_addProjectToSpace"
      },
      {
        "kind": "message",
        "method": "appendRemoteSessionSpaceFolders",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_appendRemoteSessionSpaceFolders"
      },
      {
        "kind": "message",
        "method": "classifySessions",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_classifySessions"
      },
      {
        "kind": "message",
        "method": "copyFilesToSpaceFolder",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_copyFilesToSpaceFolder"
      },
      {
        "kind": "message",
        "method": "createSpace",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_createSpace"
      },
      {
        "kind": "message",
        "method": "createSpaceFolder",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_createSpaceFolder"
      },
      {
        "kind": "message",
        "method": "deleteSpace",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_deleteSpace"
      },
      {
        "kind": "message",
        "method": "getAllSpaces",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_getAllSpaces"
      },
      {
        "kind": "message",
        "method": "getAutoMemoryDir",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_getAutoMemoryDir"
      },
      {
        "kind": "message",
        "method": "getRemoteSessionSpaces",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_getRemoteSessionSpaces"
      },
      {
        "kind": "message",
        "method": "getSpace",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_getSpace"
      },
      {
        "kind": "message",
        "method": "listFolderContents",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_listFolderContents"
      },
      {
        "kind": "message",
        "method": "onSpaceEvent",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_onSpaceEvent"
      },
      {
        "kind": "message",
        "method": "openFile",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_openFile"
      },
      {
        "kind": "message",
        "method": "readFileContents",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_readFileContents"
      },
      {
        "kind": "message",
        "method": "readSpaceMemoryIndex",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_readSpaceMemoryIndex"
      },
      {
        "kind": "message",
        "method": "removeFolderFromSpace",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_removeFolderFromSpace"
      },
      {
        "kind": "message",
        "method": "removeLinkFromSpace",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_removeLinkFromSpace"
      },
      {
        "kind": "message",
        "method": "removeProjectFromSpace",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_removeProjectFromSpace"
      },
      {
        "kind": "message",
        "method": "removeRemoteSessionSpace",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_removeRemoteSessionSpace"
      },
      {
        "kind": "message",
        "method": "setAutoDescription",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_setAutoDescription"
      },
      {
        "kind": "message",
        "method": "setRemoteSessionSpace",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_setRemoteSessionSpace"
      },
      {
        "kind": "message",
        "method": "summarizeSpace",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_summarizeSpace"
      },
      {
        "kind": "message",
        "method": "updateSpace",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_updateSpace"
      }
    ]
  },
  "claude.web.CoworkUserFiles": {
    "namespace": "claude.web",
    "service": "CoworkUserFiles",
    "methods": [
      {
        "kind": "message",
        "method": "getInfo",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkUserFiles_$_getInfo"
      },
      {
        "kind": "message",
        "method": "migrate",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkUserFiles_$_migrate"
      },
      {
        "kind": "message",
        "method": "pickTarget",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkUserFiles_$_pickTarget"
      },
      {
        "kind": "message",
        "method": "reveal",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkUserFiles_$_reveal"
      }
    ]
  },
  "claude.web.CustomPlugins": {
    "namespace": "claude.web",
    "service": "CustomPlugins",
    "methods": [
      {
        "kind": "message",
        "method": "addMarketplace",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_addMarketplace"
      },
      {
        "kind": "message",
        "method": "checkPluginHasLocalChanges",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_checkPluginHasLocalChanges"
      },
      {
        "kind": "message",
        "method": "getAndClearMigrationIssues",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_getAndClearMigrationIssues"
      },
      {
        "kind": "message",
        "method": "getCachedCommands",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_getCachedCommands"
      },
      {
        "kind": "message",
        "method": "getInstallCounts",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_getInstallCounts"
      },
      {
        "kind": "message",
        "method": "installLocalOrgPlugin",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_installLocalOrgPlugin"
      },
      {
        "kind": "message",
        "method": "installPlugin",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_installPlugin"
      },
      {
        "kind": "message",
        "method": "installProgress",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_installProgress"
      },
      {
        "kind": "message",
        "method": "listAvailablePlugins",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_listAvailablePlugins"
      },
      {
        "kind": "message",
        "method": "listInstalledPlugins",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_listInstalledPlugins"
      },
      {
        "kind": "message",
        "method": "listLocalOrgPlugins",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_listLocalOrgPlugins"
      },
      {
        "kind": "message",
        "method": "listMarketplaces",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_listMarketplaces"
      },
      {
        "kind": "message",
        "method": "listRemotePluginsPage",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_listRemotePluginsPage"
      },
      {
        "kind": "message",
        "method": "refreshMarketplace",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_refreshMarketplace"
      },
      {
        "kind": "message",
        "method": "removeMarketplace",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_removeMarketplace"
      },
      {
        "kind": "message",
        "method": "syncLocalOrgPlugins",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_syncLocalOrgPlugins"
      },
      {
        "kind": "message",
        "method": "uninstallPlugin",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_uninstallPlugin"
      },
      {
        "kind": "message",
        "method": "updatePlugin",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_updatePlugin"
      }
    ]
  },
  "claude.web.DeepLink": {
    "namespace": "claude.web",
    "service": "DeepLink",
    "methods": [
      {
        "kind": "message",
        "method": "handleDeepLink",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DeepLink_$_handleDeepLink"
      }
    ]
  },
  "claude.web.DesktopNotifications": {
    "namespace": "claude.web",
    "service": "DesktopNotifications",
    "methods": [
      {
        "kind": "message",
        "method": "getAuthorizationStatus",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DesktopNotifications_$_getAuthorizationStatus"
      },
      {
        "kind": "message",
        "method": "onNotificationClicked",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DesktopNotifications_$_onNotificationClicked"
      },
      {
        "kind": "message",
        "method": "openNotificationSettings",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DesktopNotifications_$_openNotificationSettings"
      },
      {
        "kind": "message",
        "method": "requestAuthorization",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DesktopNotifications_$_requestAuthorization"
      },
      {
        "kind": "message",
        "method": "showNotification",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DesktopNotifications_$_showNotification"
      }
    ]
  },
  "claude.web.DeviceRegistry": {
    "namespace": "claude.web",
    "service": "DeviceRegistry",
    "methods": [
      {
        "kind": "message",
        "method": "getAvailability",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DeviceRegistry_$_getAvailability"
      },
      {
        "kind": "message",
        "method": "getLocalDeviceInfo",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DeviceRegistry_$_getLocalDeviceInfo"
      },
      {
        "kind": "message",
        "method": "getPublicKey",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DeviceRegistry_$_getPublicKey"
      },
      {
        "kind": "message",
        "method": "notifyRegistered",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DeviceRegistry_$_notifyRegistered"
      },
      {
        "kind": "message",
        "method": "setKeylessBridgeRowPk",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DeviceRegistry_$_setKeylessBridgeRowPk"
      },
      {
        "kind": "message",
        "method": "signAttestationPreimage",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DeviceRegistry_$_signAttestationPreimage"
      },
      {
        "kind": "message",
        "method": "signCreateSessionBind",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DeviceRegistry_$_signCreateSessionBind"
      },
      {
        "kind": "message",
        "method": "signForSessionHeader",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DeviceRegistry_$_signForSessionHeader"
      },
      {
        "kind": "message",
        "method": "signTriggerOp",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DeviceRegistry_$_signTriggerOp"
      }
    ]
  },
  "claude.web.DocumentFunnel": {
    "namespace": "claude.web",
    "service": "DocumentFunnel",
    "methods": [
      {
        "kind": "message",
        "method": "ensureScratchRoot",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DocumentFunnel_$_ensureScratchRoot"
      },
      {
        "kind": "message",
        "method": "ingestSessionDocument",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DocumentFunnel_$_ingestSessionDocument"
      },
      {
        "kind": "message",
        "method": "injectDocumentContext",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DocumentFunnel_$_injectDocumentContext"
      },
      {
        "kind": "message",
        "method": "listScratchWorkingFiles",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DocumentFunnel_$_listScratchWorkingFiles"
      },
      {
        "kind": "message",
        "method": "openDownloadExport",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DocumentFunnel_$_openDownloadExport"
      },
      {
        "kind": "message",
        "method": "revealDownloadExport",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DocumentFunnel_$_revealDownloadExport"
      },
      {
        "kind": "message",
        "method": "runClarkdownConvert",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DocumentFunnel_$_runClarkdownConvert"
      },
      {
        "kind": "message",
        "method": "runClarkdownDownloadExport",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DocumentFunnel_$_runClarkdownDownloadExport"
      },
      {
        "kind": "message",
        "method": "workingDocumentsChanged",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DocumentFunnel_$_workingDocumentsChanged"
      },
      {
        "kind": "message",
        "method": "writeScratchFile",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DocumentFunnel_$_writeScratchFile"
      }
    ]
  },
  "claude.web.FileSystem": {
    "namespace": "claude.web",
    "service": "FileSystem",
    "methods": [
      {
        "kind": "message",
        "method": "appInfoForExtension",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_appInfoForExtension"
      },
      {
        "kind": "message",
        "method": "browseFiles",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_browseFiles"
      },
      {
        "kind": "message",
        "method": "browseFolder",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_browseFolder"
      },
      {
        "kind": "message",
        "method": "browseFolders",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_browseFolders"
      },
      {
        "kind": "message",
        "method": "exportLocalFileToGoogleDrive",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_exportLocalFileToGoogleDrive"
      },
      {
        "kind": "message",
        "method": "getLocalFileThumbnail",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_getLocalFileThumbnail"
      },
      {
        "kind": "message",
        "method": "getSystemPath",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_getSystemPath"
      },
      {
        "kind": "message",
        "method": "listDirectory",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_listDirectory"
      },
      {
        "kind": "message",
        "method": "listFilesInFolder",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_listFilesInFolder"
      },
      {
        "kind": "message",
        "method": "openLocalFile",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_openLocalFile"
      },
      {
        "kind": "message",
        "method": "promoteScratchpadFile",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_promoteScratchpadFile"
      },
      {
        "kind": "message",
        "method": "readLocalFile",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_readLocalFile"
      },
      {
        "kind": "message",
        "method": "savePastedFile",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_savePastedFile"
      },
      {
        "kind": "message",
        "method": "showInFolder",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_showInFolder"
      },
      {
        "kind": "message",
        "method": "whichApplication",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_whichApplication"
      },
      {
        "kind": "message",
        "method": "writeFileDownload",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_writeFileDownload"
      },
      {
        "kind": "message",
        "method": "writeFileDownloadAndOpen",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_writeFileDownloadAndOpen"
      },
      {
        "kind": "message",
        "method": "writeLocalFile",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_writeLocalFile"
      }
    ]
  },
  "claude.web.FindInPageProvider": {
    "namespace": "claude.web",
    "service": "FindInPageProvider",
    "methods": [
      {
        "kind": "message",
        "method": "findClear",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FindInPageProvider_$_findClear"
      },
      {
        "kind": "message",
        "method": "findRequest",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FindInPageProvider_$_findRequest"
      },
      {
        "kind": "message",
        "method": "reportFindResult",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FindInPageProvider_$_reportFindResult"
      },
      {
        "kind": "message",
        "method": "setProviderActive",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FindInPageProvider_$_setProviderActive"
      }
    ]
  },
  "claude.web.FloatingPenguinMini": {
    "namespace": "claude.web",
    "service": "FloatingPenguinMini",
    "methods": [
      {
        "kind": "message",
        "method": "onMiniStateChanged",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FloatingPenguinMini_$_onMiniStateChanged"
      },
      {
        "kind": "message",
        "method": "requestSetMiniExpanded",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FloatingPenguinMini_$_requestSetMiniExpanded"
      },
      {
        "kind": "message",
        "method": "requestToggleMini",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FloatingPenguinMini_$_requestToggleMini"
      }
    ]
  },
  "claude.web.FramebufferPreview": {
    "namespace": "claude.web",
    "service": "FramebufferPreview",
    "methods": [
      {
        "kind": "message",
        "method": "attach",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_attach"
      },
      {
        "kind": "message",
        "method": "detach",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_detach"
      },
      {
        "kind": "message",
        "method": "listSources",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_listSources"
      },
      {
        "kind": "message",
        "method": "openSourceRequested",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_openSourceRequested"
      },
      {
        "kind": "message",
        "method": "requestFramePort",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_requestFramePort"
      },
      {
        "kind": "message",
        "method": "sendKey",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_sendKey"
      },
      {
        "kind": "message",
        "method": "sendPointer",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_sendPointer"
      },
      {
        "kind": "message",
        "method": "sendScroll",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_sendScroll"
      },
      {
        "kind": "message",
        "method": "sessionFatal",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_sessionFatal"
      },
      {
        "kind": "message",
        "method": "sessionResized",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_sessionResized"
      },
      {
        "kind": "message",
        "method": "setStreamHints",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_setStreamHints"
      }
    ]
  },
  "claude.web.GrandPrix": {
    "namespace": "claude.web",
    "service": "GrandPrix",
    "methods": [
      {
        "kind": "message",
        "method": "disconnect",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_GrandPrix_$_disconnect"
      },
      {
        "kind": "message",
        "method": "dismissVerificationCode",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_GrandPrix_$_dismissVerificationCode"
      },
      {
        "kind": "message",
        "method": "grandPrixStatus_$store$_getState",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_GrandPrix_$_grandPrixStatus_$store$_getState"
      },
      {
        "kind": "message",
        "method": "grandPrixStatus_$store$_getStateSync",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_GrandPrix_$_grandPrixStatus_$store$_getStateSync"
      },
      {
        "kind": "message",
        "method": "grandPrixStatus_$store$_update",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_GrandPrix_$_grandPrixStatus_$store$_update"
      },
      {
        "kind": "message",
        "method": "pair",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_GrandPrix_$_pair"
      },
      {
        "kind": "message",
        "method": "request",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_GrandPrix_$_request"
      },
      {
        "kind": "message",
        "method": "submitVerificationCode",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_GrandPrix_$_submitVerificationCode"
      }
    ]
  },
  "claude.web.Launch": {
    "namespace": "claude.web",
    "service": "Launch",
    "methods": [
      {
        "kind": "message",
        "method": "activeServers_$store$_getState",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_activeServers_$store$_getState"
      },
      {
        "kind": "message",
        "method": "activeServers_$store$_getStateSync",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_activeServers_$store$_getStateSync"
      },
      {
        "kind": "message",
        "method": "activeServers_$store$_update",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_activeServers_$store$_update"
      },
      {
        "kind": "message",
        "method": "addPreviewAllowedOrigin",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_addPreviewAllowedOrigin"
      },
      {
        "kind": "message",
        "method": "capturePreviewScreenshot",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_capturePreviewScreenshot"
      },
      {
        "kind": "message",
        "method": "capturePreviewScreenshotIfChanged",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_capturePreviewScreenshotIfChanged"
      },
      {
        "kind": "message",
        "method": "clearPreviewAllowedOrigins",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_clearPreviewAllowedOrigins"
      },
      {
        "kind": "message",
        "method": "clearPreviewViewport",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_clearPreviewViewport"
      },
      {
        "kind": "message",
        "method": "closeAllPreviewTabs",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_closeAllPreviewTabs"
      },
      {
        "kind": "message",
        "method": "closePreviewTab",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_closePreviewTab"
      },
      {
        "kind": "message",
        "method": "destroyPreview",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_destroyPreview"
      },
      {
        "kind": "message",
        "method": "elementSelected",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_elementSelected"
      },
      {
        "kind": "message",
        "method": "exportPreview",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_exportPreview"
      },
      {
        "kind": "message",
        "method": "focusOrOpenPreviewTab",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_focusOrOpenPreviewTab"
      },
      {
        "kind": "message",
        "method": "focusPreview",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_focusPreview"
      },
      {
        "kind": "message",
        "method": "getAutoVerify",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_getAutoVerify"
      },
      {
        "kind": "message",
        "method": "getConfiguredServices",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_getConfiguredServices"
      },
      {
        "kind": "message",
        "method": "getLogs",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_getLogs"
      },
      {
        "kind": "message",
        "method": "getPreviewAllowedOrigins",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_getPreviewAllowedOrigins"
      },
      {
        "kind": "message",
        "method": "getPreviewNavState",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_getPreviewNavState"
      },
      {
        "kind": "message",
        "method": "getPreviewTabs",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_getPreviewTabs"
      },
      {
        "kind": "message",
        "method": "getPreviewUrl",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_getPreviewUrl"
      },
      {
        "kind": "message",
        "method": "goBack",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_goBack"
      },
      {
        "kind": "message",
        "method": "goForward",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_goForward"
      },
      {
        "kind": "message",
        "method": "hidePreview",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_hidePreview"
      },
      {
        "kind": "message",
        "method": "isAvailable",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_isAvailable"
      },
      {
        "kind": "message",
        "method": "isJitlessForced",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_isJitlessForced"
      },
      {
        "kind": "message",
        "method": "loadClaudePagePreview",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_loadClaudePagePreview"
      },
      {
        "kind": "message",
        "method": "loadHtmlPreview",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_loadHtmlPreview"
      },
      {
        "kind": "message",
        "method": "loadHtmlPreviewContent",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_loadHtmlPreviewContent"
      },
      {
        "kind": "message",
        "method": "navigatePreview",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_navigatePreview"
      },
      {
        "kind": "message",
        "method": "openExternalLinkInPreview",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_openExternalLinkInPreview"
      },
      {
        "kind": "message",
        "method": "openPreviewInBrowser",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_openPreviewInBrowser"
      },
      {
        "kind": "message",
        "method": "openPreviewTab",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_openPreviewTab"
      },
      {
        "kind": "message",
        "method": "pickHtmlFile",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_pickHtmlFile"
      },
      {
        "kind": "message",
        "method": "previewCloseShortcut",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_previewCloseShortcut"
      },
      {
        "kind": "message",
        "method": "previewFocusExit",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_previewFocusExit"
      },
      {
        "kind": "message",
        "method": "previewNewTabShortcut",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_previewNewTabShortcut"
      },
      {
        "kind": "message",
        "method": "previewSelectionShortcut",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_previewSelectionShortcut"
      },
      {
        "kind": "message",
        "method": "previewTabsChanged",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_previewTabsChanged"
      },
      {
        "kind": "message",
        "method": "previewUrlChanged",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_previewUrlChanged"
      },
      {
        "kind": "message",
        "method": "refreshPreview",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_refreshPreview"
      },
      {
        "kind": "message",
        "method": "removePreviewAllowedOrigin",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_removePreviewAllowedOrigin"
      },
      {
        "kind": "message",
        "method": "sendClaudePageDismissCommand",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_sendClaudePageDismissCommand"
      },
      {
        "kind": "message",
        "method": "sendClaudePageShareCommand",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_sendClaudePageShareCommand"
      },
      {
        "kind": "message",
        "method": "setActivePreviewTab",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_setActivePreviewTab"
      },
      {
        "kind": "message",
        "method": "setAutoVerify",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_setAutoVerify"
      },
      {
        "kind": "message",
        "method": "setPreviewColorScheme",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_setPreviewColorScheme"
      },
      {
        "kind": "message",
        "method": "setPreviewViewport",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_setPreviewViewport"
      },
      {
        "kind": "message",
        "method": "showPreview",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_showPreview"
      },
      {
        "kind": "message",
        "method": "startBrowserPreview",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_startBrowserPreview"
      },
      {
        "kind": "message",
        "method": "startFromConfig",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_startFromConfig"
      },
      {
        "kind": "message",
        "method": "stopServer",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_stopServer"
      },
      {
        "kind": "message",
        "method": "toggleSelectionMode",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_toggleSelectionMode"
      }
    ]
  },
  "claude.web.LocalAgentModeSessions": {
    "namespace": "claude.web",
    "service": "LocalAgentModeSessions",
    "methods": [
      {
        "kind": "message",
        "method": "abandonBridgeEnvironment",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_abandonBridgeEnvironment"
      },
      {
        "kind": "message",
        "method": "addFolderToSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_addFolderToSession"
      },
      {
        "kind": "message",
        "method": "addTrustedFolder",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_addTrustedFolder"
      },
      {
        "kind": "message",
        "method": "archive",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_archive"
      },
      {
        "kind": "message",
        "method": "authorizeDirectMcpServer",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_authorizeDirectMcpServer"
      },
      {
        "kind": "message",
        "method": "browseAndGrantRemoteSessionFolder",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_browseAndGrantRemoteSessionFolder"
      },
      {
        "kind": "message",
        "method": "cancelInteractiveAuth",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_cancelInteractiveAuth"
      },
      {
        "kind": "message",
        "method": "clearRemoteSessionFolderGrants",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_clearRemoteSessionFolderGrants"
      },
      {
        "kind": "message",
        "method": "delete",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_delete"
      },
      {
        "kind": "message",
        "method": "deleteBridgeAgentMemory",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_deleteBridgeAgentMemory"
      },
      {
        "kind": "message",
        "method": "deleteBridgeSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_deleteBridgeSession"
      },
      {
        "kind": "message",
        "method": "deleteLocalSkill",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_deleteLocalSkill"
      },
      {
        "kind": "message",
        "method": "directMcpCallTool",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_directMcpCallTool"
      },
      {
        "kind": "message",
        "method": "directMcpListResources",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_directMcpListResources"
      },
      {
        "kind": "message",
        "method": "directMcpReadResource",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_directMcpReadResource"
      },
      {
        "kind": "message",
        "method": "disconnectDirectMcpServer",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_disconnectDirectMcpServer"
      },
      {
        "kind": "message",
        "method": "getAll",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getAll"
      },
      {
        "kind": "message",
        "method": "getAppIconForBundleId",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getAppIconForBundleId"
      },
      {
        "kind": "message",
        "method": "getBridgeConsent",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getBridgeConsent"
      },
      {
        "kind": "message",
        "method": "getDefaultWorkspaceFolders",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getDefaultWorkspaceFolders"
      },
      {
        "kind": "message",
        "method": "getDirectMcpServerStatuses",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getDirectMcpServerStatuses"
      },
      {
        "kind": "message",
        "method": "getLocalMcpServers",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getLocalMcpServers"
      },
      {
        "kind": "message",
        "method": "getLocalSkillFiles",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getLocalSkillFiles"
      },
      {
        "kind": "message",
        "method": "getManagedAskToolNames",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getManagedAskToolNames"
      },
      {
        "kind": "message",
        "method": "getSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getSession"
      },
      {
        "kind": "message",
        "method": "getSessionsBridgeEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getSessionsBridgeEnabled"
      },
      {
        "kind": "message",
        "method": "getSessionsForScheduledTask",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getSessionsForScheduledTask"
      },
      {
        "kind": "message",
        "method": "getSupportedCommands",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getSupportedCommands"
      },
      {
        "kind": "message",
        "method": "getTranscript",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getTranscript"
      },
      {
        "kind": "message",
        "method": "getTranscriptFeedback",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getTranscriptFeedback"
      },
      {
        "kind": "message",
        "method": "getTrustedFolders",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getTrustedFolders"
      },
      {
        "kind": "message",
        "method": "grantRemoteSessionFolder",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_grantRemoteSessionFolder"
      },
      {
        "kind": "message",
        "method": "grantRemoteSessionFolders",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_grantRemoteSessionFolders"
      },
      {
        "kind": "message",
        "method": "interactiveAuth_$store$_getState",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_interactiveAuth_$store$_getState"
      },
      {
        "kind": "message",
        "method": "interactiveAuth_$store$_getStateSync",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_interactiveAuth_$store$_getStateSync"
      },
      {
        "kind": "message",
        "method": "interactiveAuth_$store$_update",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_interactiveAuth_$store$_update"
      },
      {
        "kind": "message",
        "method": "isFolderTrusted",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_isFolderTrusted"
      },
      {
        "kind": "message",
        "method": "kickBridgePoll",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_kickBridgePoll"
      },
      {
        "kind": "message",
        "method": "listLocalSkills",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_listLocalSkills"
      },
      {
        "kind": "message",
        "method": "mcpAuthenticate",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_mcpAuthenticate"
      },
      {
        "kind": "message",
        "method": "mcpCallTool",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_mcpCallTool"
      },
      {
        "kind": "message",
        "method": "mcpListResources",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_mcpListResources"
      },
      {
        "kind": "message",
        "method": "mcpReadResource",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_mcpReadResource"
      },
      {
        "kind": "message",
        "method": "mcpReconnect",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_mcpReconnect"
      },
      {
        "kind": "message",
        "method": "mcpSubmitOAuthCallbackUrl",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_mcpSubmitOAuthCallbackUrl"
      },
      {
        "kind": "message",
        "method": "noteCuWindowMentions",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_noteCuWindowMentions"
      },
      {
        "kind": "message",
        "method": "onBridgePermissionPreflight",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_onBridgePermissionPreflight"
      },
      {
        "kind": "message",
        "method": "onCoworkFromMain",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_onCoworkFromMain"
      },
      {
        "kind": "message",
        "method": "onCuEmergencyStop",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_onCuEmergencyStop"
      },
      {
        "kind": "message",
        "method": "onDirectMcpServerStatusesChanged",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_onDirectMcpServerStatusesChanged"
      },
      {
        "kind": "message",
        "method": "onEvent",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_onEvent"
      },
      {
        "kind": "message",
        "method": "onManagedAskToolNamesChanged",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_onManagedAskToolNamesChanged"
      },
      {
        "kind": "message",
        "method": "onRemoteSessionStart",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_onRemoteSessionStart"
      },
      {
        "kind": "message",
        "method": "onToolPermissionRequest",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_onToolPermissionRequest"
      },
      {
        "kind": "message",
        "method": "openOutputsDir",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_openOutputsDir"
      },
      {
        "kind": "message",
        "method": "refetchMyAccess",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_refetchMyAccess"
      },
      {
        "kind": "message",
        "method": "releaseRemoteCuLock",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_releaseRemoteCuLock"
      },
      {
        "kind": "message",
        "method": "removeTrustedFolder",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_removeTrustedFolder"
      },
      {
        "kind": "message",
        "method": "replaceEnabledMcpTools",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_replaceEnabledMcpTools"
      },
      {
        "kind": "message",
        "method": "replaceRemoteMcpServers",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_replaceRemoteMcpServers"
      },
      {
        "kind": "message",
        "method": "requestDocumentsTccAccess",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_requestDocumentsTccAccess"
      },
      {
        "kind": "message",
        "method": "requestFolderTccAccess",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_requestFolderTccAccess"
      },
      {
        "kind": "message",
        "method": "resetBridge",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_resetBridge"
      },
      {
        "kind": "message",
        "method": "resetBridgeSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_resetBridgeSession"
      },
      {
        "kind": "message",
        "method": "respondBridgePermissionPreflight",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_respondBridgePermissionPreflight"
      },
      {
        "kind": "message",
        "method": "respondDirectoryServers",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_respondDirectoryServers"
      },
      {
        "kind": "message",
        "method": "respondPluginSearch",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_respondPluginSearch"
      },
      {
        "kind": "message",
        "method": "respondSlashMenuSkills",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_respondSlashMenuSkills"
      },
      {
        "kind": "message",
        "method": "respondToToolPermission",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_respondToToolPermission"
      },
      {
        "kind": "message",
        "method": "revealLocalSkill",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_revealLocalSkill"
      },
      {
        "kind": "message",
        "method": "revokeInteractiveAuth",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_revokeInteractiveAuth"
      },
      {
        "kind": "message",
        "method": "rewind",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_rewind"
      },
      {
        "kind": "message",
        "method": "saveLocalSkill",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_saveLocalSkill"
      },
      {
        "kind": "message",
        "method": "searchSessions",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_searchSessions"
      },
      {
        "kind": "message",
        "method": "sendMessage",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_sendMessage"
      },
      {
        "kind": "message",
        "method": "sessionsBridgeStatus_$store$_getState",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_sessionsBridgeStatus_$store$_getState"
      },
      {
        "kind": "message",
        "method": "sessionsBridgeStatus_$store$_getStateSync",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_sessionsBridgeStatus_$store$_getStateSync"
      },
      {
        "kind": "message",
        "method": "sessionsBridgeStatus_$store$_update",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_sessionsBridgeStatus_$store$_update"
      },
      {
        "kind": "message",
        "method": "setChromePermissionMode",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_setChromePermissionMode"
      },
      {
        "kind": "message",
        "method": "setDraftSessionFolders",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_setDraftSessionFolders"
      },
      {
        "kind": "message",
        "method": "setEffort",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_setEffort"
      },
      {
        "kind": "message",
        "method": "setExtendedThinking",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_setExtendedThinking"
      },
      {
        "kind": "message",
        "method": "setFocusedSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_setFocusedSession"
      },
      {
        "kind": "message",
        "method": "setLocalSkillEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_setLocalSkillEnabled"
      },
      {
        "kind": "message",
        "method": "setMcpServers",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_setMcpServers"
      },
      {
        "kind": "message",
        "method": "setModel",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_setModel"
      },
      {
        "kind": "message",
        "method": "setPermissionMode",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_setPermissionMode"
      },
      {
        "kind": "message",
        "method": "setSessionsBridgeEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_setSessionsBridgeEnabled"
      },
      {
        "kind": "message",
        "method": "shareSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_shareSession"
      },
      {
        "kind": "message",
        "method": "signalSessionIntent",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_signalSessionIntent"
      },
      {
        "kind": "message",
        "method": "start",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_start"
      },
      {
        "kind": "message",
        "method": "startWatchRecording",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_startWatchRecording"
      },
      {
        "kind": "message",
        "method": "stop",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_stop"
      },
      {
        "kind": "message",
        "method": "stopTask",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_stopTask"
      },
      {
        "kind": "message",
        "method": "submitTranscriptFeedback",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_submitTranscriptFeedback"
      },
      {
        "kind": "message",
        "method": "syncSkills",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_syncSkills"
      },
      {
        "kind": "message",
        "method": "takeHeldWatchRecording",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_takeHeldWatchRecording"
      },
      {
        "kind": "message",
        "method": "triggerInteractiveAuth",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_triggerInteractiveAuth"
      },
      {
        "kind": "message",
        "method": "updateSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_updateSession"
      },
      {
        "kind": "message",
        "method": "watchRecordingComplete",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_watchRecordingComplete"
      }
    ]
  },
  "claude.web.LocalPlugins": {
    "namespace": "claude.web",
    "service": "LocalPlugins",
    "methods": [
      {
        "kind": "message",
        "method": "deletePlugin",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_deletePlugin"
      },
      {
        "kind": "message",
        "method": "getDownloadedRemotePlugins",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_getDownloadedRemotePlugins"
      },
      {
        "kind": "message",
        "method": "getPluginCliBatch",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_getPluginCliBatch"
      },
      {
        "kind": "message",
        "method": "getPluginCliStatus",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_getPluginCliStatus"
      },
      {
        "kind": "message",
        "method": "getPluginOAuthStatus",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_getPluginOAuthStatus"
      },
      {
        "kind": "message",
        "method": "getPlugins",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_getPlugins"
      },
      {
        "kind": "message",
        "method": "getPluginShimOps",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_getPluginShimOps"
      },
      {
        "kind": "message",
        "method": "listSkillFiles",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_listSkillFiles"
      },
      {
        "kind": "message",
        "method": "onCliOpAlwaysAllowed",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_onCliOpAlwaysAllowed"
      },
      {
        "kind": "message",
        "method": "revokePluginOAuth",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_revokePluginOAuth"
      },
      {
        "kind": "message",
        "method": "setPluginEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_setPluginEnabled"
      },
      {
        "kind": "message",
        "method": "setPluginEnvVars",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_setPluginEnvVars"
      },
      {
        "kind": "message",
        "method": "setPluginOAuthClient",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_setPluginOAuthClient"
      },
      {
        "kind": "message",
        "method": "setPluginShimPermission",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_setPluginShimPermission"
      },
      {
        "kind": "message",
        "method": "startPluginOAuthFlow",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_startPluginOAuthFlow"
      },
      {
        "kind": "message",
        "method": "syncRemotePlugins",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_syncRemotePlugins"
      },
      {
        "kind": "message",
        "method": "uploadPlugin",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_uploadPlugin"
      }
    ]
  },
  "claude.web.LocalSessionEnvironment": {
    "namespace": "claude.web",
    "service": "LocalSessionEnvironment",
    "methods": [
      {
        "kind": "message",
        "method": "get",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessionEnvironment_$_get"
      },
      {
        "kind": "message",
        "method": "save",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessionEnvironment_$_save"
      }
    ]
  },
  "claude.web.LocalSessions": {
    "namespace": "claude.web",
    "service": "LocalSessions",
    "methods": [
      {
        "kind": "message",
        "method": "addDirectories",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_addDirectories"
      },
      {
        "kind": "message",
        "method": "applyFlagSettings",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_applyFlagSettings"
      },
      {
        "kind": "message",
        "method": "archive",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_archive"
      },
      {
        "kind": "message",
        "method": "beginTearOffHalo",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_beginTearOffHalo"
      },
      {
        "kind": "message",
        "method": "cancelQueuedMessage",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_cancelQueuedMessage"
      },
      {
        "kind": "message",
        "method": "changeCwd",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_changeCwd"
      },
      {
        "kind": "message",
        "method": "checkBranchSwitchConflict",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_checkBranchSwitchConflict"
      },
      {
        "kind": "message",
        "method": "checkGhAvailable",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_checkGhAvailable"
      },
      {
        "kind": "message",
        "method": "checkRemoteTargetTrust",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_checkRemoteTargetTrust"
      },
      {
        "kind": "message",
        "method": "checkRemoteTrust",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_checkRemoteTrust"
      },
      {
        "kind": "message",
        "method": "checkTrust",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_checkTrust"
      },
      {
        "kind": "message",
        "method": "classifyTccFolderKind",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_classifyTccFolderKind"
      },
      {
        "kind": "message",
        "method": "clearSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_clearSession"
      },
      {
        "kind": "message",
        "method": "commitAllChanges",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_commitAllChanges"
      },
      {
        "kind": "message",
        "method": "commitWipForBranchSwitch",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_commitWipForBranchSwitch"
      },
      {
        "kind": "message",
        "method": "createAgent",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_createAgent"
      },
      {
        "kind": "message",
        "method": "createLocalPr",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_createLocalPr"
      },
      {
        "kind": "message",
        "method": "createPrReviewComment",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_createPrReviewComment"
      },
      {
        "kind": "message",
        "method": "delete",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_delete"
      },
      {
        "kind": "message",
        "method": "dequeuePr",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_dequeuePr"
      },
      {
        "kind": "message",
        "method": "disableAutoMerge",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_disableAutoMerge"
      },
      {
        "kind": "message",
        "method": "discardWorkingTree",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_discardWorkingTree"
      },
      {
        "kind": "message",
        "method": "dismissBoundPr",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_dismissBoundPr"
      },
      {
        "kind": "message",
        "method": "enableAutoMerge",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_enableAutoMerge"
      },
      {
        "kind": "message",
        "method": "endTearOffHalo",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_endTearOffHalo"
      },
      {
        "kind": "message",
        "method": "ensureBranchPushed",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_ensureBranchPushed"
      },
      {
        "kind": "message",
        "method": "ensureSSHConnected",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_ensureSSHConnected"
      },
      {
        "kind": "message",
        "method": "findLocalSessionIdForBridgeId",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_findLocalSessionIdForBridgeId"
      },
      {
        "kind": "message",
        "method": "forkSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_forkSession"
      },
      {
        "kind": "message",
        "method": "generateLocalPrContent",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_generateLocalPrContent"
      },
      {
        "kind": "message",
        "method": "getAgents",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getAgents"
      },
      {
        "kind": "message",
        "method": "getAll",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getAll"
      },
      {
        "kind": "message",
        "method": "getBusyShellPtyKeys",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getBusyShellPtyKeys"
      },
      {
        "kind": "message",
        "method": "getCheckRunAnnotations",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getCheckRunAnnotations"
      },
      {
        "kind": "message",
        "method": "getCodeStats",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getCodeStats"
      },
      {
        "kind": "message",
        "method": "getCommitDiff",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getCommitDiff"
      },
      {
        "kind": "message",
        "method": "getContextUsage",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getContextUsage"
      },
      {
        "kind": "message",
        "method": "getCrCliStatus",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getCrCliStatus"
      },
      {
        "kind": "message",
        "method": "getCrForSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getCrForSession"
      },
      {
        "kind": "message",
        "method": "getCrRefSummary",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getCrRefSummary"
      },
      {
        "kind": "message",
        "method": "getDefaultEffort",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getDefaultEffort"
      },
      {
        "kind": "message",
        "method": "getDefaultPermissionMode",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getDefaultPermissionMode"
      },
      {
        "kind": "message",
        "method": "getDetectedProjects",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getDetectedProjects"
      },
      {
        "kind": "message",
        "method": "getDiffFileContent",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getDiffFileContent"
      },
      {
        "kind": "message",
        "method": "getEffort",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getEffort"
      },
      {
        "kind": "message",
        "method": "getGhIssue",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getGhIssue"
      },
      {
        "kind": "message",
        "method": "getGhRefSummary",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getGhRefSummary"
      },
      {
        "kind": "message",
        "method": "getGitCommits",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getGitCommits"
      },
      {
        "kind": "message",
        "method": "getGitDiff",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getGitDiff"
      },
      {
        "kind": "message",
        "method": "getGitDiffFilePatch",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getGitDiffFilePatch"
      },
      {
        "kind": "message",
        "method": "getGitDiffStats",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getGitDiffStats"
      },
      {
        "kind": "message",
        "method": "getGitInfo",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getGitInfo"
      },
      {
        "kind": "message",
        "method": "getInstalledEditors",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getInstalledEditors"
      },
      {
        "kind": "message",
        "method": "getLocalBranches",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getLocalBranches"
      },
      {
        "kind": "message",
        "method": "getLocalMcpServers",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getLocalMcpServers"
      },
      {
        "kind": "message",
        "method": "getMacTccRecoveryInfo",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getMacTccRecoveryInfo"
      },
      {
        "kind": "message",
        "method": "getPermissionMode",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getPermissionMode"
      },
      {
        "kind": "message",
        "method": "getPlanForSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getPlanForSession"
      },
      {
        "kind": "message",
        "method": "getPrChecks",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getPrChecks"
      },
      {
        "kind": "message",
        "method": "getPrCommits",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getPrCommits"
      },
      {
        "kind": "message",
        "method": "getPrDetails",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getPrDetails"
      },
      {
        "kind": "message",
        "method": "getPrOverview",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getPrOverview"
      },
      {
        "kind": "message",
        "method": "getPrReviewComments",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getPrReviewComments"
      },
      {
        "kind": "message",
        "method": "getPrStateForBranch",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getPrStateForBranch"
      },
      {
        "kind": "message",
        "method": "getRemoteCommitDiff",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getRemoteCommitDiff"
      },
      {
        "kind": "message",
        "method": "getRemoteDiffFileContent",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getRemoteDiffFileContent"
      },
      {
        "kind": "message",
        "method": "getRemoteGitCommits",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getRemoteGitCommits"
      },
      {
        "kind": "message",
        "method": "getRemoteGitDiff",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getRemoteGitDiff"
      },
      {
        "kind": "message",
        "method": "getRemoteGitDiffStats",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getRemoteGitDiffStats"
      },
      {
        "kind": "message",
        "method": "getRemoteGitInfo",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getRemoteGitInfo"
      },
      {
        "kind": "message",
        "method": "getSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSession"
      },
      {
        "kind": "message",
        "method": "getSessionMediaStreamUrl",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSessionMediaStreamUrl"
      },
      {
        "kind": "message",
        "method": "getSessionPanelMediaStreamUrl",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSessionPanelMediaStreamUrl"
      },
      {
        "kind": "message",
        "method": "getSessionsForScheduledTask",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSessionsForScheduledTask"
      },
      {
        "kind": "message",
        "method": "getShellPtyBuffer",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getShellPtyBuffer"
      },
      {
        "kind": "message",
        "method": "getSSHCommitDiff",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSSHCommitDiff"
      },
      {
        "kind": "message",
        "method": "getSSHConfigs",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSSHConfigs"
      },
      {
        "kind": "message",
        "method": "getSSHDiffFileContent",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSSHDiffFileContent"
      },
      {
        "kind": "message",
        "method": "getSSHGitCommits",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSSHGitCommits"
      },
      {
        "kind": "message",
        "method": "getSSHGitDiff",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSSHGitDiff"
      },
      {
        "kind": "message",
        "method": "getSSHGitDiffStats",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSSHGitDiffStats"
      },
      {
        "kind": "message",
        "method": "getSSHGitInfo",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSSHGitInfo"
      },
      {
        "kind": "message",
        "method": "getSSHLocalBranches",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSSHLocalBranches"
      },
      {
        "kind": "message",
        "method": "getSSHSupportedCommands",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSSHSupportedCommands"
      },
      {
        "kind": "message",
        "method": "getSupportedCommands",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSupportedCommands"
      },
      {
        "kind": "message",
        "method": "getTeleportReadiness",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getTeleportReadiness"
      },
      {
        "kind": "message",
        "method": "getTranscript",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getTranscript"
      },
      {
        "kind": "message",
        "method": "getTrustedSSHHosts",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getTrustedSSHHosts"
      },
      {
        "kind": "message",
        "method": "getUncommittedChanges",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getUncommittedChanges"
      },
      {
        "kind": "message",
        "method": "getWorkingTreeStatus",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getWorkingTreeStatus"
      },
      {
        "kind": "message",
        "method": "importCliSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_importCliSession"
      },
      {
        "kind": "message",
        "method": "installGh",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_installGh"
      },
      {
        "kind": "message",
        "method": "interrupt",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_interrupt"
      },
      {
        "kind": "message",
        "method": "isVSCodeInstalled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_isVSCodeInstalled"
      },
      {
        "kind": "message",
        "method": "isWorkingTreeDirty",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_isWorkingTreeDirty"
      },
      {
        "kind": "message",
        "method": "launchUltrareview",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_launchUltrareview"
      },
      {
        "kind": "message",
        "method": "listGhIssues",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_listGhIssues"
      },
      {
        "kind": "message",
        "method": "listSessionDirectory",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_listSessionDirectory"
      },
      {
        "kind": "message",
        "method": "listSSHDirectory",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_listSSHDirectory"
      },
      {
        "kind": "message",
        "method": "listWslDistros",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_listWslDistros"
      },
      {
        "kind": "message",
        "method": "logCliEvent",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_logCliEvent"
      },
      {
        "kind": "message",
        "method": "markPrDraft",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_markPrDraft"
      },
      {
        "kind": "message",
        "method": "markPrReady",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_markPrReady"
      },
      {
        "kind": "message",
        "method": "mcpAuthenticate",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_mcpAuthenticate"
      },
      {
        "kind": "message",
        "method": "mcpCallTool",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_mcpCallTool"
      },
      {
        "kind": "message",
        "method": "mcpListResources",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_mcpListResources"
      },
      {
        "kind": "message",
        "method": "mcpReadResource",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_mcpReadResource"
      },
      {
        "kind": "message",
        "method": "mcpReconnect",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_mcpReconnect"
      },
      {
        "kind": "message",
        "method": "mcpSubmitOAuthCallbackUrl",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_mcpSubmitOAuthCallbackUrl"
      },
      {
        "kind": "message",
        "method": "mergePr",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_mergePr"
      },
      {
        "kind": "message",
        "method": "notifySpawnedTaskStarted",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_notifySpawnedTaskStarted"
      },
      {
        "kind": "message",
        "method": "onEvent",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_onEvent"
      },
      {
        "kind": "message",
        "method": "onSSHPasswordRequired",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_onSSHPasswordRequired"
      },
      {
        "kind": "message",
        "method": "onToolPermissionRequest",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_onToolPermissionRequest"
      },
      {
        "kind": "message",
        "method": "openInEditor",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_openInEditor"
      },
      {
        "kind": "message",
        "method": "openInVSCode",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_openInVSCode"
      },
      {
        "kind": "message",
        "method": "openMacFilesAndFoldersSettings",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_openMacFilesAndFoldersSettings"
      },
      {
        "kind": "message",
        "method": "openSessionFileInDefaultApp",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_openSessionFileInDefaultApp"
      },
      {
        "kind": "message",
        "method": "pickFileAtCwd",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_pickFileAtCwd"
      },
      {
        "kind": "message",
        "method": "pickSessionFile",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_pickSessionFile"
      },
      {
        "kind": "message",
        "method": "popBackgroundTaskSuggestion",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_popBackgroundTaskSuggestion"
      },
      {
        "kind": "message",
        "method": "popBackgroundTaskSuggestionById",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_popBackgroundTaskSuggestionById"
      },
      {
        "kind": "message",
        "method": "promoteQueuedMessage",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_promoteQueuedMessage"
      },
      {
        "kind": "message",
        "method": "readFileAtCwd",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_readFileAtCwd"
      },
      {
        "kind": "message",
        "method": "readSessionFile",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_readSessionFile"
      },
      {
        "kind": "message",
        "method": "readSessionImageAsDataUrl",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_readSessionImageAsDataUrl"
      },
      {
        "kind": "message",
        "method": "readSessionMediaAsDataUrl",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_readSessionMediaAsDataUrl"
      },
      {
        "kind": "message",
        "method": "readSessionPanelMediaAsDataUrl",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_readSessionPanelMediaAsDataUrl"
      },
      {
        "kind": "message",
        "method": "reorderQueuedMessage",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_reorderQueuedMessage"
      },
      {
        "kind": "message",
        "method": "replaceEnabledMcpTools",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_replaceEnabledMcpTools"
      },
      {
        "kind": "message",
        "method": "replaceRemoteMcpServers",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_replaceRemoteMcpServers"
      },
      {
        "kind": "message",
        "method": "replyToPrReviewComment",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_replyToPrReviewComment"
      },
      {
        "kind": "message",
        "method": "reportComposerInp",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_reportComposerInp"
      },
      {
        "kind": "message",
        "method": "reportStreamRender",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_reportStreamRender"
      },
      {
        "kind": "message",
        "method": "reportSwitchTiming",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_reportSwitchTiming"
      },
      {
        "kind": "message",
        "method": "rerunPrCheck",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_rerunPrCheck"
      },
      {
        "kind": "message",
        "method": "resizePty",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_resizePty"
      },
      {
        "kind": "message",
        "method": "resizeShellPty",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_resizeShellPty"
      },
      {
        "kind": "message",
        "method": "resolvePrReviewThread",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_resolvePrReviewThread"
      },
      {
        "kind": "message",
        "method": "resolveSessionFile",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_resolveSessionFile"
      },
      {
        "kind": "message",
        "method": "resolveSSHSettings",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_resolveSSHSettings"
      },
      {
        "kind": "message",
        "method": "respondToRefusalFallbackPrompt",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_respondToRefusalFallbackPrompt"
      },
      {
        "kind": "message",
        "method": "respondToSSHPassword",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_respondToSSHPassword"
      },
      {
        "kind": "message",
        "method": "respondToToolPermission",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_respondToToolPermission"
      },
      {
        "kind": "message",
        "method": "resumePreClearSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_resumePreClearSession"
      },
      {
        "kind": "message",
        "method": "revealRemotePath",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_revealRemotePath"
      },
      {
        "kind": "message",
        "method": "reviewDiff",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_reviewDiff"
      },
      {
        "kind": "message",
        "method": "rewind",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_rewind"
      },
      {
        "kind": "message",
        "method": "rewindV2",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_rewindV2"
      },
      {
        "kind": "message",
        "method": "runBashCommand",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_runBashCommand"
      },
      {
        "kind": "message",
        "method": "saveTrust",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_saveTrust"
      },
      {
        "kind": "message",
        "method": "searchSessions",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_searchSessions"
      },
      {
        "kind": "message",
        "method": "sendMessage",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_sendMessage"
      },
      {
        "kind": "message",
        "method": "sendSideChatMessage",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_sendSideChatMessage"
      },
      {
        "kind": "message",
        "method": "setAccountBranchPrefix",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setAccountBranchPrefix"
      },
      {
        "kind": "message",
        "method": "setAutoFixEnabled",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setAutoFixEnabled"
      },
      {
        "kind": "message",
        "method": "setAvailableCodeModels",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setAvailableCodeModels"
      },
      {
        "kind": "message",
        "method": "setEffort",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setEffort"
      },
      {
        "kind": "message",
        "method": "setFastMode",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setFastMode"
      },
      {
        "kind": "message",
        "method": "setFocusedSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setFocusedSession"
      },
      {
        "kind": "message",
        "method": "setMcpServers",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setMcpServers"
      },
      {
        "kind": "message",
        "method": "setModel",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setModel"
      },
      {
        "kind": "message",
        "method": "setPermissionMode",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setPermissionMode"
      },
      {
        "kind": "message",
        "method": "setSSHConfigs",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setSSHConfigs"
      },
      {
        "kind": "message",
        "method": "setTearOffHalo",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setTearOffHalo"
      },
      {
        "kind": "message",
        "method": "setTrustedSSHHosts",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setTrustedSSHHosts"
      },
      {
        "kind": "message",
        "method": "setVisibility",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setVisibility"
      },
      {
        "kind": "message",
        "method": "shareSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_shareSession"
      },
      {
        "kind": "message",
        "method": "showSessionFileInFolder",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_showSessionFileInFolder"
      },
      {
        "kind": "message",
        "method": "showSessionFilePreview",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_showSessionFilePreview"
      },
      {
        "kind": "message",
        "method": "start",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_start"
      },
      {
        "kind": "message",
        "method": "startPty",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_startPty"
      },
      {
        "kind": "message",
        "method": "startShellPty",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_startShellPty"
      },
      {
        "kind": "message",
        "method": "startSideChat",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_startSideChat"
      },
      {
        "kind": "message",
        "method": "stashWorkingTree",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_stashWorkingTree"
      },
      {
        "kind": "message",
        "method": "stop",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_stop"
      },
      {
        "kind": "message",
        "method": "stopPty",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_stopPty"
      },
      {
        "kind": "message",
        "method": "stopSessionSummary",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_stopSessionSummary"
      },
      {
        "kind": "message",
        "method": "stopShellPty",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_stopShellPty"
      },
      {
        "kind": "message",
        "method": "stopSideChat",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_stopSideChat"
      },
      {
        "kind": "message",
        "method": "stopTask",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_stopTask"
      },
      {
        "kind": "message",
        "method": "submitFeedback",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_submitFeedback"
      },
      {
        "kind": "message",
        "method": "submitPrReview",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_submitPrReview"
      },
      {
        "kind": "message",
        "method": "summarizeSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_summarizeSession"
      },
      {
        "kind": "message",
        "method": "summarizeTranscript",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_summarizeTranscript"
      },
      {
        "kind": "message",
        "method": "teleportToCloud",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_teleportToCloud"
      },
      {
        "kind": "message",
        "method": "testSSHConnection",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_testSSHConnection"
      },
      {
        "kind": "message",
        "method": "unarchive",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_unarchive"
      },
      {
        "kind": "message",
        "method": "updatePrBody",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_updatePrBody"
      },
      {
        "kind": "message",
        "method": "updatePrComment",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_updatePrComment"
      },
      {
        "kind": "message",
        "method": "updateSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_updateSession"
      },
      {
        "kind": "message",
        "method": "validateSSHPath",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_validateSSHPath"
      },
      {
        "kind": "message",
        "method": "warmSession",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_warmSession"
      },
      {
        "kind": "message",
        "method": "writePty",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_writePty"
      },
      {
        "kind": "message",
        "method": "writeSessionFile",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_writeSessionFile"
      },
      {
        "kind": "message",
        "method": "writeShellPty",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_writeShellPty"
      }
    ]
  },
  "claude.web.MenuEvents": {
    "namespace": "claude.web",
    "service": "MenuEvents",
    "methods": [
      {
        "kind": "message",
        "method": "closeWindow",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_MenuEvents_$_closeWindow"
      },
      {
        "kind": "message",
        "method": "openFile",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_MenuEvents_$_openFile"
      },
      {
        "kind": "message",
        "method": "toggleSidebar",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_MenuEvents_$_toggleSidebar"
      }
    ]
  },
  "claude.web.Navigation": {
    "namespace": "claude.web",
    "service": "Navigation",
    "methods": [
      {
        "kind": "message",
        "method": "navigate",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Navigation_$_navigate"
      }
    ]
  },
  "claude.web.NestDev": {
    "namespace": "claude.web",
    "service": "NestDev",
    "methods": [
      {
        "kind": "message",
        "method": "focus",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_NestDev_$_focus"
      },
      {
        "kind": "message",
        "method": "getState",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_NestDev_$_getState"
      }
    ]
  },
  "claude.web.OpenDocuments": {
    "namespace": "claude.web",
    "service": "OpenDocuments",
    "methods": [
      {
        "kind": "message",
        "method": "getOpenDocuments",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_OpenDocuments_$_getOpenDocuments"
      },
      {
        "kind": "message",
        "method": "readOpenDocumentAsBase64",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_OpenDocuments_$_readOpenDocumentAsBase64"
      }
    ]
  },
  "claude.web.PluginBridgeMcp": {
    "namespace": "claude.web",
    "service": "PluginBridgeMcp",
    "methods": [
      {
        "kind": "message",
        "method": "changed",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_PluginBridgeMcp_$_changed"
      },
      {
        "kind": "message",
        "method": "listServers",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_PluginBridgeMcp_$_listServers"
      }
    ]
  },
  "claude.web.QuickEntry": {
    "namespace": "claude.web",
    "service": "QuickEntry",
    "methods": [
      {
        "kind": "message",
        "method": "onQuickEntrySubmit",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_QuickEntry_$_onQuickEntrySubmit"
      },
      {
        "kind": "message",
        "method": "setRecentChats",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_QuickEntry_$_setRecentChats"
      }
    ]
  },
  "claude.web.Resources": {
    "namespace": "claude.web",
    "service": "Resources",
    "methods": [
      {
        "kind": "message",
        "method": "fetchMentionOptions",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Resources_$_fetchMentionOptions"
      },
      {
        "kind": "message",
        "method": "findRequested",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Resources_$_findRequested"
      },
      {
        "kind": "message",
        "method": "findStepRequested",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Resources_$_findStepRequested"
      },
      {
        "kind": "message",
        "method": "handleMentionSelect",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Resources_$_handleMentionSelect"
      },
      {
        "kind": "message",
        "method": "listProjectFiles",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Resources_$_listProjectFiles"
      },
      {
        "kind": "message",
        "method": "searchFileContents",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Resources_$_searchFileContents"
      },
      {
        "kind": "message",
        "method": "setFindInPageClaimed",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Resources_$_setFindInPageClaimed"
      },
      {
        "kind": "message",
        "method": "setFocusedCwd",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Resources_$_setFocusedCwd"
      },
      {
        "kind": "message",
        "method": "setFocusedSshTarget",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Resources_$_setFocusedSshTarget"
      }
    ]
  },
  "claude.web.Toast": {
    "namespace": "claude.web",
    "service": "Toast",
    "methods": [
      {
        "kind": "message",
        "method": "showToast",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Toast_$_showToast"
      }
    ]
  },
  "claude.web.WebBuild": {
    "namespace": "claude.web",
    "service": "WebBuild",
    "methods": [
      {
        "kind": "message",
        "method": "reportCommitHash",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WebBuild_$_reportCommitHash"
      }
    ]
  },
  "claude.web.WindowControl": {
    "namespace": "claude.web",
    "service": "WindowControl",
    "methods": [
      {
        "kind": "message",
        "method": "captureScreenshot",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowControl_$_captureScreenshot"
      },
      {
        "kind": "message",
        "method": "close",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowControl_$_close"
      },
      {
        "kind": "message",
        "method": "focus",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowControl_$_focus"
      },
      {
        "kind": "message",
        "method": "reportModalScrim",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowControl_$_reportModalScrim"
      },
      {
        "kind": "message",
        "method": "resize",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowControl_$_resize"
      },
      {
        "kind": "message",
        "method": "setIncognitoMode",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowControl_$_setIncognitoMode"
      },
      {
        "kind": "message",
        "method": "setModalScrimActive",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowControl_$_setModalScrimActive"
      },
      {
        "kind": "message",
        "method": "setThemeMode",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowControl_$_setThemeMode"
      }
    ]
  },
  "claude.web.WindowState": {
    "namespace": "claude.web",
    "service": "WindowState",
    "methods": [
      {
        "kind": "message",
        "method": "cuDockStateChanged",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowState_$_cuDockStateChanged"
      },
      {
        "kind": "message",
        "method": "fullscreenChanged",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowState_$_fullscreenChanged"
      },
      {
        "kind": "message",
        "method": "getFullscreen",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowState_$_getFullscreen"
      },
      {
        "kind": "message",
        "method": "getVisibility",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowState_$_getVisibility"
      },
      {
        "kind": "message",
        "method": "getZoomFactor",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowState_$_getZoomFactor"
      },
      {
        "kind": "message",
        "method": "visibilityChanged",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowState_$_visibilityChanged"
      },
      {
        "kind": "message",
        "method": "zoomFactorChanged",
        "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowState_$_zoomFactorChanged"
      }
    ]
  },
  "electron_window.WindowManager": {
    "namespace": "electron_window",
    "service": "WindowManager",
    "methods": [
      {
        "kind": "message",
        "method": "DestroyWindow",
        "channel": "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_DestroyWindow"
      },
      {
        "kind": "message",
        "method": "GetWindowState",
        "channel": "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_GetWindowState"
      },
      {
        "kind": "message",
        "method": "RegisterWindow",
        "channel": "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_RegisterWindow"
      },
      {
        "kind": "message",
        "method": "UnregisterWindow",
        "channel": "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_UnregisterWindow"
      },
      {
        "kind": "message",
        "method": "UpdateWindow",
        "channel": "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_UpdateWindow"
      },
      {
        "kind": "message",
        "method": "WindowAction",
        "channel": "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_WindowAction"
      },
      {
        "kind": "message",
        "method": "WindowEvent",
        "channel": "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_WindowEvent"
      }
    ]
  }
} as const satisfies Record<string, IpcServiceContract>;

export type IpcServiceName = keyof typeof IPC_SERVICES;

export interface PreloadChannelContract {
  readonly channel: string;
  readonly files: readonly string[];
  readonly rendererOperations: readonly string[];
  readonly publicPaths: readonly string[];
}

export const PRELOAD_CHANNELS = [
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_cancelScan",
    "files": [
      "buddy.js",
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "cancelScan"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_deviceStatus",
    "files": [
      "buddy.js",
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "deviceStatus"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_forgetDevice",
    "files": [
      "buddy.js",
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "forgetDevice"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_install",
    "files": [
      "buddy.js",
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "install"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_pairDevice",
    "files": [
      "buddy.js",
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "pairDevice"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_pairingPrompt",
    "files": [
      "buddy.js",
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onPairingPrompt"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_pickDevice",
    "files": [
      "buddy.js",
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "pickDevice"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_pickFolder",
    "files": [
      "buddy.js",
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "pickFolder"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_preview",
    "files": [
      "buddy.js",
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "preview"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_progress",
    "files": [
      "buddy.js",
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onProgress"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_scanDevices",
    "files": [
      "buddy.js",
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "scanDevices"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_setName",
    "files": [
      "buddy.js",
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setName"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_status",
    "files": [
      "buddy.js",
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "status"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_Buddy_$_submitPin",
    "files": [
      "buddy.js",
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "submitPin"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_BuddyBleTransport_$_log",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "log"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_BuddyBleTransport_$_reportState",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "reportState"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_BuddyBleTransport_$_rx",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "rx"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.buddy_$_BuddyBleTransport_$_tx",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onTx"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.coworkArtifact_$_CoworkArtifactBridge_$_askClaude",
    "files": [
      "coworkArtifact.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "askClaude"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.coworkArtifact_$_CoworkArtifactBridge_$_callMcpTool",
    "files": [
      "coworkArtifact.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "callMcpTool"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.coworkArtifact_$_CoworkArtifactBridge_$_navigateHost",
    "files": [
      "coworkArtifact.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "navigateHost"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.coworkArtifact_$_CoworkArtifactBridge_$_openExternalUrl",
    "files": [
      "coworkArtifact.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openExternalUrl"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.coworkArtifact_$_CoworkArtifactBridge_$_runScheduledTask",
    "files": [
      "coworkArtifact.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "runScheduledTask"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.hybrid_$_DesktopIntl_$_getInitialLocale",
    "files": [
      "aboutWindow.js",
      "buddy.js",
      "findInPage.js",
      "mainView.js",
      "mainWindow.js",
      "quickWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getInitialLocale"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.hybrid_$_DesktopIntl_$_localeChanged",
    "files": [
      "aboutWindow.js",
      "buddy.js",
      "findInPage.js",
      "mainView.js",
      "mainWindow.js",
      "quickWindow.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onLocaleChanged"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.hybrid_$_DesktopIntl_$_requestLocaleChange",
    "files": [
      "aboutWindow.js",
      "buddy.js",
      "findInPage.js",
      "mainView.js",
      "mainWindow.js",
      "quickWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "requestLocaleChange"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.findInPage_$_FindInPage_$_blurInput",
    "files": [
      "findInPage.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onBlurInput"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.findInPage_$_FindInPage_$_endFindSession",
    "files": [
      "findInPage.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "endFindSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.findInPage_$_FindInPage_$_findInPage",
    "files": [
      "findInPage.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "findInPage"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.findInPage_$_FindInPage_$_focusInput",
    "files": [
      "findInPage.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onFocusInput"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.findInPage_$_FindInPage_$_stepToMatch",
    "files": [
      "findInPage.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onStepToMatch"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.findInPage_$_FindInPage_$_stopFindInPage",
    "files": [
      "findInPage.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "stopFindInPage"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_AboutWindow_$_getAppName",
    "files": [
      "aboutWindow.js",
      "mainWindow.js",
      "quickWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getAppName"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_AboutWindow_$_getBuildProps",
    "files": [
      "aboutWindow.js",
      "mainWindow.js",
      "quickWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getBuildProps"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_AboutWindow_$_getSupport",
    "files": [
      "aboutWindow.js",
      "mainWindow.js",
      "quickWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSupport"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_AboutWindow_$_openHelp",
    "files": [
      "aboutWindow.js",
      "mainWindow.js",
      "quickWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openHelp"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_MainWindowTitleBar_$_hideLoadError",
    "files": [
      "aboutWindow.js",
      "mainWindow.js",
      "quickWindow.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onHideLoadError"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_MainWindowTitleBar_$_isClaudeCurrentlyHealthy",
    "files": [
      "aboutWindow.js",
      "mainWindow.js",
      "quickWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isClaudeCurrentlyHealthy"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_MainWindowTitleBar_$_requestMainMenuPopup",
    "files": [
      "aboutWindow.js",
      "mainWindow.js",
      "quickWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "requestMainMenuPopup"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_MainWindowTitleBar_$_requestReloadMainView",
    "files": [
      "aboutWindow.js",
      "mainWindow.js",
      "quickWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "requestReloadMainView"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_MainWindowTitleBar_$_showLoadError",
    "files": [
      "aboutWindow.js",
      "mainWindow.js",
      "quickWindow.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onShowLoadError"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_MainWindowTitleBar_$_titleBarReady",
    "files": [
      "aboutWindow.js",
      "mainWindow.js",
      "quickWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "titleBarReady"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_MainWindowTitleBar_$_updateTitleBar",
    "files": [
      "aboutWindow.js",
      "mainWindow.js",
      "quickWindow.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onUpdateTitleBar"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_QuickWindow_$_requestDismiss",
    "files": [
      "aboutWindow.js",
      "mainWindow.js",
      "quickWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "requestDismiss"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_QuickWindow_$_requestDismissWithPayload",
    "files": [
      "aboutWindow.js",
      "mainWindow.js",
      "quickWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "requestDismissWithPayload"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.internal.ui_$_QuickWindow_$_requestSkooch",
    "files": [
      "aboutWindow.js",
      "mainWindow.js",
      "quickWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "requestSkooch"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_connectedFilesState_$store$_getState",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "connectedFilesStateStore.getState"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_connectedFilesState_$store$_getStateSync",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "sendSync"
    ],
    "publicPaths": [
      "connectedFilesStateStore.getStateSync"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_connectedFilesState_$store$_update",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "connectedFilesStateStore.onStateChange"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_focusFile",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "focusFile"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_getConnectedFiles",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getConnectedFiles"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_isFeatureEnabled",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isFeatureEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_onAddinNeedsContext",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnAddinNeedsContext"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_onFileAdded",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnFileAdded"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_onFileRemoved",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnFileRemoved"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_onFileStateChanged",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnFileStateChanged"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_selectFile",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "selectFile"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.officeAddin_$_OfficeAddinFiles_$_updateActiveConversationSummary",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "updateActiveConversationSummary"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_AppConfig_$_getAppConfig",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getAppConfig"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_AppConfig_$_setAppFeature",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setAppFeature"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_AppConfig_$_setIsDxtAutoUpdatesEnabled",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setIsDxtAutoUpdatesEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_AppConfig_$_setIsUsingBuiltInNodeForMcp",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setIsUsingBuiltInNodeForMcp"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_AppFeatures_$_getSupportedFeatures",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSupportedFeatures"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_AppPreferences_$_getPreferences",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getPreferences"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_AppPreferences_$_preferencesChanged",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onPreferencesChanged"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_AppPreferences_$_setPreference",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setPreference"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_CcdCli_$_getCcdCliStatus",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getCcdCliStatus"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_CcdCli_$_installCcdCli",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "installCcdCli"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_CcdCli_$_uninstallCcdCli",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "uninstallCcdCli"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_ClaudeAiImport_$_clearAuth",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "clearAuth"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_ClaudeAiImport_$_getAuthState",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getAuthState"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_ClaudeAiImport_$_isAvailable",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isAvailable"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_ClaudeAiImport_$_onAuthStateChange",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnAuthStateChange"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_ClaudeAiImport_$_onAuthUserCode",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnAuthUserCode"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_ClaudeAiImport_$_reopenAuthTab",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "reopenAuthTab"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_ClaudeAiImport_$_runImport",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "runImport"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_ClaudeAiImport_$_startAuth",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "startAuth"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pHelperRun_$_discoverModels",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "discoverModels"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pHelperRun_$_probeDeviceCode",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onProbeDeviceCode"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pHelperRun_$_probeInference",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "probeInference"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pHelperRun_$_runCredentialHelper",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "runCredentialHelper"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_applyAnthropicApiShortcut",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "applyAnthropicApiShortcut"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_authorizeAndProbeMcpServer",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "authorizeAndProbeMcpServer"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_bootstrapState_$store$_getState",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "bootstrapStateStore.getState"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_bootstrapState_$store$_getStateSync",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "sendSync"
    ],
    "publicPaths": [
      "bootstrapStateStore.getStateSync"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_bootstrapState_$store$_update",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "bootstrapStateStore.onStateChange"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_createConfig",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "createConfig"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_deleteConfig",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "deleteConfig"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_duplicateConfig",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "duplicateConfig"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_exportConfig",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "exportConfig"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_forgetMcpOAuth",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "forgetMcpOAuth"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_getConfigHealth",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getConfigHealth"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_getLoginDesktop3pStatus",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getLoginDesktop3pStatus"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_listConfigs",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listConfigs"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_openDeviceCodeWindowForE2e",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openDeviceCodeWindowForE2e"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_openSetupWindow",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openSetupWindow"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_probeEgressHosts",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "probeEgressHosts"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_probeMcpServer",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "probeMcpServer"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_readConfig",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "readConfig"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_recheckConfigHealth",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "recheckConfigHealth"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_relaunchApp",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "relaunchApp"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_renameConfig",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "renameConfig"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_revealConfig",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "revealConfig"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_scanOrgPlugins",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "scanOrgPlugins"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_setAppliedConfig",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setAppliedConfig"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_setDeploymentMode",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setDeploymentMode"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_signInWithAnthropicApi",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "signInWithAnthropicApi"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_triggerBootstrapAuth",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "triggerBootstrapAuth"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Custom3pSetup_$_writeConfig",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "writeConfig"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_DesktopInfo_$_getSystemInfo",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSystemInfo"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_DesktopInfo_$_showLogsInFileManager",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "showLogsInFileManager"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_deleteExtension",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "deleteExtension"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_extensionDownloadProgress",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onExtensionDownloadProgress"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_extensionsChanged",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onExtensionsChanged"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_extensionSettingsChanged",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onExtensionSettingsChanged"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_getAvailableExtensionRuntimes",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getAvailableExtensionRuntimes"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_getDirectoryUrl",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getDirectoryUrl"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_getExtension",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getExtension"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_getExtensions",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getExtensions"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_getExtensionSettings",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getExtensionSettings"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_getExtensionVersion",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getExtensionVersion"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_getExtensionVersions",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getExtensionVersions"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_getInstalledExtensionsWithState",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getInstalledExtensionsWithState"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_getIsUpdateAvailable",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getIsUpdateAvailable"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_getManifestCompatibilityResult",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getManifestCompatibilityResult"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_handleDxtFile",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "handleDxtFile"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_installDxt",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "installDxt"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_installDxtFromDirectory",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "installDxtFromDirectory"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_installDxtUnpacked",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "installDxtUnpacked"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_installExtensionFromPreview",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "installExtensionFromPreview"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_isDesktopExtensionDirectoryEnabled",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isDesktopExtensionDirectoryEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_isDesktopExtensionSignatureRequired",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isDesktopExtensionSignatureRequired"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_isDirectoryEnabled",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isDirectoryEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_isExtensionsEnabled",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isExtensionsEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_isLocalExtensionInstallAllowed",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isLocalExtensionInstallAllowed"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_openExtensionSettingsFolder",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openExtensionSettingsFolder"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_openExtensionsFolder",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openExtensionsFolder"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_previewExtensionInstallation",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onPreviewExtensionInstallation"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_refreshAllowlistCheck",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "refreshAllowlistCheck"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_setExtensionSettings",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setExtensionSettings"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_showExtensionInFolder",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "showExtensionInFolder"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Extensions_$_showInstallDxtDialog",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "showInstallDxtDialog"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_FilePickers_$_getDirectoryPath",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getDirectoryPath"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_FilePickers_$_getFilePath",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getFilePath"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_GlobalShortcut_$_getGlobalShortcut",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getGlobalShortcut"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_GlobalShortcut_$_globalShortcutChange",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onGlobalShortcutChange"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_GlobalShortcut_$_setGlobalShortcut",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setGlobalShortcut"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_MCP_$_getMcpServersConfig",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getMcpServersConfig"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_MCP_$_getMcpServersConfigWithStatus",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getMcpServersConfigWithStatus"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_MCP_$_isLocalDevMcpEnabled",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isLocalDevMcpEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_MCP_$_mcpConfigChange",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onMcpConfigChange"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_MCP_$_mcpStatusChanged",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onMcpStatusChanged"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_MCP_$_revealConfig",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "revealConfig"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_MCP_$_revealLogs",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "revealLogs"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_MCP_$_revealMcpServerSettingsRequested",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onRevealMcpServerSettingsRequested"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_MCP_$_revealServerLog",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "revealServerLog"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_MCP_$_setMcpServerConfigs",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setMcpServerConfigs"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Startup_$_isMenuBarEnabled",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isMenuBarEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Startup_$_isStartupOnLoginEnabled",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isStartupOnLoginEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Startup_$_setMenuBarEnabled",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setMenuBarEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_Startup_$_setStartupOnLoginEnabled",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setStartupOnLoginEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_SupportBundle_$_submitAction",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "submitAction"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_SupportBundle_$_supportBundleState_$store$_getState",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "supportBundleStateStore.getState"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_SupportBundle_$_supportBundleState_$store$_getStateSync",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "sendSync"
    ],
    "publicPaths": [
      "supportBundleStateStore.getStateSync"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_SupportBundle_$_supportBundleState_$store$_update",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "supportBundleStateStore.onStateChange"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_WakeScheduler_$_getStatus",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getStatus"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.settings_$_WakeScheduler_$_openSettings",
    "files": [
      "mainView.js",
      "mainWindow.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openSettings"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_attach",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "attach"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_attachment_$store$_getState",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "attachmentStore.getState"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_attachment_$store$_getStateSync",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "sendSync"
    ],
    "publicPaths": [
      "attachmentStore.getStateSync"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_attachment_$store$_update",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "attachmentStore.onStateChange"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_detach",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "detach"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_gesture",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "gesture"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_installAndLaunch",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "installAndLaunch"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_listDevices",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listDevices"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_saveScreenshot",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "saveScreenshot"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_startRecording",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "startRecording"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.simulator_$_Simulator_$_stopRecording",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "stopRecording"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.skills_$_Skills_$_previewSkillFile",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onPreviewSkillFile"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Account_$_setAccountDetails",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setAccountDetails"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AgentModeFeedback_$_openFeedbackAndConfirmReinstall",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openFeedbackAndConfirmReinstall"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AgentModeFeedback_$_openFeedbackWindow",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openFeedbackWindow"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AgentModeFeedback_$_reportErrorToSlack",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "reportErrorToSlack"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Auth_$_doAuthInBrowser",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "doAuthInBrowser"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AutoUpdater_$_cancelPendingRestart",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "cancelPendingRestart"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AutoUpdater_$_checkForUpdates",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "checkForUpdates"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AutoUpdater_$_getRunningLocalSessionCount",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getRunningLocalSessionCount"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AutoUpdater_$_getRunningLocalSessions",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getRunningLocalSessions"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AutoUpdater_$_restartToUpdate",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "restartToUpdate"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AutoUpdater_$_restartToUpdateWhenIdle",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "restartToUpdateWhenIdle"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AutoUpdater_$_updaterState_$store$_getState",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "updaterStateStore.getState"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AutoUpdater_$_updaterState_$store$_getStateSync",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "sendSync"
    ],
    "publicPaths": [
      "updaterStateStore.getStateSync"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_AutoUpdater_$_updaterState_$store$_update",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "updaterStateStore.onStateChange"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_BrowserNavigation_$_goBack",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "goBack"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_BrowserNavigation_$_goForward",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "goForward"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_BrowserNavigation_$_navigationState_$store$_getState",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "navigationStateStore.getState"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_BrowserNavigation_$_navigationState_$store$_getStateSync",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "sendSync"
    ],
    "publicPaths": [
      "navigationStateStore.getStateSync"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_BrowserNavigation_$_navigationState_$store$_update",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "navigationStateStore.onStateChange"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_BrowserNavigation_$_reportNavigationState",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "reportNavigationState"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_BrowserNavigation_$_requestMainMenuPopup",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "requestMainMenuPopup"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_BuddyRemoteFeed_$_permissionDecision",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onPermissionDecision"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_BuddyRemoteFeed_$_sync",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "sync"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CCDScheduledTasks_$_createScheduledTask",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "createScheduledTask"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CCDScheduledTasks_$_getAllScheduledTasks",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getAllScheduledTasks"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CCDScheduledTasks_$_getScheduledTaskFileContent",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getScheduledTaskFileContent"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CCDScheduledTasks_$_getWatcherHistory",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getWatcherHistory"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CCDScheduledTasks_$_markListenerReady",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "markListenerReady"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CCDScheduledTasks_$_onScheduledTaskEvent",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnScheduledTaskEvent"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CCDScheduledTasks_$_removeApprovedPermission",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "removeApprovedPermission"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CCDScheduledTasks_$_updateScheduledTask",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "updateScheduledTask"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CCDScheduledTasks_$_updateScheduledTaskFileContent",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "updateScheduledTaskFileContent"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CCDScheduledTasks_$_updateScheduledTaskStatus",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "updateScheduledTaskStatus"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ChromeExtension_$_installExtension",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "installExtension"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ChromeExtension_$_isInstalled",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isInstalled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ChromeExtension_$_restartChrome",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "restartChrome"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeCode_$_checkGitAvailable",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "checkGitAvailable"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeCode_$_getPeriodUsage",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getPeriodUsage"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeCode_$_getStatus",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getStatus"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeCode_$_patchUserSettings",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "patchUserSettings"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeCode_$_prepare",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "prepare"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeCode_$_resolveLocalSettings",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "resolveLocalSettings"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeCode_$_setEnableWorkflows",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setEnableWorkflows"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_apiReachability_$store$_getState",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "apiReachabilityStore.getState"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_apiReachability_$store$_getStateSync",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "sendSync"
    ],
    "publicPaths": [
      "apiReachabilityStore.getStateSync"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_apiReachability_$store$_update",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "apiReachabilityStore.onStateChange"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_checkVirtualMachinePlatform",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "checkVirtualMachinePlatform"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_deleteAndReinstall",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "deleteAndReinstall"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_download",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "download"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_downloadProgress",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onDownloadProgress"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_downloadStatusChanged",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onDownloadStatusChanged"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_enableVirtualMachinePlatform",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "enableVirtualMachinePlatform"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_getDownloadStatus",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getDownloadStatus"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_getRunningStatus",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getRunningStatus"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_isHostLoopDevOverrideActive",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "sendSync"
    ],
    "publicPaths": [
      "isHostLoopDevOverrideActive"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_isHostLoopModeEnabled",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "sendSync"
    ],
    "publicPaths": [
      "isHostLoopModeEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_restartAfterVMPInstall",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "restartAfterVMPInstall"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_runningStatusChanged",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onRunningStatusChanged"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_setForceDisableHostLoop",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setForceDisableHostLoop"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_setYukonSilverConfig",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setYukonSilverConfig"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_startupError",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onStartupError"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ClaudeVM_$_startVM",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "startVM"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ComputerUseTcc_$_getCurrentSessionGrants",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getCurrentSessionGrants"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ComputerUseTcc_$_getState",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getState"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ComputerUseTcc_$_listInstalledApps",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listInstalledApps"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ComputerUseTcc_$_openSystemSettings",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openSystemSettings"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ComputerUseTcc_$_requestAccessibility",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "requestAccessibility"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ComputerUseTcc_$_requestScreenRecording",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "requestScreenRecording"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_ComputerUseTcc_$_revokeGrant",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "revokeGrant"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_deleteArtifact",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "deleteArtifact"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_getAllArtifacts",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getAllArtifacts"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_getArtifactIndexHtmlPath",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getArtifactIndexHtmlPath"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_getArtifactMetadata",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getArtifactMetadata"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_getArtifactThumbnail",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getArtifactThumbnail"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_hideArtifact",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "hideArtifact"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_importArtifact",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "importArtifact"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_isAutoPublishEnabled",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isAutoPublishEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_isSharingEnabled",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isSharingEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_onArtifactsChanged",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnArtifactsChanged"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_parkAndCaptureArtifact",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "parkAndCaptureArtifact"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_printArtifactToPdf",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "printArtifactToPdf"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_refreshImportedArtifact",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "refreshImportedArtifact"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_reloadArtifactView",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "reloadArtifactView"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_restoreArtifactVersion",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "restoreArtifactVersion"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_setArtifactAutoPublish",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setArtifactAutoPublish"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_setArtifactLastModifiedSession",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setArtifactLastModifiedSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_setArtifactMcpTools",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setArtifactMcpTools"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_setArtifactStarred",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setArtifactStarred"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_shareArtifact",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "shareArtifact"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_showArtifact",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "showArtifact"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkArtifacts_$_unshareArtifact",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "unshareArtifact"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFeedback_$_captureScreenshot",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "captureScreenshot"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFeedback_$_discardScreenshot",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "discardScreenshot"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFeedback_$_getScreenshotDataUrl",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getScreenshotDataUrl"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFeedback_$_getSystemInfo",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSystemInfo"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFeedback_$_submitFeedback",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "submitFeedback"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFilePreview_$_hide",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "hide"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFilePreview_$_isEnabled",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFilePreview_$_isEpitaxyPreviewEnabled",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isEpitaxyPreviewEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFilePreview_$_isOpenInDefaultAppEnabled",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isOpenInDefaultAppEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFilePreview_$_isVmReady",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isVmReady"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFilePreview_$_parkAndCapture",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "parkAndCapture"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkFilePreview_$_show",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "show"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkMemory_$_deleteAccountMemory",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "deleteAccountMemory"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkMemory_$_listAccountMemories",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listAccountMemories"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkMemory_$_readAccountMemory",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "readAccountMemory"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkMemory_$_readGlobalMemory",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "readGlobalMemory"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkMemory_$_resetMemories",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "resetMemories"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkMemory_$_writeAccountMemory",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "writeAccountMemory"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkMemory_$_writeGlobalMemory",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "writeGlobalMemory"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_clearChromePermissions",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "clearChromePermissions"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_createScheduledTask",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "createScheduledTask"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_getAllScheduledTasks",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getAllScheduledTasks"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_getScheduledTaskFileContent",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getScheduledTaskFileContent"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_getWatcherHistory",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getWatcherHistory"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_markListenerReady",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "markListenerReady"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_onScheduledTaskEvent",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnScheduledTaskEvent"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_removeApprovedPermission",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "removeApprovedPermission"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_updateScheduledTask",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "updateScheduledTask"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_updateScheduledTaskFileContent",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "updateScheduledTaskFileContent"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkScheduledTasks_$_updateScheduledTaskStatus",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "updateScheduledTaskStatus"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_addFolderToSpace",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "addFolderToSpace"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_addLinkToSpace",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "addLinkToSpace"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_addProjectToSpace",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "addProjectToSpace"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_appendRemoteSessionSpaceFolders",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "appendRemoteSessionSpaceFolders"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_classifySessions",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "classifySessions"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_copyFilesToSpaceFolder",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "copyFilesToSpaceFolder"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_createSpace",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "createSpace"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_createSpaceFolder",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "createSpaceFolder"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_deleteSpace",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "deleteSpace"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_getAllSpaces",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getAllSpaces"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_getAutoMemoryDir",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getAutoMemoryDir"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_getRemoteSessionSpaces",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getRemoteSessionSpaces"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_getSpace",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSpace"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_listFolderContents",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listFolderContents"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_onSpaceEvent",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnSpaceEvent"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_openFile",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openFile"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_readFileContents",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "readFileContents"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_readSpaceMemoryIndex",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "readSpaceMemoryIndex"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_removeFolderFromSpace",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "removeFolderFromSpace"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_removeLinkFromSpace",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "removeLinkFromSpace"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_removeProjectFromSpace",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "removeProjectFromSpace"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_removeRemoteSessionSpace",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "removeRemoteSessionSpace"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_setAutoDescription",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setAutoDescription"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_setRemoteSessionSpace",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setRemoteSessionSpace"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_summarizeSpace",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "summarizeSpace"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkSpaces_$_updateSpace",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "updateSpace"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkUserFiles_$_getInfo",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getInfo"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkUserFiles_$_migrate",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "migrate"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkUserFiles_$_pickTarget",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "pickTarget"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CoworkUserFiles_$_reveal",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "reveal"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_addMarketplace",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "addMarketplace"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_checkPluginHasLocalChanges",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "checkPluginHasLocalChanges"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_getAndClearMigrationIssues",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getAndClearMigrationIssues"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_getCachedCommands",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getCachedCommands"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_getInstallCounts",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getInstallCounts"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_installLocalOrgPlugin",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "installLocalOrgPlugin"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_installPlugin",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "installPlugin"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_installProgress",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onInstallProgress"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_listAvailablePlugins",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listAvailablePlugins"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_listInstalledPlugins",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listInstalledPlugins"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_listLocalOrgPlugins",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listLocalOrgPlugins"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_listMarketplaces",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listMarketplaces"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_listRemotePluginsPage",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listRemotePluginsPage"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_refreshMarketplace",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "refreshMarketplace"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_removeMarketplace",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "removeMarketplace"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_syncLocalOrgPlugins",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "syncLocalOrgPlugins"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_uninstallPlugin",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "uninstallPlugin"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_CustomPlugins_$_updatePlugin",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "updatePlugin"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DeepLink_$_handleDeepLink",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onHandleDeepLink"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DesktopNotifications_$_getAuthorizationStatus",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getAuthorizationStatus"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DesktopNotifications_$_onNotificationClicked",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnNotificationClicked"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DesktopNotifications_$_openNotificationSettings",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openNotificationSettings"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DesktopNotifications_$_requestAuthorization",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "requestAuthorization"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DesktopNotifications_$_showNotification",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "showNotification"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DeviceRegistry_$_getAvailability",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getAvailability"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DeviceRegistry_$_getLocalDeviceInfo",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getLocalDeviceInfo"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DeviceRegistry_$_getPublicKey",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getPublicKey"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DeviceRegistry_$_notifyRegistered",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "notifyRegistered"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DeviceRegistry_$_setKeylessBridgeRowPk",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setKeylessBridgeRowPk"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DeviceRegistry_$_signAttestationPreimage",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "signAttestationPreimage"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DeviceRegistry_$_signCreateSessionBind",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "signCreateSessionBind"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DeviceRegistry_$_signForSessionHeader",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "signForSessionHeader"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DeviceRegistry_$_signTriggerOp",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "signTriggerOp"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DocumentFunnel_$_ensureScratchRoot",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "ensureScratchRoot"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DocumentFunnel_$_ingestSessionDocument",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "ingestSessionDocument"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DocumentFunnel_$_injectDocumentContext",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "injectDocumentContext"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DocumentFunnel_$_listScratchWorkingFiles",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listScratchWorkingFiles"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DocumentFunnel_$_openDownloadExport",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openDownloadExport"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DocumentFunnel_$_revealDownloadExport",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "revealDownloadExport"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DocumentFunnel_$_runClarkdownConvert",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "runClarkdownConvert"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DocumentFunnel_$_runClarkdownDownloadExport",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "runClarkdownDownloadExport"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DocumentFunnel_$_workingDocumentsChanged",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onWorkingDocumentsChanged"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_DocumentFunnel_$_writeScratchFile",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "writeScratchFile"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_appInfoForExtension",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "appInfoForExtension"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_browseFiles",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "browseFiles"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_browseFolder",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "browseFolder"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_browseFolders",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "browseFolders"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_exportLocalFileToGoogleDrive",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "exportLocalFileToGoogleDrive"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_getLocalFileThumbnail",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getLocalFileThumbnail"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_getSystemPath",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSystemPath"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_listDirectory",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listDirectory"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_listFilesInFolder",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listFilesInFolder"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_openLocalFile",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openLocalFile"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_promoteScratchpadFile",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "promoteScratchpadFile"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_readLocalFile",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "readLocalFile"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_savePastedFile",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "savePastedFile"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_showInFolder",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "showInFolder"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_whichApplication",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "whichApplication"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_writeFileDownload",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "writeFileDownload"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_writeFileDownloadAndOpen",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "writeFileDownloadAndOpen"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FileSystem_$_writeLocalFile",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "writeLocalFile"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FindInPageProvider_$_findClear",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onFindClear"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FindInPageProvider_$_findRequest",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onFindRequest"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FindInPageProvider_$_reportFindResult",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "reportFindResult"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FindInPageProvider_$_setProviderActive",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setProviderActive"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FloatingPenguinMini_$_onMiniStateChanged",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnMiniStateChanged"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FloatingPenguinMini_$_requestSetMiniExpanded",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "requestSetMiniExpanded"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FloatingPenguinMini_$_requestToggleMini",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "requestToggleMini"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_attach",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "attach"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_detach",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "detach"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_listSources",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listSources"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_openSourceRequested",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOpenSourceRequested"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_requestFramePort",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "requestFramePort"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_sendKey",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "sendKey"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_sendPointer",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "sendPointer"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_sendScroll",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "sendScroll"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_sessionFatal",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onSessionFatal"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_sessionResized",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onSessionResized"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_FramebufferPreview_$_setStreamHints",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setStreamHints"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_GrandPrix_$_disconnect",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "disconnect"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_GrandPrix_$_dismissVerificationCode",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "dismissVerificationCode"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_GrandPrix_$_grandPrixStatus_$store$_getState",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "grandPrixStatusStore.getState"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_GrandPrix_$_grandPrixStatus_$store$_getStateSync",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "sendSync"
    ],
    "publicPaths": [
      "grandPrixStatusStore.getStateSync"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_GrandPrix_$_grandPrixStatus_$store$_update",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "grandPrixStatusStore.onStateChange"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_GrandPrix_$_pair",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "pair"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_GrandPrix_$_request",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "request"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_GrandPrix_$_submitVerificationCode",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "submitVerificationCode"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_activeServers_$store$_getState",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "activeServersStore.getState"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_activeServers_$store$_getStateSync",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "sendSync"
    ],
    "publicPaths": [
      "activeServersStore.getStateSync"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_activeServers_$store$_update",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "activeServersStore.onStateChange"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_addPreviewAllowedOrigin",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "addPreviewAllowedOrigin"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_capturePreviewScreenshot",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "capturePreviewScreenshot"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_capturePreviewScreenshotIfChanged",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "capturePreviewScreenshotIfChanged"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_clearPreviewAllowedOrigins",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "clearPreviewAllowedOrigins"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_clearPreviewViewport",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "clearPreviewViewport"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_closeAllPreviewTabs",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "closeAllPreviewTabs"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_closePreviewTab",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "closePreviewTab"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_destroyPreview",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "destroyPreview"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_elementSelected",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onElementSelected"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_exportPreview",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "exportPreview"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_focusOrOpenPreviewTab",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "focusOrOpenPreviewTab"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_focusPreview",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "focusPreview"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_getAutoVerify",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getAutoVerify"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_getConfiguredServices",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getConfiguredServices"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_getLogs",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getLogs"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_getPreviewAllowedOrigins",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getPreviewAllowedOrigins"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_getPreviewNavState",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getPreviewNavState"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_getPreviewTabs",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getPreviewTabs"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_getPreviewUrl",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getPreviewUrl"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_goBack",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "goBack"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_goForward",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "goForward"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_hidePreview",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "hidePreview"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_isAvailable",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "sendSync"
    ],
    "publicPaths": [
      "isAvailable"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_isJitlessForced",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isJitlessForced"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_loadClaudePagePreview",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "loadClaudePagePreview"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_loadHtmlPreview",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "loadHtmlPreview"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_loadHtmlPreviewContent",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "loadHtmlPreviewContent"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_navigatePreview",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "navigatePreview"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_openExternalLinkInPreview",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openExternalLinkInPreview"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_openPreviewInBrowser",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openPreviewInBrowser"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_openPreviewTab",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openPreviewTab"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_pickHtmlFile",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "pickHtmlFile"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_previewCloseShortcut",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onPreviewCloseShortcut"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_previewFocusExit",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onPreviewFocusExit"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_previewNewTabShortcut",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onPreviewNewTabShortcut"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_previewSelectionShortcut",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onPreviewSelectionShortcut"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_previewTabsChanged",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onPreviewTabsChanged"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_previewUrlChanged",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onPreviewUrlChanged"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_refreshPreview",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "refreshPreview"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_removePreviewAllowedOrigin",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "removePreviewAllowedOrigin"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_sendClaudePageDismissCommand",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "sendClaudePageDismissCommand"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_sendClaudePageShareCommand",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "sendClaudePageShareCommand"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_setActivePreviewTab",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setActivePreviewTab"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_setAutoVerify",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setAutoVerify"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_setPreviewColorScheme",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setPreviewColorScheme"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_setPreviewViewport",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setPreviewViewport"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_showPreview",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "showPreview"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_startBrowserPreview",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "startBrowserPreview"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_startFromConfig",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "startFromConfig"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_stopServer",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "stopServer"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Launch_$_toggleSelectionMode",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "toggleSelectionMode"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_abandonBridgeEnvironment",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "abandonBridgeEnvironment"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_addFolderToSession",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "addFolderToSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_addTrustedFolder",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "addTrustedFolder"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_archive",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "archive"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_authorizeDirectMcpServer",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "authorizeDirectMcpServer"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_browseAndGrantRemoteSessionFolder",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "browseAndGrantRemoteSessionFolder"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_cancelInteractiveAuth",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "cancelInteractiveAuth"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_clearRemoteSessionFolderGrants",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "clearRemoteSessionFolderGrants"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_delete",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "delete"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_deleteBridgeAgentMemory",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "deleteBridgeAgentMemory"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_deleteBridgeSession",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "deleteBridgeSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_deleteLocalSkill",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "deleteLocalSkill"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_directMcpCallTool",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "directMcpCallTool"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_directMcpListResources",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "directMcpListResources"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_directMcpReadResource",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "directMcpReadResource"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_disconnectDirectMcpServer",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "disconnectDirectMcpServer"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getAll",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getAll"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getAppIconForBundleId",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getAppIconForBundleId"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getBridgeConsent",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getBridgeConsent"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getDefaultWorkspaceFolders",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getDefaultWorkspaceFolders"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getDirectMcpServerStatuses",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getDirectMcpServerStatuses"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getLocalMcpServers",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getLocalMcpServers"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getLocalSkillFiles",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getLocalSkillFiles"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getManagedAskToolNames",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getManagedAskToolNames"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getSession",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getSessionsBridgeEnabled",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSessionsBridgeEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getSessionsForScheduledTask",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSessionsForScheduledTask"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getSupportedCommands",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSupportedCommands"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getTranscript",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getTranscript"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getTranscriptFeedback",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getTranscriptFeedback"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_getTrustedFolders",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getTrustedFolders"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_grantRemoteSessionFolder",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "grantRemoteSessionFolder"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_grantRemoteSessionFolders",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "grantRemoteSessionFolders"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_interactiveAuth_$store$_getState",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "interactiveAuthStore.getState"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_interactiveAuth_$store$_getStateSync",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "sendSync"
    ],
    "publicPaths": [
      "interactiveAuthStore.getStateSync"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_interactiveAuth_$store$_update",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "interactiveAuthStore.onStateChange"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_isFolderTrusted",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isFolderTrusted"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_kickBridgePoll",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "kickBridgePoll"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_listLocalSkills",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listLocalSkills"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_mcpAuthenticate",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "mcpAuthenticate"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_mcpCallTool",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "mcpCallTool"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_mcpListResources",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "mcpListResources"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_mcpReadResource",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "mcpReadResource"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_mcpReconnect",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "mcpReconnect"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_mcpSubmitOAuthCallbackUrl",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "mcpSubmitOAuthCallbackUrl"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_noteCuWindowMentions",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "noteCuWindowMentions"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_onBridgePermissionPreflight",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnBridgePermissionPreflight"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_onCoworkFromMain",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnCoworkFromMain"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_onCuEmergencyStop",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnCuEmergencyStop"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_onDirectMcpServerStatusesChanged",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnDirectMcpServerStatusesChanged"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_onEvent",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnEvent"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_onManagedAskToolNamesChanged",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnManagedAskToolNamesChanged"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_onRemoteSessionStart",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnRemoteSessionStart"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_onToolPermissionRequest",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnToolPermissionRequest"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_openOutputsDir",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openOutputsDir"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_refetchMyAccess",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "refetchMyAccess"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_releaseRemoteCuLock",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "releaseRemoteCuLock"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_removeTrustedFolder",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "removeTrustedFolder"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_replaceEnabledMcpTools",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "replaceEnabledMcpTools"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_replaceRemoteMcpServers",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "replaceRemoteMcpServers"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_requestDocumentsTccAccess",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "requestDocumentsTccAccess"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_requestFolderTccAccess",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "requestFolderTccAccess"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_resetBridge",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "resetBridge"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_resetBridgeSession",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "resetBridgeSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_respondBridgePermissionPreflight",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "respondBridgePermissionPreflight"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_respondDirectoryServers",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "respondDirectoryServers"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_respondPluginSearch",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "respondPluginSearch"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_respondSlashMenuSkills",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "respondSlashMenuSkills"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_respondToToolPermission",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "respondToToolPermission"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_revealLocalSkill",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "revealLocalSkill"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_revokeInteractiveAuth",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "revokeInteractiveAuth"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_rewind",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "rewind"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_saveLocalSkill",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "saveLocalSkill"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_searchSessions",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "searchSessions"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_sendMessage",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "sendMessage"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_sessionsBridgeStatus_$store$_getState",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "sessionsBridgeStatusStore.getState"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_sessionsBridgeStatus_$store$_getStateSync",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "sendSync"
    ],
    "publicPaths": [
      "sessionsBridgeStatusStore.getStateSync"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_sessionsBridgeStatus_$store$_update",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "sessionsBridgeStatusStore.onStateChange"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_setChromePermissionMode",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setChromePermissionMode"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_setDraftSessionFolders",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setDraftSessionFolders"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_setEffort",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setEffort"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_setExtendedThinking",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setExtendedThinking"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_setFocusedSession",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setFocusedSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_setLocalSkillEnabled",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setLocalSkillEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_setMcpServers",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setMcpServers"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_setModel",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setModel"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_setPermissionMode",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setPermissionMode"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_setSessionsBridgeEnabled",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setSessionsBridgeEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_shareSession",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "shareSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_signalSessionIntent",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "signalSessionIntent"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_start",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "start"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_startWatchRecording",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "startWatchRecording"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_stop",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "stop"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_stopTask",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "stopTask"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_submitTranscriptFeedback",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "submitTranscriptFeedback"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_syncSkills",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "syncSkills"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_takeHeldWatchRecording",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "takeHeldWatchRecording"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_triggerInteractiveAuth",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "triggerInteractiveAuth"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_updateSession",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "updateSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalAgentModeSessions_$_watchRecordingComplete",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onWatchRecordingComplete"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_deletePlugin",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "deletePlugin"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_getDownloadedRemotePlugins",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getDownloadedRemotePlugins"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_getPluginCliBatch",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getPluginCliBatch"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_getPluginCliStatus",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getPluginCliStatus"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_getPluginOAuthStatus",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getPluginOAuthStatus"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_getPlugins",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getPlugins"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_getPluginShimOps",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getPluginShimOps"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_listSkillFiles",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listSkillFiles"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_onCliOpAlwaysAllowed",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnCliOpAlwaysAllowed"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_revokePluginOAuth",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "revokePluginOAuth"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_setPluginEnabled",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setPluginEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_setPluginEnvVars",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setPluginEnvVars"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_setPluginOAuthClient",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setPluginOAuthClient"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_setPluginShimPermission",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setPluginShimPermission"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_startPluginOAuthFlow",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "startPluginOAuthFlow"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_syncRemotePlugins",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "syncRemotePlugins"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalPlugins_$_uploadPlugin",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "uploadPlugin"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessionEnvironment_$_get",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "get"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessionEnvironment_$_save",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "save"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_addDirectories",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "addDirectories"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_applyFlagSettings",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "applyFlagSettings"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_archive",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "archive"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_beginTearOffHalo",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "beginTearOffHalo"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_cancelQueuedMessage",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "cancelQueuedMessage"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_changeCwd",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "changeCwd"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_checkBranchSwitchConflict",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "checkBranchSwitchConflict"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_checkGhAvailable",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "checkGhAvailable"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_checkRemoteTargetTrust",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "checkRemoteTargetTrust"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_checkRemoteTrust",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "checkRemoteTrust"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_checkTrust",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "checkTrust"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_classifyTccFolderKind",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "classifyTccFolderKind"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_clearSession",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "clearSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_commitAllChanges",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "commitAllChanges"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_commitWipForBranchSwitch",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "commitWipForBranchSwitch"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_createAgent",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "createAgent"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_createLocalPr",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "createLocalPr"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_createPrReviewComment",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "createPrReviewComment"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_delete",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "delete"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_dequeuePr",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "dequeuePr"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_disableAutoMerge",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "disableAutoMerge"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_discardWorkingTree",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "discardWorkingTree"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_dismissBoundPr",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "dismissBoundPr"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_enableAutoMerge",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "enableAutoMerge"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_endTearOffHalo",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "endTearOffHalo"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_ensureBranchPushed",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "ensureBranchPushed"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_ensureSSHConnected",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "ensureSSHConnected"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_findLocalSessionIdForBridgeId",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "findLocalSessionIdForBridgeId"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_forkSession",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "forkSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_generateLocalPrContent",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "generateLocalPrContent"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getAgents",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getAgents"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getAll",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getAll"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getBusyShellPtyKeys",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getBusyShellPtyKeys"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getCheckRunAnnotations",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getCheckRunAnnotations"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getCodeStats",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getCodeStats"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getCommitDiff",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getCommitDiff"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getContextUsage",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getContextUsage"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getCrCliStatus",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getCrCliStatus"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getCrForSession",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getCrForSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getCrRefSummary",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getCrRefSummary"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getDefaultEffort",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getDefaultEffort"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getDefaultPermissionMode",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getDefaultPermissionMode"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getDetectedProjects",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getDetectedProjects"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getDiffFileContent",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getDiffFileContent"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getEffort",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getEffort"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getGhIssue",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getGhIssue"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getGhRefSummary",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getGhRefSummary"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getGitCommits",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getGitCommits"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getGitDiff",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getGitDiff"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getGitDiffFilePatch",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getGitDiffFilePatch"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getGitDiffStats",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getGitDiffStats"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getGitInfo",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getGitInfo"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getInstalledEditors",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getInstalledEditors"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getLocalBranches",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getLocalBranches"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getLocalMcpServers",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getLocalMcpServers"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getMacTccRecoveryInfo",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getMacTccRecoveryInfo"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getPermissionMode",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getPermissionMode"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getPlanForSession",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getPlanForSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getPrChecks",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getPrChecks"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getPrCommits",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getPrCommits"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getPrDetails",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getPrDetails"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getPrOverview",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getPrOverview"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getPrReviewComments",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getPrReviewComments"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getPrStateForBranch",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getPrStateForBranch"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getRemoteCommitDiff",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getRemoteCommitDiff"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getRemoteDiffFileContent",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getRemoteDiffFileContent"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getRemoteGitCommits",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getRemoteGitCommits"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getRemoteGitDiff",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getRemoteGitDiff"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getRemoteGitDiffStats",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getRemoteGitDiffStats"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getRemoteGitInfo",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getRemoteGitInfo"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSession",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSessionMediaStreamUrl",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSessionMediaStreamUrl"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSessionPanelMediaStreamUrl",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSessionPanelMediaStreamUrl"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSessionsForScheduledTask",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSessionsForScheduledTask"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getShellPtyBuffer",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getShellPtyBuffer"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSSHCommitDiff",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSSHCommitDiff"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSSHConfigs",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSSHConfigs"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSSHDiffFileContent",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSSHDiffFileContent"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSSHGitCommits",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSSHGitCommits"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSSHGitDiff",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSSHGitDiff"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSSHGitDiffStats",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSSHGitDiffStats"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSSHGitInfo",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSSHGitInfo"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSSHLocalBranches",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSSHLocalBranches"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSSHSupportedCommands",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSSHSupportedCommands"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getSupportedCommands",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getSupportedCommands"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getTeleportReadiness",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getTeleportReadiness"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getTranscript",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getTranscript"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getTrustedSSHHosts",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getTrustedSSHHosts"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getUncommittedChanges",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getUncommittedChanges"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_getWorkingTreeStatus",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getWorkingTreeStatus"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_importCliSession",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "importCliSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_installGh",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "installGh"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_interrupt",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "interrupt"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_isVSCodeInstalled",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isVSCodeInstalled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_isWorkingTreeDirty",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "isWorkingTreeDirty"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_launchUltrareview",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "launchUltrareview"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_listGhIssues",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listGhIssues"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_listSessionDirectory",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listSessionDirectory"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_listSSHDirectory",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listSSHDirectory"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_listWslDistros",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listWslDistros"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_logCliEvent",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "logCliEvent"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_markPrDraft",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "markPrDraft"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_markPrReady",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "markPrReady"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_mcpAuthenticate",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "mcpAuthenticate"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_mcpCallTool",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "mcpCallTool"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_mcpListResources",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "mcpListResources"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_mcpReadResource",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "mcpReadResource"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_mcpReconnect",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "mcpReconnect"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_mcpSubmitOAuthCallbackUrl",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "mcpSubmitOAuthCallbackUrl"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_mergePr",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "mergePr"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_notifySpawnedTaskStarted",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "notifySpawnedTaskStarted"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_onEvent",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnEvent"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_onSSHPasswordRequired",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnSSHPasswordRequired"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_onToolPermissionRequest",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnToolPermissionRequest"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_openInEditor",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openInEditor"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_openInVSCode",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openInVSCode"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_openMacFilesAndFoldersSettings",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openMacFilesAndFoldersSettings"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_openSessionFileInDefaultApp",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "openSessionFileInDefaultApp"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_pickFileAtCwd",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "pickFileAtCwd"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_pickSessionFile",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "pickSessionFile"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_popBackgroundTaskSuggestion",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "popBackgroundTaskSuggestion"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_popBackgroundTaskSuggestionById",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "popBackgroundTaskSuggestionById"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_promoteQueuedMessage",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "promoteQueuedMessage"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_readFileAtCwd",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "readFileAtCwd"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_readSessionFile",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "readSessionFile"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_readSessionImageAsDataUrl",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "readSessionImageAsDataUrl"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_readSessionMediaAsDataUrl",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "readSessionMediaAsDataUrl"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_readSessionPanelMediaAsDataUrl",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "readSessionPanelMediaAsDataUrl"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_reorderQueuedMessage",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "reorderQueuedMessage"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_replaceEnabledMcpTools",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "replaceEnabledMcpTools"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_replaceRemoteMcpServers",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "replaceRemoteMcpServers"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_replyToPrReviewComment",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "replyToPrReviewComment"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_reportComposerInp",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "reportComposerInp"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_reportStreamRender",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "reportStreamRender"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_reportSwitchTiming",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "reportSwitchTiming"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_rerunPrCheck",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "rerunPrCheck"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_resizePty",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "resizePty"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_resizeShellPty",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "resizeShellPty"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_resolvePrReviewThread",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "resolvePrReviewThread"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_resolveSessionFile",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "resolveSessionFile"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_resolveSSHSettings",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "resolveSSHSettings"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_respondToRefusalFallbackPrompt",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "respondToRefusalFallbackPrompt"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_respondToSSHPassword",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "respondToSSHPassword"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_respondToToolPermission",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "respondToToolPermission"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_resumePreClearSession",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "resumePreClearSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_revealRemotePath",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "revealRemotePath"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_reviewDiff",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "reviewDiff"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_rewind",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "rewind"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_rewindV2",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "rewindV2"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_runBashCommand",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "runBashCommand"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_saveTrust",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "saveTrust"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_searchSessions",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "searchSessions"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_sendMessage",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "sendMessage"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_sendSideChatMessage",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "sendSideChatMessage"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setAccountBranchPrefix",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setAccountBranchPrefix"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setAutoFixEnabled",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setAutoFixEnabled"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setAvailableCodeModels",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setAvailableCodeModels"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setEffort",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setEffort"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setFastMode",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setFastMode"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setFocusedSession",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setFocusedSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setMcpServers",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setMcpServers"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setModel",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setModel"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setPermissionMode",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setPermissionMode"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setSSHConfigs",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setSSHConfigs"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setTearOffHalo",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setTearOffHalo"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setTrustedSSHHosts",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setTrustedSSHHosts"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_setVisibility",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setVisibility"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_shareSession",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "shareSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_showSessionFileInFolder",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "showSessionFileInFolder"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_showSessionFilePreview",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "showSessionFilePreview"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_start",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "start"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_startPty",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "startPty"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_startShellPty",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "startShellPty"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_startSideChat",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "startSideChat"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_stashWorkingTree",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "stashWorkingTree"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_stop",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "stop"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_stopPty",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "stopPty"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_stopSessionSummary",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "stopSessionSummary"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_stopShellPty",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "stopShellPty"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_stopSideChat",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "stopSideChat"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_stopTask",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "stopTask"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_submitFeedback",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "submitFeedback"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_submitPrReview",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "submitPrReview"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_summarizeSession",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "summarizeSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_summarizeTranscript",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "summarizeTranscript"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_teleportToCloud",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "teleportToCloud"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_testSSHConnection",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "testSSHConnection"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_unarchive",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "unarchive"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_updatePrBody",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "updatePrBody"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_updatePrComment",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "updatePrComment"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_updateSession",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "updateSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_validateSSHPath",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "validateSSHPath"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_warmSession",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "warmSession"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_writePty",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "writePty"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_writeSessionFile",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "writeSessionFile"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_LocalSessions_$_writeShellPty",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "writeShellPty"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_MenuEvents_$_closeWindow",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onCloseWindow"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_MenuEvents_$_openFile",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOpenFile"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_MenuEvents_$_toggleSidebar",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onToggleSidebar"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Navigation_$_navigate",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onNavigate"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_NestDev_$_focus",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "focus"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_NestDev_$_getState",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getState"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_OpenDocuments_$_getOpenDocuments",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getOpenDocuments"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_OpenDocuments_$_readOpenDocumentAsBase64",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "readOpenDocumentAsBase64"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_PluginBridgeMcp_$_changed",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onChanged"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_PluginBridgeMcp_$_listServers",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listServers"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_QuickEntry_$_onQuickEntrySubmit",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onOnQuickEntrySubmit"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_QuickEntry_$_setRecentChats",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setRecentChats"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Resources_$_fetchMentionOptions",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "fetchMentionOptions"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Resources_$_findRequested",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onFindRequested"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Resources_$_findStepRequested",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onFindStepRequested"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Resources_$_handleMentionSelect",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "handleMentionSelect"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Resources_$_listProjectFiles",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "listProjectFiles"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Resources_$_searchFileContents",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "searchFileContents"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Resources_$_setFindInPageClaimed",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setFindInPageClaimed"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Resources_$_setFocusedCwd",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setFocusedCwd"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Resources_$_setFocusedSshTarget",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setFocusedSshTarget"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_Toast_$_showToast",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onShowToast"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WebBuild_$_reportCommitHash",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "reportCommitHash"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowControl_$_captureScreenshot",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "captureScreenshot"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowControl_$_close",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "close"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowControl_$_focus",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "focus"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowControl_$_reportModalScrim",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "reportModalScrim"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowControl_$_resize",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "resize"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowControl_$_setIncognitoMode",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setIncognitoMode"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowControl_$_setModalScrimActive",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setModalScrimActive"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowControl_$_setThemeMode",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "setThemeMode"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowState_$_cuDockStateChanged",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onCuDockStateChanged"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowState_$_fullscreenChanged",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onFullscreenChanged"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowState_$_getFullscreen",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getFullscreen"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowState_$_getVisibility",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getVisibility"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowState_$_getZoomFactor",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "getZoomFactor"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowState_$_visibilityChanged",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onVisibilityChanged"
    ]
  },
  {
    "channel": "$eipc_message$_a3c4a891-9853-4d43-a458-15bf331c5387_$_claude.web_$_WindowState_$_zoomFactorChanged",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onZoomFactorChanged"
    ]
  },
  {
    "channel": "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_DestroyWindow",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "DestroyWindow"
    ]
  },
  {
    "channel": "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_GetWindowState",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "GetWindowState"
    ]
  },
  {
    "channel": "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_RegisterWindow",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "RegisterWindow"
    ]
  },
  {
    "channel": "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_UnregisterWindow",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "UnregisterWindow"
    ]
  },
  {
    "channel": "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_UpdateWindow",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "UpdateWindow"
    ]
  },
  {
    "channel": "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_WindowAction",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "invoke"
    ],
    "publicPaths": [
      "WindowAction"
    ]
  },
  {
    "channel": "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_WindowEvent",
    "files": [
      "mainView.js"
    ],
    "rendererOperations": [
      "on",
      "removeListener"
    ],
    "publicPaths": [
      "onWindowEvent"
    ]
  }
] as const satisfies readonly PreloadChannelContract[];

