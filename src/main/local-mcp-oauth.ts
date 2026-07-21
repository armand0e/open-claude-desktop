import { createHash, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import path from "node:path";
import {
  assertBoundedJson,
  readRecoverableBoundedJsonFile,
} from "./bounded-json-file";
import type { LocalSecretCodec } from "./local-backend";

type JsonObject = Record<string, unknown>;

export type ConnectorOAuthPresetId = "gmail" | "google-drive" | "slack";
export type ConnectorOAuthAccess = "read" | "read-write";

export interface ConnectorOAuthPreset {
  id: ConnectorOAuthPresetId;
  name: string;
  serverUrl: string;
  setupUrl: string;
  docsUrl: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  callback: "loopback" | "deep-link";
  readScopes: readonly string[];
  writeScopes: readonly string[];
  scopeParameter: "scope" | "user_scope";
  instructions: string;
}

export interface OAuthConnectorRecord {
  uuid: string;
  name: string;
  url: string;
  preset?: string;
}

export interface ConnectorOAuthPublicState {
  preset: ConnectorOAuthPresetId;
  clientId: string;
  authenticated: boolean;
  pending: boolean;
  access: ConnectorOAuthAccess;
  error: string | null;
}

interface OAuthAccount {
  serverUuid: string;
  preset: ConnectorOAuthPresetId;
  clientId: string;
  clientSecret?: string;
  access: ConnectorOAuthAccess;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  tokenType: "Bearer";
}

interface PendingOAuth {
  serverUuid: string;
  preset: ConnectorOAuthPreset;
  state: string;
  verifier: string;
  redirectUri: string;
  timer: NodeJS.Timeout;
  server?: Server;
}

interface TokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  tokenType: "Bearer";
}

export interface LocalMcpOAuthOptions {
  presets?: readonly ConnectorOAuthPreset[];
  fetcher?: typeof fetch;
  now?: () => number;
  flowTimeoutMs?: number;
  onChanged?: (serverUuid: string) => void;
}

const MAX_STORE_BYTES = 4 * 1024 * 1024;
const MAX_TOKEN_RESPONSE_BYTES = 1024 * 1024;
const TOKEN_TIMEOUT_MS = 30_000;
const DEFAULT_FLOW_TIMEOUT_MS = 5 * 60_000;
const SAFE_PREFIX = "safe:v1:";

const SLACK_READ_SCOPES = [
  "search:read.public",
  "search:read.private",
  "search:read.mpim",
  "search:read.im",
  "search:read.files",
  "search:read.users",
  "files:read",
  "emoji:read",
  "users:read",
  "users:read.email",
  "channels:history",
  "groups:history",
  "mpim:history",
  "im:history",
  "channels:read",
  "groups:read",
  "mpim:read",
] as const;

export const CONNECTOR_OAUTH_PRESETS: readonly ConnectorOAuthPreset[] = [
  {
    id: "gmail",
    name: "Gmail",
    serverUrl: "https://gmailmcp.googleapis.com/mcp/v1",
    setupUrl: "https://console.cloud.google.com/auth/clients/create",
    docsUrl:
      "https://developers.google.com/workspace/guides/configure-mcp-servers",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    callback: "loopback",
    readScopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    writeScopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.compose",
    ],
    scopeParameter: "scope",
    instructions:
      "Enable the Gmail API and Gmail MCP API, configure the consent screen and documented Gmail scopes, then create a Desktop app OAuth client in Google Cloud.",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    serverUrl: "https://drivemcp.googleapis.com/mcp/v1",
    setupUrl: "https://console.cloud.google.com/auth/clients/create",
    docsUrl:
      "https://developers.google.com/workspace/guides/configure-mcp-servers",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    callback: "loopback",
    readScopes: ["https://www.googleapis.com/auth/drive.readonly"],
    writeScopes: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/drive.file",
    ],
    scopeParameter: "scope",
    instructions:
      "Enable the Google Drive API and Drive MCP API, configure the consent screen and documented Drive scopes, then create a Desktop app OAuth client in Google Cloud.",
  },
  {
    id: "slack",
    name: "Slack",
    serverUrl: "https://mcp.slack.com/mcp",
    setupUrl: "https://api.slack.com/apps",
    docsUrl: "https://docs.slack.dev/ai/slack-mcp-server/",
    authorizationEndpoint: "https://slack.com/oauth/v2_user/authorize",
    tokenEndpoint: "https://slack.com/api/oauth.v2.user.access",
    callback: "deep-link",
    readScopes: SLACK_READ_SCOPES,
    writeScopes: [
      ...SLACK_READ_SCOPES,
      "chat:write",
      "reactions:write",
      "channels:write",
      "groups:write",
      "im:write",
      "mpim:write",
      "canvases:read",
      "canvases:write",
    ],
    scopeParameter: "user_scope",
    instructions:
      "Create an internal Slack app, add the MCP user scopes under OAuth & Permissions, enable MCP and PKCE, add open-claude://oauth/slack as a redirect URL, and copy its Client ID.",
  },
];

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown, max: number): string | undefined {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= max &&
    !value.includes("\0")
    ? value
    : undefined;
}

