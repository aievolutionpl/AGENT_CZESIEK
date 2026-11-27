import os

import pytest


def test_provider_key_roundtrip_rotation_and_removal(tmp_path, monkeypatch):
    from hermes_cli.config import load_env, remove_env_value, save_env_value
    from hermes_cli.env_loader import load_hermes_dotenv
    from agent.secret_scope import load_env_file

    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    name = "OPENROUTER_API_KEY"
    path = tmp_path / ".env"
    path.write_text(f"{name}=legacy-first\nexport {name}=legacy-last\n")
    save_env_value(name, "fresh-value")
    assert "fresh-value" not in path.read_text() and "legacy-" not in path.read_text()
    assert load_env()[name] == "fresh-value"
    monkeypatch.delenv(name)
    load_hermes_dotenv(hermes_home=tmp_path)
    assert os.environ[name] == "fresh-value"
    assert load_env_file(path)[name] == "fresh-value"
    assert remove_env_value(name) and name not in load_env()
    assert name not in os.environ


def test_migrate_legacy_and_fail_closed_when_locked(tmp_path, monkeypatch, isolated_provider_keyring):
    from hermes_cli.config import save_env_value
    from hermes_cli.env_loader import load_hermes_dotenv
    from agent.secret_scope import load_env_file

    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    path = tmp_path / ".env"
    name = "OPENAI_API_KEY"
    path.write_text(f"{name}=legacy-test-value\n")
    load_hermes_dotenv(hermes_home=tmp_path)
    sealed = path.read_text()
    assert "legacy-test-value" not in sealed
    assert os.environ[name] == "legacy-test-value"
    isolated_provider_keyring.get_password.side_effect = RuntimeError("locked")
    with pytest.raises(RuntimeError, match="credential store"):
        save_env_value(name, "unsaved-test-value")
    assert path.read_text() == sealed and load_env_file(path)[name] == ""
