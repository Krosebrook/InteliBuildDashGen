# 🏗 Architecture & Technical Standards

Flash UI Studio follows a "Model-in-the-Loop" architecture, where the LLM is treated as a high-fidelity rendering engine for UI components.

## 🔄 Data Flow
1. **User Input:** Prompt captured via controlled React input.
2. **Direction Phase:** Gemini 3 Flash generates 3 distinct `styleNames` via a JSON response.
3. **Parallel Generation:** 3 separate `generateContentStream` calls are initiated simultaneously to create the artifacts.
4. **State Management:**
   - `sessions`: Array of session objects containing artifacts.
   - `artifacts`: Individual UI units with `streaming` status and `html` payload.
5. **Persistence:** The `useEffect` hook monitors the `sessions` state and serializes it to `localStorage` using a versioned key (`dash_studio_sessions_v2`).

## 🧠 Prompt Engineering Strategy
The Studio uses a **System-First** prompting approach:
- **Constraint-Based:** Prompts strictly forbid Markdown formatting to ensure the output is directly injectable into `srcDoc`.
- **Context Injection:** Depending on the user's intent (detected via keyword analysis), the system instructions dynamically pivot to include specialized requirements like "Security Rule Builders" or "Model Comparison Grids."
- **Materiality Logic:** The prompt instructs the model on "Studio" aesthetics—Zinc/Slate palettes, 1px borders, and Inter typography—to ensure a consistent professional output.

## 📦 Component Isolation
Each artifact is rendered inside a **Sanitized Iframe** using the `srcDoc` attribute. 
- **Sandboxing:** `allow-scripts allow-forms allow-same-origin` ensures the interactive JS within the generated component functions correctly while keeping the main workbench secure.
- **Communication:** Generated components use standard Vanilla JS patterns to manage their internal state, ensuring zero external dependencies are required for the export to work.

## 🎨 Professional Design System
The CSS (in `index.css`) utilizes:
- **Fluid Layouts:** Grid-based spatial hierarchy.
- **Motion Orchestration:** `cubic-bezier(0.16, 1, 0.3, 1)` for all transitions.
- **Adaptive UI:** Responsive breakpoints ensure the Workbench works on tablets and mobile, even if the generated dashboards are density-optimized for desktop.
