# Flow Cytometry Gating FCS Agent

### [Open the Live Application →](https://abusuraihsakhri.github.io/flow-cytometry-gating-fcs-agent/)

A browser-based explorer for **FCS list-mode event data**, plus separate Python utilities for deterministic metric-based task audits. The browser explorer runs entirely client-side; the Python API and CLI are independent tools.

## Browser FCS explorer

Open the live application or open `index.html` locally. Choose an `.fcs` file, select X/Y channels, draw a rectangular region on the plot (or enter inclusive numeric bounds), and export gated event rows as CSV. **Load synthetic example** displays an explicitly synthetic dataset without uploading a file.

The browser parser supports **FCS 2.0, 3.0 and 3.1**, list mode (`$MODE=L`), floating-point (`F`), double-precision (`D`), and 8/16/32-bit unsigned integer (`I`) data in either supported byte order. It accepts one dataset, at most 64 parameters, 250,000 events and a 128 MiB file. It rejects malformed headers, unsupported encodings and truncated DATA segments. Rendering is sampled to at most 20,000 events; gated counts use all imported events.

**Scientific limitations:** Channel values are used **as stored in the file**; their prior compensation state depends on the acquisition/export workflow. The browser does not apply spillover compensation, spectral unmixing, logicle/biexponential transforms, automatic population discovery, sequential gating, gating-ML export, or clinical interpretation. The rectangular gate and CSV export are exploratory, not a validated diagnostic pipeline. Verify results against established cytometry software before research reporting or clinical use.

**Privacy:** The static browser tool reads data locally into memory. It does not upload FCS content, store the dataset remotely, or call an analysis server. CSV files are generated in the browser. Avoid uploading sensitive data to untrusted deployments or using this application for regulated clinical processing.

## Python audit utilities

The existing Python entry points do **not** parse FCS files; they classify supplied numeric metrics using fixed, project-defined thresholds and return structured alerts. They are not validated biological reference intervals. The repository retains two implementations for compatibility: `cli.py` and `flow_cytometry_gate.cli`. The enrichment modules are generic threshold evaluators, not instrument QC validation algorithms.

Requirements: Python 3.10+.

```bash
git clone https://github.com/abusuraihsakhri/flow-cytometry-gating-fcs-agent.git
cd flow-cytometry-gating-fcs-agent
python -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[test]"

python cli.py audit --task-id TEST-01 --target SAMPLE-01 --primary 28.5 --secondary 14.2
python cli.py batch -i sample.csv -o results.csv
python cli.py verify-audit
python cli.py serve --host 127.0.0.1 --port 8000
```

API endpoints include `/health`, `/api/audit`, `/api/chat`, `/api/audit/logs`, and `/metrics`. FastAPI interactive documentation is at `http://127.0.0.1:8000/docs`. This backend is **not** provided by GitHub Pages.

The audit logs use in-memory HMAC-SHA256 chaining. Set `AUDIT_SECRET_KEY` to a securely generated random value before starting a persistent service; **the ledger is not durable across restarts** and is not a regulatory audit-log substitute. Identifier screening is regex-based and **does not guarantee PHI de-identification or HIPAA compliance**. Do not expose the unauthenticated development API publicly or feed it identifiable patient data. The `mock` chat adapter does not run an actual language model; external model integrations are not implemented.

For Docker, copy `.env.example` to `.env`, configure `AUDIT_SECRET_KEY`, and run `docker compose up --build`. The Docker image runs the Python API, not the static browser app.

## Tests

```bash
python -m pytest -q
node --test tests/*.test.cjs
node --check web/fcs.js
python -m build --wheel
```

GitHub Actions runs Python 3.10–3.12 tests and Node.js parser tests. Browser logic has no third-party JavaScript dependencies.

## Technology and compatibility

Plain HTML/CSS/JavaScript for the static explorer, with native `ArrayBuffer`, `DataView`, `Canvas` and `Blob` APIs; Python, Pydantic and FastAPI for the separate audit service. Modern evergreen browsers (Chrome, Firefox, Safari and Edge) are expected to support the browser tool. The FCS binary reader is JavaScript rather than Pyodide, avoiding a large Python runtime download.

## License

MIT — see [LICENSE](LICENSE).
