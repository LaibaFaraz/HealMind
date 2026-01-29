// Firebase Auth Setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyALG5rqXdMdJLVY3Sm9An4pmCCoflYUn7g",
    authDomain: "healmind-2025.firebaseapp.com",
    projectId: "healmind-2025",
    storageBucket: "healmind-2025.firebasestorage.app",
    messagingSenderId: "815736974240",
    appId: "1:815736974240:web:46d83a46fae313961612c5",
    measurementId: "G-Q113X0VYS2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Show error message
function showError(message) {
    const errorBox = document.getElementById('error-message');
    if (errorBox) {
        errorBox.textContent = message;
        errorBox.classList.remove('hidden');
        
        setTimeout(() => {
            errorBox.classList.add('hidden');
        }, 5000);
    } else {
        alert(message);
    }
}

// Login form
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = document.getElementById('login-btn');
        
        btn.textContent = 'Signing in...';
        btn.disabled = true;
        
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Redirect to home page
            window.location.href = '/';
        } catch (error) {
            console.error('Login error:', error);
            let message = 'Failed to sign in';
            if (error.code === 'auth/invalid-credential') {
                message = 'Invalid email or password';
            } else if (error.code === 'auth/user-not-found') {
                message = 'No account found with this email';
            } else if (error.code === 'auth/wrong-password') {
                message = 'Incorrect password';
            } else if (error.code === 'auth/invalid-email') {
                message = 'Invalid email address';
            } else if (error.code === 'auth/too-many-requests') {
                message = 'Too many failed attempts. Please try again later.';
            }
            showError(message);
            btn.textContent = 'Sign In';
            btn.disabled = false;
        }
    });
}

// Register form
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const btn = document.getElementById('register-btn');
        
        if (password !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }
        
        if (password.length < 6) {
            showError('Password must be at least 6 characters');
            return;
        }
        
        btn.textContent = 'Creating account...';
        btn.disabled = true;
        
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            // Redirect to home page
            window.location.href = '/';
        } catch (error) {
            console.error('Registration error:', error);
            let message = 'Failed to create account';
            if (error.code === 'auth/email-already-in-use') {
                message = 'Email already in use';
            } else if (error.code === 'auth/weak-password') {
                message = 'Password is too weak';
            } else if (error.code === 'auth/invalid-email') {
                message = 'Invalid email address';
            }
            showError(message);
            btn.textContent = 'Create Account';
            btn.disabled = false;
        }
    });
}

// Export auth for other pages
export { auth, onAuthStateChanged, signOut };