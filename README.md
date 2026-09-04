# Flow Cytometry Gating Fcs Agent

> **Domain:** Computational Biology & AI Drug Discovery  
> **Reference Guidelines & Standards:** `wwPDB, IUPAC & CLSI Computational Guidelines`

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12-3776AB.svg?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688.svg?logo=fastapi&logoColor=white)
![Audit Trail](https://img.shields.io/badge/Audit-HMAC--SHA256_Tamper--Evident-brightgreen.svg)
![Zero-PHI Guard](https://img.shields.io/badge/Guard-Zero--PHI_Outbound-blue.svg)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker&logoColor=white)

</div>

---

## 📖 What It Does

Flow Cytometry Gating Fcs Agent is an enterprise-grade analytical platform for flow cytometry data evaluation, compensation, and automated gating. It orchestrates specialized worker agents to evaluate specimen metrics, detect anomalies, and produce cryptographically signed audit dossiers.

---

## ⚙️ Key Capabilities & Algorithmic Modules

- **Deterministic Calculation Engine**: Strict compliance with standard reference formulations and thresholds.
- **Risk & Urgency Classification**: Multi-tier categorization with automated clinical/operational action recommendations.
- **Validation & Guardrails**: Rigorous input bounds checking and anomaly detection.
- **Multi-Worker Agent Architecture**: Specialized workers for QC invariant checking, safety escalation, and protocol conformance.
- **Enrichment Suite**: 8 domain-specific analytical engines for comprehensive specimen evaluation.

---

## 💻 Installation

```bash
# Clone the repository
git clone https://github.com/abusuraihsakhri/flow-cytometry-gating-fcs-agent.git
cd flow-cytometry-gating-fcs-agent

# Install dependencies
pip install fastapi uvicorn pydantic pytest

# For production, set the audit secret key
export AUDIT_SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
```

---

## 🖥️ CLI Quickstart & Usage

### 1. Run Single Audit
```bash
python cli.py audit --task-id TASK-001 --target TARGET-01 --primary 28.5 --secondary 14.2 --critical --status DISCORDANT
```

### 2. Supervisor Chat Query
```bash
python cli.py chat "What is the system status?"
```

### 3. Batch Process CSV Records
```bash
python cli.py batch -i sample.csv -o results.csv
```

### 4. Verify Audit Trail Integrity
```bash
python cli.py verify-audit
```

### 5. Launch REST API Server
```bash
python cli.py serve --host 127.0.0.1 --port 8000
```

### Parameter Reference
| Parameter | Description | Default |
|:----------|:------------|:--------|
| `--task-id` | Unique task / case identifier | `TASK-2026-001` |
| `--target` | Entity or specimen key | `KEY-TARGET-01` |
| `--primary` | Primary domain measurement | `28.5` |
| `--secondary` | Secondary kinetic/confidence score | `14.2` |
| `--critical` | Emergency escalation flag | `False` |
| `--status` | Status code or phenotype descriptor | `DISCORDANT` |

### Input Data Schema (CSV Batch)

| Field | Description | Requirement |
|:------|:------------|:------------|
| `task_id` | Parameter / observation metric | Required |
| `target_identifier` | Specimen / target identifier | Required |
| `primary_metric` | Primary measurement value | Required |
| `secondary_metric` | Secondary measurement value | Required |
| `is_critical_flag` | Emergency escalation flag | Required |
| `status_descriptor` | Status or phenotype descriptor | Required |

---

## 🛡️ Security & Enterprise Architecture

* **Zero-PHI Outbound Interceptor:** Active regex inspection blocking SSNs, MRNs, phone numbers, and patient identifiers.
* **Tamper-Evident HMAC-SHA256 Audit Trail:** Chained, cryptographically signed logs for every evaluation and state transition.
* **Secure Key Generation:** Uses `secrets.token_hex()` for ephemeral key generation when `AUDIT_SECRET_KEY` is not set.
* **Air-Gapped LLM Reasoning Adapter:** Agnostic integration for local Ollama instances (`llama3`, `mistral`), Claude 3.5 Sonnet, GPT-4o, and deterministic test mocks.
* **FastAPI & Prometheus Telemetry:** Exposes OpenAPI 3.1 REST endpoints and operational Prometheus metrics (`/metrics`).

### Environment Variables

| Variable | Description | Required |
|:---------|:------------|:---------|
| `AUDIT_SECRET_KEY` | HMAC-SHA256 key for audit trail signing | Recommended |
| `MODEL_PROVIDER` | LLM provider (mock/ollama/claude/openai) | No (default: mock) |

---

## 🧪 Testing & Verification

Run the automated test suite:

```bash
pytest -v
```

Execute high-throughput batch simulation benchmarks:

```bash
python simulator.py 1000
```

---

## 🐳 Container Deployment

### Using Docker
```bash
# Copy environment template
cp .env.example .env
# Edit .env and set AUDIT_SECRET_KEY

# Build and run
docker build -t flow-cytometry-gating-fcs-agent .
docker run -p 8000:8000 --env-file .env flow-cytometry-gating-fcs-agent
```

### Using Docker Compose
```bash
cp .env.example .env
# Edit .env and set AUDIT_SECRET_KEY
docker-compose up -d
```

---

## 📁 Project Structure

```
flow-cytometry-gating-fcs-agent/
├── agents/                     # Core agent modules (supervisor, workers, API)
│   ├── api.py                  # FastAPI REST endpoints
│   ├── base.py                 # Security, PHI guard, audit trail
│   ├── models.py               # Pydantic data models
│   ├── supervisor.py           # Orchestrator coordinator
│   ├── workers.py              # Specialized evaluation workers
│   ├── llm_factory.py          # LLM provider abstraction
│   ├── metrics.py              # Prometheus metrics collector
│   ├── learning.py             # Bayesian calibration engine
│   └── streamer.py             # WebSocket telemetry broadcaster
├── flow_cytometry_gate/        # Flow cytometry-specific engine
│   ├── agents.py               # Specialized sub-agents
│   ├── engine.py               # Domain evaluation engine
│   ├── models.py               # Data models
│   ├── cli.py                  # CLI for flow cytometry engine
│   └── server.py               # FastAPI server factory
├── tests/                      # Test suite
├── web/index.html              # Operations console
├── cli.py                      # Main CLI entry point
├── simulator.py                # High-throughput simulator
├── enrichment.py               # Domain enrichment engines
├── Dockerfile                  # Container image
├── docker-compose.yml          # Container orchestration
└── pyproject.toml              # Project metadata
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
