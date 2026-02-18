
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Artifact {
  id: string;
  type: 'html' | 'image' | 'video' | 'text' | 'error';
  title: string;
  content: string; // HTML code, Image Base64/URL, Video URL, or Text Markdown
  metadata?: {
      groundingChunks?: any[];
      usageMetadata?: any;
      model?: string;
  };
  status: 'streaming' | 'complete' | 'error' | 'waiting';
}

export interface Session {
    id: string;
    prompt: string;
    timestamp: number;
    artifacts: Artifact[];
}

export interface ComponentVariation { name: string; html: string; }
export interface LayoutOption { name: string; css: string; previewHtml: string; }
