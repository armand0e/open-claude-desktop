// The desktop shell version advertised to the retained renderer (user-agent
// token and --desktop-app-version). The renderer semver-gates whole surfaces
// on this — e.g. the "Desktop app" settings group (Extensions / Developer /
// Local MCP servers) needs >= 0.12.0 — so it must be the version of the
// Claude Desktop release the ion-dist snapshot was taken from, not
// Open-Claude's own package version.
export const RETAINED_DESKTOP_VERSION = "1.24012.11";
