"""Regression checks for API input validation and audit log isolation."""
import math
import pytest
from pydantic import ValidationError

from agents.base import AuditTrail
from agents.llm_factory import LLMFactory
from agents.models import SystemTaskPayload


def test_rejects_non_finite_metrics():
    for value in (math.nan, math.inf, -math.inf):
        with pytest.raises(ValidationError):
            SystemTaskPayload(task_id="T", target_identifier="X", primary_metric=value)
        with pytest.raises(ValidationError):
            SystemTaskPayload(task_id="T", target_identifier="X", primary_metric=1, secondary_metric=value)


def test_rejects_empty_and_oversize_identifiers():
    for identifier in ("", "x" * 129):
        with pytest.raises(ValidationError):
            SystemTaskPayload(task_id=identifier, target_identifier="X", primary_metric=1)


def test_audit_readers_cannot_mutate_recorded_blocks():
    trail = AuditTrail(secret_key="test-only-hmac-key")
    trail.log("system", "worker", "CHECK", {"flag": "ok"})
    snapshot = trail.get_trail()
    snapshot[0]["payload_hash"] = "tampered"
    snapshot.append({"fake": True})
    assert len(trail.get_trail()) == 1
    assert trail.verify_integrity()


def test_unimplemented_external_models_fail_closed():
    for provider in ("ollama", "openai", "claude"):
        with pytest.raises(ValueError, match="not implemented"):
            LLMFactory.create(provider)
