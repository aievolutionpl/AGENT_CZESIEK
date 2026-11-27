"""scripts/install-jarvis.sh picks the release asset that matches the platform.

Runs the real script in ``--dry-run`` against a recorded release payload, so the
selection logic is exercised end to end without network or disk changes.
"""

import hashlib
import json
import os
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "install-jarvis.sh"

ASSETS = [
    "AI-Evolution-Jarvis-1.0.0-win-x64.exe",
    "AI-Evolution-Jarvis-1.0.0-linux-amd64.deb",
    "AI-Evolution-Jarvis-1.0.0-linux-x86_64.AppImage",
    "AI-Evolution-Jarvis-1.0.0-mac-arm64.dmg",
]


def _run(tmp_path: Path, os_name: str, arch: str) -> subprocess.CompletedProcess:
    release = tmp_path / "release.json"
    release.write_text(
        json.dumps(
            {
                "tag_name": "v1.0.0",
                "assets": [
                    {"name": name, "browser_download_url": f"https://example.invalid/{name}"} for name in ASSETS
                ],
            }
        )
    )
    env = {
        **os.environ,
        "HOME": str(tmp_path),
        "JARVIS_ARCH": arch,
        "JARVIS_OS": os_name,
        "JARVIS_RELEASE_JSON": str(release),
    }
    return subprocess.run(["bash", str(SCRIPT), "--dry-run"], capture_output=True, env=env, text=True)


@pytest.mark.parametrize(
    ("os_name", "arch", "expected"),
    [
        ("linux", "x64", "linux-x86_64.AppImage"),
        ("mac", "arm64", "mac-arm64.dmg"),
    ],
)
def test_dry_run_selects_the_platform_asset(tmp_path, os_name, arch, expected):
    result = _run(tmp_path, os_name, arch)

    assert result.returncode == 0, result.stderr
    downloads = [line for line in result.stdout.splitlines() if "https://example.invalid/" in line]
    assert len(downloads) == 1 and downloads[0].endswith(expected)
    # Dry run means dry: nothing was installed under the fake home.
    assert not (tmp_path / ".local").exists()


def test_missing_platform_asset_fails_instead_of_guessing(tmp_path):
    result = _run(tmp_path, "linux", "arm64")

    assert result.returncode != 0
    assert "https://example.invalid/" not in result.stdout


def test_linux_install_puts_a_working_launcher_with_its_icon_in_the_menu(tmp_path):
    """A real (non-dry) run against local files: the AppImage lands executable,
    and the menu entry points at an icon file that exists — no blank square."""
    appimage = tmp_path / "src" / "AI-Evolution-Jarvis-1.0.0-linux-x86_64.AppImage"
    appimage.parent.mkdir()
    appimage.write_text("#!/bin/sh\nexit 0\n")
    icon = tmp_path / "src" / "icon.png"
    icon.write_bytes(b"\x89PNG\r\n\x1a\n")
    release = tmp_path / "release.json"
    release.write_text(json.dumps({"tag_name": "v1.0.0", "assets": [
        {"name": appimage.name, "browser_download_url": appimage.as_uri(),
         "digest": "sha256:" + hashlib.sha256(appimage.read_bytes()).hexdigest()},
    ]}))
    home = tmp_path / "home"
    home.mkdir()
    env = {**os.environ, "HOME": str(home), "XDG_DATA_HOME": str(home / ".local" / "share"),
           "JARVIS_OS": "linux", "JARVIS_ARCH": "x64", "JARVIS_RELEASE_JSON": str(release),
           "JARVIS_ICON_URL": icon.as_uri()}

    result = subprocess.run(["bash", str(SCRIPT), "--no-launch"], capture_output=True, env=env, text=True)

    assert result.returncode == 0, result.stderr
    data = home / ".local" / "share"
    installed = data / "ai-evolution-jarvis" / "AI-Evolution-Jarvis.AppImage"
    assert installed.exists() and os.access(installed, os.X_OK)
    entry = (data / "applications" / "pl.aievolution.jarvis.desktop").read_text()
    icon_line = next(line for line in entry.splitlines() if line.startswith("Icon="))
    assert Path(icon_line.removeprefix("Icon=")).is_file()
    assert f'Exec="{installed}"' in entry
    assert "Co dalej" in result.stdout
    original = installed.read_bytes()
    appimage.write_bytes(b"changed after release")
    rejected = subprocess.run(["bash", str(SCRIPT), "--no-launch"], capture_output=True, env=env)
    assert rejected.returncode != 0
    assert installed.read_bytes() == original
