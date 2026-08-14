import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardLayout from "../components/DashboardLayout";
import { getReport } from "../api/reports";
import "../styles/Reports.css";

function toInputDate(date) {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMinutes(value) {
  const minutes = Math.max(0, Math.round(Number(value) || 0));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase().replaceAll(" ", "-");
}

function ReportIcon({ type }) {
  const paths = {
    tickets: <><path d="M4 6h16v12H4z" /><path d="M8 6v12" /><path d="M16 6v12" /></>,
    active: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
    resolved: <><circle cx="12" cy="12" r="8" /><path d="m8.5 12 2.3 2.3 4.8-5" /></>,
    unassigned: <><circle cx="9" cy="8" r="3" /><path d="M4 19a5 5 0 0 1 10 0" /><path d="M17 8h4" /><path d="M19 6v4" /></>,
    critical: <><path d="M12 3 3 20h18L12 3z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
    rate: <><path d="M5 18 19 6" /><circle cx="7" cy="7" r="2" /><circle cx="17" cy="17" r="2" /></>,
    export: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    sheet: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v5h5" /><path d="M9 12h7" /><path d="M9 16h7" /></>,
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[type]}
    </svg>
  );
}

function EmptyChart({ message = "No data for this period." }) {
  return <div className="report-chart-empty">{message}</div>;
}

