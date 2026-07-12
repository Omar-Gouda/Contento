import "server-only";

export type OrganizationTemporaryPasswordFlash = {
  requestId: string;
  email: string;
  password: string;
  createdAt: string;
};

export const ORGANIZATION_TEMP_PASSWORD_FLASH_COOKIE = "contento_org_temp_password";

export function encodeOrganizationTemporaryPasswordFlash(flash: OrganizationTemporaryPasswordFlash) {
  return Buffer.from(JSON.stringify(flash), "utf8").toString("base64url");
}

export function decodeOrganizationTemporaryPasswordFlash(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<OrganizationTemporaryPasswordFlash>;

    if (
      typeof decoded.requestId !== "string" ||
      typeof decoded.email !== "string" ||
      typeof decoded.password !== "string" ||
      typeof decoded.createdAt !== "string"
    ) {
      return null;
    }

    return decoded as OrganizationTemporaryPasswordFlash;
  } catch {
    return null;
  }
}
