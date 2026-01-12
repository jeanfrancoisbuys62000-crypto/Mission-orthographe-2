
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ModuleType, DifficultyLevel, DictationText, EvaluationResult, UserProgress, DictationMetadata } from './types';
import { generateCatalog, generateDictationTextFromMetadata, evaluateDictation } from './services/geminiService';
import { Button } from './components/Button';
import { DictationView } from './components/DictationView';
import { EvaluationView } from './components/EvaluationView';

const STORAGE_KEY = 'orthographe_expert_v3_progress';

const INITIAL_CATALOGS: Record<string, DictationMetadata[]> = {
  'level-1': [
    { id: 'level-1-text-1', author: 'Marcel PAGNOL', source: 'La Gloire de mon père', date: '1957', index: 1 },
    { id: 'level-1-text-2', author: 'Alphonse DAUDET', source: 'Lettres de mon moulin', date: '1869', index: 2 },
    { id: 'level-1-text-3', author: 'Jean GIONO', source: 'L\'Homme qui plantait des arbres', date: '1953', index: 3 },
    { id: 'level-1-text-4', author: 'Victor HUGO', source: 'Les Misérables', date: '1862', index: 4 },
    { id: 'level-1-text-5', author: 'Colette', source: 'Sido', date: '1930', index: 5 },
    { id: 'level-1-text-6', author: 'Antoine de SAINT-EXUPÉRY', source: 'Le Petit Prince', date: '1943', index: 6 },
    { id: 'level-1-text-7', author: 'Jules RENARD', source: 'Poil de Carotte', date: '1894', index: 7 },
    { id: 'level-1-text-8', author: 'Guy de MAUPASSANT', source: 'Le Horla', date: '1887', index: 8 },
    { id: 'level-1-text-9', author: 'Honoré de BALZAC', source: 'Le Père Goriot', date: '1835', index: 9 },
    { id: 'level-1-text-10', author: 'Émile ZOLA', source: 'Au Bonheur des Dames', date: '1883', index: 10 },
  ],
  'level-2': [
    { id: 'level-2-text-1', author: 'Gustave FLAUBERT', source: 'Madame Bovary', date: '1857', index: 1 },
    { id: 'level-2-text-2', author: 'Stendhal', source: 'Le Rouge et le Noir', date: '1830', index: 2 },
    { id: 'level-2-text-3', author: 'Albert CAMUS', source: 'L\'Étranger', date: '1942', index: 3 },
    { id: 'level-2-text-4', author: 'Marguerite DURAS', source: 'L\'Amant', date: '1984', index: 4 },
    { id: 'level-2-text-5', author: 'Jean-Paul SARTRE', source: 'Les Mots', date: '1964', index: 5 },
  ],
  'brevet': [
    { id: 'brevet-text-1', author: 'Albert CAMUS', source: 'Le Premier Homme', date: '1994', index: 1 },
    { id: 'brevet-text-2', author: 'Romain GARY', source: 'La Promesse de l\'aube', date: '1960', index: 2 },
    { id: 'brevet-text-3', author: 'Simone de BEAUVOIR', source: 'Mémoires d\'une jeune fille rangée', date: '1958', index: 3 },
    { id: 'brevet-text-4', author: 'Annie ERNAUX', source: 'La Place', date: '1983', index: 4 },
    { id: 'brevet-text-5', author: 'Laurent GAUDÉ', source: 'Le Soleil des Scorta', date: '2004', index: 5 },
    { id: 'brevet-text-6', author: 'Wajdi MOUAWAD', source: 'Incendies', date: '2003', index: 6 },
    { id: 'brevet-text-7', author: 'Delphine de VIGAN', source: 'No et moi', date: '2007', index: 7 },
    { id: 'brevet-text-8', author: 'Gaël FAYE', source: 'Petit Pays', date: '2016', index: 8 },
  ]
};

const Logo = () => (
  <div className="flex items-center gap-4 group cursor-pointer">
    <div className="relative w-14 h-14 flex items-center justify-center bg-indigo-600 rounded-[1.25rem] shadow-xl shadow-indigo-200/50 animate-float">
      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-400 rounded-full border-[3px] border-white shadow-sm"></div>
    </div>
    <div className="flex flex-col">
      <h1 className="text-3xl font-black text-slate-800 tracking-tighter leading-none mb-1">Orthographe</h1>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black text-white bg-indigo-500 px-2 py-0.5 rounded-md uppercase tracking-[0.2em]">Expert</span>
        <div className="h-px w-8 bg-slate-200"></div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Niveau 3ème</span>
      </div>
    </div>
  </div>
);

