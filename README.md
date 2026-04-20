# Incident Insight

Incident Insight is a smart log investigation assistant designed to help support, operations, and technical teams understand logs more easily.

Instead of manually scanning raw log lines, users can upload log files or paste raw log text and receive readable investigation outputs such as repeated indicators, likely issue categories, glossary-based explanations, and ready-to-use summaries.

## Project Overview

This project was built to turn raw logs into a more accessible investigation workflow.

The system helps users:
- analyze one or multiple log files
- paste raw log text directly without creating a file
- detect repeated IPs and repeated terms
- identify likely issue categories
- understand product-specific terms through a custom glossary
- generate readable summaries and support case notes
- export investigation results for internal use

The goal is not only to parse logs, but to make them easier to understand for support and operations workflows.

## Main Features

- Multi-file log upload
- Pasted raw log text support
- Automatic pattern detection
- Repeated terms analysis
- Repeated IP detection
- Likely issue category detection
- Suggested follow-up keywords
- Custom glossary support for company-specific terms
- Explained terms detected in the current log
- Local investigation assistant with rule-based interpretation
- Quick actions for:
  - explaining the main issue
  - suggesting next checks
  - explaining the log for a non-technical user
  - generating support case notes
- Copy to clipboard actions
- Download summaries as TXT files
- Tab-based browsing between multiple analyzed logs

## Example Use Cases

- Investigating VPN-related log activity
- Understanding DNS or timeout issues
- Detecting repeated IP activity
- Investigating camera / CCTV / IoT traffic
- Explaining internal product terms using a custom glossary
- Creating readable support case notes from raw logs

## Tech Stack

### Backend
- Python
- FastAPI

### Frontend
- React
- Vite
- Axios
- Recharts

### Logic Layer
- Rule-based parsing
- Repeated indicator detection
- Theme detection
- Issue category ranking
- Glossary-aware explanations
- Local interpretation engine

## Project Structure

```text
incident-insight/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── parser.py
│   │   ├── analyzer.py
│   │   ├── investigator.py
│   │   ├── reporter.py
│   │   ├── glossary.py
│   │   └── local_interpreter.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   └── ...
│   └── package.json
└── README.md
