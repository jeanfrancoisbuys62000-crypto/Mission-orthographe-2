import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';
import { DictationText, ModuleType, EvaluationResult } from '../types';
import { generateSpeech, decodeAudioData, evaluateDictation } from '../services/geminiService';

interface DictationViewProps {
  dictation: DictationText;
  onFinish: (result: EvaluationResult, userText: string) => void;
  onCancel: () => void;
}

export const DictationView: React.FC<DictationViewProps> = ({ dictation, onFinish, onCancel }) => {
  const [userText, setUserText] = useState('');
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSlowMode, setIsSlowMode] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  const initAudio = async (slow: boolean) => {
    setIsAudioLoading(true);
    setAudioError(null);
    try {
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch(e) {}
      }
      
      const audioData = await generateSpeech(dictation.content, slow);
      
      // Initialisation sécurisée de l'AudioContext
      if (!audioContextRef.current) {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }
      
      const ctx = audioContextRef.current;
      if (!ctx) throw new Error("Impossible d'initialiser l'AudioContext");

      // FIX TS2345: ctx est maintenant typé explicitement et validé
      const buffer = await decodeAudioData(audioData, ctx, 24000, 1);
      audioBufferRef.current = buffer;
      setDuration(buffer.duration);
      pausedTimeRef.current = 0;
      setCurrentTime(0);
    } catch (error: any) {
      console.error("Audio error:", error);
      setAudioError("Erreur technique de synthèse vocale. Essayez de raccourcir le texte ou de changer de dictée.");
    } finally {
      setIsAudioLoading(false);
    }
  };

  useEffect(() => {
    initAudio(false);
    return () => {
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch(e) {}
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [dictation]);

  const togglePlayback = async () => {
    const ctx = audioContextRef.current;
    const buffer = audioBufferRef.current;

    if (!ctx || !buffer) return;

    if (isPlaying) {
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch(e) {}
      }
      pausedTimeRef.current += ctx.currentTime - startTimeRef.current;
      setIsPlaying(false);
    } else {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      const offset = pausedTimeRef.current % buffer.duration;
      source.start(0, offset);
      startTimeRef.current = ctx.currentTime;
      sourceNodeRef.current = source;
      setIsPlaying(true);

      source.onended = () => {
        // On ne remet à zéro que si on a vraiment fini le buffer
        if (Math.abs((ctx.currentTime - startTimeRef.current) + pausedTimeRef.current - buffer.duration) < 0.2) {
            setIsPlaying(false);
            pausedTimeRef.current = 0;
            setCurrentTime(0);
        }
      };
    }
  };

  const handleSlowModeToggle = async () => {
    const nextSlow = !isSlowMode;
    setIsSlowMode(nextSlow);
    await initAudio(nextSlow);
    if (isPlaying) setIsPlaying(false); 
  };

  useEffect(() => {
    let interval: number;
    if (isPlaying) {
      interval = window.setInterval(() => {
        const ctx = audioContextRef.current;
        if (ctx) {
          const elapsed = (ctx.currentTime - startTimeRef.current) + pausedTimeRef.current;
          setCurrentTime(Math.min(elapsed, duration));
        }
      }, 100);
    }
    return () => clearInterval(interval!);
  }, [isPlaying, duration]);

  const handleSubmit = async () => {
    if (!userText.trim()) return;
    setIsEvaluating(true);
    try {
      const result = await evaluateDictation(dictation.content, userText);
      onFinish(result, userText);
    } catch (error) {
      console.error("Evaluation error:", error);
    } finally {
      setIsEvaluating(false);
    }
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {dictation.type === ModuleType.TRAINING ? 'Entraînement' : 'Dictée Brevet'}
          </h2>
          <p className="text-slate-500 font-serif italic">
            {dictation.author}, <span className="italic">{dictation.source}</span>
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel}>Quitter</Button>
      </div>

      {audioError && (
        <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl text-rose-700 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm font-medium">{audioError}</p>
          <Button size="sm" variant="danger" onClick={() => initAudio(isSlowMode)}>Réessayer</Button>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-slate-50 p-8 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Button 
              variant="primary" 
              className="h-16 w-16 rounded-full p-0 flex items-center justify-center shadow-lg flex-shrink-0"
              onClick={togglePlayback}
              isLoading={isAudioLoading}
              disabled={!!audioError}
            >
              {isPlaying ? (
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </Button>
            <div className="flex-1 w-full">
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden relative">
                <div 
                  className="absolute top-0 left-0 h-full bg-indigo-500 transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(79,70,229,0.5)]"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <div className="flex justify-between mt-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span>{Math.floor(currentTime)}s</span>
                <span>{Math.floor(duration)}s</span>
              </div>
            </div>
            <Button 
              variant={isSlowMode ? 'secondary' : 'outline'}
              size="sm"
              onClick={handleSlowModeToggle}
              className="whitespace-nowrap flex-shrink-0 rounded-xl"
              isLoading={isAudioLoading}
              disabled={!!audioError}
            >
              {isSlowMode ? 'Mode Lent Actif' : 'Vitesse Normale'}
            </Button>
          </div>
        </div>

        <div className="p-10 paper-texture min-h-[400px]">
          <textarea
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            placeholder="Écrivez ici ce que vous entendez..."
            className="w-full h-full min-h-[350px] bg-transparent border-none focus:ring-0 text-xl font-typewriter leading-loose text-slate-700 resize-none placeholder:text-slate-200"
            disabled={isEvaluating}
            spellCheck={false}
          />
        </div>

        <div className="bg-slate-50 p-8 border-t border-slate-100 flex justify-end">
          <Button 
            variant="primary" 
            size="lg" 
            onClick={handleSubmit}
            isLoading={isEvaluating}
            className="rounded-2xl px-12"
            disabled={!userText.trim() || isAudioLoading}
          >
            Soumettre ma copie
          </Button>
        </div>
      </div>
    </div>
  );
};