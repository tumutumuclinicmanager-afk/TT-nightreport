import { NightReport, PatientStats, AdmissionStats, EmergencyStats, MorgueStats, RadiologyStats } from '../types/report';

export function getCurrentShiftDate(): string {
  const now = new Date();
  const hours = now.getHours();
  
  let targetDate = now;
  // If we are in the morning before 8 AM, the shift belongs to the previous day (yesterday)
  if (hours < 8) {
    targetDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  
  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  
  return `${yyyy}-${mm}-${dd}`;
}

export function getInitialPatientStats(): PatientStats {
  return {
    hdu: null,
    icu: null,
    ward1: null,
    ward2: null,
    ward5: null,
    ward6: null,
    shalom: null,
    nbu: null,
    ward3SurgGyn: null,
    ward3Medical: null,
    ward3Paeds: null,
    ward4Antenatal: null,
    ward4Postnatal: null,
    ward4PostCS: null,
    ward7Surgical: null,
    ward7Gynae: null,
    ward7Medical: null
  };
}

export function getInitialAdmissions(): AdmissionStats {
  return {
    ward1: null,
    ward2: null,
    ward3: null,
    ward4: null,
    ward5: null,
    ward6: null,
    ward7: null,
    shalom: null,
    nbu: null,
    transferIn: null,
    transferOut: null,
    hduIcu: null
  };
}

export function getInitialEmergencies(): EmergencyStats {
  return {
    traumaRta: null,
    traumaAssaults: null,
    emCS: null
  };
}

export function getInitialMorgue(): MorgueStats {
  return {
    startOfShift: null,
    shiftAdmissions: null,
    others: null
  };
}

export function getInitialRadiology(): RadiologyStats {
  return {
    xray: null,
    ultrasound: null,
    ctScan: null
  };
}

export function createEmptyReport(date: string, superName: string, superUid: string): NightReport {
  return {
    id: date,
    date,
    nightSuperName: superName,
    nightSuperUid: superUid,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    opdAttendance: null,
    patientStats: getInitialPatientStats(),
    admissions: getInitialAdmissions(),
    emergencies: getInitialEmergencies(),
    morgue: getInitialMorgue(),
    radiology: getInitialRadiology(),
    deaths: [],
    incidents: [],
    deliveries: [],
    bloodTransfusions: [],
    majorProcedures: [],
    stockOuts: '',
    staffingNotes: '',
    generalRemarks: '',
    digitalSignature: '',
    cmoComments: []
  };
}

export function getSampleReports(nightSuperUid: string): NightReport[] {
  const reports: NightReport[] = [];
  const today = new Date();
  
  // Create 10 continuous historical reports for analytics and trend mapping
  for (let i = 1; i <= 10; i++) {
    const reportDate = new Date();
    reportDate.setDate(today.getDate() - i);
    const dateStr = reportDate.toISOString().split('T')[0];
    
    // Generate organic numbers for visual aesthetic in charts
    const opdAttendance = Math.floor(Math.random() * 25) + 10; // 10-35
    
    const pStats: PatientStats = {
      hdu: Math.floor(Math.random() * 4) + 1,
      icu: Math.floor(Math.random() * 2),
      ward1: Math.floor(Math.random() * 12) + 5,
      ward2: Math.floor(Math.random() * 15) + 8,
      ward5: Math.floor(Math.random() * 10) + 4,
      ward6: Math.floor(Math.random() * 14) + 6,
      shalom: Math.floor(Math.random() * 8) + 2,
      nbu: Math.floor(Math.random() * 6) + 2,
      ward3SurgGyn: Math.floor(Math.random() * 8) + 3,
      ward3Medical: Math.floor(Math.random() * 12) + 4,
      ward3Paeds: Math.floor(Math.random() * 10) + 3,
      ward4Antenatal: Math.floor(Math.random() * 6) + 2,
      ward4Postnatal: Math.floor(Math.random() * 10) + 5,
      ward4PostCS: Math.floor(Math.random() * 5) + 1,
      ward7Surgical: Math.floor(Math.random() * 8) + 2,
      ward7Gynae: Math.floor(Math.random() * 6) + 2,
      ward7Medical: Math.floor(Math.random() * 10) + 4
    };

    const adms: AdmissionStats = {
      ward1: Math.floor(Math.random() * 3),
      ward2: Math.floor(Math.random() * 4),
      ward3: Math.floor(Math.random() * 3),
      ward4: Math.floor(Math.random() * 4),
      ward5: Math.floor(Math.random() * 2),
      ward6: Math.floor(Math.random() * 3),
      ward7: Math.floor(Math.random() * 2),
      shalom: Math.floor(Math.random() * 3),
      nbu: Math.floor(Math.random() * 4) + 1,
      transferIn: Math.floor(Math.random() * 2),
      transferOut: Math.floor(Math.random() * 2),
      hduIcu: Math.floor(Math.random() * 2)
    };

    const emStats: EmergencyStats = {
      traumaRta: Math.floor(Math.random() * 3),
      traumaAssaults: Math.floor(Math.random() * 2),
      emCS: Math.floor(Math.random() * 2) + (Math.random() > 0.5 ? 1 : 0)
    };

    const dRecords = [];
    if (Math.random() > 0.7) {
      dRecords.push({
        id: `d-${i}-1`,
        patientName: `Patient-${100 + i}`,
        patientId: `IP-${5000 + i}`,
        ward: ['Ward 2', 'Ward 3 (Medical)', 'Ward 5', 'ICU'][Math.floor(Math.random() * 4)],
        time: "02:45 AM",
        cause: "Cardiopulmonary arrest secondary to severe pneumonia"
      });
    }

    const delRecords = [];
    if (Math.random() > 0.4) {
      delRecords.push({
        id: `del-${i}-1`,
        motherName: `Mother-${200 + i}`,
        deliveryType: Math.random() > 0.4 ? 'Normal SVD' as const : 'C/S' as const,
        outcome: 'Live Birth' as const,
        babyGender: Math.random() > 0.5 ? 'Male' as const : 'Female' as const,
        time: "11:30 PM"
      });
    }

    reports.push({
      id: dateStr,
      date: dateStr,
      nightSuperName: "Night Superintendent Test",
      nightSuperUid,
      status: 'submitted',
      createdAt: reportDate.toISOString(),
      updatedAt: reportDate.toISOString(),
      submittedAt: reportDate.toISOString(),
      opdAttendance,
      patientStats: pStats,
      admissions: adms,
      emergencies: emStats,
      morgue: {
        startOfShift: Math.floor(Math.random() * 5) + 2,
        shiftAdmissions: dRecords.length,
        others: 0
      },
      radiology: {
        xray: Math.floor(Math.random() * 8) + 2,
        ultrasound: Math.floor(Math.random() * 4) + 1,
        ctScan: Math.floor(Math.random() * 2)
      },
      deaths: dRecords,
      incidents: Math.random() > 0.8 ? [{
        id: `inc-${i}-1`,
        category: 'infrastructure',
        details: "Oxygen central pressure gauge drop noticed and corrected by nursing staff immediately."
      }] : [],
      deliveries: delRecords,
      bloodTransfusions: Math.random() > 0.6 ? [{
        id: `bt-${i}-1`,
        patientName: `Patient-BT-${i}`,
        ward: "Ward 4 (Post C/S)",
        units: 2,
        indication: "Postpartum Hemorrhage follow up"
      }] : [],
      majorProcedures: Math.random() > 0.6 ? [{
        id: `mp-${i}-1`,
        patientName: `Patient-MP-${i}`,
        procedureName: "Emergency Caesarean Section",
        surgeon: "Dr. Kamau",
        outcome: "Successful delivery, stable mother and newborn"
      }] : [],
      stockOuts: Math.random() > 0.82 ? "Zinc oxide strapping tape short out." : "None reported.",
      staffingNotes: "Normal roster staffing coverage.",
      generalRemarks: "The shift was busy but generally peaceful.",
      digitalSignature: "Night Superintendent Test",
      cmoComments: i === 1 ? [{
        id: `comment-1`,
        commenterName: "Dr. James CMO",
        commenterRole: "Chief Medical Officer",
        commentText: "Great report. Detailed and well logged. Thanks for the quick update on Central Oxygen monitoring.",
        timestamp: new Date().toISOString()
      }] : []
    });
  }

  return reports;
}
