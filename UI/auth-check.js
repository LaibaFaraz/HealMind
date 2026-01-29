import { auth, onAuthStateChanged } from './auth.js';

// Check if user is logged in
onAuthStateChanged(auth, (user) => {
    console.log('Auth state changed:', user ? 'Logged in' : 'Not logged in');
    
    // Get current page
    const currentPath = window.location.pathname;
    
    if (!user) {
        // User is not logged in
        // Only redirect if not already on login or register page
        if (currentPath !== '/login' && currentPath !== '/register') {
            console.log('Redirecting to login...');
            window.location.href = '/login';
        }
    } else {
        // User is logged in
        // If on login or register page, redirect to home
        if (currentPath === '/login' || currentPath === '/register') {
            console.log('Already logged in, redirecting to home...');
            window.location.href = '/';
        }
    }
});