function finitePositive(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function base64Url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function normalizedUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hash)
      return null;
    return url.toString();
  } catch {
    return null;
  }
}

function callbackHtml(success: boolean, message: string): string {
  const safe = message
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Open-Claude connector</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#242321;color:#f2efe9;font:16px/1.5 system-ui,sans-serif}.card{max-width:560px;padding:32px;border:1px solid #4a4742;border-radius:16px;background:#302e2b}h1{margin:0 0 10px;font-size:24px}.ok{color:#8bd49c}.bad{color:#f19a8e}</style></head><body><main class="card"><h1 class="${success ? "ok" : "bad"}">${success ? "Account connected" : "Connection failed"}</h1><p>${safe}</p><p>You can close this tab and return to Open-Claude.</p></main></body></html>`;
}

async function boundedJson(response: Response): Promise<JsonObject> {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_TOKEN_RESPONSE_BYTES)
    throw new Error("OAuth token response exceeded its safety limit");
  if (!response.body) return {};
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_TOKEN_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new Error("OAuth token response exceeded its safety limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  try {
    const parsed: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(joined),
    );
    return isObject(parsed) ? parsed : {};
  } catch {
    throw new Error("OAuth provider returned invalid JSON");
  }
}

function tokenResult(body: JsonObject): TokenResult {
  if (body.ok === false)
    throw new Error(
      stringValue(body.error, 512) ?? "OAuth provider rejected the request",
    );
  const nested = isObject(body.authed_user) ? body.authed_user : body;
  const accessToken = stringValue(nested.access_token, 65_536);
  if (!accessToken) throw new Error("OAuth provider returned no access token");
  const tokenType = stringValue(nested.token_type, 64) ?? "Bearer";
  if (tokenType.toLowerCase() !== "bearer")
    throw new Error("OAuth provider returned an unsupported token type");
  return {
    accessToken,
    refreshToken: stringValue(nested.refresh_token, 65_536),
    expiresIn: finitePositive(nested.expires_in),
    scope: stringValue(nested.scope, 32_768),
    tokenType: "Bearer",
  };
}

export class LocalMcpOAuthManager {
  readonly #filePath: string;
  readonly #codec?: LocalSecretCodec;
  readonly #fetch: typeof fetch;
  readonly #now: () => number;
  readonly #flowTimeoutMs: number;
  readonly #onChanged: (serverUuid: string) => void;
  readonly #presets = new Map<ConnectorOAuthPresetId, ConnectorOAuthPreset>();
  readonly #accounts = new Map<string, OAuthAccount>();
  readonly #errors = new Map<string, string>();
  readonly #refreshes = new Map<string, Promise<string>>();
  #pending: PendingOAuth | null = null;
  #writeChain: Promise<void> = Promise.resolve();
  #disposed = false;

  private constructor(
    userDataPath: string,
    codec: LocalSecretCodec | undefined,
    options: LocalMcpOAuthOptions,
  ) {
    this.#filePath = path.join(userDataPath, "local-mcp-oauth.json");
    this.#codec = codec;
    this.#fetch = options.fetcher ?? fetch;
    this.#now = options.now ?? Date.now;
    this.#flowTimeoutMs = options.flowTimeoutMs ?? DEFAULT_FLOW_TIMEOUT_MS;
    this.#onChanged = options.onChanged ?? (() => undefined);
    for (const preset of options.presets ?? CONNECTOR_OAUTH_PRESETS) {
      if (
        normalizedUrl(preset.serverUrl) &&
        normalizedUrl(preset.authorizationEndpoint) &&
        normalizedUrl(preset.tokenEndpoint)
      )
        this.#presets.set(preset.id, preset);
    }
  }

