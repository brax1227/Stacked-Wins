#!/usr/bin/env python3
"""
App Store Connect preflight: prove the key, the IDs, and the app record all
line up BEFORE spending fifteen minutes on an archive.

Read-only. Runs inside CI where the .p8 already lives as a secret; the key
never passes through a chat or a commit. Needs: pip install pyjwt cryptography

Env:
  ASC_KEY_ID      Key ID (10 chars)
  ASC_ISSUER_ID   Issuer ID (UUID)
  ASC_KEY_PATH    path to the .p8
  BUNDLE_ID       the app's bundle identifier

Exit 0 and print the app record on success; exit 1 with a plain-language
reason otherwise. Every failure mode maps to one thing the human can fix.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import jwt  # PyJWT

API = "https://api.appstoreconnect.apple.com/v1"


def fail(msg: str) -> "NoReturn":
    print(f"::error::{msg}")
    sys.exit(1)


def need(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        fail(f"{name} is not set.")
    return value


def mint_token(key_id: str, issuer_id: str, key_path: str) -> str:
    """A 20-minute ES256 JWT, exactly as Apple specifies."""
    try:
        with open(key_path, "r", encoding="utf-8") as fh:
            private_key = fh.read()
    except OSError as exc:
        fail(f"Cannot read the .p8 at {key_path}: {exc}")
    now = int(time.time())
    return jwt.encode(
        {"iss": issuer_id, "iat": now, "exp": now + 20 * 60, "aud": "appstoreconnect-v1"},
        private_key,
        algorithm="ES256",
        headers={"kid": key_id, "typ": "JWT"},
    )


def get(token: str, path: str) -> tuple[int, dict]:
    req = urllib.request.Request(
        f"{API}{path}",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as exc:
        try:
            body = json.loads(exc.read() or b"{}")
        except json.JSONDecodeError:
            body = {}
        return exc.code, body
    except urllib.error.URLError as exc:
        fail(f"Could not reach App Store Connect: {exc.reason}")


def main() -> None:
    key_id = need("ASC_KEY_ID")
    issuer_id = need("ASC_ISSUER_ID")
    key_path = need("ASC_KEY_PATH")
    bundle_id = need("BUNDLE_ID")

    token = mint_token(key_id, issuer_id, key_path)
    status, body = get(token, f"/apps?filter[bundleId]={urllib.parse.quote(bundle_id)}")

    detail = ""
    if isinstance(body, dict) and body.get("errors"):
        first = body["errors"][0]
        detail = f" (Apple said: {first.get('code', '?')} — {first.get('detail', first.get('title', ''))})"

    if status == 401:
        fail(
            "App Store Connect rejected the key. The Key ID or Issuer ID doesn't match "
            "this .p8, or the key has been revoked. Check them against Users and Access "
            "> Integrations > App Store Connect API." + detail
        )
    if status == 403:
        fail(
            "The key authenticated but isn't allowed to list apps. Its role must be "
            "App Manager; a Developer-role key can't list or submit." + detail
        )
    if status != 200:
        fail(f"Unexpected response from App Store Connect: HTTP {status}{detail}")

    apps = body.get("data", [])
    if not apps:
        fail(
            f"The key works, but there is no app record for bundle id '{bundle_id}'. "
            "Either the bundle id in ios/project.yml has a typo, or the app hasn't been "
            "created yet: App Store Connect > My Apps > + > New App (TESTFLIGHT.md step 2)."
        )

    app = apps[0]
    attrs = app.get("attributes", {})
    print("::notice::App Store Connect preflight passed")
    print(f"  App:        {attrs.get('name')}")
    print(f"  Bundle ID:  {attrs.get('bundleId')}")
    print(f"  ASC app id: {app.get('id')}")
    print(f"  SKU:        {attrs.get('sku')}")


if __name__ == "__main__":
    main()
