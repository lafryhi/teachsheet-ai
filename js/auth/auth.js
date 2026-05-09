import { getFirebaseAuthService } from "./firebase.js";

const AUTH_MODE_COPY = {
  login: {
    title: "Welcome back",
    subtitle: "Sign in to access your saved worksheets on this account.",
    submitLabel: "Login"
  },
  signup: {
    title: "Create your account",
    subtitle: "Sign up to keep your projects organized and available later.",
    submitLabel: "Create Account"
  }
};

function getDisplayName(user) {
  return user?.displayName || user?.email || "Teacher";
}

function formatAuthError(error, fallbackMessage) {
  const code = error?.code || "";
  const rawMessage = String(error?.message || "");
  const normalizedMessage = rawMessage.toLowerCase();
  const knownMessages = {
    "auth/email-already-in-use": "This email is already in use. Try logging in instead.",
    "auth/invalid-api-key": "The Firebase API key is invalid. Update the apiKey in js/auth/firebase.js.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/missing-password": "Enter your password to continue.",
    "auth/network-request-failed": "A network error interrupted authentication. Try again.",
    "auth/operation-not-allowed": "This sign-in method is not enabled in your Firebase project.",
    "auth/weak-password": "Use a stronger password with at least 6 characters.",
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/user-not-found": "No account was found for this email.",
    "auth/wrong-password": "The email or password is incorrect.",
    "auth/popup-closed-by-user": "The Google sign-in popup was closed before completion.",
    "auth/popup-blocked": "Your browser blocked the popup. Allow popups and try again.",
    "auth/unauthorized-domain": "This domain is not authorized in your Firebase project settings."
  };

  if (normalizedMessage.includes("api-key-not-valid")) {
    return "The Firebase API key is invalid. Update the apiKey in js/auth/firebase.js.";
  }

  if (normalizedMessage.includes("unauthorized-domain")) {
    return "This domain is not authorized in your Firebase project settings.";
  }

  return knownMessages[code] || error?.message || fallbackMessage;
}

