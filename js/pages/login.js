// ===========================
// NEXT TASK — Login Page
// ===========================

import { AuthService } from '../services/auth.js';
import { sanitize } from '../utils/helpers.js';

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
            <!-- Full Name (only shown on signup) -->
            <div class="form-group hidden" id="name-group">
              <label class="form-label" for="full-name">Full Name</label>
              <input
                type="text"
                id="full-name"
                class="form-input"
                placeholder="Enter your full name"
                autocomplete="name"
              />
            </div>

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
                  👁️
                </button>
              </div>
            </div>

            <!-- Confirm Password (only shown on signup) -->
            <div class="form-group hidden" id="confirm-group">
              <label class="form-label" for="confirm-password">Confirm Password</label>
              <input
                type="password"
                id="confirm-password"
                class="form-input"
                placeholder="Confirm your password"
                autocomplete="new-password"
              />
            </div>

            <button type="submit" class="btn btn-primary" id="submit-btn">
              <span id="btn-text">Sign In</span>
              <div class="spinner hidden" id="btn-spinner"></div>
            </button>
          </form>

          <div class="login-toggle">
            <span id="toggle-text">Don't have an account?</span>
            <a id="toggle-link">Create one</a>
          </div>
        </div>
      </div>
    </div>
  `;

  initLoginEvents();
}

function initLoginEvents() {
  let isSignUp = false;

  const form = document.getElementById('login-form');
  const toggleLink = document.getElementById('toggle-link');
  const toggleText = document.getElementById('toggle-text');
  const subtitle = document.getElementById('login-subtitle');
  const nameGroup = document.getElementById('name-group');
  const confirmGroup = document.getElementById('confirm-group');
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
    togglePassword.textContent = isPassword ? '🙈' : '👁️';
  });

  // Toggle between Sign In and Sign Up
  toggleLink.addEventListener('click', () => {
    isSignUp = !isSignUp;
    errorDiv.classList.remove('show');

    if (isSignUp) {
      subtitle.textContent = 'Create your account';
      nameGroup.classList.remove('hidden');
      confirmGroup.classList.remove('hidden');
      btnText.textContent = 'Create Account';
      toggleText.textContent = 'Already have an account?';
      toggleLink.textContent = 'Sign in';
    } else {
      subtitle.textContent = 'Sign in to your workspace';
      nameGroup.classList.add('hidden');
      confirmGroup.classList.add('hidden');
      btnText.textContent = 'Sign In';
      toggleText.textContent = "Don't have an account?";
      toggleLink.textContent = 'Create one';
    }
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

    if (isSignUp) {
      const fullName = sanitize(document.getElementById('full-name').value.trim());
      const confirmPassword = document.getElementById('confirm-password').value;

      if (!fullName) {
        showError('Please enter your full name.');
        return;
      }

      if (password !== confirmPassword) {
        showError('Passwords do not match.');
        return;
      }
    }

    // Show loading
    setLoading(true);

    try {
      if (isSignUp) {
        const fullName = document.getElementById('full-name').value.trim();
        await AuthService.signUp(email, password, fullName);
        // Show success message - admin needs to confirm
        showSuccess('✅ Account created! Ask your Admin/Owner to confirm your account in Supabase before you can sign in.');
        // Switch back to login view
        isSignUp = false;
        subtitle.textContent = 'Sign in to your workspace';
        nameGroup.classList.add('hidden');
        confirmGroup.classList.add('hidden');
        btnText.textContent = 'Sign In';
        toggleText.textContent = "Don't have an account?";
        toggleLink.textContent = 'Create one';
        form.reset();
      } else {
        await AuthService.signIn(email, password);
        // Auth state change will handle redirect
      }
    } catch (error) {
      console.error('Auth error:', error);
      showError(getAuthErrorMessage(error.message));
    } finally {
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
    if (message.includes('pending approval')) return '⏳ Your account is awaiting Admin/Owner approval. You will be able to sign in once they confirm your account.';
    if (message.includes('Email not confirmed')) return '📧 Please confirm your email address before signing in.';
    return message || 'Something went wrong. Please try again.';
  }
}
