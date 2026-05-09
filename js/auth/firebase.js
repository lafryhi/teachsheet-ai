const FIREBASE_VERSION = "11.0.2";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "teachsheet-ai.firebaseapp.com",
  projectId: "teachsheet-ai",
  storageBucket: "teachsheet-ai.firebasestorage.app",
  messagingSenderId: "922661764176",
  appId: "1:922661764176:web:d91eab25cbb70a5a40e555"
};

const FIREBASE_APP_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`;
const FIREBASE_AUTH_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`;

let cachedAuthServicePromise = null;
let cachedAuthInstance = null;

function isFirebaseConfigured() {
  return Object.values(firebaseConfig).every((value) => (
    typeof value === "string" && value.trim().length > 0
  ));
}

function createUnavailableAuthService(reason) {
  return {
    available: false,
    configured: isFirebaseConfigured(),
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

async function createFirebaseAuthService() {
  if (!isFirebaseConfigured()) {
    return createUnavailableAuthService(
      "Firebase Auth is not configured. Complete the Firebase web config in js/auth/firebase.js."
    );
  }

  try {
    const [{ initializeApp, getApps, getApp }, authModule] = await Promise.all([
      import(FIREBASE_APP_URL),
      import(FIREBASE_AUTH_URL)
    ]);
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

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
      "Firebase Auth could not be initialized. Check the Firebase web config and enabled providers."
    );
  }
}

export async function getFirebaseAuthService() {
  if (!cachedAuthServicePromise) {
    cachedAuthServicePromise = createFirebaseAuthService();
  }

  return cachedAuthServicePromise;
}
