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
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      if (!ctx) throw new Error("AudioContext failed to initialize");

      // FIX TS2345: ctx est maintenant garanti non-nul ici
      const buffer = await decodeAudioData(audioData, ctx, 24000, 1);
      audioBufferRef.current = buffer;
      setDuration(buffer.duration);
      pausedTimeRef.current = 0;
      setCurrentTime(0);
    } catch (error) {
      console.error("Audio error:", error);
      setAudioError("L'IA a rencontré une erreur technique lors de la synthèse vocale. Veuillez réessayer.");
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
    };
  }, [dictation]);

  const togglePlayback = () => {
    const ctx = audioContextRef.current;
    const buffer = audioBufferRef.current;

    if (isPlaying) {
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch(e) {}
      }
      if (ctx) {
        pausedTimeRef.current += ctx.currentTime - startTimeRef.current;
      }
      setIsPlaying(false);
    } else {
      if (!buffer || !ctx) return;
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      const offset = pausedTimeRef.current % buffer.duration;
      source.start(0, offset);
      startTimeRef.current = ctx.currentTime;
      sourceNodeRef.current = source;
      setIsPlaying(true);

      source.onended = () => {
        setIsPlaying(false);
      };
    }
  };

  const handleSlowModeToggle = async () => {
    const nextSlow = !isSlowMode;
    setIsSlowMode(nextSlow);
    await initAudio(nextSlow);
    if (isPlaying) togglePlayback(); 
  };

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        const ctx = audioContextRef.current;
        if (ctx) {
          const elapsed = (ctx.currentTime - startTimeRef.current) + pausedTimeRef.current;
          setCurrentTime(Math.min(elapsed, duration));
        }
      }, 100);
    }
    return () => clearInterval(interval);
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

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn px-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {dictation.type === ModuleType.TRAINING ? 'Entraînement' : 'Dictée Brevet'}
          </h2>
          <p className="text-slate-500 font-serif italic">
            {dictation.author}, <span className="italic">{dictation.source}</span>, {dictation.date}
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel}>Quitter</Button>
      </div>

      {audioError && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-700 flex items-center justify-between">
          <p className="text-sm font-medium">{audioError}</p>
          <Button size="sm" variant="danger" onClick={() => initAudio(isSlowMode)}>Réessayer</Button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-slate-50 p-6 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Button 
              variant="primary" 
              className="h-14 w-14 rounded-full p-0 flex items-center justify-center shadow-lg flex-shrink-0"
              onClick={togglePlayback}
              isLoading={isAudioLoading}
              disabled={!!audioError}
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </Button>
            <div className="flex-1 w-full">
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden relative">
                <div 
                  className="absolute top-0 left-0 h-full bg-indigo-500 transition-all duration-100 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-slate-400 font-medium uppercase tracking-wider">
                <span>{Math.floor(currentTime)}s</span>
                <span>{Math.floor(duration)}s</span>
              </div>
            </div>
            <Button 
              variant={isSlowMode ? 'secondary' : 'outline'}
              size="sm"
              onClick={handleSlowModeToggle}
              className="whitespace-nowrap flex-shrink-0"
              isLoading={isAudioLoading}
              disabled={!!audioError}
            >
              {isSlowMode ? 'Mode Lent Actif' : 'Vitesse Normale'}
            </Button>
          </div>
        </div>

        <div className="p-8 paper-texture min-h-[400px]">
          <textarea
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            placeholder="Écoutez la dictée et écrivez le texte ici..."
            className="w-full h-full min-h-[300px] bg-transparent border-none focus:ring-0 text-xl font-typewriter leading-relaxed text-slate-700 resize-none placeholder:text-slate-300"
            disabled={isEvaluating}
          />
        </div>

        <div className="bg-slate-50 p-6 border-t border-slate-100 flex justify-end">
          <Button 
            variant="primary" 
            size="lg" 
            onClick={handleSubmit}
            isLoading={isEvaluating}
            disabled={!userText.trim() || isAudioLoading}
          >
            Terminer la dictée
          </Button>
        </div>
      </div>
    </div>
  );
};