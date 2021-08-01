import jwtVerify from "jose/jwt/verify";
import { decode as base64Decode } from "jose/util/base64url";
import { isSolidAccessToken, isSolidAccessTokenPayload } from "../guard";
import {
  clockToleranceInSeconds,
  maxAccessTokenAgeInSeconds,
} from "../lib/Defaults";
import type {
  SolidAccessToken,
  GetKeySetFunction,
  RetrieveOidcIssuersFunction,
} from "../type";
import { asymetricCryptographicAlgorithm } from "../type";
import { retrieveOidcIssuers } from "./retrieveOidcIssuers";
import { verifySecureUriClaim } from "./verifySecureUriClaim";
import { verifySolidAccessTokenIssuer } from "./verifySolidAccessTokenIssuer";

function decode(x: string): string {
  return new TextDecoder().decode(base64Decode(x));
}

/**
 * Checks the access token structure and its WebID and Issuer claims
 */
function verifiableClaims(token: string): { iss: URL; webid: URL } {
  const tokenPayload: unknown = JSON.parse(decode(token.split(".")[1]));

  isSolidAccessTokenPayload(tokenPayload);

  return {
    iss: new URL(tokenPayload.iss),
    webid: new URL(tokenPayload.webid),
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
export async function verifySolidAccessToken(
  authorizationHeader: string,
  getIssuers?: RetrieveOidcIssuersFunction,
  getKeySet?: GetKeySetFunction,
  maxAccessTokenAge = maxAccessTokenAgeInSeconds
): Promise<SolidAccessToken> {
  // Get JWT value for either DPoP or Bearer tokens
  const accessTokenValue = authorizationHeader.replace(/^(DPoP|Bearer) /, "");

  // Extract webid and issuer claims as URLs from valid Access token payload
  const { iss, webid } = verifiableClaims(accessTokenValue);

  // Check WebID claim is a secure URI
  verifySecureUriClaim(webid.toString(), "webid");

  // Retrieve the issuers listed in the WebID
  const issuers = await retrieveOidcIssuers(webid.toString(), getIssuers);

  // Check the 
  verifySolidAccessTokenIssuer(issuers, iss.toString());
  /*
   * if (!(await issuers(webid)).includes(iss.toString())) {
   *   throw new SolidTokenVerifierError(
   *     "SolidIdentityInvalidIssuerClaim",
   *     `Incorrect issuer ${iss.toString()} for WebID ${webid.toString()}`
   *   );
   * }
   */

  // Check token against issuer's key set TODO: get key set
  verifySecureUriClaim(iss.toString(), "iss");
  const { payload, protectedHeader } = await jwtVerify(
    accessTokenValue,
    await getKeySet(iss),
    {
      audience: "solid",
      algorithms: Array.from(asymetricCryptographicAlgorithm),
      maxTokenAge: `${maxAccessTokenAge}s`,
      clockTolerance: `${clockToleranceInSeconds}s`,
    }
  );

  const accessToken = {
    header: protectedHeader,
    payload,
    signature: accessTokenValue.split(".")[2],
  };

  isSolidAccessToken(accessToken);

  return accessToken;
}
