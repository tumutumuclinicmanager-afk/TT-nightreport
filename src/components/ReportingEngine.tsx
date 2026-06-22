import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { NightReport } from '../types/report';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  FileDown, 
  TrendingUp, 
  CalendarRange, 
  Users, 
  Activity, 
  AlertCircle, 
  HeartHandshake,
  Download,
  Filter,
  BarChart2
} from 'lucide-react';

interface ReportingEngineProps {
  user: any;
  userRole: 'supervisor' | 'cmo' | 'cno' | 'admin';
}

export default function ReportingEngine({ user, userRole }: ReportingEngineProps) {
  const [reports, setReports] = useState<NightReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<NightReport[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Date filter range
  const [startDate, setStartDate] = useState(() => {
    // Default to last 30 days
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'nightReports'), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetched: NightReport[] = [];
      querySnapshot.forEach((doc) => {
        fetched.push(doc.data() as NightReport);
      });
      setReports(fetched);
    } catch (err) {
      console.error("Historical log fetching error (likely offline):", err);
    } finally {
      setLoading(false);
    }
  };

  // Sync date filtering
  useEffect(() => {
    if (reports.length > 0) {
      const filtered = reports.filter(r => r.date >= startDate && r.date <= endDate);
      setFilteredReports(filtered);
    }
  }, [reports, startDate, endDate]);

  // Calculations for aggregate metrics
  const getAggregates = () => {
    let opdTotal = 0;
    let admissionsTotal = 0;
    let deathsTotal = 0;
    let deliveriesTotal = 0;
    let transfusionsTotal = 0;
    let proceduresTotal = 0;

    filteredReports.forEach(r => {
      opdTotal += r.opdAttendance || 0;
      deathsTotal += r.deaths?.length || 0;
      deliveriesTotal += r.deliveries?.length || 0;
      transfusionsTotal += r.bloodTransfusions?.length || 0;
      proceduresTotal += r.majorProcedures?.length || 0;

      // sum up nested admissions
      if (r.admissions) {
        Object.values(r.admissions).forEach(val => {
          admissionsTotal += Number(val) || 0;
        });
      }
    });

    return {
      opdTotal,
      admissionsTotal,
      deathsTotal,
      deliveriesTotal,
      transfusionsTotal,
      proceduresTotal,
      shiftsLoggedCount: filteredReports.length
    };
  };

  const stats = getAggregates();

  // ----------------------------------------------------
  // Dynamic Month-to-Month Summary Calculations
  // ----------------------------------------------------
  const detectMonths = () => {
    let thisMonth = '';
    let prevMonth = '';
    
    if (reports.length > 0) {
      const sortedDates = [...reports].map(r => r.date).sort();
      const latestDateStr = sortedDates[sortedDates.length - 1];
      if (latestDateStr && latestDateStr.length >= 7) {
        thisMonth = latestDateStr.substring(0, 7);
      }
    }
    
    if (!thisMonth) {
      const now = new Date();
      thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    
    const [yr, mth] = thisMonth.split('-').map(Number);
    const prevDate = new Date(yr, mth - 2, 1);
    prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    
    return { thisMonth, prevMonth };
  };

  const { thisMonth: currentMonthCode, prevMonth: prevMonthCode } = detectMonths();

  const getMonthMetrics = (monthCode: string) => {
    const monthReports = reports.filter(r => r.date.startsWith(monthCode));
    
    let deathsCount = 0;
    let csCount = 0;
    let totalOpd = 0;
    
    monthReports.forEach(r => {
      deathsCount += r.deaths?.length || 0;
      csCount += r.emergencies?.emCS || 0;
      totalOpd += r.opdAttendance || 0;
    });
    
    const avgOpd = monthReports.length > 0 ? (totalOpd / monthReports.length) : 0;
    
    return {
      deathsCount,
      csCount,
      avgOpd,
      reportCount: monthReports.length
    };
  };

  const currMonthStats = getMonthMetrics(currentMonthCode);
  const prevMonthStats = getMonthMetrics(prevMonthCode);

  const formatMonthLabel = (monthStr: string) => {
    if (!monthStr || monthStr.length < 7) return monthStr;
    const [yr, mth] = monthStr.split('-').map(Number);
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    return `${months[mth - 1]} ${yr}`;
  };

  const renderComparisonBadge = (curr: number, prev: number, isInverted = false, isPercent = true, decimalPlaces = 0) => {
    const diff = curr - prev;
    const isIncrease = diff > 0;
    
    if (diff === 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 font-bold px-2 py-0.5 rounded-full select-none">
          no change
        </span>
      );
    }
    
    if (prev === 0) {
      const changeText = `${isIncrease ? '+' : ''}${diff.toFixed(decimalPlaces)}`;
      const bgClass = isInverted 
        ? "bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-400" 
        : "bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-400";
      return (
        <span className={`inline-flex items-center gap-0.5 text-[10px] border font-bold px-2 py-0.5 rounded-full select-none ${bgClass}`}>
          {isIncrease ? '↑' : '↓'} {changeText} (prev 0)
        </span>
      );
    }
    
    const pct = (diff / prev) * 100;
    const valueText = isPercent 
      ? `${isIncrease ? '+' : ''}${pct.toFixed(1)}%` 
      : `${isIncrease ? '+' : ''}${diff.toFixed(decimalPlaces)}`;
      
    let badgeStyle = "";
    if (isInverted) {
      if (isIncrease) {
        badgeStyle = "bg-rose-50 border-rose-150 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/45 dark:text-rose-400";
      } else {
        badgeStyle = "bg-emerald-50 border-emerald-150 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900/45 dark:text-emerald-400";
      }
    } else {
      if (isIncrease) {
        badgeStyle = "bg-emerald-50 border-emerald-150 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900/45 dark:text-emerald-400";
      } else {
        badgeStyle = "bg-amber-50 border-amber-150 text-amber-700 dark:bg-amber-950/30 dark:border-amber-900/45 dark:text-amber-400";
      }
    }
    
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] border font-black px-2.5 py-0.5 rounded-full select-none ${badgeStyle}`}>
        {isIncrease ? '↑' : '↓'} {valueText}
      </span>
    );
  };

  // Create chart series data over date
  const getChartData = () => {
    return [...filteredReports]
      .reverse() // Chronological order
      .map(r => {
        // total admissions for that night
        let nightAdmissions = 0;
        if (r.admissions) {
          Object.values(r.admissions).forEach(v => {
            nightAdmissions += Number(v) || 0;
          });
        }

        return {
          date: r.date,
          OPD: r.opdAttendance || 0,
          Admissions: nightAdmissions,
          Deaths: r.deaths?.length || 0,
          Deliveries: r.deliveries?.length || 0,
        };
      });
  };

  const chartData = getChartData();

  // Generate beautiful custom PDF Report based on selection
  const handlePdfDownload = (type: string) => {
    if (filteredReports.length === 0) {
      alert("No report data available in the selected date range to print!");
      return;
    }

    const doc = new jsPDF();
    const primaryColor: [number, number, number] = [13, 148, 136]; // Teal #0d9488

    // 1. HEADER (PCEA BRANDING)
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 36, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("PCEA TUMUTUMU HOSPITAL", 14, 15);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("P.O. Box 112, Karatina, Kenya • Email: info@tumutumuhospital.org", 14, 21);
    doc.text("NIGHT SUPERINTENDENT OPERATIONAL PERFORMANCE AUDIT REPORT", 14, 27);

    // Date generated indicator
    const printedAt = new Date().toLocaleString();
    doc.setFontSize(8);
    doc.setTextColor(230, 230, 230);
    doc.text(`Generated: ${printedAt} • By: ${user.displayName || 'Authorized Admin'}`, 14, 32);

    // Restoring color
    doc.setTextColor(50, 50, 50);

    // 2. REPORT METRIC SUMMARIES
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`METRIC REPORT SCOPE: ${type.toUpperCase()}`, 14, 46);
    doc.setFont("helvetica", "normal");
    doc.text(`Date Range Filter: ${startDate} to ${endDate} (${stats.shiftsLoggedCount} Night Shift Reports Included)`, 14, 52);

    // Aggregate summary grids formatted
    const summaryHeaders = [['Total OPD Attendance', 'Total Admissions', 'Deliveries Registrations', 'Total Deceased Logged', 'Transfusions Unit Tracker']];
    const summaryRows = [[
      stats.opdTotal,
      stats.admissionsTotal,
      stats.deliveriesTotal,
      stats.deathsTotal,
      stats.transfusionsTotal
    ]];

    autoTable(doc, {
      head: summaryHeaders,
      body: summaryRows,
      startY: 57,
      theme: 'grid',
      headStyles: { fillColor: primaryColor, halign: 'center' },
      bodyStyles: { halign: 'center', fontStyle: 'bold' }
    });

    // 3. ADMISSIONS BREAKDOWN BY WARD LISTS
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("AGGREGATE IN-PATIENT ADMISSIONS BY WARD", 14, (doc as any).lastAutoTable.finalY + 12);

    // Accumulate total ward-wise stats
    const wardSums: Record<string, number> = {
      'Ward 1': 0, 'Ward 2': 0, 'Ward 3': 0, 'Ward 4': 0, 'Ward 5': 0, 'Ward 6': 0, 'Ward 7': 0, 'Shalom Ward': 0, 'NBU': 0, 'HDU/ICU': 0
    };

    filteredReports.forEach(r => {
      if (r.admissions) {
        wardSums['Ward 1'] += r.admissions.ward1 || 0;
        wardSums['Ward 2'] += r.admissions.ward2 || 0;
        wardSums['Ward 3'] += r.admissions.ward3 || 0;
        wardSums['Ward 4'] += r.admissions.ward4 || 0;
        wardSums['Ward 5'] += r.admissions.ward5 || 0;
        wardSums['Ward 6'] += r.admissions.ward6 || 0;
        wardSums['Ward 7'] += r.admissions.ward7 || 0;
        wardSums['Shalom Ward'] += r.admissions.shalom || 0;
        wardSums['NBU'] += r.admissions.nbu || 0;
        wardSums['HDU/ICU'] += r.admissions.hduIcu || 0;
      }
    });

    const admissionTableHeaders = [['In-Patient Ward Unit Name', 'Admissions Sum Total']];
    const admissionRows = Object.entries(wardSums).map(([ward, total]) => [
      ward,
      total
    ]);

    autoTable(doc, {
      head: admissionTableHeaders,
      body: admissionRows,
      startY: (doc as any).lastAutoTable.finalY + 16,
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85] }
    });

    // 4. SHIFTS AUDIT CHRONICLES
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("SHIFTS REGISTRY AND CRITICAL NOTES SUMMARY", 14, 18);

    const shiftTableHeaders = [['Shift Date', 'Superintendent', 'Admissions', 'Deaths', 'Deliveries', 'Remarks & Stockouts']];
    const shiftRows = filteredReports.map(r => {
      let nightAdmissions = 0;
      if (r.admissions) {
        Object.values(r.admissions).forEach(v => { nightAdmissions += Number(v) || 0; });
      }
      return [
        r.date,
        r.nightSuperName,
        nightAdmissions,
        r.deaths?.length || 0,
        r.deliveries?.length || 0,
        `Remarks: ${r.generalRemarks || 'None.'} • Stock: ${r.stockOuts || 'Good.'}`
      ];
    });

    autoTable(doc, {
      head: shiftTableHeaders,
      body: shiftRows,
      startY: 23,
      theme: 'grid',
      headStyles: { fillColor: primaryColor },
      columnStyles: {
        5: { cellWidth: 80 }
      }
    });

    // 5. MORTALITY AUDIT EXPOSITION
    const allRecentDeaths: any[] = [];
    filteredReports.forEach(r => {
      if (r.deaths && r.deaths.length > 0) {
        r.deaths.forEach(d => {
          allRecentDeaths.push({
            date: r.date,
            patientName: d.patientName,
            patientId: d.patientId,
            ward: d.ward,
            cause: d.cause,
            time: d.time
          });
        });
      }
    });

    if (allRecentDeaths.length > 0) {
      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("MORTALITY PERFORMANCE AUDIT TRAIL LOG", 14, 18);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("A complete audit tracking timeline of mortalities logged during clinical night shifts.", 14, 23);

      const mortalityHeaders = [['Deceased Date', 'Patient Name', 'File/IP Number', 'Ward Unit', 'Identified Time & Cause']];
      const mortalityRows = allRecentDeaths.map(m => [
        m.date,
        m.patientName,
        m.patientId,
        m.ward,
        `${m.time} - ${m.cause}`
      ]);

      autoTable(doc, {
        head: mortalityHeaders,
        body: mortalityRows,
        startY: 27,
        theme: 'grid',
        headStyles: { fillColor: [190, 24, 24] }, // Red for attention
        columnStyles: {
          4: { cellWidth: 85 }
        }
      });
    }

    // Save and print
    doc.save(`TumuTumu_Hospital_${type}_Report_${startDate}_to_${endDate}.pdf`);
  };

  const compilePresetReport = (type: 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly') => {
    const weeksMap = {
      'Weekly': 1,
      'Monthly': 4,
      'Quarterly': 12,
      'Yearly': 52
    };
    const weeksAgo = weeksMap[type];
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (weeksAgo * 7));
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    
    setStartDate(startStr);
    setEndDate(endStr);
    
    setTimeout(() => {
      // Check directly from base 'reports' list prior to filter state update
      const matches = reports.filter(r => r.date >= startStr && r.date <= endStr);
      if (matches.length === 0) {
        alert(`No shift reports compiled in the operations database for the ${type} period (${startStr} to ${endStr}).`);
        return;
      }
      handlePdfDownload(type);
    }, 150);
  };

  // Predefined date scope helper button triggers
  const setQuickRange = (weeksAgo: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (weeksAgo * 7));
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-8 font-sans">

      {/* Executive Monthly Comparison Summary */}
      {!loading && reports.length > 0 && (
        <div className="space-y-4 no-print animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5 font-display">
                <BarChart2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                Monthly Performance & Volumetrics
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Performance audit for <span className="font-semibold text-teal-700 dark:text-teal-400 font-mono">{formatMonthLabel(currentMonthCode)}</span> compared to <span className="font-semibold text-slate-600 dark:text-slate-350 font-mono">{formatMonthLabel(prevMonthCode)}</span>.
              </p>
            </div>
            <div className="text-[10px] bg-teal-50 dark:bg-teal-950/40 text-teal-850 dark:text-teal-400 px-2.5 py-1 rounded-lg border border-teal-100/60 dark:border-teal-900/40 font-bold self-start sm:self-center font-mono">
              Month-to-Month Metrics
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Deaths Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Deaths</span>
                  {renderComparisonBadge(currMonthStats.deathsCount, prevMonthStats.deathsCount, true)}
                </div>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                    {currMonthStats.deathsCount}
                  </span>
                  <span className="text-xs text-slate-400 font-medium font-sans">deceased logs</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-medium text-slate-400 dark:text-slate-500">Previous Month ({formatMonthLabel(prevMonthCode)})</span>
                <span className="font-semibold font-mono text-slate-700 dark:text-slate-300">{prevMonthStats.deathsCount}</span>
              </div>
            </div>

            {/* Total C/S Procedures Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total C/S Procedures</span>
                  {renderComparisonBadge(currMonthStats.csCount, prevMonthStats.csCount, false)}
                </div>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-3xl font-extrabold font-mono text-teal-600 dark:text-teal-400 tracking-tight">
                    {currMonthStats.csCount}
                  </span>
                  <span className="text-xs text-slate-400 font-medium font-sans">emergency surgeries</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-medium text-slate-400 dark:text-slate-500">Previous Month ({formatMonthLabel(prevMonthCode)})</span>
                <span className="font-semibold font-mono text-slate-700 dark:text-slate-300">{prevMonthStats.csCount}</span>
              </div>
            </div>

            {/* Average Daily OPD Attendance Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-sans">Avg Daily OPD Attendance</span>
                  {renderComparisonBadge(currMonthStats.avgOpd, prevMonthStats.avgOpd, false, true, 1)}
                </div>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                    {currMonthStats.avgOpd.toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-400 font-medium font-sans">patients / shift</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-medium text-slate-400 dark:text-slate-500 font-sans">Previous Month ({formatMonthLabel(prevMonthCode)})</span>
                <span className="font-semibold font-mono text-slate-700 dark:text-slate-300">{prevMonthStats.avgOpd.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Scope Filtering Dashboard */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 no-print">
        <div className="flex items-center gap-2 border-b pb-3 border-slate-100">
          <Filter className="h-5 w-5 text-teal-600" />
          <h3 className="text-sm font-bold text-slate-900">Custom Chronology Filter & Range</h3>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-end justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shift Start Limit</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1.5 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 focus:bg-white text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shift End Limit</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1.5 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 focus:bg-white text-slate-800"
              />
            </div>
          </div>

          {/* Quick ranges */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={() => setQuickRange(1)}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
            >
              Past 7 Days
            </button>
            <button
              onClick={() => setQuickRange(4)}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
            >
              Past Month (30d)
            </button>
            <button
              onClick={() => setQuickRange(12)}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
            >
              Past Quarter
            </button>
            <button
              onClick={() => setQuickRange(52)}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
            >
              Past Year (365d)
            </button>
          </div>
        </div>
      </div>

      {/* Aggregate Statistics summary tiles */}
      {loading ? (
        <div className="h-44 bg-white border rounded-2xl flex items-center justify-center text-xs text-slate-400 font-medium">
          Loading operations database summary...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white border rounded-xl p-4 shadow-sm border-slate-100 flex items-center gap-3.5">
              <div className="h-10 w-10 bg-teal-50 text-teal-700 rounded-lg flex items-center justify-center shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Total OPD</span>
                <h4 className="text-xl font-black font-mono text-slate-900 leading-tight mt-0.5">{stats.opdTotal}</h4>
              </div>
            </div>

            <div className="bg-white border rounded-xl p-4 shadow-sm border-slate-100 flex items-center gap-3.5">
              <div className="h-10 w-10 bg-cyan-50 text-cyan-700 rounded-lg flex items-center justify-center shrink-0">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Admissions</span>
                <h4 className="text-xl font-black font-mono text-slate-900 leading-tight mt-0.5">{stats.admissionsTotal}</h4>
              </div>
            </div>

            <div className="bg-white border rounded-xl p-4 shadow-sm border-slate-100 flex items-center gap-3.5">
              <div className="h-10 w-10 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center shrink-0">
                <HeartHandshake className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Births Logged</span>
                <h4 className="text-xl font-black font-mono text-emerald-850 leading-tight mt-0.5 mt-0.5">{stats.deliveriesTotal}</h4>
              </div>
            </div>

            <div className="bg-rose-50/55 border border-rose-100 rounded-xl p-4 flex items-center gap-3.5">
              <div className="h-10 w-10 bg-rose-100 text-rose-700 rounded-lg flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wide">Mortalities</span>
                <h4 className="text-xl font-black font-mono text-rose-800 leading-tight mt-0.5">{stats.deathsTotal}</h4>
              </div>
            </div>

            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex items-center gap-3.5 col-span-2 md:col-span-1">
              <div className="h-10 w-10 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center shrink-0">
                <CalendarRange className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wide">Shifts Pulled</span>
                <h4 className="text-xl font-black font-mono text-indigo-900 leading-tight mt-0.5">{stats.shiftsLoggedCount}</h4>
              </div>
            </div>
          </div>

          {/* Graphics Trend Boards using Recharts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 1. OPD Attendance Line metrics */}
            <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <TrendingUp className="h-4.5 w-4.5 text-teal-600" />
                  OPD Shift Census & Admissions Trend
                </h4>
                <span className="text-[10px] text-slate-400 font-bold">10-Shift Timeline</span>
              </div>
              
              {chartData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                      <Legend wrapperStyle={{ fontSize: 10, fontWeight: 'medium' }} />
                      <Line type="monotone" dataKey="OPD" stroke="#0d9488" strokeWidth={2.5} activeDot={{ r: 6 }} name="OPD Attendance" />
                      <Line type="monotone" dataKey="Admissions" stroke="#0ea5e9" strokeWidth={2.5} name="Total Admissions" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-xs text-slate-400 italic">No trend insights available in current view.</div>
              )}
            </div>

            {/* 2. PDF Reporting Downloads Card */}
            <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm flex flex-col justify-between">
              <div>
                <div className="border-b pb-3">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                    <BarChart2 className="h-4.5 w-4.5 text-teal-600" />
                    Executive Reporting Office
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1">Compile and print professional, formatted PDF ledger summaries matching PCEA logo themes.</p>
                </div>

                <div className="space-y-3 pt-4">
                  <div className="text-xs text-slate-500 font-medium">Selected scope range statistics:</div>
                  <div className="bg-slate-50 border p-3.5 rounded-xl space-y-1.5 text-xs text-slate-700 font-medium leading-none">
                    <div className="flex justify-between"><span>OPD Total:</span> <span className="font-bold font-mono">{stats.opdTotal}</span></div>
                    <div className="flex justify-between"><span>Admissions sum:</span> <span className="font-bold font-mono">{stats.admissionsTotal}</span></div>
                    <div className="flex justify-between"><span>Total Births:</span> <span className="font-bold font-mono text-emerald-700">{stats.deliveriesTotal}</span></div>
                    <div className="flex justify-between"><span>Log mortalities:</span> <span className="font-bold font-mono text-rose-700">{stats.deathsTotal}</span></div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100 mt-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Clinical Presets PDF Compiler</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => compilePresetReport('Weekly')}
                    className="h-8 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-[10px] text-slate-700 font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                    title="Compile 7-Day Performance Ledger"
                  >
                    <Download className="h-3 w-3 text-teal-600" />
                    Weekly PDF
                  </button>
                  <button
                    onClick={() => compilePresetReport('Monthly')}
                    className="h-8 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-[10px] text-slate-700 font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                    title="Compile 30-Day Performance Ledger"
                  >
                    <Download className="h-3 w-3 text-blue-600" />
                    Monthly PDF
                  </button>
                  <button
                    onClick={() => compilePresetReport('Quarterly')}
                    className="h-8 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-[10px] text-slate-700 font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                    title="Compile 90-Day Performance Ledger"
                  >
                    <Download className="h-3 w-3 text-orange-600" />
                    Quarterly PDF
                  </button>
                  <button
                    onClick={() => compilePresetReport('Yearly')}
                    className="h-8 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-[10px] text-slate-700 font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                    title="Compile 365-Day Performance Ledger"
                  >
                    <Download className="h-3 w-3 text-rose-600" />
                    Yearly PDF
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => handlePdfDownload('Custom')}
                    className="w-full h-9 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg shadow-md shadow-teal-600/10 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Print Selected Range PDF
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* 3. Deliveries vs Ward Admissions clustered column */}
          <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Shift Deliveries vs Ward Admissions</h4>
              <span className="text-[10px] font-semibold text-slate-400">Shift outcomes timeline</span>
            </div>

            {chartData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="Deliveries" fill="#10b981" name="Deliveries" maxBarSize={25} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Admissions" fill="#0ea5e9" name="Ward Admissions" maxBarSize={25} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400 italic">No chart data available.</div>
            )}
          </div>
        </>
      )}

    </div>
  );
}
