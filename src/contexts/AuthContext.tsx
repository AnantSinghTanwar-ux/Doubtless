"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { getUserProfile, createUserProfile, initLearnerProfile } from "@/lib/firestore";
import type { UserProfile, UserRole } from "@/types";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  setRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signInWithGoogle: async () => {},
  logout: async () => {},
  setRole: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const existingProfile = await getUserProfile(firebaseUser.uid);
        setProfile(existingProfile);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      const mockUser = {
        uid: "demo-student-123",
        email: "demo@doubtless.ai",
        displayName: "Demo Student",
        photoURL: null,
      } as unknown as User;
      setUser(mockUser);
      
      const existingProfile = await getUserProfile(mockUser.uid);
      if (existingProfile) {
        setProfile(existingProfile);
      } else {
        // Automatically create and set as student if it doesn't exist in demo mode
        const newProfile: UserProfile = {
          uid: mockUser.uid,
          email: mockUser.email ?? "",
          displayName: mockUser.displayName ?? "",
          photoURL: mockUser.photoURL,
          role: "student",
          createdAt: Date.now(),
        };
        await createUserProfile(newProfile);
        await initLearnerProfile(mockUser.uid);
        setProfile(newProfile);
      }
      return;
    }

    const result = await signInWithPopup(auth, googleProvider);
    const existingProfile = await getUserProfile(result.user.uid);
    if (existingProfile) {
      setProfile(existingProfile);
    }
  };

  const logout = async () => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
      await signOut(auth);
    }
    setUser(null);
    setProfile(null);
  };

  const setRole = async (role: UserRole) => {
    if (!user) return;
    const newProfile: UserProfile = {
      uid: user.uid,
      email: user.email ?? "",
      displayName: user.displayName ?? "",
      photoURL: user.photoURL,
      role,
      createdAt: Date.now(),
    };
    await createUserProfile(newProfile);
    if (role === "student") {
      await initLearnerProfile(user.uid);
    }
    setProfile(newProfile);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, logout, setRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
