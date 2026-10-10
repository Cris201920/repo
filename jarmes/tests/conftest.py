import sys
from datetime import datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from jarmes import clock  # noqa: E402
from jarmes.app_context import AppContext  # noqa: E402
from jarmes.config import Config  # noqa: E402

# Sábado, 10/10/2026, 05:30 — semana 1 (ímpar) do plano
START = datetime(2026, 10, 10, 5, 30)


class FakeClock:
    def __init__(self, start=START):
        self.t = start

    def __call__(self):
        return self.t

    def set(self, dt):
        self.t = dt


@pytest.fixture
def fake_clock():
    fc = FakeClock()
    clock.set_clock(fc)
    yield fc
    clock.set_clock(None)


@pytest.fixture
def ctx(tmp_path, fake_clock):
    c = AppContext(Config(data_dir=tmp_path / "dados", env={}), use_keyring=False)
    yield c
    c.close()


@pytest.fixture
def make_ctx(tmp_path, fake_clock):
    made = []

    def _make(name="dados", env=None):
        c = AppContext(Config(data_dir=tmp_path / name, env=env or {}), use_keyring=False)
        made.append(c)
        return c

    yield _make
    for c in made:
        try:
            c.close()
        except Exception:
            pass
