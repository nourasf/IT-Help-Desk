import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import {
  createTicket,
  getTicketFormOptions,
} from "../../api/ticket";
import { uploadTicketAttachments } from "../../api/attachments";
import "../../styles/Tickets.css";

const MAX_FILES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "txt"];
const ALLOWED_EXTENSIONS = [...IMAGE_EXTENSIONS, ...DOCUMENT_EXTENSIONS];

function getExtension(fileName) {
  return String(fileName || "").split(".").pop().toLowerCase();
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TicketDropdown({ ariaLabel, value, options, placeholder, loadingText, isLoading, disabled, variant, onChange }) {
  const dropdownRef = useRef(null);
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!dropdownRef.current?.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", handleOutsideClick);
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (disabled) setIsOpen(false);
  }, [disabled]);

  function openDropdown() {
    if (disabled || options.length === 0) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  }

  function selectOption(option) {
    onChange(option.value);
    setIsOpen(false);
  }

  function handleKeyDown(event) {
    if (disabled || options.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) { openDropdown(); return; }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + direction + options.length) % options.length);
      return;
    }
    if (event.key === "Home" && isOpen) { event.preventDefault(); setActiveIndex(0); return; }
    if (event.key === "End" && isOpen) { event.preventDefault(); setActiveIndex(options.length - 1); return; }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (isOpen) selectOption(options[activeIndex]); else openDropdown();
      return;
    }
    if (event.key === "Escape") setIsOpen(false);
  }

  const displayText = isLoading ? loadingText : selectedOption?.label || placeholder;

  return (
    <div className={`ticket-dropdown ${isOpen ? "open" : ""}`} ref={dropdownRef} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false); }}>
      <button type="button" className={`ticket-dropdown-trigger ${selectedOption ? "has-value" : ""}`} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={isOpen} aria-controls={listboxId} aria-activedescendant={isOpen ? `${listboxId}-option-${activeIndex}` : undefined} disabled={disabled} onClick={() => isOpen ? setIsOpen(false) : openDropdown()} onKeyDown={handleKeyDown}>
        <span className="ticket-dropdown-trigger-content">
          {selectedOption && <span className={`ticket-dropdown-marker ${variant}`} style={selectedOption.color ? { backgroundColor: selectedOption.color } : undefined} />}
          <span>{displayText}</span>
        </span>
        <span className="ticket-dropdown-chevron" aria-hidden="true" />
      </button>
      {isOpen && (
        <div id={listboxId} className="ticket-dropdown-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <button id={`${listboxId}-option-${index}`} key={option.id ?? option.value} type="button" className={`ticket-dropdown-option ${isSelected ? "selected" : ""} ${isActive ? "active" : ""}`} role="option" aria-selected={isSelected} onMouseEnter={() => setActiveIndex(index)} onClick={() => selectOption(option)}>
                <span className={`ticket-dropdown-marker ${variant}`} style={option.color ? { backgroundColor: option.color } : undefined} />
                <span className="ticket-dropdown-option-label">{option.label}</span>
                <span className="ticket-dropdown-check" aria-hidden="true">✓</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateTicket() {
  const navigate = useNavigate();
  const attachmentInputRef = useRef(null);
  const [form, setForm] = useState({ subject: "", category: "", priority: "", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [ticketOptions, setTicketOptions] = useState({ categories: [], priorities: [] });
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [optionsReloadKey, setOptionsReloadKey] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);
    async function loadTicketOptions() {
      setIsLoadingOptions(true);
      setOptionsError("");
      try {
        const data = await getTicketFormOptions(controller.signal);
        if (isMounted) setTicketOptions(data);
      } catch (requestError) {
        if (!isMounted) return;
        setTicketOptions({ categories: [], priorities: [] });
        setOptionsError(requestError.name === "AbortError" ? "Loading categories took too long. Make sure the backend is running." : requestError.message || "The ticket options could not be loaded.");
      } finally {
        window.clearTimeout(timeoutId);
        if (isMounted) setIsLoadingOptions(false);
      }
    }
    loadTicketOptions();
    return () => { isMounted = false; window.clearTimeout(timeoutId); controller.abort(); };
  }, [optionsReloadKey]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setSuccessMessage(""); setErrorMessage("");
  };
  const handleDropdownChange = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setSuccessMessage(""); setErrorMessage("");
  };

  function addFiles(fileList) {
    const incomingFiles = Array.from(fileList || []);
    if (incomingFiles.length === 0) return;
    setAttachmentError("");
    const combined = [...selectedFiles];
    for (const file of incomingFiles) {
      const extension = getExtension(file.name);
      if (!ALLOWED_EXTENSIONS.includes(extension)) { setAttachmentError(`${file.name} is not allowed. Use JPG, JPEG, PNG, WEBP, PDF, DOC, DOCX, XLS, XLSX or TXT.`); continue; }
      const isImage = IMAGE_EXTENSIONS.includes(extension);
      const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
      if (file.size > maxBytes) { setAttachmentError(`${file.name} is too large. ${isImage ? "Images" : "Documents"} can be up to ${isImage ? "5" : "10"} MB.`); continue; }
      const duplicate = combined.some((existingFile) => existingFile.name === file.name && existingFile.size === file.size && existingFile.lastModified === file.lastModified);
      if (!duplicate) combined.push(file);
    }
    if (combined.length > MAX_FILES) { setAttachmentError(`You can attach at most ${MAX_FILES} files.`); return; }
    const totalBytes = combined.reduce((total, file) => total + file.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) { setAttachmentError("All attachments together cannot exceed 20 MB."); return; }
    setSelectedFiles(combined);
  }

  function handleAttachmentChange(event) { addFiles(event.target.files); event.target.value = ""; }
  function removeAttachment(indexToRemove) { setSelectedFiles((current) => current.filter((_, index) => index !== indexToRemove)); setAttachmentError(""); }
  function handleDrop(event) { event.preventDefault(); setIsDraggingFiles(false); addFiles(event.dataTransfer.files); }

  const handleSubmit = async (event) => {
    event.preventDefault(); setSuccessMessage(""); setErrorMessage("");
    if (!form.category || !form.priority) { setErrorMessage("Please select both a category and a priority."); return; }
    if (attachmentError) { setErrorMessage("Please fix the attachment problem before sending the ticket."); return; }
    setIsSubmitting(true);
    try {
      const result = await createTicket(form);
      let uploadWarning = "";
      if (selectedFiles.length > 0) {
        try { await uploadTicketAttachments(result.ticketId, selectedFiles); }
        catch (uploadError) { console.error("Attachment upload error:", uploadError); uploadWarning = ` The ticket was created, but the attachments could not be uploaded: ${uploadError.message}`; }
      }
      setSuccessMessage(`Ticket ${result.ticketNumber} created successfully.${uploadWarning}`);
      setForm({ subject: "", category: "", priority: "", description: "" });
      if (!uploadWarning) { setSelectedFiles([]); setAttachmentError(""); }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      console.error("Create ticket error:", requestError);
      setErrorMessage(requestError.message || "The ticket could not be created.");
    } finally { setIsSubmitting(false); }
  };

  const handleApplySuggestion = () => setForm((current) => ({ ...current, category: "hardware", priority: "medium" }));

  return (
    <DashboardLayout activePage="create-ticket">
      <main className="create-ticket-page">
        <section className="create-ticket-header"><div><span className="create-ticket-label">Support request</span><h1>Create new support ticket</h1><p>Describe your issue and we&apos;ll assign it to the right IT agent.</p></div><button type="button" className="back-dashboard-button" onClick={() => navigate("/employee-dashboard")}>← Back to dashboard</button></section>
        {successMessage && <div className="ticket-submit-message success" role="status" aria-live="polite"><div><strong>Ticket created</strong><span>{successMessage}</span></div><button type="button" onClick={() => navigate("/my-tickets")}>View My Tickets</button></div>}
        {errorMessage && <div className="ticket-submit-message error" role="alert"><div><strong>Ticket not created</strong><span>{errorMessage}</span></div></div>}
        {optionsError && <div className="ticket-submit-message error" role="alert"><div><strong>Options unavailable</strong><span>{optionsError}</span></div><button type="button" onClick={() => setOptionsReloadKey((current) => current + 1)}>Try Again</button></div>}
        <form className="create-ticket-card" onSubmit={handleSubmit}>
          <section className="ticket-form-section">
            <div className="ticket-section-heading"><div className="ticket-section-icon">▤</div><div><h2>Ticket details</h2><p>Give us enough information to understand the issue.</p></div></div>
            <div className="ticket-fields">
              <label className="ticket-field full-width-field"><span>Subject</span><input type="text" name="subject" placeholder="Briefly describe the problem" value={form.subject} onChange={handleChange} required /></label>
              <div className="ticket-field"><span>Category</span><TicketDropdown ariaLabel="Category" value={form.category} options={ticketOptions.categories.map((category) => ({ id: category.id, value: category.name.toLowerCase(), label: category.name }))} placeholder={ticketOptions.categories.length > 0 ? "Select category" : "No categories available"} loadingText="Loading categories..." isLoading={isLoadingOptions} disabled={isLoadingOptions || Boolean(optionsError) || ticketOptions.categories.length === 0} variant="category" onChange={(value) => handleDropdownChange("category", value)} /></div>
              <div className="ticket-field"><span>Priority</span><TicketDropdown ariaLabel="Priority" value={form.priority} options={ticketOptions.priorities.map((priority) => ({ id: priority.id, value: priority.name.toLowerCase(), label: priority.name, color: priority.color }))} placeholder={ticketOptions.priorities.length > 0 ? "Select priority" : "No priorities available"} loadingText="Loading priorities..." isLoading={isLoadingOptions} disabled={isLoadingOptions || Boolean(optionsError) || ticketOptions.priorities.length === 0} variant="priority" onChange={(value) => handleDropdownChange("priority", value)} /></div>
              <label className="ticket-field full-width-field"><span>Description</span><textarea name="description" placeholder="Explain what happened, when it started and what you already tried..." value={form.description} onChange={handleChange} required /><small>Include any error messages or steps that caused the issue.</small></label>
              <div className="ticket-field full-width-field attachment-field">
                <div className="attachment-label-row"><span>Attachments</span><small>{selectedFiles.length}/{MAX_FILES} files</small></div>
                <input ref={attachmentInputRef} id="ticket-attachment" className="attachment-input" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={handleAttachmentChange} />
                <div className={`attachment-drop-zone ${isDraggingFiles ? "dragging" : ""} ${selectedFiles.length > 0 ? "has-files" : ""}`} role="button" tabIndex={0} onClick={() => attachmentInputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); attachmentInputRef.current?.click(); } }} onDragEnter={(event) => { event.preventDefault(); setIsDraggingFiles(true); }} onDragOver={(event) => { event.preventDefault(); setIsDraggingFiles(true); }} onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget)) setIsDraggingFiles(false); }} onDrop={handleDrop}>
                  <div className="attachment-icon">↥</div><div><strong>{isDraggingFiles ? "Drop your files here" : selectedFiles.length > 0 ? "Add more attachments" : "Drag files here or click to browse"}</strong><p>Images up to 5 MB · Documents up to 10 MB · 20 MB total</p></div>
                </div>
                {attachmentError && <div className="attachment-error" role="alert">{attachmentError}</div>}
                {selectedFiles.length > 0 && <div className="selected-attachments" aria-live="polite">{selectedFiles.map((file, index) => { const extension = getExtension(file.name); const isImage = IMAGE_EXTENSIONS.includes(extension); return <div className="selected-attachment-card" key={`${file.name}-${file.size}-${file.lastModified}`}><div className={`selected-attachment-icon ${isImage ? "image" : "document"}`}>{isImage ? "▧" : "▤"}</div><div className="selected-attachment-info"><strong title={file.name}>{file.name}</strong><span>{extension.toUpperCase()} · {formatFileSize(file.size)}</span></div><span className="selected-attachment-ready">Ready</span><button type="button" className="remove-attachment-button" aria-label={`Remove ${file.name}`} title="Remove attachment" onClick={() => removeAttachment(index)}>×</button></div>; })}<div className="attachment-summary"><span>Selected files</span><strong>{formatFileSize(selectedFiles.reduce((total, file) => total + file.size, 0))} / 20 MB</strong></div></div>}
              </div>
            </div>
          </section>
          <aside className="ticket-ai-panel"><div className="ai-panel-header"><div className="ai-panel-icon">✦</div><div><h2>AI Assistant</h2><p>Helping you create a clearer support request.</p></div></div><div className="ai-status-message"><span></span>AI analyzes your ticket as you type</div><div className="ai-suggestion-block"><span className="ai-suggestion-label">Suggested category</span><div className="ai-suggestion-value"><span className="suggestion-icon">▣</span><div><strong>Hardware</strong><small>Based on your description</small></div></div></div><div className="ai-suggestion-block"><span className="ai-suggestion-label">Suggested priority</span><div className="ai-suggestion-value"><span className="priority-dot"></span><div><strong>Medium</strong><small>Normal business impact</small></div></div></div><div className="ai-suggestion-block"><span className="ai-suggestion-label">Recommended action</span><div className="recommended-action-box">Add the device name, any error message and when the problem first started.</div></div><button type="button" className="apply-suggestion-button" onClick={handleApplySuggestion}>✦ Apply Suggestion</button><p className="ai-disclaimer">You can review and change all suggested values before sending.</p></aside>
          <footer className="create-ticket-footer"><p>Make sure the details are correct before submitting your ticket.</p><div className="create-ticket-actions"><button type="button" className="cancel-ticket-button" onClick={() => navigate("/employee-dashboard")}>Cancel</button><button type="submit" className="send-ticket-button" disabled={isSubmitting || isLoadingOptions || Boolean(optionsError)}>{isSubmitting ? selectedFiles.length > 0 ? "Creating & uploading..." : "Sending..." : "Send Ticket"}</button></div></footer>
        </form>
      </main>
    </DashboardLayout>
  );
}

export default CreateTicket;