function Reports() {
  const navigate = useNavigate();
  const reportRef = useRef(null);
  const today = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const date = new Date(today);
    date.setDate(date.getDate() - 29);
    return toInputDate(date);
  }, [today]);
  const defaultTo = useMemo(() => toInputDate(today), [today]);

  const [report, setReport] = useState(null);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [customFrom, setCustomFrom] = useState(defaultFrom);
  const [customTo, setCustomTo] = useState(defaultTo);
  const [activePreset, setActivePreset] = useState("30days");
  const [breakdownFilter, setBreakdownFilter] = useState("status");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");

  const loadReport = useCallback(async (nextFrom, nextTo, signal) => {
    try {
      setLoading(true);
      setError("");
      const data = await getReport(nextFrom, nextTo, signal);
      setReport(data);
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(requestError.message || "The report could not be loaded.");
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadReport(defaultFrom, defaultTo, controller.signal);
    return () => controller.abort();
  }, [defaultFrom, defaultTo, loadReport]);

  function applyRange(nextFrom, nextTo, preset) {
    setFrom(nextFrom);
    setTo(nextTo);
    setCustomFrom(nextFrom);
    setCustomTo(nextTo);
    setActivePreset(preset);
    loadReport(nextFrom, nextTo);
  }

  function applyPreset(preset) {
    const now = new Date();
    let nextFrom = new Date(now);
    const nextTo = toInputDate(now);

    if (preset === "7days") nextFrom.setDate(nextFrom.getDate() - 6);
    if (preset === "30days") nextFrom.setDate(nextFrom.getDate() - 29);
    if (preset === "month") nextFrom = startOfMonth(now);

    applyRange(toInputDate(nextFrom), nextTo, preset);
  }

  function applyCustomRange() {
    if (!customFrom || !customTo) {
      setError("Choose both a start and end date.");
      return;
    }
    if (customFrom > customTo) {
      setError("The start date cannot be after the end date.");
      return;
    }
    applyRange(customFrom, customTo, "custom");
  }

  async function exportPdf() {
    const reportElement = reportRef.current;
    if (!reportElement || !report) return;

    try {
      setExporting("pdf");
      reportElement.classList.add("export-mode");
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const html2canvasModule = await import("html2canvas");
      const jsPdfModule = await import("jspdf");
      const html2canvas = html2canvasModule.default;
      const JsPdf = jsPdfModule.jsPDF || jsPdfModule.default;

      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const pdf = new JsPdf("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const usableWidth = pageWidth - margin * 2;
      const imageHeight = (canvas.height * usableWidth) / canvas.width;
      const imageData = canvas.toDataURL("image/png");
      let heightLeft = imageHeight;
      let position = margin;

      pdf.addImage(imageData, "PNG", margin, position, usableWidth, imageHeight, undefined, "FAST");
      heightLeft -= pageHeight - margin * 2;

      while (heightLeft > 0) {
        pdf.addPage();
        position = margin - (imageHeight - heightLeft);
        pdf.addImage(imageData, "PNG", margin, position, usableWidth, imageHeight, undefined, "FAST");
        heightLeft -= pageHeight - margin * 2;
      }

      pdf.save(`SupportHub-Report-${from}-to-${to}.pdf`);
    } catch (exportError) {
      setError(exportError.message || "The PDF could not be generated.");
    } finally {
      reportElement.classList.remove("export-mode");
      setExporting("");
    }
  }

  async function exportExcel() {
    if (!report) return;

    try {
      setExporting("excel");
      const XLSX = await import("xlsx");
      const summary = report.summary || {};
      const charts = report.charts || {};
      const agents = report.agentPerformance || [];
      const recentTickets = report.recentTickets || [];
      const workbook = XLSX.utils.book_new();

      const summaryRows = [
        { Metric: "Reporting Period", Value: `${formatDate(report.from)} - ${formatDate(report.to)}` },
        { Metric: "Total Tickets", Value: summary.totalTickets || 0 },
        { Metric: "Active Tickets", Value: summary.openTickets || 0 },
        { Metric: "Resolved Tickets", Value: summary.resolvedTickets || 0 },
        { Metric: "Closed Tickets", Value: summary.closedTickets || 0 },
        { Metric: "Unassigned Tickets", Value: summary.unassignedTickets || 0 },
        { Metric: "Critical Tickets", Value: summary.criticalTickets || 0 },
        { Metric: "Resolution Rate (%)", Value: summary.resolutionRate || 0 },
        { Metric: "Average Resolution Minutes", Value: summary.averageResolutionMinutes || 0 },
        { Metric: "Total Work Minutes", Value: summary.totalWorkMinutes || 0 },
        { Metric: "Average Work Minutes", Value: summary.averageWorkMinutes || 0 },
      ];

      const agentRows = agents.map((agent) => ({
        Agent: agent.name,
        Email: agent.email,
        Assigned: agent.assignedTickets,
        Resolved: agent.resolvedTickets,
        "Current Active": agent.activeTickets,
        "Resolution Rate (%)": agent.assignedTickets ? Math.round((agent.resolvedTickets / agent.assignedTickets) * 100) : 0,
        "Total Work Minutes": agent.totalWorkMinutes,
        "Average Work Minutes": agent.averageWorkMinutes,
        "Comments Added": agent.commentsAdded,
        "Activity Count": agent.activityCount,
        Reassignments: agent.reassignments,
      }));

      const recentRows = recentTickets.map((ticket) => ({
        Ticket: ticket.ticketNumber,
        Subject: ticket.subject,
        Employee: ticket.employee,
        "Assigned Agent": ticket.assignedTo,
        Category: ticket.category,
        Priority: ticket.priority,
        Status: ticket.status,
        Created: formatDateTime(ticket.createdAt),
      }));

      const addSheet = (rows, name) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);
      addSheet(summaryRows, "Summary");
      addSheet(agentRows, "Agent Performance");
      addSheet(charts.ticketsByCategory || [], "Categories");
      addSheet(charts.ticketsByPriority || [], "Priorities");
      addSheet(charts.ticketsByStatus || [], "Statuses");
      addSheet(recentRows, "Recent Tickets");
      XLSX.writeFile(workbook, `SupportHub-Report-${from}-to-${to}.xlsx`);
    } catch (exportError) {
      setError(exportError.message || "The Excel file could not be generated.");
    } finally {
      setExporting("");
    }
  }

  if (loading && !report) {
    return (
      <DashboardLayout activePage="reports">
        <div className="reports-state-card">
          <div className="reports-loader" />
          <h2>Building your report</h2>
          <p>Loading ticket trends and team performance...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error && !report) {
    return (
      <DashboardLayout activePage="reports">
        <div className="reports-state-card error">
          <h2>Reports unavailable</h2>
          <p>{error}</p>
          <button type="button" onClick={() => loadReport(from, to)}>Try Again</button>
        </div>
      </DashboardLayout>
    );
  }

  const summary = report?.summary || {};
  const charts = report?.charts || {};
  const agents = report?.agentPerformance || [];
  const recentTickets = report?.recentTickets || [];
  const hasTickets = Number(summary.totalTickets || 0) > 0;
  const generatedAt = new Date();

  const agentRows = agents.map((agent) => ({
    ...agent,
    resolutionRate: agent.assignedTickets ? Math.round((agent.resolvedTickets / agent.assignedTickets) * 100) : 0,
    totalActivity: Number(agent.commentsAdded || 0) + Number(agent.activityCount || 0),
  }));

  const maxWorkload = Math.max(1, ...agentRows.map((agent) => Number(agent.activeTickets || 0)));

  const breakdownOptions = {
    status: {
      label: "Status",
      eyebrow: "Workflow",
      title: "Tickets by Status",
      description: "See how tickets are distributed across the workflow.",
      data: charts.ticketsByStatus || [],
    },
    priority: {
      label: "Priority",
      eyebrow: "Urgency",
      title: "Tickets by Priority",
      description: "Compare ticket urgency during the selected period.",
      data: charts.ticketsByPriority || [],
    },
    category: {
      label: "Category",
      eyebrow: "Problem areas",
      title: "Tickets by Category",
      description: "Compare the types of requests generating the most support demand.",
      data: charts.ticketsByCategory || [],
    },
  };

  const breakdown = breakdownOptions[breakdownFilter];

  return (
    <DashboardLayout activePage="reports">
      <main className="reports-page">
        <header className="reports-page-header">
          <div>
            <span className="reports-eyebrow">Management insights</span>
            <h1>Reports &amp; Analytics</h1>
            <p>Monitor help desk performance, ticket trends, and team workload.</p>
          </div>
          <div className="reports-export-actions">
            <button type="button" className="report-export-button" onClick={exportPdf} disabled={Boolean(exporting)}>
              <ReportIcon type="export" />
              {exporting === "pdf" ? "Generating PDF..." : "Export PDF"}
            </button>
            <button type="button" className="report-export-button primary" onClick={exportExcel} disabled={Boolean(exporting)}>
              <ReportIcon type="sheet" />
              {exporting === "excel" ? "Building Excel..." : "Export Excel"}
            </button>
          </div>
        </header>

        <section className="reports-filter-panel" aria-label="Reporting period">
          <div className="report-presets">
            <button className={activePreset === "today" ? "active" : ""} onClick={() => applyPreset("today")}>Today</button>
            <button className={activePreset === "7days" ? "active" : ""} onClick={() => applyPreset("7days")}>Last 7 Days</button>
            <button className={activePreset === "30days" ? "active" : ""} onClick={() => applyPreset("30days")}>Last 30 Days</button>
            <button className={activePreset === "month" ? "active" : ""} onClick={() => applyPreset("month")}>This Month</button>
            <button className={activePreset === "custom" ? "active" : ""} onClick={() => setActivePreset("custom")}>Custom</button>
          </div>

          <div className={`report-custom-range ${activePreset === "custom" ? "visible" : ""}`}>
            <label>From<input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></label>
            <label>To<input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></label>
            <button type="button" onClick={applyCustomRange}>Apply</button>
          </div>

          <div className="reports-period-chip">
            <span>Reporting period</span>
            <strong>{formatDate(report?.from)} — {formatDate(report?.to)}</strong>
            {loading && <small>Refreshing...</small>}
          </div>
        </section>

        {error && report && (
          <div className="reports-inline-error">
            <span>{error}</span>
            <button type="button" onClick={() => { setError(""); loadReport(from, to); }}>Retry</button>
          </div>
        )}

        {!hasTickets && (
          <div className="reports-no-activity">
            <strong>No ticket activity was recorded during this period.</strong>
            <p>Choose another date range to view historical activity.</p>
          </div>
        )}

        <div id="report-export-area" ref={reportRef} className="report-export-area">
          <div className="report-document-heading">
            <div>
              <span>SupportHub</span>
              <h2>IT Help Desk Performance Report</h2>
              <p>{formatDate(report?.from)} — {formatDate(report?.to)}</p>
            </div>
            <div>
              <small>Generated</small>
              <strong>{formatDateTime(generatedAt)}</strong>
            </div>
          </div>

          <section className="report-kpi-grid">
            <article><div className="report-kpi-icon"><ReportIcon type="tickets" /></div><div><span>Total Tickets</span><strong>{summary.totalTickets || 0}</strong><small>Created in this period</small></div></article>
            <article><div className="report-kpi-icon"><ReportIcon type="active" /></div><div><span>Active Tickets</span><strong>{summary.openTickets || 0}</strong><small>From tickets created in this period</small></div></article>
            <article><div className="report-kpi-icon"><ReportIcon type="resolved" /></div><div><span>Resolved</span><strong>{summary.resolvedTickets || 0}</strong><small>{summary.closedTickets || 0} additionally closed</small></div></article>
            <article><div className="report-kpi-icon"><ReportIcon type="unassigned" /></div><div><span>Unassigned</span><strong>{summary.unassignedTickets || 0}</strong><small>Waiting for ownership</small></div></article>
            <article><div className="report-kpi-icon warning"><ReportIcon type="critical" /></div><div><span>Critical</span><strong>{summary.criticalTickets || 0}</strong><small>Needs close monitoring</small></div></article>
            <article><div className="report-kpi-icon"><ReportIcon type="rate" /></div><div><span>Resolution Rate</span><strong>{Number(summary.resolutionRate || 0).toFixed(1)}%</strong><small>Resolved or closed</small></div></article>
          </section>

          <section className="report-panel report-volume-panel">
            <div className="report-panel-heading">
              <div><span>Demand trend</span><h2>Ticket Volume</h2><p>New tickets created throughout the selected period.</p></div>
            </div>
            <div className="report-chart-large">
              {(charts.ticketsByDay || []).length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts.ticketsByDay} margin={{ top: 12, right: 18, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ticketVolumeFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6C5FA0" stopOpacity="0.24" />
                        <stop offset="100%" stopColor="#6C5FA0" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#EEEAF4" />
                    <XAxis dataKey="label" tick={{ fill: "#8B8695", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28} />
                    <YAxis allowDecimals={false} tick={{ fill: "#8B8695", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ border: "1px solid #E9E5F1", borderRadius: 12, boxShadow: "0 10px 30px rgba(67,55,100,.08)" }} />
                    <Area type="monotone" dataKey="count" name="Tickets" stroke="#6C5FA0" strokeWidth={2.5} fill="url(#ticketVolumeFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </div>
          </section>

          <section className="report-panel report-breakdown-panel">
            <div className="report-panel-heading report-breakdown-heading">
              <div>
                <span>{breakdown.eyebrow}</span>
                <h2>{breakdown.title}</h2>
                <p>{breakdown.description}</p>
              </div>
              <div className="report-breakdown-filter" aria-label="Ticket breakdown filter">
                {Object.entries(breakdownOptions).map(([key, option]) => (
                  <button
                    key={key}
                    type="button"
                    className={breakdownFilter === key ? "active" : ""}
                    onClick={() => setBreakdownFilter(key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="report-chart-breakdown">
              {breakdown.data.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={breakdown.data} layout="vertical" margin={{ top: 4, right: 30, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#EEEAF4" />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: "#8B8695", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" width={105} tick={{ fill: "#5D5670", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Tickets" fill="#6C5FA0" radius={[0, 7, 7, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart message={`No ${breakdown.label.toLowerCase()} data for this period.`} />}
            </div>
          </section>

          <section className="report-service-section">
            <div className="report-section-heading">
              <span>Efficiency</span>
              <h2>Service Performance</h2>
              <p>How quickly the help desk moved work during the selected period.</p>
            </div>
            <div className="report-service-grid">
              <article><span>Average Resolution Time</span><strong>{formatMinutes(summary.averageResolutionMinutes)}</strong><small>Elapsed time from ticket creation to resolution</small></article>
              <article><span>Average Actual Work Time</span><strong>{formatMinutes(summary.averageWorkMinutes)}</strong><small>Average completed work-session duration</small></article>
              <article><span>Total Actual Work</span><strong>{formatMinutes(summary.totalWorkMinutes)}</strong><small>Recorded support work during this period</small></article>
              <article><span>Resolution Rate</span><strong>{Number(summary.resolutionRate || 0).toFixed(1)}%</strong><small>Share of tickets resolved or closed</small></article>
            </div>
          </section>

          <section className="report-panel report-agent-table-panel">
            <div className="report-panel-heading report-agent-heading">
              <div>
                <span>Team operations</span>
                <h2>IT Agent Performance</h2>
                <p>Period metrics are date-filtered. Current Active is the agent's live workload right now.</p>
              </div>
              <span className="report-live-chip">Live workload</span>
            </div>

            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Assigned</th>
                    <th>Resolved</th>
                    <th>Current Active</th>
                    <th>Resolution Rate</th>
                    <th>Total Work</th>
                    <th>Avg. Work</th>
                    <th>Activity</th>
                    <th>Reassignments</th>
                  </tr>
                </thead>
                <tbody>
                  {agentRows.length ? agentRows.map((agent) => {
                    const workloadPercent = Math.min(100, (Number(agent.activeTickets || 0) / maxWorkload) * 100);
                    return (
                      <tr key={agent.agentId}>
                        <td>
                          <div className="report-agent-cell">
                            <span>{String(agent.name || "A").charAt(0)}</span>
                            <div><strong>{agent.name}</strong><small>{agent.email}</small></div>
                          </div>
                        </td>
                        <td>{agent.assignedTickets || 0}</td>
                        <td>{agent.resolvedTickets || 0}</td>
                        <td>
                          <div className="report-inline-workload">
                            <strong>{agent.activeTickets || 0}</strong>
                            <span><i style={{ width: `${workloadPercent}%` }} /></span>
                          </div>
                        </td>
                        <td>{agent.resolutionRate}%</td>
                        <td>{formatMinutes(agent.totalWorkMinutes)}</td>
                        <td>{formatMinutes(agent.averageWorkMinutes)}</td>
                        <td>{agent.totalActivity}</td>
                        <td>{agent.reassignments || 0}</td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan="9" className="report-table-empty">No support agents are available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="report-panel report-recent-panel">
            <div className="report-panel-heading">
              <div><span>Latest requests</span><h2>Recent Tickets</h2><p>The 10 most recent tickets created in the selected period.</p></div>
            </div>
            <div className="report-table-wrap">
              <table className="report-table report-ticket-table">
                <thead><tr><th>Ticket</th><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Created</th><th>Assigned Agent</th></tr></thead>
                <tbody>
                  {recentTickets.length ? recentTickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td><button type="button" className="report-ticket-link" onClick={() => navigate(`/tickets/${ticket.id}`)}>{ticket.ticketNumber}</button></td>
                      <td><strong>{ticket.subject}</strong></td>
                      <td>{ticket.category}</td>
                      <td><span className={`report-badge priority-${normalize(ticket.priority)}`}>{ticket.priority}</span></td>
                      <td><span className={`report-badge status-${normalize(ticket.status)}`}>{ticket.status}</span></td>
                      <td>{formatDate(ticket.createdAt)}</td>
                      <td>{ticket.assignedTo || "Unassigned"}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="7" className="report-table-empty">No recent tickets for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="report-document-footer">
            <span>SupportHub · IT Help Desk Performance Report</span>
            <span>{formatDate(report?.from)} — {formatDate(report?.to)}</span>
          </footer>
        </div>
      </main>
    </DashboardLayout>
  );
}

export default Reports;
