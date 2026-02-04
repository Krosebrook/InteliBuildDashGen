/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// High-Fidelity Studio Refactor by ammaar@google.com

import { GoogleGenAI } from '@google/genai';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

import { Artifact, Session, ComponentVariation } from './types';
import { INITIAL_PLACEHOLDERS } from './constants';
import { generateId } from './utils';

import DottedGlowBackground from './components/DottedGlowBackground';
import ArtifactCard from './components/ArtifactCard';
import SideDrawer from './components/SideDrawer';
import { 
    ThinkingIcon, 
    CodeIcon, 
    SparklesIcon, 
    ArrowLeftIcon, 
    ArrowRightIcon, 
    ArrowUpIcon, 
    GridIcon 
} from './components/Icons';

const STORAGE_KEY = 'dash_studio_sessions_v2';

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(-1);
  const [focusedArtifactIndex, setFocusedArtifactIndex] = useState<number | null>(null);
  
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholders, setPlaceholders] = useState<string[]>(INITIAL_PLACEHOLDERS);
  
  const [drawerState, setDrawerState] = useState<{
      isOpen: boolean;
      mode: 'code' | 'variations' | 'history' | null;
      title: string;
      data: any; 
  }>({ isOpen: false, mode: null, title: '', data: null });

  const [componentVariations, setComponentVariations] = useState<ComponentVariation[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);

  // Hydrate sessions
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          setCurrentSessionIndex(parsed.length - 1);
        }
      } catch (e) {
        console.error("Failed to hydrate sessions", e);
      }
    }
  }, []);

  // Persist sessions
  useEffect(() => {
    if (sessions.length > 0) {
      const sessionsToSave = sessions.map(s => ({
        ...s,
        artifacts: s.artifacts.map(a => ({
          ...a,
          html: a.status === 'streaming' ? '' : a.html 
        }))
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionsToSave));
    }
  }, [sessions]);

  useEffect(() => {
      inputRef.current?.focus();
  }, []);

  useEffect(() => {
      const interval = setInterval(() => {
          setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
      }, 5000);
      return () => clearInterval(interval);
  }, [placeholders.length]);

  // Command generation for placeholders
  useEffect(() => {
      const fetchDynamicPlaceholders = async () => {
          try {
              const apiKey = process.env.API_KEY;
              if (!apiKey) return;
              const ai = new GoogleGenAI({ apiKey });
              const response = await ai.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: { 
                      role: 'user', 
                      parts: [{ 
                          text: 'Suggest 10 ultra-modern, high-fidelity UI component prompts for enterprise-grade SaaS apps. Think beyond basic dashboards. Use sophisticated language (e.g., "Predictive drift observability grid", "Context-aware HITL arbitration terminal"). Return ONLY a raw JSON array of strings.' 
                      }] 
                  }
              });
              const text = response.text || '[]';
              const jsonMatch = text.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                  const newPlaceholders = JSON.parse(jsonMatch[0]);
                  if (Array.isArray(newPlaceholders) && newPlaceholders.length > 0) {
                      setPlaceholders(prev => [...prev, ...newPlaceholders]);
                  }
              }
          } catch (e) {
              console.warn("Background placeholder sync failed", e);
          }
      };
      setTimeout(fetchDynamicPlaceholders, 1500);
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleSendMessage = useCallback(async (manualPrompt?: string) => {
    const promptToUse = manualPrompt || inputValue;
    const trimmedInput = promptToUse.trim();
    
    if (!trimmedInput || isLoading) return;
    if (!manualPrompt) setInputValue('');

    setIsLoading(true);
    const sessionId = generateId();

    const placeholderArtifacts: Artifact[] = Array(3).fill(null).map((_, i) => ({
        id: `${sessionId}_${i}`,
        styleName: 'Drafting Concept...',
        html: '',
        status: 'streaming',
    }));

    const newSession: Session = {
        id: sessionId,
        prompt: trimmedInput,
        timestamp: Date.now(),
        artifacts: placeholderArtifacts
    };

    setSessions(prev => [...prev, newSession]);
    setCurrentSessionIndex(sessions.length); 
    setFocusedArtifactIndex(null); 

    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) throw new Error("API_KEY missing");
        const ai = new GoogleGenAI({ apiKey });

        const styleResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { role: 'user', parts: [{ text: `Generate 3 distinct studio design directions for: "${trimmedInput}". Focus on information density and visual hierarchy. Return raw JSON array of 3 names.` }] }
        });

        let generatedStyles: string[] = ["Default Frame", "Analytical View", "Command Center"];
        const jsonMatch = (styleResponse.text || '').match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            try { generatedStyles = JSON.parse(jsonMatch[0]).slice(0, 3); } catch (e) {}
        }

        setSessions(prev => prev.map(s => s.id === sessionId ? {
            ...s,
            artifacts: s.artifacts.map((art, i) => ({ ...art, styleName: generatedStyles[i] }))
        } : s));

        const generateArtifact = async (artifact: Artifact, style: string) => {
            try {
                const prompt = `
You are Flash UI Studio, an elite Senior UI/UX Engineer.
Create a high-fidelity, production-grade enterprise UI for: "${trimmedInput}".
STYLE DIRECTION: ${style}

REQUIREMENTS:
1. Deep-space aesthetics (slate/zinc palette), Inter typography, 1px subtle borders.
2. Fully interactive components with complex state management (use pure JS in script tags).
3. If applicable, implement Rule Builders, Multi-model Comparison tables, or Real-time Telemetry.
4. Professional data visualizations using hand-crafted SVG/CSS.
5. PII Masking: Ensure sensitive info like emails or IPs are masked.

Return ONLY RAW HTML/CSS/JS. No markdown.
                `.trim();
          
                const responseStream = await ai.models.generateContentStream({
                    model: 'gemini-3-flash-preview',
                    contents: [{ parts: [{ text: prompt }], role: "user" }],
                });

                let accumulatedHtml = '';
                for await (const chunk of responseStream) {
                    if (typeof chunk.text === 'string') {
                        accumulatedHtml += chunk.text;
                        setSessions(prev => prev.map(sess => sess.id === sessionId ? {
                            ...sess,
                            artifacts: sess.artifacts.map(art => art.id === artifact.id ? { ...art, html: accumulatedHtml } : art)
                        } : sess));
                    }
                }
                
                let finalHtml = accumulatedHtml.trim();
                if (finalHtml.startsWith('```html')) finalHtml = finalHtml.substring(7).trimStart();
                if (finalHtml.startsWith('```')) finalHtml = finalHtml.substring(3).trimStart();
                if (finalHtml.endsWith('```')) finalHtml = finalHtml.substring(0, finalHtml.length - 3).trimEnd();

                setSessions(prev => prev.map(sess => sess.id === sessionId ? {
                    ...sess,
                    artifacts: sess.artifacts.map(art => art.id === artifact.id ? { ...art, html: finalHtml, status: 'complete' } : art)
                } : sess));

            } catch (e: any) {
                setSessions(prev => prev.map(sess => sess.id === sessionId ? {
                    ...sess,
                    artifacts: sess.artifacts.map(art => art.id === artifact.id ? { ...art, html: `Error: ${e.message}`, status: 'error' } : art)
                } : sess));
            }
        };

        await Promise.all(placeholderArtifacts.map((art, i) => generateArtifact(art, generatedStyles[i])));

    } catch (e) {
        console.error("Fatal Generation Error", e);
    } finally {
        setIsLoading(false);
    }
  }, [inputValue, isLoading, sessions.length]);

  const handleSurpriseMe = () => {
      const p = placeholders[Math.floor(Math.random() * placeholders.length)];
      setInputValue(p);
      handleSendMessage(p);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isLoading) handleSendMessage();
  };

  const hasStarted = sessions.length > 0 || isLoading;
  const currentSession = sessions[currentSessionIndex];

  return (
    <>
        <div className="studio-top-bar">
            <div className="studio-logo" onClick={() => window.location.reload()}>
                <div className="logo-mark" />
                Flash UI <span className="logo-badge">Professional</span>
            </div>
            <div className="studio-actions">
                <button className="nav-btn" onClick={() => setDrawerState({ isOpen: true, mode: 'history', title: 'Workbench History', data: null })}>
                    History
                </button>
            </div>
        </div>

        <SideDrawer 
            isOpen={drawerState.isOpen} 
            onClose={() => setDrawerState(s => ({...s, isOpen: false}))} 
            title={drawerState.title}
        >
            {drawerState.mode === 'code' && (
                <pre className="code-block"><code>{drawerState.data}</code></pre>
            )}
            
            {drawerState.mode === 'history' && (
                <div className="history-list">
                    {sessions.slice().reverse().map((sess) => (
                        <div key={sess.id} className="history-item" onClick={() => {
                            setCurrentSessionIndex(sessions.findIndex(s => s.id === sess.id));
                            setDrawerState(s => ({...s, isOpen: false}));
                            setFocusedArtifactIndex(null);
                        }}>
                            <div className="history-prompt">{sess.prompt}</div>
                            <div className="history-meta">{new Date(sess.timestamp).toLocaleString()}</div>
                        </div>
                    ))}
                    {sessions.length === 0 && <p style={{color: 'var(--text-muted)'}}>No history yet.</p>}
                </div>
            )}
        </SideDrawer>

        <div className="immersive-app">
            <DottedGlowBackground 
                gap={40} 
                radius={1} 
                color="rgba(255, 255, 255, 0.01)" 
                glowColor="rgba(255, 255, 255, 0.08)" 
                speedScale={0.2} 
            />

            <div className={`stage-container ${focusedArtifactIndex !== null ? 'mode-focus' : 'mode-split'}`}>
                 <div className={`empty-state ${hasStarted ? 'fade-out' : ''}`}>
                     <h1>Build with Intelligence.</h1>
                     <p>Generate high-fidelity, interactive enterprise dashboards and specialized UI components instantly.</p>
                     <button className="surprise-button" onClick={handleSurpriseMe} disabled={isLoading}>
                         <SparklesIcon /> Surprise Me
                     </button>
                 </div>

                {sessions.map((session, sIndex) => {
                    let positionClass = 'hidden';
                    if (sIndex === currentSessionIndex) positionClass = 'active-session';
                    else if (sIndex < currentSessionIndex) positionClass = 'past-session';
                    else if (sIndex > currentSessionIndex) positionClass = 'future-session';
                    
                    return (
                        <div key={session.id} className={`session-group ${positionClass}`}>
                            <div className="artifact-grid" ref={sIndex === currentSessionIndex ? gridScrollRef : null}>
                                {session.artifacts.map((artifact, aIndex) => (
                                    <ArtifactCard 
                                        key={artifact.id}
                                        artifact={artifact}
                                        isFocused={focusedArtifactIndex === aIndex}
                                        onClick={() => setFocusedArtifactIndex(aIndex)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {hasStarted && currentSessionIndex > 0 && (
                <button className="nav-handle left" onClick={() => setCurrentSessionIndex(prev => prev - 1)}>
                    <ArrowLeftIcon />
                </button>
            )}
            {hasStarted && currentSessionIndex < sessions.length - 1 && (
                <button className="nav-handle right" onClick={() => setCurrentSessionIndex(prev => prev + 1)}>
                    <ArrowRightIcon />
                </button>
            )}

            <div className={`action-bar ${focusedArtifactIndex !== null ? 'visible' : ''}`}>
                 <div className="action-buttons">
                    <button onClick={() => setFocusedArtifactIndex(null)}>
                        <GridIcon /> Exit Focus
                    </button>
                    <button onClick={() => setDrawerState({ isOpen: true, mode: 'code', title: 'Export Source', data: currentSession.artifacts[focusedArtifactIndex || 0].html })}>
                        <CodeIcon /> Export Code
                    </button>
                 </div>
            </div>

            <div className="floating-input-container">
                <div className={`studio-input ${isLoading ? 'loading' : ''}`}>
                    {!isLoading ? (
                        <input 
                            ref={inputRef}
                            type="text" 
                            placeholder={placeholders[placeholderIndex]}
                            value={inputValue} 
                            onChange={handleInputChange} 
                            onKeyDown={handleKeyDown} 
                        />
                    ) : (
                        <div className="input-generating-label" style={{ flex: 1, padding: '12px 20px', color: 'var(--text-muted)' }}>
                            Drafting unique interface concepts...
                        </div>
                    )}
                    <button className="send-button" onClick={() => handleSendMessage()} disabled={isLoading || !inputValue.trim()}>
                        {isLoading ? <ThinkingIcon /> : <ArrowUpIcon />}
                    </button>
                </div>
            </div>
        </div>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
