# Solid Identity Verifier

This library asserts ownership of a WebID and conforms to authentication described
in the [Solid Identity specification](https://solid.github.io/authentication-panel/solid-oidc/).

## Supports

- DPoP Bound Access Tokens
- Bearer Access Tokens
- Caching of:
  - WebID Identity Providers
  - Identity Providers JSON Web Key Sets
  - A minimalistic version of DPoP tokens identifiers to mitigate replays otherwise mostly
  mitigated by the 60 seconds maximum DPoP Token age, should be improved to take a configurable
  max requests per seconds to avoid overflow of cache before replay. But de facto, if someone really
  wanted to mitigate this attack, they should plug a cache that can support high numbers of requests.
  Someone could easily overflow a lru cache by logging lots of requests as themselves before replaying
  the token. That is if the server can answer fast enough...
- Custom Identity Verification Classes to extend to specific caching strategies if needed

## How to?

Verify Solid Access Tokens with a simple function:

```javascript
import type { RequestMethod, VerifyIdentityFunction } from 'ts-dpop';
import { createSolidIdentityVerifier } from 'ts-dpop';

const solidIdentityVerifier: VerifyIdentityFunction = createSolidIdentityVerifier();

try {
  const { client_id, webid } = await solidIdentityVerifier(authorizationHeader as string, dpopHeader as string, method as RequestMethod, requestURL as string);

  console.log(`Verified Access Token via WebID: ${webid}`);

  return { webId: webid };
} catch (error: unknown) {
  const message = `Error verifying Access Token via WebID: ${(error as Error).message}`;

  console.log(message);

  throw new Error(message);
}
```

# TODO

Possibly further sanitation of inputs, for example a maximum authorization header size. Needs further discussions before resolution.

# See also

The [Solid OIDC Primer Request Flow](https://solid.github.io/authentication-panel/solid-oidc-primer/#request-flow).
