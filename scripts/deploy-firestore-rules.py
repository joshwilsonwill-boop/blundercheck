#!/usr/bin/env python3
"""Deploy Firestore rules for blundercheck-e3118 via the Firebase Rules API,
bypassing the firebase CLI (whose configstore chown fails on this VM).

Auth: the Firebase CLI CI refresh token in ~/.private/firebase-ci-token is
exchanged for an access token using the firebase-tools CLI's own public
OAuth client id/secret (published in the open-source firebase-tools repo).
"""
import json
import subprocess
import urllib.request

PROJECT = "blundercheck-e3118"
CLIENT_ID = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com"
CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi"
TOKEN_FILE = "/home/hatch/.private/firebase-ci-token"
RULES_FILE = "/home/hatch/workspace/blundercheck/firestore.rules"


def post_json(url, body, headers=None):
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def patch_json(url, body, headers=None):
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method="PATCH")
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


refresh = open(TOKEN_FILE).read().strip()
tok = post_json(
    "https://oauth2.googleapis.com/token",
    {
        "grant_type": "refresh_token",
        "refresh_token": refresh,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
    },
)
access = tok["access_token"]
print("access token ok, expires in", tok.get("expires_in"), "s")
auth = {"Authorization": "Bearer " + access}

rules = open(RULES_FILE).read()
rs = post_json(
    f"https://firebaserules.googleapis.com/v1/projects/{PROJECT}/rulesets",
    {"source": {"files": [{"name": "firestore.rules", "content": rules}]}},
    headers=auth,
)
print("ruleset created:", rs["name"])

rel = patch_json(
    f"https://firebaserules.googleapis.com/v1/projects/{PROJECT}/releases/cloud.firestore",
    {"release": {"name": f"projects/{PROJECT}/releases/cloud.firestore", "rulesetName": rs["name"]}},
    headers=auth,
)
print("release updated:", rel["name"], "->", rel["rulesetName"])
print("DEPLOY-OK")
