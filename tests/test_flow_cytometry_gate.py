import os
import sys
import tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from flow_cytometry_gate.models import FrontierPayload, ExecutionStatus
from flow_cytometry_gate.engine import FrontierDomainEngine
from flow_cytometry_gate.agents import CompensationMatrixAgent, LogicleTransformScalerAgent, DensityContourGatingAgent, FlowCytometryCoordinator
from flow_cytometry_gate.cli import main


def test_sub_agents():
    a1 = CompensationMatrixAgent()
    p1 = FrontierPayload("T1", "KEY-01", primary_metric=35.0, secondary_metric=4.0, status_descriptor="NOMINAL")
    alerts1 = a1.audit(p1)
    assert len(alerts1) == 1
    assert alerts1[0].status == ExecutionStatus.ELEVATED_RISK

    a2 = LogicleTransformScalerAgent()
    p2 = FrontierPayload("T2", "KEY-02", primary_metric=10.0, secondary_metric=15.0, status_descriptor="NOMINAL", is_critical_flag=True)
    alerts2 = a2.audit(p2)
    assert len(alerts2) == 1
    assert alerts2[0].status == ExecutionStatus.CRITICAL_INTERVENTION

    a3 = DensityContourGatingAgent()
    p3 = FrontierPayload("T3", "KEY-03", primary_metric=10.0, secondary_metric=4.0, status_descriptor="DISCORDANT_ANOMALY")
    alerts3 = a3.audit(p3)
    assert len(alerts3) == 1


def test_coordinator():
    coord = FlowCytometryCoordinator()
    p_nominal = FrontierPayload("T4", "KEY-04", primary_metric=12.0, secondary_metric=4.0, status_descriptor="NOMINAL")
    dossier = coord.process(p_nominal)
    assert dossier["overall_status"] == ExecutionStatus.NOMINAL.value
    assert dossier["total_alerts"] == 0

    ans = coord.query_supervisory_chat("What standard is applied?")
    assert "ISAC FCS 3.1 / Gating-ML Standards" in ans or "specifications" in ans


def test_cli():
    assert main(["audit", "--task-id", "CLI-01"]) == 0
    assert main(["chat", "What", "is", "the", "system", "status?"]) == 0


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
            assert "overall_status" in rows[0]
    finally:
        os.unlink(input_path)
        if os.path.exists(output_path):
            os.unlink(output_path)
