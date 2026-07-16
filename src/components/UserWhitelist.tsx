import React, { useState, useEffect } from 'react';
import { db, secondaryAuth } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ShieldAlert, UserCheck, UserX, Mail, Search, Shield, CheckCircle2, Trash2, Key, UserPlus } from 'lucide-react';
import { isAllowedToWhitelist } from '../utils/auditLogger';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'supervisor' | 'cmo' | 'cno' | 'admin';
  designation?: string;
  createdAt: string;
  whitelisted?: boolean;
}

interface PreWhitelistedEmail {
  email: string;
  addedBy: string;
  addedAt: string;
}

interface UserWhitelistProps {
  currentUser: any;
  currentRole: 'supervisor' | 'cmo' | 'cno' | 'admin';
  currentDesignation?: string;
}

export default function UserWhitelist({ currentUser, currentRole, currentDesignation }: UserWhitelistProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [preWhitelisted, setPreWhitelisted] = useState<PreWhitelistedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorVal, setErrorVal] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pre-authorization state
  const [newEmailToWhitelist, setNewEmailToWhitelist] = useState('');
  const [selectedRoleToWhitelist, setSelectedRoleToWhitelist] = useState<'supervisor' | 'cmo' | 'cno' | 'admin'>('supervisor');
  
  // Create user state
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'supervisor' | 'cmo' | 'cno' | 'admin'>('supervisor');

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const canWhitelist = isAllowedToWhitelist(currentRole, currentDesignation, currentUser?.email);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setErrorVal(null);
      try {
        // Fetch registered users
        const usersSnap = await getDocs(collection(db, 'users'));
        const usersList: UserProfile[] = [];
        usersSnap.forEach((d) => {
          usersList.push(d.data() as UserProfile);
        });
        setUsers(usersList);

        // Fetch pre-whitelisted emails
        const whitelistSnap = await getDocs(collection(db, 'whitelistedEmails'));
        const whitelistList: PreWhitelistedEmail[] = [];
        whitelistSnap.forEach((d) => {
          whitelistList.push(d.data() as PreWhitelistedEmail);
        });
        setPreWhitelisted(whitelistList);
      } catch (err: any) {
        console.error("Error loading user administration metadata:", err);
        setErrorVal(err.message || "Failed to synchronise staff registry from Firestore.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [refreshTrigger]);

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleToggleWhitelist = async (user: UserProfile) => {
    if (!canWhitelist) {
      alert("Unauthorized Action: Only CMO, CNO, or admin accounts are allowed to modify user whitelists.");
      return;
    }
    
    // Prevent self-modifying to unwhitelisted
    if (user.uid === currentUser.uid) {
      alert("Action Blocked: You cannot modify your own whitelist activation status. Please ask another clinical systems administrator.");
      return;
    }

    const nextStatus = !user.whitelisted;
    setActionLoading(user.uid);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { whitelisted: nextStatus });
      
      // Save logs
      const logId = `whitelist_toggle_${Date.now()}_${currentUser.uid}`;
      await setDoc(doc(db, 'auditLogs', logId), {
        id: logId,
        reportDate: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        userId: currentUser.uid,
        userEmail: currentUser.email || '',
        userDisplayName: currentUser.displayName || 'Authorized Admin',
        userRole: currentRole,
        modifiedFields: ['whitelisted'],
        action: 'update',
        details: `${nextStatus ? 'Whitelisted' : 'Revoked Whitelist from'} clinic user '${user.displayName}' (${user.email}).`
      });

      showNotification(`Successfully updated ${user.displayName}'s authorization state.`);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error(err);
      alert("Could not update whitelist flag. Verify network connectivity.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangeRole = async (user: UserProfile, nextRole: 'supervisor' | 'cmo' | 'cno' | 'admin') => {
    if (!canWhitelist) {
      alert("Unauthorized Action: Only Super Admin is allowed to update user roles.");
      return;
    }
    
    setActionLoading(user.uid + '_role');
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { role: nextRole });
      
      // Save logs
      const logId = `user_role_${Date.now()}_${currentUser.uid}`;
      await setDoc(doc(db, 'auditLogs', logId), {
        id: logId,
        reportDate: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        userId: currentUser.uid,
        userEmail: currentUser.email || '',
        userDisplayName: currentUser.displayName || 'Authorized Admin',
        userRole: currentRole,
        modifiedFields: ['role'],
        action: 'update',
        details: `Updated role of '${user.displayName}' (${user.email}) to ${nextRole}.`
      });

      showNotification(`Role of ${user.displayName} updated to ${nextRole}.`);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error(err);
      alert("Could not update user role. Try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddPreWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWhitelist) {
      alert("Unauthorized Action: Only CMO, CNO, or admin accounts are allowed to whitelist a user.");
      return;
    }

    const emailToSave = newEmailToWhitelist.trim().toLowerCase();
    if (!emailToSave) return;

    if (preWhitelisted.some(p => p.email === emailToSave) || users.some(u => u.email.toLowerCase() === emailToSave)) {
      showNotification("This email address is already whitelisted or registered.");
      setNewEmailToWhitelist('');
      return;
    }

    setActionLoading('add_email');
    try {
      const docId = emailToSave.replace(/[^a-zA-Z0-9]/g, '_');
      await setDoc(doc(db, 'whitelistedEmails', docId), {
        email: emailToSave,
        addedBy: currentUser.displayName || currentUser.email,
        addedAt: new Date().toISOString(),
        role: selectedRoleToWhitelist
      });

      // Log it
      const logId = `pre_whitelist_${Date.now()}_${currentUser.uid}`;
      await setDoc(doc(db, 'auditLogs', logId), {
        id: logId,
        reportDate: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        userId: currentUser.uid,
        userEmail: currentUser.email || '',
        userDisplayName: currentUser.displayName || 'Authorized Admin',
        userRole: currentRole,
        modifiedFields: ['whitelistedEmails'],
        action: 'create',
        details: `Pre-whitelisted clean entry for hospital email address: '${emailToSave}' with pre-authorized role: '${selectedRoleToWhitelist}'.`
      });

      showNotification(`Pre-whitelisted ${emailToSave} as ${selectedRoleToWhitelist} successfully.`);
      setNewEmailToWhitelist('');
      setSelectedRoleToWhitelist('supervisor');
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error(err);
      alert("Could not pre-whitelist email.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemovePreWhitelist = async (email: string) => {
    if (!canWhitelist) {
      alert("Unauthorized Action: Only CMO, CNO, or admin accounts are allowed to remove whitelisted accounts.");
      return;
    }

    setActionLoading('remove_pw_' + email);
    try {
      const docId = email.replace(/[^a-zA-Z0-9]/g, '_');
      await deleteDoc(doc(db, 'whitelistedEmails', docId));

      // Log it
      const logId = `remove_pre_whitelist_${Date.now()}_${currentUser.uid}`;
      await setDoc(doc(db, 'auditLogs', logId), {
        id: logId,
        reportDate: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        userId: currentUser.uid,
        userEmail: currentUser.email || '',
        userDisplayName: currentUser.displayName || 'Authorized Admin',
        userRole: currentRole,
        modifiedFields: ['whitelistedEmails'],
        action: 'update',
        details: `Removed hospital email whitelisting approval check for: '${email}'.`
      });

      showNotification(`De-whitelisted pre-emptive check for ${email}.`);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error(err);
      alert("Could not remove pre-whitelisted email.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWhitelist) {
      alert("Unauthorized Action: Only CMO, CNO, or admin accounts can create users.");
      return;
    }

    if (newUserPassword.length < 6) {
      alert("Password must be at least 6 characters long.");
      return;
    }

    const emailToSave = newUserEmail.trim().toLowerCase();
    if (!emailToSave) return;

    if (users.some(u => u.email.toLowerCase() === emailToSave)) {
      showNotification("This email address is already registered.");
      return;
    }

    setActionLoading('create_user');
    try {
      // Create user using secondary app instance so current admin does not get logged out
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailToSave, newUserPassword);
      const newUid = userCredential.user.uid;

      // Ensure they are whitelisted and have the right role
      const designation = 
        newUserRole === 'admin' ? 'Clinic Manager' :
        newUserRole === 'cmo' ? 'Chief Medical Officer' :
        newUserRole === 'cno' ? 'Chief Nursing Officer' : 'Night Superintendent';

      await setDoc(doc(db, 'users', newUid), {
        uid: newUid,
        email: emailToSave,
        displayName: newUserDisplayName || designation,
        role: newUserRole,
        designation: designation,
        whitelisted: true,
        createdAt: new Date().toISOString()
      });

      // Optionally sign them out of the secondary instance immediately
      await secondaryAuth.signOut();

      // Log it
      const logId = `create_user_${Date.now()}_${currentUser.uid}`;
      await setDoc(doc(db, 'auditLogs', logId), {
        id: logId,
        reportDate: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        userId: currentUser.uid,
        userEmail: currentUser.email || '',
        userDisplayName: currentUser.displayName || 'Authorized Admin',
        userRole: currentRole,
        modifiedFields: ['users'],
        action: 'create',
        details: `Created new staff account for '${emailToSave}' with pre-authorized role: '${newUserRole}'.`
      });

      showNotification(`Account created for ${emailToSave} successfully.`);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserDisplayName('');
      setNewUserRole('supervisor');
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        alert("This email is already registered in the system. If they are not in the list below, they may have an uninitialized profile. They can sign in directly or you can add them to the Pre-Whitelist.");
      } else {
        alert("Could not create user account. " + err.message);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(u => {
    return (
      (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.designation || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  if (!canWhitelist) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8 max-w-lg mx-auto text-center space-y-4 font-sans">
        <ShieldAlert className="h-14 w-14 text-rose-500 mx-auto animate-bounce" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Access Privileges Required</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          The User Whitelist Panel is restricted strictly to <b>Chief Medical Officer (CMO)</b>, <b>Chief Nursing Officer (CNO)</b>, or accounts assigned the <b>administrator role</b>.
        </p>
        <p className="text-[11px] text-slate-400 italic bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border">
          Your active Designation: {currentDesignation || 'Supervisor'} ({currentRole})
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      
      {successMessage && (
        <div className="bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-400 text-xs font-semibold p-4 rounded-xl border border-teal-100 dark:border-teal-900/40 flex items-center gap-2.5 transition-all animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorVal && (
        <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-400 text-xs font-semibold p-4 rounded-xl border border-rose-100 dark:border-rose-900/40 flex items-center gap-2.5 transition-all animate-in fade-in">
          <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0" />
          <div className="flex-1">
            <span className="font-bold">Sync Error:</span> {errorVal}
            <button 
              onClick={() => setRefreshTrigger(prev => prev + 1)}
              className="ml-3 text-rose-600 dark:text-rose-300 underline font-bold hover:text-rose-700 hover:no-underline"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Registered Users search and manage */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-xl overflow-hidden transition-colors">
            <div className="p-5 border-b border-slate-150 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20">
              <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-teal-600" />
                Active Registered Users Registry
              </h2>
              <p className="text-[11px] text-slate-500 mt-1 dark:text-slate-400">
                Grant/revoke whitelisted system capabilities and manage user access permissions safely.
              </p>
            </div>

            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/10">
              <div className="relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search registered staff by name, title, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="h-8 w-8 border-3 border-teal-600 border-t-transparent animate-spin rounded-full mx-auto mb-3" />
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Synchronizing profiles...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 shrink-0">
                <Mail className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Registered Users found</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map((user) => (
                  <div key={user.uid} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 font-bold flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0 mt-0.5 border dark:border-slate-700">
                        {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{user.displayName}</p>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                            user.role === 'admin' 
                              ? 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30' 
                              : user.role === 'cmo'
                              ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30'
                              : user.role === 'cno'
                              ? 'bg-cyan-50 text-cyan-700 border-cyan-100 dark:bg-cyan-950/20 dark:text-cyan-400 dark:border-cyan-900/30'
                              : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-350 dark:border-slate-705'
                          }`}>
                            {user.role}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{user.designation || 'Night Team Specialist'}</p>
                        <p className="text-[10px] text-slate-450 dark:text-slate-500 font-mono mt-0.5">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:items-end justify-center gap-2.5 pt-3 sm:pt-0 border-t sm:border-transparent dark:border-slate-800 -mx-4 sm:mx-0 px-4 sm:px-0">
                      
                      {/* Whitelist Switcher */}
                      <button
                        onClick={() => handleToggleWhitelist(user)}
                        disabled={actionLoading === user.uid || user.email === 'tumutumuclinicmanager@gmail.com' || user.email === 'wangechigodfrey77@gmail.com'}
                        className={`flex items-center gap-2 text-xs font-semibold py-1.5 px-3 rounded-lg border transition-all cursor-pointer disabled:opacity-50 ${
                          user.whitelisted || user.email === 'tumutumuclinicmanager@gmail.com' || user.email === 'wangechigodfrey77@gmail.com'
                            ? 'bg-teal-50 hover:bg-teal-100 text-teal-800 border-teal-150 dark:bg-teal-950/25 dark:text-teal-400 dark:border-teal-900/40'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-150 dark:bg-rose-950/25 dark:text-rose-400 dark:border-rose-900/40'
                        }`}
                        title="Click to toggle whitelisting"
                      >
                        {user.whitelisted || user.email === 'tumutumuclinicmanager@gmail.com' || user.email === 'wangechigodfrey77@gmail.com' ? (
                          <>
                            <UserCheck className="h-4 w-4 text-teal-600" />
                            <span>Authorized (Whitelisted)</span>
                          </>
                        ) : (
                          <>
                            <UserX className="h-4 w-4 text-rose-600" />
                            <span>Whitelisting Blocked</span>
                          </>
                        )}
                      </button>

                      {/* Upgrade/Downgrade select dropdown */}
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">System Role:</span>
                        <select
                          value={user.role}
                          onChange={(e) => handleChangeRole(user, e.target.value as any)}
                          disabled={actionLoading === user.uid + '_role' || user.email === 'tumutumuclinicmanager@gmail.com' || user.email === 'wangechigodfrey77@gmail.com'}
                          className="bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-teal-500"
                        >
                          <option value="supervisor">Night Supervisor</option>
                          <option value="cmo">CMO (Chief Medical Officer)</option>
                          <option value="cno">CNO (Chief Nursing Officer)</option>
                          <option value="admin">Super Admin</option>
                        </select>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Pre-Whitelist form and list */}
        <div className="space-y-4">
          
          {/* Create User form */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-xl p-5 space-y-4 transition-colors">
            <div>
              <h3 className="text-xs uppercase font-bold tracking-widest text-slate-400">Account Creation</h3>
              <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 mt-1 leading-snug">Create Staff Account</h2>
              <p className="text-[10px] text-slate-550 dark:text-slate-400 mt-0.5">
                Directly create a new user account with an email and password.
              </p>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="name@tumutumuhospital.org"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="relative">
                <Key className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="Temporary Password (min 6 chars)"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  minLength={6}
                  className="w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="relative">
                <UserCheck className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Display Name (optional)"
                  value={newUserDisplayName}
                  onChange={(e) => setNewUserDisplayName(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Account Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="supervisor">Night Supervisor (Supervisor)</option>
                  <option value="cmo">Chief Medical Officer (CMO)</option>
                  <option value="cno">Chief Nursing Officer (CNO)</option>
                  <option value="admin">Super Admin / Clinic Manager</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={actionLoading === 'create_user'}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold tracking-wide shadow-md shadow-blue-600/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <UserPlus className="h-4 w-4" />
                Create Account
              </button>
            </form>
          </div>

          {/* Pre-whitelist a new email form */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-xl p-5 space-y-4 transition-colors">
            <div>
              <h3 className="text-xs uppercase font-bold tracking-widest text-slate-400">Pre-Authorization</h3>
              <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 mt-1 leading-snug">Whitelist New Staff Email</h2>
              <p className="text-[10px] text-slate-550 dark:text-slate-400 mt-0.5">
                Grant Instant Authorization on signup. Add their hospital email below.
              </p>
            </div>

            <form onSubmit={handleAddPreWhitelist} className="space-y-3.5">
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="name@tumutumuhospital.org"
                  value={newEmailToWhitelist}
                  onChange={(e) => setNewEmailToWhitelist(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Pre-Authorized Account Role</label>
                <select
                  value={selectedRoleToWhitelist}
                  onChange={(e) => setSelectedRoleToWhitelist(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 font-semibold"
                >
                  <option value="supervisor">Night Supervisor (Supervisor)</option>
                  <option value="cmo">Chief Medical Officer (CMO)</option>
                  <option value="cno">Chief Nursing Officer (CNO)</option>
                  <option value="admin">Super Admin / Clinic Manager</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={actionLoading === 'add_email'}
                className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold tracking-wide shadow-md shadow-teal-600/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Shield className="h-4 w-4" />
                Pre-Authorize Email
              </button>
            </form>
          </div>

          {/* List of currently pre-authorized emails */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-xl p-5 transition-colors">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-450 border-b pb-2.5 mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-teal-600 shrink-0" />
              Pre-Authorized Emails ({preWhitelisted.length})
            </h3>

            {preWhitelisted.length === 0 ? (
              <p className="text-[10px] text-slate-400 italic text-center py-6">
                No pre-authorized emails currently.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {preWhitelisted.map((entry) => (
                  <div key={entry.email} className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate">{entry.email}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 font-extrabold px-1.5 py-0.2 rounded uppercase">
                          {entry.role === 'admin' ? 'Admin' :
                           entry.role === 'cmo' ? 'CMO' :
                           entry.role === 'cno' ? 'CNO' : 'Supervisor'}
                        </span>
                        <span className="text-[9px] text-slate-400">• By {entry.addedBy}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemovePreWhitelist(entry.email)}
                      disabled={actionLoading === 'remove_pw_' + entry.email}
                      className="p-1 px-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-500 rounded-lg transition-all cursor-pointer border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30 shrink-0"
                      title="Revoke Pre-Authorization"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
