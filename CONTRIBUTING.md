# 🤝 Contributing to Flash UI Studio

Thank you for helping build the future of professional UI generation. Please adhere to the following standards.

## 🎨 Visual Standards
- All new UI elements must follow the **Zinc/Slate** professional palette.
- Use **Inter** for UI copy and **JetBrains Mono** for code blocks.
- Maintain **1px border** consistency.
- Ensure all hover states use the standard `ease-out-expo` transition.

## 💻 Coding Guidelines
- **React:** Use functional components and the `useCallback`/`useMemo` hooks for performance-critical logic.
- **Types:** Every new feature must have corresponding interfaces in `types.ts`.
- **CSS:** Avoid utility-class bloat. Prefer semantic class names within `index.css` to maintain the Studio's refined aesthetic.
- **Gemini API:** Always use streaming responses (`generateContentStream`) for artifact generation to ensure the "live drafting" experience.

## 🛠 Feature Checklist
Before submitting a new feature, ensure:
1. [ ] State is persisted correctly via `localStorage`.
2. [ ] The UI is responsive down to 320px width.
3. [ ] All icons are sourced from the standard `Icons.tsx` library.
4. [ ] The feature is documented in `USER_GUIDE.md`.

## 🚀 Deployment
Flash UI Studio is designed as a standalone PWA. Ensure the `manifest.json` is updated if any branding or entry-point changes occur.
