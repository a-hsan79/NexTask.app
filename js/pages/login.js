// ===========================
// NEXT TASK — Login Page
// ===========================

import { AuthService } from '../services/auth.js';
import { sanitize, renderIcon } from '../utils/helpers.js';

export function renderLoginPage() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="login-page">
      <div class="login-container">
        <div class="login-card">
          <div class="login-header">
            <div class="login-logo">NT</div>
            <h1>NexTask</h1>
            <p id="login-subtitle">Sign in to your workspace</p>
          </div>

          <div id="login-error" class="login-error"></div>

          <form id="login-form">


            <!-- Email -->
            <div class="form-group">
              <label class="form-label" for="email">Email Address</label>
              <input
                type="email"
                id="email"
                class="form-input"
                placeholder="you@company.com"
                required
                autocomplete="email"
              />
            </div>

            <!-- Password -->
            <div class="form-group">
              <label class="form-label" for="password">Password</label>
              <div class="password-wrapper">
                <input
                  type="password"
                  id="password"
                  class="form-input"
                  placeholder="Enter your password"
                  required
                  minlength="6"
                  autocomplete="current-password"
                />
                <button type="button" class="password-toggle" id="toggle-password" aria-label="Toggle password visibility">
                  ${renderIcon('eye')}
                </button>
              </div>
            </div>

            <button type="submit" class="btn btn-primary" id="submit-btn" style="margin-top: 1rem;">
              <span id="btn-text">Sign In</span>
              <div class="spinner hidden" id="btn-spinner"></div>
            </button>
          </form>
        </div>
      </div>
    </div>
  `;

  initLoginEvents();
}

function initLoginEvents() {
  const form = document.getElementById('login-form');
  const btnText = document.getElementById('btn-text');
  const btnSpinner = document.getElementById('btn-spinner');
  const submitBtn = document.getElementById('submit-btn');
  const errorDiv = document.getElementById('login-error');
  const togglePassword = document.getElementById('toggle-password');
  const passwordInput = document.getElementById('password');

  // Toggle password visibility
  togglePassword.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    togglePassword.innerHTML = isPassword ? renderIcon('eye-off') : renderIcon('eye');
  });

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.classList.remove('show');

    const email = sanitize(document.getElementById('email').value.trim());
    const password = document.getElementById('password').value;

    // Validation
    if (!email || !password) {
      showError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      showError('Password must be at least 6 characters.');
      return;
    }

    // Show loading
    setLoading(true);

    try {
      await AuthService.signIn(email, password);
      // Wait for auth state change to handle redirect, or error
      // Do NOT turn off loading here, let the app redirect.
    } catch (error) {
      console.error('Auth error:', error);
      showError(getAuthErrorMessage(error.message));
      setLoading(false);
    }
  });

  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.className = 'login-error show';
    errorDiv.style.background = 'rgba(225, 112, 85, 0.12)';
    errorDiv.style.borderColor = 'rgba(225, 112, 85, 0.3)';
    errorDiv.style.color = '#E17055';
  }

  function showSuccess(message) {
    errorDiv.textContent = message;
    errorDiv.className = 'login-error show';
    errorDiv.style.background = 'rgba(0, 184, 148, 0.12)';
    errorDiv.style.borderColor = 'rgba(0, 184, 148, 0.3)';
    errorDiv.style.color = '#00B894';
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    btnText.classList.toggle('hidden', loading);
    btnSpinner.classList.toggle('hidden', !loading);
  }

  function getAuthErrorMessage(message) {
    if (message.includes('Invalid login')) return 'Invalid email or password. Please try again.';
    if (message.includes('already registered')) return 'This email is already registered. Try signing in.';
    if (message.includes('rate limit')) return 'Too many attempts. Please wait and try again.';
    if (message.includes('pending approval')) return `${renderIcon('clock', 'inline-icon')} Your account is awaiting Admin/Owner approval. You will be able to sign in once they confirm your account.`;
    if (message.includes('Email not confirmed')) return `${renderIcon('mail', 'inline-icon')} Please confirm your email address before signing in.`;
    return message || 'Something went wrong. Please try again.';
  }
}
