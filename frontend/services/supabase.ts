import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "placeholder-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "placeholder-auth-domain",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "placeholder-project-id",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "placeholder-storage-bucket",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "placeholder-sender-id",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "placeholder-app-id"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Helper to convert Firebase User to format expected by dashboard page.tsx
const mapFirebaseUser = (firebaseUser: any) => {
  if (!firebaseUser) return null;
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email,
    user_metadata: {
      name: firebaseUser.displayName || "",
      avatar_url: firebaseUser.photoURL || ""
    }
  };
};

export const supabase = {
  auth: {
    signInWithPassword: async ({ email, password }: any) => {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const token = await userCredential.user.getIdToken();
        return {
          data: {
            user: mapFirebaseUser(userCredential.user),
            session: { access_token: token, user: mapFirebaseUser(userCredential.user) }
          },
          error: null
        };
      } catch (err: any) {
        return { data: { user: null, session: null }, error: err };
      }
    },

    signUp: async ({ email, password }: any) => {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const token = await userCredential.user.getIdToken();
        return {
          data: {
            user: mapFirebaseUser(userCredential.user),
            session: { access_token: token, user: mapFirebaseUser(userCredential.user) }
          },
          error: null
        };
      } catch (err: any) {
        return { data: { user: null, session: null }, error: err };
      }
    },

    signInWithOAuth: async ({ provider }: any) => {
      try {
        if (provider === "google") {
          const googleProvider = new GoogleAuthProvider();
          const userCredential = await signInWithPopup(auth, googleProvider);
          const token = await userCredential.user.getIdToken();
          return {
            data: {
              user: mapFirebaseUser(userCredential.user),
              session: { access_token: token, user: mapFirebaseUser(userCredential.user) }
            },
            error: null
          };
        }
        throw new Error(`OAuth provider ${provider} not implemented.`);
      } catch (err: any) {
        return { data: { user: null, session: null }, error: err };
      }
    },

    signOut: async () => {
      try {
        await firebaseSignOut(auth);
        return { error: null };
      } catch (err: any) {
        return { error: err };
      }
    },

    getSession: async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return { data: { session: null }, error: null };
        const token = await currentUser.getIdToken();
        return {
          data: {
            session: {
              access_token: token,
              user: mapFirebaseUser(currentUser)
            }
          },
          error: null
        };
      } catch (err: any) {
        return { data: { session: null }, error: err };
      }
    },

    onAuthStateChange: (callback: any) => {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          const token = await firebaseUser.getIdToken();
          callback("SIGNED_IN", {
            access_token: token,
            user: mapFirebaseUser(firebaseUser)
          });
        } else {
          callback("SIGNED_OUT", null);
        }
      });
      return {
        data: {
          subscription: {
            unsubscribe: () => unsubscribe()
          }
        }
      };
    },

    // Phone Authentication methods
    signInWithPhone: async (phoneNumber: string, appVerifier: RecaptchaVerifier) => {
      try {
        const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        return { data: result, error: null };
      } catch (err: any) {
        return { data: null, error: err };
      }
    },

    confirmOtp: async (confirmationResult: ConfirmationResult, otp: string) => {
      try {
        const userCredential = await confirmationResult.confirm(otp);
        const token = await userCredential.user.getIdToken();
        return {
          data: {
            user: mapFirebaseUser(userCredential.user),
            session: { access_token: token, user: mapFirebaseUser(userCredential.user) }
          },
          error: null
        };
      } catch (err: any) {
        return { data: null, error: err };
      }
    }
  }
};

// Export raw Firebase auth for direct use in phone auth components
export const firebaseAuth = auth;

