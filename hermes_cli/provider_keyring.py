"""Seal provider API keys in profile .env files with a key held by the OS."""
from __future__ import annotations

import re
import logging
import uuid
from pathlib import Path
import sys

logger = logging.getLogger(__name__)
MARKER = "'' # hermes-sealed-v1:"


def is_api_key(name: str) -> bool:
    if not name or not name.isidentifier() or not name.isascii():
        return False
    if name.upper().endswith("_API_KEY") or name.upper() in {"API_KEY", "ANTHROPIC_AUTH_TOKEN"}:
        return True
    if not name.upper().endswith("_TOKEN"):
        return False
    from hermes_cli.credential_lifecycle import _providers_for_env_var
    return bool(_providers_for_env_var(name.upper()))


def _native_backend():
    # Select native implementations explicitly. Third-party plaintext backends
    # registered with Python keyring are unsuitable for encryption keys.
    if sys.platform == "win32":
        from keyring.backends.Windows import WinVaultKeyring as Backend
    elif sys.platform == "darwin":
        from keyring.backends.macOS import Keyring as Backend
    else:
        from keyring.backends.SecretService import Keyring as Backend
    return Backend()


class CredentialStoreUnavailable(RuntimeError):
    """Can be shown to the user without revealing native backend error details."""


_SERVICE = "Agent Czesiek API keys"
_KEY_ID = re.compile(r"[0-9a-f]{32}")


def seal_value(lines: list[str], name: str, value: str) -> str:
    """The caller holds the profile write lock. Only ciphertext and a key ID travel with a backup."""
    from cryptography.fernet import Fernet

    try:
        backend = _native_backend()
        master = None
        for line in lines:
            if MARKER in line:
                key_id = line.partition(MARKER)[2].partition(":")[0]
                if _KEY_ID.fullmatch(key_id):
                    master = backend.get_password(_SERVICE, key_id)
                    if master:
                        break
        if not master:
            # New profile or backup restored on another machine. Never overwrite a
            # missing key's ID; other entries may later be restored with its original key.
            key_id = uuid.uuid4().hex
            master = Fernet.generate_key().decode("ascii")
            backend.set_password(_SERVICE, key_id, master)
        ciphertext = Fernet(master.encode("ascii")).encrypt((name + "\0" + value).encode())
    except Exception as exc:
        raise CredentialStoreUnavailable(
            "Cannot save the API key. Unlock the OS credential store or configure an external secret source."
        ) from exc
    return MARKER + key_id + ":" + ciphertext.decode("ascii")


def unseal_value(name: str, raw: str) -> str:
    from cryptography.fernet import Fernet

    key_id, _, encrypted = raw.strip()[len(MARKER):].partition(":")
    if not _KEY_ID.fullmatch(key_id):
        raise ValueError("Invalid credential key ID")
    master = _native_backend().get_password(_SERVICE, key_id)
    if not master:
        raise CredentialStoreUnavailable("Profile key missing")
    plaintext = Fernet(master.encode("ascii")).decrypt(encrypted.encode("ascii")).decode()
    stored_name, separator, value = plaintext.partition("\0")
    if not separator or stored_name != name:
        raise ValueError("Encrypted credential belongs to a different setting")
    return value


def sealed_values(text: str) -> dict[str, str]:
    result = {}
    for line in text.splitlines():
        name, _, raw = line.strip().removeprefix("export ").partition("=")
        name = name.strip()
        if raw.strip().startswith(MARKER) and is_api_key(name):
            try:
                result[name] = unseal_value(name, raw)
            except Exception:
                logger.warning("Cannot unlock stored credential %s in this profile", name)
                result[name] = ""
        else:
            result.pop(name, None)
    return result


def migrate_legacy_keys(env_path: Path, text: str) -> None:
    """Move literal keys from a legacy profile into sealed assignments under its write lock."""
    from hermes_cli.config import get_env_path
    if env_path.resolve() != get_env_path().resolve():
        return
    candidates = []
    for line in text.splitlines():
        name, sep, raw = line.strip().removeprefix("export ").partition("=")
        name = name.strip()
        if sep and is_api_key(name) and raw.strip() and MARKER not in raw and "$" not in raw:
            candidates.append(name)
    if not candidates:
        return

    from hermes_cli.auth import _auth_store_lock
    from hermes_cli.config import _env_write_blocked, _save_env_assignment, invalidate_env_cache
    from hermes_cli.credential_lifecycle import _scrub_config_yaml_mirrors
    from dotenv import dotenv_values

    with _auth_store_lock(target_path=env_path.parent / ".env-write"):
        # Another process may have rotated or sealed the key since startup began.
        current = env_path.read_text(encoding="utf-8-sig")
        if current != text:
            return
        values = dotenv_values(env_path, interpolate=False, encoding="utf-8-sig")
        for name in dict.fromkeys(candidates):
            value = values.get(name)
            if not value or "$" in value or _env_write_blocked(name, "migrate"):
                continue
            # A config reference resolves both before and after sealing the assignment.
            _scrub_config_yaml_mirrors(value, "${" + name + "}")
            _save_env_assignment(env_path, name, value)
            invalidate_env_cache()
