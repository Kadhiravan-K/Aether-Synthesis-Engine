import React, { useState, useRef, useEffect } from "react";
import { GoogleGenAI, Modality, GenerateContentResponse, ThinkingLevel, Type } from "@google/genai";
import { 
  Sparkles, 
  Image as ImageIcon, 
  Volume2, 
  Cpu, 
  Activity, 
  Terminal,
  Zap,
  Loader2,
  Play,
  Pause,
  Download,
  Trash2,
  ChevronRight,
  Video,
  Music,
  Globe,
  Shield,
  Radio,
  Box,
  Wind,
  Settings,
  History,
  Layers,
  Maximize2,
  User,
  LogOut,
  LogIn,
  Save,
  RefreshCw,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { cn } from "./lib/utils";
import { auth, db } from "./firebase";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser 
} from "firebase/auth";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  Timestamp 
} from "firebase/firestore";

// --- Global Types ---

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// --- Types ---

type SynthesisMode = "concept" | "visual" | "sonic" | "kinetic" | "harmonic";

interface SynthesisState {
  concept: string;
  visualUrl: string | null;
  sonicUrl: string | null;
  kineticUrl: string | null;
  harmonicUrl: string | null;
  groundingLinks: { title: string; uri: string }[];
  isGenerating: boolean;
  activeTask: string | null;
  error: string | null;
  params: {
    temperature: number;
    topP: number;
    resolution: "512px" | "1K" | "2K" | "4K";
    aspectRatio: "1:1" | "16:9" | "9:16" | "21:9";
  };
}

interface ArchiveItem {
  id: string;
  prompt: string;
  mode: SynthesisMode;
  result: string;
  createdAt: Timestamp;
}

// --- Components ---

const StatusBadge = ({ label, active, pulse = true }: { label: string; active: boolean; pulse?: boolean }) => (
  <div className={cn(
    "flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] font-mono uppercase tracking-widest transition-all duration-700",
    active 
      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]" 
      : "bg-white/5 border-white/5 text-white/20"
  )}>
    <div className={cn(
      "w-1 h-1 rounded-full",
      active ? (pulse ? "bg-emerald-400 animate-pulse" : "bg-emerald-400") : "bg-white/10"
    )} />
    {label}
  </div>
);

