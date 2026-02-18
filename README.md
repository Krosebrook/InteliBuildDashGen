
# 🧠 AIaaS Architect

**AIaaS Architect** is a specialized generative engine for building infrastructure components for Artificial Intelligence as a Service platforms. It leverages Gemini 3 Flash to generate high-fidelity, interactive configurations for Agents, MCP Tools, RAG Pipelines, and Guardrails.

## 🤖 Capabilities
- **Agent Swarms:** Generate UIs for managing autonomous employees, assigning skills, and monitoring memory usage.
- **MCP Registries:** Build Model Context Protocol tool catalogs with connection health and latency metrics.
- **Guardrails:** Create safety dashboards for PII masking, jailbreak detection, and topic blocking.
- **Token Economics:** Visualize cost-per-token, budget forecasting, and rate-limiting rules.
- **Vector Ops:** Monitor RAG vector database indexing, shard health, and embedding dimensions.

## 🛠 Tech Stack
- **Engine:** Google Gemini 3 Flash (via `@google/genai`)
- **Frontend:** React 19 + TypeScript
- **Styling:** "DevTools" Aesthetic (Monospace/Inter mix, Cyan/Teal accents)
- **State:** LocalStorage persistence for system log history.

## 🛡 Error Handling

The application utilizes centralized middleware to manage routing errors and exceptions gracefully.

### Middleware Overview
- **404 Catch-All:** The `notFoundHandler` intercepts any request that does not match a defined route and returns a standardized JSON 404 response.
- **Global Error Handler:** The `errorHandler` sits at the end of the middleware stack. It catches exceptions propagated via `next(err)`, logs the stack trace, and sanitizes the response to the client.

## 🚀 Getting Started
1. **Enter a System Prompt:** e.g., "Multi-Agent Orchestrator for Customer Support" or "LLM Guardrail Configuration Panel".
2. **Review Paradigms:** The system generates 3 architectural views (e.g., Graph View, Data Grid, Control Plane).
3. **Export Code:** One-click export of vanilla JS/HTML components ready for integration.

---
*Powered by Google Gemini 3 Flash*
