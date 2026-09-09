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

Optional, for "I uploaded a build and can't see it in TestFlight":
  ASC_REPORT=builds       also list the recent builds as Apple sees them
                          (processing state, which tester groups have them)
  ASC_DISTRIBUTE=latest   also hand the newest processed build to every
                          internal tester group that doesn't have it yet.
                          Internal groups only: the people already on the
                          team, never external testers or App Review.
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


def post(token: str, path: str, payload: dict) -> tuple[int, dict]:
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(payload).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
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


def apple_said(body: dict) -> str:
    errors = body.get("errors") if isinstance(body, dict) else None
    if not errors:
        return ""
    first = errors[0]
    return f" (Apple said: {first.get('code', '?')} — {first.get('detail', first.get('title', ''))})"


def report_builds(token: str, app_id: str) -> None:
    """What TestFlight actually has. The usual answers to "I don't see the
    build": it's still processing, processing failed, or it processed fine
    but no tester group was given it."""
    status, body = get(
        token,
        f"/apps/{app_id}/betaGroups?fields[betaGroups]=name,isInternalGroup,hasAccessToAllBuilds&limit=50",
    )
    if status != 200:
        fail(f"Could not list tester groups: HTTP {status}{apple_said(body)}")
    groups = body.get("data", [])
    print("")
    print("Tester groups (being offered a build is not the same as installing")
    print("it -- testers still tap Update unless they turned on Automatic Updates):")
    if not groups:
        print("  (none) — nobody can install anything until a group exists. TestFlight > Internal Testing > +")
    for group in groups:
        attrs = group.get("attributes", {})
        kind = "internal" if attrs.get("isInternalGroup") else "external"
        # "Automatic" here is about the *group* being handed the build, not
        # about anyone's phone installing it. TestFlight never installs on its
        # own unless the tester turns on Automatic Updates for the app.
        auto = ("new builds offered to it automatically" if attrs.get("hasAccessToAllBuilds")
                else "builds must be added to it by hand")
        print(f"  - {attrs.get('name')}  [{kind}, {auto}]")

    status, body = get(
        token,
        # The top-level endpoint: /apps/{id}/builds refuses `sort`.
        f"/builds?filter[app]={app_id}&sort=-uploadedDate&limit=10"
        "&fields[builds]=version,processingState,uploadedDate,expired,minOsVersion"
        ",usesNonExemptEncryption,betaGroups,buildBetaDetail"
        "&include=betaGroups,buildBetaDetail"
        "&fields[betaGroups]=name"
        "&fields[buildBetaDetails]=internalBuildState,externalBuildState",
    )
    if status != 200:
        fail(f"Could not list builds: HTTP {status}{apple_said(body)}")

    names = {}
    beta_states = {}
    for inc in body.get("included", []):
        if inc.get("type") == "betaGroups":
            names[inc["id"]] = inc.get("attributes", {}).get("name", inc["id"])
        elif inc.get("type") == "buildBetaDetails":
            beta_states[inc["id"]] = inc.get("attributes", {})

    builds = body.get("data", [])
    print("")
    print("Builds, newest first:")
    if not builds:
        print("  (none) — no upload has reached App Store Connect for this app.")
    for build in builds:
        attrs = build.get("attributes", {})
        rels = build.get("relationships", {})
        linked = rels.get("betaGroups", {}).get("data", []) or []
        in_groups = ", ".join(names.get(g["id"], g["id"]) for g in linked) or "no tester group"
        expired = ", EXPIRED" if attrs.get("expired") else ""

        detail_ref = (rels.get("buildBetaDetail") or {}).get("data") or {}
        detail = beta_states.get(detail_ref.get("id"), {})
        # This, not processingState, is what decides whether the build shows
        # up in a tester's TestFlight app.
        internal = detail.get("internalBuildState", "?")

        print(
            f"  - build {attrs.get('version')}: {attrs.get('processingState')}{expired}, "
            f"internal: {internal}, needs iOS {attrs.get('minOsVersion')}, "
            f"uploaded {attrs.get('uploadedDate')}, in: {in_groups}"
        )
        if attrs.get("usesNonExemptEncryption") is None:
            print("      ^ export compliance unanswered — testers can't install this one")
        if internal == "MISSING_EXPORT_COMPLIANCE":
            print("      ^ App Store Connect is waiting on the encryption question for this build")


def distribute_latest(token: str, app_id: str) -> None:
    """Give the newest processed build to every internal group missing it.
    Idempotent; internal groups only."""
    status, body = get(
        token,
        f"/builds?filter[app]={app_id}&sort=-uploadedDate&limit=10"
        "&fields[builds]=version,processingState,expired,betaGroups&include=betaGroups&fields[betaGroups]=name",
    )
    if status != 200:
        fail(f"Could not list builds: HTTP {status}{apple_said(body)}")
    ready = [
        b for b in body.get("data", [])
        if b.get("attributes", {}).get("processingState") == "VALID" and not b.get("attributes", {}).get("expired")
    ]
    if not ready:
        print("::warning::No processed build to hand out yet — check the list above; PROCESSING means wait, FAILED/INVALID means Apple rejected it.")
        return
    latest = ready[0]
    version = latest["attributes"].get("version")
    already = {g["id"] for g in (latest.get("relationships", {}).get("betaGroups", {}).get("data", []) or [])}

    status, body = get(
        token, f"/apps/{app_id}/betaGroups?fields[betaGroups]=name,isInternalGroup&limit=50"
    )
    if status != 200:
        fail(f"Could not list tester groups: HTTP {status}{apple_said(body)}")
    internal = [g for g in body.get("data", []) if g.get("attributes", {}).get("isInternalGroup")]
    if not internal:
        fail("There is no internal tester group. TestFlight > Internal Testing > + , then add yourself.")

    print("")
    for group in internal:
        name = group.get("attributes", {}).get("name")
        if group["id"] in already:
            print(f"  build {version} is already in '{name}'")
            continue
        status, body = post(
            token,
            f"/betaGroups/{group['id']}/relationships/builds",
            {"data": [{"type": "builds", "id": latest["id"]}]},
        )
        if status in (200, 204):
            print(f"::notice::Handed build {version} to '{name}'. It shows up in the TestFlight app within a minute.")
        else:
            fail(f"Could not add build {version} to '{name}': HTTP {status}{apple_said(body)}")


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

    if os.environ.get("ASC_REPORT", "").strip() == "builds":
        report_builds(token, app["id"])
    if os.environ.get("ASC_DISTRIBUTE", "").strip() == "latest":
        distribute_latest(token, app["id"])


if __name__ == "__main__":
    main()
