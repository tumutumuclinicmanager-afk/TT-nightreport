export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'supervisor' | 'cmo' | 'cno' | 'admin';
  designation?: string;
  createdAt: string;
}

export interface PatientStats {
  hdu: number | null;
  icu: number | null;
  ward1: number | null;
  ward2: number | null;
  ward5: number | null;
  ward6: number | null;
  shalom: number | null;
  nbu: number | null;
  ward3SurgGyn: number | null;
  ward3Medical: number | null;
  ward3Paeds: number | null;
  ward4Antenatal: number | null;
  ward4Postnatal: number | null;
  ward4PostCS: number | null;
  ward7Surgical: number | null;
  ward7Gynae: number | null;
  ward7Medical: number | null;
}

export interface AdmissionStats {
  ward1: number | null;
  ward2: number | null;
  ward3: number | null;
  ward4: number | null;
  ward5: number | null;
  ward6: number | null;
  ward7: number | null;
  shalom: number | null;
  nbu: number | null;
  transferIn: number | null;
  transferOut: number | null;
  hduIcu: number | null;
}

export interface EmergencyStats {
  traumaRta: number | null;
  traumaAssaults: number | null;
  emCS: number | null;
}

export interface MorgueStats {
  startOfShift: number | null;
  shiftAdmissions: number | null;
  others: number | null;
}

export interface RadiologyStats {
  xray: number | null;
  ultrasound: number | null;
  ctScan: number | null;
}

export interface DeathRecord {
  id: string;
  patientName: string;
  patientId: string;
  ward: string;
  time: string;
  cause: string;
}

export interface IncidentRecord {
  id: string;
  category: 'maternal' | 'neonatal' | 'surgical' | 'infrastructure' | 'other';
  details: string;
}

export interface DeliveryRecord {
  id: string;
  motherName: string;
  deliveryType: 'Normal SVD' | 'C/S' | 'Breech' | 'Assisted';
  outcome: 'Live Birth' | 'Stillbirth' | 'Neonatal Death';
  babyGender: 'Male' | 'Female';
  time: string;
}

export interface BloodTransfusion {
  id: string;
  patientName: string;
  ward: string;
  units: number;
  indication: string;
}

export interface MajorProcedure {
  id: string;
  patientName: string;
  procedureName: string;
  surgeon: string;
  outcome: string;
}

export interface CMOComment {
  id: string;
  commenterName: string;
  commenterRole: string;
  commentText: string;
  timestamp: string;
}

export interface NightReport {
  id: string; // usually date e.g. "YYYY-MM-DD"
  date: string;
  nightSuperName: string;
  nightSuperUid: string;
  status: 'draft' | 'submitted';
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  
  opdAttendance: number | null;
  patientStats: PatientStats;
  admissions: AdmissionStats;
  emergencies: EmergencyStats;
  morgue: MorgueStats;
  radiology: RadiologyStats;
  
  deaths: DeathRecord[];
  incidents: IncidentRecord[];
  deliveries: DeliveryRecord[];
  bloodTransfusions: BloodTransfusion[];
  majorProcedures: MajorProcedure[];
  
  stockOuts: string;
  staffingNotes: string;
  generalRemarks: string;
  
  digitalSignature: string; // Base64 Canvas Drawing or Typed Name
  cmoComments: CMOComment[];
}
