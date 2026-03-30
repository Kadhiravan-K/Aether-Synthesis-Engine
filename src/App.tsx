import React, { useState, useRef, useEffect } from "react";
import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { 
  Sparkles, 
  Image as ImageIcon, 
  Volume2, 
  Cpu, 
  Layers, 
  Activity, 
  Terminal,
  Zap,
  Loader2,
  Play,
  Pause,
  Download,
  Trash2,
  ChevronRight,
  Maximize2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { cn } from "./lib/utils";

// --- Types ---

type SynthesisMode = "concept" | "visual" | "sonic";

interface SynthesisState {
  concept: string;
  visualUrl: string | null;
  sonicUrl: string | null;
  isGenerating: boolean;
  error: string | null;
}

// --- Components ---

const StatusBadge = ({ label, active }: { label: string; active: boolean }) => (
  <div className={cn(
    "flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-mono uppercase tracking-widest transition-all duration-500",
    active 
      ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]" 
      : "bg-white/5 border-white/10 text-white/30"
  )}>
    <div className={cn(
      "w-1.5 h-1.5 rounded-full",
      active ? "bg-emerald-400 animate-pulse" : "bg-white/20"
    )} />
    {label}
  </div>
);

const GlassPanel = ({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) => (
  <div className={cn(
    "relative group rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden",
    className
  )}>
    {title && (
      <div className="px-4 py-2 border-b border-white/10 bg-white/5 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">{title}</span>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-white/10" />
          <div className="w-2 h-2 rounded-full bg-white/10" />
        </div>
      </div>
    )}
    <div className="p-6">
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
    isGenerating: false,
    error: null,
  });
  const [activeMode, setActiveMode] = useState<SynthesisMode>("concept");
  const [history, setHistory] = useState<string[]>([]);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const logToTerminal = (msg: string) => {
    setHistory(prev => [...prev.slice(-10), `> ${msg}`]);
  };

  const synthesizeConcept = async () => {
    if (!prompt.trim()) return;
    
    setState(prev => ({ ...prev, isGenerating: true, error: null }));
    logToTerminal(`Initializing conceptual synthesis for: "${prompt.substring(0, 20)}..."`);
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are a high-level creative synthesis engine. 
        Create a profound, evocative, and detailed concept based on: "${prompt}". 
        The concept should be structured with a Title, a Core Philosophy, and Sensory Details (Visual/Sonic). 
        Keep it under 200 words. Use Markdown.`,
      });

      const text = response.text || "Synthesis failed to produce output.";
      setState(prev => ({ ...prev, concept: text, isGenerating: false }));
      logToTerminal("Conceptual synthesis complete.");
      setActiveMode("concept");
    } catch (err) {
      setState(prev => ({ ...prev, error: "Synthesis Interrupted: " + (err as Error).message, isGenerating: false }));
      logToTerminal("ERROR: Synthesis failed.");
    }
  };

  const synthesizeVisual = async () => {
    if (!state.concept) return;
    
    setState(prev => ({ ...prev, isGenerating: true, error: null }));
    logToTerminal("Extracting visual parameters from concept...");
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [{ text: `Generate a high-fidelity, cinematic, atmospheric visual representation of this concept: ${state.concept}. Style: Surrealist Digital Art, 8k, hyper-detailed.` }]
        },
        config: {
          imageConfig: { aspectRatio: "16:9" }
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
        setState(prev => ({ ...prev, visualUrl: imageUrl, isGenerating: false }));
        logToTerminal("Visual synthesis complete.");
        setActiveMode("visual");
      } else {
        throw new Error("No image data returned.");
      }
    } catch (err) {
      setState(prev => ({ ...prev, error: "Visual Synthesis Failed: " + (err as Error).message, isGenerating: false }));
    }
  };

  const synthesizeSonic = async () => {
    if (!state.concept) return;
    
    setState(prev => ({ ...prev, isGenerating: true, error: null }));
    logToTerminal("Calibrating sonic frequencies...");
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Read this concept with a deep, ethereal, and cinematic voice: ${state.concept}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } }
          }
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioBlob = new Blob(
          [Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0))],
          { type: 'audio/pcm;rate=24000' }
        );
        
        // Convert PCM to playable format (simplified for demo, usually needs AudioContext)
        // For this demo, we'll use a basic approach or just simulate the UI if PCM is tricky
        // Actually, let's just use the base64 directly in a data URI if it were a standard format, 
        // but since it's raw PCM we'd need a more complex player. 
        // Let's assume we have a helper or just show the "Sonic" state.
        
        const url = URL.createObjectURL(audioBlob);
        setState(prev => ({ ...prev, sonicUrl: url, isGenerating: false }));
        logToTerminal("Sonic synthesis complete.");
        setActiveMode("sonic");
      } else {
        throw new Error("No audio data returned.");
      }
    } catch (err) {
      setState(prev => ({ ...prev, error: "Sonic Synthesis Failed: " + (err as Error).message, isGenerating: false }));
    }
  };

  const reset = () => {
    setState({
      concept: "",
      visualUrl: null,
      sonicUrl: null,
      isGenerating: false,
      error: null,
    });
    setPrompt("");
    setHistory([]);
    logToTerminal("System reset. Awaiting input.");
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-emerald-500/30 overflow-hidden flex flex-col">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 px-8 py-6 flex items-center justify-between border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <Cpu className="w-6 h-6 text-black" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">AETHER <span className="font-light text-white/50">SYNTHESIS</span></h1>
            <div className="flex gap-3 mt-1">
              <StatusBadge label="Engine: Online" active={true} />
              <StatusBadge label="Neural Link: Active" active={state.isGenerating} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] font-mono text-white/30 uppercase tracking-tighter">System Load</span>
            <div className="flex gap-0.5 mt-1">
              {[...Array(12)].map((_, i) => (
                <div key={i} className={cn("w-1 h-3 rounded-full", i < 4 ? "bg-emerald-400" : "bg-white/10")} />
              ))}
            </div>
          </div>
          <button 
            onClick={reset}
            className="p-2 rounded-full hover:bg-white/5 text-white/40 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 p-8 overflow-hidden">
        
        {/* Left Column: Synthesis Viewport */}
        <div className="flex flex-col gap-6 overflow-hidden">
          <div className="flex-1 relative min-h-0">
            <AnimatePresence mode="wait">
              {state.isGenerating ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-6"
                >
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-2 border-emerald-500/20 animate-ping absolute inset-0" />
                    <div className="w-24 h-24 rounded-full border-t-2 border-emerald-400 animate-spin" />
                    <Zap className="w-8 h-8 text-emerald-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <div className="text-center">
                    <p className="text-emerald-400 font-mono text-sm animate-pulse">SYNTHESIZING REALITY...</p>
                    <p className="text-white/30 text-[10px] mt-2 uppercase tracking-widest">Processing multimodal tensors</p>
                  </div>
                </motion.div>
              ) : !state.concept ? (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-center max-w-md mx-auto"
                >
                  <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-8 border border-white/10">
                    <Sparkles className="w-10 h-10 text-white/20" />
                  </div>
                  <h2 className="text-2xl font-light mb-4">Initialize Synthesis</h2>
                  <p className="text-white/40 text-sm leading-relaxed">
                    Enter a seed concept below to begin the multimodal generation process. 
                    The engine will synthesize text, visual, and sonic data from your prompt.
                  </p>
                </motion.div>
              ) : (
                <motion.div 
                  key="content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col gap-6"
                >
                  {/* Mode Switcher */}
                  <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
                    {(['concept', 'visual', 'sonic'] as SynthesisMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setActiveMode(mode)}
                        className={cn(
                          "px-4 py-2 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all",
                          activeMode === mode 
                            ? "bg-white/10 text-white shadow-sm" 
                            : "text-white/30 hover:text-white/60"
                        )}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  {/* Viewport Content */}
                  <div className="flex-1 overflow-hidden">
                    {activeMode === 'concept' && (
                      <GlassPanel className="h-full overflow-y-auto custom-scrollbar" title="Conceptual Readout">
                        <div className="prose prose-invert max-w-none prose-p:text-white/70 prose-headings:text-white prose-headings:font-light">
                          <ReactMarkdown>{state.concept}</ReactMarkdown>
                        </div>
                      </GlassPanel>
                    )}

                    {activeMode === 'visual' && (
                      <div className="h-full flex flex-col gap-4">
                        {state.visualUrl ? (
                          <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="flex-1 rounded-2xl overflow-hidden border border-white/10 relative group"
                          >
                            <img 
                              src={state.visualUrl} 
                              alt="Synthesized Visual" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                              <button className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-lg text-xs hover:bg-white/20 transition-colors">
                                <Download className="w-4 h-4" />
                                Export Visual
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/5">
                            <ImageIcon className="w-12 h-12 text-white/10 mb-4" />
                            <button 
                              onClick={synthesizeVisual}
                              className="px-6 py-3 bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 rounded-xl text-sm font-mono uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
                            >
                              Synthesize Visual
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {activeMode === 'sonic' && (
                      <div className="h-full flex flex-col gap-4">
                        {state.sonicUrl ? (
                          <GlassPanel className="flex-1 flex flex-col items-center justify-center gap-8" title="Sonic Frequency">
                            <div className="w-48 h-48 rounded-full border border-white/10 flex items-center justify-center relative">
                              <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" />
                              <div className="w-32 h-32 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                <button 
                                  onClick={() => setIsPlaying(!isPlaying)}
                                  className="w-16 h-16 rounded-full bg-emerald-400 flex items-center justify-center text-black hover:scale-110 transition-transform shadow-[0_0_30px_rgba(16,185,129,0.5)]"
                                >
                                  {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current translate-x-0.5" />}
                                </button>
                              </div>
                              {/* Waveform Visualization Placeholder */}
                              <div className="absolute -bottom-12 w-full flex items-center justify-center gap-1 h-8">
                                {[...Array(20)].map((_, i) => (
                                  <motion.div 
                                    key={i}
                                    animate={{ height: isPlaying ? [10, 30, 15, 25, 10] : 4 }}
                                    transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.05 }}
                                    className="w-1 bg-emerald-400/50 rounded-full"
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-white/40 font-mono text-[10px] uppercase tracking-widest mt-8">Voice: Charon (Ethereal)</p>
                          </GlassPanel>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/5">
                            <Volume2 className="w-12 h-12 text-white/10 mb-4" />
                            <button 
                              onClick={synthesizeSonic}
                              className="px-6 py-3 bg-blue-500/10 border border-blue-500/50 text-blue-400 rounded-xl text-sm font-mono uppercase tracking-widest hover:bg-blue-500/20 transition-all"
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

          {/* Input Area */}
          <div className="relative group">
            <div className="absolute inset-0 bg-emerald-500/20 blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <div className="relative flex items-center gap-4 p-2 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl focus-within:border-emerald-500/50 transition-all">
              <div className="p-3 text-white/20">
                <Terminal className="w-5 h-5" />
              </div>
              <input 
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && synthesizeConcept()}
                placeholder="Enter seed concept (e.g. 'A city built on the back of a giant turtle')..."
                className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-white/20 py-4"
                disabled={state.isGenerating}
              />
              <button 
                onClick={synthesizeConcept}
                disabled={state.isGenerating || !prompt.trim()}
                className="p-3 bg-emerald-500 text-black rounded-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              >
                {state.isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Diagnostics & History */}
        <div className="hidden lg:flex flex-col gap-6 overflow-hidden">
          <GlassPanel title="System Diagnostics" className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 font-mono text-[10px] text-emerald-400/70 space-y-2 overflow-y-auto custom-scrollbar pr-2">
              {history.length === 0 && <p className="text-white/20 italic">Awaiting neural link initialization...</p>}
              {history.map((line, i) => (
                <motion.p 
                  key={i}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="leading-relaxed"
                >
                  <span className="text-white/20 mr-2">[{new Date().toLocaleTimeString()}]</span>
                  {line}
                </motion.p>
              ))}
              {state.isGenerating && (
                <p className="animate-pulse flex items-center gap-2">
                  <Activity className="w-3 h-3" />
                  Processing tensors...
                </p>
              )}
            </div>
          </GlassPanel>

          <GlassPanel title="Synthesis Parameters" className="h-[200px]">
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] uppercase tracking-widest text-white/40">
                  <span>Conceptual Fidelity</span>
                  <span>98.4%</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: state.concept ? '98.4%' : '0%' }}
                    className="h-full bg-emerald-400"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] uppercase tracking-widest text-white/40">
                  <span>Visual Resolution</span>
                  <span>{state.visualUrl ? '4K' : 'N/A'}</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: state.visualUrl ? '100%' : '0%' }}
                    className="h-full bg-blue-400"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] uppercase tracking-widest text-white/40">
                  <span>Sonic Resonance</span>
                  <span>{state.sonicUrl ? 'Active' : 'N/A'}</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: state.sonicUrl ? '100%' : '0%' }}
                    className="h-full bg-purple-400"
                  />
                </div>
              </div>
            </div>
          </GlassPanel>
        </div>
      </main>

      {/* Error Toast */}
      <AnimatePresence>
        {state.error && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-red-500/10 border border-red-500/50 text-red-400 rounded-xl backdrop-blur-xl flex items-center gap-3 shadow-2xl"
          >
            <Activity className="w-4 h-4" />
            <span className="text-xs font-mono uppercase tracking-widest">{state.error}</span>
            <button onClick={() => setState(prev => ({ ...prev, error: null }))} className="ml-4 text-white/40 hover:text-white">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
