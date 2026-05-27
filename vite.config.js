import { existsSync, readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import { sveltekit } from '@sveltejs/kit/vite'

const https = existsSync('./dev_ssl.json')
  ? JSON.parse(readFileSync('./dev_ssl.json', 'utf8')).https
  : undefined

// Only opus-mt needs these, and only on Safari: Hugging Face weight files
// 302-redirect to a second origin, and Safari rejects that redirect from inside
// a Worker while same-repo JSON loads fine. `credentialless` loads cross-origin
// subresources without credentials and without requiring CORP.
//
// Vite's `server.headers` does not cover SvelteKit's HTML response, so this has
// to be middleware, on dev and preview alike. Hosts that cannot set these
// (GitHub Pages) lose only the opus-mt tier; the built-in Translator API needs
// no download and is unaffected.
/**
 * @param {{ middlewares: { use: (fn: any) => void } }} server
 */
const useIsolationHeaders = (server) => {
  server.middlewares.use((/** @type {any} */ _req, /** @type {any} */ res, /** @type {any} */ next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
    next()
  })
}

const crossOriginIsolation = {
  name: 'cross-origin-isolation',
  configureServer: useIsolationHeaders,
  configurePreviewServer: useIsolationHeaders
}

export default defineConfig({
  plugins: [
    crossOriginIsolation,
    tailwindcss(),
    sveltekit()
  ],

  // Transformers.js ships its own ESM + onnxruntime-web assets; let Vite serve
  // it as-is instead of pre-bundling, which breaks the worker's asset resolution.
  optimizeDeps: {
    exclude: ['@huggingface/transformers']
  },

  worker: {
    format: 'es'
  },

  preview: {
    https
  },

  server: {
    https,
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/build/**',
        '**/.svelte-kit/**',
        '**/.git/**'
      ]
    }
  },

  test: {
    expect: { requireAssertions: true },
    environment: 'node',
    include: ['src/**/*.{test,spec}.js']
  }
})
