// Edge Function: SPA Fallback Handler
// Handles all routes that don't match static files or API routes

const STATIC_EXTENSIONS = ['.js', '.css', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
const API_PREFIXES = ['/v1/', '/send/', '/api/'];
const STATIC_PREFIXES = ['/_nuxt/', '/js/'];

function shouldServeSPA(pathname) {
  // Skip API routes
  for (const prefix of API_PREFIXES) {
    if (pathname.startsWith(prefix)) return false;
  }
  
  // Skip static assets
  for (const prefix of STATIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return false;
  }
  
  // Skip files with static extensions
  const ext = pathname.substring(pathname.lastIndexOf('.'));
  if (STATIC_EXTENSIONS.includes(ext)) return false;
  
  return true;
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Check if this should serve SPA
  if (shouldServeSPA(pathname)) {
    // Fetch index.html
    const indexUrl = new URL('/index.html', url.origin);
    const response = await fetch(indexUrl);
    
    if (response.ok) {
      // Return index.html for SPA routing
      return new Response(response.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }
  }
  
  // Pass through to default handling
  return fetch(request);
}
