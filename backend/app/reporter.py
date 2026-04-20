def build_summary(analysis):
    findings = []

    if analysis["error_count"] > analysis["success_count"] and analysis["error_count"] > 0:
        findings.append("Failure volume is higher than successful activity.")

    if analysis["brute_force_candidates"]:
        findings.append("Possible brute-force pattern detected from one or more IP addresses.")

    if analysis["top_ips"]:
        findings.append("Repeated IP activity was detected in the uploaded log.")

    if not findings:
        findings.append("No major suspicious pattern detected in the uploaded log.")

    return {
        "headline": "Structured incident summary",
        "findings": findings,
        "recommended_next_steps": [
            "Review repeated failed events or blocked actions.",
            "Inspect recurring IP addresses, destinations, or services.",
            "Correlate findings with infrastructure and application logs.",
        ],
    }