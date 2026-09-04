"""
Automated Pytest Test Suite for Flow Cytometry Gating Fcs Agent.
Domain: AI Drug Discovery, Structural Biology & Wet-Lab Robotics
Standard: wwPDB / IUPAC / OpenSMILES / ISAC Standards
"""
import os
import sys
import tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from agents.base import PHIGuard, AuditLogger, AuditTrail, SecurityException
from agents.models import SystemTaskPayload, UrgencyLevel, SystemIntegrityStatus
from agents.workers import InvariantQCWorker, SafetyEscalationWorker, ProtocolConformanceWorker
from agents.supervisor import SystemSupervisor
from cli import main


def test_phi_guard_enforcement():
    with pytest.raises(SecurityException):
        PHIGuard.assert_no_phi("Patient MRN-994827 blood culture positive for Staphylococcus")

    # Clean text passes
    PHIGuard.assert_no_phi("Analytical assay specimen KEY-001 optimal")


def test_phi_guard_redaction():
    redacted = PHIGuard.redact_phi("Patient MRN-12345678 has SSN 123-45-6789")
    assert "MRN" not in redacted
    assert "123-45-6789" not in redacted
    assert "[REDACTED_IDENTIFIER]" in redacted


def test_specialized_workers():
    # Worker 1: QC Invariant
    p1 = SystemTaskPayload(task_id="T1", target_identifier="KEY-01", primary_metric=35.0)
    alerts1 = InvariantQCWorker.evaluate(p1)
    assert len(alerts1) == 1
    assert alerts1[0].urgency == UrgencyLevel.ELEVATED

    # Worker 2: Safety
    p2 = SystemTaskPayload(task_id="T2", target_identifier="KEY-02", primary_metric=10.0, is_critical_flag=True)
    alerts2 = SafetyEscalationWorker.evaluate(p2)
    assert len(alerts2) == 1
    assert alerts2[0].urgency == UrgencyLevel.CRITICAL_STAT

    # Worker 3: Protocol Conformance
    p3 = SystemTaskPayload(task_id="T3", target_identifier="KEY-03", primary_metric=10.0, status_descriptor="DISCORDANT_ANOMALY")
    alerts3 = ProtocolConformanceWorker.evaluate(p3)
    assert len(alerts3) == 1


def test_supervisor_consensus_and_audit():
    supervisor = SystemSupervisor(model_provider="mock")
    payload = SystemTaskPayload(
        task_id="TASK-PROD-01",
        target_identifier="KEY-PROD-01",
        primary_metric=12.0,
        secondary_metric=4.0,
        status_descriptor="NOMINAL"
    )
    dossier = supervisor.process_task(payload)
    assert dossier.overall_urgency == UrgencyLevel.ROUTINE
    assert dossier.integrity_status == SystemIntegrityStatus.VALIDATED
    assert dossier.audit_hash != ""

    # Verify cryptographic audit trail
    assert AuditLogger.verify_integrity() is True

    # CLI tests
    assert main(["audit", "--task-id", "CLI-TEST-01"]) == 0
    assert main(["chat", "Explain", "specifications"]) == 0
    assert main(["verify-audit"]) == 0


def test_audit_trail_integrity_detection():
    """Verify that tampering with audit trail is detected."""
    trail = AuditTrail(secret_key="test-key-for-integrity-check")
    trail.log("test", "test_tier", "TEST_EVENT", {"data": "value1"})
    trail.log("test", "test_tier", "TEST_EVENT", {"data": "value2"})
    assert trail.verify_integrity() is True

    # Tamper with the first entry
    if trail.logs:
        trail.logs[0]["payload_hash"] = "tampered"
    assert trail.verify_integrity() is False


def test_batch_missing_input_file():
    """Test that batch command handles missing input file gracefully."""
    result = main(["batch", "-i", "nonexistent_file_12345.csv", "-o", "output.csv"])
    assert result == 1


def test_batch_with_valid_csv():
    """Test batch processing with a valid CSV file."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='') as f:
        f.write("task_id,target_identifier,primary_metric,secondary_metric,is_critical_flag,status_descriptor\n")
        f.write("BATCH-T1,TARGET-B1,12.0,4.0,False,NOMINAL\n")
        f.write("BATCH-T2,TARGET-B2,35.0,15.0,True,DISCORDANT\n")
        input_path = f.name

    output_path = input_path.replace('.csv', '_output.csv')
    try:
        result = main(["batch", "-i", input_path, "-o", output_path])
        assert result == 0
        assert os.path.isfile(output_path)

        import csv
        with open(output_path, 'r') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            assert len(rows) == 2
            assert "overall_urgency" in rows[0]
    finally:
        os.unlink(input_path)
        if os.path.exists(output_path):
            os.unlink(output_path)


def test_audit_trail_no_hardcoded_key():
    """Verify that AuditTrail generates a secure key when none is provided."""
    import warnings
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        trail = AuditTrail()
        # A warning should be emitted about ephemeral key
        assert len(w) == 1
        assert "AUDIT_SECRET_KEY not set" in str(w[0].message)
    assert trail.secret_key is not None
    assert len(trail.secret_key) > 0
