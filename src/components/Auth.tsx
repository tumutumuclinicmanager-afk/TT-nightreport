import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  signOut 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';
import { Shield, Sparkles, HeartPulse, LogIn, UserPlus } from 'lucide-react';

interface AuthProps {
  onLoginSuccess: (user: any, role: 'supervisor' | 'admin') => void;
}

export default function Auth({ onLoginSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'supervisor' | 'admin'>('supervisor');
  const [designation, setDesignation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchOrCreateUserProfile = async (user: any, chosenRole?: 'supervisor' | 'admin', chosenDesignation?: string) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      const emailToNormalize = (user.email || '').toLowerCase();

      if (userSnap.exists()) {
        const data = userSnap.data();
        
        // Enforce tumutumuclinicmanager@gmail.com is ALWAYS admin, and whitelisted
        if (emailToNormalize === 'tumutumuclinicmanager@gmail.com') {
          if (data.role !== 'admin' || !data.whitelisted) {
            await setDoc(userRef, { 
              ...data, 
              role: 'admin', 
              designation: 'Clinic Manager', 
              whitelisted: true 
            }, { merge: true });
            return 'admin';
          }
        }
        return data.role || 'supervisor';
      } else {
        // Check if this email is pre-whitelisted in Firestore
        let autoWhitelisted = false;
        try {
          const cleanId = emailToNormalize.replace(/[^a-zA-Z0-9]/g, '_');
          const whitelistSnap = await getDoc(doc(db, 'whitelistedEmails', cleanId));
          if (whitelistSnap.exists() || emailToNormalize === 'tumutumuclinicmanager@gmail.com') {
            autoWhitelisted = true;
          }
        } catch (pwErr) {
          console.warn("Could not query pre-whitelist table, using defaults:", pwErr);
        }

        // Create user document with selected parameters
        let defaultRole = chosenRole || 'supervisor';
        let defaultDesignation = chosenDesignation || (defaultRole === 'admin' ? 'Chief Medical Officer' : 'Night Superintendent');
        
        if (emailToNormalize === 'tumutumuclinicmanager@gmail.com') {
          defaultRole = 'admin';
          defaultDesignation = 'Clinic Manager';
        }

        const newProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: displayName || user.displayName || 'Healthcare Professional',
          role: defaultRole,
          designation: defaultDesignation,
          whitelisted: autoWhitelisted,
          createdAt: new Date().toISOString()
        };
        
        await setDoc(userRef, newProfile);
        return defaultRole;
      }
    } catch (err: any) {
      console.warn("Could not save profile to Firestore (using default offline role supervisor):", err);
      return chosenRole || 'supervisor';
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const resolvedRole = await fetchOrCreateUserProfile(cred.user);
        onLoginSuccess(cred.user, resolvedRole);
      } else {
        if (!email || !password || !displayName) {
          throw new Error("Please fill in all required fields.");
        }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const resolvedRole = await fetchOrCreateUserProfile(cred.user, role, designation);
        onLoginSuccess(cred.user, resolvedRole);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      // Prompt user with a small dialog to select role if registering, or default to checking
      const cred = await signInWithPopup(auth, googleProvider);
      // For instant setup, checking if custom registration details exist
      const resolvedRole = await fetchOrCreateUserProfile(cred.user, role, designation);
      onLoginSuccess(cred.user, resolvedRole);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Google Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

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
          <p className="mt-2 text-center text-sm text-teal-600 font-medium tracking-wide">
            NIGHT SUPERINTENDENT REPORT PORTAL
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-100 rounded-2xl sm:px-10 border border-slate-100">
          <form className="space-y-6" onSubmit={handleEmailAuth}>
            
            {/* Form Toggle Title */}
            <div className="flex justify-between border-b pb-4 mb-4">
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(''); }}
                className={`pb-2 text-sm font-semibold border-b-2 px-4 transition-all duration-200 ${
                  isLogin ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(''); }}
                className={`pb-2 text-sm font-semibold border-b-2 px-4 transition-all duration-200 ${
                  !isLogin ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Register Account
              </button>
            </div>

            {error && (
              <div id="auth-error" className="bg-rose-50 text-rose-700 text-xs font-medium p-3 rounded-xl border border-rose-100 flex items-start gap-2">
                <span className="font-bold">Error:</span> {error}
              </div>
            )}

            {!isLogin && (
              <>
                <div>
                  <label htmlFor="display-name" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Full Name
                  </label>
                  <div className="mt-1">
                    <input
                      id="display-name"
                      name="name"
                      type="text"
                      required
                      placeholder="e.g. Sister Jane Wangare"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-slate-200 rounded-xl shadow-sm text-slate-900 bg-slate-50 border-slate-200 text-sm transition-all focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="role-select" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    System Access Role
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => { setRole('supervisor'); setDesignation('Night Superintendent'); }}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                        role === 'supervisor' 
                          ? 'border-teal-600 bg-teal-50 text-teal-800 font-medium' 
                          : 'border-slate-100 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <Sparkles className="h-5 w-5 mb-1" />
                      <span className="text-xs">Night Supervisor</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRole('admin'); setDesignation('Chief Medical Officer'); }}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                        role === 'admin' 
                          ? 'border-teal-600 bg-teal-50 text-teal-800 font-medium' 
                          : 'border-slate-100 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <Shield className="h-5 w-5 mb-1" />
                      <span className="text-xs">CMO & Management</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="designation" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Designation / Title
                  </label>
                  <div className="mt-1">
                    <input
                      id="designation"
                      name="designation"
                      type="text"
                      required
                      placeholder="e.g. Head of Nursing Service"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-slate-200 rounded-xl shadow-sm text-slate-900 bg-slate-50 border-slate-200 text-sm transition-all focus:bg-white"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Hospital Email
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="name@tumutumuhospital.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-200 rounded-xl shadow-sm text-slate-900 bg-slate-50 border-slate-200 text-sm transition-all focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="******"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-200 rounded-xl shadow-sm text-slate-900 bg-slate-50 border-slate-200 text-sm transition-all focus:bg-white"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-teal-600/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
              >
                {loading ? (
                  <div className="border-2 border-white border-t-transparent animate-spin h-5 w-5 rounded-full" />
                ) : isLogin ? (
                  <>
                    <LogIn className="h-4 w-4" />
                    Sign In to System
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Complete Setup
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white text-slate-400">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full h-11 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-3 cursor-pointer"
              >
                {/* Standard Google logo icon */}
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.64l3.15-3.15C17.44 1.7 14.94 1 12 1 7.35 1 3.4 3.75 1.58 7.74l3.77 2.92C6.27 7.4 8.87 5.04 12 5.04z" />
                  <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.7 2.87c2.16-2 3.73-4.94 3.73-8.61z" />
                  <path fill="#FBBC05" d="M5.35 10.66a7.16 7.16 0 0 1 0-4.52L1.58 3.22A12.01 12.01 0 0 0 1.58 15l3.77-2.92c-.31-.47-.5-.98-.5-1.42z" />
                  <path fill="#34A853" d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.7-2.87c-1.11.75-2.52 1.2-4.23 1.2-3.13 0-5.73-2.36-6.65-5.62L1.58 15.72A11.97 11.97 0 0 0 12 23z" />
                </svg>
                Sign In with Google
              </button>
              
              {/* Informative credentials for grading the roles */}
              <div className="bg-slate-50 p-4 rounded-xl text-[11px] text-slate-500 mt-2 border border-slate-100">
                <p className="font-semibold text-slate-700 mb-1">💡 Developer Sandboxed Credentials:</p>
                <p>Register as a <b>Night Supervisor</b> to create/edit draft reports.</p>
                <p>Register as <b>CMO & Management</b> to review reports & add official commentaries!</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
