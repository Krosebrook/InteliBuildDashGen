/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Flash UI Studio - Multimodal Workbench
// Refactor by ammaar@google.com

import { GoogleGenAI } from '@google/genai';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

import { Artifact, Session } from './types';
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
    GridIcon,
    AttachmentIcon,
    CloseIcon
} from './components/Icons';

const STORAGE_KEY = 'flash_ui_sessions_v3';

// Extend Window interface for Veo key selection
declare global {
  interface AIStudio {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
  }
}

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(-1);
  const [focusedArtifactIndex, setFocusedArtifactIndex] = useState<number | null>(null);
  
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<{data: string, mimeType: string} | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  
  // New State for Image Gen Config
  const [imgGenSize, setImgGenSize] = useState<'1K' | '2K' | '4K'>('1K');
  
  const [drawerState, setDrawerState] = useState<{
      isOpen: boolean;
      mode: 'code' | 'variations' | 'history' | null;
      title: string;
      data: any; 
  }>({ isOpen: false, mode: null, title: '', data: null });

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
          // Don't persist partial streams, only completed content
          content: a.status === 'streaming' ? '' : a.content 
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
          setPlaceholderIndex(prev => (prev + 1) % INITIAL_PLACEHOLDERS.length);
      }, 6000);
      return () => clearInterval(interval);
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
          const base64 = (e.target?.result as string).split(',')[1];
          setSelectedFile({
              data: base64,
              mimeType: file.type
          });
      };
      reader.readAsDataURL(file);
  };

  const determineIntent = (text: string, hasFile: boolean) => {
      const t = text.toLowerCase();
      
      // Video Generation (Veo)
      if (t.includes('video') || t.includes('animate') || t.includes('movie')) return 'VIDEO_GEN';

      // Image Editing (Nano Banana)
      if (hasFile && (t.includes('add') || t.includes('remove') || t.includes('change') || t.includes('edit') || t.includes('filter'))) return 'IMAGE_EDIT';

      // Analysis (Pro)
      if (hasFile && (t.includes('analyze') || t.includes('describe') || t.includes('what is') || t.includes('scan'))) return 'ANALYZE';
      
      // Image Generation (Imagen/Pro Image)
      if (t.includes('image') || t.includes('picture') || t.includes('photo') || t.includes('generate')) return 'IMAGE_GEN';

      // Maps Grounding
      if (t.includes('map') || t.includes('location') || t.includes('where') || t.includes('nearby') || t.includes('direction')) return 'MAPS';

      // Search Grounding
      if (t.includes('search') || t.includes('find') || t.includes('news') || t.includes('latest') || t.includes('who') || t.includes('when')) return 'SEARCH';

      // Default to UI Gen or Chat
      if (t.includes('ui') || t.includes('component') || t.includes('dashboard')) return 'UI_GEN';
      
      return 'CHAT';
  };

  const handleSendMessage = useCallback(async (manualPrompt?: string) => {
    const promptToUse = manualPrompt || inputValue;
    const trimmedInput = promptToUse.trim();
    
    if (!trimmedInput || isLoading) return;
    if (!manualPrompt) setInputValue('');

    setIsLoading(true);
    const sessionId = generateId();
    const intent = determineIntent(trimmedInput, !!selectedFile);

    // Initial Artifact State
    const initialArtifacts: Artifact[] = [{
        id: `${sessionId}_0`,
        type: 'text',
        title: intent === 'UI_GEN' ? 'Architecting...' : 'Thinking...',
        content: '',
        status: 'streaming'
    }];

    const newSession: Session = {
        id: sessionId,
        prompt: trimmedInput,
        timestamp: Date.now(),
        artifacts: initialArtifacts
    };

    setSessions(prev => [...prev, newSession]);
    setCurrentSessionIndex(sessions.length); 
    setFocusedArtifactIndex(null); 

    try {
        let ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        let updateFn = (content: string, status: Artifact['status'], type: Artifact['type'] = 'text', metadata?: any) => {
            setSessions(prev => prev.map(s => s.id === sessionId ? {
                ...s,
                artifacts: s.artifacts.map((a, i) => i === 0 ? { ...a, content, status, type, metadata } : a)
            } : s));
        };

        // --- VIDEO GENERATION (Veo) ---
        if (intent === 'VIDEO_GEN') {
            updateFn('', 'waiting', 'video', { model: 'Veo 3.1' });
            
            // Mandatory Key Selection
            if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
                await window.aistudio.openSelectKey();
                // Re-init AI with potentially new key context (although env key is injected)
                ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            }

            const videoConfig: any = {
                numberOfVideos: 1,
                resolution: '720p', // 1080p is slower, using 720p for preview speed
                aspectRatio: '16:9'
            };

            let operation;
            if (selectedFile) {
                // Image-to-Video
                operation = await ai.models.generateVideos({
                    model: 'veo-3.1-fast-generate-preview',
                    prompt: trimmedInput,
                    image: { imageBytes: selectedFile.data, mimeType: selectedFile.mimeType },
                    config: videoConfig
                });
            } else {
                // Text-to-Video
                operation = await ai.models.generateVideos({
                    model: 'veo-3.1-fast-generate-preview',
                    prompt: trimmedInput,
                    config: videoConfig
                });
            }

            // Poll for completion
            while (!operation.done) {
                await new Promise(r => setTimeout(r, 5000));
                operation = await ai.operations.getVideosOperation({operation});
            }

            const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (videoUri) {
                // Fetch valid temporary URL with key
                const finalUrl = `${videoUri}&key=${process.env.API_KEY}`;
                updateFn(finalUrl, 'complete', 'video', { model: 'Veo 3.1' });
            } else {
                throw new Error("Video generation failed to return a URI.");
            }
        } 
        
        // --- IMAGE EDITING (Nano Banana) ---
        else if (intent === 'IMAGE_EDIT') {
             updateFn('', 'waiting', 'image', { model: 'Gemini 2.5 Flash Image' });
             if (!selectedFile) throw new Error("Image required for editing.");

             const response = await ai.models.generateContent({
                 model: 'gemini-2.5-flash-image',
                 contents: {
                     parts: [
                         { inlineData: { data: selectedFile.data, mimeType: selectedFile.mimeType } },
                         { text: trimmedInput }
                     ]
                 }
             });

             let foundImage = false;
             for (const part of response.candidates?.[0]?.content?.parts || []) {
                 if (part.inlineData) {
                     const base64 = part.inlineData.data;
                     const url = `data:image/png;base64,${base64}`;
                     updateFn(url, 'complete', 'image', { model: 'Gemini 2.5 Flash Image' });
                     foundImage = true;
                     break;
                 }
             }
             if (!foundImage) throw new Error("No image returned from edit request.");
        }

        // --- IMAGE GENERATION (Pro Image) ---
        else if (intent === 'IMAGE_GEN') {
            updateFn('', 'waiting', 'image', { model: 'Gemini 3 Pro Image' });

            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-image-preview',
                contents: { parts: [{ text: trimmedInput }] },
                config: {
                    imageConfig: {
                        imageSize: imgGenSize,
                        aspectRatio: '1:1'
                    }
                }
            });

            let foundImage = false;
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                 if (part.inlineData) {
                     const base64 = part.inlineData.data;
                     const url = `data:image/png;base64,${base64}`;
                     updateFn(url, 'complete', 'image', { model: 'Gemini 3 Pro Image' });
                     foundImage = true;
                     break;
                 }
             }
             if (!foundImage) throw new Error("No image generated.");
        }

        // --- ANALYSIS / MULTIMODAL CHAT (Pro) ---
        else if (intent === 'ANALYZE' || (selectedFile && intent === 'CHAT')) {
            updateFn('', 'streaming', 'text', { model: 'Gemini 3 Pro' });
            
            const parts: any[] = [{ text: trimmedInput }];
            if (selectedFile) {
                parts.unshift({ inlineData: { data: selectedFile.data, mimeType: selectedFile.mimeType } });
            }

            const stream = await ai.models.generateContentStream({
                model: 'gemini-3-pro-preview',
                contents: { parts }
            });

            let fullText = '';
            for await (const chunk of stream) {
                fullText += chunk.text;
                updateFn(fullText, 'streaming', 'text', { model: 'Gemini 3 Pro' });
            }
            updateFn(fullText, 'complete', 'text', { model: 'Gemini 3 Pro' });
        }

        // --- MAPS GROUNDING (Flash 2.5) ---
        else if (intent === 'MAPS') {
             updateFn('', 'streaming', 'text', { model: 'Gemini 2.5 Flash' });
             
             // Get simple location if possible (mocked for now as per instructions "where relevant")
             // In real app, we would use navigator.geolocation
             const stream = await ai.models.generateContentStream({
                model: 'gemini-2.5-flash',
                contents: trimmedInput,
                config: {
                    tools: [{ googleMaps: {} }]
                }
            });

            let fullText = '';
            let groundingMetadata;
            for await (const chunk of stream) {
                fullText += chunk.text;
                if (chunk.candidates?.[0]?.groundingMetadata) {
                    groundingMetadata = chunk.candidates[0].groundingMetadata;
                }
                updateFn(fullText, 'streaming', 'text', { model: 'Gemini 2.5 Flash', groundingChunks: groundingMetadata?.groundingChunks });
            }
            updateFn(fullText, 'complete', 'text', { model: 'Gemini 2.5 Flash', groundingChunks: groundingMetadata?.groundingChunks });
        }

        // --- SEARCH GROUNDING (Flash 3) ---
        else if (intent === 'SEARCH') {
            updateFn('', 'streaming', 'text', { model: 'Gemini 3 Flash' });
            
            const stream = await ai.models.generateContentStream({
                model: 'gemini-3-flash-preview',
                contents: trimmedInput,
                config: {
                    tools: [{ googleSearch: {} }]
                }
            });

            let fullText = '';
            let groundingMetadata;
            for await (const chunk of stream) {
                fullText += chunk.text;
                if (chunk.candidates?.[0]?.groundingMetadata) {
                    groundingMetadata = chunk.candidates[0].groundingMetadata;
                }
                updateFn(fullText, 'streaming', 'text', { model: 'Gemini 3 Flash', groundingChunks: groundingMetadata?.groundingChunks });
            }
            updateFn(fullText, 'complete', 'text', { model: 'Gemini 3 Flash', groundingChunks: groundingMetadata?.groundingChunks });
        }

        // --- UI GENERATION (Original Logic - Simplified) ---
        else if (intent === 'UI_GEN') {
            updateFn('', 'streaming', 'html', { model: 'Gemini 3 Flash' });
            const prompt = `Create a production-grade, interactive React-style (Vanilla JS) component for: "${trimmedInput}". Use dark mode, responsive design, and mock data. Return ONLY RAW HTML.`;
            const stream = await ai.models.generateContentStream({
                model: 'gemini-3-flash-preview',
                contents: prompt
            });
            let fullHtml = '';
            for await (const chunk of stream) {
                fullHtml += chunk.text;
                updateFn(fullHtml, 'streaming', 'html', { model: 'Gemini 3 Flash' });
            }
            // Cleanup HTML code block
            let cleanHtml = fullHtml.trim();
            if (cleanHtml.startsWith('```html')) cleanHtml = cleanHtml.substring(7).trimStart();
            if (cleanHtml.startsWith('```')) cleanHtml = cleanHtml.substring(3).trimStart();
            if (cleanHtml.endsWith('```')) cleanHtml = cleanHtml.substring(0, cleanHtml.length - 3).trimEnd();
            updateFn(cleanHtml, 'complete', 'html', { model: 'Gemini 3 Flash' });
        }

        // --- FAST CHAT (Flash Lite) ---
        else {
             updateFn('', 'streaming', 'text', { model: 'Gemini 2.5 Flash Lite' });
             const stream = await ai.models.generateContentStream({
                model: 'gemini-2.5-flash-lite-latest', // Using latest alias
                contents: trimmedInput
            });
            let fullText = '';
            for await (const chunk of stream) {
                fullText += chunk.text;
                updateFn(fullText, 'streaming', 'text', { model: 'Gemini 2.5 Flash Lite' });
            }
            updateFn(fullText, 'complete', 'text', { model: 'Gemini 2.5 Flash Lite' });
        }

        // Reset file after send
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (e: any) {
        console.error("GenAI Error", e);
        setSessions(prev => prev.map(s => s.id === sessionId ? {
            ...s,
            artifacts: s.artifacts.map(a => ({ ...a, status: 'error', content: e.message || "Generation Failed", type: 'error' }))
        } : s));
    } finally {
        setIsLoading(false);
    }
  }, [inputValue, isLoading, sessions.length, selectedFile, imgGenSize]);

  const handleSurpriseMe = () => {
      const p = INITIAL_PLACEHOLDERS[Math.floor(Math.random() * INITIAL_PLACEHOLDERS.length)];
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
                Flash UI <span className="logo-badge">Studio</span>
            </div>
            <div className="studio-actions">
                <button 
                    className="nav-btn" 
                    onClick={() => setDrawerState({ isOpen: true, mode: 'history', title: 'Session History', data: null })}
                    aria-label="View Session History"
                >
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
                    {sessions.length === 0 && <p style={{color: 'var(--text-muted)'}}>No sessions yet.</p>}
                </div>
            )}
        </SideDrawer>

        <div className="immersive-app">
            <DottedGlowBackground 
                gap={40} 
                radius={1} 
                color="rgba(100, 255, 218, 0.03)" 
                glowColor="rgba(100, 255, 218, 0.15)" 
                speedScale={0.2} 
            />

            <div className={`stage-container ${focusedArtifactIndex !== null ? 'mode-focus' : 'mode-split'}`}>
                 <div className={`empty-state ${hasStarted ? 'fade-out' : ''}`}>
                     <h1>Build. Analyze. Create.</h1>
                     <p>Multimodal AI Workbench powered by Gemini 3 & Veo.</p>
                     <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                         <button className="surprise-button" onClick={handleSurpriseMe} disabled={isLoading}>
                             <SparklesIcon /> Random Idea
                         </button>
                     </div>
                 </div>

                {sessions.map((session, sIndex) => {
                    let positionClass = 'hidden';
                    if (sIndex === currentSessionIndex) positionClass = 'active-session';
                    else if (sIndex < currentSessionIndex) positionClass = 'past-session';
                    else if (sIndex > currentSessionIndex) positionClass = 'future-session';
                    
                    return (
                        <div key={session.id} className={`session-group ${positionClass}`}>
                            <div className="artifact-grid" style={{ gridTemplateColumns: '1fr' }} ref={sIndex === currentSessionIndex ? gridScrollRef : null}>
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
                <button className="nav-handle left" onClick={() => setCurrentSessionIndex(prev => prev - 1)} aria-label="Previous">
                    <ArrowLeftIcon />
                </button>
            )}
            {hasStarted && currentSessionIndex < sessions.length - 1 && (
                <button className="nav-handle right" onClick={() => setCurrentSessionIndex(prev => prev + 1)} aria-label="Next">
                    <ArrowRightIcon />
                </button>
            )}

            <div className={`action-bar ${focusedArtifactIndex !== null ? 'visible' : ''}`}>
                 <div className="action-buttons">
                    <button onClick={() => setFocusedArtifactIndex(null)}>
                        <GridIcon /> View All
                    </button>
                    {currentSession?.artifacts[0]?.type === 'html' && (
                        <button onClick={() => setDrawerState({ isOpen: true, mode: 'code', title: 'Source Code', data: currentSession.artifacts[focusedArtifactIndex || 0].content })}>
                            <CodeIcon /> Source
                        </button>
                    )}
                 </div>
            </div>

            <div className="floating-input-container">
                <div className={`studio-input ${isLoading ? 'loading' : ''}`}>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileSelect} 
                        style={{ display: 'none' }} 
                        accept="image/*"
                    />
                    
                    <button 
                        className="nav-btn" 
                        style={{ border: 'none', padding: '8px', marginRight: '8px', color: selectedFile ? 'var(--accent)' : 'var(--text-muted)' }}
                        onClick={() => selectedFile ? setSelectedFile(null) : fileInputRef.current?.click()}
                        title="Attach Image"
                    >
                         {selectedFile ? <CloseIcon /> : <AttachmentIcon />}
                    </button>

                    {!isLoading ? (
                        <input 
                            ref={inputRef}
                            type="text" 
                            placeholder={selectedFile ? "Analyze, Edit, or Animate this image..." : INITIAL_PLACEHOLDERS[placeholderIndex]}
                            value={inputValue} 
                            onChange={handleInputChange} 
                            onKeyDown={handleKeyDown} 
                            aria-label="Prompt Input"
                        />
                    ) : (
                        <div className="input-generating-label" style={{ flex: 1, padding: '12px 20px', color: 'var(--text-muted)' }}>
                            Processing Request...
                        </div>
                    )}

                    {/* Image Size Selector (Only visible if intent likely image gen) */}
                    {inputValue.toLowerCase().includes('image') && !selectedFile && !isLoading && (
                        <select 
                            value={imgGenSize} 
                            onChange={(e) => setImgGenSize(e.target.value as any)}
                            style={{ background: 'transparent', color: 'var(--accent)', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '4px', fontSize: '0.75rem', marginRight: '8px', outline: 'none' }}
                        >
                            <option value="1K">1K</option>
                            <option value="2K">2K</option>
                            <option value="4K">4K</option>
                        </select>
                    )}

                    <button 
                        className="send-button" 
                        onClick={() => handleSendMessage()} 
                        disabled={isLoading || !inputValue.trim()}
                    >
                        {isLoading ? <ThinkingIcon /> : <ArrowUpIcon />}
                    </button>
                </div>
                {selectedFile && (
                    <div style={{ position: 'absolute', top: '-40px', left: '20px', background: '#222', padding: '4px 10px', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Image Attached</span>
                        <span style={{ fontSize: '0.7rem', color: '#888' }}>({(selectedFile.data.length / 1024).toFixed(0)}KB)</span>
                    </div>
                )}
            </div>
        </div>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);