const GlassPanel = ({ children, className, title, icon: Icon }: { children: React.ReactNode; className?: string; title?: string; icon?: any }) => (
  <div className={cn(
    "relative group rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-2xl overflow-hidden transition-all duration-500 hover:bg-white/[0.04] hover:border-white/10",
    className
  )}>
    {title && (
      <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-3 h-3 text-white/30" />}
          <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/30">{title}</span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-white/5" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/5" />
        </div>
      </div>
    )}
    <div className="p-6 h-full">
      {children}
    </div>
  </div>
);

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState<SynthesisState>({
    concept: "",
    visualUrl: null,
    sonicUrl: null,
    kineticUrl: null,
    harmonicUrl: null,
    groundingLinks: [],
    isGenerating: false,
    activeTask: null,
    error: null,
    params: {
      temperature: 1.0,
      topP: 0.95,
      resolution: "1K",
      aspectRatio: "16:9"
    }
  });
  const [activeMode, setActiveMode] = useState<SynthesisMode>("concept");
  const [history, setHistory] = useState<{ time: string; msg: string; type: 'info' | 'warn' | 'success' }[]>([]);
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [archive, setArchive] = useState<ArchiveItem[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Initialize AI right before use to ensure latest key
  const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const log = (msg: string, type: 'info' | 'warn' | 'success' = 'info') => {
    setHistory(prev => [...prev.slice(-15), { time: new Date().toLocaleTimeString(), msg, type }]);
  };

  // Auth & Archive Listeners
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        log(`Neural link established with user: ${u.displayName || u.email}`, "success");
      } else {
        log("Neural link severed. Operating in guest mode.", "warn");
      }
    });

    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setApiKeySelected(hasKey);
      }
    };
    checkKey();

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setArchive([]);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "syntheses"),
      orderBy("createdAt", "desc")
    );

    const unsubscribeArchive = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ArchiveItem[];
      setArchive(items);
    });

    return () => unsubscribeArchive();
  }, [user]);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      log("Authentication failed.", "warn");
    }
  };

  const logout = () => signOut(auth);

  const saveToArchive = async (mode: SynthesisMode, result: string, metadata: any = {}) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "users", user.uid, "syntheses"), {
        userId: user.uid,
        prompt,
        mode,
        result,
        metadata,
        createdAt: serverTimestamp()
      });
      log(`Synthesis archived to neural memory.`, "success");
    } catch (err) {
      log("Failed to archive synthesis.", "warn");
    }
  };

  const handleKeySelection = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setApiKeySelected(true);
    }
  };

  const synthesizeConcept = async () => {
    if (!prompt.trim()) return;
    
    setState(prev => ({ ...prev, isGenerating: true, activeTask: "Conceptual Mapping", error: null }));
    log(`Initializing deep conceptual synthesis for: "${prompt.substring(0, 30)}..."`);
    
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `You are the Aether Synthesis Engine. 
        Synthesize a profound, multi-layered concept based on: "${prompt}". 
        Include:
        1. A Title.
        2. Core Philosophy (The "Why").
        3. Visual Parameters (Atmosphere, Palette, Geometry).
        4. Sonic Parameters (Timbre, Frequency, Rhythm).
        5. Kinetic Parameters (Motion, Flow, Momentum).
        
        Use high-level, evocative language. Structure with Markdown.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          tools: [{ googleSearch: {} }],
          temperature: state.params.temperature,
          topP: state.params.topP
        }
      });

      const text = response.text || "Synthesis failed to produce output.";
      const links = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(chunk => ({
        title: chunk.web?.title || "Reference",
        uri: chunk.web?.uri || "#"
      })) || [];

      setState(prev => ({ 
        ...prev, 
        concept: text, 
        groundingLinks: links,
        isGenerating: false, 
        activeTask: null 
      }));
      log("Conceptual synthesis complete. Reality anchored.", "success");
      saveToArchive("concept", text, { links });
      setActiveMode("concept");
    } catch (err) {
      setState(prev => ({ ...prev, error: "Synthesis Interrupted: " + (err as Error).message, isGenerating: false, activeTask: null }));
      log("CRITICAL: Conceptual synthesis failed.", "warn");
    }
  };

  const synthesizeVisual = async (refinePrompt?: string) => {
    if (!state.concept) return;
    setState(prev => ({ ...prev, isGenerating: true, activeTask: refinePrompt ? "Iterative Refinement" : "Visual Manifestation" }));
    log(refinePrompt ? `Refining visual tensors: ${refinePrompt}` : "Manifesting visual tensors...");
    
    try {
      const ai = getAI();
      const contents = refinePrompt && state.visualUrl ? {
        parts: [
          { inlineData: { data: state.visualUrl.split(',')[1], mimeType: "image/png" } },
          { text: `Refine this image based on: ${refinePrompt}. Maintain the core concept: ${state.concept}` }
        ]
      } : {
        parts: [{ text: `A hyper-detailed, cinematic, atmospheric visual of this concept: ${state.concept}. Style: Ethereal, futuristic, high-contrast.` }]
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents,
        config: {
          imageConfig: { aspectRatio: state.params.aspectRatio, imageSize: state.params.resolution }
        }
      });

      let imageUrl = "";
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        setState(prev => ({ ...prev, visualUrl: imageUrl, isGenerating: false, activeTask: null }));
        log(refinePrompt ? "Visual refinement stabilized." : "Visual manifestation stabilized.", "success");
        saveToArchive("visual", imageUrl, { refined: !!refinePrompt });
        setActiveMode("visual");
      }
    } catch (err) {
      setState(prev => ({ ...prev, error: "Visual Error: " + (err as Error).message, isGenerating: false, activeTask: null }));
    }
  };

  const synthesizeKinetic = async (extend: boolean = false) => {
    if (!state.concept) return;
    if (!apiKeySelected) {
      handleKeySelection();
      return;
    }

    setState(prev => ({ ...prev, isGenerating: true, activeTask: extend ? "Kinetic Extension" : "Kinetic Rendering" }));
    log(extend ? "Extending kinetic sequence..." : "Initiating Veo kinetic rendering (this may take 1-2 minutes)...");
    
    try {
      const ai = getAI();
      
      // For extension, we'd ideally pass the previous video, but for now we'll use the concept
      // and a starting image if available.
      const videoConfig: any = { 
        numberOfVideos: 1, 
        resolution: '720p', 
        aspectRatio: state.params.aspectRatio === "21:9" ? "16:9" : state.params.aspectRatio 
      };

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: extend 
          ? `Extend this sequence with more fluid motion: ${state.concept}`
          : `Cinematic motion sequence: ${state.concept}. Focus on fluid dynamics and atmospheric lighting.`,
        config: videoConfig
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
        log("Rendering kinetics... " + (operation.metadata?.progress || "processing"));
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const response = await fetch(downloadLink, {
          method: 'GET',
          headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! },
        });
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setState(prev => ({ ...prev, kineticUrl: url, isGenerating: false, activeTask: null }));
        log(extend ? "Kinetic extension complete." : "Kinetic rendering complete.", "success");
        saveToArchive("kinetic", url, { extended: extend });
        setActiveMode("kinetic");
      }
    } catch (err) {
      setState(prev => ({ ...prev, error: "Kinetic Error: " + (err as Error).message, isGenerating: false, activeTask: null }));
    }
  };

  const synthesizeHarmonic = async () => {
    if (!state.concept) return;
    if (!apiKeySelected) {
      handleKeySelection();
      return;
    }

    setState(prev => ({ ...prev, isGenerating: true, activeTask: "Harmonic Synthesis" }));
    log("Synthesizing Lyria soundscape...");
    
    try {
      const ai = getAI();
      const response = await ai.models.generateContentStream({
        model: "lyria-3-clip-preview",
        contents: `Generate a 30-second atmospheric, ethereal soundscape for this concept: ${state.concept}`,
      });

      let audioBase64 = "";
      let mimeType = "audio/wav";

      for await (const chunk of response) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (!audioBase64 && part.inlineData.mimeType) mimeType = part.inlineData.mimeType;
            audioBase64 += part.inlineData.data;
          }
        }
      }

      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      setState(prev => ({ ...prev, harmonicUrl: url, isGenerating: false, activeTask: null }));
      log("Harmonic synthesis complete.", "success");
      saveToArchive("harmonic", url);
      setActiveMode("harmonic");
    } catch (err) {
      setState(prev => ({ ...prev, error: "Harmonic Error: " + (err as Error).message, isGenerating: false, activeTask: null }));
    }
  };

  const reset = () => {
    setState({
      concept: "",
      visualUrl: null,
      sonicUrl: null,
      kineticUrl: null,
      harmonicUrl: null,
      groundingLinks: [],
      isGenerating: false,
      activeTask: null,
      error: null,
      params: {
        temperature: 1.0,
        topP: 0.95,
        resolution: "1K",
        aspectRatio: "16:9"
      }
    });
    setPrompt("");
    setHistory([]);
    log("System purge complete. Awaiting new seed.");
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500/30 overflow-hidden flex flex-col">
      {/* Immersive Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,_rgba(16,185,129,0.05)_0%,_transparent_70%)]" />
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-600/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-600/10 blur-[150px] rounded-full" />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      {/* Navigation Rail / Header */}
      <header className="relative z-20 px-10 py-6 flex items-center justify-between border-b border-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-6">
          <motion.div 
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.8, ease: "circOut" }}
            className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
            <Box className="w-6 h-6" />
          </motion.div>
          <div>
            <h1 className="text-xl font-bold tracking-[0.3em] uppercase">Aether <span className="font-thin text-white/40">v3.0</span></h1>
            <div className="flex gap-3 mt-2">
              <StatusBadge label={user ? `User: ${user.displayName?.split(' ')[0]}` : "Guest Mode"} active={!!user} pulse={false} />
              <StatusBadge label={state.activeTask || "Idle"} active={state.isGenerating} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 p-1 bg-white/[0.03] rounded-xl border border-white/5">
            <button 
              onClick={() => setShowArchive(!showArchive)}
              className={cn("p-2 rounded-lg transition-all", showArchive ? "bg-white text-black" : "text-white/40 hover:text-white")}
            >
              <History className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={cn("p-2 rounded-lg transition-all", showSettings ? "bg-white text-black" : "text-white/40 hover:text-white")}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {!apiKeySelected && (
            <button 
              onClick={handleKeySelection}
              className="px-4 py-2 bg-amber-500/10 border border-amber-500/50 text-amber-400 rounded-lg text-[10px] font-mono uppercase tracking-widest hover:bg-amber-500/20 transition-all"
            >
              Unlock Advanced
            </button>
          )}

          {user ? (
            <button onClick={logout} className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-white/10 transition-all">
              <LogOut className="w-4 h-4" />
              Sever Link
            </button>
          ) : (
            <button onClick={login} className="flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-emerald-500/20 transition-all">
              <LogIn className="w-4 h-4" />
              Neural Link
            </button>
          )}
          
          <button onClick={reset} className="p-3 rounded-xl hover:bg-white/5 text-white/20 hover:text-red-400 transition-all">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Synthesis Grid */}
      <main className="relative z-10 flex-1 grid grid-cols-1 xl:grid-cols-[1fr_450px] gap-10 p-10 overflow-hidden">
        
        {/* Viewport Section */}
        <div className="flex flex-col gap-8 overflow-hidden">
          <div className="flex-1 relative min-h-0">
            <AnimatePresence mode="wait">
              {state.isGenerating ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  className="absolute inset-0 flex flex-col items-center justify-center"
                >
                  <div className="relative mb-10">
                    <div className="w-32 h-32 rounded-full border border-emerald-500/10 animate-[ping_3s_infinite]" />
                    <div className="w-32 h-32 rounded-full border-t-2 border-emerald-400 animate-[spin_2s_linear_infinite] absolute inset-0" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Zap className="w-10 h-10 text-emerald-400" />
                    </div>
                  </div>
                  <div className="text-center space-y-3">
                    <h3 className="text-emerald-400 font-mono text-xs uppercase tracking-[0.5em] animate-pulse">
                      {state.activeTask}
                    </h3>
                    <p className="text-white/20 text-[9px] uppercase tracking-[0.3em]">Synthesizing Multimodal Tensors</p>
                  </div>
                </motion.div>
              ) : !state.concept ? (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-center max-w-xl mx-auto"
                >
                  <div className="w-24 h-24 rounded-[2.5rem] bg-white/[0.03] border border-white/5 flex items-center justify-center mb-10 shadow-2xl">
                    <Wind className="w-10 h-10 text-white/10" />
                  </div>
                  <h2 className="text-4xl font-thin tracking-tighter mb-6">Initialize Synthesis</h2>
                  <p className="text-white/30 text-sm leading-relaxed font-light">
                    The Aether Engine v2.0 utilizes advanced generative models to manifest 
                    conceptual, visual, kinetic, and harmonic realities from a single seed.
                  </p>
                </motion.div>
              ) : (
                <motion.div 
                  key="content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col gap-8"
                >
                  {/* Mode Selector */}
                  <div className="flex gap-3 p-1.5 bg-white/[0.03] rounded-2xl border border-white/5 w-fit">
                    {(['concept', 'visual', 'kinetic', 'harmonic'] as SynthesisMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setActiveMode(mode)}
                        className={cn(
                          "px-6 py-2.5 rounded-xl text-[10px] font-mono uppercase tracking-widest transition-all duration-300",
                          activeMode === mode 
                            ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]" 
                            : "text-white/30 hover:text-white/60 hover:bg-white/5"
                        )}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  {/* Viewport Content */}
                  <div className="flex-1 overflow-hidden">
                    {activeMode === 'concept' && (
                      <div className="h-full grid grid-rows-[1fr_auto] gap-6">
                        <GlassPanel className="overflow-y-auto custom-scrollbar" title="Conceptual Readout" icon={Terminal}>
                          <div className="prose prose-invert max-w-none prose-p:text-white/60 prose-headings:text-white prose-headings:font-thin prose-headings:tracking-tight">
                            <ReactMarkdown>{state.concept}</ReactMarkdown>
                          </div>
                        </GlassPanel>
                        {state.groundingLinks.length > 0 && (
                          <div className="flex flex-wrap gap-3">
                            {state.groundingLinks.map((link, i) => (
                              <a 
                                key={i} 
                                href={link.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] border border-white/5 rounded-xl text-[9px] font-mono text-white/40 hover:text-white hover:bg-white/10 transition-all"
                              >
                                <Globe className="w-3 h-3" />
                                {link.title}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {activeMode === 'visual' && (
                      <div className="h-full flex flex-col gap-6">
                        {state.visualUrl ? (
                          <div className="flex-1 flex flex-col gap-6">
                            <motion.div 
                              initial={{ scale: 0.98, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="flex-1 rounded-[2rem] overflow-hidden border border-white/5 relative group shadow-2xl"
                            >
                              <img src={state.visualUrl} alt="Visual" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-end justify-between p-10">
                                <button className="flex items-center gap-3 px-6 py-3 bg-white text-black rounded-xl text-xs font-bold hover:scale-105 transition-transform">
                                  <Download className="w-4 h-4" />
                                  Export
                                </button>
                                <div className="flex gap-3">
                                  <button 
                                    onClick={() => synthesizeVisual("Enhance detail and lighting")}
                                    className="p-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl text-white hover:bg-white/20 transition-all"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => synthesizeKinetic()}
                                    className="p-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl text-white hover:bg-white/20 transition-all"
                                  >
                                    <Video className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                            <div className="flex gap-4">
                              <input 
                                type="text" 
                                placeholder="Refine visual manifestation..."
                                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-light outline-none focus:border-emerald-500/50 transition-all"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    synthesizeVisual(e.currentTarget.value);
                                    e.currentTarget.value = "";
                                  }
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-[2rem] bg-white/[0.02]">
                            <ImageIcon className="w-16 h-16 text-white/5 mb-6" />
                            <button 
                              onClick={() => synthesizeVisual()}
                              className="px-8 py-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl text-[10px] font-mono uppercase tracking-[0.3em] hover:bg-emerald-500/20 transition-all"
                            >
                              Manifest Visual
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {activeMode === 'kinetic' && (
                      <div className="h-full flex flex-col gap-6">
                        {state.kineticUrl ? (
                          <div className="flex-1 flex flex-col gap-6">
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="flex-1 rounded-[2rem] overflow-hidden border border-white/5 bg-black shadow-2xl relative group"
                            >
                              <video 
                                src={state.kineticUrl} 
                                controls 
                                autoPlay 
                                loop 
                                className="w-full h-full object-contain"
                              />
                              <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => synthesizeKinetic(true)}
                                  className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl text-[10px] font-mono uppercase tracking-widest text-white hover:bg-white/20 transition-all"
                                >
                                  <Plus className="w-3 h-3" />
                                  Extend Sequence
                                </button>
                              </div>
                            </motion.div>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-[2rem] bg-white/[0.02]">
                            <Video className="w-16 h-16 text-white/5 mb-6" />
                            <button 
                              onClick={() => synthesizeKinetic()}
                              className="px-8 py-4 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-2xl text-[10px] font-mono uppercase tracking-[0.3em] hover:bg-blue-500/20 transition-all"
                            >
                              Render Kinetics
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {activeMode === 'harmonic' && (
                      <div className="h-full flex flex-col gap-6">
                        {state.harmonicUrl ? (
                          <GlassPanel className="flex-1 flex flex-col items-center justify-center gap-12" title="Harmonic Resonance" icon={Radio}>
                            <div className="relative">
                              <motion.div 
                                animate={{ scale: isPlaying ? [1, 1.2, 1] : 1, opacity: isPlaying ? [0.2, 0.5, 0.2] : 0.1 }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="absolute inset-0 bg-emerald-400 rounded-full blur-3xl"
                              />
                              <div className="w-56 h-56 rounded-full border border-white/10 flex items-center justify-center relative z-10 bg-black/40 backdrop-blur-3xl">
                                <button 
                                  onClick={() => setIsPlaying(!isPlaying)}
                                  className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-2xl"
                                >
                                  {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current translate-x-1" />}
                                </button>
                              </div>
                            </div>
                            <div className="flex items-end gap-1.5 h-12">
                              {[...Array(32)].map((_, i) => (
                                <motion.div 
                                  key={i}
                                  animate={{ height: isPlaying ? [10, 40, 15, 30, 10] : 4 }}
                                  transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.03 }}
                                  className="w-1.5 bg-emerald-400/40 rounded-full"
                                />
                              ))}
                            </div>
                          </GlassPanel>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-[2rem] bg-white/[0.02]">
                            <Music className="w-16 h-16 text-white/5 mb-6" />
                            <button 
                              onClick={synthesizeHarmonic}
                              className="px-8 py-4 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-2xl text-[10px] font-mono uppercase tracking-[0.3em] hover:bg-purple-500/20 transition-all"
                            >
                              Synthesize Soundscape
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input Interface */}
          <div className="relative group">
            <div className="absolute inset-0 bg-emerald-500/10 blur-3xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700" />
            <div className="relative flex items-center gap-6 p-3 bg-white/[0.03] border border-white/5 rounded-3xl backdrop-blur-3xl focus-within:border-white/20 transition-all duration-500">
              <div className="pl-6 text-white/20">
                <Terminal className="w-5 h-5" />
              </div>
              <input 
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && synthesizeConcept()}
                placeholder="Initialize seed concept..."
                className="flex-1 bg-transparent border-none outline-none text-base font-light placeholder:text-white/10 py-5"
                disabled={state.isGenerating}
              />
              <button 
                onClick={synthesizeConcept}
                disabled={state.isGenerating || !prompt.trim()}
                className="p-5 bg-white text-black rounded-2xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-20 disabled:hover:scale-100 transition-all shadow-xl"
              >
                {state.isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <ChevronRight className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Diagnostics Rail */}
        <div className="hidden xl:flex flex-col gap-8 overflow-hidden">
          <div className="flex-1 grid grid-rows-[1.5fr_1fr] gap-8 overflow-hidden">
            <GlassPanel title="Neural Diagnostics" icon={Activity} className="flex flex-col overflow-hidden">
              <div className="flex-1 font-mono text-[10px] text-emerald-400/60 space-y-3 overflow-y-auto custom-scrollbar pr-4">
                {history.length === 0 && <p className="text-white/10 italic">Awaiting neural link...</p>}
                {history.map((item, i) => (
                  <motion.div 
                    key={i}
                    initial={{ x: -10, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="flex gap-4"
                  >
                    <span className="text-white/10 shrink-0">[{item.time}]</span>
                    <span className={cn(
                      item.type === 'warn' ? 'text-red-400' : 
                      item.type === 'success' ? 'text-emerald-400 font-bold' : ''
                    )}>
                      {item.msg}
                    </span>
                  </motion.div>
                ))}
                {state.isGenerating && (
                  <div className="flex items-center gap-3 animate-pulse">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                    <span>Processing high-order tensors...</span>
                  </div>
                )}
              </div>
            </GlassPanel>

            <div className="grid grid-cols-2 gap-4">
              <GlassPanel title="Entropy" className="flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-thin text-emerald-400">{(state.params.temperature * 100).toFixed(0)}%</div>
                  <div className="text-[8px] text-white/20 uppercase tracking-widest mt-1">Creativity</div>
                </div>
              </GlassPanel>
              <GlassPanel title="Fidelity" className="flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-thin text-blue-400">{(state.params.topP * 100).toFixed(0)}%</div>
                  <div className="text-[8px] text-white/20 uppercase tracking-widest mt-1">Logic</div>
                </div>
              </GlassPanel>
            </div>
          </div>

          <GlassPanel title="Synthesis Metrics" icon={Shield} className="h-[280px]">
            <div className="space-y-6">
              {[
                { label: 'Conceptual Fidelity', value: state.concept ? 99.2 : 0, color: 'bg-emerald-400' },
                { label: 'Visual Stability', value: state.visualUrl ? 100 : 0, color: 'bg-blue-400' },
                { label: 'Kinetic Fluidity', value: state.kineticUrl ? 100 : 0, color: 'bg-amber-400' },
                { label: 'Harmonic Resonance', value: state.harmonicUrl ? 100 : 0, color: 'bg-purple-400' },
              ].map((metric, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-[8px] uppercase tracking-[0.2em] text-white/30">
                    <span>{metric.label}</span>
                    <span>{metric.value}%</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${metric.value}%` }}
                      transition={{ duration: 1, ease: "circOut" }}
                      className={cn("h-full", metric.color)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>
      </main>

      {/* Overlays: Settings & Archive */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-10 bg-black/80 backdrop-blur-md"
            onClick={() => setShowSettings(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-10 shadow-3xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-2xl font-thin tracking-widest uppercase">Engine Parameters</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/5 rounded-full transition-all">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-white/30">Temperature (Creativity)</label>
                    <input 
                      type="range" min="0" max="2" step="0.1" 
                      value={state.params.temperature} 
                      onChange={e => setState(prev => ({ ...prev, params: { ...prev.params, temperature: parseFloat(e.target.value) } }))}
                      className="w-full h-1 bg-white/5 rounded-full appearance-none accent-emerald-400"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-white/20">
                      <span>Precise</span>
                      <span>{state.params.temperature}</span>
                      <span>Creative</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-white/30">Top-P (Logic)</label>
                    <input 
                      type="range" min="0" max="1" step="0.05" 
                      value={state.params.topP} 
                      onChange={e => setState(prev => ({ ...prev, params: { ...prev.params, topP: parseFloat(e.target.value) } }))}
                      className="w-full h-1 bg-white/5 rounded-full appearance-none accent-blue-400"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-white/20">
                      <span>Strict</span>
                      <span>{state.params.topP}</span>
                      <span>Diverse</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-white/30">Resolution Matrix</label>
                    <div className="grid grid-cols-2 gap-3">
                      {["512px", "1K", "2K", "4K"].map(res => (
                        <button 
                          key={res}
                          onClick={() => setState(prev => ({ ...prev, params: { ...prev.params, resolution: res as any } }))}
                          className={cn(
                            "px-4 py-3 rounded-xl text-[10px] font-mono border transition-all",
                            state.params.resolution === res ? "bg-white text-black border-white" : "bg-white/5 border-white/10 text-white/40 hover:border-white/30"
                          )}
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-white/30">Aspect Ratio</label>
                    <div className="grid grid-cols-2 gap-3">
                      {["1:1", "16:9", "9:16", "21:9"].map(ratio => (
                        <button 
                          key={ratio}
                          onClick={() => setState(prev => ({ ...prev, params: { ...prev.params, aspectRatio: ratio as any } }))}
                          className={cn(
                            "px-4 py-3 rounded-xl text-[10px] font-mono border transition-all",
                            state.params.aspectRatio === ratio ? "bg-white text-black border-white" : "bg-white/5 border-white/10 text-white/40 hover:border-white/30"
                          )}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showArchive && (
          <motion.div 
            initial={{ x: 450 }}
            animate={{ x: 0 }}
            exit={{ x: 450 }}
            className="fixed top-0 right-0 bottom-0 w-[450px] z-50 bg-[#0a0a0a] border-l border-white/10 backdrop-blur-3xl shadow-3xl flex flex-col"
          >
            <div className="p-10 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <History className="w-5 h-5 text-emerald-400" />
                <h2 className="text-xl font-thin tracking-widest uppercase">Neural Archive</h2>
              </div>
              <button onClick={() => setShowArchive(false)} className="p-2 hover:bg-white/5 rounded-full transition-all">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-8">
              {!user ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                  <Shield className="w-12 h-12 text-white/5" />
                  <p className="text-white/30 text-sm font-light">Neural link required to access archived syntheses.</p>
                  <button onClick={login} className="px-6 py-3 bg-white text-black rounded-xl text-xs font-bold">Establish Link</button>
                </div>
              ) : archive.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30">
                  <Box className="w-12 h-12" />
                  <p className="text-sm font-light tracking-widest uppercase">Archive Empty</p>
                </div>
              ) : (
                archive.map((item) => (
                  <div key={item.id} className="group relative bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden hover:bg-white/[0.04] hover:border-white/10 transition-all">
                    <div className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-emerald-400/60">{item.mode}</span>
                        <span className="text-[8px] font-mono text-white/10">{item.createdAt?.toDate().toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs font-light text-white/60 line-clamp-2 italic">"{item.prompt}"</p>
                      <button 
                        onClick={() => {
                          setPrompt(item.prompt);
                          if (item.mode === 'concept') setState(prev => ({ ...prev, concept: item.result }));
                          if (item.mode === 'visual') setState(prev => ({ ...prev, visualUrl: item.result }));
                          if (item.mode === 'kinetic') setState(prev => ({ ...prev, kineticUrl: item.result }));
                          if (item.mode === 'harmonic') setState(prev => ({ ...prev, harmonicUrl: item.result }));
                          setActiveMode(item.mode);
                          setShowArchive(false);
                        }}
                        className="w-full py-2 bg-white/5 border border-white/10 rounded-lg text-[9px] font-mono uppercase tracking-widest hover:bg-white/10 transition-all"
                      >
                        Restore Tensor
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Error Notification */}
      <AnimatePresence>
        {state.error && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 px-8 py-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl backdrop-blur-3xl flex items-center gap-4 shadow-2xl"
          >
            <Shield className="w-5 h-5" />
            <span className="text-[10px] font-mono uppercase tracking-widest">{state.error}</span>
            <button onClick={() => setState(prev => ({ ...prev, error: null }))} className="ml-6 text-white/20 hover:text-white transition-colors">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.1); }
      `}</style>
    </div>
  );
}
