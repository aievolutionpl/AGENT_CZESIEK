"""Packaged discovery follows the builder's product identity in live and staging output."""
import json

import pytest

from hermes_cli.main_desktop import _desktop_packaged_executable_in


@pytest.mark.linux_only
def test_rebranded_executable_discovered_in_release_and_staging(tmp_path):
    (tmp_path / 'package.json').write_text(json.dumps({
        'productName': 'Display name',
        'build': {'productName': 'Packaged name', 'executableName': 'Custom executable'},
    }))
    for output in ('release', '.staging-test'):
        release = tmp_path / output
        executable = release / 'linux-unpacked' / 'Custom executable'
        executable.parent.mkdir(parents=True)
        executable.write_bytes(b'app')
        executable.chmod(0o755)
        assert _desktop_packaged_executable_in(release) == executable
        executable.unlink()
        assert _desktop_packaged_executable_in(release) is None


@pytest.mark.linux_only
def test_legacy_checkout_without_product_fields(tmp_path):
    (tmp_path / 'package.json').write_text('{}')
    release = tmp_path / 'release'
    executable = release / 'linux-unpacked' / 'Hermes'
    executable.parent.mkdir(parents=True)
    executable.write_bytes(b'app')
    executable.chmod(0o755)
    assert _desktop_packaged_executable_in(release) == executable
