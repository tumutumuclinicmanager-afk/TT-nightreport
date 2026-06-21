import { NightReport, PatientStats, AdmissionStats, EmergencyStats, MorgueStats, RadiologyStats } from '../types/report';

/**
 * Calculates which high-level sections and fields of a NightReport changed between edit states.
 */
export function getReportDiff(oldReport: NightReport | null, newReport: NightReport): string[] {
  const modifiedFields: string[] = [];
  if (!oldReport) {
    return ['All Fields (Initial Submission)'];
  }

  // General details
  if (oldReport.nightSuperName !== newReport.nightSuperName) modifiedFields.push('Night Superintendent Name');
  if (oldReport.status !== newReport.status) modifiedFields.push('Status');
  if (oldReport.opdAttendance !== newReport.opdAttendance) modifiedFields.push('OPD Attendance');
  if (oldReport.stockOuts !== newReport.stockOuts) modifiedFields.push('Stockouts');
  if (oldReport.staffingNotes !== newReport.staffingNotes) modifiedFields.push('Staffing Notes');
  if (oldReport.generalRemarks !== newReport.generalRemarks) modifiedFields.push('General Remarks');
  if (oldReport.digitalSignature !== newReport.digitalSignature) modifiedFields.push('Digital Signature');

  // patientStats
  if (oldReport.patientStats && newReport.patientStats) {
    const keys = Object.keys(newReport.patientStats) as Array<keyof PatientStats>;
    const statsChanged = keys.some(k => oldReport.patientStats[k] !== newReport.patientStats[k]);
    if (statsChanged) modifiedFields.push('Patient Statistics Wards');
  } else if (oldReport.patientStats || newReport.patientStats) {
    modifiedFields.push('Patient Statistics Wards');
  }

  // admissions
  if (oldReport.admissions && newReport.admissions) {
    const keys = Object.keys(newReport.admissions) as Array<keyof AdmissionStats>;
    const admsChanged = keys.some(k => oldReport.admissions[k] !== newReport.admissions[k]);
    if (admsChanged) modifiedFields.push('Admission Ward Spread');
  } else if (oldReport.admissions || newReport.admissions) {
    modifiedFields.push('Admission Ward Spread');
  }

  // emergencies
  if (oldReport.emergencies && newReport.emergencies) {
    const keys = Object.keys(newReport.emergencies) as Array<keyof EmergencyStats>;
    const emsChanged = keys.some(k => oldReport.emergencies[k] !== newReport.emergencies[k]);
    if (emsChanged) modifiedFields.push('Emergency & Trauma Logs');
  } else if (oldReport.emergencies || newReport.emergencies) {
    modifiedFields.push('Emergency & Trauma Logs');
  }

  // morgue
  if (oldReport.morgue && newReport.morgue) {
    const keys = Object.keys(newReport.morgue) as Array<keyof MorgueStats>;
    const morgueChanged = keys.some(k => oldReport.morgue[k] !== newReport.morgue[k]);
    if (morgueChanged) modifiedFields.push('Morgue Operations');
  } else if (oldReport.morgue || newReport.morgue) {
    modifiedFields.push('Morgue Operations');
  }

  // radiology
  if (oldReport.radiology && newReport.radiology) {
    const keys = Object.keys(newReport.radiology) as Array<keyof RadiologyStats>;
    const radsChanged = keys.some(k => oldReport.radiology[k] !== newReport.radiology[k]);
    if (radsChanged) modifiedFields.push('Radiology Scans');
  } else if (oldReport.radiology || newReport.radiology) {
    modifiedFields.push('Radiology Scans');
  }

  // Logs / arrays
  if (JSON.stringify(oldReport.deaths || []) !== JSON.stringify(newReport.deaths || [])) modifiedFields.push('Deceased Logs');
  if (JSON.stringify(oldReport.incidents || []) !== JSON.stringify(newReport.incidents || [])) modifiedFields.push('Incident Records');
  if (JSON.stringify(oldReport.deliveries || []) !== JSON.stringify(newReport.deliveries || [])) modifiedFields.push('Maternity Deliveries');
  if (JSON.stringify(oldReport.bloodTransfusions || []) !== JSON.stringify(newReport.bloodTransfusions || [])) modifiedFields.push('Blood Transfusions');
  if (JSON.stringify(oldReport.majorProcedures || []) !== JSON.stringify(newReport.majorProcedures || [])) modifiedFields.push('Surgical Workouts');
  if (JSON.stringify(oldReport.cmoComments || []) !== JSON.stringify(newReport.cmoComments || [])) modifiedFields.push('CMO & Management Comments');

  return Array.from(new Set(modifiedFields));
}

/**
 * Validates if the user is authorized to perform whitelisting functions.
 * Allowed roles/titles: CMO, CNO, admin, or the specific email.
 */
export function isAllowedToWhitelist(role: string, designation?: string, email?: string): boolean {
  const userRole = role || 'supervisor';
  const rawDesignation = (designation || '').toLowerCase();
  const rawEmail = (email || '').toLowerCase();

  if (rawEmail === 'tumutumuclinicmanager@gmail.com') return true;
  if (userRole === 'admin') return true;
  
  if (rawDesignation.includes('cmo') || rawDesignation.includes('chief medical officer') || rawDesignation.includes('chief medical director')) return true;
  if (rawDesignation.includes('cno') || rawDesignation.includes('chief nursing officer') || rawDesignation.includes('chief nursing director')) return true;

  return false;
}

/**
 * Determines if a user profile is whitelisted or authorized by default (such as admin/CMO/CNO accounts).
 */
export function isUserWhitelistedOrAuthorized(profile: any): boolean {
  if (!profile) return false;
  
  const rawEmail = (profile.email || '').toLowerCase();
  if (rawEmail === 'tumutumuclinicmanager@gmail.com') return true;
  
  if (profile.whitelisted === true) return true;

  // Bootstrapping auto-whitelist for high-privilege designations/roles
  const d = (profile.designation || '').toLowerCase();
  if (profile.role === 'admin') return true;
  if (d.includes('cmo') || d.includes('chief medical officer') || d.includes('chief medical director')) return true;
  if (d.includes('cno') || d.includes('chief nursing officer') || d.includes('chief nursing director')) return true;

  return false;
}
