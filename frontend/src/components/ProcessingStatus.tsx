"use client";

import { useEffect, useState } from "react";

interface Stage {
  label: string;
  min: number;
  icon: React.ReactNode;
}

interface ProcessingStatusProps {
  progress: number;
  status: string;
  message: string;
}

export default function ProcessingStatus({ progress, status, message }: ProcessingStatusProps) {
  const stages: Stage[] = [
    { 
      label: "Upload", 
      min: 10, 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
        </svg>
      ) 
    },
    { 
      label: "Audio", 
      min: 30, 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      ) 
    },
    { 
      label: "Whisper", 
      min: 50, 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      ) 
    },
    { 
      label: "Gemini", 
      min: 70, 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ) 
    },
    { 
      label: "Render", 
      min: 85, 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ) 
    },
    { 
      label: "Ready", 
      min: 100, 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) 
    },
  ];

  return (
    <div className="space-y-12 py-10 relative z-10 w-full max-w-2xl mx-auto">
      {/* Hero Loading Section */}
      <div className="flex flex-col items-center">
        <div className="relative group">
          {/* Animated Glow Effect */}
          <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-3xl group-hover:bg-blue-500/30 transition-all duration-1000 animate-pulse"></div>
          
          {/* Circular Progress Container */}
          <div className="relative w-40 h-40 flex items-center justify-center">
            {/* Background Track */}
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="8"
                className="text-white/5"
              />
              {/* Progress Fill */}
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="transparent"
                stroke="url(#progress-gradient)"
                strokeWidth="8"
                strokeDasharray={440}
                strokeDashoffset={440 - (440 * progress) / 100}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
            
            {/* Percentage Display */}
            <div className="flex flex-col items-center">
              <span className="text-4xl font-black text-white tabular-nums">
                {progress}%
              </span>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
                Total Progress
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Status Text */}
        <div className="text-center mt-10 space-y-2">
          <h2 className="text-3xl font-bold text-white capitalize tracking-tight animate-in fade-in slide-in-from-bottom-2 duration-500">
            {status}
          </h2>
          <p className="text-zinc-400 text-lg font-medium max-w-md mx-auto line-clamp-1">
            {message || "Optimizing your content with neural networks..."}
          </p>
        </div>
      </div>

      {/* Advanced Stage Tracker */}
      <div className="space-y-8">
        {/* Main Linear Progress Bar */}
        <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 rounded-full transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(59,130,246,0.5)]"
            style={{ width: `${progress}%` }}
          >
            {/* Shimmer Effect */}
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)] -translate-x-full animate-[shimmer_2s_infinite]"></div>
          </div>
        </div>

        {/* Individual Stage Icons */}
        <div className="grid grid-cols-6 gap-2">
          {stages.map((step, i) => {
            const isCompleted = progress >= step.min;
            const isActive = progress < step.min && (i === 0 || progress >= stages[i-1].min);
            
            return (
              <div key={i} className="flex flex-col items-center gap-4 group">
                <div 
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-500 ${
                    isCompleted 
                      ? "bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]" 
                      : isActive
                        ? "bg-zinc-900 border-blue-500 text-white animate-pulse shadow-[0_0_20px_rgba(59,130,246,0.3)] scale-110"
                        : "bg-zinc-950 border-white/5 text-zinc-700"
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : step.icon}
                </div>
                
                <div className="flex flex-col items-center gap-1">
                  <span className={`text-[10px] font-black uppercase tracking-widest transition-colors duration-500 ${
                    isCompleted ? "text-blue-500" : isActive ? "text-white" : "text-zinc-600"
                  }`}>
                    {step.label}
                  </span>
                  {isActive && (
                    <div className="flex gap-1">
                      <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></span>
                      <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Additional Processing Details (Micro-interactions) */}
      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
          <span className="text-zinc-500">System Status</span>
          <span className="text-blue-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
            GPU Accelerated
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="bg-black/20 rounded-xl p-3 border border-white/5">
            <p className="text-[10px] text-zinc-500 mb-1">Estimated Time</p>
            <p className="text-sm text-white font-mono">
              {progress < 30 ? "~2 min" : progress < 70 ? "~1 min" : "< 30 sec"}
            </p>
          </div>
          <div className="bg-black/20 rounded-xl p-3 border border-white/5">
            <p className="text-[10px] text-zinc-500 mb-1">Output Format</p>
            <p className="text-sm text-white font-mono uppercase">9:16 Vertical HD</p>
          </div>
        </div>
      </div>
    </div>
  );
}
