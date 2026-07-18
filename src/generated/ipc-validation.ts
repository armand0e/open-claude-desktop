// Generated from validation guards in the locally installed bundle.
export interface ValueValidation { readonly validation: string; }
export interface ArgumentValidation extends ValueValidation { readonly name: string; readonly position: number; }
export interface ChannelValidation { readonly arguments: readonly ArgumentValidation[]; readonly result: ValueValidation | null; }
export const IPC_VALIDATION = {
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.buddy_$_Buddy_$_deviceStatus": {
    "arguments": [],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.buddy_$_Buddy_$_install": {
    "arguments": [
      {
        "name": "folderPath",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.buddy_$_Buddy_$_pairDevice": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.buddy_$_Buddy_$_pairingPrompt": {
    "arguments": [
      {
        "name": "deviceName",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.buddy_$_Buddy_$_pickDevice": {
    "arguments": [
      {
        "name": "id",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.buddy_$_Buddy_$_pickFolder": {
    "arguments": [],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.buddy_$_Buddy_$_preview": {
    "arguments": [
      {
        "name": "folderPath",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.buddy_$_Buddy_$_progress": {
    "arguments": [
      {
        "name": "msg",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.buddy_$_Buddy_$_scanDevices": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.buddy_$_Buddy_$_setName": {
    "arguments": [
      {
        "name": "name",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.buddy_$_Buddy_$_status": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.buddy_$_Buddy_$_submitPin": {
    "arguments": [
      {
        "name": "pin",
        "position": 0,
        "validation": "null | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.buddy_$_BuddyBleTransport_$_log": {
    "arguments": [
      {
        "name": "msg",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.buddy_$_BuddyBleTransport_$_reportState": {
    "arguments": [
      {
        "name": "state",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "name",
        "position": 1,
        "validation": "null | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.buddy_$_BuddyBleTransport_$_rx": {
    "arguments": [
      {
        "name": "line",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.buddy_$_BuddyBleTransport_$_tx": {
    "arguments": [
      {
        "name": "line",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.coworkArtifact_$_CoworkArtifactBridge_$_askClaude": {
    "arguments": [
      {
        "name": "prompt",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "data",
        "position": 1,
        "validation": "undefined | array (item schema validated)"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.coworkArtifact_$_CoworkArtifactBridge_$_callMcpTool": {
    "arguments": [
      {
        "name": "tool",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "preloadContext",
        "position": 2,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.coworkArtifact_$_CoworkArtifactBridge_$_navigateHost": {
    "arguments": [
      {
        "name": "direction",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.coworkArtifact_$_CoworkArtifactBridge_$_openExternalUrl": {
    "arguments": [
      {
        "name": "url",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.coworkArtifact_$_CoworkArtifactBridge_$_runScheduledTask": {
    "arguments": [
      {
        "name": "taskId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "preloadContext",
        "position": 1,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.hybrid_$_DesktopIntl_$_getInitialLocale": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.hybrid_$_DesktopIntl_$_localeChanged": {
    "arguments": [
      {
        "name": "locale",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.hybrid_$_DesktopIntl_$_requestLocaleChange": {
    "arguments": [
      {
        "name": "locale",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.internal.findInPage_$_FindInPage_$_findInPage": {
    "arguments": [
      {
        "name": "text",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "options",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.internal.findInPage_$_FindInPage_$_stepToMatch": {
    "arguments": [
      {
        "name": "forward",
        "position": 0,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.internal.ui_$_AboutWindow_$_getAppName": {
    "arguments": [],
    "result": {
      "validation": "string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.internal.ui_$_AboutWindow_$_getBuildProps": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.internal.ui_$_MainWindowTitleBar_$_isClaudeCurrentlyHealthy": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.internal.ui_$_MainWindowTitleBar_$_showLoadError": {
    "arguments": [
      {
        "name": "details",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.internal.ui_$_MainWindowTitleBar_$_updateTitleBar": {
    "arguments": [
      {
        "name": "title",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.internal.ui_$_QuickWindow_$_requestDismiss": {
    "arguments": [
      {
        "name": "promptText",
        "position": 0,
        "validation": "null | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.internal.ui_$_QuickWindow_$_requestDismissWithPayload": {
    "arguments": [
      {
        "name": "payload",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.internal.ui_$_QuickWindow_$_requestSkooch": {
    "arguments": [
      {
        "name": "contentWidth",
        "position": 0,
        "validation": "number"
      },
      {
        "name": "contentHeight",
        "position": 1,
        "validation": "number"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.officeAddin_$_OfficeAddinFiles_$_focusFile": {
    "arguments": [
      {
        "name": "fileId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.officeAddin_$_OfficeAddinFiles_$_getConnectedFiles": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.officeAddin_$_OfficeAddinFiles_$_isFeatureEnabled": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.officeAddin_$_OfficeAddinFiles_$_onFileAdded": {
    "arguments": [
      {
        "name": "file",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.officeAddin_$_OfficeAddinFiles_$_onFileRemoved": {
    "arguments": [
      {
        "name": "fileId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.officeAddin_$_OfficeAddinFiles_$_onFileStateChanged": {
    "arguments": [
      {
        "name": "file",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.officeAddin_$_OfficeAddinFiles_$_selectFile": {
    "arguments": [
      {
        "name": "fileId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.officeAddin_$_OfficeAddinFiles_$_updateActiveConversationSummary": {
    "arguments": [
      {
        "name": "summary",
        "position": 0,
        "validation": "null | custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_AppConfig_$_getAppConfig": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_AppConfig_$_setAppFeature": {
    "arguments": [
      {
        "name": "feature",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "enabled",
        "position": 1,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_AppConfig_$_setIsDxtAutoUpdatesEnabled": {
    "arguments": [
      {
        "name": "enabled",
        "position": 0,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_AppConfig_$_setIsUsingBuiltInNodeForMcp": {
    "arguments": [
      {
        "name": "enabled",
        "position": 0,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_AppFeatures_$_getSupportedFeatures": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_AppPreferences_$_getPreferences": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_AppPreferences_$_preferencesChanged": {
    "arguments": [
      {
        "name": "preferences",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_AppPreferences_$_setPreference": {
    "arguments": [
      {
        "name": "key",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_CcdCli_$_getCcdCliStatus": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_CcdCli_$_installCcdCli": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_CcdCli_$_uninstallCcdCli": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_ClaudeAiImport_$_getAuthState": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_ClaudeAiImport_$_isAvailable": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_ClaudeAiImport_$_onAuthStateChange": {
    "arguments": [
      {
        "name": "state",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_ClaudeAiImport_$_onAuthUserCode": {
    "arguments": [
      {
        "name": "code",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_ClaudeAiImport_$_runImport": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pHelperRun_$_discoverModels": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pHelperRun_$_probeDeviceCode": {
    "arguments": [
      {
        "name": "userCode",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "verificationUri",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pHelperRun_$_probeInference": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pHelperRun_$_runCredentialHelper": {
    "arguments": [
      {
        "name": "helperPath",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "env",
        "position": 1,
        "validation": "undefined | custom schema validated"
      },
      {
        "name": "timeoutSec",
        "position": 2,
        "validation": "undefined | number"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_authorizeAndProbeMcpServer": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_createConfig": {
    "arguments": [
      {
        "name": "name",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_deleteConfig": {
    "arguments": [
      {
        "name": "id",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_duplicateConfig": {
    "arguments": [
      {
        "name": "sourceId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "name",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_exportConfig": {
    "arguments": [
      {
        "name": "format",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_forgetMcpOAuth": {
    "arguments": [
      {
        "name": "serverName",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_getConfigHealth": {
    "arguments": [],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_getLoginDesktop3pStatus": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_listConfigs": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_probeEgressHosts": {
    "arguments": [
      {
        "name": "hosts",
        "position": 0,
        "validation": "string[]"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_probeMcpServer": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_readConfig": {
    "arguments": [
      {
        "name": "id",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_recheckConfigHealth": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_renameConfig": {
    "arguments": [
      {
        "name": "id",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "name",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_revealConfig": {
    "arguments": [
      {
        "name": "id",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_scanOrgPlugins": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_setAppliedConfig": {
    "arguments": [
      {
        "name": "id",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_setDeploymentMode": {
    "arguments": [
      {
        "name": "mode",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_signInWithAnthropicApi": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_triggerBootstrapAuth": {
    "arguments": [
      {
        "name": "args",
        "position": 0,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Custom3pSetup_$_writeConfig": {
    "arguments": [
      {
        "name": "id",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_DesktopInfo_$_getSystemInfo": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_deleteExtension": {
    "arguments": [
      {
        "name": "extensionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_extensionDownloadProgress": {
    "arguments": [
      {
        "name": "extensionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "progress",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "receivedBytes",
        "position": 2,
        "validation": "number"
      },
      {
        "name": "totalBytes",
        "position": 3,
        "validation": "number"
      },
      {
        "name": "manifest",
        "position": 4,
        "validation": "null | custom schema validated"
      },
      {
        "name": "phase",
        "position": 5,
        "validation": "null | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_extensionSettingsChanged": {
    "arguments": [
      {
        "name": "extensionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "settings",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_getAvailableExtensionRuntimes": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_getDirectoryUrl": {
    "arguments": [],
    "result": {
      "validation": "string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_getExtension": {
    "arguments": [
      {
        "name": "request",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_getExtensions": {
    "arguments": [
      {
        "name": "request",
        "position": 0,
        "validation": "null | custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_getExtensionSettings": {
    "arguments": [
      {
        "name": "extensionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_getInstalledExtensionsWithState": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_getIsUpdateAvailable": {
    "arguments": [
      {
        "name": "extensionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "manifest",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_getManifestCompatibilityResult": {
    "arguments": [
      {
        "name": "manifest",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_handleDxtFile": {
    "arguments": [
      {
        "name": "dxtPath",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_installDxt": {
    "arguments": [
      {
        "name": "extensionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "dxtFilePath",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_installDxtFromDirectory": {
    "arguments": [
      {
        "name": "extensionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "version",
        "position": 1,
        "validation": "null | string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_installDxtUnpacked": {
    "arguments": [
      {
        "name": "folderPath",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_installExtensionFromPreview": {
    "arguments": [
      {
        "name": "extensionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "path",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_isDesktopExtensionDirectoryEnabled": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_isDesktopExtensionSignatureRequired": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_isDirectoryEnabled": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_isExtensionsEnabled": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_isLocalExtensionInstallAllowed": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_previewExtensionInstallation": {
    "arguments": [
      {
        "name": "manifest",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "path",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "extensionId",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "signatureInfo",
        "position": 3,
        "validation": "null | custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_setExtensionSettings": {
    "arguments": [
      {
        "name": "extensionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "settings",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Extensions_$_showExtensionInFolder": {
    "arguments": [
      {
        "name": "extensionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_FilePickers_$_getDirectoryPath": {
    "arguments": [
      {
        "name": "multiple",
        "position": 0,
        "validation": "boolean"
      }
    ],
    "result": {
      "validation": "string[]"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_FilePickers_$_getFilePath": {
    "arguments": [
      {
        "name": "multiple",
        "position": 0,
        "validation": "boolean"
      }
    ],
    "result": {
      "validation": "string[]"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_GlobalShortcut_$_getGlobalShortcut": {
    "arguments": [],
    "result": {
      "validation": "string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_GlobalShortcut_$_globalShortcutChange": {
    "arguments": [
      {
        "name": "globalShortcut",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_GlobalShortcut_$_setGlobalShortcut": {
    "arguments": [
      {
        "name": "globalShortcut",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_MCP_$_getMcpServersConfig": {
    "arguments": [
      {
        "name": "forceReload",
        "position": 0,
        "validation": "null | boolean"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_MCP_$_getMcpServersConfigWithStatus": {
    "arguments": [],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_MCP_$_isLocalDevMcpEnabled": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_MCP_$_mcpConfigChange": {
    "arguments": [
      {
        "name": "configs",
        "position": 0,
        "validation": "null | custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_MCP_$_mcpStatusChanged": {
    "arguments": [
      {
        "name": "name",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "status",
        "position": 1,
        "validation": "custom schema validated"
      },
      {
        "name": "error",
        "position": 2,
        "validation": "null | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_MCP_$_revealMcpServerSettingsRequested": {
    "arguments": [
      {
        "name": "serverName",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_MCP_$_revealServerLog": {
    "arguments": [
      {
        "name": "serverName",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_MCP_$_setMcpServerConfigs": {
    "arguments": [
      {
        "name": "configs",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Startup_$_isMenuBarEnabled": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Startup_$_isStartupOnLoginEnabled": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Startup_$_setMenuBarEnabled": {
    "arguments": [
      {
        "name": "enabled",
        "position": 0,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_Startup_$_setStartupOnLoginEnabled": {
    "arguments": [
      {
        "name": "enabled",
        "position": 0,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_SupportBundle_$_submitAction": {
    "arguments": [
      {
        "name": "action",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.settings_$_WakeScheduler_$_getStatus": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.simulator_$_Simulator_$_attach": {
    "arguments": [
      {
        "name": "udid",
        "position": 0,
        "validation": "undefined | string"
      },
      {
        "name": "deviceName",
        "position": 1,
        "validation": "undefined | string"
      },
      {
        "name": "kind",
        "position": 2,
        "validation": "undefined | string"
      },
      {
        "name": "autoBoot",
        "position": 3,
        "validation": "undefined | boolean"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.simulator_$_Simulator_$_detach": {
    "arguments": [
      {
        "name": "udid",
        "position": 0,
        "validation": "undefined | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.simulator_$_Simulator_$_gesture": {
    "arguments": [
      {
        "name": "udid",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "msg",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.simulator_$_Simulator_$_installAndLaunch": {
    "arguments": [
      {
        "name": "req",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.simulator_$_Simulator_$_listDevices": {
    "arguments": [
      {
        "name": "kind",
        "position": 0,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.simulator_$_Simulator_$_saveScreenshot": {
    "arguments": [
      {
        "name": "udid",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.simulator_$_Simulator_$_setEditShortcutsClaimed": {
    "arguments": [
      {
        "name": "udid",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "claimed",
        "position": 1,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.simulator_$_Simulator_$_startRecording": {
    "arguments": [
      {
        "name": "udid",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.simulator_$_Simulator_$_stopRecording": {
    "arguments": [
      {
        "name": "udid",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.skills_$_Skills_$_previewSkillFile": {
    "arguments": [
      {
        "name": "data",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "filename",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Account_$_setAccountDetails": {
    "arguments": [
      {
        "name": "info",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_AgentModeFeedback_$_openFeedbackAndConfirmReinstall": {
    "arguments": [
      {
        "name": "options",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_AgentModeFeedback_$_openFeedbackWindow": {
    "arguments": [
      {
        "name": "options",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_AgentModeFeedback_$_reportErrorToSlack": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "undefined | string"
      },
      {
        "name": "errorMessage",
        "position": 1,
        "validation": "undefined | string"
      },
      {
        "name": "slackChannelUrl",
        "position": 2,
        "validation": "undefined | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Auth_$_doAuthInBrowser": {
    "arguments": [
      {
        "name": "url",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_AutoUpdater_$_getRunningLocalSessionCount": {
    "arguments": [],
    "result": {
      "validation": "number"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_AutoUpdater_$_getRunningLocalSessions": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_AutoUpdater_$_restartToUpdate": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_AutoUpdater_$_restartToUpdateWhenIdle": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_BrowserNavigation_$_reportNavigationState": {
    "arguments": [
      {
        "name": "state",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_BuddyRemoteFeed_$_permissionDecision": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "requestId",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "decision",
        "position": 2,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_BuddyRemoteFeed_$_sync": {
    "arguments": [
      {
        "name": "sessions",
        "position": 0,
        "validation": "array (item schema validated)"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CCDScheduledTasks_$_createScheduledTask": {
    "arguments": [
      {
        "name": "params",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CCDScheduledTasks_$_getAllScheduledTasks": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CCDScheduledTasks_$_getScheduledTaskFileContent": {
    "arguments": [
      {
        "name": "scheduledTaskId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CCDScheduledTasks_$_getWatcherHistory": {
    "arguments": [
      {
        "name": "scheduledTaskId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CCDScheduledTasks_$_markListenerReady": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CCDScheduledTasks_$_onScheduledTaskEvent": {
    "arguments": [
      {
        "name": "event",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CCDScheduledTasks_$_removeApprovedPermission": {
    "arguments": [
      {
        "name": "scheduledTaskId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "toolName",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "ruleContent",
        "position": 2,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CCDScheduledTasks_$_updateScheduledTask": {
    "arguments": [
      {
        "name": "params",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CCDScheduledTasks_$_updateScheduledTaskFileContent": {
    "arguments": [
      {
        "name": "scheduledTaskId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "content",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CCDScheduledTasks_$_updateScheduledTaskStatus": {
    "arguments": [
      {
        "name": "scheduledTaskId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "status",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "removeFiles",
        "position": 2,
        "validation": "undefined | boolean"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ChromeExtension_$_installExtension": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ChromeExtension_$_isInstalled": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ChromeExtension_$_restartChrome": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeCode_$_checkGitAvailable": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeCode_$_getPeriodUsage": {
    "arguments": [],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeCode_$_getStatus": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeCode_$_patchUserSettings": {
    "arguments": [
      {
        "name": "patch",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeCode_$_prepare": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeCode_$_resolveLocalSettings": {
    "arguments": [
      {
        "name": "workspacePath",
        "position": 0,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeCode_$_setEnableWorkflows": {
    "arguments": [
      {
        "name": "value",
        "position": 0,
        "validation": "undefined | boolean"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeVM_$_checkVirtualMachinePlatform": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeVM_$_download": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeVM_$_downloadProgress": {
    "arguments": [
      {
        "name": "percent",
        "position": 0,
        "validation": "number"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeVM_$_downloadStatusChanged": {
    "arguments": [
      {
        "name": "status",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeVM_$_enableVirtualMachinePlatform": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeVM_$_getDownloadStatus": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeVM_$_getRunningStatus": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeVM_$_isHostLoopDevOverrideActive": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeVM_$_isHostLoopModeEnabled": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeVM_$_restartAfterVMPInstall": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeVM_$_runningStatusChanged": {
    "arguments": [
      {
        "name": "status",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeVM_$_setForceDisableHostLoop": {
    "arguments": [
      {
        "name": "value",
        "position": 0,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeVM_$_setYukonSilverConfig": {
    "arguments": [
      {
        "name": "config",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeVM_$_startupError": {
    "arguments": [
      {
        "name": "error",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ClaudeVM_$_startVM": {
    "arguments": [
      {
        "name": "options",
        "position": 0,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ComputerUseTcc_$_getCurrentSessionGrants": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ComputerUseTcc_$_getState": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ComputerUseTcc_$_listInstalledApps": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ComputerUseTcc_$_openSystemSettings": {
    "arguments": [
      {
        "name": "pane",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ComputerUseTcc_$_requestAccessibility": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ComputerUseTcc_$_requestScreenRecording": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_ComputerUseTcc_$_revokeGrant": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "bundleId",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_deleteArtifact": {
    "arguments": [
      {
        "name": "artifactId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "removeFiles",
        "position": 1,
        "validation": "undefined | boolean"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_getAllArtifacts": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_getArtifactIndexHtmlPath": {
    "arguments": [
      {
        "name": "artifactId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_getArtifactMetadata": {
    "arguments": [
      {
        "name": "artifactId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_getArtifactThumbnail": {
    "arguments": [
      {
        "name": "artifactId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_hideArtifact": {
    "arguments": [
      {
        "name": "targetWindowId",
        "position": 0,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_importArtifact": {
    "arguments": [
      {
        "name": "artifactUuid",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_isAutoPublishEnabled": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_isSharingEnabled": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_parkAndCaptureArtifact": {
    "arguments": [
      {
        "name": "bounds",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "targetWindowId",
        "position": 1,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_printArtifactToPdf": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_refreshImportedArtifact": {
    "arguments": [
      {
        "name": "artifactId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_reloadArtifactView": {
    "arguments": [],
    "result": {
      "validation": "number"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_restoreArtifactVersion": {
    "arguments": [
      {
        "name": "artifactId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "version",
        "position": 1,
        "validation": "number"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_setArtifactAutoPublish": {
    "arguments": [
      {
        "name": "artifactId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "enabled",
        "position": 1,
        "validation": "boolean"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_setArtifactLastModifiedSession": {
    "arguments": [
      {
        "name": "artifactId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "sessionId",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_setArtifactMcpTools": {
    "arguments": [
      {
        "name": "artifactId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "tools",
        "position": 1,
        "validation": "string[]"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_setArtifactStarred": {
    "arguments": [
      {
        "name": "artifactId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "starred",
        "position": 1,
        "validation": "boolean"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_shareArtifact": {
    "arguments": [
      {
        "name": "artifactId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_showArtifact": {
    "arguments": [
      {
        "name": "artifactId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "bounds",
        "position": 1,
        "validation": "custom schema validated"
      },
      {
        "name": "version",
        "position": 2,
        "validation": "undefined | number"
      },
      {
        "name": "targetWindowId",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "number"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkArtifacts_$_unshareArtifact": {
    "arguments": [
      {
        "name": "artifactId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkFeedback_$_captureScreenshot": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkFeedback_$_discardScreenshot": {
    "arguments": [
      {
        "name": "token",
        "position": 0,
        "validation": "undefined | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkFeedback_$_getScreenshotDataUrl": {
    "arguments": [
      {
        "name": "token",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkFeedback_$_getSystemInfo": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkFeedback_$_submitFeedback": {
    "arguments": [
      {
        "name": "form",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkFilePreview_$_hide": {
    "arguments": [
      {
        "name": "consumerId",
        "position": 0,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkFilePreview_$_isEnabled": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkFilePreview_$_isEpitaxyPreviewEnabled": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkFilePreview_$_isOpenInDefaultAppEnabled": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkFilePreview_$_isVmReady": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkFilePreview_$_parkAndCapture": {
    "arguments": [
      {
        "name": "bounds",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "consumerId",
        "position": 1,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkFilePreview_$_show": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "path",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "bounds",
        "position": 2,
        "validation": "custom schema validated"
      },
      {
        "name": "consumerId",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkMemory_$_deleteAccountMemory": {
    "arguments": [
      {
        "name": "path",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkMemory_$_listAccountMemories": {
    "arguments": [
      {
        "name": "includeContent",
        "position": 0,
        "validation": "undefined | boolean"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkMemory_$_readAccountMemory": {
    "arguments": [
      {
        "name": "path",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkMemory_$_readGlobalMemory": {
    "arguments": [],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkMemory_$_resetMemories": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkMemory_$_writeAccountMemory": {
    "arguments": [
      {
        "name": "path",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "content",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkMemory_$_writeGlobalMemory": {
    "arguments": [
      {
        "name": "content",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkScheduledTasks_$_clearChromePermissions": {
    "arguments": [
      {
        "name": "scheduledTaskId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkScheduledTasks_$_createScheduledTask": {
    "arguments": [
      {
        "name": "params",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkScheduledTasks_$_getAllScheduledTasks": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkScheduledTasks_$_getScheduledTaskFileContent": {
    "arguments": [
      {
        "name": "scheduledTaskId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkScheduledTasks_$_getWatcherHistory": {
    "arguments": [
      {
        "name": "scheduledTaskId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkScheduledTasks_$_markListenerReady": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkScheduledTasks_$_onScheduledTaskEvent": {
    "arguments": [
      {
        "name": "event",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkScheduledTasks_$_removeApprovedPermission": {
    "arguments": [
      {
        "name": "scheduledTaskId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "toolName",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "ruleContent",
        "position": 2,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkScheduledTasks_$_updateScheduledTask": {
    "arguments": [
      {
        "name": "params",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkScheduledTasks_$_updateScheduledTaskFileContent": {
    "arguments": [
      {
        "name": "scheduledTaskId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "content",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkScheduledTasks_$_updateScheduledTaskStatus": {
    "arguments": [
      {
        "name": "scheduledTaskId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "status",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "removeFiles",
        "position": 2,
        "validation": "undefined | boolean"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_addFolderToSpace": {
    "arguments": [
      {
        "name": "spaceId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "folderPath",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_addLinkToSpace": {
    "arguments": [
      {
        "name": "spaceId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "link",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_addProjectToSpace": {
    "arguments": [
      {
        "name": "spaceId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "projectUuid",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_appendRemoteSessionSpaceFolders": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "folders",
        "position": 1,
        "validation": "string[]"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_classifySessions": {
    "arguments": [
      {
        "name": "sessions",
        "position": 0,
        "validation": "array (item schema validated)"
      },
      {
        "name": "spaces",
        "position": 1,
        "validation": "array (item schema validated)"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_copyFilesToSpaceFolder": {
    "arguments": [
      {
        "name": "spaceId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "filePaths",
        "position": 1,
        "validation": "string[]"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_createSpace": {
    "arguments": [
      {
        "name": "params",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_createSpaceFolder": {
    "arguments": [
      {
        "name": "parentPath",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "folderName",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_deleteSpace": {
    "arguments": [
      {
        "name": "spaceId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_getAllSpaces": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_getAutoMemoryDir": {
    "arguments": [
      {
        "name": "spaceId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_getRemoteSessionSpaces": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_getSpace": {
    "arguments": [
      {
        "name": "spaceId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_listFolderContents": {
    "arguments": [
      {
        "name": "spaceId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "folderPath",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_onSpaceEvent": {
    "arguments": [
      {
        "name": "event",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_openFile": {
    "arguments": [
      {
        "name": "spaceId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "filePath",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_readFileContents": {
    "arguments": [
      {
        "name": "spaceId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "filePath",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_readSpaceMemoryIndex": {
    "arguments": [
      {
        "name": "spaceId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_removeFolderFromSpace": {
    "arguments": [
      {
        "name": "spaceId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "folderPath",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_removeLinkFromSpace": {
    "arguments": [
      {
        "name": "spaceId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "url",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_removeProjectFromSpace": {
    "arguments": [
      {
        "name": "spaceId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "projectUuid",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_removeRemoteSessionSpace": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_setAutoDescription": {
    "arguments": [
      {
        "name": "spaceId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "description",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_setRemoteSessionSpace": {
    "arguments": [
      {
        "name": "entry",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_summarizeSpace": {
    "arguments": [
      {
        "name": "spaceName",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "sessions",
        "position": 1,
        "validation": "array (item schema validated)"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkSpaces_$_updateSpace": {
    "arguments": [
      {
        "name": "spaceId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "params",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkUserFiles_$_getInfo": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkUserFiles_$_migrate": {
    "arguments": [
      {
        "name": "targetRoot",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CoworkUserFiles_$_pickTarget": {
    "arguments": [],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CustomPlugins_$_addMarketplace": {
    "arguments": [
      {
        "name": "input",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "egressAllowedDomains",
        "position": 1,
        "validation": "string[]"
      },
      {
        "name": "pluginContext",
        "position": 2,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CustomPlugins_$_checkPluginHasLocalChanges": {
    "arguments": [
      {
        "name": "pluginId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "pluginContext",
        "position": 1,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CustomPlugins_$_getAndClearMigrationIssues": {
    "arguments": [],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CustomPlugins_$_getCachedCommands": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CustomPlugins_$_getInstallCounts": {
    "arguments": [],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CustomPlugins_$_installLocalOrgPlugin": {
    "arguments": [
      {
        "name": "name",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CustomPlugins_$_installPlugin": {
    "arguments": [
      {
        "name": "pluginId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "egressAllowedDomains",
        "position": 1,
        "validation": "string[]"
      },
      {
        "name": "pluginContext",
        "position": 2,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CustomPlugins_$_installProgress": {
    "arguments": [
      {
        "name": "pluginId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "message",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CustomPlugins_$_listAvailablePlugins": {
    "arguments": [
      {
        "name": "egressAllowedDomains",
        "position": 0,
        "validation": "string[]"
      },
      {
        "name": "pluginContext",
        "position": 1,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CustomPlugins_$_listInstalledPlugins": {
    "arguments": [
      {
        "name": "egressAllowedDomains",
        "position": 0,
        "validation": "string[]"
      },
      {
        "name": "pluginContext",
        "position": 1,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CustomPlugins_$_listLocalOrgPlugins": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CustomPlugins_$_listMarketplaces": {
    "arguments": [
      {
        "name": "egressAllowedDomains",
        "position": 0,
        "validation": "string[]"
      },
      {
        "name": "pluginContext",
        "position": 1,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CustomPlugins_$_listRemotePluginsPage": {
    "arguments": [
      {
        "name": "limit",
        "position": 0,
        "validation": "number"
      },
      {
        "name": "offset",
        "position": 1,
        "validation": "number"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CustomPlugins_$_refreshMarketplace": {
    "arguments": [
      {
        "name": "name",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "egressAllowedDomains",
        "position": 1,
        "validation": "string[]"
      },
      {
        "name": "pluginContext",
        "position": 2,
        "validation": "undefined | custom schema validated"
      },
      {
        "name": "backendId",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CustomPlugins_$_removeMarketplace": {
    "arguments": [
      {
        "name": "name",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "egressAllowedDomains",
        "position": 1,
        "validation": "string[]"
      },
      {
        "name": "pluginContext",
        "position": 2,
        "validation": "undefined | custom schema validated"
      },
      {
        "name": "backendId",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CustomPlugins_$_syncLocalOrgPlugins": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CustomPlugins_$_uninstallPlugin": {
    "arguments": [
      {
        "name": "pluginId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "egressAllowedDomains",
        "position": 1,
        "validation": "string[]"
      },
      {
        "name": "pluginContext",
        "position": 2,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_CustomPlugins_$_updatePlugin": {
    "arguments": [
      {
        "name": "pluginId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "egressAllowedDomains",
        "position": 1,
        "validation": "string[]"
      },
      {
        "name": "pluginContext",
        "position": 2,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DeepLink_$_handleDeepLink": {
    "arguments": [
      {
        "name": "url",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DesktopNotifications_$_getAuthorizationStatus": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DesktopNotifications_$_onNotificationClicked": {
    "arguments": [
      {
        "name": "result",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DesktopNotifications_$_requestAuthorization": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DesktopNotifications_$_showNotification": {
    "arguments": [
      {
        "name": "title",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "body",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "tag",
        "position": 2,
        "validation": "undefined | string"
      },
      {
        "name": "navigateTo",
        "position": 3,
        "validation": "undefined | string"
      },
      {
        "name": "notificationType",
        "position": 4,
        "validation": "undefined | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DeviceRegistry_$_getAvailability": {
    "arguments": [
      {
        "name": "accountUuid",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DeviceRegistry_$_getLocalDeviceInfo": {
    "arguments": [
      {
        "name": "accountUuid",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DeviceRegistry_$_getPublicKey": {
    "arguments": [
      {
        "name": "accountUuid",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DeviceRegistry_$_notifyRegistered": {
    "arguments": [
      {
        "name": "accountUuid",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DeviceRegistry_$_setKeylessBridgeRowPk": {
    "arguments": [
      {
        "name": "accountUuid",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "rowPk",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DeviceRegistry_$_signAttestationPreimage": {
    "arguments": [
      {
        "name": "accountUuid",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "preimageB64",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DeviceRegistry_$_signCreateSessionBind": {
    "arguments": [
      {
        "name": "accountUuid",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "orgUuid",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DeviceRegistry_$_signForSessionHeader": {
    "arguments": [
      {
        "name": "accountUuid",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "orgUuid",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "sessionUuid",
        "position": 2,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DeviceRegistry_$_signTriggerOp": {
    "arguments": [
      {
        "name": "accountUuid",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "orgUuid",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "op",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "subjectId",
        "position": 3,
        "validation": "string"
      },
      {
        "name": "fireContentHashHex",
        "position": 4,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DocumentFunnel_$_ensureScratchRoot": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DocumentFunnel_$_ingestSessionDocument": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "sourcePath",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DocumentFunnel_$_injectDocumentContext": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "text",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DocumentFunnel_$_listScratchWorkingFiles": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "string[]"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DocumentFunnel_$_openDownloadExport": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "handle",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DocumentFunnel_$_revealDownloadExport": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "handle",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DocumentFunnel_$_runClarkdownConvert": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "request",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DocumentFunnel_$_runClarkdownDownloadExport": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "request",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DocumentFunnel_$_workingDocumentsChanged": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_DocumentFunnel_$_writeScratchFile": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "path",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "contentBase64",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "ifMatchSha256",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FileSystem_$_appInfoForExtension": {
    "arguments": [
      {
        "name": "extension",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FileSystem_$_browseFiles": {
    "arguments": [
      {
        "name": "title",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string[]"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FileSystem_$_browseFolder": {
    "arguments": [
      {
        "name": "title",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "restrictToHomeDir",
        "position": 1,
        "validation": "undefined | boolean"
      },
      {
        "name": "validateAsCoworkMount",
        "position": 2,
        "validation": "undefined | boolean"
      },
      {
        "name": "wslDistro",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FileSystem_$_browseFolders": {
    "arguments": [
      {
        "name": "title",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "restrictToHomeDir",
        "position": 1,
        "validation": "undefined | boolean"
      },
      {
        "name": "validateAsCoworkMount",
        "position": 2,
        "validation": "undefined | boolean"
      }
    ],
    "result": {
      "validation": "null | string[]"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FileSystem_$_exportLocalFileToGoogleDrive": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "path",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FileSystem_$_getLocalFileThumbnail": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "path",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "maxSize",
        "position": 2,
        "validation": "number"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FileSystem_$_getSystemPath": {
    "arguments": [
      {
        "name": "pathType",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FileSystem_$_listDirectory": {
    "arguments": [
      {
        "name": "dirPath",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FileSystem_$_listFilesInFolder": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "folderPath",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FileSystem_$_openLocalFile": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "path",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "showInFolder",
        "position": 2,
        "validation": "undefined | boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FileSystem_$_promoteScratchpadFile": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "path",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FileSystem_$_readLocalFile": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "path",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FileSystem_$_savePastedFile": {
    "arguments": [
      {
        "name": "base64",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "mimeType",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "filename",
        "position": 2,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FileSystem_$_showInFolder": {
    "arguments": [
      {
        "name": "path",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FileSystem_$_whichApplication": {
    "arguments": [
      {
        "name": "filename",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FileSystem_$_writeFileDownload": {
    "arguments": [
      {
        "name": "filename",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "url",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FileSystem_$_writeFileDownloadAndOpen": {
    "arguments": [
      {
        "name": "filename",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "url",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FileSystem_$_writeLocalFile": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "path",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "content",
        "position": 2,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FindInPageProvider_$_findRequest": {
    "arguments": [
      {
        "name": "requestId",
        "position": 0,
        "validation": "number"
      },
      {
        "name": "query",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "forward",
        "position": 2,
        "validation": "boolean"
      },
      {
        "name": "isNewSearch",
        "position": 3,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FindInPageProvider_$_reportFindResult": {
    "arguments": [
      {
        "name": "requestId",
        "position": 0,
        "validation": "number"
      },
      {
        "name": "result",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FindInPageProvider_$_setProviderActive": {
    "arguments": [
      {
        "name": "active",
        "position": 0,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FramebufferPreview_$_attach": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "name",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FramebufferPreview_$_detach": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FramebufferPreview_$_listSources": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FramebufferPreview_$_openSourceRequested": {
    "arguments": [
      {
        "name": "name",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FramebufferPreview_$_requestFramePort": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FramebufferPreview_$_sendKey": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "key",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "code",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "down",
        "position": 3,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FramebufferPreview_$_sendPointer": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "x",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "y",
        "position": 2,
        "validation": "number"
      },
      {
        "name": "buttonMask",
        "position": 3,
        "validation": "number"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FramebufferPreview_$_sendScroll": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "direction",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "notches",
        "position": 2,
        "validation": "number"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FramebufferPreview_$_sessionFatal": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "message",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FramebufferPreview_$_sessionResized": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "width",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "height",
        "position": 2,
        "validation": "number"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_FramebufferPreview_$_setStreamHints": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "hints",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_GrandPrix_$_disconnect": {
    "arguments": [
      {
        "name": "partnerId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_GrandPrix_$_dismissVerificationCode": {
    "arguments": [
      {
        "name": "requestId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_GrandPrix_$_pair": {
    "arguments": [
      {
        "name": "partnerId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "context",
        "position": 1,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_GrandPrix_$_request": {
    "arguments": [
      {
        "name": "req",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_GrandPrix_$_submitVerificationCode": {
    "arguments": [
      {
        "name": "requestId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "code",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_addPreviewAllowedOrigin": {
    "arguments": [
      {
        "name": "origin",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_capturePreviewScreenshot": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "tabId",
        "position": 1,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_capturePreviewScreenshotIfChanged": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "force",
        "position": 1,
        "validation": "undefined | boolean"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_clearPreviewAllowedOrigins": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_clearPreviewViewport": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "tabId",
        "position": 1,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_closeAllPreviewTabs": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_closePreviewTab": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "tabId",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_destroyPreview": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_elementSelected": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "context",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_exportPreview": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "kind",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_focusOrOpenPreviewTab": {
    "arguments": [
      {
        "name": "previewId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "cwd",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "url",
        "position": 2,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_focusPreview": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_getAutoVerify": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_getConfiguredServices": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_getLogs": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_getPreviewAllowedOrigins": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_getPreviewNavState": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "tabId",
        "position": 1,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_getPreviewTabs": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_getPreviewUrl": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_goBack": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "tabId",
        "position": 1,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_goForward": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "tabId",
        "position": 1,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_hidePreview": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "claimantId",
        "position": 1,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_isAvailable": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_isJitlessForced": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_loadClaudePagePreview": {
    "arguments": [
      {
        "name": "pageUrl",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "cwd",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "sessionId",
        "position": 2,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_loadHtmlPreview": {
    "arguments": [
      {
        "name": "filePath",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "sessionId",
        "position": 1,
        "validation": "undefined | string"
      },
      {
        "name": "cwd",
        "position": 2,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_loadHtmlPreviewContent": {
    "arguments": [
      {
        "name": "content",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "path",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "isSvg",
        "position": 2,
        "validation": "boolean"
      },
      {
        "name": "cwd",
        "position": 3,
        "validation": "string"
      },
      {
        "name": "sessionId",
        "position": 4,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_navigatePreview": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "url",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "tabId",
        "position": 2,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_openExternalLinkInPreview": {
    "arguments": [
      {
        "name": "previewId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "cwd",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "url",
        "position": 2,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_openPreviewInBrowser": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "tabId",
        "position": 1,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_openPreviewTab": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "cwd",
        "position": 1,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_pickHtmlFile": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_previewCloseShortcut": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "tabId",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_previewFocusExit": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_previewNewTabShortcut": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_previewRevealRequested": {
    "arguments": [
      {
        "name": "previewId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "sessionId",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "tabId",
        "position": 2,
        "validation": "undefined | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_previewSelectionShortcut": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_previewTabsChanged": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "tabs",
        "position": 1,
        "validation": "array (item schema validated)"
      },
      {
        "name": "activeTabId",
        "position": 2,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_previewUrlChanged": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "url",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_refreshPreview": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "tabId",
        "position": 1,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_removePreviewAllowedOrigin": {
    "arguments": [
      {
        "name": "origin",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_sendClaudePageDismissCommand": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_sendClaudePageShareCommand": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_setActivePreviewTab": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "tabId",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_setAutoVerify": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "enabled",
        "position": 1,
        "validation": "boolean"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_setPreviewColorScheme": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "scheme",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "tabId",
        "position": 2,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_setPreviewViewport": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "width",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "height",
        "position": 2,
        "validation": "number"
      },
      {
        "name": "tabId",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_showPreview": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "bounds",
        "position": 1,
        "validation": "custom schema validated"
      },
      {
        "name": "claimantId",
        "position": 2,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_startBrowserPreview": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "sessionId",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_startFromConfig": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "name",
        "position": 1,
        "validation": "undefined | string"
      },
      {
        "name": "sessionId",
        "position": 2,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_startRemoteBrowserPreview": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "initialUrl",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_stopServer": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Launch_$_toggleSelectionMode": {
    "arguments": [
      {
        "name": "serverId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "enabled",
        "position": 1,
        "validation": "boolean"
      },
      {
        "name": "tabId",
        "position": 2,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_abandonBridgeEnvironment": {
    "arguments": [
      {
        "name": "deregisterAll",
        "position": 0,
        "validation": "undefined | boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_addFolderToSession": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "folderPath",
        "position": 1,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_addTrustedFolder": {
    "arguments": [
      {
        "name": "folder",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_archive": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "options",
        "position": 1,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_authorizeDirectMcpServer": {
    "arguments": [
      {
        "name": "name",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_browseAndGrantRemoteSessionFolder": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_clearRemoteSessionFolderGrants": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_delete": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_deleteBridgeAgentMemory": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_deleteBridgeSession": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_deleteLocalSkill": {
    "arguments": [
      {
        "name": "name",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_directMcpCallTool": {
    "arguments": [
      {
        "name": "name",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "toolName",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_directMcpListResources": {
    "arguments": [
      {
        "name": "name",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_directMcpReadResource": {
    "arguments": [
      {
        "name": "name",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "uri",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_disconnectDirectMcpServer": {
    "arguments": [
      {
        "name": "name",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_getAll": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_getAppIconForBundleId": {
    "arguments": [
      {
        "name": "bundleId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_getBridgeConsent": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_getDefaultWorkspaceFolders": {
    "arguments": [],
    "result": {
      "validation": "string[]"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_getDirectMcpServerStatuses": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_getLocalMcpServers": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_getLocalSkillFiles": {
    "arguments": [
      {
        "name": "name",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_getManagedAskToolNames": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_getSession": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "options",
        "position": 1,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_getSessionsBridgeEnabled": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_getSessionsForScheduledTask": {
    "arguments": [
      {
        "name": "scheduledTaskId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_getSupportedCommands": {
    "arguments": [
      {
        "name": "options",
        "position": 0,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_getTranscript": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "options",
        "position": 1,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_getTranscriptFeedback": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_getTrustedFolders": {
    "arguments": [],
    "result": {
      "validation": "string[]"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_grantRemoteSessionFolder": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "folder",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_grantRemoteSessionFolders": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "folders",
        "position": 1,
        "validation": "string[]"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_isFolderTrusted": {
    "arguments": [
      {
        "name": "folder",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_listLocalSkills": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_mcpAuthenticate": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "serverName",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_mcpCallTool": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "serverUuid",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "toolName",
        "position": 2,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_mcpListResources": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "serverUuid",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_mcpReadResource": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "serverUuid",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "uri",
        "position": 2,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_mcpReconnect": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "serverName",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_mcpSubmitOAuthCallbackUrl": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "serverName",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "callbackUrl",
        "position": 2,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_noteCuWindowMentions": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "apps",
        "position": 1,
        "validation": "array (item schema validated)"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_onAutoModeOverrideAlwaysAllow": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "toolName",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "toolUseId",
        "position": 2,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_onBridgePermissionPreflight": {
    "arguments": [
      {
        "name": "request",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_onCoworkFromMain": {
    "arguments": [
      {
        "name": "request",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_onCuEmergencyStop": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "orgUuid",
        "position": 1,
        "validation": "null | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_onDirectMcpServerStatusesChanged": {
    "arguments": [
      {
        "name": "statuses",
        "position": 0,
        "validation": "array (item schema validated)"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_onEvent": {
    "arguments": [
      {
        "name": "event",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_onManagedAskToolNamesChanged": {
    "arguments": [
      {
        "name": "payload",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_onRemoteSessionStart": {
    "arguments": [
      {
        "name": "request",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_onToolPermissionRequest": {
    "arguments": [
      {
        "name": "request",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_openOutputsDir": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_releaseRemoteCuLock": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "null | string"
      },
      {
        "name": "source",
        "position": 1,
        "validation": "null | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_removeTrustedFolder": {
    "arguments": [
      {
        "name": "folder",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_replaceEnabledMcpTools": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "enabledMcpTools",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_replaceRemoteMcpServers": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "servers",
        "position": 1,
        "validation": "array (item schema validated)"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_requestDocumentsTccAccess": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_requestFolderTccAccess": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_respondBridgePermissionPreflight": {
    "arguments": [
      {
        "name": "requestId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "verdict",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_respondDirectoryServers": {
    "arguments": [
      {
        "name": "requestId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "servers",
        "position": 1,
        "validation": "array (item schema validated)"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_respondPluginSearch": {
    "arguments": [
      {
        "name": "requestId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "resultsJson",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_respondSlashMenuSkills": {
    "arguments": [
      {
        "name": "requestId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "skillsJson",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_respondToToolPermission": {
    "arguments": [
      {
        "name": "requestId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "decision",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_revealLocalSkill": {
    "arguments": [
      {
        "name": "name",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_rewind": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "targetMessageUuid",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_saveLocalSkill": {
    "arguments": [
      {
        "name": "name",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "description",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "skillMd",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "overwrite",
        "position": 3,
        "validation": "boolean"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_searchSessions": {
    "arguments": [
      {
        "name": "query",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "options",
        "position": 1,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_sendMessage": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "message",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "images",
        "position": 2,
        "validation": "undefined | array (item schema validated)"
      },
      {
        "name": "userSelectedFiles",
        "position": 3,
        "validation": "undefined | string[]"
      },
      {
        "name": "messageUuid",
        "position": 4,
        "validation": "undefined | string"
      },
      {
        "name": "toolStates",
        "position": 5,
        "validation": "undefined | array (item schema validated)"
      },
      {
        "name": "fileAttachments",
        "position": 6,
        "validation": "undefined | array (item schema validated)"
      },
      {
        "name": "contentBlocks",
        "position": 7,
        "validation": "undefined | array (item schema validated)"
      },
      {
        "name": "syntheticMessage",
        "position": 8,
        "validation": "undefined | boolean"
      },
      {
        "name": "documentFunnelEnabled",
        "position": 9,
        "validation": "undefined | boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_setChromePermissionMode": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "mode",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_setDraftSessionFolders": {
    "arguments": [
      {
        "name": "folders",
        "position": 0,
        "validation": "string[]"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_setEffort": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "effortLevel",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_setExtendedThinking": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "enabled",
        "position": 1,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_setFocusedSession": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "null | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_setLocalSkillEnabled": {
    "arguments": [
      {
        "name": "name",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "enabled",
        "position": 1,
        "validation": "boolean"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_setMcpServers": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "servers",
        "position": 1,
        "validation": "array (item schema validated)"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_setModel": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "model",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_setPermissionMode": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "mode",
        "position": 1,
        "validation": "custom schema validated"
      },
      {
        "name": "_chromeAllowedDomains",
        "position": 2,
        "validation": "undefined | string[]"
      },
      {
        "name": "options",
        "position": 3,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_setSessionsBridgeEnabled": {
    "arguments": [
      {
        "name": "enabled",
        "position": 0,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_shareSession": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_signalSessionIntent": {
    "arguments": [
      {
        "name": "intent",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_start": {
    "arguments": [
      {
        "name": "info",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_startWatchRecording": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "undefined | string"
      },
      {
        "name": "resumeRecord",
        "position": 1,
        "validation": "undefined | boolean"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_stop": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_stopTask": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "taskId",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_submitTranscriptFeedback": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "feedback",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_takeHeldWatchRecording": {
    "arguments": [],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_triggerInteractiveAuth": {
    "arguments": [
      {
        "name": "force",
        "position": 0,
        "validation": "undefined | boolean"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_updateSession": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "options",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalAgentModeSessions_$_watchRecordingComplete": {
    "arguments": [
      {
        "name": "result",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalPlugins_$_deletePlugin": {
    "arguments": [
      {
        "name": "pluginId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "pluginContext",
        "position": 1,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalPlugins_$_getDownloadedRemotePlugins": {
    "arguments": [
      {
        "name": "pluginContext",
        "position": 0,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalPlugins_$_getPluginCliBatch": {
    "arguments": [
      {
        "name": "pluginIds",
        "position": 0,
        "validation": "string[]"
      },
      {
        "name": "pluginContext",
        "position": 1,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalPlugins_$_getPluginCliStatus": {
    "arguments": [
      {
        "name": "pluginId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "pluginContext",
        "position": 1,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalPlugins_$_getPluginOAuthStatus": {
    "arguments": [
      {
        "name": "pluginId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "pluginContext",
        "position": 1,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalPlugins_$_getPlugins": {
    "arguments": [
      {
        "name": "options",
        "position": 0,
        "validation": "undefined | custom schema validated"
      },
      {
        "name": "pluginContext",
        "position": 1,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalPlugins_$_getPluginShimOps": {
    "arguments": [
      {
        "name": "pluginId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "pluginContext",
        "position": 1,
        "validation": "undefined | custom schema validated"
      },
      {
        "name": "cliName",
        "position": 2,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalPlugins_$_listSkillFiles": {
    "arguments": [
      {
        "name": "pluginId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "skillName",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "pluginContext",
        "position": 2,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalPlugins_$_onCliOpAlwaysAllowed": {
    "arguments": [
      {
        "name": "keys",
        "position": 0,
        "validation": "string[]"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalPlugins_$_revokePluginOAuth": {
    "arguments": [
      {
        "name": "pluginId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "cliName",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "pluginContext",
        "position": 2,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalPlugins_$_setPluginEnabled": {
    "arguments": [
      {
        "name": "pluginId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "enabled",
        "position": 1,
        "validation": "boolean"
      },
      {
        "name": "pluginContext",
        "position": 2,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalPlugins_$_setPluginEnvVars": {
    "arguments": [
      {
        "name": "pluginId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "cliName",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "values",
        "position": 2,
        "validation": "custom schema validated"
      },
      {
        "name": "pluginContext",
        "position": 3,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalPlugins_$_setPluginOAuthClient": {
    "arguments": [
      {
        "name": "pluginId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "cliName",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "clientId",
        "position": 2,
        "validation": "undefined | string"
      },
      {
        "name": "clientSecret",
        "position": 3,
        "validation": "undefined | string"
      },
      {
        "name": "pluginContext",
        "position": 4,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalPlugins_$_setPluginShimPermission": {
    "arguments": [
      {
        "name": "pluginId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "op",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "permission",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "pluginContext",
        "position": 3,
        "validation": "undefined | custom schema validated"
      },
      {
        "name": "cliName",
        "position": 4,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "string[]"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalPlugins_$_startPluginOAuthFlow": {
    "arguments": [
      {
        "name": "pluginId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "cliName",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "pluginContext",
        "position": 2,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalPlugins_$_syncRemotePlugins": {
    "arguments": [
      {
        "name": "pluginContext",
        "position": 0,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalPlugins_$_uploadPlugin": {
    "arguments": [
      {
        "name": "filename",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "base64Content",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "replaceExisting",
        "position": 2,
        "validation": "undefined | boolean"
      },
      {
        "name": "pluginContext",
        "position": 3,
        "validation": "undefined | custom schema validated"
      },
      {
        "name": "uploadSource",
        "position": 4,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessionEnvironment_$_get": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessionEnvironment_$_save": {
    "arguments": [
      {
        "name": "envVars",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_addDirectories": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "directories",
        "position": 1,
        "validation": "string[]"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_applyFlagSettings": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_archive": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "options",
        "position": 1,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_beginTearOffHalo": {
    "arguments": [
      {
        "name": "title",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "style",
        "position": 1,
        "validation": "undefined | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_cancelQueuedMessage": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "messageUuid",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_changeCwd": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "cwd",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "trustAccepted",
        "position": 2,
        "validation": "undefined | boolean"
      },
      {
        "name": "trustedDirectory",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_checkBranchSwitchConflict": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "targetBranch",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_checkGhAvailable": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_checkRemoteTargetTrust": {
    "arguments": [
      {
        "name": "remoteTarget",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "cwd",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_checkRemoteTrust": {
    "arguments": [
      {
        "name": "config",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "cwd",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_checkStoredTrust": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_checkTrust": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_classifyTccFolderKind": {
    "arguments": [
      {
        "name": "path",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_cleanupAutoModeProposalFile": {
    "arguments": [
      {
        "name": "path",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_clearSession": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "stashForResume",
        "position": 1,
        "validation": "undefined | boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_commitAllChanges": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "message",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_commitWipForBranchSwitch": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "fromBranch",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_createAgent": {
    "arguments": [
      {
        "name": "params",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_createLocalPr": {
    "arguments": [
      {
        "name": "params",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_createPrReviewComment": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "prNumber",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "commitSha",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "path",
        "position": 3,
        "validation": "string"
      },
      {
        "name": "line",
        "position": 4,
        "validation": "number"
      },
      {
        "name": "body",
        "position": 5,
        "validation": "string"
      },
      {
        "name": "startLine",
        "position": 6,
        "validation": "undefined | number"
      },
      {
        "name": "side",
        "position": 7,
        "validation": "undefined | string"
      },
      {
        "name": "repo",
        "position": 8,
        "validation": "undefined | string"
      },
      {
        "name": "sessionId",
        "position": 9,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_delete": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_dequeuePr": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "cwd",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "prNumber",
        "position": 2,
        "validation": "number"
      },
      {
        "name": "repo",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_disableAutoMerge": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "prNumber",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "repo",
        "position": 2,
        "validation": "undefined | string"
      },
      {
        "name": "sessionId",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_discardPendingTurn": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_discardWorkingTree": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_dismissBoundPr": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "repo",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "prNumber",
        "position": 2,
        "validation": "number"
      },
      {
        "name": "host",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_enableAutoMerge": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "prNumber",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "repo",
        "position": 2,
        "validation": "undefined | string"
      },
      {
        "name": "sessionId",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_ensureBranchPushed": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_ensureSSHConnected": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_findLocalSessionIdForBridgeId": {
    "arguments": [
      {
        "name": "bridgeSessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_forkSession": {
    "arguments": [
      {
        "name": "parentSessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "sessionId",
        "position": 1,
        "validation": "undefined | string"
      },
      {
        "name": "forkAtMessageUuid",
        "position": 2,
        "validation": "undefined | string"
      },
      {
        "name": "targetCwd",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_generateLocalPrContent": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "baseBranch",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getAgents": {
    "arguments": [
      {
        "name": "options",
        "position": 0,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getAll": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getBusyShellPtyKeys": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getCheckRunAnnotations": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "prNumber",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "checkRunId",
        "position": 2,
        "validation": "number"
      },
      {
        "name": "repo",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getCommitDiff": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "sha",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getContextUsage": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getCrCliStatus": {
    "arguments": [],
    "result": {
      "validation": "string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getCrForSession": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getCrRefSummary": {
    "arguments": [
      {
        "name": "org",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "repo",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "seq",
        "position": 2,
        "validation": "number"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getDefaultEffort": {
    "arguments": [],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getDefaultPermissionMode": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getDetectedProjects": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getDiffFileContent": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "mergeBase",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "filePath",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "prevFilePath",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getEffort": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getGhIssue": {
    "arguments": [
      {
        "name": "repo",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "issueNumber",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "hostname",
        "position": 2,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getGhRefSummary": {
    "arguments": [
      {
        "name": "host",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "repo",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "refNumber",
        "position": 2,
        "validation": "number"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getGitCommits": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "base",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "head",
        "position": 2,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getGitDiff": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "base",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "head",
        "position": 2,
        "validation": "undefined | string"
      },
      {
        "name": "options",
        "position": 3,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getGitDiffFilePatch": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "mergeBase",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "filePath",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "prevFilePath",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getGitDiffStats": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "base",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "head",
        "position": 2,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getGitInfo": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getInstalledEditors": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getLocalBranches": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "string[]"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getLocalMcpServers": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getMacTccRecoveryInfo": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getPermissionMode": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getPlanForSession": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getPrChecks": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "prNumber",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "repo",
        "position": 2,
        "validation": "undefined | string"
      },
      {
        "name": "host",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getPrCommits": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "prNumber",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "repo",
        "position": 2,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getPrDetails": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "prNumber",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "repo",
        "position": 2,
        "validation": "undefined | string"
      },
      {
        "name": "host",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getPrOverview": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "prNumber",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "repo",
        "position": 2,
        "validation": "undefined | string"
      },
      {
        "name": "sessionId",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getPrReviewComments": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "prNumber",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "repo",
        "position": 2,
        "validation": "undefined | string"
      },
      {
        "name": "host",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getPrStateForBranch": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "branch",
        "position": 1,
        "validation": "undefined | string"
      },
      {
        "name": "sessionId",
        "position": 2,
        "validation": "undefined | string"
      },
      {
        "name": "repo",
        "position": 3,
        "validation": "undefined | string"
      },
      {
        "name": "host",
        "position": 4,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getRemoteCommitDiff": {
    "arguments": [
      {
        "name": "remoteTarget",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "cwd",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "sha",
        "position": 2,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getRemoteDiffFileContent": {
    "arguments": [
      {
        "name": "remoteTarget",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "cwd",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "mergeBase",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "filePath",
        "position": 3,
        "validation": "string"
      },
      {
        "name": "prevFilePath",
        "position": 4,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getRemoteGitCommits": {
    "arguments": [
      {
        "name": "remoteTarget",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "cwd",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "base",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "head",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getRemoteGitDiff": {
    "arguments": [
      {
        "name": "remoteTarget",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "cwd",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "base",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "head",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getRemoteGitDiffStats": {
    "arguments": [
      {
        "name": "remoteTarget",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "cwd",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "base",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "head",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getRemoteGitInfo": {
    "arguments": [
      {
        "name": "remoteTarget",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "path",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getSession": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getSessionMediaStreamUrl": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "filePath",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getSessionPanelMediaStreamUrl": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "filePath",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getSessionsForScheduledTask": {
    "arguments": [
      {
        "name": "scheduledTaskId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getShellPtyBuffer": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getSSHCommitDiff": {
    "arguments": [
      {
        "name": "config",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "cwd",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "sha",
        "position": 2,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getSSHConfigs": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getSSHDiffFileContent": {
    "arguments": [
      {
        "name": "config",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "cwd",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "mergeBase",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "filePath",
        "position": 3,
        "validation": "string"
      },
      {
        "name": "prevFilePath",
        "position": 4,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getSSHGitCommits": {
    "arguments": [
      {
        "name": "config",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "cwd",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "base",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "head",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getSSHGitDiff": {
    "arguments": [
      {
        "name": "config",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "cwd",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "base",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "head",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getSSHGitDiffStats": {
    "arguments": [
      {
        "name": "config",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "cwd",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "base",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "head",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getSSHGitInfo": {
    "arguments": [
      {
        "name": "config",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "path",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getSSHLocalBranches": {
    "arguments": [
      {
        "name": "config",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "path",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "string[]"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getSSHSupportedCommands": {
    "arguments": [
      {
        "name": "config",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "cwd",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getSupportedCommands": {
    "arguments": [
      {
        "name": "options",
        "position": 0,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getTeleportReadiness": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getTranscript": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getTrustedSSHHosts": {
    "arguments": [],
    "result": {
      "validation": "string[]"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getUncommittedChanges": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string[]"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_getWorkingTreeStatus": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_importCliSession": {
    "arguments": [
      {
        "name": "cliSessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_installGh": {
    "arguments": [],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_interrupt": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_isVSCodeInstalled": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_isWorkingTreeDirty": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_launchUltrareview": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "args",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "confirm",
        "position": 2,
        "validation": "undefined | boolean"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_listCliSessions": {
    "arguments": [
      {
        "name": "limit",
        "position": 0,
        "validation": "undefined | number"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_listGhIssues": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "query",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_listSessionDirectory": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "dirPath",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_listSSHDirectory": {
    "arguments": [
      {
        "name": "config",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "path",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_listWslDistros": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_logCliEvent": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "eventName",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_markPrDraft": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "prNumber",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "repo",
        "position": 2,
        "validation": "undefined | string"
      },
      {
        "name": "sessionId",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_markPrReady": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "prNumber",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "repo",
        "position": 2,
        "validation": "undefined | string"
      },
      {
        "name": "sessionId",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_mcpAuthenticate": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "serverName",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "expectedUrl",
        "position": 2,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_mcpCallTool": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "serverUuid",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "toolName",
        "position": 2,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_mcpListResources": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "serverUuid",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_mcpReadResource": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "serverUuid",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "uri",
        "position": 2,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_mcpReconnect": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "serverName",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_mcpSubmitOAuthCallbackUrl": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "serverName",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "callbackUrl",
        "position": 2,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_mergePr": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "prNumber",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "method",
        "position": 2,
        "validation": "undefined | string"
      },
      {
        "name": "repo",
        "position": 3,
        "validation": "undefined | string"
      },
      {
        "name": "sessionId",
        "position": 4,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_notifySpawnedTaskStarted": {
    "arguments": [
      {
        "name": "parentSessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "taskId",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "childKind",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "childSessionId",
        "position": 3,
        "validation": "undefined | string"
      },
      {
        "name": "title",
        "position": 4,
        "validation": "undefined | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_onEvent": {
    "arguments": [
      {
        "name": "event",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_onSSHPasswordRequired": {
    "arguments": [
      {
        "name": "request",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_onToolPermissionRequest": {
    "arguments": [
      {
        "name": "request",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_openInEditor": {
    "arguments": [
      {
        "name": "path",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "editor",
        "position": 1,
        "validation": "custom schema validated"
      },
      {
        "name": "sshConfig",
        "position": 2,
        "validation": "undefined | custom schema validated"
      },
      {
        "name": "line",
        "position": 3,
        "validation": "undefined | number"
      },
      {
        "name": "remoteTarget",
        "position": 4,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_openInVSCode": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_openSessionFileInDefaultApp": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "filePath",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_pickFileAtCwd": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_pickSessionFile": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_popBackgroundTaskSuggestion": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "launched",
        "position": 1,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_popBackgroundTaskSuggestionById": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "taskId",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "launched",
        "position": 2,
        "validation": "boolean"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_promoteQueuedMessage": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "messageUuid",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_readCliTranscript": {
    "arguments": [
      {
        "name": "handle",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "offset",
        "position": 1,
        "validation": "undefined | number"
      },
      {
        "name": "limit",
        "position": 2,
        "validation": "undefined | number"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_readFileAtCwd": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "filePath",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_readSessionFile": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "filePath",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "options",
        "position": 2,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_readSessionImageAsDataUrl": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "filePath",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "userInitiated",
        "position": 2,
        "validation": "undefined | boolean"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_readSessionMediaAsDataUrl": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "filePath",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_readSessionPanelMediaAsDataUrl": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "filePath",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_reorderQueuedMessage": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "messageUuid",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "overUuid",
        "position": 2,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_replaceEnabledMcpTools": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "enabledMcpTools",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_replaceRemoteMcpServers": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "servers",
        "position": 1,
        "validation": "array (item schema validated)"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_replyToPrReviewComment": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "prNumber",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "commentId",
        "position": 2,
        "validation": "number"
      },
      {
        "name": "body",
        "position": 3,
        "validation": "string"
      },
      {
        "name": "repo",
        "position": 4,
        "validation": "undefined | string"
      },
      {
        "name": "sessionId",
        "position": 5,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_reportComposerInp": {
    "arguments": [
      {
        "name": "timing",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_reportStreamRender": {
    "arguments": [
      {
        "name": "summary",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_reportSwitchTiming": {
    "arguments": [
      {
        "name": "timing",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_rerunPrCheck": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "prNumber",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "checkRunId",
        "position": 2,
        "validation": "number"
      },
      {
        "name": "repo",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_resizePty": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "cols",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "rows",
        "position": 2,
        "validation": "number"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_resizeShellPty": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "cols",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "rows",
        "position": 2,
        "validation": "number"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_resolvePrReviewThread": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "prNumber",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "commentId",
        "position": 2,
        "validation": "number"
      },
      {
        "name": "repo",
        "position": 3,
        "validation": "undefined | string"
      },
      {
        "name": "sessionId",
        "position": 4,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_resolveSessionFile": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "filePath",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_resolveSSHSettings": {
    "arguments": [
      {
        "name": "config",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "remoteCwd",
        "position": 1,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_respondToRefusalFallbackPrompt": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "promptId",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "choice",
        "position": 2,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_respondToSSHPassword": {
    "arguments": [
      {
        "name": "requestId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "password",
        "position": 1,
        "validation": "null | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_respondToToolPermission": {
    "arguments": [
      {
        "name": "requestId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "decision",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_resumePreClearSession": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_revealRemotePath": {
    "arguments": [
      {
        "name": "remoteTarget",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "path",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_reviewDiff": {
    "arguments": [
      {
        "name": "diff",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_rewind": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "targetMessageUuid",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_rewindV2": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "targetMessageUuid",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_runBashCommand": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "command",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_saveTrust": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_searchSessions": {
    "arguments": [
      {
        "name": "query",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "options",
        "position": 1,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_sendMessage": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "message",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "images",
        "position": 2,
        "validation": "undefined | array (item schema validated)"
      },
      {
        "name": "toolStates",
        "position": 3,
        "validation": "undefined | array (item schema validated)"
      },
      {
        "name": "attachments",
        "position": 4,
        "validation": "undefined | array (item schema validated)"
      },
      {
        "name": "priority",
        "position": 5,
        "validation": "undefined | string"
      },
      {
        "name": "steeringGates",
        "position": 6,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_sendSideChatMessage": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "text",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_setAccountBranchPrefix": {
    "arguments": [
      {
        "name": "prefix",
        "position": 0,
        "validation": "null | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_setAutoFixEnabled": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "enabled",
        "position": 1,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_setAvailableCodeModels": {
    "arguments": [
      {
        "name": "modelIds",
        "position": 0,
        "validation": "string[]"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_setEffort": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "effort",
        "position": 1,
        "validation": "null | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_setFastMode": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "fastMode",
        "position": 1,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_setFocusedSession": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "null | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_setMcpServers": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "servers",
        "position": 1,
        "validation": "array (item schema validated)"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_setModel": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "model",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_setPermissionMode": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "mode",
        "position": 1,
        "validation": "custom schema validated"
      },
      {
        "name": "_chromeAllowedDomains",
        "position": 2,
        "validation": "undefined | string[]"
      },
      {
        "name": "options",
        "position": 3,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_setSSHConfigs": {
    "arguments": [
      {
        "name": "configs",
        "position": 0,
        "validation": "array (item schema validated)"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_setTearOffHalo": {
    "arguments": [
      {
        "name": "armed",
        "position": 0,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_setTrustedSSHHosts": {
    "arguments": [
      {
        "name": "hosts",
        "position": 0,
        "validation": "string[]"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_setVisibility": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "isVisible",
        "position": 1,
        "validation": "boolean"
      },
      {
        "name": "reason",
        "position": 2,
        "validation": "undefined | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_shareSession": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_showSessionFileInFolder": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "filePath",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_showSessionFilePreview": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "filePath",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "bounds",
        "position": 2,
        "validation": "custom schema validated"
      },
      {
        "name": "consumerId",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_start": {
    "arguments": [
      {
        "name": "info",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_startPty": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "cols",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "rows",
        "position": 2,
        "validation": "number"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_startShellPty": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "cols",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "rows",
        "position": 2,
        "validation": "number"
      },
      {
        "name": "spawnReason",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_startSideChat": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_stashWorkingTree": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "message",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_stop": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_stopPty": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_stopSessionSummary": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_stopShellPty": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_stopSideChat": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_stopTask": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "taskId",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_submitFeedback": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "description",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_submitPrReview": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "prNumber",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "event",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "body",
        "position": 3,
        "validation": "undefined | string"
      },
      {
        "name": "repo",
        "position": 4,
        "validation": "undefined | string"
      },
      {
        "name": "sessionId",
        "position": 5,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_summarizeSession": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_summarizeTranscript": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "transcript",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_teleportToCloud": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "environmentId",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_testSSHConnection": {
    "arguments": [
      {
        "name": "config",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_unarchive": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_updatePrBody": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "prNumber",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "body",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "repo",
        "position": 3,
        "validation": "undefined | string"
      },
      {
        "name": "sessionId",
        "position": 4,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_updatePrComment": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "commentId",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "body",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "isReviewComment",
        "position": 3,
        "validation": "boolean"
      },
      {
        "name": "repo",
        "position": 4,
        "validation": "undefined | string"
      },
      {
        "name": "sessionId",
        "position": 5,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_updateSession": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "options",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_validateSSHPath": {
    "arguments": [
      {
        "name": "config",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "path",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_warmSession": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_writeAutoModeProposalFile": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "proposalJson",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_writePty": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "data",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_writeSessionFile": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "filePath",
        "position": 1,
        "validation": "string"
      },
      {
        "name": "contents",
        "position": 2,
        "validation": "string"
      },
      {
        "name": "expectedHash",
        "position": 3,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_LocalSessions_$_writeShellPty": {
    "arguments": [
      {
        "name": "sessionId",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "data",
        "position": 1,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Navigation_$_navigate": {
    "arguments": [
      {
        "name": "path",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_NestDev_$_focus": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_NestDev_$_getState": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_OpenDocuments_$_getOpenDocuments": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_OpenDocuments_$_readOpenDocumentAsBase64": {
    "arguments": [
      {
        "name": "filePath",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "null | string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_PluginBridgeMcp_$_listServers": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_QuickEntry_$_onQuickEntrySubmit": {
    "arguments": [
      {
        "name": "payload",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_QuickEntry_$_setRecentChats": {
    "arguments": [
      {
        "name": "chats",
        "position": 0,
        "validation": "array (item schema validated)"
      },
      {
        "name": "activeChatId",
        "position": 1,
        "validation": "null | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Resources_$_fetchMentionOptions": {
    "arguments": [
      {
        "name": "query",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "filter",
        "position": 1,
        "validation": "undefined | string"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Resources_$_findStepRequested": {
    "arguments": [
      {
        "name": "forward",
        "position": 0,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Resources_$_handleMentionSelect": {
    "arguments": [
      {
        "name": "optionId",
        "position": 0,
        "validation": "string"
      }
    ],
    "result": {
      "validation": "custom schema validated"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Resources_$_listProjectFiles": {
    "arguments": [],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Resources_$_searchFileContents": {
    "arguments": [
      {
        "name": "query",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "maxResults",
        "position": 1,
        "validation": "undefined | number"
      }
    ],
    "result": {
      "validation": "array (item schema validated)"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Resources_$_setFindInPageClaimed": {
    "arguments": [
      {
        "name": "claimed",
        "position": 0,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Resources_$_setFocusedCwd": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "null | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Resources_$_setFocusedSshTarget": {
    "arguments": [
      {
        "name": "cwd",
        "position": 0,
        "validation": "null | string"
      },
      {
        "name": "sshConfigId",
        "position": 1,
        "validation": "null | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_Toast_$_showToast": {
    "arguments": [
      {
        "name": "message",
        "position": 0,
        "validation": "string"
      },
      {
        "name": "toastType",
        "position": 1,
        "validation": "custom schema validated"
      },
      {
        "name": "opts",
        "position": 2,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_WebBuild_$_reportCommitHash": {
    "arguments": [
      {
        "name": "commitHash",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_WindowControl_$_captureScreenshot": {
    "arguments": [],
    "result": {
      "validation": "string"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_WindowControl_$_reportModalScrim": {
    "arguments": [
      {
        "name": "active",
        "position": 0,
        "validation": "boolean"
      },
      {
        "name": "backdrop",
        "position": 1,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_WindowControl_$_resize": {
    "arguments": [
      {
        "name": "width",
        "position": 0,
        "validation": "number"
      },
      {
        "name": "height",
        "position": 1,
        "validation": "number"
      },
      {
        "name": "options",
        "position": 2,
        "validation": "undefined | custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_WindowControl_$_setIncognitoMode": {
    "arguments": [
      {
        "name": "enabled",
        "position": 0,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_WindowControl_$_setModalScrimActive": {
    "arguments": [
      {
        "name": "active",
        "position": 0,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_WindowControl_$_setThemeMode": {
    "arguments": [
      {
        "name": "mode",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_WindowState_$_cuDockStateChanged": {
    "arguments": [
      {
        "name": "isDocked",
        "position": 0,
        "validation": "boolean"
      },
      {
        "name": "holderSessionId",
        "position": 1,
        "validation": "null | string"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_WindowState_$_fullscreenChanged": {
    "arguments": [
      {
        "name": "isFullscreen",
        "position": 0,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_WindowState_$_getFullscreen": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_WindowState_$_getVisibility": {
    "arguments": [],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_WindowState_$_getZoomFactor": {
    "arguments": [],
    "result": {
      "validation": "number"
    }
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_WindowState_$_visibilityChanged": {
    "arguments": [
      {
        "name": "isVisible",
        "position": 0,
        "validation": "boolean"
      }
    ],
    "result": null
  },
  "$eipc_message$_55a3e6c3-1a00-41ac-8a57-63da567fd7b3_$_claude.web_$_WindowState_$_zoomFactorChanged": {
    "arguments": [
      {
        "name": "zoomFactor",
        "position": 0,
        "validation": "number"
      }
    ],
    "result": null
  },
  "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_DestroyWindow": {
    "arguments": [
      {
        "name": "id",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_GetWindowState": {
    "arguments": [
      {
        "name": "id",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "null | custom schema validated"
    }
  },
  "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_RegisterWindow": {
    "arguments": [
      {
        "name": "id",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "props",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_UnregisterWindow": {
    "arguments": [
      {
        "name": "id",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_UpdateWindow": {
    "arguments": [
      {
        "name": "id",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "props",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_WindowAction": {
    "arguments": [
      {
        "name": "id",
        "position": 0,
        "validation": "custom schema validated"
      },
      {
        "name": "action",
        "position": 1,
        "validation": "custom schema validated"
      }
    ],
    "result": {
      "validation": "boolean"
    }
  },
  "$eipc_message$_fcb91d11-972d-4fd6-b90b-72739699bff5_$_electron_window_$_WindowManager_$_WindowEvent": {
    "arguments": [
      {
        "name": "event",
        "position": 0,
        "validation": "custom schema validated"
      }
    ],
    "result": null
  }
} as const satisfies Record<string, ChannelValidation>;
