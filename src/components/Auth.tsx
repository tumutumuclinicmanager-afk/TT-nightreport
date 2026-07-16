import React, { useState, useEffect } from 'react';
import { signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';
import { HeartPulse, ShieldAlert, AlertCircle, Mail, Key } from 'lucide-react';

interface AuthProps {}

export default function Auth({}: AuthProps) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [useRedirectOnly, setUseRedirectOnly] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Listen for redirect results on component mount
  useEffect(() => {
    let active = true;
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user && active) {
          setLoading(true);
          // Handled by App.tsx observer
        }
      } catch (err: any) {
        console.error("Redirect collection failed:", err);
        if (active) {
          setError(err.message || "Failed to finalize secure Google Redirect sign-in.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    checkRedirect();

    return () => {
      active = false;
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Popup mode failed:", err);
      // Auto fallback to redirect mode if popup is blocked, closed, or cancelled
      if (
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request' ||
        useRedirectOnly
      ) {
        await handleRedirectSignIn();
      } else {
        setError(err.message || "Google Authentication failed. Please try again or use web redirect.");
        setLoading(false);
      }
    }
  };

  const handleRedirectSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err: any) {
      console.error("Redirect initiation failed:", err);
      setError(err.message || "Fail to initiate sign-in redirection. Please enable third-party cookies.");
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Email sign-in failed:", err);
      setError(err.message || "Invalid email or password.");
      setLoading(false);
    }
  };

  const renderAuthForm = () => (
    <form onSubmit={handleEmailSignIn} className="space-y-4">
      <div className="relative">
        <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
        <input
          type="email"
          required
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full pl-10 pr-3 py-3 border border-slate-200 bg-slate-50 text-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <div className="relative">
        <Key className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full pl-10 pr-3 py-3 border border-slate-200 bg-slate-50 text-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
      >
        {loading ? (
          <div className="border-2 border-white border-t-transparent animate-spin h-5 w-5 rounded-full" />
        ) : (
          'Sign In'
        )}
      </button>

      <div className="relative flex py-3 items-center">
        <div className="flex-grow border-t border-slate-100"></div>
        <span className="flex-shrink mx-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">Or</span>
        <div className="flex-grow border-t border-slate-100"></div>
      </div>

      <button
        type="button"
        onClick={() => {
          setUseRedirectOnly(false);
          handleGoogleSignIn();
        }}
        disabled={loading}
        className="w-full h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
      >
        {loading && !useRedirectOnly ? (
          <div className="border-2 border-slate-400 border-t-transparent animate-spin h-5 w-5 rounded-full" />
        ) : (
          <>
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.64l3.15-3.15C17.44 1.7 14.94 1 12 1 7.35 1 3.4 3.75 1.58 7.74l3.77 2.92C6.27 7.4 8.87 5.04 12 5.04z" />
              <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.7 2.87c2.16-2 3.73-4.94 3.73-8.61z" />
              <path fill="#FBBC05" d="M5.35 10.66a7.16 7.16 0 0 1 0-4.52L1.58 3.22A12.01 12.01 0 0 0 1.58 15l3.77-2.92c-.31-.47-.5-.98-.5-1.42z" />
              <path fill="#34A853" d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.7-2.87c-1.11.75-2.52 1.2-4.23 1.2-3.13 0-5.73-2.36-6.65-5.62L1.58 15.72A11.97 11.97 0 0 0 12 23z" />
            </svg>
            <span className="font-bold">Sign In with Google</span>
          </>
        )}
      </button>

      <button
        type="button"
        onClick={() => {
          setUseRedirectOnly(true);
          handleRedirectSignIn();
        }}
        disabled={loading}
        className="w-full mt-2 h-11 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-100/50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
      >
        {loading && useRedirectOnly ? (
          <div className="border-2 border-teal-600 border-t-transparent animate-spin h-4.5 w-4.5 rounded-full" />
        ) : (
          <>
            <AlertCircle className="h-4 w-4 text-teal-600" />
            <span>Google Redirect (Mobile)</span>
          </>
        )}
      </button>
    </form>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Branding Emblem */}
        <div className="flex justify-center flex-col items-center">
          <div className="h-16 w-16 bg-gradient-to-tr from-teal-600 to-cyan-700 rounded-2xl flex items-center justify-center text-white shadow-md shadow-teal-600/20 mb-4 ring-4 ring-teal-50">
            <HeartPulse className="h-10 w-10 animate-pulse" />
          </div>
          <h2 className="text-center text-3xl font-bold font-display tracking-tight text-slate-900">
            PCEA Tumutumu Hospital
          </h2>
          <p className="mt-2 text-center text-sm text-teal-600 font-medium tracking-wide border-b border-teal-100 pb-3 w-5/6">
            NIGHT SUPERINTENDENT REPORT PORTAL
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-100 rounded-2xl sm:px-10 border border-slate-100 space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-base font-bold text-slate-800">Operational Sign In</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              Welcome to the clinical audit management systems. Access to this platform is strictly limited to authorized medical staff and night superintendents.
            </p>
          </div>

          {error && (
            <div id="auth-error" className="bg-rose-50 text-rose-700 text-xs font-medium p-3 rounded-xl border border-rose-100 flex items-start gap-2 leading-relaxed">
              <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Access Error:</span> {error}
              </div>
            </div>
          )}

          <div className="pt-2">
            {renderAuthForm()}
          </div>

          <div className="border-t border-slate-100 pt-4 text-[10px] text-center text-slate-400 font-medium">
            Authorized Personnel Only • © PCEA Tumutumu Hospital
          </div>
        </div>
      </div>
    </div>
  );
}
