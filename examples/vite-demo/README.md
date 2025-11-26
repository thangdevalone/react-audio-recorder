# React Audio Recorder Lite · Vite demo

This playground consumes the library straight from the repository so you can iterate on the hook and the UI at the same time. It showcases:

- live duration/byte metrics
- format switching with capability badges
- pause/resume/reset controls
- inline playback + download links

## Getting started

From the repo root:

```bash
cd examples/vite-demo
npm install
npm run dev
```

Because the example depends on the root package through `file:../..`, installing the demo will run the library `prepare` script (build) so TypeScript definitions stay in sync.

## Other scripts

```bash
npm run build   # type-check and bundle the demo
npm run preview # preview the production build
npm run lint    # eslint flat config
```

Feel free to clone the UI components into your app or use this project as a starting point for documentation screenshots.
