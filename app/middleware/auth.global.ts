/**
 * Auth Middleware
 * Feature: frontend-admin-ui
 * 
 * Protects routes that require authentication.
 * Redirects to login page if not authenticated.
 */
import { useAuthStore } from '~/stores/auth';

export default defineNuxtRouteMiddleware((to) => {
  // Skip auth check for login page
  if (to.path === '/login') {
    return;
  }

  // Skip auth check for bind/subscribe result pages (public)
  if (to.path.startsWith('/bind-') || to.path.startsWith('/subscribe-')) {
    return;
  }

  // Only run on client side
  if (import.meta.server) {
    return;
  }

  const auth = useAuthStore();
  
  // Initialize auth from localStorage
  auth.init();

  // Redirect to login if not authenticated
  if (!auth.isLoggedIn) {
    return navigateTo('/login');
  }
});