export function createAuthController({ onUserChanged }) {
  const state = {
    authService: null,
    user: null,
    mode: "login",
    isLoading: true,
    isSubmitting: false,
    pendingDisplayName: ""
  };

  function getElement(id) {
    return document.getElementById(id);
  }

  function getSignedOutActions() {
    return getElement("signedOutActions");
  }

  function getSignedInActions() {
    return getElement("signedInActions");
  }

  function getAuthLoadingState() {
    return getElement("authLoadingState");
  }

  function getUserIdentity() {
    return getElement("userIdentity");
  }

  function getAuthModal() {
    return getElement("authModal");
  }

  function getAuthNameField() {
    return getElement("authNameField");
  }

  function getAuthNameInput() {
    return getElement("authNameInput");
  }

  function getAuthEmailInput() {
    return getElement("authEmailInput");
  }

  function getAuthPasswordInput() {
    return getElement("authPasswordInput");
  }

  function getAuthStatus() {
    return getElement("authStatus");
  }

  function getAuthConfigNote() {
    return getElement("authConfigNote");
  }

  function setAuthStatus(message = "", tone = "") {
    const authStatus = getAuthStatus();
    authStatus.textContent = message;
    authStatus.className = "auth-status";

    if (tone) {
      authStatus.classList.add(`is-${tone}`);
    }
  }

  function setMode(mode) {
    state.mode = mode;

    const copy = AUTH_MODE_COPY[mode];
    getElement("authModalTitle").textContent = copy.title;
    getElement("authModalSubtitle").textContent = copy.subtitle;
    getElement("authSubmitButton").textContent = copy.submitLabel;
    getElement("showLoginModeButton").classList.toggle("active", mode === "login");
    getElement("showSignupModeButton").classList.toggle("active", mode === "signup");
    getAuthNameField().hidden = mode !== "signup";
    getAuthNameInput().required = mode === "signup";
    setAuthStatus("");
  }

  function openModal(mode = state.mode) {
    setMode(mode);
    getAuthModal().hidden = false;
    document.body.classList.add("auth-modal-open");
  }

  function closeModal() {
    getAuthModal().hidden = true;
    document.body.classList.remove("auth-modal-open");
    setAuthStatus("");
  }

  function setSubmittingState(isSubmitting) {
    state.isSubmitting = isSubmitting;

    getElement("authSubmitButton").disabled = isSubmitting || !state.authService?.available;
    getElement("googleLoginButton").disabled = isSubmitting || !state.authService?.available;
    getElement("showLoginModeButton").disabled = isSubmitting;
    getElement("showSignupModeButton").disabled = isSubmitting;
    getElement("closeAuthModalButton").disabled = isSubmitting;
  }

  function renderAuthChrome() {
    const user = state.user;
    const isSignedIn = Boolean(user);
    const userIdentity = isSignedIn
      ? (state.pendingDisplayName || getDisplayName(user))
      : "";

    getAuthLoadingState().hidden = !state.isLoading;
    getSignedOutActions().hidden = state.isLoading || isSignedIn;
    getSignedInActions().hidden = state.isLoading || !isSignedIn;
    getUserIdentity().textContent = userIdentity;

    const configNote = state.authService?.configured
      ? ""
      : "Firebase Auth is not configured yet. Add your Firebase web config in js/auth/firebase.js to enable login.";

    getAuthConfigNote().textContent = configNote;
    getElement("authSubmitButton").disabled = state.isSubmitting || !state.authService?.available;
    getElement("googleLoginButton").disabled = state.isSubmitting || !state.authService?.available;
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();

    if (!state.authService?.available) {
      setAuthStatus(state.authService?.reason || "Firebase Auth is not ready yet.", "error");
      return;
    }

    const name = getAuthNameInput().value.trim();
    const email = getAuthEmailInput().value.trim();
    const password = getAuthPasswordInput().value;

    try {
      setSubmittingState(true);
      setAuthStatus(state.mode === "signup" ? "Creating account..." : "Signing you in...", "loading");

      const user = state.mode === "signup"
        ? await state.authService.signUp({ name, email, password })
        : await state.authService.signIn({ email, password });

      if (state.mode === "signup" && name) {
        state.pendingDisplayName = name;
      }

      if (user) {
        state.user = user;
        state.isLoading = false;
        renderAuthChrome();
        onUserChanged?.(user);
      }

      closeModal();
    } catch (error) {
      setAuthStatus(
        formatAuthError(error, state.mode === "signup" ? "Sign up failed." : "Login failed."),
        "error"
      );
    } finally {
      setSubmittingState(false);
    }
  }

  async function handleGoogleLogin() {
    if (!state.authService?.available) {
      setAuthStatus(state.authService?.reason || "Firebase Auth is not ready yet.", "error");
      return;
    }

    try {
      setSubmittingState(true);
      setAuthStatus("Opening Google sign-in...", "loading");
      await state.authService.signInWithGoogle();
      closeModal();
    } catch (error) {
      setAuthStatus(formatAuthError(error, "Google sign-in failed."), "error");
    } finally {
      setSubmittingState(false);
    }
  }

  async function handleLogout() {
    if (!state.authService?.available) {
      return;
    }

    try {
      getElement("logoutButton").disabled = true;
      await state.authService.signOut();
    } finally {
      getElement("logoutButton").disabled = false;
    }
  }

  function bindEvents() {
    getElement("openLoginButton").addEventListener("click", () => {
      openModal("login");
    });

    getElement("openSignupButton").addEventListener("click", () => {
      openModal("signup");
    });

    getElement("showLoginModeButton").addEventListener("click", () => {
      setMode("login");
    });

    getElement("showSignupModeButton").addEventListener("click", () => {
      setMode("signup");
    });

    getElement("closeAuthModalButton").addEventListener("click", () => {
      closeModal();
    });

    getAuthModal().addEventListener("click", (event) => {
      if (event.target === getAuthModal()) {
        closeModal();
      }
    });

    getElement("authForm").addEventListener("submit", handleAuthSubmit);
    getElement("googleLoginButton").addEventListener("click", () => {
      handleGoogleLogin();
    });
    getElement("logoutButton").addEventListener("click", () => {
      handleLogout();
    });
  }

  async function init() {
    bindEvents();
    setMode("login");
    renderAuthChrome();

    state.authService = await getFirebaseAuthService();

    return new Promise((resolve) => {
      let initialResolved = false;

      state.authService.onAuthStateChanged((user) => {
        const resolvedUser = state.pendingDisplayName && user && !user.displayName
          ? {
            uid: user.uid,
            email: user.email,
            displayName: state.pendingDisplayName
          }
          : user;

        state.user = resolvedUser;
        state.isLoading = false;
        if (!user || user.displayName) {
          state.pendingDisplayName = "";
        }
        renderAuthChrome();
        onUserChanged?.(resolvedUser);

        if (!initialResolved) {
          initialResolved = true;
          resolve(user);
        }
      });
    });
  }

  function getCurrentUser() {
    return state.user;
  }

  return {
    init,
    getCurrentUser,
    openModal,
    closeModal
  };
}
