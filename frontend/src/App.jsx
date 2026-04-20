import { useMemo, useRef, useState } from "react";
import { api } from "./api";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export default function App() {
  const [files, setFiles] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [pastedName, setPastedName] = useState("");
  const [results, setResults] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingText, setLoadingText] = useState(false);
  const [glossaryText, setGlossaryText] = useState("");
  const pastedCounterRef = useRef(1);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const activeResult = results[activeTab] || null;
  const handleAskAI = async (questionOverride = null) => {
    if (!activeResult) return;

    const finalQuestion = (questionOverride || aiQuestion).trim();
    if (!finalQuestion) return;

    setAiLoading(true);
    setAiAnswer("");

    try {
      const formData = new FormData();
      formData.append("question", finalQuestion);
      formData.append("analysis_payload", JSON.stringify(activeResult));

      const response = await api.post("/ask-ai", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setAiAnswer(response.data.answer);
      setAiQuestion(finalQuestion);
    } catch (error) {
      console.error(error);
      alert("AI request failed. Check backend configuration.");
    } finally {
      setAiLoading(false);
    }
  };
  const risk = useMemo(() => {
    if (!activeResult) return null;

    const bruteForceCount = activeResult.analysis.brute_force_candidates.length;
    const suspiciousIps = activeResult.analysis.suspicious_ips.length;
    const errors = activeResult.analysis.error_count;
    const success = activeResult.analysis.success_count;

    if (bruteForceCount > 0) {
      return {
        label: "High Risk",
        color: "#b91c1c",
        bg: "#fee2e2",
        border: "#fecaca",
        text: "The file contains repeated suspicious activity that may indicate unauthorized access attempts.",
      };
    }

    if (suspiciousIps > 0 || errors > success) {
      return {
        label: "Medium Risk",
        color: "#b45309",
        bg: "#fef3c7",
        border: "#fde68a",
        text: "The file contains unusual behavior worth checking, including repeated failures or suspicious activity.",
      };
    }

    return {
      label: "Low Risk",
      color: "#166534",
      bg: "#dcfce7",
      border: "#bbf7d0",
      text: "No major suspicious behavior was detected in the uploaded file.",
    };
  }, [activeResult]);

  const handleFilesChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    setFiles(selectedFiles);
  };
  const handleUploadFiles = async () => {
    if (!files.length) return;

    setLoadingFiles(true);

    try {
      const uploadedResults = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        if (keyword.trim()) {
          formData.append("keyword", keyword.trim());
        }

        if (glossaryText.trim()) {
          formData.append("glossary_text", glossaryText.trim());
        }

        const response = await api.post("/analyze", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        uploadedResults.push(response.data);
      }

      setResults((prev) => {
        const merged = mergeResultsByFilename(prev, uploadedResults);

        const firstUploadedName = uploadedResults[0]?.filename;
        const newActiveIndex = merged.findIndex(
          (item) => item.filename === firstUploadedName
        );

        setActiveTab(newActiveIndex >= 0 ? newActiveIndex : 0);
        return merged;
      });

      setFiles([]);
    } catch (error) {
      console.error(error);
      alert("File upload failed. Please make sure the backend is running and try again.");
    } finally {
      setLoadingFiles(false);
    }
  };
  const handleRemoveCurrentTab = () => {
    if (!results.length) return;

    setResults((prev) => {
      const next = prev.filter((_, index) => index !== activeTab);

      if (next.length === 0) {
        setActiveTab(0);
        setAiAnswer("");
        return [];
      }

      const nextActive = Math.min(activeTab, next.length - 1);
      setActiveTab(nextActive);
      setAiAnswer("");

      return next;
    });
  };

  const handleClearAllTabs = () => {
    setResults([]);
    setActiveTab(0);
    setAiAnswer("");
  };
  const handleAnalyzePastedText = async () => {
    if (!pastedText.trim()) return;

    setLoadingText(true);

    try {
      const formData = new FormData();
      formData.append("text", pastedText);

      if (keyword.trim()) {
        formData.append("keyword", keyword.trim());
      }
      if (glossaryText.trim()) {
        formData.append("glossary_text", glossaryText.trim());
      }
      const autoName = `Pasted Log ${pastedCounterRef.current}`;
      const finalName = pastedName.trim() || autoName;
      formData.append("source_name", finalName);

      const response = await api.post("/analyze-text", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setResults((prev) => {
        const merged = mergeResultsByFilename(prev, [response.data]);
        const newActiveIndex = merged.findIndex(
          (item) => item.filename === response.data.filename
        );
        setActiveTab(newActiveIndex >= 0 ? newActiveIndex : 0);
        return merged;
      });
      pastedCounterRef.current += 1;
      setPastedText("");
      setPastedName("");
    } catch (error) {
      console.error(error);
      alert("Pasted text analysis failed. Please make sure the backend is running and try again.");
    } finally {
      setLoadingText(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <section style={styles.hero}>
          <div style={styles.heroBadge}>Portfolio Project • Smart Log Investigation</div>
          <h1 style={styles.heroTitle}>Incident Insight</h1>
          <p style={styles.heroText}>
            A beginner-friendly tool for analyzing log files, pasted log messages,
            suspicious patterns, and keyword-driven technical investigations.
          </p>

          <div style={styles.heroActions}>
            <div style={styles.uploadPanel}>
              <input
                type="file"
                multiple
                onChange={handleFilesChange}
                style={styles.fileInput}
              />

              <input
                type="text"
                placeholder="Optional keyword, e.g. VPN, camera, proxy, timeout"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={styles.keywordInput}
              />

              <button
                onClick={handleUploadFiles}
                disabled={!files.length || loadingFiles}
                style={{
                  ...styles.primaryButton,
                  opacity: !files.length || loadingFiles ? 0.7 : 1,
                  cursor: !files.length || loadingFiles ? "not-allowed" : "pointer",
                }}
              >
                {loadingFiles ? "Analyzing..." : "Analyze Files"}
              </button>
            </div>

            {files.length > 0 && (
              <div style={styles.selectedFilesBox}>
                <strong>Selected files:</strong>
                <div style={styles.fileChipWrap}>
                  {files.map((file) => (
                    <span key={file.name} style={styles.fileChip}>
                      {file.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>Paste a log message or raw log text</h2>
          <p style={styles.sectionHint}>
            You can also paste log lines directly from WhatsApp, Slack, email, or any other source,
            without creating a file first.
          </p>

          <div style={styles.pasteControls}>
            <input
              type="text"
              placeholder="Optional name for this pasted log, e.g. WhatsApp VPN issue"
              value={pastedName}
              onChange={(e) => setPastedName(e.target.value)}
              style={styles.textInput}
            />

            <textarea
              placeholder="Paste raw log text here..."
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              style={styles.textArea}
            />

            <button
              onClick={handleAnalyzePastedText}
              disabled={!pastedText.trim() || loadingText}
              style={{
                ...styles.secondaryButton,
                opacity: !pastedText.trim() || loadingText ? 0.7 : 1,
                cursor: !pastedText.trim() || loadingText ? "not-allowed" : "pointer",
              }}
            >
              {loadingText ? "Analyzing..." : "Analyze Pasted Text"}
            </button>
          </div>
        </section>
        <section style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>Custom Glossary</h2>
          <p style={styles.sectionHint}>
            Paste custom product terms here. Each line should be in the format:
            <strong> term = explanation</strong> or <strong>term: explanation</strong>.
          </p>

        <textarea
          placeholder="Example:  Blocked = The action was blocked by policy"
          value={glossaryText}
          onChange={(e) => setGlossaryText(e.target.value)}
          style={styles.glossaryTextArea}
        />
        </section>
        <section style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>How it works</h2>
          <div style={styles.infoGrid}>
            <InfoCard
              title="Upload one or more log files"
              text="Start by uploading one or multiple authentication or system log files."
            />
            <InfoCard
              title="Paste raw log text"
              text="You can also paste a message or copied log directly, without saving it as a file."
            />
            <InfoCard
              title="Automatic investigation"
              text="Even without a keyword, the tool highlights repeated IPs, repeated terms, and recurring patterns automatically."
            />
          </div>
        </section>

        {results.length > 0 && (
          <section style={styles.sectionCard}>
            <h2 style={styles.sectionTitle}>Analysis Tabs</h2>
            <p style={styles.sectionHint}>
              Switch between uploaded files and pasted logs using the tabs below.
            </p>

            <div style={styles.tabWrap}>
              {results.map((result, index) => (
                <button
                  key={`${result.filename}-${index}`}
                  onClick={() =>{
                    setActiveTab(index);
                    setAiAnswer("");
                  }}
                  style={{
                    ...styles.tabButton,
                    ...(activeTab === index ? styles.tabButtonActive : {}),
                  }}
                >
                  {result.filename}
                </button>
              ))}
            </div>
            <div style={styles.tabActionsWrap}>
            <button style={styles.exportButton} onClick={handleRemoveCurrentTab}>
              Remove Current Tab
            </button>
            <button style={styles.exportButton} onClick={handleClearAllTabs}>
              Clear All Tabs
            </button>
          </div>
          </section>
        )}

        {activeResult && risk && (
          <>
            <section
              style={{
                ...styles.riskCard,
                backgroundColor: risk.bg,
                borderColor: risk.border,
              }}
            >
              <h2 style={{ ...styles.riskTitle, color: risk.color }}>
                Analysis Result: {risk.label}
              </h2>
              <p style={styles.riskText}>{risk.text}</p>
            </section>

            <section style={styles.metricsGrid}>
              <MetricCard
                title="Total Events"
                value={activeResult.total_events}
                subtitle="Parsed log entries"
              />
              <MetricCard
                title="Failed Events"
                value={activeResult.analysis.error_count}
                subtitle="Errors, denials, failed attempts"
              />
              <MetricCard
                title="Successful Events"
                value={activeResult.analysis.success_count}
                subtitle="Accepted or successful actions"
              />
              <MetricCard
                title="Suspicious IPs"
                value={activeResult.analysis.suspicious_ips.length}
                subtitle="IPs worth investigating"
              />
            </section>

            <section style={styles.sectionCard}>
              <h2 style={styles.sectionTitle}>Plain-English Summary</h2>
              <p style={styles.sectionHint}>
                This section is designed to help even first-time users understand the result.
              </p>

              <div style={styles.summaryBox}>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>Main conclusion</span>
                  <p style={styles.summaryMain}>{activeResult.summary.headline}</p>
                </div>

                <div style={styles.summaryColumns}>
                  <div>
                    <h3 style={styles.subTitle}>What the tool found</h3>
                    <ul style={styles.list}>
                      {activeResult.summary.findings.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 style={styles.subTitle}>Recommended next steps</h3>
                    <ul style={styles.list}>
                      {activeResult.summary.recommended_next_steps.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </section>
            <section style={styles.sectionCard}>
              <h2 style={styles.sectionTitle}>Ask the Investigation Assistant</h2>
              <p style={styles.sectionHint}>
                Ask a focused question about the current log analysis. The assistant answers only from the detected findings.
              </p>

              <div style={styles.aiActionsWrap}>
                <button style={styles.quickActionButton} onClick={() => handleAskAI("Explain the main issue in this log.")}>
                  Explain the main issue
                </button>
                <button style={styles.quickActionButton} onClick={() => handleAskAI("Suggest the next checks I should perform.")}>
                  Suggest next checks
                </button>
                <button style={styles.quickActionButton} onClick={() => handleAskAI("Explain this log for a non-technical user.")}>
                  Explain for non-technical user
                </button>
                <button style={styles.quickActionButton} onClick={() => handleAskAI("Write short support case notes for this log.")}>
                  Write case notes
                </button>
              </div>

              <div style={styles.aiInputWrap}>
                <input
                  type="text"
                  placeholder="Ask a question about this log..."
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  style={styles.textInput}
                />
                <button
                  onClick={() => handleAskAI()}
                  disabled={!activeResult || !aiQuestion.trim() || aiLoading}
                  style={{
                    ...styles.secondaryButton,
                    opacity: !activeResult || !aiQuestion.trim() || aiLoading ? 0.7 : 1,
                    cursor: !activeResult || !aiQuestion.trim() || aiLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {aiLoading ? "Thinking..." : "Ask AI"}
                </button>
              </div>

              {aiAnswer && (
                <div style={styles.aiAnswerBox}>
                  <pre style={styles.aiAnswerText}>{aiAnswer}</pre>
                </div>
              )}
            </section>
            <section style={styles.sectionCard}>
              <h2 style={styles.sectionTitle}>Copy / Export</h2>
              <p style={styles.sectionHint}>
                Copy or download ready-to-use summaries for tickets, notes, email updates, or internal investigation work.
              </p>

              <div style={styles.exportActionsWrap}>
                <button
                  style={styles.exportButton}
                  onClick={() => copyToClipboard(buildSimpleSummary(activeResult))}
                >
                  Copy Simple Summary
                </button>

                <button
                  style={styles.exportButton}
                  onClick={() => copyToClipboard(buildInvestigationSummary(activeResult))}
                >
                  Copy Investigation Summary
                </button>

                <button
                  style={styles.exportButton}
                  onClick={() => copyToClipboard(buildCaseNotes(activeResult))}
                >
                  Copy Case Notes
                </button>

                <button
                  style={styles.exportButton}
                  onClick={() =>
                    downloadTextFile(
                      `${activeResult.filename.replace(/\s+/g, "_")}_simple_summary.txt`,
                      buildSimpleSummary(activeResult)
                    )
                  }
                >
                  Download Simple Summary
                </button>

                <button
                  style={styles.exportButton}
                  onClick={() =>
                    downloadTextFile(
                      `${activeResult.filename.replace(/\s+/g, "_")}_investigation_summary.txt`,
                      buildInvestigationSummary(activeResult)
                    )
                  }
                >
                  Download Investigation Summary
                </button>

                <button
                  style={styles.exportButton}
                  onClick={() =>
                    downloadTextFile(
                      `${activeResult.filename.replace(/\s+/g, "_")}_case_notes.txt`,
                      buildCaseNotes(activeResult)
                    )
                  }
                >
                  Download Case Notes
                </button>
              </div>
            </section>
            <section style={styles.sectionCard}>
              <h2 style={styles.sectionTitle}>Smart Investigation</h2>
              <p style={styles.sectionHint}>
                This section tries to understand what the user may be investigating,
                either automatically or based on the optional keyword.
              </p>

              {activeResult.investigation.keyword ? (
                <p>
                  <strong>Search intent:</strong> {activeResult.investigation.keyword}
                </p>
              ) : (
                <p>
                  <strong>Search intent:</strong> Automatic theme detection
                </p>
              )}

              {activeResult.investigation.expanded_terms.length > 0 && (
                <>
                  <h3 style={styles.subTitle}>Related terms used</h3>
                  <div style={styles.tagWrap}>
                    {activeResult.investigation.expanded_terms.map((term) => (
                      <span key={term} style={styles.tag}>
                        {term}
                      </span>
                    ))}
                  </div>
                </>
              )}

              <h3 style={styles.subTitle}>Investigation summary</h3>
              <ul style={styles.list}>
                {activeResult.investigation.investigation_summary.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>

              <h3 style={styles.subTitle}>Detected themes</h3>
              {activeResult.investigation.detected_themes.length === 0 ? (
                <p>No clear themes were detected.</p>
              ) : (
                <div style={styles.tagWrap}>
                  {activeResult.investigation.detected_themes.map((item) => (
                    <span key={item.theme} style={styles.tag}>
                      {item.theme} ({item.count})
                    </span>
                  ))}
                </div>
              )}
            </section>
            <section style={styles.sectionCard}>
              <h2 style={styles.sectionTitle}>Likely Issue Categories</h2>
              <p style={styles.sectionHint}>
                These categories estimate what the log is most likely related to, based on repeated indicators and matched patterns.
              </p>

              {!activeResult.investigation.issue_categories ||
              activeResult.investigation.issue_categories.length === 0 ? (
                <p>No issue categories were detected.</p>
              ) : (
                <div style={styles.issueGrid}>
                  {activeResult.investigation.issue_categories.map((item) => (
                    <div key={item.category} style={styles.issueCard}>
                      <div style={styles.issueHeader}>
                        <div style={styles.issueTitle}>{item.label}</div>
                        <div style={styles.issueBadge}>{item.confidence}</div>
                      </div>
                      <div style={styles.issueScore}>Score: {item.score}</div>
                      <ul style={styles.issueReasons}>
                        {item.reasons.map((reason, index) => (
                          <li key={index}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section style={styles.sectionCard}>
              <h2 style={styles.sectionTitle}>Explained Terms in This Log</h2>
              <p style={styles.sectionHint}>
                These are glossary terms that were detected in the current log and explained using the built-in or custom glossary.
              </p>

              {!activeResult.explained_terms_in_log || activeResult.explained_terms_in_log.length === 0 ? (
                <p>No glossary terms were detected in this log.</p>
              ) : (
                <div style={styles.explainedTermsList}>
                  {activeResult.explained_terms_in_log.map((item, index) => (
                    <div key={`${item.term}-${index}`} style={styles.explainedTermCard}>
                      <div style={styles.explainedTermTitle}>{item.term}</div>
                      <div style={styles.explainedTermMeaning}>{item.meaning}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section style={styles.sectionCard}>
              <h2 style={styles.sectionTitle}>Repeated Terms</h2>
              <p style={styles.sectionHint}>
                These are words or indicators that appeared multiple times in the uploaded log.
              </p>

              {activeResult.investigation.repeated_terms.length === 0 ? (
                <p>No repeated terms were detected.</p>
              ) : (
                <div style={styles.tagWrap}>
                  {activeResult.investigation.repeated_terms.map((item) => (
                    <span key={item.term} style={styles.tag}>
                      {item.term} ({item.count})
                    </span>
                  ))}
                </div>
              )}
            </section>
            <section style={styles.sectionCard}>
              <h2 style={styles.sectionTitle}>Suggested Follow-up Keywords</h2>
              <p style={styles.sectionHint}>
                These suggested searches are based on the most likely issue categories and repeated indicators found in the log.
              </p>

              {!activeResult.investigation.suggested_keywords ||
              activeResult.investigation.suggested_keywords.length === 0 ? (
                <p>No keyword suggestions were generated.</p>
              ) : (
                <div style={styles.tagWrap}>
                  {activeResult.investigation.suggested_keywords.map((term) => (
                    <button
                      key={term}
                      style={styles.keywordSuggestionButton}
                      onClick={() => setKeyword(term)}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              )}
            </section>
            <section style={styles.sectionCard}>
              <h2 style={styles.sectionTitle}>Top Relevant Log Lines</h2>
              <p style={styles.sectionHint}>
                These are the lines most relevant to the automatic investigation or the keyword entered.
              </p>

              {activeResult.investigation.top_relevant_lines.length === 0 ? (
                <p>No keyword-specific relevant lines were found.</p>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Service</th>
                      <th style={styles.th}>Message</th>
                      <th style={styles.th}>Matched Terms</th>
                      <th style={styles.th}>Why Flagged</th>
                      <th style={styles.th}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeResult.investigation.top_relevant_lines.map((line, index) => (
                      <tr key={index}>
                        <td style={styles.td}>{line.service || "-"}</td>
                        <td style={styles.td}>{line.message}</td>
                        <td style={styles.td}>
                          {line.matched_terms?.length ? line.matched_terms.join(", ") : "-"}
                        </td>
                        <td style={styles.td}>
                          {line.why_flagged?.length ? line.why_flagged.join(", ") : "-"}
                        </td>
                        <td style={styles.td}>{line.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section style={styles.sectionCard}>
              <h2 style={styles.sectionTitle}>Activity Over Time</h2>
              <p style={styles.sectionHint}>
                This graph shows how many events appeared over time.
              </p>

              <div style={styles.chartBox}>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={activeResult.analysis.timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="hour" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" allowDecimals={false} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section style={styles.sectionCard}>
              <h2 style={styles.sectionTitle}>Extracted Entities</h2>
              <p style={styles.sectionHint}>
                The tool extracts frequent entities such as IPs, services, domains, and ports.
              </p>

              <div style={styles.twoColumnGrid}>
                <EntityList title="Top IPs" items={activeResult.investigation.entities.top_ips} />
                <EntityList title="Top Services" items={activeResult.investigation.entities.top_services} />
                <EntityList title="Top Domains" items={activeResult.investigation.entities.top_domains} />
                <EntityList title="Top Ports" items={activeResult.investigation.entities.top_ports} />
              </div>
            </section>

            <section style={styles.twoColumnGrid}>
              <div style={styles.sectionCard}>
                <h2 style={styles.sectionTitle}>Suspicious IP Activity</h2>
                <p style={styles.sectionHint}>
                  Repeated activity from the same IP may suggest abuse or repeated login attempts.
                </p>

                {activeResult.analysis.suspicious_ips.length === 0 ? (
                  <EmptyState text="No suspicious IP activity was detected in this file." />
                ) : (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>IP Address</th>
                        <th style={styles.th}>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeResult.analysis.suspicious_ips.map((item) => (
                        <tr key={item.ip}>
                          <td style={styles.td}>{item.ip}</td>
                          <td style={styles.td}>{item.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div style={styles.sectionCard}>
                <h2 style={styles.sectionTitle}>Most Active IPs</h2>
                <p style={styles.sectionHint}>
                  These IP addresses appeared most often in the uploaded log.
                </p>

                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>IP Address</th>
                      <th style={styles.th}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeResult.analysis.top_ips.map(([ip, count], index) => (
                      <tr key={index}>
                        <td style={styles.td}>{ip}</td>
                        <td style={styles.td}>{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section style={styles.sectionCard}>
              <h2 style={styles.sectionTitle}>Most Frequent Problematic Messages</h2>
              <p style={styles.sectionHint}>
                These messages appeared most often and may help explain the main issue.
              </p>

              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Log Message</th>
                    <th style={styles.th}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {activeResult.analysis.top_errors.map(([message, count], index) => (
                    <tr key={index}>
                      <td style={styles.td}>{message}</td>
                      <td style={styles.td}>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section style={styles.sectionCard}>
              <details>
                <summary style={styles.detailsSummary}>Developer View: Raw JSON Output</summary>
                <pre style={styles.pre}>{JSON.stringify(activeResult, null, 2)}</pre>
              </details>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function InfoCard({ title, text }) {
  return (
    <div style={styles.infoCard}>
      <h3 style={styles.infoTitle}>{title}</h3>
      <p style={styles.infoText}>{text}</p>
    </div>
  );
}

function MetricCard({ title, value, subtitle }) {
  return (
    <div style={styles.metricCard}>
      <h3 style={styles.metricTitle}>{title}</h3>
      <div style={styles.metricValue}>{value}</div>
      <p style={styles.metricSubtitle}>{subtitle}</p>
    </div>
  );
}

function EntityList({ title, items }) {
  return (
    <div style={styles.entityCard}>
      <h3 style={styles.entityTitle}>{title}</h3>
      {items.length === 0 ? (
        <p style={styles.entityEmpty}>No data found.</p>
      ) : (
        <ul style={styles.entityList}>
          {items.map((item, index) => (
            <li key={`${item.value}-${index}`} style={styles.entityItem}>
              <span>{item.value}</span>
              <strong>{item.count}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={styles.emptyState}>{text}</div>;
}
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    alert("Copied to clipboard");
  } catch (error) {
    console.error(error);
    alert("Copy failed");
  }
};
const downloadTextFile = (filename, content) => {
  try {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error(error);
    alert("Download failed");
  }
};
const buildSimpleSummary = (result) => {
  if (!result) return "";

  const lines = [];
  lines.push(`File: ${result.filename}`);
  lines.push(`Total events: ${result.total_events}`);
  lines.push(`Failed events: ${result.analysis.error_count}`);
  lines.push(`Successful events: ${result.analysis.success_count}`);
  lines.push(`Suspicious IPs: ${result.analysis.suspicious_ips.length}`);

  if (result.investigation?.detected_themes?.length) {
    lines.push(
      `Detected themes: ${result.investigation.detected_themes
        .map((item) => item.theme)
        .join(", ")}`
    );
  }

  if (result.investigation?.repeated_terms?.length) {
    lines.push(
      `Repeated terms: ${result.investigation.repeated_terms
        .slice(0, 5)
        .map((item) => item.term)
        .join(", ")}`
    );
  }

  return lines.join("\n");
};

const buildInvestigationSummary = (result) => {
  if (!result) return "";

  const lines = [];
  lines.push(`Investigation Summary — ${result.filename}`);
  lines.push("");

  if (result.investigation?.investigation_summary?.length) {
    lines.push("Main findings:");
    result.investigation.investigation_summary.forEach((item) => {
      lines.push(`- ${item}`);
    });
    lines.push("");
  }

  if (result.investigation?.issue_categories?.length) {
    lines.push("Likely issue categories:");
    result.investigation.issue_categories.forEach((item) => {
      lines.push(`- ${item.label} (${item.confidence}, score ${item.score})`);
    });
    lines.push("");
  }

  if (result.investigation?.suggested_keywords?.length) {
    lines.push(
      `Suggested keywords: ${result.investigation.suggested_keywords.join(", ")}`
    );
    lines.push("");
  }

  if (result.explained_terms_in_log?.length) {
    lines.push("Explained terms:");
    result.explained_terms_in_log.slice(0, 5).forEach((item) => {
      lines.push(`- ${item.term}: ${item.meaning}`);
    });
  }

  return lines.join("\n");
};
const mergeResultsByFilename = (existingResults, newResults) => {
  const merged = [...existingResults];

  for (const newResult of newResults) {
    const existingIndex = merged.findIndex(
      (item) => item.filename === newResult.filename
    );

    if (existingIndex >= 0) {
      merged[existingIndex] = newResult;
    } else {
      merged.push(newResult);
    }
  }

  return merged;
};
const buildCaseNotes = (result) => {
  if (!result) return "";

  const lines = [];
  lines.push("Case Notes");
  lines.push("----------");
  lines.push(`Source: ${result.filename}`);
  lines.push(`Total parsed events: ${result.total_events}`);
  lines.push(`Failed events: ${result.analysis.error_count}`);
  lines.push(`Successful events: ${result.analysis.success_count}`);

  if (result.investigation?.issue_categories?.length) {
    lines.push(
      `Likely issue categories: ${result.investigation.issue_categories
        .slice(0, 3)
        .map((item) => item.label)
        .join(", ")}`
    );
  }

  if (result.investigation?.detected_themes?.length) {
    lines.push(
      `Detected themes: ${result.investigation.detected_themes
        .slice(0, 3)
        .map((item) => item.theme)
        .join(", ")}`
    );
  }

  if (result.investigation?.entities?.top_ips?.length) {
    lines.push(
      `Repeated / top IPs: ${result.investigation.entities.top_ips
        .slice(0, 3)
        .map((item) => item.value)
        .join(", ")}`
    );
  }

  if (result.investigation?.repeated_terms?.length) {
    lines.push(
      `Repeated indicators: ${result.investigation.repeated_terms
        .slice(0, 5)
        .map((item) => item.term)
        .join(", ")}`
    );
  }

  if (result.investigation?.top_relevant_lines?.length) {
    lines.push("Relevant log lines:");
    result.investigation.top_relevant_lines.slice(0, 2).forEach((line, index) => {
      lines.push(`- Line ${index + 1}: ${line.message}`);
    });
  }

  lines.push(
    "Recommended action: review the highlighted indicators and correlate them with related application or infrastructure logs."
  );

  return lines.join("\n");
};
const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #eff6ff 0%, #f8fafc 18%, #f8fafc 100%)",
    padding: "32px 18px 60px",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: "#0f172a",
  },
  container: {
    maxWidth: "1160px",
    margin: "0 auto",
  },
  hero: {
    background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
    color: "white",
    borderRadius: "28px",
    padding: "34px",
    boxShadow: "0 20px 45px rgba(37, 99, 235, 0.18)",
    marginBottom: "22px",
  },
  heroBadge: {
    display: "inline-block",
    backgroundColor: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#dbeafe",
    padding: "8px 12px",
    borderRadius: "999px",
    fontSize: "0.9rem",
    marginBottom: "16px",
  },
  heroTitle: {
    fontSize: "3rem",
    margin: "0 0 12px 0",
    lineHeight: 1.1,
  },
  heroText: {
    maxWidth: "760px",
    lineHeight: 1.7,
    color: "#dbeafe",
    fontSize: "1.05rem",
    marginBottom: "22px",
  },
  heroActions: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  uploadPanel: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  fileInput: {
    backgroundColor: "rgba(255,255,255,0.95)",
    color: "#111827",
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.2)",
  },
  keywordInput: {
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    minWidth: "280px",
    fontSize: "0.95rem",
    outline: "none",
    backgroundColor: "#ffffff",
    color: "#0f172a",
    caretColor: "#0f172a",
  },
  primaryButton: {
    border: "none",
    backgroundColor: "#ffffff",
    color: "#1d4ed8",
    fontWeight: 700,
    padding: "12px 18px",
    borderRadius: "14px",
    boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
  },
  secondaryButton: {
    border: "none",
    backgroundColor: "#1d4ed8",
    color: "#ffffff",
    fontWeight: 700,
    padding: "12px 18px",
    borderRadius: "14px",
    width: "fit-content",
  },
  selectedFilesBox: {
    color: "#e0f2fe",
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: "12px",
    borderRadius: "14px",
    width: "fit-content",
    maxWidth: "100%",
  },
  fileChipWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "8px",
  },
  fileChip: {
    backgroundColor: "rgba(255,255,255,0.14)",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "0.9rem",
  },
  aiActionsWrap: {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginBottom: "14px",
  },
  quickActionButton: {
    border: "1px solid #cbd5e1",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: "10px 14px",
    borderRadius: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  aiInputWrap: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  aiAnswerBox: {
    marginTop: "16px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "16px",
  },
  aiAnswerText: {
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    color: "#334155",
    lineHeight: 1.7,
    textAlign: "left",
  },
  pasteControls: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  textInput: {
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    fontSize: "0.95rem",
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  textArea: {
    width: "100%",
    minHeight: "180px",
    resize: "vertical",
    padding: "14px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    fontSize: "0.95rem",
    color: "#0f172a",
    backgroundColor: "#ffffff",
    lineHeight: 1.6,
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    boxSizing: "border-box",
  },
  glossaryTextArea: {
    width: "100%",
    minHeight: "56px",
    height: "56px",
    resize: "none",
    overflow: "hidden",
    padding: "14px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    fontSize: "0.95rem",
    color: "#0f172a",
    backgroundColor: "#ffffff",
    lineHeight: 1.4,
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    boxSizing: "border-box",
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: "24px",
    padding: "24px",
    marginBottom: "20px",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.07)",
    border: "1px solid #eef2ff",
  },
  sectionTitle: {
    fontSize: "1.4rem",
    margin: "0 0 10px 0",
    color: "#0f172a",
  },
  sectionHint: {
    marginTop: 0,
    marginBottom: "16px",
    color: "#64748b",
    lineHeight: 1.6,
  },
  explainedTermsList: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "14px",
  },
  explainedTermCard: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "16px",
  },
  explainedTermTitle: {
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: "8px",
  },
  
  explainedTermMeaning: {
    color: "#475569",
    lineHeight: 1.6,
  },
  tabWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "12px",
  },
  tabActionsWrap: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "14px",
  },
  tabButton: {
    border: "1px solid #cbd5e1",
    backgroundColor: "#f8fafc",
    color: "#334155",
    padding: "10px 14px",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: 600,
  },
  tabButtonActive: {
    backgroundColor: "#dbeafe",
    borderColor: "#93c5fd",
    color: "#1d4ed8",
  },
  riskCard: {
    borderRadius: "22px",
    padding: "22px",
    marginBottom: "20px",
    border: "1px solid",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
  },
  riskTitle: {
    margin: "0 0 8px 0",
    fontSize: "1.35rem",
  },
  riskText: {
    margin: 0,
    lineHeight: 1.7,
    color: "#334155",
  },
  issueGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "16px",
  },
  issueCard: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "16px",
  },
  issueHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "10px",
  },
  issueTitle: {
    fontWeight: 700,
    color: "#0f172a",
  },
  issueBadge: {
    backgroundColor: "#dbeafe",
    color: "#1d4ed8",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "0.85rem",
    fontWeight: 700,
  },
  issueScore: {
    color: "#334155",
    fontWeight: 600,
    marginBottom: "10px",
  },
  issueReasons: {
    margin: 0,
    paddingLeft: "18px",
    color: "#475569",
    lineHeight: 1.6,
  },
  keywordSuggestionButton: {
    border: "1px solid #93c5fd",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: "8px 12px",
    borderRadius: "999px",
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginBottom: "20px",
  },
  metricCard: {
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    borderRadius: "22px",
    padding: "20px",
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
    border: "1px solid #e5e7eb",
  },
  metricTitle: {
    margin: 0,
    fontSize: "1rem",
    color: "#0f172a",
  },
  metricSubtitle: {
    margin: "8px 0 0 0",
    color: "#64748b",
    fontSize: "0.92rem",
  },
  metricValue: {
    fontSize: "2.2rem",
    fontWeight: 800,
    color: "#0f172a",
    marginTop: "10px",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: "16px",
  },
  infoCard: {
    borderRadius: "18px",
    padding: "18px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e5e7eb",
  },
  infoTitle: {
    margin: "0 0 8px 0",
    fontSize: "1rem",
    color: "#0f172a",
  },
  infoText: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.65,
  },
  summaryBox: {
    borderRadius: "18px",
    border: "1px solid #e5e7eb",
    backgroundColor: "#f8fafc",
    padding: "18px",
  },
  summaryRow: {
    marginBottom: "18px",
  },
  summaryLabel: {
    fontSize: "0.88rem",
    color: "#64748b",
    display: "block",
    marginBottom: "6px",
  },
  summaryMain: {
    margin: 0,
    fontSize: "1.05rem",
    color: "#0f172a",
    fontWeight: 600,
  },
  summaryColumns: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "18px",
  },
  subTitle: {
    marginTop: "18px",
    marginBottom: "10px",
    color: "#0f172a",
  },
  list: {
    margin: 0,
    paddingLeft: "18px",
    color: "#334155",
    lineHeight: 1.7,
  },
  chartBox: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "16px 12px 6px",
  },
  twoColumnGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "18px",
    marginBottom: "20px",
  },
  entityCard: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "16px",
  },
  entityTitle: {
    margin: "0 0 12px 0",
    fontSize: "1rem",
    color: "#0f172a",
  },
  entityEmpty: {
    color: "#64748b",
    margin: 0,
  },
  entityList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  entityItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid #e5e7eb",
    color: "#334155",
  },
  tagWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "10px",
  },
  tag: {
    backgroundColor: "#dbeafe",
    color: "#1d4ed8",
    padding: "8px 12px",
    borderRadius: "999px",
    fontSize: "0.9rem",
    fontWeight: 600,
  },
  exportActionsWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
  },
  exportButton: {
    border: "1px solid #cbd5e1",
    backgroundColor: "#ffffff",
    color: "#0f172a",
    padding: "10px 14px",
    borderRadius: "12px",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(15, 23, 42, 0.05)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    overflow: "hidden",
  },
  th: {
    textAlign: "left",
    padding: "12px",
    borderBottom: "2px solid #e5e7eb",
    color: "#0f172a",
    backgroundColor: "#f8fafc",
    fontSize: "0.95rem",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #e5e7eb",
    color: "#334155",
    lineHeight: 1.5,
    verticalAlign: "top",
  },
  emptyState: {
    borderRadius: "16px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e5e7eb",
    padding: "16px",
    color: "#475569",
  },
  detailsSummary: {
    cursor: "pointer",
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: "14px",
  },
  pre: {
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    padding: "16px",
    borderRadius: "16px",
    overflowX: "auto",
    fontSize: "0.9rem",
    lineHeight: 1.5,
    textAlign: "left",
    direction: "ltr",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
  },
};