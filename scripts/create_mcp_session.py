#!/usr/bin/env python3
"""
Simple Python script to create an MCP session and make a follow-up call.
Requires: requests (pip install requests)
Usage: python3 scripts/create_mcp_session.py
"""
import sys
import requests

URL = "http://127.0.0.1:3845/mcp"
HEADERS = {"Content-Type": "application/json"}

# Try multiple handshake methods/param shapes to discover what the MCP server expects
methods_to_try = [
    ("initialize", {"clientName": "my-client", "clientType": "tool", "clientVersion": "1.0"}),
    ("session.create", {"clientName": "my-client", "clientType": "tool", "clientVersion": "1.0"}),
    ("session.initialize", {"clientName": "my-client"}),
    ("mcp.initialize", {"clientName": "my-client"}),
    ("handshake", {"clientName": "my-client"}),
    ("session.open", {"clientName": "my-client"}),
    ("session.init", {"clientName": "my-client"}),
    ("initialize", {}),
    ("status", {}),
]

session_id = None
for idx, (method, params) in enumerate(methods_to_try, start=1):
    payload = {"jsonrpc": "2.0", "method": method, "params": params, "id": idx}
    try:
        r = requests.post(URL, headers=HEADERS, json=payload, timeout=5)
    except Exception as e:
        print(f"{method}: request error: {e}", file=sys.stderr)
        continue

    # Print concise diagnostics
    print(f"Tried method: {method}  -> HTTP {r.status_code} {r.reason}")
    print("Response body:", r.text)

    # If we got a JSON response try to parse it and look for sessionId
    try:
        j = r.json()
    except ValueError:
        j = None

    if j and isinstance(j, dict):
        # if result.sessionId exists
        sid = j.get("result", {}).get("sessionId") if isinstance(j.get("result"), dict) else None
        if sid:
            session_id = sid
            print("Obtained sessionId:", session_id)
            break

    # If server indicates "Invalid request body for initialize request" it's expecting a specific initialize payload; keep trying

if not session_id:
    print("No sessionId obtained. Check the printed responses above to determine the required handshake.")
    sys.exit(1)

print("sessionId:", session_id)

# Example subsequent call using sessionId in params
call_payload = {
    "jsonrpc": "2.0",
    "method": "status",
    "params": {"sessionId": session_id},
    "id": 999
}
try:
    r2 = requests.post(URL, headers=HEADERS, json=call_payload, timeout=5)
    r2.raise_for_status()
    print(r2.json())
except Exception as e:
    print("Follow-up call failed:", e, file=sys.stderr)
    sys.exit(1)
