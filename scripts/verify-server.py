"""Verify public HTTPS proxy, origin checks, and backend configuration."""
import json
import socket
import urllib.error
import urllib.request

url = "https://lexpilot.mizki.online"
hostname = urllib.request.urlparse(url).hostname
original_resolve = socket.getaddrinfo


def resolve(host, port, *args, **kwargs):
    return original_resolve("127.0.0.1" if host == hostname else host, port, *args, **kwargs)


socket.getaddrinfo = resolve
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
for path, origin, expected in [
    ("/api/health", None, 200),
    ("/", None, 200),
    ("/api/health", url, 200),
    ("/api/settings", url, 200),
    ("/api/health", "https://untrusted.example", 403),
]:
    headers = {}
    if origin:
        headers["Origin"] = origin
    try:
        response = opener.open(urllib.request.Request(url + path, headers=headers), timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        assert response.code == expected, (path, response.code, expected)
        if path == "/api/settings" and response.code == 200:
            settings = json.load(response)
            assert settings["textReady"] and settings["visionReady"]
            assert settings["textModel"] == "Qwen/Qwen3.5-35B-A3B"
        print("HTTPS", path, response.code, "OK")
