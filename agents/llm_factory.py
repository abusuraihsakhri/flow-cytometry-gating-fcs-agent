"""Local deterministic mock adapter. Network LLM integrations are not implemented."""
from .base import PHIGuard


class MockLLM:
    def __init__(self, system_name: str = "Flow Cytometry Gating Fcs Agent"):
        self.system_name = system_name

    def invoke(self, prompt: str) -> str:
        PHIGuard.assert_no_phi(prompt)
        return (
            f"[{self.system_name} mock]: Received configuration query "
            f"({len(prompt)} characters). This mock does not analyze specimens, "
            "run an LLM, or verify clinical conclusions."
        )


class LLMFactory:
    @staticmethod
    def create(provider: str = "mock", system_name: str = "Flow Cytometry Gating Fcs Agent"):
        if str(provider).lower() in {"mock", "deterministic", "test"}:
            return MockLLM(system_name)
        raise ValueError(
            "LLM provider not implemented. Use 'mock'; no external provider "
            "integration is configured in this repository."
        )