// Logos décoratifs pour les palliers
const PallierIcon = ({ level }: { level: number }) => {
  const icons = [
    // Pallier 1 : La Plume
    <svg key="1" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
    // Pallier 2 : Le Parchemin
    <svg key="2" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    // Pallier 3 : L'Encrier / Stylo plume
    <svg key="3" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5h2M7 5h1m8 0h1m-9 8a9 9 0 0118 0v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a9 9 0 019-9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11l-2 5h4l-2-5z" /></svg>,
    // Pallier 4 : Les Lauriers / Succès
    <svg key="4" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
  ];
  return icons[level - 1] || icons[0];
};

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'browser' | 'loading' | 'dictation' | 'results'>('dashboard');
  const [activeModule, setActiveModule] = useState<ModuleType | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<DifficultyLevel | null>(null);
  const [currentDictation, setCurrentDictation] = useState<DictationText | null>(null);
  const [currentResult, setCurrentResult] = useState<EvaluationResult | null>(null);
  const [submittedText, setSubmittedText] = useState('');
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  const currentTab = location.hash === '#brevet' ? 'brevet' : 'training';

  const [progress, setProgress] = useState<UserProgress>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initialProgress = { 
      completedTraining: [], 
      completedBrevet: [], 
      catalogs: INITIAL_CATALOGS 
    };
    if (!saved) return initialProgress;
    
    const parsed = JSON.parse(saved);
    return {
      ...parsed,
      catalogs: { ...INITIAL_CATALOGS, ...parsed.catalogs }
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  const fetchCatalogIfNeeded = async (type: ModuleType, level?: DifficultyLevel) => {
    const key = type === ModuleType.TRAINING ? `level-${level}` : 'brevet';
    const currentCatalog = progress.catalogs[key] || [];
    if (currentCatalog.length >= 10) return;

    setIsCatalogLoading(true);
    try {
      const count = type === ModuleType.TRAINING ? 50 : 30;
      const newCatalog = await generateCatalog(type, level, count);
      const merged = [...currentCatalog];
      newCatalog.forEach(nc => {
        if (!merged.find(m => m.author === nc.author && m.source === nc.source)) {
          merged.push(nc);
        }
      });
      
      setProgress(prev => ({
        ...prev,
        catalogs: { ...prev.catalogs, [key]: merged }
      }));
    } catch (e) {
      console.error("Erreur catalogue", e);
    } finally {
      setIsCatalogLoading(false);
    }
  };

  const openTrainingLevel = async (l: DifficultyLevel) => {
    setActiveModule(ModuleType.TRAINING);
    setSelectedLevel(l);
    setView('browser');
    await fetchCatalogIfNeeded(ModuleType.TRAINING, l);
  };

  const openBrevetCollection = async () => {
    setActiveModule(ModuleType.BREVET);
    setSelectedLevel(null);
    setView('browser');
    await fetchCatalogIfNeeded(ModuleType.BREVET);
  };

  const loadDictation = async (meta: DictationMetadata) => {
    setView('loading');
    try {
      const dictation = await generateDictationTextFromMetadata(
        meta, 
        activeModule!, 
        selectedLevel || 1
      );
      setCurrentDictation(dictation);
      setView('dictation');
    } catch (error) {
      console.error("Failed to load dictation", error);
      alert("Erreur de chargement. Veuillez réessayer.");
      setView('browser');
    }
  };

  const handleDictationFinish = (result: EvaluationResult, text: string) => {
    setCurrentResult(result);
    setSubmittedText(text);
    if (result.score >= 5 && currentDictation) {
      const isTraining = currentDictation.type === ModuleType.TRAINING;
      setProgress(prev => ({
        ...prev,
        completedTraining: isTraining 
          ? [...new Set([...prev.completedTraining, currentDictation.id])] 
          : prev.completedTraining,
        completedBrevet: !isTraining
          ? [...new Set([...prev.completedBrevet, currentDictation.id])]
          : prev.completedBrevet
      }));
    }
    setView('results');
  };

  const handleSelfCorrect = async (newText: string) => {
    if (!currentDictation) return;
    setView('loading');
    try {
      const result = await evaluateDictation(currentDictation.content, newText);
      setCurrentResult(result);
      setSubmittedText(newText);
      setView('results');
    } catch (error) {
      console.error("Evaluation error", error);
      setView('results');
    }
  };

  const renderDashboard = () => (
    <div className="max-w-6xl mx-auto space-y-12 animate-fadeIn py-16 px-8">
      <header className="flex flex-col items-center text-center space-y-8">
        <Logo />
        <div className="space-y-3">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter max-w-3xl">L'excellence au bout de la plume.</h2>
          <p className="text-xl text-slate-500 font-serif italic max-w-xl mx-auto opacity-80">Révisez vos classiques et préparez votre brevet avec une IA bienveillante.</p>
        </div>
      </header>

      {/* TABS NAVIGATION */}
      <div className="flex justify-center">
        <div className="bg-slate-200/50 p-1.5 rounded-[2.2rem] flex items-center backdrop-blur-md border border-white/20">
          <button 
            onClick={() => navigate('#training')}
            className={`px-10 py-4 rounded-[2rem] text-sm font-black transition-all duration-300 ${currentTab === 'training' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Entraînement quotidien
          </button>
          <button 
            onClick={() => navigate('#brevet')}
            className={`px-10 py-4 rounded-[2rem] text-sm font-black transition-all duration-300 ${currentTab === 'brevet' ? 'bg-white text-amber-600 shadow-xl' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Dictée type brevet
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto">
        {currentTab === 'training' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-fadeIn">
            {[1, 2, 3, 4].map((l) => {
              const completedCount = progress.completedTraining.filter(id => id.startsWith(`level-${l}-`)).length;
              const totalTexts = 50;
              const percentage = Math.min(Math.round((completedCount / totalTexts) * 100), 100);
              
              return (
                <button 
                  key={l}
                  onClick={() => openTrainingLevel(l as DifficultyLevel)}
                  className="group relative bg-white/70 hover:bg-white rounded-[2.5rem] p-8 text-left transition-all duration-500 border border-white/60 shadow-soft hover:shadow-2xl hover:shadow-indigo-100/50 hover:-translate-y-2"
                >
                  <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-sm">
                        {l}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-indigo-600/90 font-black text-xl tracking-tight uppercase">Pallier {l}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="p-1 bg-indigo-50 rounded-md text-indigo-400">
                             <PallierIcon level={l} />
                          </div>
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest group-hover:text-indigo-300 transition-colors">Décoration {l}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] group-hover:text-indigo-400">Niveau</span>
                  </div>

                  <div className="flex justify-between items-end mb-4">
                    <span className="text-sm font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{completedCount} / {totalTexts} dictées</span>
                    <span className="text-3xl font-black text-slate-800 tracking-tighter">{percentage}%</span>
                  </div>
                  
                  <div className="h-3 w-full bg-slate-100/50 rounded-full overflow-hidden p-0.5 border border-slate-50">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-800 rounded-full transition-all duration-1000 ease-out shadow-lg shadow-indigo-200"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="animate-fadeIn max-w-2xl mx-auto">
            <section className="bg-white/80 rounded-[3.5rem] shadow-soft border border-white/50 flex flex-col overflow-hidden backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:shadow-amber-100/50 group">
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 px-12 py-12 text-white relative overflow-hidden">
                <div className="relative z-10 space-y-3">
                  <div className="flex justify-between items-center">
                    <h2 className="text-4xl font-black tracking-tight">Annales</h2>
                    <div className="px-5 py-2 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/10 text-[11px] font-black uppercase tracking-widest">
                      {progress.completedBrevet.length} terminés
                    </div>
                  </div>
                  <p className="text-amber-50 font-medium opacity-70 italic text-lg">Simulez l'examen final en 140 mots.</p>
                </div>
                <svg className="absolute -bottom-10 -right-10 w-64 h-64 text-white opacity-5 transition-transform group-hover:scale-110 duration-700" fill="currentColor" viewBox="0 0 20 20"><path d="M10.394 2.827c.197-.101.415-.152.606-.152.191 0 .409.051.606.152l7 3.5c.394.197.394.514 0 .711l-7 3.5c-.197.101-.415.152-.606.152-.191 0-.409-.051-.606-.152l-7-3.5c-.394-.197-.394-.514 0-.711l7-3.5z"/></svg>
              </div>
              <div className="p-10 flex flex-col justify-center flex-1 bg-slate-50/20 space-y-10">
                <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm relative overflow-hidden group/card">
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                       <div className="p-2 bg-amber-50 rounded-lg text-amber-500">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                       </div>
                       <h3 className="font-black text-slate-800 text-2xl tracking-tight">Préparation Intensive</h3>
                    </div>
                    <p className="text-slate-500 text-lg leading-relaxed font-serif">Une sélection de 30 textes littéraires officiels pour maîtriser les épreuves du brevet.</p>
                    
                    <div className="mt-8 flex items-center gap-5">
                      <div className="flex -space-x-3">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="w-10 h-10 rounded-full border-[3px] border-white bg-slate-100 flex items-center justify-center text-[11px] font-black text-slate-600 shadow-sm">
                            {i}
                          </div>
                        ))}
                      </div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">+26 auteurs classiques</span>
                    </div>
                  </div>
                  <div className="absolute -top-16 -right-16 w-40 h-40 bg-amber-50/50 rounded-full scale-0 group-hover/card:scale-100 transition-transform duration-700"></div>
                </div>
                
                <Button 
                  variant="primary" 
                  size="lg" 
                  className="w-full py-8 rounded-[2.5rem] bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-2xl shadow-amber-200 border-none transform transition hover:-translate-y-2 active:scale-95 text-white font-black text-xl tracking-tight"
                  onClick={openBrevetCollection}
                >
                  Lancer une simulation
                </Button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );

  const renderBrowser = () => {
    const isTraining = activeModule === ModuleType.TRAINING;
    const title = isTraining ? `Niveau ${selectedLevel}` : "Annales du Brevet";
    const key = isTraining ? `level-${selectedLevel}` : 'brevet';
    const catalog = progress.catalogs[key] || [];
    const completedList = isTraining ? progress.completedTraining : progress.completedBrevet;
    
    return (
      <div className="max-w-6xl mx-auto space-y-12 animate-fadeIn py-16 px-8">
        <nav className="flex items-center gap-10">
          <button onClick={() => setView('dashboard')} className="group w-16 h-16 rounded-[1.75rem] bg-white shadow-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all hover:shadow-indigo-100 active:scale-90 border border-slate-100">
            <svg className="w-7 h-7 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="space-y-1">
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{title}</h2>
            <p className="text-slate-400 font-serif italic text-lg">{catalog.length} œuvres répertoriées</p>
          </div>
        </nav>

        {isCatalogLoading && catalog.length === 0 ? (
          <div className="bg-white rounded-[4rem] shadow-2xl shadow-slate-200/50 p-32 flex flex-col items-center justify-center space-y-8 border border-slate-100">
            <div className="w-20 h-20 border-[6px] border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-slate-400 font-medium italic text-xl">Recherche dans les archives littéraires...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {catalog.map((item) => {
              const isCompleted = completedList.includes(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => loadDictation(item)}
                  className={`group relative text-left p-10 rounded-[3rem] transition-all duration-500 border-2 
                    ${isCompleted 
                      ? 'bg-emerald-50/50 border-emerald-100 shadow-xl shadow-emerald-100/20' 
                      : 'bg-white border-slate-50 hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-200/30 hover:-translate-y-3'
                    }`}
                >
                  <div className="flex justify-between items-start mb-6">
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isCompleted ? 'text-emerald-500' : 'text-slate-300'}`}>Pièce {item.index}</span>
                    {isCompleted && (
                      <div className="bg-emerald-500 text-white p-1.5 rounded-full shadow-lg shadow-emerald-200 animate-bounce">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                      </div>
                    )}
                  </div>
                  <h3 className={`font-black text-2xl tracking-tighter leading-tight mb-3 ${isCompleted ? 'text-emerald-900' : 'text-slate-800'}`}>
                    {item.author}
                  </h3>
                  <p className={`text-lg leading-relaxed font-serif italic mb-6 ${isCompleted ? 'text-emerald-700/80' : 'text-slate-500'}`}>
                    "{item.source}", {item.date}
                  </p>
                  
                  {!isCompleted && (
                    <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-300">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-32">
      {view === 'dashboard' && renderDashboard()}
      {view === 'browser' && renderBrowser()}
      
      {view === 'loading' && (
        <div className="flex flex-col items-center justify-center min-h-screen space-y-12 px-8 animate-fadeIn">
          <div className="relative">
            <div className="w-40 h-40 border-[14px] border-indigo-50 rounded-full"></div>
            <div className="absolute top-0 left-0 w-40 h-40 border-[14px] border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center scale-125">
              <Logo />
            </div>
          </div>
          <div className="text-center space-y-4">
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Préparation Stylistique</h3>
            <p className="text-slate-400 font-serif italic text-xl max-w-md mx-auto">L'IA prépare votre session de dictée et la voix du professeur...</p>
          </div>
        </div>
      )}

      {view === 'dictation' && currentDictation && (
        <DictationView 
          dictation={currentDictation} 
          onFinish={handleDictationFinish}
          onCancel={() => setView('browser')}
        />
      )}

      {view === 'results' && currentResult && (
        <EvaluationView 
          result={currentResult} 
          userText={submittedText}
          onSelfCorrect={handleSelfCorrect}
          onNewDictation={() => setView('browser')}
        />
      )}
    </div>
  );
};

export default App;
