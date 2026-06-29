"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bot, 
  LogOut, 
  LayoutDashboard, 
  FileUp, 
  MessageSquare, 
  Workflow, 
  User, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Trash2, 
  FileText, 
  File, 
  TrendingUp, 
  Activity, 
  Mail, 
  Presentation,
  CheckCircle2, 
  X,
  Upload,
  Eye,
  Loader2,
  Send,
  Plus,
  Paperclip,
  Check,
  ShieldAlert
} from "lucide-react";
import { supabase } from "@/services/supabase";
import { ToastContainer, ToastItem, ToastType } from "@/components/Toast";
import { CardSkeleton, TableRowSkeleton, ChartSkeleton } from "@/components/Skeleton";

// Interfaces
interface DocumentData {
  id: string;
  name: string;
  file_type: string;
  file_size: number;
  status: "completed" | "processing" | "failed";
  created_at: string;
}

interface ChatSessionData {
  id: string;
  title: string;
  created_at: string;
}

interface ChatMessageData {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: Array<{
    document_id: string;
    document_name: string;
    similarity_score: number;
  }>;
  created_at: string;
}

interface WorkflowMock {
  id: string;
  name: string;
  status: "success" | "running" | "failed";
  time: string;
}

export default function Dashboard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  
  // States
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");

  // Ingested File States
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [fetchingDocs, setFetchingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [fetchingDocDetails, setFetchingDocDetails] = useState(false);

  // Chat States
  const [sessions, setSessions] = useState<ChatSessionData[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [showDocSelector, setShowDocSelector] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState("");
  const [streamingCitations, setStreamingCitations] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);

  // Business Generator states
  const [generatorType, setGeneratorType] = useState<"email" | "summary" | "report" | "presentation">("email");
  const [generating, setGenerating] = useState(false);
  const [generatedOutput, setGeneratedOutput] = useState("");
  // Email states
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailTone, setEmailTone] = useState("professional");
  const [emailKeyPoints, setEmailKeyPoints] = useState("");
  const [emailContext, setEmailContext] = useState("");
  // Summary states
  const [summaryDocId, setSummaryDocId] = useState("");
  const [summaryLength, setSummaryLength] = useState("medium");
  // Report states
  const [reportTopic, setReportTopic] = useState("");
  const [reportOutline, setReportOutline] = useState("");
  const [reportLength, setReportLength] = useState("medium");

  // PowerPoint states
  const [presentationTopic, setPresentationTopic] = useState("");
  const [presentationOutline, setPresentationOutline] = useState("");
  const [isCompilingPptx, setIsCompilingPptx] = useState(false);

  // Audio Transcription states
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptOutput, setTranscriptOutput] = useState("");
  const [transcribedDocName, setTranscribedDocName] = useState("");

  // Workflow states
  const [workflowsList, setWorkflowsList] = useState<any[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any | null>(null);
  const [fetchingWorkflows, setFetchingWorkflows] = useState(false);
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const [runningWorkflow, setRunningWorkflow] = useState(false);
  const [runResult, setRunResult] = useState<any | null>(null);
  
  // Creation state form
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newWorkflowDesc, setNewWorkflowDesc] = useState("");
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);

  // Admin stats states
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [adminMetrics, setAdminMetrics] = useState<any | null>(null);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [fetchingAdminData, setFetchingAdminData] = useState(false);

  // Mock datasets
  const [workflows, setWorkflows] = useState<WorkflowMock[]>([
    { id: "1", name: "Report Compiler Pipeline", status: "success", time: "10 mins ago" },
    { id: "2", name: "OCR & Document Archiving", status: "running", time: "Active" },
    { id: "3", name: "Email Auto-Responder Sync", status: "failed", time: "2 hours ago" },
  ]);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Toast controls
  const addToast = (title: string, message: string, type: ToastType) => {
    const newToast: ToastItem = {
      id: Math.random().toString(36).substring(2, 9),
      title,
      message,
      type,
    };
    setToasts((prev) => [newToast, ...prev]);
    setTimeout(() => removeToast(newToast.id), 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Scroll to bottom helper
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingResponse]);

  // Load documents
  const fetchDocuments = async () => {
    setFetchingDocs(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/api/documents/`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${session.access_token}` }
      });
      if (response.ok) {
        setDocuments(await response.json());
      }
    } catch (err) {
      addToast("Network Error", "Could not fetch documents.", "error");
    } finally {
      setFetchingDocs(false);
    }
  };

  // Load chat sessions
  const fetchSessions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/api/chat/sessions`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${session.access_token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
        if (data.length > 0 && !activeSessionId) {
          setActiveSessionId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
    }
  };

  // Load session messages
  const fetchSessionMessages = async (sid: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/api/chat/sessions/${sid}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${session.access_token}` }
      });
      if (response.ok) {
        setMessages(await response.json());
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  useEffect(() => {
    if (activeSessionId) {
      fetchSessionMessages(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  // Create chat session
  const handleCreateSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/api/chat/sessions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: json_stringify({ title: "New Conversation" })
      });

      if (response.ok) {
        const newSess = await response.json();
        setSessions((prev) => [newSess, ...prev]);
        setActiveSessionId(newSess.id);
        addToast("Chat Session Created", "Start prompting Studio AI.", "success");
      }
    } catch (err) {
      addToast("Error", "Could not initialize session.", "error");
    }
  };

  // Upload file helper
  const uploadFile = async (file: File) => {
    setUploading(true);
    addToast("Ingesting Document", `Uploading ${file.name}...`, "info");
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/api/documents/upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.access_token}` },
        body: formData
      });

      if (response.ok) {
        addToast("Upload Successful", `${file.name} sent for processing.`, "success");
        fetchDocuments();
      } else {
        addToast("Upload Failed", "Server rejected file format or limit.", "error");
      }
    } catch (err) {
      addToast("Connection Error", "Failed to connect to upload server.", "error");
    } finally {
      setUploading(false);
    }
  };

  // Delete document
  const handleDeleteDoc = async (id: string, name: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/api/documents/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${session.access_token}` }
      });

      if (response.ok) {
        addToast("Document Deleted", `Purged ${name}`, "warning");
        fetchDocuments();
        if (selectedDoc?.id === id) setSelectedDoc(null);
      }
    } catch (err) {
      addToast("Error", "Could not process deletion.", "error");
    }
  };

  // View document content
  const handleViewDoc = async (doc: DocumentData) => {
    setFetchingDocDetails(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/api/documents/${doc.id}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${session.access_token}` }
      });
      if (response.ok) {
        setSelectedDoc(await response.json());
      }
    } catch (err) {
      addToast("Error", "Could not load document text.", "error");
    } finally {
      setFetchingDocDetails(false);
    }
  };

  // Send message with Event-Stream (SSE) reader
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSending) return;

    let sid = activeSessionId;
    
    // Auto-create session if none active
    if (!sid) {
      addToast("Auto Session", "Initializing conversation thread...", "info");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const resp = await fetch(`${API_URL}/api/chat/sessions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json"
          },
          body: json_stringify({ title: "New Conversation" })
        });
        if (resp.ok) {
          const newSess = await resp.json();
          setSessions((prev) => [newSess, ...prev]);
          sid = newSess.id;
          setActiveSessionId(newSess.id);
        }
      } catch (err) {
        addToast("Session Failed", "Could not initialize conversation.", "error");
        return;
      }
    }

    if (!sid) return;

    const userQuery = inputMessage;
    setInputMessage("");
    setIsSending(true);
    setStreamingResponse("");
    setStreamingCitations([]);

    // Push temporary user message to UI
    const tempUserMsg: ChatMessageData = {
      id: Math.random().toString(),
      role: "user",
      content: userQuery,
      citations: [],
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/api/chat/send`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: json_stringify({
          session_id: sid,
          query: userQuery,
          document_ids: selectedDocIds.length > 0 ? selectedDocIds : null
        })
      });

      if (!response.ok) {
        addToast("Error", "Server failed to initiate token stream.", "error");
        setIsSending(false);
        return;
      }

      // Read chunked stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        // Keep the last partial segment in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            
            if (dataStr === "[DONE]") {
              break;
            }

            try {
              const payload = JSON.parse(dataStr);
              if (payload.text) {
                setStreamingResponse((prev) => prev + payload.text);
              }
              if (payload.citations) {
                setStreamingCitations(payload.citations);
              }
            } catch (err) {
              console.error("Failed to parse SSE payload:", err, dataStr);
            }
          }
        }
      }

      // Sync updated history log
      fetchSessionMessages(sid);
      fetchSessions(); // Reload session titles if auto-updated
    } catch (err) {
      addToast("Network Error", "Lost connection to chatbot server.", "error");
    } finally {
      setIsSending(false);
      setStreamingResponse("");
      setStreamingCitations([]);
      setSelectedDocIds([]);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setGeneratedOutput("");
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      let endpoint = "";
      let payload = {};
      
      if (generatorType === "email") {
        endpoint = "/api/generate/email";
        payload = {
          recipient: emailRecipient,
          tone: emailTone,
          key_points: emailKeyPoints,
          context: emailContext
        };
      } else if (generatorType === "summary") {
        endpoint = "/api/generate/summary";
        payload = {
          document_id: summaryDocId,
          target_length: summaryLength
        };
      } else if (generatorType === "report") {
        endpoint = "/api/generate/report";
        payload = {
          topic: reportTopic,
          outline: reportOutline,
          length: reportLength
        };
      }
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const data = await response.json();
        setGeneratedOutput(data.content);
        addToast("Content Generated", "Studio AI compiled your output successfully.", "success");
      } else {
        const errData = await response.json();
        addToast("Generation Failed", errData.detail || "Server failed to compile content.", "error");
      }
    } catch (err) {
      addToast("Connection Error", "Could not connect to generator server.", "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleExportToDoc = async () => {
    if (!generatedOutput) return;
    addToast("Exporting", "Creating document entry...", "info");
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const blob = new Blob([generatedOutput], { type: "text/plain" });
      const file = new (window as any).File([blob], `${generatorType}_generation_${Date.now()}.txt`, { type: "text/plain" });
      
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch(`${API_URL}/api/documents/upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.access_token}` },
        body: formData
      });
      
      if (response.ok) {
        addToast("Export Successful", "Document added to your files library.", "success");
        fetchDocuments();
      } else {
        addToast("Export Failed", "Could not upload document.", "error");
      }
    } catch (err) {
      addToast("Error", "Network connection error.", "error");
    }
  };

  const handleCompilePptx = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCompilingPptx(true);
    addToast("Compiling Presentation", "Assembling slides in dark-mode theme...", "info");
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const response = await fetch(`${API_URL}/api/media/presentation`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          topic: presentationTopic,
          outline: presentationOutline
        })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${presentationTopic.replace(/\s+/g, "_")}_presentation.pptx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        addToast("Download Complete", "PowerPoint slides saved to your system.", "success");
      } else {
        addToast("Compilation Failed", "Could not assemble presentation.", "error");
      }
    } catch (err) {
      addToast("Error", "Network connection error.", "error");
    } finally {
      setIsCompilingPptx(false);
    }
  };

  const handleTranscribeAudio = async (file: File) => {
    setTranscribing(true);
    setTranscriptOutput("");
    addToast("Transcribing Meeting", "Running audio speech-to-text models...", "info");
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch(`${API_URL}/api/media/transcribe`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.access_token}` },
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        setTranscriptOutput(data.transcript);
        setTranscribedDocName(data.name);
        addToast("Transcription Completed", "Text notes saved to your files workspace.", "success");
        fetchDocuments();
      } else {
        const errData = await response.json();
        addToast("Transcription Failed", errData.detail || "Server failed to parse audio.", "error");
      }
    } catch (err) {
      addToast("Error", "Network connection failed.", "error");
    } finally {
      setTranscribing(false);
    }
  };

  const fetchWorkflows = async () => {
    setFetchingWorkflows(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const response = await fetch(`${API_URL}/api/workflows`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${session.access_token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWorkflowsList(data);
        if (data.length > 0 && !activeWorkflowId) {
          setActiveWorkflowId(data[0].id);
          setSelectedWorkflow(data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load workflows:", err);
    } finally {
      setFetchingWorkflows(false);
    }
  };

  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingWorkflow(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const response = await fetch(`${API_URL}/api/workflows`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: newWorkflowName,
          description: newWorkflowDesc,
          steps: [{ id: "step_0", type: "trigger", action: "manual" }]
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setWorkflowsList((prev) => [data, ...prev]);
        setActiveWorkflowId(data.id);
        setSelectedWorkflow(data);
        setNewWorkflowName("");
        setNewWorkflowDesc("");
        addToast("Workflow Created", "Draft your execution steps now.", "success");
      }
    } catch (err) {
      addToast("Error", "Could not write workflow.", "error");
    } finally {
      setIsCreatingWorkflow(false);
    }
  };

  const handleSaveWorkflowSteps = async () => {
    if (!selectedWorkflow) return;
    setSavingWorkflow(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const response = await fetch(`${API_URL}/api/workflows/${selectedWorkflow.id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: selectedWorkflow.name,
          description: selectedWorkflow.description,
          steps: selectedWorkflow.steps
        })
      });
      
      if (response.ok) {
        addToast("Steps Saved", "Workflow configuration updated.", "success");
        fetchWorkflows();
      } else {
        addToast("Error", "Could not update steps.", "error");
      }
    } catch (err) {
      addToast("Error", "Save database write failed.", "error");
    } finally {
      setSavingWorkflow(false);
    }
  };

  const handleRunWorkflow = async () => {
    if (!selectedWorkflow) return;
    setRunningWorkflow(true);
    setRunResult(null);
    addToast("Executing Pipeline", "Triggering automation steps loop...", "info");
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const response = await fetch(`${API_URL}/api/workflows/${selectedWorkflow.id}/run`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ input_data: {} })
      });
      
      if (response.ok) {
        const data = await response.json();
        setRunResult(data);
        if (data.status === "completed") {
          addToast("Run Successful", "All steps executed cleanly.", "success");
        } else {
          addToast("Run Failed", data.error_message || "Execution sequence failed.", "error");
        }
      }
    } catch (err) {
      addToast("Error", "Execution sync failed.", "error");
    } finally {
      setRunningWorkflow(false);
    }
  };

  const addStepNode = (type: "summarize" | "email") => {
    if (!selectedWorkflow) return;
    const newStep = type === "summarize" 
      ? { id: `summarize_${Date.now()}`, type: "summarize", target_length: "medium", document_id: "" }
      : { id: `email_${Date.now()}`, type: "email", recipient: "", tone: "professional", key_points: "" };
      
    const updated = {
      ...selectedWorkflow,
      steps: [...selectedWorkflow.steps, newStep]
    };
    setSelectedWorkflow(updated);
  };

  const removeStepNode = (id: string) => {
    if (!selectedWorkflow) return;
    const updated = {
      ...selectedWorkflow,
      steps: selectedWorkflow.steps.filter((s: any) => s.id !== id)
    };
    setSelectedWorkflow(updated);
  };

  const updateStepParam = (id: string, param: string, value: any) => {
    if (!selectedWorkflow) return;
    const updated = {
      ...selectedWorkflow,
      steps: selectedWorkflow.steps.map((s: any) => 
        s.id === id ? { ...s, [param]: value } : s
      )
    };
    setSelectedWorkflow(updated);
  };

  const fetchAdminData = async () => {
    setFetchingAdminData(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const metricsRes = await fetch(`${API_URL}/api/admin/metrics`, {
        headers: { "Authorization": `Bearer ${session.access_token}` }
      });
      const usersRes = await fetch(`${API_URL}/api/admin/users`, {
        headers: { "Authorization": `Bearer ${session.access_token}` }
      });
      
      if (metricsRes.ok && usersRes.ok) {
        const metricsData = await metricsRes.json();
        const usersData = await usersRes.json();
        setAdminMetrics(metricsData);
        setAdminUsers(usersData);
      }
    } catch (err) {
      console.error("Failed to load admin stats:", err);
    } finally {
      setFetchingAdminData(false);
    }
  };

  useEffect(() => {
    if (activeTab === "admin" && userProfile?.role === "admin") {
      fetchAdminData();
    }
  }, [activeTab]);

  // Auth synchronization check
  useEffect(() => {
    const initWorkspace = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        setUser(session.user);
        await fetchDocuments();
        await fetchSessions();
        await fetchWorkflows();
        
        try {
          const profileResponse = await fetch(`${API_URL}/api/auth/profile`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${session.access_token}` }
          });
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            setUserProfile(profileData);
          }
        } catch (err) {
          console.error("Failed to load profile:", err);
        }
      }
      
      const timer = setTimeout(() => {
        setLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    };

    initWorkspace();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
      } else {
        setUser(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const toggleDocumentScope = (docId: string) => {
    setSelectedDocIds((prev) => 
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  // String helpers helper
  const json_stringify = (obj: any) => JSON.stringify(obj);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // SVG Line Chart coordinates
  const chartPoints = [
    { x: 30, y: 150 },
    { x: 130, y: 110 },
    { x: 230, y: 135 },
    { x: 330, y: 50 },
    { x: 430, y: 100 },
    { x: 530, y: 75 },
    { x: 630, y: 35 }
  ];
  const linePath = `M ${chartPoints.map(p => `${p.x} ${p.y}`).join(" L ")}`;
  const areaPath = `${linePath} L 630 180 L 30 180 Z`;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030014] text-white flex p-8 gap-8 overflow-hidden">
        <div className="w-64 glass-panel border border-white/5 rounded-3xl p-6 hidden md:flex flex-col gap-6">
          <div className="h-8 bg-white/5 rounded-xl animate-pulse w-2/3" />
        </div>
        <div className="flex-grow space-y-8">
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#030014] text-slate-200 overflow-hidden relative">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.docx,.pptx,.txt,.csv,.png,.jpg,.jpeg"
      />

      {/* Sidebar navigation */}
      <motion.aside 
        animate={{ width: sidebarCollapsed ? 80 : 260 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="glass-panel border-r border-white/5 flex flex-col justify-between p-5 relative z-20 flex-shrink-0"
      >
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-8 w-6 h-6 rounded-full bg-primary-600 border border-white/10 flex items-center justify-center text-white hover:bg-primary-500 transition-colors z-30 focus:outline-none"
        >
          {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        <div className="space-y-8">
          <div className="flex items-center gap-3.5 px-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-600 to-accent-neon flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/20">
              <Bot className="w-5.5 h-5.5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <span className="font-bold text-sm tracking-tight text-white whitespace-nowrap overflow-hidden">
                Automation Studio
              </span>
            )}
          </div>

          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "dashboard" ? "bg-white/5 text-white border-l-2 border-primary-500" : "text-slate-400 hover:text-slate-200 hover:bg-white/2"
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-primary-400 flex-shrink-0" />
              {!sidebarCollapsed && <span>Dashboard</span>}
            </button>

            <button
              onClick={() => setActiveTab("documents")}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "documents" ? "bg-white/5 text-white border-l-2 border-primary-500" : "text-slate-400 hover:text-slate-200 hover:bg-white/2"
              }`}
            >
              <FileUp className="w-4 h-4 text-primary-400 flex-shrink-0" />
              {!sidebarCollapsed && <span>Documents</span>}
            </button>

            <button
              onClick={() => setActiveTab("chat")}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "chat" ? "bg-white/5 text-white border-l-2 border-primary-500" : "text-slate-400 hover:text-slate-200 hover:bg-white/2"
              }`}
            >
              <MessageSquare className="w-4 h-4 text-primary-400 flex-shrink-0" />
              {!sidebarCollapsed && <span>AI Chat</span>}
            </button>

            <button
              onClick={() => setActiveTab("generators")}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "generators" ? "bg-white/5 text-white border-l-2 border-primary-500" : "text-slate-400 hover:text-slate-200 hover:bg-white/2"
              }`}
            >
              <Activity className="w-4 h-4 text-primary-400 flex-shrink-0" />
              {!sidebarCollapsed && <span>AI Generators</span>}
            </button>

            <button
              onClick={() => setActiveTab("transcribe")}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "transcribe" ? "bg-white/5 text-white border-l-2 border-primary-500" : "text-slate-400 hover:text-slate-200 hover:bg-white/2"
              }`}
            >
              <FileText className="w-4 h-4 text-primary-400 flex-shrink-0" />
              {!sidebarCollapsed && <span>Meeting Transcribe</span>}
            </button>

            <button
              onClick={() => setActiveTab("workflows")}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "workflows" ? "bg-white/5 text-white border-l-2 border-primary-500" : "text-slate-400 hover:text-slate-200 hover:bg-white/2"
              }`}
            >
              <Workflow className="w-4 h-4 text-primary-400 flex-shrink-0" />
              {!sidebarCollapsed && <span>Workflow Builder</span>}
            </button>

            {userProfile?.role === "admin" && (
              <button
                onClick={() => setActiveTab("admin")}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === "admin" ? "bg-white/5 text-white border-l-2 border-primary-500" : "text-slate-400 hover:text-slate-200 hover:bg-white/2"
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-primary-400 flex-shrink-0" />
                {!sidebarCollapsed && <span>Admin Console</span>}
              </button>
            )}
          </nav>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 px-1 py-3 border-t border-white/5 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 border border-white/10">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-slate-400" />
              )}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-grow overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">
                  {user?.user_metadata?.full_name || user?.email?.split("@")[0]}
                </p>
                <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
              </div>
            )}
          </div>

          <button
            onClick={handleSignOut}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 text-sm font-medium transition-all ${
              sidebarCollapsed ? "justify-center" : ""
            }`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content Workspace */}
      <main className="flex-grow flex flex-col relative overflow-hidden">
        
        {/* Active view tabs routing */}
        <div className="flex-grow flex flex-col p-6 md:p-10 relative overflow-y-auto max-h-screen">
          <div className="glow-bg top-[5%] right-[5%] w-[400px] h-[400px] opacity-35" />

          {/* Core views */}
          <div className="space-y-8 z-10 flex flex-col flex-grow">
            
            {/* 1. Dashboard Tab View */}
            {activeTab === "dashboard" && (
              <>
                <div className="space-y-2">
                  <h1 className="text-3xl font-extrabold text-white tracking-tight">Workspace Dashboard</h1>
                  <p className="text-slate-400 text-sm">Monitor documents, run RAG operations, and evaluate statistics.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="p-6 rounded-2xl glass-panel border border-white/5 flex flex-col justify-between h-[150px] relative overflow-hidden group">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Indexed Documents</span>
                    <p className="text-3xl font-extrabold text-white">{documents.length}</p>
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-primary-500 to-accent-neon h-full rounded-full" style={{ width: `${Math.min(documents.length * 10, 100)}%` }} />
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl glass-panel border border-white/5 flex flex-col justify-between h-[150px] relative overflow-hidden group">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Operations</span>
                    <p className="text-3xl font-extrabold text-white">14,820</p>
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-accent-emerald h-full rounded-full" style={{ width: "29.6%" }} />
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl glass-panel border border-white/5 flex flex-col justify-between h-[150px] relative overflow-hidden group">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Workflow Runs</span>
                    <p className="text-3xl font-extrabold text-white">8 Runs</p>
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-accent-amber h-full rounded-full animate-pulse" style={{ width: "75%" }} />
                    </div>
                  </div>
                </div>

                {/* Operations Line graph SVG */}
                <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-6">
                  <div>
                    <h3 className="font-bold text-lg text-white">Model Operations Tracker</h3>
                    <p className="text-slate-400 text-xs mt-1">Weekly usage distribution representing daily API call tokens.</p>
                  </div>
                  <div className="w-full overflow-x-auto">
                    <div className="min-w-[650px] h-[200px] relative">
                      <svg className="w-full h-full" viewBox="0 0 660 200" fill="none">
                        <line x1="30" y1="50" x2="630" y2="50" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                        <line x1="30" y1="100" x2="630" y2="100" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                        <line x1="30" y1="150" x2="630" y2="150" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                        <line x1="30" y1="180" x2="630" y2="180" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
                        <path d={areaPath} fill="url(#chartGrad)" />
                        <path d={linePath} stroke="#8b5cf6" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                        {chartPoints.map((pt, i) => (
                          <circle key={i} cx={pt.x} cy={pt.y} r="5" fill="#030014" stroke="#00f0ff" strokeWidth="2.5" />
                        ))}
                      </svg>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 2. Documents Tab View */}
            {activeTab === "documents" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 p-6 rounded-3xl glass-panel border border-white/5 space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <FileUp className="w-5 h-5 text-primary-400" />
                      Ingestion Explorer
                    </h3>
                    {uploading && (
                      <div className="flex items-center gap-2 text-xs text-primary-400 animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Processing upload...
                      </div>
                    )}
                  </div>

                  {/* Dropzone */}
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={triggerFileSelect}
                    className={`w-full py-12 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${
                      dragActive ? "border-accent-neon bg-accent-neon/5" : "border-white/10 hover:border-white/20 bg-white/2"
                    }`}
                  >
                    <Upload className="w-8 h-8 text-slate-400 mb-3" />
                    <p className="text-xs font-semibold text-white">Drag and drop file here, or click to browse</p>
                    <p className="text-[10px] text-slate-500 mt-1">PDF, DOCX, PPTX, TXT, CSV, Images (Max 15 MB)</p>
                  </div>

                  {/* Document Search */}
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search documents by name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/3 border border-white/5 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>

                  {/* Table Lists */}
                  <div className="space-y-2.5">
                    {fetchingDocs ? (
                      <TableRowSkeleton />
                    ) : filteredDocuments.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 text-xs">No files matching filter.</div>
                    ) : (
                      filteredDocuments.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3.5 rounded-xl bg-white/3 border border-white/5 gap-4">
                          <div className="flex items-center gap-3 overflow-hidden">
                            {doc.file_type === "PDF" ? <FileText className="w-5.5 h-5.5 text-red-400 flex-shrink-0" /> : <File className="w-5.5 h-5.5 text-primary-300 flex-shrink-0" />}
                            <div className="overflow-hidden">
                              <h4 className="text-xs font-semibold text-white truncate">{doc.name}</h4>
                              <span className="text-[10px] text-slate-500">{formatBytes(doc.file_size)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase ${
                              doc.status === "completed" ? "bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20" : doc.status === "processing" ? "bg-primary-500/10 text-primary-400 animate-pulse border-primary-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                            }`}>{doc.status === "completed" ? "Ready" : doc.status === "processing" ? "Parsing" : "Failed"}</span>
                            
                            <button onClick={() => handleViewDoc(doc)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"><Eye className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteDoc(doc.id, doc.name)} className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/5"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Side Drawer Viewer */}
                <div className="space-y-6">
                  {selectedDoc && (
                    <div className="p-6 rounded-3xl glass-panel-glow border border-primary-500/25 space-y-4 shadow-xl relative">
                      <button onClick={() => setSelectedDoc(null)} className="absolute top-4 right-4 text-slate-500"><X className="w-4 h-4" /></button>
                      <h4 className="font-bold text-white truncate">{selectedDoc.name}</h4>
                      <div className="w-full h-[220px] rounded-xl bg-black/40 p-3.5 text-[10px] font-mono text-slate-300 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                        {selectedDoc.parsed_text || "No text parsed."}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. AI Chat Tab View (SSE Streaming panel) */}
            {activeTab === "chat" && (
              <div className="flex-grow flex gap-6 h-[calc(100vh-160px)] overflow-hidden items-stretch">
                
                {/* Chat Sessions Sidebar Panel */}
                <div className="w-64 glass-panel border border-white/5 rounded-3xl p-5 flex flex-col justify-between flex-shrink-0 hidden md:flex">
                  <div className="space-y-4 flex-grow overflow-hidden flex flex-col">
                    <button
                      onClick={handleCreateSession}
                      className="w-full py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200"
                    >
                      <Plus className="w-4 h-4" /> New Conversation
                    </button>
                    
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mt-4">History Threads</span>
                    <div className="flex-grow overflow-y-auto space-y-1.5 pr-1">
                      {sessions.map((sess) => (
                        <button
                          key={sess.id}
                          onClick={() => setActiveSessionId(sess.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl text-xs truncate transition-all ${
                            activeSessionId === sess.id 
                              ? "bg-white/5 text-white border-l-2 border-primary-500" 
                              : "text-slate-400 hover:text-slate-200 hover:bg-white/2"
                          }`}
                        >
                          {sess.title}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Main Streaming Chat Pane */}
                <div className="flex-grow glass-panel border border-white/5 rounded-3xl p-6 flex flex-col justify-between overflow-hidden relative">
                  
                  {/* Selected Attachment Header banner */}
                  <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4.5 h-4.5 text-primary-400" />
                      <span className="text-xs font-semibold text-white">Active Thread</span>
                    </div>

                    {/* Scope attachment button */}
                    <div className="relative">
                      <button
                        onClick={() => setShowDocSelector(!showDocSelector)}
                        className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 hover:text-white flex items-center gap-2"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        {selectedDocIds.length > 0 ? `${selectedDocIds.length} Attached` : "Attach Files"}
                      </button>

                      {/* Dropdown File selector popover */}
                      <AnimatePresence>
                        {showDocSelector && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute right-0 mt-2 w-72 p-4 rounded-2xl glass-panel-glow border border-white/10 shadow-2xl z-30 max-h-60 overflow-y-auto space-y-2.5"
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400">Select files context</span>
                              <button onClick={() => setShowDocSelector(false)} className="text-slate-500 hover:text-slate-300"><X className="w-3.5 h-3.5" /></button>
                            </div>
                            
                            {documents.filter(d => d.status === "completed").length === 0 ? (
                              <div className="text-[10px] text-slate-500 text-center py-4">No uploaded files ready.</div>
                            ) : (
                              documents.filter(d => d.status === "completed").map((d) => (
                                <button
                                  key={d.id}
                                  onClick={() => toggleDocumentScope(d.id)}
                                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/5 text-xs text-left"
                                >
                                  <span className="truncate max-w-[85%]">{d.name}</span>
                                  {selectedDocIds.includes(d.id) && <Check className="w-4 h-4 text-accent-neon" />}
                                </button>
                              ))
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Messages scroll box */}
                  <div className="flex-grow overflow-y-auto space-y-4 pr-1 mb-4 scrollbar-thin">
                    {messages.length === 0 && !streamingResponse && (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6">
                        <Bot className="w-12 h-12 text-primary-400 animate-pulse mb-3" />
                        <h4 className="font-bold text-white text-sm">Start a Conversation</h4>
                        <p className="text-xs text-slate-500 max-w-xs mt-1">Prompt Studio AI to synthesize reports, compile outlines, or chat directly with your attached files.</p>
                      </div>
                    )}
                    
                    {/* Render History Messages */}
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3.5 max-w-[85%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                          msg.role === "user" ? "bg-primary-600/10 border-primary-500/25" : "bg-white/5 border-white/10"
                        }`}>
                          {msg.role === "user" ? <User className="w-4 h-4 text-primary-400" /> : <Bot className="w-4 h-4 text-accent-neon" />}
                        </div>
                        
                        <div className={`p-4 rounded-2xl text-xs leading-relaxed ${
                          msg.role === "user" ? "bg-primary-600 text-white rounded-tr-none" : "glass-panel border border-white/5 text-slate-200 rounded-tl-none"
                        }`}>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          
                          {/* Citations references */}
                          {msg.citations && msg.citations.length > 0 && (
                            <div className="mt-4 pt-3.5 border-t border-white/5 space-y-1.5">
                              <span className="text-[9px] uppercase tracking-wider text-accent-neon font-semibold block">Sources Referenced</span>
                              <div className="flex flex-wrap gap-2">
                                {msg.citations.map((c, idx) => (
                                  <div key={idx} className="px-2.5 py-1 rounded-lg bg-white/3 border border-white/5 text-[9px] text-slate-400 flex items-center gap-1.5">
                                    <FileText className="w-3 h-3 text-primary-400" />
                                    <span>{c.document_name} ({Math.round(c.similarity_score * 100)}%)</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Active Streaming Token response */}
                    {streamingResponse && (
                      <div className="flex gap-3.5 max-w-[85%] mr-auto">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/5 border border-white/10">
                          <Bot className="w-4 h-4 text-accent-neon" />
                        </div>
                        
                        <div className="p-4 rounded-2xl text-xs leading-relaxed glass-panel border border-white/5 text-slate-200 rounded-tl-none">
                          <p className="whitespace-pre-wrap">{streamingResponse}</p>
                          
                          {/* Live citations preview */}
                          {streamingCitations.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-white/5 space-y-1">
                              <span className="text-[9px] uppercase tracking-wider text-accent-neon font-bold block">Retrieving Context</span>
                              <div className="flex flex-wrap gap-2">
                                {streamingCitations.map((c, idx) => (
                                  <div key={idx} className="px-2 py-0.5 rounded bg-white/5 text-[9px] text-slate-400">
                                    {c.document_name}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Inputs controls */}
                  <form onSubmit={handleSendMessage} className="relative flex gap-2 items-center">
                    <input
                      type="text"
                      disabled={isSending}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder={selectedDocIds.length > 0 ? "Ask a question about the attached documents..." : "Type your message here..."}
                      className="w-full pl-4 pr-12 py-3.5 rounded-2xl bg-white/3 border border-white/5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <button
                      type="submit"
                      disabled={isSending || !inputMessage.trim()}
                      className="absolute right-2.5 top-[10px] w-8.5 h-8.5 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:bg-white/5 disabled:text-slate-500 text-white flex items-center justify-center transition-all focus:outline-none"
                    >
                      {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5 fill-current" />}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* 4. Business Generators Tab View */}
            {activeTab === "generators" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)] overflow-hidden items-stretch">
                
                {/* Form Parameters inputs panel */}
                <div className="lg:col-span-1 glass-panel border border-white/5 rounded-3xl p-6 flex flex-col justify-between overflow-y-auto space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <Bot className="w-5 h-5 text-accent-neon" />
                      Configure Generator
                    </h3>

                    {/* Generator selector tabs */}
                    <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-white/5 border border-white/5">
                      {["email", "summary", "report", "presentation"].map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            setGeneratorType(t as any);
                            setGeneratedOutput("");
                          }}
                          className={`py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider text-center transition-all ${
                            generatorType === t ? "bg-primary-600 text-white" : "text-slate-400 hover:text-white"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>

                    <form onSubmit={generatorType === "presentation" ? handleCompilePptx : handleGenerate} className="space-y-4 pt-2">
                      {generatorType === "email" && (
                        <>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Recipient</label>
                            <input
                              type="text"
                              value={emailRecipient}
                              onChange={(e) => setEmailRecipient(e.target.value)}
                              placeholder="e.g. Sales Team, Client Name"
                              className="w-full px-3 py-2 rounded-xl bg-white/3 border border-white/5 text-xs text-white placeholder-slate-600 focus:outline-none"
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Tone</label>
                            <select
                              value={emailTone}
                              onChange={(e) => setEmailTone(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-white/3 border border-white/5 text-xs text-white focus:outline-none"
                            >
                              <option value="professional" className="bg-[#030014]">Professional</option>
                              <option value="casual" className="bg-[#030014]">Casual</option>
                              <option value="persuasive" className="bg-[#030014]">Persuasive</option>
                              <option value="formal" className="bg-[#030014]">Formal</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Key Points</label>
                            <textarea
                              rows={3}
                              value={emailKeyPoints}
                              onChange={(e) => setEmailKeyPoints(e.target.value)}
                              placeholder="List key items to discuss..."
                              className="w-full px-3 py-2 rounded-xl bg-white/3 border border-white/5 text-xs text-white placeholder-slate-600 focus:outline-none resize-none"
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Context (Optional)</label>
                            <input
                              type="text"
                              value={emailContext}
                              onChange={(e) => setEmailContext(e.target.value)}
                              placeholder="e.g. following up on contract..."
                              className="w-full px-3 py-2 rounded-xl bg-white/3 border border-white/5 text-xs text-white placeholder-slate-600 focus:outline-none"
                            />
                          </div>
                        </>
                      )}

                      {generatorType === "summary" && (
                        <>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Select Document</label>
                            <select
                              value={summaryDocId}
                              onChange={(e) => setSummaryDocId(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-white/3 border border-white/5 text-xs text-white focus:outline-none"
                              required
                            >
                              <option value="" className="bg-[#030014]">-- Choose File --</option>
                              {documents.filter(d => d.status === "completed").map((d) => (
                                <option key={d.id} value={d.id} className="bg-[#030014]">{d.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Target Length</label>
                            <select
                              value={summaryLength}
                              onChange={(e) => setSummaryLength(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-white/3 border border-white/5 text-xs text-white focus:outline-none"
                            >
                              <option value="short" className="bg-[#030014]">Short Brief</option>
                              <option value="medium" className="bg-[#030014]">Medium Highlights</option>
                              <option value="detailed" className="bg-[#030014]">Detailed Deep Dive</option>
                            </select>
                          </div>
                        </>
                      )}

                      {generatorType === "report" && (
                        <>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Topic</label>
                            <input
                              type="text"
                              value={reportTopic}
                              onChange={(e) => setReportTopic(e.target.value)}
                              placeholder="e.g. Q3 Marketing SWOT"
                              className="w-full px-3 py-2 rounded-xl bg-white/3 border border-white/5 text-xs text-white placeholder-slate-600 focus:outline-none"
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Report Sections</label>
                            <textarea
                              rows={3}
                              value={reportOutline}
                              onChange={(e) => setReportOutline(e.target.value)}
                              placeholder="e.g. 1. Market Size\n2. Key Risks"
                              className="w-full px-3 py-2 rounded-xl bg-white/3 border border-white/5 text-xs text-white placeholder-slate-600 focus:outline-none resize-none"
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Length</label>
                            <select
                              value={reportLength}
                              onChange={(e) => setReportLength(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-white/3 border border-white/5 text-xs text-white focus:outline-none"
                            >
                              <option value="short" className="bg-[#030014]">Short (1-2 pages)</option>
                              <option value="medium" className="bg-[#030014]">Medium (3-5 pages)</option>
                              <option value="detailed" className="bg-[#030014]">Detailed (5+ pages)</option>
                            </select>
                          </div>
                        </>
                      )}

                      {generatorType === "presentation" && (
                        <>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Topic</label>
                            <input
                              type="text"
                              value={presentationTopic}
                              onChange={(e) => setPresentationTopic(e.target.value)}
                              placeholder="e.g. Sales Q3 Pitch Deck"
                              className="w-full px-3 py-2 rounded-xl bg-white/3 border border-white/5 text-xs text-white placeholder-slate-600 focus:outline-none"
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Presentation Outline</label>
                            <textarea
                              rows={4}
                              value={presentationOutline}
                              onChange={(e) => setPresentationOutline(e.target.value)}
                              placeholder="e.g. 1. Intro\n2. Features roadmap\n3. Budget request"
                              className="w-full px-3 py-2 rounded-xl bg-white/3 border border-white/5 text-xs text-white placeholder-slate-600 focus:outline-none resize-none"
                              required
                            />
                          </div>
                        </>
                      )}

                      <button
                        type="submit"
                        disabled={generating || isCompilingPptx}
                        className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:bg-white/5 disabled:text-slate-500 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all mt-4"
                      >
                        {generating || isCompilingPptx ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Compiling Outline...
                          </>
                        ) : (
                          generatorType === "presentation" ? "Compile & Download PPTX" : "Compile Content"
                        )}
                      </button>
                    </form>
                  </div>
                </div>

                {/* Live generated preview cards */}
                <div className="lg:col-span-2 glass-panel border border-white/5 rounded-3xl p-6 flex flex-col justify-between overflow-hidden relative">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <span className="text-xs font-semibold text-white">Live Generation Output</span>
                    {generatedOutput && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generatedOutput);
                            addToast("Copied", "Content copied to clipboard.", "success");
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/5 text-[10px] hover:text-white"
                        >
                          Copy
                        </button>
                        <button
                          onClick={handleExportToDoc}
                          className="px-2.5 py-1 rounded-lg bg-primary-600 hover:bg-primary-500 text-[10px] text-white flex items-center gap-1.5"
                        >
                          Export to Docs
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex-grow overflow-y-auto mt-4 p-4 rounded-2xl bg-black/45 text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                    {generating ? (
                      <div className="h-full flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 text-primary-400 animate-spin mb-2" />
                        <span className="text-slate-500">Studio AI is thinking...</span>
                      </div>
                    ) : generatedOutput ? (
                      generatedOutput
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500">
                        Configure options on the left and click "Compile Content".
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 5. Meeting Transcription Tab View */}
            {activeTab === "transcribe" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)] overflow-hidden items-stretch">
                
                {/* Audio Upload dropzone panel */}
                <div className="lg:col-span-1 glass-panel border border-white/5 rounded-3xl p-6 flex flex-col justify-between overflow-y-auto space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-accent-neon" />
                      Meeting Transcriber
                    </h3>
                    <p className="text-slate-400 text-xs mt-1">Upload audio recordings to transcribe speech into workspace documents library using Whisper.</p>

                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragActive(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleTranscribeAudio(e.dataTransfer.files[0]);
                        }
                      }}
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = ".mp3,.wav,.m4a,.ogg,.flac";
                        input.onchange = (e: any) => {
                          if (e.target.files && e.target.files[0]) {
                            handleTranscribeAudio(e.target.files[0]);
                          }
                        };
                        input.click();
                      }}
                      className={`w-full py-16 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${
                        dragActive ? "border-accent-neon bg-accent-neon/5" : "border-white/10 hover:border-white/20 bg-white/2"
                      }`}
                    >
                      <Upload className="w-8 h-8 text-slate-400 mb-3" />
                      <p className="text-xs font-semibold text-white">Click or drag audio file here</p>
                      <p className="text-[10px] text-slate-500 mt-1">MP3, WAV, M4A, OGG (Max 15 MB)</p>
                    </div>

                    {transcribing && (
                      <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/3 border border-white/5 gap-2">
                        <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
                        <span className="text-[10px] text-slate-400 animate-pulse">Running Whisper AI speech transcribing models...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Transcription output preview */}
                <div className="lg:col-span-2 glass-panel border border-white/5 rounded-3xl p-6 flex flex-col justify-between overflow-hidden relative">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <span className="text-xs font-semibold text-white">Transcript Output Logs</span>
                    {transcriptOutput && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(transcriptOutput);
                            addToast("Copied", "Transcript copied to clipboard.", "success");
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/5 text-[10px] hover:text-white"
                        >
                          Copy Logs
                        </button>
                        <button
                          onClick={() => {
                            setActiveTab("documents");
                            addToast("Opened Documents", "Navigated to files library.", "info");
                          }}
                          className="px-2.5 py-1 rounded-lg bg-primary-600 hover:bg-primary-500 text-[10px] text-white flex items-center gap-1.5"
                        >
                          View in Documents
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex-grow overflow-y-auto mt-4 p-4 rounded-2xl bg-black/45 text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                    {transcribing ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500">
                        <Loader2 className="w-8 h-8 text-primary-400 animate-spin mb-2" />
                        <span>Transcribing audio sync waves...</span>
                      </div>
                    ) : transcriptOutput ? (
                      transcriptOutput
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-6">
                        <FileText className="w-10 h-10 text-slate-600 mb-2" />
                        <span>Upload a meeting recording to extract transcripts.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 6. Workflow Builder Tab View */}
            {activeTab === "workflows" && (
              <div className="flex-grow flex gap-6 h-[calc(100vh-180px)] overflow-hidden items-stretch">
                
                {/* Workflows Sidebar list */}
                <div className="w-64 glass-panel border border-white/5 rounded-3xl p-5 flex flex-col justify-between flex-shrink-0 hidden md:flex">
                  <div className="space-y-4 flex-grow overflow-hidden flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">New Workflow</span>
                    <form onSubmit={handleCreateWorkflow} className="space-y-2">
                      <input
                        type="text"
                        placeholder="Workflow Name"
                        value={newWorkflowName}
                        onChange={(e) => setNewWorkflowName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white/3 border border-white/5 text-[11px] text-white placeholder-slate-600 focus:outline-none"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Description"
                        value={newWorkflowDesc}
                        onChange={(e) => setNewWorkflowDesc(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white/3 border border-white/5 text-[11px] text-white placeholder-slate-600 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={isCreatingWorkflow}
                        className="w-full py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-[10px] font-semibold text-white flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Pipeline
                      </button>
                    </form>

                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mt-6">Automations</span>
                    <div className="flex-grow overflow-y-auto space-y-1.5 pr-1">
                      {workflowsList.map((wf) => (
                        <button
                          key={wf.id}
                          onClick={() => {
                            setActiveWorkflowId(wf.id);
                            setSelectedWorkflow(wf);
                            setRunResult(null);
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-xl text-xs truncate transition-all ${
                            activeWorkflowId === wf.id 
                              ? "bg-white/5 text-white border-l-2 border-primary-500" 
                              : "text-slate-400 hover:text-slate-200 hover:bg-white/2"
                          }`}
                        >
                          {wf.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Workflow Canvas panel */}
                <div className="flex-grow glass-panel border border-white/5 rounded-3xl p-6 flex flex-col justify-between overflow-hidden relative">
                  {selectedWorkflow ? (
                    <div className="flex-grow flex flex-col justify-between overflow-hidden">
                      
                      {/* Header with Title and Run actions */}
                      <div className="flex justify-between items-center border-b border-white/5 pb-3.5 mb-4">
                        <div>
                          <h4 className="font-bold text-white text-sm">{selectedWorkflow.name}</h4>
                          <p className="text-[10px] text-slate-500">{selectedWorkflow.description || "No description."}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSaveWorkflowSteps}
                            disabled={savingWorkflow}
                            className="px-3.5 py-1.5 rounded-xl border border-white/10 hover:bg-white/5 text-xs text-slate-300"
                          >
                            {savingWorkflow ? "Saving..." : "Save Steps"}
                          </button>
                          <button
                            onClick={handleRunWorkflow}
                            disabled={runningWorkflow || selectedWorkflow.steps.length === 0}
                            className="px-3.5 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-xs text-white flex items-center gap-1.5"
                          >
                            {runningWorkflow ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Running...
                              </>
                            ) : (
                              "Run Pipeline"
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Workflow Nodes Grid Canvas */}
                      <div className="flex-grow overflow-y-auto space-y-6 pr-1 pb-4 scrollbar-thin">
                        <div className="space-y-4">
                          {selectedWorkflow.steps.map((step: any, idx: number) => (
                            <div key={step.id || idx} className="relative flex flex-col items-center">
                              {idx > 0 && (
                                <div className="w-0.5 bg-gradient-to-b from-primary-500 to-accent-neon h-6 my-1" />
                              )}
                              
                              <div className="w-full max-w-lg p-4 rounded-2xl glass-panel border border-white/5 hover:border-primary-500/20 transition-all flex justify-between items-start gap-4 shadow-lg relative group">
                                <div className="space-y-2.5 flex-grow">
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300 flex items-center justify-center">
                                      {idx + 1}
                                    </span>
                                    <span className="text-xs font-semibold text-white uppercase tracking-wider">
                                      {step.type === "trigger" ? "Manual Trigger Node" : step.type === "summarize" ? "AI Document Summarizer" : "AI Cold Outreach Email"}
                                    </span>
                                  </div>

                                  {/* Step-specific config parameters inputs */}
                                  {step.type === "summarize" && (
                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                      <div>
                                        <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">Reference Document</label>
                                        <select
                                          value={step.document_id || ""}
                                          onChange={(e) => updateStepParam(step.id, "document_id", e.target.value)}
                                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#0c0a21] border border-white/5 text-[10px] text-white focus:outline-none"
                                        >
                                          <option value="">-- Select File --</option>
                                          {documents.filter(d => d.status === "completed").map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">Length</label>
                                        <select
                                          value={step.target_length || "medium"}
                                          onChange={(e) => updateStepParam(step.id, "target_length", e.target.value)}
                                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#0c0a21] border border-white/5 text-[10px] text-white focus:outline-none"
                                        >
                                          <option value="short">Short</option>
                                          <option value="medium">Medium</option>
                                          <option value="detailed">Detailed</option>
                                        </select>
                                      </div>
                                    </div>
                                  )}

                                  {step.type === "email" && (
                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                      <div>
                                        <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">Recipient</label>
                                        <input
                                          type="text"
                                          value={step.recipient || ""}
                                          onChange={(e) => updateStepParam(step.id, "recipient", e.target.value)}
                                          placeholder="e.g. sales@company.com"
                                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#0c0a21] border border-white/5 text-[10px] text-white focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">Tone</label>
                                        <select
                                          value={step.tone || "professional"}
                                          onChange={(e) => updateStepParam(step.id, "tone", e.target.value)}
                                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#0c0a21] border border-white/5 text-[10px] text-white focus:outline-none"
                                        >
                                          <option value="professional">Professional</option>
                                          <option value="casual">Casual</option>
                                          <option value="persuasive">Persuasive</option>
                                        </select>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {step.type !== "trigger" && (
                                  <button
                                    onClick={() => removeStepNode(step.id)}
                                    className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-white/5 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Add Step options panel */}
                        <div className="flex justify-center pt-6 border-t border-white/5 mt-6 gap-3">
                          <button
                            onClick={() => addStepNode("summarize")}
                            className="px-3.5 py-2 rounded-xl bg-white/3 border border-white/5 hover:bg-white/5 text-[10px] text-slate-300 font-semibold flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Summarizer Node
                          </button>
                          <button
                            onClick={() => addStepNode("email")}
                            className="px-3.5 py-2 rounded-xl bg-white/3 border border-white/5 hover:bg-white/5 text-[10px] text-slate-300 font-semibold flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Email Composer Node
                          </button>
                        </div>

                        {/* Run Result Execution logs block */}
                        {runResult && (
                          <div className="mt-8 p-5 rounded-2xl glass-panel-glow border border-primary-500/20 space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-accent-neon">Run Execution Report</span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                runResult.status === "completed" ? "bg-accent-emerald/10 text-accent-emerald" : "bg-red-500/10 text-red-400"
                              }`}>
                                {runResult.status}
                              </span>
                            </div>
                            
                            {runResult.error_message && (
                              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] text-red-400">
                                {runResult.error_message}
                              </div>
                            )}

                            <div className="space-y-3 font-mono text-[10px] text-slate-300 max-h-60 overflow-y-auto bg-black/40 p-4 rounded-xl leading-relaxed whitespace-pre-wrap">
                              {JSON.stringify(runResult.output_data, null, 2)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6">
                      <Workflow className="w-12 h-12 text-primary-400 animate-pulse mb-3" />
                      <h4 className="font-bold text-white text-sm">Automations Canvas Workspace</h4>
                      <p className="text-xs text-slate-500 max-w-xs mt-1">Configure automated AI steps networks, serialize documents processing, and trigger manual executions.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 7. Admin Console Tab View */}
            {activeTab === "admin" && userProfile?.role === "admin" && (
              <div className="flex-grow flex flex-col gap-6 h-[calc(100vh-180px)] overflow-y-auto pb-6 scrollbar-thin">
                {fetchingAdminData ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500">
                    <Loader2 className="w-8 h-8 text-primary-400 animate-spin mb-2" />
                    <span>Compiling database metrics...</span>
                  </div>
                ) : adminMetrics ? (
                  <div className="space-y-6">
                    {/* Metrics KPI Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="glass-panel border border-white/5 rounded-3xl p-5 flex flex-col justify-between space-y-4">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total Accounts</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-extrabold text-white">{adminMetrics.users.total}</span>
                          <span className="text-[10px] text-slate-500">Profiles synced</span>
                        </div>
                      </div>

                      <div className="glass-panel border border-white/5 rounded-3xl p-5 flex flex-col justify-between space-y-4">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Storage Footprint</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-extrabold text-white">{formatBytes(adminMetrics.storage.total_bytes_used)}</span>
                          <span className="text-[10px] text-slate-500">({adminMetrics.storage.total_documents} files)</span>
                        </div>
                      </div>

                      <div className="glass-panel border border-white/5 rounded-3xl p-5 flex flex-col justify-between space-y-4">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Workflow Executions</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-extrabold text-white">{adminMetrics.workflows.total_runs}</span>
                          <span className="text-[10px] text-slate-500">({adminMetrics.workflows.completed_runs} completed)</span>
                        </div>
                      </div>

                      <div className="glass-panel border border-white/5 rounded-3xl p-5 flex flex-col justify-between space-y-4">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">AI Chat Sessions</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-extrabold text-white">{adminMetrics.chat.total_sessions}</span>
                          <span className="text-[10px] text-slate-500">Conversations</span>
                        </div>
                      </div>
                    </div>

                    {/* Extended Details Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Storage Distribution */}
                      <div className="glass-panel border border-white/5 rounded-3xl p-6 space-y-4">
                        <h4 className="font-bold text-white text-xs flex items-center gap-2">
                          <FileUp className="w-4 h-4 text-accent-neon" />
                          Storage Format Distribution
                        </h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {Object.entries(adminMetrics.storage.distribution).map(([ext, count]: any) => (
                            <div key={ext} className="flex justify-between items-center py-2 border-b border-white/5 text-xs">
                              <span className="font-mono text-slate-300 uppercase">.{ext}</span>
                              <span className="text-white font-semibold">{count} files</span>
                            </div>
                          ))}
                          {Object.keys(adminMetrics.storage.distribution).length === 0 && (
                            <div className="text-center text-xs text-slate-500 py-4">No documents analyzed.</div>
                          )}
                        </div>
                      </div>

                      {/* Token footprints */}
                      <div className="glass-panel border border-white/5 rounded-3xl p-6 space-y-4">
                        <h4 className="font-bold text-white text-xs flex items-center gap-2">
                          <Activity className="w-4 h-4 text-accent-neon" />
                          API Resource Units Consumption
                        </h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {Object.entries(adminMetrics.api_features_usage).map(([feat, units]: any) => (
                            <div key={feat} className="flex justify-between items-center py-2 border-b border-white/5 text-xs">
                              <span className="text-slate-300 capitalize">{feat.replace("_", " ")}</span>
                              <span className="text-white font-semibold">{units} units</span>
                            </div>
                          ))}
                          {Object.keys(adminMetrics.api_features_usage).length === 0 && (
                            <div className="text-center text-xs text-slate-500 py-4">No tokens tracked.</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Users accounts list */}
                    <div className="glass-panel border border-white/5 rounded-3xl p-6 space-y-4">
                      <h4 className="font-bold text-white text-xs flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-accent-neon" />
                        Registered Users Directory
                      </h4>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-white/10 text-slate-400 font-semibold">
                              <th className="py-2.5">Email</th>
                              <th className="py-2.5">Name</th>
                              <th className="py-2.5">Role</th>
                              <th className="py-2.5">Created At</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-slate-300">
                            {adminUsers.map((u: any) => (
                              <tr key={u.id} className="hover:bg-white/2 transition-colors">
                                <td className="py-3 font-mono">{u.email}</td>
                                <td className="py-3">{u.full_name || "N/A"}</td>
                                <td className="py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                    u.role === "admin" ? "bg-primary-500/10 text-primary-400" : "bg-white/5 text-slate-400"
                                  }`}>
                                    {u.role}
                                  </span>
                                </td>
                                <td className="py-3 text-slate-500">{new Date(u.created_at).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500">
                    Failed to fetch administration database.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
