
import React, { useState } from 'react';
import { Button } from './Button';
import { EvaluationResult, ErrorDetail } from '../types';

interface EvaluationViewProps {
  result: EvaluationResult;
  userText: string;
  onSelfCorrect: (newText: string) => void;
  onNewDictation: () => void;
}

export const EvaluationView: React.FC<EvaluationViewProps> = ({ 
  result, 
  userText, 
  onSelfCorrect, 
  onNewDictation 
}) => {
  const [activeError, setActiveError] = useState<ErrorDetail | null>(null);
  const [showFullCorrection, setShowFullCorrection] = useState(false);
  const [correctionInput, setCorrectionInput] = useState(userText);
  const [isEditing, setIsEditing] = useState(false);

  /**
   * Génère le texte avec surlignage complexe.
   * Gère les erreurs adjacentes, imbriquées et chevauchantes.
   */
  const renderHighlightedText = () => {
    if (!result.errors || result.errors.length === 0) {
      return <span>{userText}</span>;
    }

    // 1. Collecter toutes les frontières d'index uniques
    const boundaries = new Set<number>([0, userText.length]);
    result.errors.forEach(error => {
      if (error.startIndex >= 0 && error.startIndex <= userText.length) {
        boundaries.add(error.startIndex);
      }
      if (error.endIndex >= 0 && error.endIndex <= userText.length) {
        boundaries.add(error.endIndex);
      }
    });

    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
    const elements: React.ReactNode[] = [];

    // 2. Parcourir chaque segment entre deux frontières
    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
      const start = sortedBoundaries[i];
      const end = sortedBoundaries[i + 1];
      const segmentText = userText.substring(start, end);

      if (segmentText === "") continue;

      // Trouver toutes les erreurs qui couvrent ce segment précis
      const errorsInSegment = result.errors.filter(
        error => start >= error.startIndex && end <= error.endIndex
      );

      if (errorsInSegment.length === 0) {
        elements.push(<span key={`seg-${start}-${end}`}>{segmentText}</span>);
      } else {
        // 3. Imbriquer les spans pour chaque erreur couvrant ce segment
        // On trie par longueur d'erreur décroissante pour que les plus larges soient à l'extérieur
        const sortedErrors = [...errorsInSegment].sort((a, b) => 
          (b.endIndex - b.startIndex) - (a.endIndex - a.startIndex)
        );

        let segmentContent: React.ReactNode = segmentText;
        
        sortedErrors.forEach((error, errIdx) => {
          const isGrammar = error.type === 'grammar';
          const colorClass = isGrammar 
            ? 'bg-rose-200/60 border-b-2 border-rose-500' 
            : 'bg-amber-200/60 border-b-2 border-amber-500';
          
          segmentContent = (
            <span
              key={`seg-${start}-${end}-err-${errIdx}`}
              className={`${colorClass} cursor-help transition-all hover:brightness-95 px-0 rounded-none inline`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveError(error);
              }}
              title={error.hint}
            >
              {segmentContent}
            </span>
          );
        });

        elements.push(<span key={`seg-wrapper-${start}-${end}`} className="inline">{segmentContent}</span>);
      }
    }

    return elements;
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-emerald-600';
    if (score >= 5) return 'text-amber-600';
    return 'text-rose-600';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-20 px-4">
      <div className="flex flex-col md:flex-row items-center justify-between bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-100 gap-6">
        <div className="text-center md:text-left">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Analyse de votre copie</h2>
          <p className="text-slate-500 mt-2 max-w-lg leading-relaxed">{result.comment}</p>
        </div>
        <div className="flex flex-col items-center justify-center bg-slate-50 px-8 py-6 rounded-3xl border border-slate-100">
          <div className={`text-6xl font-black ${getScoreColor(result.score)} tracking-tighter`}>
            {result.score}<span className="text-2xl text-slate-300">/10</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400 mt-2">Note Expert</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-soft border border-slate-100 paper-texture min-h-[400px] relative">
            <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-8">Manuscrit de l'élève</h3>
            
            {isEditing ? (
              <textarea
                value={correctionInput}
                onChange={(e) => setCorrectionInput(e.target.value)}
                className="w-full min-h-[300px] bg-transparent border-2 border-indigo-100 rounded-2xl p-6 font-typewriter text-xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-300 resize-none transition-all"
                autoFocus
              />
            ) : (
              <div className="font-typewriter text-xl md:text-2xl leading-loose text-slate-700 whitespace-pre-wrap break-words">
                {renderHighlightedText()}
              </div>
            )}
            
            <div className="mt-10 flex flex-wrap gap-4">
              {isEditing ? (
                <>
                  <Button variant="primary" className="rounded-2xl px-8" onClick={() => { setIsEditing(false); onSelfCorrect(correctionInput); }}>
                    Réévaluer ma copie
                  </Button>
                  <Button variant="ghost" className="rounded-2xl" onClick={() => setIsEditing(false)}>Abandonner</Button>
                </>
              ) : (
                <Button variant="outline" className="rounded-2xl border-slate-200 text-slate-600 hover:border-indigo-600 hover:text-indigo-600" onClick={() => setIsEditing(true)}>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Modifier ma réponse
                </Button>
              )}
            </div>
          </div>

          {showFullCorrection && (
            <div className="bg-emerald-50/50 p-10 rounded-[2.5rem] border border-emerald-100 animate-slideUp">
              <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-6">Texte original de référence</h3>
              <p className="font-serif text-xl md:text-2xl leading-relaxed text-emerald-900 italic opacity-90">
                {result.correctText}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[2rem] shadow-soft border border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Code correction</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4 group cursor-help">
                <div className="w-6 h-6 rounded-lg bg-rose-200 border-2 border-rose-500 shadow-sm"></div>
                <div>
                  <span className="text-slate-800 font-bold text-sm block leading-none">Grammaire</span>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">-1 point</span>
                </div>
              </div>
              <div className="flex items-center gap-4 group cursor-help">
                <div className="w-6 h-6 rounded-lg bg-amber-200 border-2 border-amber-500 shadow-sm"></div>
                <div>
                  <span className="text-slate-800 font-bold text-sm block leading-none">Lexique</span>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">-0.5 point</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-xl shadow-indigo-100 text-white relative overflow-hidden group">
            <h3 className="text-[10px] font-black opacity-60 uppercase tracking-[0.2em] mb-6">Boîte à Indices</h3>
            {activeError ? (
              <div className="animate-fadeIn relative z-10">
                <p className="text-sm font-bold mb-3 italic opacity-80 leading-snug">"{activeError.text}"</p>
                <div className="bg-white/10 p-4 rounded-2xl border border-white/10 mb-6">
                  <p className="text-base font-medium leading-relaxed">{activeError.hint}</p>
                </div>
                <Button variant="ghost" className="text-white hover:bg-white/10 p-0 text-xs underline decoration-white/30 underline-offset-4" onClick={() => setActiveError(null)}>Masquer l'indice</Button>
              </div>
            ) : (
              <div className="space-y-4 relative z-10">
                <p className="text-indigo-100 text-sm italic leading-relaxed">Le professeur IA a annoté votre copie. Touchez un mot surligné pour découvrir ses conseils personnalisés.</p>
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center animate-pulse">
                  <svg className="w-6 h-6 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
              </div>
            )}
            <svg className="absolute -bottom-6 -right-6 w-32 h-32 text-white/5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
          </div>

          <div className="pt-4 flex flex-col gap-4">
            <button 
              onClick={() => setShowFullCorrection(!showFullCorrection)}
              className="w-full py-4 px-6 rounded-2xl border-2 border-slate-200 text-slate-500 font-bold text-sm hover:border-indigo-600 hover:text-indigo-600 transition-all active:scale-95"
            >
              {showFullCorrection ? "Masquer la correction" : "Voir la correction intégrale"}
            </button>
            <Button variant="primary" size="lg" className="rounded-[2rem] py-6 shadow-2xl shadow-indigo-100 text-lg font-black" onClick={onNewDictation}>
              Choisir un autre texte
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
