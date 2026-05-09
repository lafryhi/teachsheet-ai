const FIREBASE_VERSION = "11.0.2";
const FIREBASE_CONFIG_PLACEHOLDER = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
  projectId: "YOUR_FIREBASE_PROJECT_ID",
  appId: "YOUR_FIREBASE_APP_ID"
};

const FIREBASE_APP_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`;
const FIREBASE_AUTH_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`;

let cachedAuthServicePromise = null;
let cachedAuthInstance = null;

function getInjectedConfig() {
  if (typeof window === "undefined") {
    return {};
  }

  return window.__TEACHSHEET_FIREBASE_CONFIG__ || {};
}

export function getFirebaseConfig() {
  return {
    ...FIREBASE_CONFIG_PLACEHOLDER,
    ...getInjectedConfig()
  };
}

export function isFirebaseConfigured() {
  const config = getFirebaseConfig();

  return Object.values(config).every((value) => (
    typeof value === "string" &&
    value.length > 0 &&
    !value.startsWith("YOUR_FIREBASE_")
  ));
}

function createUnavailableAuthService(reason, configured = false) {
  return {
    available: false,
    configured,
    reason,
    getCurrentUser() {
      return null;
    },
    onAuthStateChanged(callback) {
      callback(null);
      return () => {};
    },
    async signUp() {
      throw new Error(reason);
    },
    async signIn() {
      throw new Error(reason);
    },
    async signInWithGoogle() {
      throw new Error(reason);
    },
    async signOut() {
      return null;
    }
  };
}

function createTestAuthService(testApi) {
  return {
    available: true,
    configured: true,
    reason: "",
    getCurrentUser() {
      return typeof testApi.getCurrentUser === "function" ? testApi.getCurrentUser() : null;
    },
    onAuthStateChanged(callback) {
      return testApi.onAuthStateChanged(callback);
    },
    async signUp({ name, email, password }) {
      return testApi.signUp({ name, email, password });
    },
    async signIn({ email, password }) {
      return testApi.signIn({ email, password });
    },
    async signInWithGoogle() {
      return testApi.signInWithGoogle();
    },
    async signOut() {
      return testApi.signOut();
    }
  };
}

async function createFirebaseAuthService() {
  if (typeof window !== "undefined" && window.__TEACHSHEET_FIREBASE_TEST_API__) {
    return createTestAuthService(window.__TEACHSHEET_FIREBASE_TEST_API__);
  }

  if (!isFirebaseConfigured()) {
    return createUnavailableAuthService(
      "Firebase Auth is not configured. Add your Firebase web config in js/auth/firebase.js or window.__TEACHSHEET_FIREBASE_CONFIG__.",
      false
    );
  }

  try {
    const [{ initializeApp, getApps, getApp }, authModule] = await Promise.all([
      import(FIREBASE_APP_URL),
      import(FIREBASE_AUTH_URL)
    ]);
    const app = getApps().length ? getApp() : initializeApp(getFirebaseConfig());

    if (!cachedAuthInstance) {
      cachedAuthInstance = authModule.initializeAuth(app, {
        persistence: authModule.browserLocalPersistence,
        popupRedirectResolver: authModule.browserPopupRedirectResolver
      });
    }

    const googleProvider = new authModule.GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });

    return {
      available: true,
      configured: true,
      reason: "",
      getCurrentUser() {
        return cachedAuthInstance.currentUser;
      },
      onAuthStateChanged(callback) {
        return authModule.onAuthStateChanged(cachedAuthInstance, callback);
      },
      async signUp({ name, email, password }) {
        const credential = await authModule.createUserWithEmailAndPassword(cachedAuthInstance, email, password);

        if (name) {
          await authModule.updateProfile(credential.user, { displayName: name });
        }

        return credential.user;
      },
      async signIn({ email, password }) {
        const credential = await authModule.signInWithEmailAndPassword(cachedAuthInstance, email, password);
        return credential.user;
      },
      async signInWithGoogle() {
        const credential = await authModule.signInWithPopup(cachedAuthInstance, googleProvider);
        return credential.user;
      },
      async signOut() {
        await authModule.signOut(cachedAuthInstance);
        return null;
      }
    };
  } catch (error) {
    console.error(error);
    return createUnavailableAuthService(
      "Firebase Auth could not be initialized. Check your Firebase config and enabled providers.",
      true
    );
  }
}

export async function getFirebaseAuthService() {
  if (!cachedAuthServicePromise) {
    cachedAuthServicePromise = createFirebaseAuthService();
  }

  return cachedAuthServicePromise;
}
