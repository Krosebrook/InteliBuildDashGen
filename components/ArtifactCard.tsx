
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef } from 'react';
import { Artifact } from '../types';

interface ArtifactCardProps {
    artifact: Artifact;
    isFocused: boolean;
    onClick: () => void;
}

const ArtifactCard = React.memo(({ 
    artifact, 
    isFocused, 
    onClick 
}: ArtifactCardProps) => {
    const codeRef = useRef<HTMLPreElement>(null);

    // Auto-scroll logic for streaming code preview
    useEffect(() => {
        if (codeRef.current) {
            codeRef.current.scrollTop = codeRef.current.scrollHeight;
        }
    }, [artifact.content]);

    const isStreaming = artifact.status === 'streaming';
    const isWaiting = artifact.status === 'waiting';

    const renderContent = () => {
        if (isWaiting) {
            return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', flexDirection: 'column', gap: '12px' }}>
                   <div className="logo-badge" style={{ animation: 'pulse 2s infinite' }}>Initializing {artifact.metadata?.model || 'Model'}</div>
                </div>
            )
        }

        switch (artifact.type) {
            case 'image':
                return (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                        {artifact.content ? (
                            <img src={artifact.content} alt="Generated" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        ) : (
                            <div className="generating-overlay">Generating Image...</div>
                        )}
                    </div>
                );
            case 'video':
                return (
                     <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                        {artifact.content ? (
                            <video controls src={artifact.content} style={{ maxWidth: '100%', maxHeight: '100%' }} autoPlay loop />
                        ) : (
                            <div className="generating-overlay">
                                <div style={{textAlign: 'center'}}>
                                    <div style={{marginBottom: 10}}>Generating Video...</div>
                                    <div style={{fontSize: '0.8em', color: 'var(--text-muted)'}}>This may take a minute</div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'text':
                return (
                    <div style={{ padding: '24px', overflowY: 'auto', height: '100%', fontFamily: 'var(--font-sans)', lineHeight: '1.6', fontSize: '0.95rem' }}>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{artifact.content}</div>
                        
                        {/* Grounding Chips */}
                        {artifact.metadata?.groundingChunks && artifact.metadata.groundingChunks.length > 0 && (
                            <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sources</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {artifact.metadata.groundingChunks.map((chunk, i) => {
                                        if (chunk.web?.uri) {
                                            return (
                                                <a key={i} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" 
                                                   style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', padding: '4px 10px', borderRadius: '100px', fontSize: '0.75rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {chunk.web.title || 'Web Source'}
                                                </a>
                                            )
                                        }
                                        if (chunk.maps?.placeId) {
                                             return (
                                                <span key={i} 
                                                   style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', padding: '4px 10px', borderRadius: '100px', fontSize: '0.75rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    📍 {chunk.maps.title || 'Map Location'}
                                                </span>
                                            )
                                        }
                                        return null;
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'html':
            default:
                 if (isStreaming && !artifact.content) {
                     return (
                        <div className="generating-overlay">
                            <pre ref={codeRef} className="code-stream-preview">Thinking...</pre>
                        </div>
                     )
                 }
                 if (isStreaming) {
                    return (
                        <div className="generating-overlay">
                            <pre ref={codeRef} className="code-stream-preview">
                                {artifact.content}
                            </pre>
                        </div>
                    )
                 }
                 return (
                    <iframe 
                        srcDoc={artifact.content} 
                        title={artifact.id} 
                        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation allow-same-origin"
                        className="artifact-iframe"
                    />
                );
        }
    };

    return (
        <div 
            className={`artifact-card ${isFocused ? 'focused' : ''} ${isStreaming ? 'generating' : ''}`}
            onClick={onClick}
        >
            <div className="artifact-header">
                <span className="artifact-style-tag">{artifact.title}</span>
                {artifact.status === 'error' && <span className="logo-badge" style={{ borderColor: '#ef4444', color: '#ef4444' }}>Error</span>}
                {isStreaming && <span className="logo-badge" style={{ animation: 'pulse 2s infinite' }}>Working</span>}
                {artifact.type === 'video' && <span className="logo-badge">Veo</span>}
            </div>
            <div className="artifact-card-inner">
                {renderContent()}
            </div>
        </div>
    );
});

export default ArtifactCard;
