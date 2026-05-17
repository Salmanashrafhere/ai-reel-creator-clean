"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";
import ReelCard from "@/components/ReelCard";
import VideoModal from "@/components/VideoModal";
import ProcessingStatus from "@/components/ProcessingStatus";

const API_BASE_URL = "http://127.0.0.1:8000";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [reels, setReels] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [previewData, setPreviewData] = useState<{ url: string; title: string } | null>(null);
  const googleAuthInitialized = useRef(false);
  const googlePromptCalled = useRef(false);
  const isMounted = useRef(true);

  // Suppress development-only noise logs (GSI/FedCM and Next.js RSC)
  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      const originalError = console.error;
      const originalWarn = console.warn;
      
      console.error = (...args: any[]) => {
        const msg = args[0]?.toString() || "";
        if (msg.includes("FedCM") || msg.includes("_rsc") || msg.includes("NetworkError") || msg.includes("ERR_ABORTED") || msg.includes("ERR_BLOCKED_BY_ORB")) return;
        originalError.apply(console, args);
      };
      
      console.warn = (...args: any[]) => {
        const msg = args[0]?.toString() || "";
        if (msg.includes("FedCM")) return;
        originalWarn.apply(console, args);
      };
    }
  }, []);

  // Single useEffect for Google Identity Services lifecycle
  useEffect(() => {
    isMounted.current = true;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      console.error("[Frontend] NEXT_PUBLIC_GOOGLE_CLIENT_ID is missing! Check your .env.local");
    }

    // 1. Load user from localStorage
    const savedUser = localStorage.getItem("user");
    if (savedUser && !user) {
      setUser(JSON.parse(savedUser));
    }

    // 2. Initialize and Render Google Auth
    const initAndRender = () => {
      if (typeof window === "undefined" || !clientId || !isMounted.current) return;
      
      const google = (window as any).google;
      if (!google?.accounts?.id) {
        // If not loaded yet, retry in a bit
        setTimeout(initAndRender, 500);
        return;
      }

      // Prevent duplicate initialization
      if (!googleAuthInitialized.current) {
        try {
          google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: false,
            use_fedcm_for_prompt: true, // Enable FedCM as it's the modern standard
            ux_mode: "popup",
            cancel_on_tap_outside: true,
          });
          googleAuthInitialized.current = true;
          console.log("[Frontend] GSI Initialized");
        } catch (err) {
          console.error("[Frontend] GSI Init Failed:", err);
        }
      }

      // Render button if not logged in
      if (!user) {
        const btnContainer = document.getElementById("google-login-btn");
        if (btnContainer) {
          try {
            google.accounts.id.renderButton(btnContainer, {
              theme: "filled_blue", // Better for dark SaaS UI
              size: "large",
              shape: "pill",
              text: "signin_with",
              logo_alignment: "left",
              width: 200
            });
            console.log("[Frontend] Google Sign-In button rendered");
          } catch (err) {
            console.error("[Frontend] GSI Button Render Failed:", err);
          }

          // One Tap Prompt (only once per session)
          if (!googlePromptCalled.current) {
            google.accounts.id.prompt((notification: any) => {
              if (notification.isNotDisplayed()) {
                console.warn("[Frontend] One Tap not displayed:", notification.getNotDisplayedReason());
              }
            });
            googlePromptCalled.current = true;
          }
        } else {
          // Container not found yet, retry
          setTimeout(initAndRender, 100);
        }
      }
    };

    initAndRender();

    return () => {
      isMounted.current = false;
      if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
        try {
          (window as any).google.accounts.id.cancel();
        } catch (e) {}
      }
    };
  }, [user, isScriptLoaded]);

  const handleCredentialResponse = async (response: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (data.access_token) {
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setUser(data.user);
      }
    } catch (error) {
      console.error("Auth failed:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setShowDashboard(false);
  };

  const fetchHistory = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setLoadingHistory(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/user/reels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      
      if (response.ok && Array.isArray(data)) {
        setHistory(data);
      } else {
        console.error("Fetch history failed:", data.detail || "Unknown error");
        setHistory([]);
      }
    } catch (error) {
      console.error("Fetch history failed:", error);
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (showDashboard) {
      fetchHistory();
    }
  }, [showDashboard]);

  const copyToClipboard = async (text: string, id: string) => {
    console.log(`[Frontend] Attempting to copy text for ID: ${id}`);
    try {
      // Modern API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        throw new Error("Clipboard API not available or not secure context");
      }
    } catch (err) {
      console.warn("[Frontend] navigator.clipboard failed, trying fallback:", err);
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Ensure textarea is not visible but part of DOM
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        
        if (successful) {
          setCopiedId(id);
          setTimeout(() => setCopiedId(null), 2000);
        } else {
          throw new Error("Fallback copy command failed");
        }
      } catch (fallbackErr) {
        console.error("[Frontend] All copy methods failed:", fallbackErr);
        alert("Failed to copy text. Please try manually selecting and copying.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    console.log(`[Frontend] Starting upload for file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
    setStatus("uploading");
    const formData = new FormData();
    formData.append("file", file);

    const token = localStorage.getItem("token");
    const headers: any = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      console.log("[Frontend] User is authenticated, adding token to headers");
    }

    try {
      console.log(`[Frontend] Calling POST ${API_BASE_URL}/api/v1/process`);
      const response = await fetch(`${API_BASE_URL}/api/v1/process`, {
        method: "POST",
        body: formData,
        headers: headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Upload failed");
      }

      const data = await response.json();
      console.log(`[Frontend] Upload successful. Received Job ID: ${data.job_id}`);
      setJobId(data.job_id);
      setStatus("queued");
    } catch (error: any) {
      console.error("[Frontend] Upload error:", error);
      setStatus("error");
    }
  };

  const handleDownload = async (url: string, title: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}${url}`);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${title.replace(/\s+/g, "_")}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleDelete = async (url: string, index: number) => {
    const filename = url.split("/").pop();
    if (!filename) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/reel/${filename}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setReels((prev) => prev.filter((_, i) => i !== index));
      }
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const resetProcess = () => {
    setFile(null);
    setJobId(null);
    setStatus("idle");
    setProgress(0);
    setStatusMessage("");
    setReels([]);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (jobId && (status === "queued" || status === "processing")) {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/job/${jobId}`);
          if (!response.ok) throw new Error("Status check failed");
          
          const data = await response.json();
          console.log(`[Frontend] Job ${jobId} Status: ${data.status} (${data.progress}%) - ${data.message}`);
          
          setStatus(data.status);
          setProgress(data.progress);
          setStatusMessage(data.message || "");

          if (data.status === "completed") {
            console.log("[Frontend] Job completed successfully. Clips received:", data.result.clips.length);
            setReels(data.result.clips);
            setJobId(null);
          } else if (data.status === "failed") {
            console.error("[Frontend] Job failed:", data.result.error);
            setJobId(null);
          }
        } catch (error) {
          console.error("Status check failed:", error);
        }
      }, 2000);
    }

    return () => clearInterval(interval);
  }, [jobId, status]);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-blue-500/30">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_-20%,#3b82f615,transparent)] pointer-events-none"></div>
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] brightness-100 contrast-150 pointer-events-none"></div>
      
      <Script 
        src="https://accounts.google.com/gsi/client" 
        strategy="afterInteractive" 
        onLoad={() => setIsScriptLoaded(true)}
      />
      
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center cursor-pointer shadow-lg shadow-blue-500/20" 
            onClick={() => setShowDashboard(false)}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 cursor-pointer" onClick={() => setShowDashboard(false)}>
            Reel<span className="text-blue-500">AI</span>
          </span>
        </div>
        <div className="flex items-center gap-6">
          {user ? (
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowDashboard(!showDashboard)}
                className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                {showDashboard ? "← Editor" : "Dashboard"}
              </button>
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
                <img 
                  src={user.avatar} 
                  alt={user.name} 
                  className="w-6 h-6 rounded-full border border-white/20" 
                  referrerPolicy="no-referrer"
                />
                <span className="text-sm font-medium text-zinc-200">{user.name.split(' ')[0]}</span>
                <button onClick={handleLogout} className="ml-2 text-zinc-500 hover:text-rose-500 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div id="google-login-btn" className="min-w-[200px] min-h-[40px] flex items-center justify-end"></div>
          )}
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center px-6 py-12 relative z-10">
        <div className="max-w-6xl w-full space-y-16">
          {showDashboard ? (
            <section className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div className="space-y-2">
                  <h2 className="text-4xl font-bold tracking-tight text-white">Reel Library</h2>
                  <p className="text-zinc-500">Your collection of AI-generated viral moments.</p>
                </div>
                {history && history.length > 0 && (
                  <button
                    onClick={fetchHistory}
                    className="flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
                  >
                    <svg className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                )}
              </div>

              {loadingHistory ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="aspect-[9/16] bg-white/5 rounded-[2rem] animate-pulse border border-white/5 overflow-hidden">
                      <div className="h-full w-full bg-gradient-to-b from-transparent via-white/5 to-transparent -translate-y-full animate-[shimmer_2s_infinite]"></div>
                    </div>
                  ))}
                </div>
              ) : (history && Array.isArray(history) && history.length > 0) ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {history.map((reel, index) => (
                    <ReelCard
                      key={index}
                      reel={reel}
                      index={index}
                      apiBaseUrl={API_BASE_URL}
                      onDownload={handleDownload}
                      onDelete={handleDelete}
                      onCopyCaption={copyToClipboard}
                      onPreview={(url, title) => setPreviewData({ url, title })}
                      copiedId={copiedId}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-32 bg-white/5 rounded-[3rem] border border-white/10 backdrop-blur-sm">
                  <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto mb-6 text-zinc-600 border border-white/5">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white">No reels yet</h3>
                  <p className="text-zinc-500 mt-2 max-w-xs mx-auto">Upload a video to start generating viral content for your social media.</p>
                  <button
                    onClick={() => setShowDashboard(false)}
                    className="mt-8 bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                  >
                    Start Creating
                  </button>
                </div>
              )}
            </section>
          ) : reels.length === 0 ? (
            <>
              <section className="text-center space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-4">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                  AI Video Intelligence
                </div>
                <h1 className="text-5xl md:text-8xl font-black tracking-tight leading-[1.1] text-white">
                  Viral Reels <br />
                  <span className="text-blue-500">In Seconds.</span>
                </h1>
                <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                  Automatically extract the most engaging moments from your long-form content, cropped and ready for social media.
                </p>
              </section>

              <section className="bg-white/5 border border-white/10 rounded-[3rem] p-16 text-center shadow-2xl backdrop-blur-md relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                
                {status === "idle" || status === "error" ? (
                  <div className="space-y-10 relative z-10">
                    <div className="flex flex-col items-center">
                      <div className="w-24 h-24 bg-zinc-900 text-blue-500 rounded-[2rem] flex items-center justify-center mb-8 rotate-3 border border-white/5 group-hover:rotate-0 transition-transform duration-500">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <h2 className="text-3xl font-bold text-white">Upload Video</h2>
                      <p className="text-zinc-500 mt-3 text-lg">MP4, MOV or AVI up to 500MB</p>
                    </div>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleFileChange}
                      className="hidden"
                      id="video-upload"
                    />
                    <div className="flex flex-col items-center gap-6">
                      <label
                        htmlFor="video-upload"
                        className="inline-block bg-white/5 hover:bg-white/10 border border-white/10 px-10 py-5 rounded-[2rem] cursor-pointer transition-all font-semibold shadow-sm hover:border-blue-500/50"
                      >
                        {file ? (
                          <span className="flex items-center gap-3 text-white">
                            <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {file.name}
                          </span>
                        ) : "Choose File"}
                      </label>
                      {file && (
                        <button
                          onClick={handleUpload}
                          className="w-full max-w-sm bg-blue-600 hover:bg-blue-500 text-white font-bold py-6 rounded-[2rem] shadow-2xl shadow-blue-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                        >
                          Generate Viral Clips
                        </button>
                      )}
                    </div>
                    {status === "error" && (
                      <p className="text-rose-400 font-medium bg-rose-500/10 py-3 px-6 rounded-2xl inline-block border border-rose-500/20">
                        Something went wrong. Please try a different video.
                      </p>
                    )}
                  </div>
                ) : (
                  <ProcessingStatus 
                    progress={progress} 
                    status={status} 
                    message={statusMessage} 
                  />
                )}
              </section>
            </>
          ) : (
            <section className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                <div className="space-y-2">
                  <h2 className="text-4xl font-bold tracking-tight text-white">Generation Results</h2>
                  <p className="text-zinc-500">We've identified {reels.length} high-potential viral moments.</p>
                </div>
                <button
                  onClick={resetProcess}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 px-8 py-4 rounded-2xl font-bold transition-all text-white backdrop-blur-md"
                >
                  Create More
                </button>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {reels.map((reel, index) => (
                  <ReelCard
                    key={index}
                    reel={reel}
                    index={index}
                    apiBaseUrl={API_BASE_URL}
                    onDownload={handleDownload}
                    onDelete={handleDelete}
                    onCopyCaption={copyToClipboard}
                    onPreview={(url, title) => setPreviewData({ url, title })}
                    copiedId={copiedId}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="px-6 py-12 border-t border-white/5 text-center relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">AI</span>
            </div>
            <span className="text-lg font-bold text-white tracking-tight">ReelAI</span>
          </div>
          <p className="text-sm text-zinc-500">© 2026 ReelAI Creator. Built with Next.js and AI Intelligence.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-zinc-500 hover:text-white transition-colors">Twitter</a>
            <a href="#" className="text-zinc-500 hover:text-white transition-colors">GitHub</a>
          </div>
        </div>
      </footer>

      {previewData && (
        <VideoModal
          isOpen={!!previewData}
          onClose={() => setPreviewData(null)}
          videoUrl={previewData.url}
          title={previewData.title}
        />
      )}
    </div>
  );
}
