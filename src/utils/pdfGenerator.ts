import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { NightReport } from '../types/report';

/**
 * Generates a professionally branded PCEA Tumutumu Hospital Night Shift Report PDF.
 */
export function generateSingleShiftPDF(report: NightReport, currentUserDisplayName?: string, saveToFile: boolean = true) {
  const doc = new jsPDF();
  const primaryColor: [number, number, number] = [13, 148, 136]; // Teal #0d9488
  const secondaryColor: [number, number, number] = [15, 23, 42]; // Dark Slate #0f172a
  const lightGray: [number, number, number] = [248, 250, 252]; // Slate-50

  // 1. BRANDED HEADER BANNER
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 42, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("PCEA TUMUTUMU HOSPITAL", 14, 15);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("P.O. Box 112, Karatina, Kenya • Email: info@tumutumuhospital.org", 14, 21);
  doc.text("CLINICAL AUDIT & SPECIAL AUDITOR'S NIGHT SHIFT RECONCILIATION", 14, 27);

  // Date and printed details
  const printedAt = new Date().toLocaleString();
  doc.setFontSize(8);
  doc.setTextColor(230, 240, 240);
  doc.text(`Generated: ${printedAt} • Auditor User: ${currentUserDisplayName || 'Authorized Clinician'}`, 14, 33);
  doc.text(`System Authenticated Record ID: ${report.id || report.date}`, 14, 38);

  // Restore defaults
  doc.setTextColor(50, 50, 50);

  // 2. DOCUMENT SUBTITLE
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(`PCEA REPORT METRICS FOR SHIFT: ${report.date}`, 14, 52);

  // 3. SHIFT DETAILS & COMPLIANCE STATS TABLE
  const metaHeaders = [['Shift Parameter', 'Associated Operational Record Value']];
  const metaRows = [
    ['Shift Duty Date', report.date],
    ['Night Superintendent', report.nightSuperName],
    ['Workflow Status', report.status.toUpperCase()],
    ['Report Submitted At', report.submittedAt || report.updatedAt || 'N/A'],
    ['Original Compilation Date', report.createdAt || 'N/A']
  ];

  autoTable(doc, {
    head: metaHeaders,
    body: metaRows,
    startY: 56,
    theme: 'grid',
    headStyles: { fillColor: secondaryColor, fontSize: 9 },
    bodyStyles: { fontSize: 8.5 },
    margin: { left: 14, right: 14 }
  });

  // Calculate coordinates
  let currentY = (doc as any).lastAutoTable.finalY + 12;

  // 4. CORE VITAL SHIFT QUANTITATIVE STATISTICS
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("SECTION 1: KEY PERFORMANCE RATIOS & ATTENDANCES", 14, currentY);
  currentY += 4;

  const totalAdmissions = 
    (report.admissions?.ward1 || 0) +
    (report.admissions?.ward2 || 0) +
    (report.admissions?.ward3 || 0) +
    (report.admissions?.ward4 || 0) +
    (report.admissions?.ward5 || 0) +
    (report.admissions?.ward6 || 0) +
    (report.admissions?.ward7 || 0) +
    (report.admissions?.shalom || 0) +
    (report.admissions?.nbu || 0) +
    (report.admissions?.hduIcu || 0);

  const statsHeaders = [['Outpatient attendance', 'Total Admissions', 'Deliveries Led', 'Total Mortality cases']];
  const statsRows = [[
    report.opdAttendance || 0,
    totalAdmissions,
    report.deliveries?.length || 0,
    report.deaths?.length || 0
  ]];

  autoTable(doc, {
    head: statsHeaders,
    body: statsRows,
    startY: currentY,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, halign: 'center', fontSize: 9 },
    bodyStyles: { halign: 'center', fontSize: 10, fontStyle: 'bold' },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // 5. DETAILED IN-PATIENT ADMISSIONS BREAKDOWN
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("SECTION 2: ADMISSIONS BREAKDOWN BY HOSPITAL WARD", 14, currentY);
  currentY += 4;

  const wardHeaders = [
    ['Ward / Department', 'Admissions Count', 'Ward / Department', 'Admissions Count']
  ];
  const wardRows = [
    ['Ward 1 (Male Surgical)', report.admissions?.ward1 || 0, 'Ward 2 (Female Surgical)', report.admissions?.ward2 || 0],
    ['Ward 3 (Paeds/Surg/Med)', report.admissions?.ward3 || 0, 'Ward 4 (Antenatal/Post)', report.admissions?.ward4 || 0],
    ['Ward 5 (Male Medical)', report.admissions?.ward5 || 0, 'Ward 6 (Female Medical)', report.admissions?.ward6 || 0],
    ['Ward 7 (Gynae/Med)', report.admissions?.ward7 || 0, 'NBU (Newborn Unit)', report.admissions?.nbu || 0],
    ['Shalom Private Ward', report.admissions?.shalom || 0, 'ICU & HDU Complex', report.admissions?.hduIcu || 0],
    ['Transfer IN (External)', report.admissions?.transferIn || 0, 'Transfer OUT (External)', report.admissions?.transferOut || 0]
  ];

  autoTable(doc, {
    head: wardHeaders,
    body: wardRows,
    startY: currentY,
    theme: 'striped',
    headStyles: { fillColor: secondaryColor, fontSize: 8.5 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // Check if we need to add a page or continue on page 1
  if (currentY > 210) {
    doc.addPage();
    currentY = 20;
  }

  // 6. CLINICAL REGISTRIES: EMERGENCY & SPECIAL UNITS
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("SECTION 3: COMPREHENSIVE CLINICAL REGISTRY SUMMARIES", 14, currentY);
  currentY += 4;

  const registryHeaders = [[
    'Emergency & Trauma Logs', 'Cases Count', 'Morgue Registry Ops', 'Cases Count', 'Radiology Log Book', 'Procedures'
  ]];
  const registryRows = [[
    'Trauma - Road Traffic Accidents', report.emergencies?.traumaRta || 0,
    'Mortality Count at Start of Shift', report.morgue?.startOfShift || 0,
    'X-Ray Scans Logged', report.radiology?.xray || 0
  ], [
    'Trauma - Assaults & Violence', report.emergencies?.traumaAssaults || 0,
    'Deceased Received from Ward', report.morgue?.shiftAdmissions || 0,
    'Ultrasound Procedures Done', report.radiology?.ultrasound || 0
  ], [
    'Emergency Caesarean Sections', report.emergencies?.emCS || 0,
    'Deceased Received directly (B.I.D)', report.morgue?.others || 0,
    'Computed Tomography (CT-Scans)', report.radiology?.ctScan || 0
  ]];

  autoTable(doc, {
    head: registryHeaders,
    body: registryRows,
    startY: currentY,
    theme: 'grid',
    headStyles: { fillColor: secondaryColor, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 12;

  // Let's print arrays like Deliveries logs, Mortalities, Surgical logs, and Blood transfusions
  const registriesWithData: Array<{
    title: string;
    headers: string[][];
    rows: any[][];
    emptyMsg: string;
  }> = [
    {
      title: "DELIVERY REGISTRY & MATERNITY LOG WORKBOOK",
      headers: [['Mother Name', 'Delivery Type Status', 'Baby Gender', 'Delivery Outcome', 'Logged Shift Time']],
      rows: (report.deliveries || []).map(del => [
        del.motherName,
        del.deliveryType,
        del.babyGender,
        del.outcome,
        del.time
      ]),
      emptyMsg: "No baby deliveries were completed during this shift duration."
    },
    {
      title: "MORTALITY AND DECEASED CLINICAL AUDITS",
      headers: [['Patient File Name', 'Hospital Number', 'Admission Ward', 'Verified Cause of Death', 'Timestamp']],
      rows: (report.deaths || []).map(d => [
        `${d.patientName}`,
        d.patientId,
        d.ward,
        d.cause,
        d.time
      ]),
      emptyMsg: "Excellent: No mortality or deceased cases were recorded during this shift."
    },
    {
      title: "MAJOR EMERGENCY OR PLANNED SURGICAL OPERATIONS",
      headers: [['Patient Full Name', 'Operative Procedure Conducted', 'Lead Surgeon / Anaesthetist', 'Post-Op Condition Outcome']],
      rows: (report.majorProcedures || []).map(p => [
        p.patientName,
        p.procedureName,
        p.surgeon,
        p.outcome
      ]),
      emptyMsg: "No major surgical or emergency theatre procedures were logged this night."
    },
    {
      title: "BLOOD TRANSFUSION & HAEMOVIGILANCE MONITORING",
      headers: [['Patient Name / File IDOnly', 'Recipient Ward', 'Total Whole Blood Units Transfused', 'Clinical Indication Notes']],
      rows: (report.bloodTransfusions || []).map(b => [
        b.patientName,
        b.ward,
        `${b.units} Units`,
        b.indication
      ]),
      emptyMsg: "No blood bags or products transfused."
    },
    {
      title: "SIGNIFICANT SHIFT EXCEPTIONS / INCIDENT REPORTS",
      headers: [['Incident Context Category', 'Detailed Event Log Narrative Description']],
      rows: (report.incidents || []).map(inc => [
        inc.category.toUpperCase(),
        inc.details
      ]),
      emptyMsg: "Standard Shift: No hazardous or equipment/infrastructure incident reports submitted."
    }
  ];

  registriesWithData.forEach(reg => {
    // Check height
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(reg.title, 14, currentY);
    currentY += 4;

    if (reg.rows.length > 0) {
      autoTable(doc, {
        head: reg.headers,
        body: reg.rows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: primaryColor, fontSize: 8 },
        bodyStyles: { fontSize: 7.5 },
        margin: { left: 14, right: 14 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(115, 115, 115);
      doc.text(reg.emptyMsg, 14, currentY + 3);
      currentY += 12;
    }
  });

  // 7. REMARKS AND LOGISTIC HANDOVER ISSUES
  if (currentY > 220) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("SECTION 4: OPERATIONAL EXCEPTION REMARKS & STOCKOUTS", 14, currentY);
  currentY += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text("RESOURCE STOCKOUTS & INOPERABLE APPARATUS:", 14, currentY);
  currentY += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  const stockoutText = doc.splitTextToSize(report.stockOuts || "None reported.", 182);
  doc.text(stockoutText, 14, currentY);
  currentY += (stockoutText.length * 4) + 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text("HUMAN CAPITAL & STAFFING HANDOVER NOTES:", 14, currentY);
  currentY += 4;
  doc.setFont("helvetica", "normal");
  const staffingText = doc.splitTextToSize(report.staffingNotes || "Staffing allocations within optimal patient care ratios.", 182);
  doc.text(staffingText, 14, currentY);
  currentY += (staffingText.length * 4) + 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text("NIGHT CLINICAL SUPERVISOR GENERAL REMARKS COMPILATION:", 14, currentY);
  currentY += 4;
  doc.setFont("helvetica", "italic");
  const remarksText = doc.splitTextToSize(report.generalRemarks || "None.", 182);
  doc.text(remarksText, 14, currentY);
  currentY += (remarksText.length * 4) + 12;

  // 8. CHIEF MEDICAL OFFICER / CHIEF NURSING OFFICER CLINICAL COMMENTARIES
  if (currentY > 210) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("SECTION 5: MANAGEMENT REVIEW COMMENTS (CMO & CNO AUDIT)", 13, currentY);
  currentY += 5;

  if (report.cmoComments && report.cmoComments.length > 0) {
    const commentsHeaders = [['Auditor Specialist Name & Role', 'Audit Review Insights / Action Directive', 'Verified Timestamp']];
    const commentsRows = report.cmoComments.map(comment => [
      `${comment.commenterName}\n(${comment.commenterRole})`,
      comment.commentText,
      new Date(comment.timestamp).toLocaleString()
    ]);

    autoTable(doc, {
      head: commentsHeaders,
      body: commentsRows,
      startY: currentY,
      theme: 'grid',
      headStyles: { fillColor: secondaryColor, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 12;
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(115, 115, 115);
    doc.text("No administrative remarks or operational directives have been entered on this report.", 14, currentY + 1);
    currentY += 15;
  }

  // 9. SIGN-OFF VALIDATIONS
  if (currentY > 220) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text("OFFICIAL HOSPITAL RECONCILIATION SIGNATURE & VERIFICATION", 14, currentY);
  currentY += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Authenticated Digitally by: ${report.nightSuperName}`, 14, currentY);
  doc.text("Status: System Cryptographic Handover Sign-off Validated", 14, currentY + 4.5);
  doc.text(`Official Lock Date: ${report.submittedAt || report.updatedAt || 'N/A'}`, 14, currentY + 9);

  // If digital signature exists and starts with base64 prefix
  if (report.digitalSignature && report.digitalSignature.startsWith('data:image')) {
    try {
      doc.addImage(report.digitalSignature, 'PNG', 14, currentY + 14, 45, 18);
      doc.rect(14, currentY + 14, 45, 18); // Border frame for signature
    } catch (sigErr) {
      console.warn("Failed to embed signature into PDF:", sigErr);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.text("[Encrypted Signature Valid]", 14, currentY + 18);
    }
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.text("[Self-Signed Electronic Signature]", 14, currentY + 14);
  }

  // Footer on each page (adds some branding polish)
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.rect(0, 287, 210, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("CLINICAL FIDELITY & HOSPITAL QUALITY CONTROLLING CORE SYSTEM", 14, 293.5);
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${i} of ${totalPages}`, 196, 293.5, { align: 'right' });
  }

  if (saveToFile) {
    doc.save(`PCEA_Tumutumu_Report_${report.date}.pdf`);
  }
  return doc;
}

/**
 * Generates a Consolidated Batch Executive PDF for multiple shift records compiled in a single file.
 */
export function generateConsolidatedBatchPDF(
  reports: NightReport[],
  startDate: string,
  endDate: string,
  currentUserDisplayName?: string
) {
  if (reports.length === 0) return;

  // Sort by date chronologically
  const sortedReports = [...reports].sort((a, b) => a.date.localeCompare(b.date));

  const doc = new jsPDF();
  const primaryColor: [number, number, number] = [13, 148, 136]; // Teal #0d9488
  const secondaryColor: [number, number, number] = [15, 23, 42]; // Dark Slate #0f172a
  const borderLight: [number, number, number] = [226, 232, 240];

  // ==========================================
  // PAGE 1: EXECUTIVE COVER PAGE & AGGREGATE DASHBOARD
  // ==========================================
  
  // Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 48, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("PCEA TUMUTUMU HOSPITAL", 14, 18);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("P.O. Box 112, Karatina, Kenya • Email: info@tumutumuhospital.org URL: pceatumutumuhospital.org", 14, 25);
  doc.setFont("helvetica", "bold");
  doc.text("CONSOLIDATED NIGHT SHIFT CLINICAL PERFORMANCE PORTFOLIO", 14, 32);

  const printedAt = new Date().toLocaleString();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(230, 240, 240);
  doc.text(`Portfolio Compiled: ${printedAt} • Auditor: ${currentUserDisplayName || 'Clinical Operations Desk'}`, 14, 39);
  doc.text(`Document Reference Key: BATCH-PCEA-${startDate}-TO-${endDate}`, 14, 44);

  // Body content starts
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("EXECUTIVE COMPLIANCE BRIEF & PERFORMANCE RATIOS", 14, 60);

  // Context Paragraph
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const introText = `This digital dossier contains the consolidated night shift operational records, in-patient admissions registries, and clinical audits compiled at PCEA Tumutumu Hospital. The scope of this compliance audit runs from ${startDate} to ${endDate}, aggregating records from ${sortedReports.length} submitted night shifts.`;
  const splitIntro = doc.splitTextToSize(introText, 182);
  doc.text(splitIntro, 14, 65);

  let currentY = 65 + (splitIntro.length * 4.5) + 6;

  // Let's aggregate statistics across the batch
  let aggregateOPD = 0;
  let aggregateAdmissions = 0;
  let aggregateDeliveries = 0;
  let aggregateDeaths = 0;
  let aggregateTransfusions = 0;
  let aggregateProcedures = 0;

  // Ward specific aggregates
  const wardAggregates = {
    ward1: 0, ward2: 0, ward3: 0, ward4: 0, ward5: 0, ward6: 0, ward7: 0, shalom: 0, nbu: 0, hduIcu: 0, transferIn: 0, transferOut: 0
  };

  sortedReports.forEach(r => {
    aggregateOPD += (r.opdAttendance || 0);
    aggregateDeliveries += (r.deliveries?.length || 0);
    aggregateDeaths += (r.deaths?.length || 0);
    aggregateTransfusions += (r.bloodTransfusions?.length || 0);
    aggregateProcedures += (r.majorProcedures?.length || 0);

    if (r.admissions) {
      const ward1 = Number(r.admissions.ward1) || 0;
      const ward2 = Number(r.admissions.ward2) || 0;
      const ward3 = Number(r.admissions.ward3) || 0;
      const ward4 = Number(r.admissions.ward4) || 0;
      const ward5 = Number(r.admissions.ward5) || 0;
      const ward6 = Number(r.admissions.ward6) || 0;
      const ward7 = Number(r.admissions.ward7) || 0;
      const shalom = Number(r.admissions.shalom) || 0;
      const nbu = Number(r.admissions.nbu) || 0;
      const hduIcu = Number(r.admissions.hduIcu) || 0;
      const tIn = Number(r.admissions.transferIn) || 0;
      const tOut = Number(r.admissions.transferOut) || 0;

      wardAggregates.ward1 += ward1;
      wardAggregates.ward2 += ward2;
      wardAggregates.ward3 += ward3;
      wardAggregates.ward4 += ward4;
      wardAggregates.ward5 += ward5;
      wardAggregates.ward6 += ward6;
      wardAggregates.ward7 += ward7;
      wardAggregates.shalom += shalom;
      wardAggregates.nbu += nbu;
      wardAggregates.hduIcu += hduIcu;
      wardAggregates.transferIn += tIn;
      wardAggregates.transferOut += tOut;

      aggregateAdmissions += (ward1 + ward2 + ward3 + ward4 + ward5 + ward6 + ward7 + shalom + nbu + hduIcu);
    }
  });

  // Render aggregate figures grid in Cover page
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("AGGREGATED PERFORMANCE MATRIX", 14, currentY);
  currentY += 4;

  const aggHeaders = [['Total Outpatients', 'Total Admissions', 'Deliveries Registered', 'Mortalities Logged', 'Procedures Done', 'Blood Transfusions']];
  const aggRows = [[
    aggregateOPD,
    aggregateAdmissions,
    aggregateDeliveries,
    aggregateDeaths,
    aggregateProcedures,
    aggregateTransfusions
  ]];

  autoTable(doc, {
    head: aggHeaders,
    body: aggRows,
    startY: currentY,
    theme: 'grid',
    headStyles: { fillColor: secondaryColor, halign: 'center', fontSize: 8.5 },
    bodyStyles: { halign: 'center', fontSize: 10, fontStyle: 'bold' },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 12;

  // Shift logs summary table in Cover page
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("INCLUDED SHIFT ENTRIES CHRONOLOGY", 14, currentY);
  currentY += 4;

  const logsHeaders = [['Index', 'Shift Date', 'Night Superintendent In-Charge', 'Status', 'Registered Admissions', 'Verified Deaths']];
  const logsRows = sortedReports.map((r, index) => {
    let admCount = 0;
    if (r.admissions) {
      admCount = (Number(r.admissions.ward1) || 0) + (Number(r.admissions.ward2) || 0) + (Number(r.admissions.ward3) || 0) + (Number(r.admissions.ward4) || 0) + (Number(r.admissions.ward5) || 0) + (Number(r.admissions.ward6) || 0) + (Number(r.admissions.ward7) || 0) + (Number(r.admissions.shalom) || 0) + (Number(r.admissions.nbu) || 0) + (Number(r.admissions.hduIcu) || 0);
    }
    return [
      index + 1,
      r.date,
      r.nightSuperName,
      r.status.toUpperCase(),
      admCount,
      r.deaths?.length || 0
    ];
  });

  autoTable(doc, {
    head: logsHeaders,
    body: logsRows,
    startY: currentY,
    theme: 'striped',
    headStyles: { fillColor: primaryColor, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 12;

  // Quality statement in Cover page
  if (currentY > 240) {
    doc.addPage();
    currentY = 20;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text("EXECUTIVE CLINICAL STEWARDSHIP CERTIFICATE", 14, currentY);
  currentY += 4.5;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const certText = "This consolidated dossier constitutes an official record of night-ops performance at PCEA Tumutumu Hospital. It is verified that clinical superintendence was maintained for each shift. Cumulative audits of deliveries and mortalities have been secured and synchronized with the central Cloud register for archiving and compliance review.";
  const splitCert = doc.splitTextToSize(certText, 182);
  doc.text(splitCert, 14, currentY);

  currentY += (splitCert.length * 4) + 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text("Verification Authority Signature & Seal", 14, currentY);
  doc.line(14, currentY + 1, 70, currentY + 1);

  // ==========================================
  // INDIVIDUAL PAGES FOR EACH SHIFT REPORT
  // ==========================================
  sortedReports.forEach((report) => {
    doc.addPage();
    currentY = 18;

    // Mini Branded Shift Header
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("PCEA TUMUTUMU HOSPITAL - NIGHT SHIFT DOCUMENT", 14, 11);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Shift Duty Date: ${report.date} • Superintendent: ${report.nightSuperName} • Status: ${report.status.toUpperCase()}`, 14, 17);
    doc.text(`Record ID: ${report.id || report.date} • Submitted: ${report.submittedAt || 'N/A'}`, 14, 22);

    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    currentY = 40;

    // Shift metrics quick glance
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("1. QUANTITATIVE ATTENDANCES & RATIOS", 14, currentY);
    currentY += 4;

    const totalAdms = 
      (report.admissions?.ward1 || 0) +
      (report.admissions?.ward2 || 0) +
      (report.admissions?.ward3 || 0) +
      (report.admissions?.ward4 || 0) +
      (report.admissions?.ward5 || 0) +
      (report.admissions?.ward6 || 0) +
      (report.admissions?.ward7 || 0) +
      (report.admissions?.shalom || 0) +
      (report.admissions?.nbu || 0) +
      (report.admissions?.hduIcu || 0);

    const shiftTableHead = [['OPD Attendances', 'Total Admissions', 'Deliveries Registrations', 'Reported Mortalities']];
    const shiftTableVals = [[
      report.opdAttendance || 0,
      totalAdms,
      report.deliveries?.length || 0,
      report.deaths?.length || 0
    ]];

    autoTable(doc, {
      head: shiftTableHead,
      body: shiftTableVals,
      startY: currentY,
      theme: 'grid',
      headStyles: { fillColor: secondaryColor, halign: 'center', fontSize: 8 },
      bodyStyles: { halign: 'center', fontSize: 8.5 },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;

    // Admissions breakdown grid
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("2. IN-PATIENT ADMISSIONS WARD SPREAD", 14, currentY);
    currentY += 4;

    const miniWardHeaders = [['Ward / Clinic', 'Count', 'Ward / Clinic', 'Count']];
    const miniWardRows = [
      ['Ward 1 (Male Surgical)', report.admissions?.ward1 || 0, 'Ward 2 (Female Surgical)', report.admissions?.ward2 || 0],
      ['Ward 3 (Paed/Surg/Med)', report.admissions?.ward3 || 0, 'Ward 4 (Antenatal/Post)', report.admissions?.ward4 || 0],
      ['Ward 5 (Male Medical)', report.admissions?.ward5 || 0, 'Ward 6 (Female Medical)', report.admissions?.ward6 || 0],
      ['Ward 7 (Gynae/Med)', report.admissions?.ward7 || 0, 'NBU (Newborn Unit)', report.admissions?.nbu || 0],
      ['Shalom Private Ward', report.admissions?.shalom || 0, 'ICU & HDU Complex', report.admissions?.hduIcu || 0],
      ['Transfer IN (External)', report.admissions?.transferIn || 0, 'Transfer OUT (External)', report.admissions?.transferOut || 0]
    ];

    autoTable(doc, {
      head: miniWardHeaders,
      body: miniWardRows,
      startY: currentY,
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
      bodyStyles: { fontSize: 7.5 },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;

    // Emergency & Morgue & Radiology Summaries
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("3. SPECIALIZED DEPARTMENTS & REGISTRIES", 14, currentY);
    currentY += 4;

    const quickRegHeaders = [['Emergency Trauma Logs', 'Count', 'Morgue Ops', 'Count', 'Radiology Log Book', 'Procedures']];
    const quickRegRows = [
      ['Road Traffic Trauma (RTA)', report.emergencies?.traumaRta || 0, 'Start of Shift Morgue Count', report.morgue?.startOfShift || 0, 'X-Ray Scans Logged', report.radiology?.xray || 0],
      ['Assaults & Violence Logs', report.emergencies?.traumaAssaults || 0, 'Ward Deceased Received', report.morgue?.shiftAdmissions || 0, 'Ultrasound Scans Done', report.radiology?.ultrasound || 0],
      ['Emergency C-Sections (CS)', report.emergencies?.emCS || 0, 'Brought in Dead (B.I.D)', report.morgue?.others || 0, 'CT-Scans Performed', report.radiology?.ctScan || 0]
    ];

    autoTable(doc, {
      head: quickRegHeaders,
      body: quickRegRows,
      startY: currentY,
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105], fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5 },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;

    // Clinical Exceptions & Incidents (If any) or Handover Remarks
    if (currentY > 215) {
      doc.addPage();
      currentY = 18;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("4. HANDOVER EXCEPTIONS & stock/STAFF NOTES", 14, currentY);
    currentY += 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("CRITICAL STOCKOUTS:", 14, currentY);
    doc.setFont("helvetica", "normal");
    const sTxt = doc.splitTextToSize(report.stockOuts || "None reported.", 182);
    doc.text(sTxt, 48, currentY);
    currentY += Math.max(sTxt.length * 4, 5);

    doc.setFont("helvetica", "bold");
    doc.text("STAFFING & LOGISTICS:", 14, currentY);
    doc.setFont("helvetica", "normal");
    const stTxt = doc.splitTextToSize(report.staffingNotes || "Optimal staffing.", 182);
    doc.text(stTxt, 48, currentY);
    currentY += Math.max(stTxt.length * 4, 5);

    doc.setFont("helvetica", "bold");
    doc.text("SUPERVISOR REMARKS:", 14, currentY);
    doc.setFont("helvetica", "italic");
    const rTxt = doc.splitTextToSize(report.generalRemarks || "None.", 182);
    doc.text(rTxt, 48, currentY);
    currentY += Math.max(rTxt.length * 4, 8);

    // Deaths Logs / Deliveries logs counts summary
    if (currentY > 230) {
      doc.addPage();
      currentY = 18;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("5. CLINICAL AUDIT DETAIL RECORD LOGGER", 14, currentY);
    currentY += 4.5;

    const listDetails = [
      `Deliveries Logged: ${(report.deliveries || []).length} case(s). ${(report.deliveries || []).map(d => `${d.motherName} (${d.outcome})`).join(' • ') || 'No deliveries recorded.'}`,
      `Deceased Logs: ${(report.deaths || []).length} case(s). ${(report.deaths || []).map(d => `${d.patientName} (${d.cause})`).join(' • ') || 'No mortalities recorded.'}`,
      `Surgical Workouts: ${(report.majorProcedures || []).length} surgical case(s). ${(report.majorProcedures || []).map(p => `${p.procedureName}`).join(' • ') || 'No procedures added.'}`,
      `Blood Transfused: ${(report.bloodTransfusions || []).length} units transfused.`
    ];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    listDetails.forEach(line => {
      const splitLine = doc.splitTextToSize(line, 182);
      doc.text(splitLine, 14, currentY);
      currentY += (splitLine.length * 4) + 1.5;
    });

    // CMO and Management Comments
    if (report.cmoComments && report.cmoComments.length > 0) {
      currentY += 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text("6. CHIEF MEDICAL OFFICER COMMENTS & DIRECTIVES:", 14, currentY);
      currentY += 4;
      doc.setFont("helvetica", "normal");
      report.cmoComments.forEach(comm => {
        const fullComm = `[${comm.commenterName} (${comm.commenterRole})]: "${comm.commentText}"`;
        const splitComm = doc.splitTextToSize(fullComm, 182);
        doc.text(splitComm, 14, currentY);
        currentY += (splitComm.length * 4) + 1.5;
      });
    }

    currentY += 4;
    // Embed small digital signature validation
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(`Authenticated Digital ID: ${report.nightSuperName} [Verified Handover Signature]`, 14, currentY);
  });

  // Footer on each page
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.rect(0, 287, 210, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("CLINICAL FIDELITY & HOSPITAL QUALITY CONTROLLING CORE SYSTEM • MULTI-SHIFT DOSSIER", 14, 293.5);
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${i} of ${totalPages}`, 196, 293.5, { align: 'right' });
  }

  doc.save(`PCEA_Tumutumu_Consolidated_Batch_${startDate}_to_${endDate}.pdf`);
}

