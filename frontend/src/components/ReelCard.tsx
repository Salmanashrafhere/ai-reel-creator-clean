"use client";

import { useState, useRef } from "react";

interface ReelCardProps {
  reel: any;
  index: number;
  apiBaseUrl: string;
  onDownload: (url: string, title: string) => void;
  onDelete: (url: string, index: number) => void;
  onCopyCaption: (text: string, id: string) => void;
  onPreview: (url: string, title: string) => void;
  copiedId: string | null;
}

export default function ReelCard({
  reel,
  index,
  apiBaseUrl,
  onDownload,
  onDelete,
  onCopyCaption,
  onPreview,
  copiedId,
}: ReelCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (reel.caption) {
      onCopyCaption(reel.caption, `caption-${index}`);
    }
  };

  return (
    <div 
      className="group relative bg-zinc-900/50 backdrop-blur-sm rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl transition-all duration-500 hover:shadow-blue-500/20 hover:border-white/10 flex flex-col aspect-[9/16]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Video/Thumbnail Section */}
      <div className="relative flex-grow overflow-hidden cursor-pointer" onClick={() => onPreview(`${apiBaseUrl}${reel.url}`, reel.title)}>
        <video 
          ref={videoRef}
          src={`${apiBaseUrl}${reel.url}`} 
          poster={reel.thumbnail ? `${apiBaseUrl}${reel.thumbnail}` : undefined}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          playsInline
          muted
          loop
          preload="metadata"
          crossOrigin="anonymous"
        />
        
        {/* Social Media Style Overlays (Actions Only) */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none"></div>

        {/* Top Badges */}
        <div className="absolute top-5 left-5 right-5 flex justify-between items-start pointer-events-auto">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 bg-blue-500/20 backdrop-blur-xl text-blue-400 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-lg border border-blue-500/30">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
              AI Viral Pick
            </div>
            {reel.viral_score > 0 && (
              <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500/30 to-rose-500/30 backdrop-blur-xl text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-lg border border-white/20">
                <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Score: {reel.viral_score}
              </div>
            )}
            {reel.style && (
              <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-lg backdrop-blur-xl border ${
                reel.style === 'hype' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' :
                reel.style === 'educational' ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' :
                reel.style === 'funny' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                reel.style === 'emotional' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
              }`}>
                {reel.style}
              </span>
            )}
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(reel.url, index);
            }}
            className="bg-white/5 hover:bg-rose-500/90 backdrop-blur-xl text-white p-2.5 rounded-2xl transition-all shadow-xl border border-white/10 opacity-0 group-hover:opacity-100 transform translate-y-[-10px] group-hover:translate-y-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Right Action Sidebar (SaaS Style) */}
        <div className="absolute right-4 bottom-10 flex flex-col gap-4 pointer-events-auto">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDownload(reel.url, reel.title);
            }}
            className="flex flex-col items-center gap-1 group/btn"
          >
            <div className="w-11 h-11 bg-white/10 hover:bg-blue-600 backdrop-blur-xl rounded-full flex items-center justify-center text-white border border-white/10 shadow-2xl transition-all group-hover/btn:scale-110 group-hover/btn:border-blue-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter group-hover/btn:text-blue-400">Save</span>
          </button>

          {reel.thumbnail && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onDownload(reel.thumbnail, `${reel.title}_thumb`);
              }}
              className="flex flex-col items-center gap-1 group/btn"
            >
              <div className="w-11 h-11 bg-white/10 hover:bg-blue-600 backdrop-blur-xl rounded-full flex items-center justify-center text-white border border-white/10 shadow-2xl transition-all group-hover/btn:scale-110 group-hover/btn:border-blue-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter group-hover/btn:text-blue-400">Cover</span>
            </button>
          )}

          <button 
            onClick={handleCopy}
            className="flex flex-col items-center gap-1 group/btn"
          >
            <div className={`w-11 h-11 ${copiedId === `caption-${index}` ? 'bg-green-600 border-green-400' : 'bg-white/10 border-white/10'} hover:bg-blue-600 backdrop-blur-xl rounded-full flex items-center justify-center text-white border shadow-2xl transition-all group-hover/btn:scale-110 group-hover/btn:border-blue-400`}>
              {copiedId === `caption-${index}` ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              )}
            </div>
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter group-hover/btn:text-blue-400">
              {copiedId === `caption-${index}` ? 'Copied' : 'Copy'}
            </span>
          </button>
        </div>

        {/* Play Icon Center (Visible on hover) */}
        {!isHovered && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-14 h-14 bg-white/5 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10 shadow-2xl opacity-60">
              <svg className="w-6 h-6 fill-current ml-1" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Info Section Below Video */}
      <div className="p-5 bg-zinc-950/30 border-t border-white/5">
        <h3 className="text-sm font-bold text-white leading-tight line-clamp-1 group-hover:text-blue-400 transition-colors mb-2">
          {reel.title}
        </h3>
        
        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px] text-zinc-500 line-clamp-1 italic flex-grow" title={reel.score_reason || reel.reason}>
            {reel.score_reason || reel.reason}
          </p>
          
          {reel.hashtags && reel.hashtags.length > 0 && (
            <div className="flex gap-1 shrink-0">
              <span className="text-[9px] font-bold text-blue-500/60">
                #{Array.isArray(reel.hashtags) ? reel.hashtags[0].replace('#', '') : reel.hashtags.split(' ')[0].replace('#', '')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