  static async create(
    userDataPath: string,
    codec?: LocalSecretCodec,
    options: LocalMcpOAuthOptions = {},
  ): Promise<LocalMcpOAuthManager> {
    const manager = new LocalMcpOAuthManager(userDataPath, codec, options);
    const parsed = await readRecoverableBoundedJsonFile(
      manager.#filePath,
      MAX_STORE_BYTES,
      "local MCP OAuth store",
    );
    if (!isObject(parsed) || !Array.isArray(parsed.accounts)) return manager;
    for (const candidate of parsed.accounts.slice(-1_000)) {
      if (!isObject(candidate)) continue;
      const serverUuid = stringValue(candidate.serverUuid, 256);
      const preset = stringValue(candidate.preset, 64) as
        ConnectorOAuthPresetId | undefined;
      const clientId = stringValue(candidate.clientId, 2_048);
      const access = candidate.access === "read-write" ? "read-write" : "read";
      if (!serverUuid || !preset || !clientId || !manager.#presets.has(preset))
        continue;
      const openSecret = (value: unknown, max: number) => {
        const sealed = stringValue(value, max + 65_536);
        if (!sealed?.startsWith(SAFE_PREFIX) || !codec) return undefined;
        try {
          return stringValue(codec.open(sealed.slice(SAFE_PREFIX.length)), max);
        } catch {
          return undefined;
        }
      };
      manager.#accounts.set(serverUuid, {
        serverUuid,
        preset,
        clientId,
        access,
        clientSecret: openSecret(candidate.clientSecret, 8_192),
        accessToken: openSecret(candidate.accessToken, 65_536),
        refreshToken: openSecret(candidate.refreshToken, 65_536),
        expiresAt: finitePositive(candidate.expiresAt),
        scope: stringValue(candidate.scope, 32_768),
        tokenType: "Bearer",
      });
    }
    return manager;
  }

  presets(): JsonObject[] {
    return [...this.#presets.values()].map((preset) => ({
      id: preset.id,
      name: preset.name,
      serverUrl: preset.serverUrl,
      setupUrl: preset.setupUrl,
      docsUrl: preset.docsUrl,
      callbackUrl:
        preset.callback === "deep-link"
          ? `open-claude://oauth/${preset.id}`
          : "Automatic 127.0.0.1 loopback callback",
      instructions: preset.instructions,
    }));
  }

  stateFor(serverUuid: string): ConnectorOAuthPublicState | null {
    const account = this.#accounts.get(serverUuid);
    if (!account) return null;
    return {
      preset: account.preset,
      clientId: account.clientId,
      authenticated: Boolean(
        account.accessToken &&
        (!account.expiresAt ||
          account.expiresAt > this.#now() ||
          account.refreshToken),
      ),
      pending: this.#pending?.serverUuid === serverUuid,
      access: account.access,
      error: this.#errors.get(serverUuid) ?? null,
    };
  }

  async start(
    connector: OAuthConnectorRecord,
    input: {
      preset: unknown;
      clientId: unknown;
      clientSecret?: unknown;
      access?: unknown;
    },
  ): Promise<JsonObject> {
    if (this.#disposed) throw new Error("OAuth connector manager is closed");
    if (!this.#codec)
      throw new Error(
        "Secure operating-system credential storage is unavailable; OAuth connectors are disabled.",
      );
    const presetId = stringValue(input.preset, 64) as
      ConnectorOAuthPresetId | undefined;
    const preset = presetId ? this.#presets.get(presetId) : undefined;
    const clientId = stringValue(input.clientId, 2_048);
    const suppliedSecret = stringValue(input.clientSecret, 8_192);
    const access: ConnectorOAuthAccess =
      input.access === "read-write" ? "read-write" : "read";
    if (!preset || !clientId)
      throw new Error("Preset and Client ID are required");
    if (
      connector.preset !== preset.id ||
      normalizedUrl(connector.url) !== normalizedUrl(preset.serverUrl)
    )
      throw new Error("Connector does not match the selected OAuth preset");
    const previous = this.#accounts.get(connector.uuid);
    const sameIdentity =
      previous?.preset === preset.id &&
      previous.clientId === clientId &&
      previous.access === access;
    const account: OAuthAccount = {
      serverUuid: connector.uuid,
      preset: preset.id,
      clientId,
      access,
      clientSecret:
        suppliedSecret ?? (sameIdentity ? previous?.clientSecret : undefined),
      accessToken: sameIdentity ? previous?.accessToken : undefined,
      refreshToken: sameIdentity ? previous?.refreshToken : undefined,
      expiresAt: sameIdentity ? previous?.expiresAt : undefined,
      scope: sameIdentity ? previous?.scope : undefined,
      tokenType: "Bearer",
    };
    this.#accounts.set(connector.uuid, account);
    try {
      await this.#persist();
    } catch (error) {
      if (previous) this.#accounts.set(connector.uuid, previous);
      else this.#accounts.delete(connector.uuid);
      throw error;
    }
    this.#cancelPending("A newer connector login replaced this request");
    this.#errors.delete(connector.uuid);
    const verifier = base64Url(randomBytes(64));
    const state = base64Url(randomBytes(32));
    let redirectUri: string;
    let server: Server | undefined;
    if (preset.callback === "loopback") {
      server = createServer((request, response) => {
        if (request.method !== "GET" || !request.url) {
          response.writeHead(405).end();
          return;
        }
        const callback = new URL(request.url, "http://127.0.0.1");
        if (callback.pathname !== "/oauth/callback") {
          response.writeHead(404).end();
          return;
        }
        void this.#complete(callback)
          .then(() => {
            response.writeHead(200, {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
            });
            response.end(callbackHtml(true, `${preset.name} is ready to use.`));
          })
          .catch((error) => {
            const message =
              error instanceof Error ? error.message : "OAuth login failed";
            const pending = this.#pending;
            if (
              pending &&
              pending.server === server &&
              message !== "OAuth callback state did not match"
            ) {
              this.#cancelPending();
              this.#errors.set(pending.serverUuid, message.slice(0, 1_000));
              this.#onChanged(pending.serverUuid);
            }
            response.writeHead(400, {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
            });
            response.end(callbackHtml(false, message));
          });
      });
      await new Promise<void>((resolve, reject) => {
        server!.once("error", reject);
        server!.listen(0, "127.0.0.1", () => resolve());
      });
      const address = server.address() as AddressInfo;
      redirectUri = `http://127.0.0.1:${address.port}/oauth/callback`;
    } else redirectUri = `open-claude://oauth/${preset.id}`;
    const timer = setTimeout(() => {
      if (this.#pending?.state !== state) return;
      this.#errors.set(connector.uuid, "Login timed out; try again.");
      this.#cancelPending();
      this.#onChanged(connector.uuid);
    }, this.#flowTimeoutMs);
    timer.unref?.();
    this.#pending = {
      serverUuid: connector.uuid,
      preset,
      state,
      verifier,
      redirectUri,
      timer,
      server,
    };
    const authorization = new URL(preset.authorizationEndpoint);
    authorization.searchParams.set("client_id", clientId);
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("redirect_uri", redirectUri);
    authorization.searchParams.set("state", state);
    authorization.searchParams.set("code_challenge", codeChallenge(verifier));
    authorization.searchParams.set("code_challenge_method", "S256");
    authorization.searchParams.set(
      preset.scopeParameter,
      (access === "read-write" ? preset.writeScopes : preset.readScopes).join(
        " ",
      ),
    );
    if (preset.id === "gmail" || preset.id === "google-drive") {
      authorization.searchParams.set("access_type", "offline");
      authorization.searchParams.set("prompt", "consent");
    }
    this.#onChanged(connector.uuid);
    return {
      authorizationUrl: authorization.toString(),
      redirectUri,
      serverUuid: connector.uuid,
      expiresAt: this.#now() + this.#flowTimeoutMs,
    };
  }

  async handleCallbackUrl(rawUrl: string): Promise<boolean> {
    let callback: URL;
    try {
      callback = new URL(rawUrl);
    } catch {
      return false;
    }
    if (
      callback.protocol !== "open-claude:" ||
      callback.hostname !== "oauth" ||
      callback.pathname !== "/slack"
    )
      return false;
    const expected = this.#pending;
    if (!expected || callback.searchParams.get("state") !== expected.state)
      return true;
    try {
      await this.#complete(callback);
    } catch (error) {
      const pending = this.#pending;
      if (pending === expected) {
        this.#cancelPending();
        this.#errors.set(
          pending.serverUuid,
          error instanceof Error ? error.message : "OAuth login failed",
        );
        this.#onChanged(pending.serverUuid);
      }
    }
    return true;
  }

  async authorizationFor(
    serverUuid: string,
    forceRefresh = false,
  ): Promise<string | null> {
    const account = this.#accounts.get(serverUuid);
    if (!account?.accessToken) return null;
    if (
      !forceRefresh &&
      (!account.expiresAt || account.expiresAt > this.#now() + 60_000)
    )
      return account.accessToken;
    if (!account.refreshToken) {
      if (!forceRefresh && account.expiresAt && account.expiresAt > this.#now())
        return account.accessToken;
      this.#errors.set(serverUuid, "Session expired; sign in again.");
      return null;
    }
    const existing = this.#refreshes.get(serverUuid);
    if (existing) return existing;
    const refresh = this.#refresh(account).finally(() => {
      if (this.#refreshes.get(serverUuid) === refresh)
        this.#refreshes.delete(serverUuid);
    });
    this.#refreshes.set(serverUuid, refresh);
    return refresh;
  }

  async disconnect(serverUuid: string): Promise<void> {
    const hadPending = this.#pending?.serverUuid === serverUuid;
    if (hadPending) this.#cancelPending();
    const previous = this.#accounts.get(serverUuid);
    this.#accounts.delete(serverUuid);
    const hadError = this.#errors.delete(serverUuid);
    if (!previous && !hadPending && !hadError) return;
    try {
      if (previous) await this.#persist();
    } catch (error) {
      if (previous) this.#accounts.set(serverUuid, previous);
      throw error;
    }
    this.#onChanged(serverUuid);
  }

  async prune(validServerUuids: Iterable<string>): Promise<void> {
    const valid = new Set(validServerUuids);
    const removed = [...this.#accounts.keys()].filter(
      (serverUuid) => !valid.has(serverUuid),
    );
    if (removed.length === 0) return;
    const previous = new Map(this.#accounts);
    for (const serverUuid of removed) {
      this.#accounts.delete(serverUuid);
      this.#errors.delete(serverUuid);
    }
    try {
      await this.#persist();
    } catch (error) {
      this.#accounts.clear();
      for (const [serverUuid, account] of previous)
        this.#accounts.set(serverUuid, account);
      throw error;
    }
  }

  cancel(serverUuid: string): void {
    if (this.#pending?.serverUuid !== serverUuid) return;
    this.#errors.set(serverUuid, "Login canceled.");
    this.#cancelPending();
    this.#onChanged(serverUuid);
  }

  dispose(): void {
    this.#disposed = true;
    this.#cancelPending();
  }

  async #complete(callback: URL): Promise<void> {
    const pending = this.#pending;
    if (!pending)
      throw new Error("No connector login is waiting for a callback");
    if (callback.searchParams.get("state") !== pending.state)
      throw new Error("OAuth callback state did not match");
    const providerError = callback.searchParams.get("error");
    if (providerError) {
      const detail = callback.searchParams.get("error_description");
      this.#errors.set(
        pending.serverUuid,
        (detail || providerError).slice(0, 1_000),
      );
      this.#cancelPending();
      throw new Error((detail || providerError).slice(0, 1_000));
    }
    const code = stringValue(callback.searchParams.get("code"), 16_384);
    if (!code) throw new Error("OAuth callback did not include a code");
    const account = this.#accounts.get(pending.serverUuid);
    if (!account) throw new Error("Connector login no longer exists");
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: account.clientId,
      code,
      code_verifier: pending.verifier,
      redirect_uri: pending.redirectUri,
    });
    if (account.clientSecret) form.set("client_secret", account.clientSecret);
    const token = await this.#tokenRequest(pending.preset, form);
    if (
      this.#pending !== pending ||
      this.#accounts.get(pending.serverUuid) !== account
    )
      throw new Error("Connector login changed before it completed");
    const previous = { ...account };
    account.accessToken = token.accessToken;
    account.refreshToken = token.refreshToken ?? account.refreshToken;
    account.expiresAt = token.expiresIn
      ? this.#now() + token.expiresIn * 1_000
      : undefined;
    account.scope = token.scope;
    account.tokenType = token.tokenType;
    try {
      await this.#persist();
    } catch (error) {
      Object.assign(account, previous);
      throw error;
    }
    this.#errors.delete(account.serverUuid);
    this.#cancelPending();
    this.#onChanged(account.serverUuid);
  }

  async #refresh(account: OAuthAccount): Promise<string> {
    const preset = this.#presets.get(account.preset);
    if (!preset || !account.refreshToken)
      throw new Error("Connector must be signed in again");
    const form = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
      client_id: account.clientId,
    });
    if (account.clientSecret) form.set("client_secret", account.clientSecret);
    try {
      const token = await this.#tokenRequest(preset, form);
      if (this.#accounts.get(account.serverUuid) !== account)
        throw new Error("Connector login changed during token refresh");
      const previous = { ...account };
      account.accessToken = token.accessToken;
      account.refreshToken = token.refreshToken ?? account.refreshToken;
      account.expiresAt = token.expiresIn
        ? this.#now() + token.expiresIn * 1_000
        : undefined;
      account.scope = token.scope ?? account.scope;
      try {
        await this.#persist();
      } catch (error) {
        Object.assign(account, previous);
        throw error;
      }
      this.#errors.delete(account.serverUuid);
      this.#onChanged(account.serverUuid);
      return account.accessToken;
    } catch (error) {
      this.#errors.set(
        account.serverUuid,
        error instanceof Error ? error.message : "Token refresh failed",
      );
      this.#onChanged(account.serverUuid);
      throw error;
    }
  }

  async #tokenRequest(
    preset: ConnectorOAuthPreset,
    form: URLSearchParams,
  ): Promise<TokenResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);
    timeout.unref?.();
    try {
      const response = await this.#fetch(preset.tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: form.toString(),
        redirect: "manual",
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error("OAuth token endpoint attempted a redirect");
      }
      const body = await boundedJson(response);
      if (!response.ok)
        throw new Error(
          stringValue(body.error_description, 1_000) ??
            stringValue(body.error, 512) ??
            `OAuth token endpoint returned HTTP ${response.status}`,
        );
      return tokenResult(body);
    } catch (error) {
      if (controller.signal.aborted)
        throw new Error("OAuth token request timed out");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  #cancelPending(error?: string): void {
    const pending = this.#pending;
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.server?.close();
    if (error) this.#errors.set(pending.serverUuid, error);
    this.#pending = null;
  }

  async #persist(): Promise<void> {
    if (!this.#codec && this.#accounts.size > 0)
      throw new Error("Secure credential storage is unavailable");
    const seal = (value: string | undefined) =>
      value ? `${SAFE_PREFIX}${this.#codec!.seal(value)}` : undefined;
    const serialized = `${JSON.stringify(
      {
        version: 1,
        accounts: [...this.#accounts.values()].map((account) => ({
          serverUuid: account.serverUuid,
          preset: account.preset,
          clientId: account.clientId,
          access: account.access,
          clientSecret: seal(account.clientSecret),
          accessToken: seal(account.accessToken),
          refreshToken: seal(account.refreshToken),
          expiresAt: account.expiresAt,
          scope: account.scope,
          tokenType: account.tokenType,
        })),
      },
      null,
      2,
    )}\n`;
    assertBoundedJson(serialized, MAX_STORE_BYTES, "local MCP OAuth store");
    const pending = this.#writeChain
      .catch(() => undefined)
      .then(async () => {
        await mkdir(path.dirname(this.#filePath), {
          recursive: true,
          mode: 0o700,
        });
        const temporary = `${this.#filePath}.${process.pid}.${base64Url(randomBytes(12))}.tmp`;
        try {
          await writeFile(temporary, serialized, {
            encoding: "utf8",
            mode: 0o600,
          });
          await rename(temporary, this.#filePath);
        } finally {
          await rm(temporary, { force: true }).catch(() => undefined);
        }
      });
    this.#writeChain = pending;
    await pending;
  }
}
