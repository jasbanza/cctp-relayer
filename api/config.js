// Configuration for serverless functions
// These are NOT secrets - they get committed to git

export const ALLOWED_ORIGINS = [
  'https://jasbanza.github.io',       // GitHub Pages
  'https://cctp-relayer.vercel.app',  // Vercel (update with your actual domain)
  // Local development:
  'http://localhost:8000',
  'http://localhost:3000',
  'http://localhost:8080',
];


