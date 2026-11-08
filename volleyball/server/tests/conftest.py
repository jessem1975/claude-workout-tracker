import pytest

from .synth import DEFAULT_RALLIES, make_match


@pytest.fixture(scope="session")
def synth_match(tmp_path_factory):
    return make_match(tmp_path_factory.mktemp("media") / "match.mp4")


@pytest.fixture(scope="session")
def synth_match_silent(tmp_path_factory):
    return make_match(tmp_path_factory.mktemp("media") / "silent.mp4", audio=False, seed=11)


@pytest.fixture
def truth():
    return DEFAULT_RALLIES
