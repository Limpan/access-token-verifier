import { get as http } from "http";
import type { ClientRequest } from "http";
import { get as https } from "https";
import type { JWSHeaderParameters } from "jose/jwt/verify";
import jwtVerify from "jose/jwt/verify";
import { isAccessTokenHeader, isAccessTokenPayload } from "../guards";
import type {
  AccessToken,
  AccessTokenPayload,
  GetIssuersFunction,
  GetKeySetFunction,
} from "../types";
import { digitalSignatureAsymetricCryptographicAlgorithm } from "../types";
import { decode } from "./JWT";
import { SolidIdentityError } from "./SolidIdentityError";

/**
 * Remove the Bearer and DPoP prefixes from the authorization header
 * @param token
 */
function value(token: string): string {
  return token.replace(/^(DPoP|Bearer) /, "");
}

/**
 * URL Claims
 * TODO: Allowing HTTP seems wrong, see to only allowing HTTPs
 * @param token
 */
function urlClaim(claim: string): URL {
  const protocols: {
    [protocol: string]: (...args: Parameters<typeof https>) => ClientRequest;
  } = {
    "https:": https,
    "http:": http,
  };

  const url = new URL(claim);

  if (protocols[url.protocol] === undefined) {
    throw new TypeError("Unsupported URL claim protocol.");
  }

  return url;
}

/**
 * Checks the access token structure and its WebID and Issuer claims
 * @param token
 */
function verifiableClaims(token: string): { iss: URL; webid: URL } {
  const tokenPayload: unknown = JSON.parse(decode(token.split(".")[1]));

  isAccessTokenPayload(tokenPayload);

  return {
    iss: urlClaim(tokenPayload.iss),
    webid: urlClaim(tokenPayload.webid),
  };
}

/**
 * Verify Access Token
 * - Retrieves identity issuers jwk sets using the webID claim
 * - Signature of Access Token JWT/JWS matches a key in the remote jwks
 * - Access Token max age 1 day
 * - Claims:
 *    - audience 'aud' is solid
 *    - algorithm 'alg' is an asymetric cryptographic algorithm
 *    - expiration 'exp' is not in the past
 *    - 'iat' is not in the future
 */
export async function verify(
  authorizationHeader: string,
  issuers: GetIssuersFunction,
  keySet: GetKeySetFunction
): Promise<AccessToken> {
  // Get JWT value for either DPoP or Bearer tokens
  const token = value(authorizationHeader);

  // Extract webid and issuer claims as URLs from valid Access token payload
  const { iss, webid } = verifiableClaims(token);

  // Check issuer claim against WebID issuers
  if (!(await issuers(webid)).includes(iss.toString())) {
    throw new SolidIdentityError(
      "SolidIdentityInvalidIssuerClaim",
      `Incorrect issuer ${iss.toString()} for WebID ${webid.toString()}`
    );
  }

  // Check token against issuer's key set
  const { payload, protectedHeader } = (await jwtVerify(
    token,
    await keySet(iss),
    {
      audience: "solid",
      algorithms: Array.from(digitalSignatureAsymetricCryptographicAlgorithm),
      maxTokenAge: "86400s",
      clockTolerance: "5s",
    }
  )) as { payload: AccessTokenPayload; protectedHeader: JWSHeaderParameters };

  isAccessTokenHeader(protectedHeader);

  return {
    header: protectedHeader,
    payload,
    signature: token.split(".")[2],
  };
}
