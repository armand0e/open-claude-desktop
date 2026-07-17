export function runtimePromptContext(): string {
  const now = new Date();
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "system local time";
  const localDateTime = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "long",
  }).format(now);

  return [
    "<runtime_context>",
    `Current local date and time: ${localDateTime}`,
    `Current UTC date and time: ${now.toISOString()}`,
    `Local timezone: ${timezone}`,
    `Host platform: ${process.platform} ${process.arch}`,
    "The host does not know this model's training cutoff. Treat current or changeable facts as unverified until checked with an available web tool.",
    "</runtime_context>",
  ].join("\n");
}
