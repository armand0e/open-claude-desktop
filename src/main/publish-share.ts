export interface PublishedShareFinalizer {
  ensureReachable(): Promise<string | null>;
  revoke(slug: string): Promise<boolean>;
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message, published: false }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Publishing is a two-phase operation: the backend first records which
// artifact may be served, then the public relay must prove that exact artifact
// is reachable. A failed second phase rolls the first one back before the UI
// receives an acknowledgement.
export async function finalizePublishedShare(
  response: Response,
  finalizer: PublishedShareFinalizer,
): Promise<Response> {
  if (!response.ok) return response;
  const payload = (await response
    .clone()
    .json()
    .catch(() => null)) as Record<string, unknown> | null;
  const slug =
    typeof payload?.slug === "string"
      ? payload.slug
      : typeof payload?.published_artifact_uuid === "string"
        ? payload.published_artifact_uuid
        : "";
  if (!slug)
    return errorResponse(
      "Publishing failed because the backend returned no share identifier",
      502,
    );

  const publicUrl = await finalizer.ensureReachable().catch(() => null);
  if (publicUrl) return response;

  const revoked = await finalizer.revoke(slug).catch(() => false);
  return errorResponse(
    revoked
      ? "Publishing failed because a reachable public relay could not be created"
      : "Publishing failed and the incomplete published state could not be revoked",
    revoked ? 502 : 500,
  );
}
