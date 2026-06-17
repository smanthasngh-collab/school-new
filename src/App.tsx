import React, { useState, useEffect } from 'react';
import {
  Users, BookOpen, GraduationCap, DollarSign, Calendar, Clock,
  FileText, Award, Bell, Shield, Settings, CheckCircle, AlertTriangle, List,
  Smartphone, CreditCard, LayoutDashboard, Plus, Trash2, Edit, Save, Trash, LogOut,
  RefreshCw, Database, Layers, Check, Eye, ChevronRight, PieChart, BarChart
} from 'lucide-react';

// --- Types & Schema Mirroring ---
interface User {
  id: string;
  email: string;
  role: 'admin' | 'principal' | 'teacher' | 'student' | 'parent';
  name: string;
  phone: string;
  address: string;
  status: 'active' | 'inactive';
  meta?: any;
}

interface SchoolSettings {
  schoolName: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  currentAcademicYear: string;
  currency: string;
}

export default function App() {
  // --- Core Layout & Auth State ---
  const [token, setToken] = useState<string | null>(localStorage.getItem('sm_token'));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'classes' | 'exams' | 'attendance' | 'payments' | 'homework' | 'notices' | 'timetable' | 'leaves' | 'settings'>('dashboard');
  
  // Login / Auth Fields
  const [loginEmail, setLoginEmail] = useState('admin@school.com');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [authError, setAuthError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  
  // Custom Profile Editing Fields
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [profilePassword, setProfilePassword] = useState('');

  // --- Dynamic Application Registers ---
  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: 'St. Mary Advanced Academy',
    address: '742 Evergreen Terrace, Sector 4, Metro State',
    contactEmail: 'administration@stmaryacademy.edu',
    contactPhone: '+1 (555) 0190-200',
    currentAcademicYear: '2026-2027',
    currency: 'INR'
  });

  const [stats, setStats] = useState<any>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [subjectsList, setSubjectsList] = useState<any[]>([]);
  const [noticesList, setNoticesList] = useState<any[]>([]);
  const [examsList, setExamsList] = useState<any[]>([]);
  const [leavesList, setLeavesList] = useState<any[]>([]);
  const [backupsList, setBackupsList] = useState<string[]>([]);

  // Selection states for CRUDs
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    name: '', email: '', password: '', role: 'student', phone: '', address: '',
    rollNo: '', admissionNo: '', classId: '', guardianId: '', department: '',
    qualification: '', subjectSpecialization: '', occupation: '', relation: 'Father'
  });

  // Timetable
  const [timetableForm, setTimetableForm] = useState({
    classId: '', subjectId: '', teacherId: '', dayOfWeek: 1, startTime: '08:30', endTime: '09:45', room: ''
  });
  const [selectedClassTimetable, setSelectedClassTimetable] = useState<any[]>([]);
  const [filterClassId, setFilterClassId] = useState('');

  // Homework
  const [homeworkForm, setHomeworkForm] = useState({ classId: '', subjectId: '', title: '', description: '', dueDate: '' });
  const [homeworksList, setHomeworksList] = useState<any[]>([]);

  // Notices
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '', targetRole: 'all', label: 'Notice', eventDate: '' });

  // Exams & Grading
  const [examForm, setExamForm] = useState({ name: '', type: 'Midterm', classId: '', subjectId: '', examDate: '', maxMarks: 100 });
  const [gradeForm, setGradeForm] = useState({ examId: '', studentId: '', subjectId: '', obtainedMarks: 0, comments: '' });
  const [studentGradesList, setStudentGradesList] = useState<any[]>([]);

  // Attendance
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceClassId, setAttendanceClassId] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, 'Present' | 'Absent' | 'Late'>>({});
  const [studentAttendanceHistory, setStudentAttendanceHistory] = useState<any[]>([]);

  // Payments / Fees
  const [paymentForm, setPaymentForm] = useState({ studentId: '', amount: 1000, type: 'Tuition', description: '', dueDate: '' });
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [studentPayments, setStudentPayments] = useState<any[]>([]);
  const [selectedPaymentForCheckout, setSelectedPaymentForCheckout] = useState<any | null>(null);
  const [paymentResultMessage, setPaymentResultMessage] = useState<string | null>(null);

  // Leave Form
  const [leaveForm, setLeaveForm] = useState({ startDate: '', endDate: '', reason: '' });

  // --- API Request Proxies ---
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP error ${response.status}`);
    }
    return response.json();
  };

  // Run on start and whenever token updates
  useEffect(() => {
    if (token) {
      localStorage.setItem('sm_token', token);
      loadBasicDetails();
    } else {
      localStorage.removeItem('sm_token');
      setCurrentUser(null);
    }
  }, [token]);

  const loadBasicDetails = async () => {
    try {
      const profile = await fetchWithAuth('/api/auth/profile');
      setCurrentUser(profile);
      setProfileName(profile.name);
      setProfilePhone(profile.phone);
      setProfileAddress(profile.address);

      // Global settings
      const globalSettings = await fetch('/api/settings').then(res => res.json());
      setSettings(globalSettings);

      // Role specifically load extra databases
      refreshModuleData(profile.role, profile.id, profile.meta?.classId);
    } catch (err: any) {
      console.error(err);
      handleLogout();
    }
  };

  const refreshModuleData = async (role: string, userId: string, classId?: string) => {
    try {
      if (role === 'admin' || role === 'principal') {
        const adminStats = await fetchWithAuth('/api/admin/stats');
        setStats(adminStats);

        const users = await fetchWithAuth('/api/admin/users');
        setUsersList(users);

        const backups = await fetchWithAuth('/api/admin/backups');
        setBackupsList(backups);
      }

      // Load general lists
      const classes = await fetch('/api/classes', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      }).then(res => res.json());
      setClassesList(classes);

      const subjects = await fetch('/api/subjects', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      }).then(res => res.json());
      setSubjectsList(subjects);

      const notices = await fetchWithAuth('/api/notices');
      setNoticesList(notices);

      const exams = await fetch('/api/exams', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      }).then(res => res.json());
      setExamsList(exams);

      const leaves = await fetchWithAuth('/api/leaves');
      setLeavesList(leaves);

      // Specific child dashboards
      if (role === 'student') {
        const studentId = userId;
        const sGrades = await fetchWithAuth(`/api/marks/${studentId}`);
        setStudentGradesList(sGrades);

        const sAtt = await fetchWithAuth(`/api/attendance/${studentId}`);
        setStudentAttendanceHistory(sAtt);

        const sPay = await fetchWithAuth(`/api/payments/student/${studentId}`);
        setStudentPayments(sPay);

        if (classId) {
          const hw = await fetchWithAuth(`/api/homeworks/${classId}`);
          setHomeworksList(hw);

          const tt = await fetchWithAuth(`/api/timetable/${classId}`);
          setSelectedClassTimetable(tt);
        }
      }

      if (role === 'parent') {
        // Parent view references associated student Billy (u-student API representation in Seed Database)
        const childId = 'u-student'; 
        const sGrades = await fetchWithAuth(`/api/marks/${childId}`);
        setStudentGradesList(sGrades);

        const sAtt = await fetchWithAuth(`/api/attendance/${childId}`);
        setStudentAttendanceHistory(sAtt);

        const sPay = await fetchWithAuth(`/api/payments/student/${childId}`);
        setStudentPayments(sPay);

        // Billy is in Class c-10a
        const hw = await fetchWithAuth(`/api/homeworks/c-10a`);
        setHomeworksList(hw);

        const tt = await fetchWithAuth(`/api/timetable/c-10a`);
        setSelectedClassTimetable(tt);
      }

      if (role === 'admin' || role === 'principal') {
        const allPays = await fetchWithAuth('/api/payments');
        setAllPayments(allPays);
      }

    } catch (err) {
      console.error('Error refreshing module registries:', err);
    }
  };

  // --- Actions & Handlers ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Authentication failed');
      }
      const data = await response.json();
      setToken(data.token);
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sm_token');
    setToken(null);
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    try {
      await fetchWithAuth('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: profileName,
          phone: profilePhone,
          address: profileAddress,
          password: profilePassword || undefined
        })
      });
      setProfileMessage('Your profile credentials have been aligned with standard security systems.');
      setProfilePassword('');
      loadBasicDetails();
    } catch (err: any) {
      setProfileMessage(`Error: ${err.message}`);
    }
  };

  const handleUserRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(userForm)
      });
      alert('Secure User registration complete!');
      setUserForm({
        name: '', email: '', password: '', role: 'student', phone: '', address: '',
        rollNo: '', admissionNo: '', classId: '', guardianId: '', department: '',
        qualification: '', subjectSpecialization: '', occupation: '', relation: 'Father'
      });
      refreshModuleData(currentUser?.role!, currentUser?.id!);
    } catch (err: any) {
      alert(`Registration error: ${err.message}`);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you absolutely sure you want to scrub this user trace from school datasets?')) return;
    try {
      await fetchWithAuth(`/api/admin/users/${id}`, { method: 'DELETE' });
      refreshModuleData(currentUser?.role!, currentUser?.id!);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateClass = async (e: React.FormEvent, cForm: any) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/api/admin/classes', {
        method: 'POST',
        body: JSON.stringify(cForm)
      });
      alert('Educational Class block deployed.');
      refreshModuleData(currentUser?.role!, currentUser?.id!);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!confirm('Scrubbing selected class details. All schedules will follow.')) return;
    try {
      await fetchWithAuth(`/api/admin/classes/${id}`, { method: 'DELETE' });
      refreshModuleData(currentUser?.role!, currentUser?.id!);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateSubject = async (e: React.FormEvent, sForm: any) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/api/admin/subjects', {
        method: 'POST',
        body: JSON.stringify(sForm)
      });
      alert('Curriculum Subject mapped safely.');
      refreshModuleData(currentUser?.role!, currentUser?.id!);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/api/admin/timetable', {
        method: 'POST',
        body: JSON.stringify(timetableForm)
      });
      alert('Time period successfully logged to class calendar.');
      if (timetableForm.classId) {
        const tt = await fetchWithAuth(`/api/timetable/${timetableForm.classId}`);
        setSelectedClassTimetable(tt);
      }
    } catch (err: any) {
      alert(`Error assigning period: ${err.message}`);
    }
  };

  const handleSearchClassTimetable = async (cId: string) => {
    try {
      const tt = await fetchWithAuth(`/api/timetable/${cId}`);
      setSelectedClassTimetable(tt);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/api/teacher/exams', {
        method: 'POST',
        body: JSON.stringify(examForm)
      });
      alert('Official examination entry successfully locked.');
      refreshModuleData(currentUser?.role!, currentUser?.id!);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePostGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/api/teacher/marks', {
        method: 'POST',
        body: JSON.stringify(gradeForm)
      });
      alert('Grade point card committed successfully.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLoadClassForAttendance = async (cId: string) => {
    if (!cId) return;
    const dbUsers = await fetchWithAuth('/api/admin/users');
    const classStudents = dbUsers.filter((u: any) => u.role === 'student' && u.meta?.classId === cId);
    
    // Default everyone to Present
    const records: Record<string, 'Present' | 'Absent' | 'Late'> = {};
    classStudents.forEach((st: any) => {
      records[st.id] = 'Present';
    });
    setAttendanceRecords(records);
  };

  const handleSubmitAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataRecords = Object.keys(attendanceRecords).map(stId => ({
        studentId: stId,
        status: attendanceRecords[stId]
      }));

      await fetchWithAuth('/api/teacher/attendance', {
        method: 'POST',
        body: JSON.stringify({
          classId: attendanceClassId,
          date: attendanceDate,
          records: dataRecords
        })
      });
      alert('Daily attendance register logged securely.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePostHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/api/teacher/homework', {
        method: 'POST',
        body: JSON.stringify(homeworkForm)
      });
      alert('Homework allocated and dispatched to class portal.');
      setHomeworkForm({ classId: '', subjectId: '', title: '', description: '', dueDate: '' });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/api/leaves', {
        method: 'POST',
        body: JSON.stringify(leaveForm)
      });
      alert('Leave application submitted on scheduler stream.');
      setLeaveForm({ startDate: '', endDate: '', reason: '' });
      refreshModuleData(currentUser?.role!, currentUser?.id!);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateLeaveStatus = async (id: string, status: 'Approved' | 'Rejected') => {
    try {
      await fetchWithAuth(`/api/leaves/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      alert(`Leave request trace registered as ${status}.`);
      refreshModuleData(currentUser?.role!, currentUser?.id!);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePostNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/api/admin/notices', {
        method: 'POST',
        body: JSON.stringify(noticeForm)
      });
      alert('School notice broadcast dispatched.');
      setNoticeForm({ title: '', content: '', targetRole: 'all', label: 'Notice', eventDate: '' });
      refreshModuleData(currentUser?.role!, currentUser?.id!);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    try {
      await fetchWithAuth(`/api/admin/notices/${id}`, { method: 'DELETE' });
      refreshModuleData(currentUser?.role!, currentUser?.id!);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/api/admin/payments', {
        method: 'POST',
        body: JSON.stringify(paymentForm)
      });
      alert('Secure fee billing statement raised successfully.');
      setPaymentForm({ studentId: '', amount: 1000, type: 'Tuition', description: '', dueDate: '' });
      refreshModuleData(currentUser?.role!, currentUser?.id!);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateSchoolSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      alert('System Settings updated successfully.');
      loadBasicDetails();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // --- Backups Management ---
  const handleTriggerBackup = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/backups', { method: 'POST' });
      alert(`Schema snapshotted successfully: ${res.filename}`);
      refreshModuleData(currentUser?.role!, currentUser?.id!);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (!confirm(`Warning: Restoring backup ${filename} will replace all active in-memory assets. Continue?`)) return;
    try {
      await fetchWithAuth('/api/admin/backups/restore', {
        method: 'POST',
        body: JSON.stringify({ filename })
      });
      alert('System records restored, resetting login state to align sessions.');
      handleLogout();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // --- Razorpay Payment Integration Portal Client Trigger ---
  const triggerRazorpayCheckout = async (paymentItem: any) => {
    setPaymentResultMessage(null);
    setSelectedPaymentForCheckout(paymentItem);
    try {
      const order = await fetchWithAuth('/api/payments/razorpay/create-order', {
        method: 'POST',
        body: JSON.stringify({ paymentId: paymentItem.id })
      });

      // Check if sandbox simulator is triggered
      if (order.isSandboxSimulator) {
        setPaymentResultMessage('Simulator triggered. Click verify below to simulate complete Razorpay signature generation and receipt clearance!');
        return;
      }

      // Initialize real Razorpay Checkout API
      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: settings.schoolName,
        description: paymentItem.description,
        order_id: order.orderId,
        handler: async (response: any) => {
          try {
            const verification = await fetchWithAuth('/api/payments/razorpay/verify', {
              method: 'POST',
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                internalPaymentId: paymentItem.id
              })
            });
            alert('Fee Cleared! System generated Receipt issued.');
            setPaymentResultMessage(`Payment approved: receipt code ${verification.receipt?.receiptNo}`);
            refreshModuleData(currentUser?.role!, currentUser?.id!);
          } catch (err: any) {
            alert(`Verification failed: ${err.message}`);
          }
        },
        prefill: {
          name: currentUser?.name,
          email: currentUser?.email,
          contact: currentUser?.phone
        },
        theme: {
          color: '#1e293b'
        }
      };

      const rzpObj = new (window as any).Razorpay(options);
      rzpObj.open();

    } catch (err: any) {
      alert(`Razorpay checkout setup failure: ${err.message}`);
    }
  };

  const handleSimulatePaymentResolve = async (paymentId: string, orderId: string) => {
    try {
      const verification = await fetchWithAuth('/api/payments/razorpay/verify', {
        method: 'POST',
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: `pay_sim_ref_${Date.now()}`,
          razorpay_signature: '',
          internalPaymentId: paymentId,
          isSandboxSimulatedSuccess: true
        })
      });
      setPaymentResultMessage(`Demo Receipt Issued successfully: Code ${verification.receipt?.receiptNo}`);
      alert('Simulation Successful! Your receipt is ready for tracking.');
      setSelectedPaymentForCheckout(null);
      refreshModuleData(currentUser?.role!, currentUser?.id!);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // --- Dynamic CSS Resource Mounting ---
  // We ensure Razorpay JS SDK is populated dynamically if not found
  useEffect(() => {
    const existingScript = document.getElementById('razorpay-checkout-sdk');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.id = 'razorpay-checkout-sdk';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // --- VIEW TEMPLATES ---
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-8 text-center bg-slate-900 text-white">
            <GraduationCap className="h-12 w-12 mx-auto mb-3 text-emerald-400" />
            <h1 className="text-2xl font-bold tracking-tight">St. Mary Academy</h1>
            <p className="text-slate-400 text-sm mt-1">Enterprise School Resource ERP Portal</p>
          </div>
          
          <div className="p-8">
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Institutional Email</label>
                <input
                  type="email"
                  className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="admin@school.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Secret Password</label>
                <input
                  type="password"
                  className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="admin123"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>

              {authError && (
                <div className="p-3 bg-rose-50 text-rose-600 rounded-lg text-xs leading-relaxed flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-slate-950 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-slate-950/10"
              >
                Let me in
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Institutional Demo Backdoors</h4>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                <button type="button" onClick={() => { setLoginEmail('admin@school.com'); setLoginPassword('admin123'); }} className="p-2 bg-slate-50 rounded border border-slate-100 hover:bg-slate-100 text-left cursor-pointer">
                  <strong>Super Admin:</strong> admin@school.com (pass: admin123)
                </button>
                <button type="button" onClick={() => { setLoginEmail('principal@school.com'); setLoginPassword('principal123'); }} className="p-2 bg-slate-50 rounded border border-slate-100 hover:bg-slate-100 text-left cursor-pointer">
                  <strong>Principal:</strong> principal@school.com (pass: principal123)
                </button>
                <button type="button" onClick={() => { setLoginEmail('teacher.alex@school.com'); setLoginPassword('teacher123'); }} className="p-2 bg-slate-50 rounded border border-slate-100 hover:bg-slate-100 text-left cursor-pointer">
                  <strong>Teacher:</strong> teacher.alex@school.com (pass: teacher123)
                </button>
                <button type="button" onClick={() => { setLoginEmail('student.billy@school.com'); setLoginPassword('student123'); }} className="p-2 bg-slate-50 rounded border border-slate-100 hover:bg-slate-100 text-left cursor-pointer">
                  <strong>Student:</strong> student.billy@school.com (pass: student123)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loaded Application
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Upper Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm h-16 shrink-0 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-8 w-8 text-emerald-600" />
          <div>
            <h1 className="font-bold text-slate-900 text-base leading-tight">{settings.schoolName}</h1>
            <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Enterprise ERP Suite</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-semibold text-slate-800">{currentUser?.name}</span>
            <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">{currentUser?.role} portal</span>
          </div>

          <div className="py-1.5 px-3 bg-slate-100 rounded-full text-xs text-slate-600 font-medium">
            Term: {settings.currentAcademicYear}
          </div>

          <button
            onClick={handleLogout}
            className="p-2 bg-rose-50 text-rose-600 rounded-full hover:bg-rose-100 transition-colors cursor-pointer"
            title="Secure System Exit"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col justify-between p-4 shrink-0 overflow-y-auto">
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-3 mb-2">Systems Menu</p>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    activeTab === 'dashboard' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard Overview</span>
                </button>

                {/* Role Block: Admin View Options */}
                {(currentUser?.role === 'admin' || currentUser?.role === 'principal') && (
                  <>
                    <button
                      onClick={() => setActiveTab('users')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        activeTab === 'users' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Users className="h-4 w-4" />
                      <span>User Directories</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('classes')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        activeTab === 'classes' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Layers className="h-4 w-4" />
                      <span>Academic Classes</span>
                    </button>
                  </>
                )}

                {/* Role Block: Teacher Options */}
                {currentUser?.role === 'teacher' && (
                  <>
                    <button
                      onClick={() => { setActiveTab('attendance'); handleLoadClassForAttendance('c-10a'); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        activeTab === 'attendance' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-400'
                      }`}
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Daily Attendance</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('exams')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        activeTab === 'exams' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Award className="h-4 w-4" />
                      <span>Exams & Marks Desk</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('homework')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        activeTab === 'homework' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-400'
                      }`}
                    >
                      <BookOpen className="h-4 w-4" />
                      <span>Allocate Homework</span>
                    </button>
                  </>
                )}

                {/* Student or Parent Shared Options */}
                {(currentUser?.role === 'student' || currentUser?.role === 'parent') && (
                  <>
                    <button
                      onClick={() => setActiveTab('exams')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        activeTab === 'exams' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Award className="h-4 w-4" />
                      <span>Grade Card Analysis</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('homework')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        activeTab === 'homework' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-400'
                      }`}
                    >
                      <BookOpen className="h-4 w-4" />
                      <span>Assigned Homework</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('timetable')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        activeTab === 'timetable' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Clock className="h-4 w-4" />
                      <span>Academic Timetable</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => setActiveTab('payments')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    activeTab === 'payments' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  <DollarSign className="h-4 w-4" />
                  <span>Fee Management</span>
                </button>

                <button
                  onClick={() => setActiveTab('notices')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    activeTab === 'notices' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  <Bell className="h-4 w-4" />
                  <span>Notice Board</span>
                </button>

                <button
                  onClick={() => setActiveTab('leaves')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    activeTab === 'leaves' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  <span>Leave Schedule</span>
                </button>

                {(currentUser?.role === 'admin' || currentUser?.role === 'principal') && (
                  <button
                    onClick={() => setActiveTab('settings')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      activeTab === 'settings' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Settings className="h-4 w-4" />
                    <span>School Aligner</span>
                  </button>
                )}
              </nav>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-950">
              <Shield className="h-4 w-4 text-emerald-500 shrink-0" />
              <div className="overflow-hidden">
                <p className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">Gatekeeper</p>
                <p className="text-[11px] text-slate-400 truncate">System Session verified</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Dynamic Display Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {/* TAB 1: GENERAL MONITOR DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Profile Card Section */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">Vanguard ERP Management Portal</h2>
                  <p className="text-slate-400 text-xs md:text-sm mt-1 leading-relaxed">
                    Welcome back, <strong className="text-emerald-400">{currentUser?.name}</strong>. Your account has {currentUser?.role?.toUpperCase()} clearances.
                  </p>
                </div>
                
                <div className="shrink-0 flex gap-2">
                  <div className="text-xs bg-slate-800/80 border border-slate-700/50 px-4 py-2.5 rounded-xl">
                    <p className="text-slate-500 font-bold uppercase text-[9px] tracking-wider">Academic Year</p>
                    <p className="font-semibold text-emerald-400 mt-0.5">{settings.currentAcademicYear}</p>
                  </div>
                  <div className="text-xs bg-slate-800/80 border border-slate-700/50 px-4 py-2.5 rounded-xl">
                    <p className="text-slate-500 font-bold uppercase text-[9px] tracking-wider">Currency Unit</p>
                    <p className="font-semibold text-emerald-400 mt-0.5">{settings.currency}</p>
                  </div>
                </div>
              </div>

              {/* Analytical Charts Widget Row & Quick Action Links */}
              {authError && <p className="text-rose-500 text-xs">{authError}</p>}

              {/* --- Admin analytical view --- */}
              {(currentUser?.role === 'admin' || currentUser?.role === 'principal') && stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Administrative Users</p>
                    <h3 className="text-4xl font-extrabold mt-1 tracking-tight text-slate-900">{stats.totalUsers}</h3>
                    <p className="text-[10px] text-slate-400 mt-1">Supervisors, Parents, Staff</p>
                  </div>

                  <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Students</p>
                    <h3 className="text-4xl font-extrabold mt-1 tracking-tight text-slate-900">{stats.totalStudents}</h3>
                    <p className="text-[10px] text-slate-400 mt-1">Grade 10, Grade 11 enrolled</p>
                  </div>

                  <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Revenue collected</p>
                    <h3 className="text-4xl font-extrabold mt-1 tracking-tight text-emerald-600">
                      {settings.currency} {stats.feeStats?.collected}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1">Tuition & Exam payments settled</p>
                  </div>

                  <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Due invoices balance</p>
                    <h3 className="text-4xl font-extrabold mt-1 tracking-tight text-rose-500">
                      {settings.currency} {stats.feeStats?.due}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1">Awaiting client authorization</p>
                  </div>
                </div>
              )}

              {/* Noticeboard Stream & Student summary */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Notice board stream */}
                <div className="bg-white p-6 border border-slate-200/60 rounded-2xl shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-slate-900">Broadcast Bulletins</h3>
                      <p className="text-xs text-slate-400">Institutional announcement schedule</p>
                    </div>
                    <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold">Latest updates</span>
                  </div>

                  <div className="space-y-4 max-h-[400px] overflow-y-auto">
                    {noticesList.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">No official notices posted yet.</p>
                    ) : (
                      noticesList.map((not: any) => (
                        <div key={not.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${
                              not.label === 'Event' ? 'bg-amber-100 text-amber-700' :
                              not.label === 'Holiday' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {not.label}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">{new Date(not.createdAt).toLocaleDateString()}</span>
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm">{not.title}</h4>
                          <p className="text-xs text-slate-600 leading-relaxed">{not.content}</p>
                          {not.eventDate && (
                            <p className="text-[10px] text-emerald-600 font-bold mt-1">📌 Event Plan Date: {not.eventDate}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Profile Manager Form Section */}
                <div className="bg-white p-6 border border-slate-200/60 rounded-2xl shadow-sm space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-900">Personal Account Settings</h3>
                    <p className="text-xs text-slate-400">Align your credentials with system standards</p>
                  </div>

                  <form onSubmit={handleProfileUpdate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Display Name</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-lg focus:outline-none focus:border-emerald-500"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Phone</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-lg focus:outline-none focus:border-emerald-500"
                          value={profilePhone}
                          onChange={(e) => setProfilePhone(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Billing Address</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-lg focus:outline-none focus:border-emerald-500"
                        value={profileAddress}
                        onChange={(e) => setProfileAddress(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Change Account Password (Leave blank to keep current)</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-lg focus:outline-none focus:border-emerald-500"
                        value={profilePassword}
                        onChange={(e) => setProfilePassword(e.target.value)}
                      />
                    </div>

                    {profileMessage && (
                      <p className="text-xs text-slate-600 bg-emerald-50 text-emerald-700 p-2 rounded-lg">{profileMessage}</p>
                    )}

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Process Profile Alignment
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USER CRUD */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-6">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg">System Directories</h3>
                  <p className="text-xs text-slate-400">Add, view, and purge students, teachers, principals and parents</p>
                </div>

                {/* Directory Form */}
                <form onSubmit={handleUserRegister} className="bg-slate-50 p-6 rounded-xl border border-slate-100 space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-2">Deploy New User Credentials</h4>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Role Type</label>
                      <select
                        className="w-full p-2 bg-white border border-slate-200 text-xs rounded-lg focus:outline-none"
                        value={userForm.role}
                        onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                      >
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                        <option value="parent">Parent</option>
                        <option value="principal">Assistant Principal</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Display Name</label>
                      <input
                        type="text"
                        placeholder="John Miller"
                        className="w-full p-2 bg-white border border-slate-200 text-xs rounded-lg focus:outline-none"
                        value={userForm.name}
                        onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email Identity</label>
                      <input
                        type="email"
                        placeholder="john.miller@school.com"
                        className="w-full p-2 bg-white border border-slate-200 text-xs rounded-lg focus:outline-none"
                        value={userForm.email}
                        onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Password</label>
                      <input
                        type="text"
                        placeholder="school123"
                        className="w-full p-2 bg-white border border-slate-200 text-xs rounded-lg focus:outline-none"
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Dependent fields based on layout selected */}
                  {userForm.role === 'student' && (
                    <div className="grid grid-cols-3 gap-4 border-t border-slate-200/50 pt-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Class Designation</label>
                        <select
                          className="w-full p-2 bg-white border border-slate-200 text-xs rounded-lg"
                          value={userForm.classId}
                          onChange={(e) => setUserForm({ ...userForm, classId: e.target.value })}
                        >
                          <option value="">Choose Class...</option>
                          {classesList.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Roll No</label>
                        <input
                          type="text"
                          placeholder="1024"
                          className="w-full p-2 bg-white border border-slate-200 text-xs rounded-lg"
                          value={userForm.rollNo}
                          onChange={(e) => setUserForm({ ...userForm, rollNo: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Guardian Link Profile</label>
                        <select
                          className="w-full p-2 bg-white border border-slate-200 text-xs rounded-lg font-medium"
                          value={userForm.guardianId}
                          onChange={(e) => setUserForm({ ...userForm, guardianId: e.target.value })}
                        >
                          <option value="">Awaiting Parental reference link...</option>
                          {usersList.filter(u => u.role === 'parent').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {userForm.role === 'teacher' && (
                    <div className="grid grid-cols-2 gap-4 border-t border-slate-200/50 pt-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Faculty Department</label>
                        <input
                          type="text"
                          value={userForm.department}
                          onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                          className="w-full p-2 bg-white border border-slate-200 text-xs rounded-lg"
                          placeholder="e.g. Mathematics"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Academic Specialization</label>
                        <input
                          type="text"
                          value={userForm.subjectSpecialization}
                          onChange={(e) => setUserForm({ ...userForm, subjectSpecialization: e.target.value })}
                          className="w-full p-2 bg-white border border-slate-200 text-xs rounded-lg"
                          placeholder="e.g. Calculus"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="py-2.5 px-6 bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    Deploy New User Records
                  </button>
                </form>

                {/* Directory Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4 font-bold">Account Name</th>
                        <th className="py-3 px-4 font-bold">Email</th>
                        <th className="py-3 px-4 font-bold">Assigned Role</th>
                        <th className="py-3 px-4 font-bold">Class Details / Tech specialization</th>
                        <th className="py-3 px-4 font-bold">Status</th>
                        <th className="py-3 px-4 font-bold text-right">Delete Operations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                      {usersList.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50/55 transition-colors">
                          <td className="py-4 px-4 font-bold text-slate-900">{user.name}</td>
                          <td className="py-4 px-4">{user.email}</td>
                          <td className="py-4 px-4 uppercase text-[10px] font-bold text-slate-500">
                            <span className="bg-slate-100 py-1 px-2.5 rounded-full">{user.role}</span>
                          </td>
                          <td className="py-4 px-4 text-xs">
                            {user.role === 'student' && user.meta?.classId ? (
                              <span className="font-semibold text-emerald-600">Class Ref: {user.meta?.classId}</span>
                            ) : user.role === 'teacher' ? (
                              <span className="font-semibold text-slate-500">{user.meta?.subjectSpecialization || 'General education'}</span>
                            ) : 'System clear'}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase ${
                              user.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
                            }`}>
                              {user.status}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-1 px-3.5 hover:bg-rose-50 rounded-lg text-rose-500 transition-colors inline-flex items-center gap-1 cursor-pointer font-bold"
                            >
                              <Trash className="h-3.5 w-3.5" /> Purge
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ACADEMIC CLASSES */}
          {activeTab === 'classes' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Class Creator */}
                <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
                  <h3 className="font-bold text-slate-900 text-base">Academic Section deployer</h3>
                  
                  <form onSubmit={(e) => {
                    const el = e.target as any;
                    handleCreateClass(e, {
                      name: el.name.value,
                      section: el.section.value,
                      department: el.dept.value,
                      roomNumber: el.room.value,
                      advisorId: el.advId.value
                    });
                    el.reset();
                  }} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Class Grade Name</label>
                      <input
                        name="name"
                        type="text"
                        placeholder="Grade 10"
                        className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Section</label>
                      <input
                        name="section"
                        type="text"
                        placeholder="A"
                        className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Department</label>
                      <input
                        name="dept"
                        type="text"
                        placeholder="High School Science"
                        className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lecture Room No</label>
                      <input
                        name="room"
                        type="text"
                        placeholder="Room 302"
                        className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Class Mentor Advisor</label>
                      <select name="advId" className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg">
                        <option value="">Awaiting faculty assignment...</option>
                        {usersList.filter(u => u.role === 'teacher').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Provision Academic Room Block
                    </button>
                  </form>
                </div>

                {/* Subject Mapping */}
                <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
                  <h3 className="font-bold text-slate-900 text-base">Curriculum Subject Mapper</h3>
                  
                  <form onSubmit={(e) => {
                    const el = e.target as any;
                    handleCreateSubject(e, {
                      name: el.subjName.value,
                      code: el.subjCode.value,
                      classId: el.classId.value,
                      teacherId: el.teachId.value
                    });
                    el.reset();
                  }} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Subject Name</label>
                      <input
                        name="subjName"
                        type="text"
                        placeholder="Advanced Calculus"
                        className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Subject Code</label>
                      <input
                        name="subjCode"
                        type="text"
                        placeholder="MATH-102"
                        className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Belongs to Class</label>
                        <select name="classId" className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg">
                          <option value="">Choose class...</option>
                          {classesList.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Class Faculty Instructor</label>
                        <select name="teachId" className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg">
                          <option value="">Select instructor...</option>
                          {usersList.filter(u => u.role === 'teacher').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Map Curriculum Block
                    </button>
                  </form>
                </div>
              </div>

              {/* Class Lists Table */}
              <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
                <h3 className="font-bold text-slate-900">Configured Academic Departments</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {classesList.map((c) => (
                    <div key={c.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-slate-900 text-base">{c.name} - Section {c.section}</h4>
                        <p className="text-xs text-slate-500 font-medium">Lobby department: {c.department} | Room: {c.roomNumber}</p>
                        <p className="text-[10px] text-emerald-600 font-bold mt-1 uppercase">Class advisor token: {c.advisorId}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteClass(c.id)}
                        className="p-2 hover:bg-rose-50 text-rose-500 rounded-full transition-colors cursor-pointer"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EXAMS & MARKS DESK */}
          {activeTab === 'exams' && (
            <div className="space-y-6">
              {/* Teacher grading board */}
              {currentUser?.role === 'teacher' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                  {/* Exams creation */}
                  <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
                    <div>
                      <h3 className="font-extrabold text-slate-900">Provision Exam blocks</h3>
                      <p className="text-xs text-slate-400">Assemble schedules, milestones & assessments</p>
                    </div>

                    <form onSubmit={handleCreateExam} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assessment Label / Title</label>
                        <input
                          type="text"
                          className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                          placeholder="e.g. Unit Test II"
                          value={examForm.name}
                          onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select class</label>
                          <select
                            className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                            value={examForm.classId}
                            onChange={(e) => setExamForm({ ...examForm, classId: e.target.value })}
                            required
                          >
                            <option value="">Select Class...</option>
                            {classesList.map(cl => <option key={cl.id} value={cl.id}>{cl.name} {cl.section}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Topic/Course Subject</label>
                          <select
                            className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                            value={examForm.subjectId}
                            onChange={(e) => setExamForm({ ...examForm, subjectId: e.target.value })}
                            required
                          >
                            <option value="">Course Select...</option>
                            {subjectsList.map(su => <option key={su.id} value={su.id}>{su.name} ({su.code})</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Max Score achievable</label>
                          <input
                            type="number"
                            className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                            placeholder="100"
                            value={examForm.maxMarks}
                            onChange={(e) => setExamForm({ ...examForm, maxMarks: Number(e.target.value) })}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assessment Date</label>
                          <input
                            type="date"
                            className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                            value={examForm.examDate}
                            onChange={(e) => setExamForm({ ...examForm, examDate: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer"
                      >
                        Publish Assessment Schedule
                      </button>
                    </form>
                  </div>

                  {/* Grading panel */}
                  <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
                    <div>
                      <h3 className="font-extrabold text-slate-900">Grade allocation ledger</h3>
                      <p className="text-xs text-slate-400">Post student grades directly to dashboard registries</p>
                    </div>

                    <form onSubmit={handlePostGrade} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Assessment Block</label>
                        <select
                          className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg animate-fade-in"
                          value={gradeForm.examId}
                          onChange={(e) => setGradeForm({ ...gradeForm, examId: e.target.value })}
                          required
                        >
                          <option value="">Choose Exam Block...</option>
                          {examsList.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Student</label>
                          <select
                            className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg animate-fade-in"
                            value={gradeForm.studentId}
                            onChange={(e) => setGradeForm({ ...gradeForm, studentId: e.target.value })}
                            required
                          >
                            <option value="">Identify student...</option>
                            {usersList.filter(u => u.role === 'student').map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Obtained marks</label>
                          <input
                            type="number"
                            className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg animate-fade-in font-semibold"
                            value={gradeForm.obtainedMarks}
                            onChange={(e) => setGradeForm({ ...gradeForm, obtainedMarks: Number(e.target.value) })}
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Comments / grading feedback notes</label>
                        <input
                          type="text"
                          className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                          placeholder="e.g. Excellent conceptual focus shown."
                          value={gradeForm.comments}
                          onChange={(e) => setGradeForm({ ...gradeForm, comments: e.target.value })}
                        />
                      </div>

                      <button type="submit" className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer">
                        Lock Statement Grade Points
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Student and Parent view grades analyses */}
              {(currentUser?.role === 'student' || currentUser?.role === 'parent') && (
                <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-extrabold text-slate-900">Grade Report card ledger</h3>
                      <p className="text-xs text-slate-400">Verifiable academic records generated</p>
                    </div>
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Download report card (PDF)
                    </button>
                  </div>

                  <div className="overflow-x-auto pt-2">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          <th className="py-3 px-2">Topic Course/Assortment</th>
                          <th className="py-3 px-2 text-center">Score achieved</th>
                          <th className="py-3 px-2 text-center">Max Potential Marks</th>
                          <th className="py-3 px-2 text-center">Success Percentage %</th>
                          <th className="py-3 px-2">Instructor Review Comments</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                        {studentGradesList.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-slate-400 italic">No exams scores registered to student yet.</td>
                          </tr>
                        ) : (
                          studentGradesList.map(gr => (
                            <tr key={gr.id} className="hover:bg-slate-50/50">
                              <td className="py-4 px-2 font-bold text-slate-900">{gr.examName}</td>
                              <td className="py-4 px-2 text-center text-emerald-600 font-extrabold text-sm">{gr.obtainedMarks}</td>
                              <td className="py-4 px-2 text-center text-slate-400">{gr.maxMarks}</td>
                              <td className="py-4 px-2 text-center font-extrabold bg-slate-50/50">
                                {Math.round((gr.obtainedMarks / gr.maxMarks) * 100)} %
                              </td>
                              <td className="py-4 px-2 italic text-slate-500 font-medium">{gr.comments}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: DAILY ATTENDANCE REGISTER */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              {currentUser?.role === 'teacher' && (
                <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-6 animate-fade-in">
                  <div>
                    <h3 className="font-extrabold text-slate-900">Attendance marker</h3>
                    <p className="text-xs text-slate-400">Record client daily presence index variables</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Class Block</label>
                      <select
                        className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg focus:outline-none"
                        value={attendanceClassId}
                        onChange={(e) => {
                          setAttendanceClassId(e.target.value);
                          handleLoadClassForAttendance(e.target.value);
                        }}
                      >
                        <option value="">Choose Class...</option>
                        {classesList.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Marking Register Date</label>
                      <input
                        type="date"
                        className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                        value={attendanceDate}
                        onChange={(e) => setAttendanceDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {Object.keys(attendanceRecords).length > 0 && (
                    <form onSubmit={handleSubmitAttendance} className="space-y-4">
                      <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 overflow-hidden">
                        {Object.keys(attendanceRecords).map((stId) => {
                          const user = usersList.find(u => u.id === stId);
                          return (
                            <div key={stId} className="flex justify-between items-center p-4 bg-slate-50">
                              <span className="text-xs font-bold text-slate-900">{user?.name} (Roll: {user?.meta?.rollNo})</span>
                              
                              <div className="flex gap-2">
                                {['Present', 'Absent', 'Late'].map((st) => (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() => setAttendanceRecords({ ...attendanceRecords, [stId]: st as any })}
                                    className={`px-3 py-1 text-xs rounded-lg font-bold transition-colors cursor-pointer ${
                                      attendanceRecords[stId] === st ? (
                                        st === 'Present' ? 'bg-emerald-600 text-white' :
                                        st === 'Absent' ? 'bg-rose-500 text-white' : 'bg-amber-400 text-slate-900'
                                      ) : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {st}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer"
                      >
                        Publish Academic Register
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: PAYMENTS & FEE PORTAL */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              {/* Admin/Principal - Invoicing */}
              {(currentUser?.role === 'admin' || currentUser?.role === 'principal') && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                  <div className="lg:col-span-1 bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4 h-fit">
                    <div>
                      <h3 className="font-extrabold text-slate-900">Raise Student Billings</h3>
                      <p className="text-xs text-slate-400">Invoice tuition fee indexes securely</p>
                    </div>

                    <form onSubmit={handleCreateBilling} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Student Profile</label>
                        <select
                          className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                          value={paymentForm.studentId}
                          onChange={(e) => setPaymentForm({ ...paymentForm, studentId: e.target.value })}
                          required
                        >
                          <option value="">Identify student...</option>
                          {usersList.filter(u => u.role === 'student').map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Billing Type</label>
                          <select
                            className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                            value={paymentForm.type}
                            onChange={(e) => setPaymentForm({ ...paymentForm, type: e.target.value })}
                          >
                            <option value="Tuition">Tuition Fee</option>
                            <option value="Admission">Admission Registration</option>
                            <option value="Exam">Exam Fee</option>
                            <option value="Facility">Facility & Library</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Amount ({settings.currency})</label>
                          <input
                            type="number"
                            className="w-full p-2 bg-slate-50 border border-slate-200 text-xs font-bold rounded-lg"
                            value={paymentForm.amount}
                            onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Brief Description</label>
                        <input
                          type="text"
                          placeholder="e.g. Autumn Quarter Tuition Invoice"
                          className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                          value={paymentForm.description}
                          onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Due Date</label>
                        <input
                          type="date"
                          className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                          value={paymentForm.dueDate}
                          onChange={(e) => setPaymentForm({ ...paymentForm, dueDate: e.target.value })}
                          required
                        />
                      </div>

                      <button type="submit" className="w-full py-2.5 bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 rounded-lg cursor-pointer">
                        Publish Secured Invoice Statement
                      </button>
                    </form>
                  </div>

                  <div className="lg:col-span-2 bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
                    <h3 className="font-extrabold text-slate-900">Total institutional Billings log</h3>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            <th className="py-3 px-2">Student Ref</th>
                            <th className="py-3 px-2">Description</th>
                            <th className="py-3 px-2 text-center">Amount</th>
                            <th className="py-3 px-2 text-center">Due date</th>
                            <th className="py-3 px-2 text-right">Status State</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                          {allPayments.map(pay => (
                            <tr key={pay.id} className="hover:bg-slate-50/50">
                              <td className="py-4 px-2 font-bold text-slate-900">{pay.studentName}</td>
                              <td className="py-4 px-2 text-xs">{pay.description} ({pay.type})</td>
                              <td className="py-4 px-2 text-center text-slate-800 font-extrabold">{settings.currency} {pay.amount}</td>
                              <td className="py-4 px-2 text-center text-slate-400">{pay.dueDate}</td>
                              <td className="py-4 px-2 text-right">
                                <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase ${
                                  pay.status === 'Paid' ? 'bg-emerald-50 text-emerald-600' :
                                  pay.status === 'Pending' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-500'
                                }`}>
                                  {pay.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Student/Parent View - Active Payments checkout portal with Razorpay */}
              {(currentUser?.role === 'student' || currentUser?.role === 'parent') && (
                <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-6">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-lg">Fee Payment Desk</h3>
                    <p className="text-xs text-slate-400">Pay tuition, activities & assessment fees via Razorpay secure processing gateway</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Active Invoices */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">Unset Tuition & Assessment Invoices</h4>
                      
                      {studentPayments.filter(p => p.status !== 'Paid').length === 0 ? (
                        <p className="text-xs text-emerald-600 font-bold italic py-2">✨ All payments cleared and validated!</p>
                      ) : (
                        studentPayments.filter(p => p.status !== 'Paid').map(pay => (
                          <div key={pay.id} className="p-4 bg-slate-50 border border-slate-200/50 rounded-xl flex justify-between items-center transition-all hover:bg-slate-100/50">
                            <div>
                              <h5 className="font-bold text-slate-900 text-sm">{pay.description}</h5>
                              <p className="text-xs text-slate-500 font-medium">Type: {pay.type} | Payment code index: {pay.id}</p>
                              <p className="text-[10px] text-rose-500 font-bold mt-1 uppercase">Pay Before: {pay.dueDate}</p>
                            </div>
                            
                            <div className="text-right space-y-2">
                              <p className="text-lg font-black text-slate-900 shrink-0">{settings.currency} {pay.amount}</p>
                              <button
                                onClick={() => triggerRazorpayCheckout(pay)}
                                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <CreditCard className="h-3 w-3" /> Pay Fees
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Paid Ledger & Receipts */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">Transaction history & System Receipts</h4>
                      
                      <div className="space-y-3 max-h-[350px] overflow-y-auto">
                        {studentPayments.filter(p => p.status === 'Paid').map(pay => (
                          <div key={pay.id} className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-bold text-emerald-950 text-sm">{pay.description}</h5>
                                <p className="text-xs text-emerald-800 font-medium leading-relaxed">Paid Ref: {pay.receiptNo}</p>
                                <p className="text-[10px] text-emerald-600 font-bold mt-1">Transaction settled: {pay.paidDate}</p>
                              </div>
                              <span className="text-sm font-black text-emerald-800">{settings.currency} {pay.amount}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Sandbox Checkout Assistant */}
                  {selectedPaymentForCheckout && (
                    <div className="mt-4 p-4 border border-amber-200 bg-amber-50 rounded-xl space-y-3">
                      <div className="flex gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                        <div>
                          <h4 className="text-xs font-bold text-amber-900">Razorpay Simulation Controller active</h4>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            A high-fidelity payment flow simulation represents secure Razorpay server logic. Click below to verify transactions instantly.
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => setSelectedPaymentForCheckout(null)}
                          className="px-3 py-1 bg-white text-xs font-semibold rounded-lg text-slate-700 border border-slate-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSimulatePaymentResolve(selectedPaymentForCheckout.id, selectedPaymentForCheckout.razorpayOrderId)}
                          className="px-4 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer"
                        >
                          Simulate Gateway Verified Success
                        </button>
                      </div>
                    </div>
                  )}

                  {paymentResultMessage && (
                    <div className="p-3 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs leading-relaxed">
                      {paymentResultMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: NOTICE CHANNELS */}
          {activeTab === 'notices' && (
            <div className="space-y-6">
              {/* Creator block */}
              {(currentUser?.role === 'admin' || currentUser?.role === 'principal' || currentUser?.role === 'teacher') && (
                <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
                  <h3 className="font-extrabold text-slate-900">Broadcast Bulletins & Notice Builder</h3>
                  
                  <form onSubmit={handlePostNotice} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notice Headline</label>
                        <input
                          type="text"
                          placeholder="Summer Project allocations..."
                          className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                          value={noticeForm.title}
                          onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category Label</label>
                        <select
                          className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                          value={noticeForm.label}
                          onChange={(e) => setNoticeForm({ ...noticeForm, label: e.target.value as any })}
                        >
                          <option value="Notice">Standard Notice</option>
                          <option value="Event">Calendar Event Planning</option>
                          <option value="Holiday">Vacation & Holiday</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Audience</label>
                        <select
                          className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg animate-fade-in"
                          value={noticeForm.targetRole}
                          onChange={(e) => setNoticeForm({ ...noticeForm, targetRole: e.target.value as any })}
                        >
                          <option value="all">All Channels</option>
                          <option value="teacher">Faculty & Teachers only</option>
                          <option value="student">Students</option>
                          <option value="parent">Guardians & Parents</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Detailed Content</label>
                      <textarea
                        rows={3}
                        placeholder="Detailed scheduled info, specifications, timing schedules..."
                        className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg focus:outline-none"
                        value={noticeForm.content}
                        onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })}
                        required
                      />
                    </div>

                    <button type="submit" className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer">
                      Publish Notice Bulletin
                    </button>
                  </form>
                </div>
              )}

              {/* Notice display catalog */}
              <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
                <h3 className="font-extrabold text-slate-900 border-b border-slate-100 pb-2">Broadcast bulletins stream</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {noticesList.map((not) => (
                    <div key={not.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="p-1 px-2 text-[9px] bg-slate-100 uppercase tracking-wider rounded font-black text-slate-600">{not.label}</span>
                        {(currentUser?.role === 'admin' || currentUser?.role === 'principal') && (
                          <button
                            onClick={() => handleDeleteNotice(not.id)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-full cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-900">{not.title}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed font-semibold">{not.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: LEAVES */}
          {activeTab === 'leaves' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                <div className="md:col-span-1 bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4 h-fit">
                  <h3 className="font-extrabold text-slate-900">Request Leave Clearance</h3>
                  
                  <form onSubmit={handleApplyLeave} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Commencement Date</label>
                      <input
                        type="date"
                        className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                        value={leaveForm.startDate}
                        onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Termination Date</label>
                      <input
                        type="date"
                        className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                        value={leaveForm.endDate}
                        onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rational Justification Reason</label>
                      <input
                        type="text"
                        placeholder="Attending state conference workshop..."
                        className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                        value={leaveForm.reason}
                        onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                        required
                      />
                    </div>

                    <button type="submit" className="w-full py-2 bg-slate-900 border border-slate-900 text-white font-bold text-xs hover:bg-slate-800 rounded-lg cursor-pointer">
                      Dispatch Leave Application
                    </button>
                  </form>
                </div>

                <div className="md:col-span-2 bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
                  <h3 className="font-extrabold text-slate-900">Leaves status ledgers</h3>
                  <div className="space-y-3">
                    {leavesList.map(lv => (
                      <div key={lv.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{lv.reason}</h4>
                          <p className="text-[11px] text-slate-500 font-medium">Applied Span: {lv.startDate} through {lv.endDate}</p>
                          {lv.requesterName && <p className="text-[10px] text-slate-500 mt-1">Requested by: {lv.requesterName} ({lv.requesterRole})</p>}
                        </div>

                        <div className="text-right space-y-2">
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase ${
                            lv.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' :
                            lv.status === 'Rejected' ? 'bg-rose-50 text-rose-500' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {lv.status}
                          </span>

                          {(currentUser?.role === 'admin' || currentUser?.role === 'principal') && lv.status === 'Pending' && (
                            <div className="flex gap-1 pt-1">
                              <button onClick={() => handleUpdateLeaveStatus(lv.id, 'Approved')} className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold">Approve</button>
                              <button onClick={() => handleUpdateLeaveStatus(lv.id, 'Rejected')} className="px-2 py-0.5 bg-rose-500 text-white rounded text-[10px] font-bold">Reject</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: SETTINGS & BACKUPS */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
                  <h3 className="font-extrabold text-slate-900">Configure Academic Environment</h3>
                  
                  <form onSubmit={handleUpdateSchoolSettings} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">School Academy Label Name</label>
                      <input
                        type="text"
                        className="w-full p-2 bg-slate-50 border border-slate-200 text-xs font-semibold rounded-lg"
                        value={settings.schoolName}
                        onChange={(e) => setSettings({ ...settings, schoolName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Official Address</label>
                      <input
                        type="text"
                        className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                        value={settings.address}
                        onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Academic Year</label>
                        <input
                          type="text"
                          className="w-full p-2 bg-slate-50 border border-slate-200 text-xs font-semibold text-emerald-600 rounded-lg animate-fade-in"
                          value={settings.currentAcademicYear}
                          onChange={(e) => setSettings({ ...settings, currentAcademicYear: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Currency (e.g. INR/USD)</label>
                        <input
                          type="text"
                          className="w-full p-2 bg-slate-50 border border-slate-200 text-xs font-semibold rounded-lg animate-fade-in"
                          value={settings.currency}
                          onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                        />
                      </div>
                    </div>

                    <button type="submit" className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg cursor-pointer">
                      Align System Configurations
                    </button>
                  </form>
                </div>

                <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
                  <div>
                    <h3 className="font-extrabold text-slate-900">Database Backup & Recovery Desk</h3>
                    <p className="text-xs text-slate-400">Deploy snapshotted environments safely in milliseconds</p>
                  </div>

                  <button
                    onClick={handleTriggerBackup}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Database className="h-4 w-4" /> snapshot Database schema now
                  </button>

                  <div className="border-t border-slate-100 pt-4 space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Archived backups traces</h4>
                    
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {backupsList.map((bg) => (
                        <div key={bg} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center">
                          <span className="text-[11px] text-slate-600 font-bold">{bg}</span>
                          <button
                            onClick={() => handleRestoreBackup(bg)}
                            className="p-1 px-3 bg-slate-900 text-white rounded text-[10px] font-bold hover:bg-slate-800"
                          >
                            Restore Setup
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 10: HOMEWORK */}
          {activeTab === 'homework' && (
            <div className="space-y-6">
              {currentUser?.role === 'teacher' && (
                <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
                  <h3 className="font-extrabold text-slate-900">Allocate Daily Homework</h3>
                  
                  <form onSubmit={handlePostHomework} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Class Block</label>
                        <select
                          className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                          value={homeworkForm.classId}
                          onChange={(e) => setHomeworkForm({ ...homeworkForm, classId: e.target.value })}
                          required
                        >
                          <option value="">Choose Class...</option>
                          {classesList.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Course subject</label>
                        <select
                          className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                          value={homeworkForm.subjectId}
                          onChange={(e) => setHomeworkForm({ ...homeworkForm, subjectId: e.target.value })}
                          required
                        >
                          <option value="">Course Select...</option>
                          {subjectsList.map(su => <option key={su.id} value={su.id}>{su.name} ({su.code})</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Due date limit</label>
                        <input
                          type="date"
                          className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                          value={homeworkForm.dueDate}
                          onChange={(e) => setHomeworkForm({ ...homeworkForm, dueDate: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Homework Topic / Headline Title</label>
                      <input
                        type="text"
                        placeholder="Fourier series & Periodic signals proofs"
                        className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                        value={homeworkForm.title}
                        onChange={(e) => setHomeworkForm({ ...homeworkForm, title: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Procedural Guide Instructions</label>
                      <textarea
                        rows={3}
                        placeholder="Write questions from textbook pg 114 proofs..."
                        className="w-full p-2 bg-slate-50 border border-slate-200 text-xs rounded-lg"
                        value={homeworkForm.description}
                        onChange={(e) => setHomeworkForm({ ...homeworkForm, description: e.target.value })}
                      />
                    </div>

                    <button type="submit" className="w-full py-2.5 bg-slate-900 border border-slate-900 text-white font-bold text-xs hover:bg-slate-800 rounded-lg cursor-pointer">
                      Instate Homework allocation
                    </button>
                  </form>
                </div>
              )}

              {/* Viewer of homeworks */}
              {(currentUser?.role === 'student' || currentUser?.role === 'parent') && (
                <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4 animate-fade-in">
                  <h3 className="font-extrabold text-slate-900 border-b border-slate-100 pb-2">Active Homework allocations</h3>
                  
                  {homeworksList.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No assigned homeworks registered to class.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {homeworksList.map(hw => (
                        <div key={hw.id} className="p-4 bg-slate-50 rounded-xl border border-slate-150- border-slate-200/50">
                          <h4 className="font-bold text-slate-900 text-sm">{hw.title}</h4>
                          <p className="text-[11px] text-slate-500 font-medium">Subject Class: {hw.subjectName}</p>
                          <p className="text-xs text-slate-600 mt-2 leading-relaxed">{hw.description}</p>
                          <div className="mt-3 flex justify-between items-center border-t border-slate-200/40 pt-2 text-[10px] uppercase font-bold text-rose-500">
                            <span>Due Before calendar boundary: {hw.dueDate}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 11: ACADEMIC CALENDAR TIMETABLE */}
          {activeTab === 'timetable' && (
            <div className="space-y-6">
              {(currentUser?.role === 'student' || currentUser?.role === 'parent') && (
                <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
                  <h3 className="font-extrabold text-slate-900">Academic schedule timetable</h3>
                  <p className="text-xs text-slate-400">Regular recurring time periods for assigned courses</p>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map((dayNum) => {
                      const dayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][dayNum - 1];
                      const sessions = selectedClassTimetable.filter(t => t.dayOfWeek === dayNum);
                      return (
                        <div key={dayNum} className="p-4 bg-slate-50 rounded-xl space-y-2 border border-slate-200/50">
                          <h4 className="font-extrabold text-slate-900 border-b border-slate-200/70 pb-1 text-xs">{dayName}</h4>
                          
                          {sessions.length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic">No sessions scheduled.</p>
                          ) : (
                            sessions.map(s => {
                              const subj = subjectsList.find(su => su.id === s.subjectId);
                              return (
                                <div key={s.id} className="p-2 bg-white rounded-lg border border-slate-100 text-[11px]">
                                  <p className="font-bold text-slate-900">{subj?.name || 'Class period'}</p>
                                  <p className="text-slate-500">{s.startTime} - {s.endTime}</p>
                                  <p className="text-emerald-600 font-bold mt-1 text-[9px]">{s.room}</p>
                                </div>
                              );
                            })
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* Modern footer details */}
      <footer className="bg-white border-t border-slate-100 py-4 px-6 text-center text-slate-400 text-[11px] shrink-0 font-medium">
        {settings.schoolName} Enterprise School Resource Coordinator • Sector Aligned Data Encryption Enabled
      </footer>
    </div>
  );
}
