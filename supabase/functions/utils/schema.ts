// Allow-listed so a client can never point a service-role query at an
// arbitrary schema by spoofing this header.
const ALLOWED_SCHEMAS = ["portal", "portaldev"];

export function resolvePortalSchema(req: Request): string {
  const requested = req.headers.get("x-portal-schema");
  return requested && ALLOWED_SCHEMAS.includes(requested) ? requested : "portal";
}
