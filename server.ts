import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { DatabaseService, User, SchoolClass, Subject, Student, Teacher, Parent, Timetable, Exam, Mark, Attendance, Payment, Homework, Notice, LeaveRequest } from './src/db/databaseService.js';

dotenv.config();

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-school-master-key-xyz-777';

// Initialize Razorpay
// If env vars are missing, we provide default/sandbox keys to avoid crash on startup and guide user
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_StMaryAcademy2026';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'testsecret_stmarykey';

let razorpayInstance: Razorpay | null = null;
try {
  razorpayInstance = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
} catch (error) {
  console.warn('Failed to initialize Razorpay SDK. Mock Razorpay transactions will be activated.', error);
}

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Middleware: Verify Token & Roles ---

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'admin' | 'principal' | 'teacher' | 'student' | 'parent';
  };
}

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token missing' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token expired or invalid' });
    }
    req.user = decoded as AuthRequest['user'];
    next();
  });
};

const authorizeRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
};

const validateUserFields = (req: Request, res: Response, next: NextFunction) => {
  const { email, password, name, role } = req.body;
  if (!email || !name || !role) {
    return res.status(400).json({ error: 'Email, Name, and Role are mandatory' });
  }
  next();
};

// --- AUTHENTICATION API ENDPOINTS ---

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = DatabaseService.getDb();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
  if (!user || user.status !== 'active') {
    return res.status(401).json({ error: 'Invalid credentials or inactive account' });
  }

  const isMatch = bcrypt.compareSync(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      phone: user.phone,
      address: user.address
    }
  });
});

app.post('/api/auth/register', validateUserFields, (req: Request, res: Response) => {
  const { email, password, role, name, phone, address } = req.body;
  const db = DatabaseService.getDb();

  const userExists = db.users.some(u => u.email.toLowerCase() === email.toLowerCase().trim());
  if (userExists) {
    return res.status(400).json({ error: 'User with this email already registered' });
  }

  const defaultPass = password || 'school123';
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(defaultPass, salt);
  const userId = `u-${Date.now()}`;

  const newUser: User = {
    id: userId,
    email: email.toLowerCase().trim(),
    passwordHash,
    role,
    name,
    phone: phone || '',
    address: address || '',
    status: 'active',
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);

  // If role is student, teacher, or parent, populate respective tables safely
  if (role === 'student') {
    const newStudent: Student = {
      id: userId,
      rollNo: req.body.rollNo || String(Math.floor(1000 + Math.random() * 9000)),
      admissionNo: req.body.admissionNo || `ADM-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      classId: req.body.classId || '',
      guardianId: req.body.guardianId || '',
      admissionDate: req.body.admissionDate || new Date().toISOString().split('T')[0],
      dob: req.body.dob || '2010-01-01',
      gender: req.body.gender || 'Male'
    };
    db.students.push(newStudent);
  } else if (role === 'teacher') {
    const newTeacher: Teacher = {
      id: userId,
      department: req.body.department || 'General Education',
      qualification: req.body.qualification || 'Bachelor Graduate',
      joiningDate: req.body.joiningDate || new Date().toISOString().split('T')[0],
      subjectSpecialization: req.body.subjectSpecialization || 'Generalist'
    };
    db.teachers.push(newTeacher);
  } else if (role === 'parent') {
    const newParent: Parent = {
      id: userId,
      occupation: req.body.occupation || 'Self-employed',
      relation: req.body.relation || 'Guardian'
    };
    db.parents.push(newParent);
  }

  DatabaseService.save();
  res.status(201).json({ message: 'User registered successfully', userId, credentials: { email, password: defaultPass } });
});

app.get('/api/auth/profile', authenticateToken, (req: AuthRequest, res: Response) => {
  const db = DatabaseService.getDb();
  const userId = req.user?.id;
  const user = db.users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Fetch role-specific details
  let meta: any = {};
  if (user.role === 'student') {
    meta = db.students.find(s => s.id === userId) || {};
  } else if (user.role === 'teacher') {
    meta = db.teachers.find(t => t.id === userId) || {};
  } else if (user.role === 'parent') {
    meta = db.parents.find(p => p.id === userId) || {};
  }

  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    phone: user.phone,
    address: user.address,
    status: user.status,
    meta
  });
});

app.put('/api/auth/profile', authenticateToken, (req: AuthRequest, res: Response) => {
  const db = DatabaseService.getDb();
  const userId = req.user?.id;
  const { name, phone, address, password } = req.body;

  const user = db.users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User profile not found' });
  }

  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (address !== undefined) user.address = address;
  
  if (password && password.trim().length >= 6) {
    const salt = bcrypt.genSaltSync(10);
    user.passwordHash = bcrypt.hashSync(password.trim(), salt);
  }

  DatabaseService.save();
  res.json({ message: 'Profile updated successfully', user: { id: user.id, name: user.name, phone: user.phone, address: user.address } });
});

// --- ADMIN & PRINCIPAL CONTROLLERS / USERS & STATS ---

app.get('/api/admin/stats', authenticateToken, authorizeRoles('admin', 'principal'), (req: Request, res: Response) => {
  const db = DatabaseService.getDb();
  
  const totalUsers = db.users.length;
  const students = db.users.filter(u => u.role === 'student').length;
  const teachers = db.users.filter(u => u.role === 'teacher').length;
  const classes = db.classes.length;
  const paymentsPaid = db.payments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0);
  const paymentsPending = db.payments.filter(p => p.status === 'Unpaid').reduce((sum, p) => sum + p.amount, 0);

  // Modern analytical metrics for gorgeous charts
  const feeStats = {
    totalRevenue: paymentsPaid + paymentsPending,
    collected: paymentsPaid,
    due: paymentsPending,
  };

  const studentGenderRatio = {
    male: db.students.filter(s => s.gender === 'Male').length,
    female: db.students.filter(s => s.gender === 'Female').length,
    other: db.students.filter(s => s.gender === 'Other').length
  };

  const noticeBoardSummary = db.notices.slice(-5).reverse();

  res.json({
    totalUsers,
    totalStudents: students,
    totalTeachers: teachers,
    totalClasses: classes,
    feeStats,
    studentGenderRatio,
    recentNotices: noticeBoardSummary
  });
});

// User Management CRUD
app.get('/api/admin/users', authenticateToken, authorizeRoles('admin', 'principal'), (req: Request, res: Response) => {
  const db = DatabaseService.getDb();
  const usersWithMeta = db.users.map(u => {
    let meta: any = {};
    if (u.role === 'student') {
      meta = db.students.find(s => s.id === u.id) || {};
    } else if (u.role === 'teacher') {
      meta = db.teachers.find(t => t.id === u.id) || {};
    } else if (u.role === 'parent') {
      meta = db.parents.find(p => p.id === u.id) || {};
    }
    return { ...u, meta };
  });
  res.json(usersWithMeta);
});

app.put('/api/admin/users/:id', authenticateToken, authorizeRoles('admin'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, phone, address, status, role, email } = req.body;
  const db = DatabaseService.getDb();

  const user = db.users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (address !== undefined) user.address = address;
  if (status) user.status = status;
  if (email) user.email = email.toLowerCase().trim();

  // Handle role-specific updates based on request body
  if (user.role === 'student') {
    const student = db.students.find(s => s.id === id);
    if (student) {
      if (req.body.classId !== undefined) student.classId = req.body.classId;
      if (req.body.rollNo !== undefined) student.rollNo = req.body.rollNo;
      if (req.body.guardianId !== undefined) student.guardianId = req.body.guardianId;
    }
  } else if (user.role === 'teacher') {
    const teacher = db.teachers.find(t => t.id === id);
    if (teacher) {
      if (req.body.department !== undefined) teacher.department = req.body.department;
      if (req.body.qualification !== undefined) teacher.qualification = req.body.qualification;
      if (req.body.subjectSpecialization !== undefined) teacher.subjectSpecialization = req.body.subjectSpecialization;
    }
  }

  DatabaseService.save();
  res.json({ message: 'User updated successfully', user });
});

app.delete('/api/admin/users/:id', authenticateToken, authorizeRoles('admin'), (req: Request, res: Response) => {
  const { id } = req.params;
  const db = DatabaseService.getDb();

  const index = db.users.findIndex(u => u.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = db.users[index];

  // Prevent self-deletion
  if (user.id === 'u-admin') {
    return res.status(400).json({ error: 'Cannot delete central Super Admin bootstrapping' });
  }

  db.users.splice(index, 1);

  // Clean auxiliary tables
  db.students = db.students.filter(s => s.id !== id);
  db.teachers = db.teachers.filter(t => t.id !== id);
  db.parents = db.parents.filter(p => p.id !== id);

  DatabaseService.save();
  res.json({ message: 'User and all linked schemas deleted successfully' });
});

// --- CLASS CRUD ---
app.get('/api/classes', authenticateToken, (req: Request, res: Response) => {
  res.json(DatabaseService.getDb().classes);
});

app.post('/api/admin/classes', authenticateToken, authorizeRoles('admin', 'principal'), (req: Request, res: Response) => {
  const { name, section, department, roomNumber, advisorId } = req.body;
  if (!name || !section) {
    return res.status(400).json({ error: 'Name and Section details required' });
  }
  const db = DatabaseService.getDb();
  const newClass: SchoolClass = {
    id: `c-${Date.now()}`,
    name,
    section,
    department: department || '',
    roomNumber: roomNumber || '',
    advisorId: advisorId || ''
  };
  db.classes.push(newClass);
  DatabaseService.save();
  res.status(201).json({ message: 'Class generated', schoolClass: newClass });
});

app.put('/api/admin/classes/:id', authenticateToken, authorizeRoles('admin', 'principal'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, section, department, roomNumber, advisorId } = req.body;
  const db = DatabaseService.getDb();
  const schoolClass = db.classes.find(c => c.id === id);
  if (!schoolClass) {
    return res.status(404).json({ error: 'Class not found' });
  }
  if (name) schoolClass.name = name;
  if (section) schoolClass.section = section;
  if (department !== undefined) schoolClass.department = department;
  if (roomNumber !== undefined) schoolClass.roomNumber = roomNumber;
  if (advisorId !== undefined) schoolClass.advisorId = advisorId;

  DatabaseService.save();
  res.json({ message: 'Class configured successfully', schoolClass });
});

app.delete('/api/admin/classes/:id', authenticateToken, authorizeRoles('admin'), (req: Request, res: Response) => {
  const { id } = req.params;
  const db = DatabaseService.getDb();
  db.classes = db.classes.filter(c => c.id !== id);
  // Optional: Nullify student and subject keys referencing this class
  db.students.forEach(s => { if (s.classId === id) s.classId = ''; });
  db.subjects.forEach(sb => { if (sb.classId === id) sb.classId = ''; });

  DatabaseService.save();
  res.json({ message: 'Class scrubbed from scheduler' });
});

// --- SUBJECT CRUD ---
app.get('/api/subjects', authenticateToken, (req: Request, res: Response) => {
  res.json(DatabaseService.getDb().subjects);
});

app.post('/api/admin/subjects', authenticateToken, authorizeRoles('admin', 'principal'), (req: Request, res: Response) => {
  const { name, code, classId, teacherId } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: 'Name and Code required for Subjects registration' });
  }
  const db = DatabaseService.getDb();
  const newSubject: Subject = {
    id: `subj-${Date.now()}`,
    name,
    code,
    classId: classId || '',
    teacherId: teacherId || ''
  };
  db.subjects.push(newSubject);
  DatabaseService.save();
  res.status(201).json({ message: 'Subject mapped', subject: newSubject });
});

app.put('/api/admin/subjects/:id', authenticateToken, authorizeRoles('admin', 'principal'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, code, classId, teacherId } = req.body;
  const db = DatabaseService.getDb();
  const subject = db.subjects.find(s => s.id === id);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });

  if (name) subject.name = name;
  if (code) subject.code = code;
  if (classId !== undefined) subject.classId = classId;
  if (teacherId !== undefined) subject.teacherId = teacherId;

  DatabaseService.save();
  res.json({ message: 'Subject credentials updated', subject });
});

app.delete('/api/admin/subjects/:id', authenticateToken, authorizeRoles('admin'), (req: Request, res: Response) => {
  const { id } = req.params;
  const db = DatabaseService.getDb();
  db.subjects = db.subjects.filter(s => s.id !== id);
  DatabaseService.save();
  res.json({ message: 'Subject deleted' });
});

// --- NOTICE BOARD CRUD ---
app.get('/api/notices', authenticateToken, (req: AuthRequest, res: Response) => {
  const db = DatabaseService.getDb();
  const role = req.user?.role;
  // Filter notices relevant to the user role
  if (role === 'admin' || role === 'principal') {
    return res.json(db.notices);
  }
  const filtered = db.notices.filter(n => n.targetRole === 'all' || n.targetRole === role);
  res.json(filtered);
});

app.post('/api/admin/notices', authenticateToken, authorizeRoles('admin', 'principal', 'teacher'), (req: AuthRequest, res: Response) => {
  const { title, content, targetRole, label, eventDate } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are mandatory' });
  }
  const db = DatabaseService.getDb();
  const newNotice: Notice = {
    id: `not-${Date.now()}`,
    title,
    content,
    targetRole: targetRole || 'all',
    postedBy: req.user?.id || 'admin',
    label: label || 'Notice',
    createdAt: new Date().toISOString(),
    eventDate: eventDate || undefined
  };
  db.notices.push(newNotice);
  DatabaseService.save();
  res.status(201).json({ message: 'Notice posted successfully', notice: newNotice });
});

app.delete('/api/admin/notices/:id', authenticateToken, authorizeRoles('admin', 'principal', 'teacher'), (req: Request, res: Response) => {
  const { id } = req.params;
  const db = DatabaseService.getDb();
  db.notices = db.notices.filter(n => n.id !== id);
  DatabaseService.save();
  res.json({ message: 'Notice removed' });
});

// --- TIMETABLE MANAGEMENT ---
app.get('/api/timetable/:classId', authenticateToken, (req: Request, res: Response) => {
  const { classId } = req.params;
  const db = DatabaseService.getDb();
  const schedule = db.timetables.filter(t => t.classId === classId);
  res.json(schedule);
});

app.post('/api/admin/timetable', authenticateToken, authorizeRoles('admin', 'principal'), (req: Request, res: Response) => {
  const { classId, subjectId, teacherId, dayOfWeek, startTime, endTime, room } = req.body;
  if (!classId || !subjectId || !teacherId || !dayOfWeek || !startTime || !endTime) {
    return res.status(400).json({ error: 'Class, Subject, Teacher, Day, and Timings are mandatory' });
  }

  // Conflict Checking
  const db = DatabaseService.getDb();
  const conflicts = db.timetables.some(t => 
    t.dayOfWeek === Number(dayOfWeek) &&
    ((startTime >= t.startTime && startTime < t.endTime) || (endTime > t.startTime && endTime <= t.endTime)) &&
    (t.teacherId === teacherId || t.room === room)
  );

  if (conflicts) {
    return res.status(409).json({ error: 'Scheduling Conflict: Teacher or Room has overlapping timetables' });
  }

  const newSession: Timetable = {
    id: `tt-${Date.now()}`,
    classId,
    subjectId,
    teacherId,
    dayOfWeek: Number(dayOfWeek),
    startTime,
    endTime,
    room: room || 'General Lecture Hall'
  };

  db.timetables.push(newSession);
  DatabaseService.save();
  res.status(201).json({ message: 'Timetable schedule generated', session: newSession });
});

app.delete('/api/admin/timetable/:id', authenticateToken, authorizeRoles('admin', 'principal'), (req: Request, res: Response) => {
  const { id } = req.params;
  const db = DatabaseService.getDb();
  db.timetables = db.timetables.filter(t => t.id !== id);
  DatabaseService.save();
  res.json({ message: 'Timetable period cancelled' });
});

// --- RESTORE & BACKUPS ---
app.get('/api/admin/backups', authenticateToken, authorizeRoles('admin'), (req: Request, res: Response) => {
  const list = DatabaseService.getBackupsList();
  res.json(list);
});

app.post('/api/admin/backups', authenticateToken, authorizeRoles('admin'), (req: Request, res: Response) => {
  const filename = DatabaseService.createBackup();
  res.status(201).json({ message: 'Database state snapshotted successfully', filename });
});

app.post('/api/admin/backups/restore', authenticateToken, authorizeRoles('admin'), (req: Request, res: Response) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'Filename is required for target state restoration' });

  const status = DatabaseService.restoreBackup(filename);
  if (status) {
    res.json({ message: 'Data structural alignment restored successfully' });
  } else {
    res.status(500).json({ error: 'Corrupt snapshot file or restoration integrity loss' });
  }
});

// --- SETTINGS ---
app.get('/api/settings', (req: Request, res: Response) => {
  res.json(DatabaseService.getDb().settings);
});

app.put('/api/admin/settings', authenticateToken, authorizeRoles('admin', 'principal'), (req: Request, res: Response) => {
  const db = DatabaseService.getDb();
  const { schoolName, address, contactEmail, contactPhone, currentAcademicYear, currency } = req.body;
  
  if (schoolName) db.settings.schoolName = schoolName;
  if (address) db.settings.address = address;
  if (contactEmail) db.settings.contactEmail = contactEmail;
  if (contactPhone) db.settings.contactPhone = contactPhone;
  if (currentAcademicYear) db.settings.currentAcademicYear = currentAcademicYear;
  if (currency) db.settings.currency = currency;

  DatabaseService.save();
  res.json({ message: 'Global academic environment configuration aligned', settings: db.settings });
});


// --- TEACHER OPERATIONS: ATTENDANCE, EXAMS, HOMEWORK, LEAVE & GRADES ---

// Create Exams
app.post('/api/teacher/exams', authenticateToken, authorizeRoles('teacher', 'principal', 'admin'), (req: Request, res: Response) => {
  const { name, type, classId, subjectId, examDate, maxMarks } = req.body;
  if (!name || !classId || !subjectId || !examDate || !maxMarks) {
    return res.status(400).json({ error: 'Name, Class, Subject, Date, and Maximum obtainable marks are needed.' });
  }
  const db = DatabaseService.getDb();
  const newExam: Exam = {
    id: `ex-${Date.now()}`,
    name,
    type: type || 'Unit Test',
    classId,
    subjectId,
    examDate,
    maxMarks: Number(maxMarks)
  };
  db.exams.push(newExam);
  DatabaseService.save();
  res.status(201).json({ message: 'Examination block registered', exam: newExam });
});

app.get('/api/exams', authenticateToken, (req: Request, res: Response) => {
  res.json(DatabaseService.getDb().exams);
});

// Grading/Marks
app.post('/api/teacher/marks', authenticateToken, authorizeRoles('teacher'), (req: AuthRequest, res: Response) => {
  const { examId, studentId, subjectId, obtainedMarks, comments } = req.body;
  if (!examId || !studentId || !obtainedMarks) {
    return res.status(400).json({ error: 'Exam identity, student mapping, and obtained marks required' });
  }

  const db = DatabaseService.getDb();
  const exam = db.exams.find(e => e.id === examId);
  if (!exam) return res.status(404).json({ error: 'Target examination not found' });

  if (Number(obtainedMarks) > exam.maxMarks) {
    return res.status(400).json({ error: `Obtained marks cannot exceed Max Marks (${exam.maxMarks})` });
  }

  // Update existing grade or insert
  const existingGrade = db.marks.find(m => m.examId === examId && m.studentId === studentId);
  if (existingGrade) {
    existingGrade.obtainedMarks = Number(obtainedMarks);
    existingGrade.comments = comments || '';
    existingGrade.gradedDate = new Date().toISOString().split('T')[0];
    existingGrade.gradedBy = req.user?.id || '';
  } else {
    const newGrade: Mark = {
      id: `m-${Date.now()}`,
      examId,
      studentId,
      subjectId: subjectId || exam.subjectId,
      obtainedMarks: Number(obtainedMarks),
      comments: comments || '',
      gradedDate: new Date().toISOString().split('T')[0],
      gradedBy: req.user?.id || ''
    };
    db.marks.push(newGrade);
  }

  DatabaseService.save();
  res.json({ message: 'Grade marks committed' });
});

app.get('/api/marks/:studentId', authenticateToken, (req: Request, res: Response) => {
  const { studentId } = req.params;
  const db = DatabaseService.getDb();
  const studentMarks = db.marks.filter(m => m.studentId === studentId).map(m => {
    const exam = db.exams.find(e => e.id === m.examId);
    const subject = db.subjects.find(s => s.id === m.subjectId);
    return {
      ...m,
      examName: exam?.name || 'Academic Exam',
      examType: exam?.type || 'Assessment',
      subjectName: subject?.name || 'General Coursework',
      maxMarks: exam?.maxMarks || 100
    };
  });
  res.json(studentMarks);
});

// Take Attendance
app.post('/api/teacher/attendance', authenticateToken, authorizeRoles('teacher'), (req: AuthRequest, res: Response) => {
  const { classId, date, records } = req.body; // records: [{studentId: "...", status: "Present"|"Absent"|"Late"}]
  if (!classId || !date || !records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Class, Date, and student performance records array are required' });
  }

  const db = DatabaseService.getDb();
  records.forEach((rec: { studentId: string; status: 'Present' | 'Absent' | 'Late' }) => {
    const existing = db.attendances.find(a => a.studentId === rec.studentId && a.date === date);
    if (existing) {
      existing.status = rec.status;
      existing.markedBy = req.user?.id || '';
    } else {
      const entry: Attendance = {
        id: `att-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        studentId: rec.studentId,
        classId,
        date,
        status: rec.status,
        markedBy: req.user?.id || ''
      };
      db.attendances.push(entry);
    }
  });

  DatabaseService.save();
  res.json({ message: 'Attendance register securely recorded' });
});

app.get('/api/attendance/:studentId', authenticateToken, (req: Request, res: Response) => {
  const { studentId } = req.params;
  const db = DatabaseService.getDb();
  const list = db.attendances.filter(a => a.studentId === studentId);
  res.json(list);
});

// Homework CRUD
app.get('/api/homeworks/:classId', authenticateToken, (req: Request, res: Response) => {
  const { classId } = req.params;
  const db = DatabaseService.getDb();
  const homeworkList = db.homeworks.filter(h => h.classId === classId).map(h => {
    const subject = db.subjects.find(s => s.id === h.subjectId);
    return {
      ...h,
      subjectName: subject?.name || 'Homework assignments'
    };
  });
  res.json(homeworkList);
});

app.post('/api/teacher/homework', authenticateToken, authorizeRoles('teacher'), (req: AuthRequest, res: Response) => {
  const { classId, subjectId, title, description, dueDate } = req.body;
  if (!classId || !subjectId || !title || !dueDate) {
    return res.status(400).json({ error: 'Class, Subject, Title and Due Date are required instructions' });
  }

  const db = DatabaseService.getDb();
  const newHomework: Homework = {
    id: `hw-${Date.now()}`,
    classId,
    subjectId,
    title,
    description: description || '',
    dueDate,
    teacherId: req.user?.id || '',
    createdAt: new Date().toISOString()
  };

  db.homeworks.push(newHomework);
  DatabaseService.save();
  res.status(201).json({ message: 'Homework allocated and dispatched to class portal', homework: newHomework });
});

// Leave Application
app.post('/api/leaves', authenticateToken, (req: AuthRequest, res: Response) => {
  const { startDate, endDate, reason } = req.body;
  if (!startDate || !endDate || !reason) {
    return res.status(400).json({ error: 'Leave span and explicit rational reason are mandatory' });
  }

  const db = DatabaseService.getDb();
  const newLeave: LeaveRequest = {
    id: `lv-${Date.now()}`,
    userId: req.user?.id || '',
    startDate,
    endDate,
    reason,
    status: 'Pending',
    createdAt: new Date().toISOString()
  };

  db.leaves.push(newLeave);
  DatabaseService.save();
  res.status(201).json({ message: 'Leave application submitted on scheduler stream', leave: newLeave });
});

app.get('/api/leaves', authenticateToken, (req: AuthRequest, res: Response) => {
  const db = DatabaseService.getDb();
  // If admin/principal, show all. Otherwise, self leaves
  if (req.user?.role === 'admin' || req.user?.role === 'principal') {
    const results = db.leaves.map(l => {
      const user = db.users.find(u => u.id === l.userId);
      return { ...l, requesterName: user?.name || 'Associate Staff', requesterRole: user?.role || 'Staff' };
    });
    return res.json(results);
  }
  const selfLeaves = db.leaves.filter(l => l.userId === req.user?.id);
  res.json(selfLeaves);
});

app.put('/api/leaves/:id', authenticateToken, authorizeRoles('admin', 'principal'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status || !['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid leave status resolution' });
  }

  const db = DatabaseService.getDb();
  const leave = db.leaves.find(l => l.id === id);
  if (!leave) return res.status(404).json({ error: 'Leave request not found' });

  leave.status = status;
  leave.approvedBy = req.user?.id;

  DatabaseService.save();
  res.json({ message: `Leave request marked as ${status}`, leave });
});


// --- FEE MANAGEMENT & COMPLETE RAZORPAY BILLING ENDPOINTS ---

app.get('/api/payments/student/:studentId', authenticateToken, (req: Request, res: Response) => {
  const { studentId } = req.params;
  const db = DatabaseService.getDb();
  const paymentHistory = db.payments.filter(p => p.studentId === studentId);
  res.json(paymentHistory);
});

app.get('/api/payments', authenticateToken, authorizeRoles('admin', 'principal'), (req: Request, res: Response) => {
  const db = DatabaseService.getDb();
  const detailed = db.payments.map(p => {
    const studentUser = db.users.find(u => u.id === p.studentId);
    return {
      ...p,
      studentName: studentUser?.name || 'Billy Miller',
      studentEmail: studentUser?.email || ''
    };
  });
  res.json(detailed);
});

app.post('/api/admin/payments', authenticateToken, authorizeRoles('admin', 'principal'), (req: Request, res: Response) => {
  const { studentId, amount, type, description, dueDate } = req.body;
  if (!studentId || !amount || !dueDate) {
    return res.status(400).json({ error: 'Student Mapping, billing amount, and due date are prerequisite fields' });
  }
  const db = DatabaseService.getDb();
  const newInvoice: Payment = {
    id: `pay-${Date.now()}`,
    studentId,
    amount: Number(amount),
    status: 'Unpaid',
    type: type || 'Tuition',
    description: description || 'General Educational Levy',
    dueDate
  };
  db.payments.push(newInvoice);
  DatabaseService.save();
  res.status(201).json({ message: 'Bill Invoice generated and sent to target portal', payment: newInvoice });
});

// Razorpay Order Creation Route
app.post('/api/payments/razorpay/create-order', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { paymentId } = req.body; // internal invoice payment entity ID (e.g. 'pay-2')
  if (!paymentId) return res.status(400).json({ error: 'Invoice identity required to process transaction flow' });

  const db = DatabaseService.getDb();
  const paymentRecord = db.payments.find(p => p.id === paymentId);
  if (!paymentRecord) return res.status(404).json({ error: 'Billing Invoice record not found' });

  if (paymentRecord.status === 'Paid') {
    return res.status(400).json({ error: 'This billing invoice has already been fully paid and clear' });
  }

  const orderOptions = {
    amount: paymentRecord.amount * 100, // Razorpay requires paise / smallest denomination
    currency: db.settings.currency || 'INR',
    receipt: `receipt_${paymentRecord.id}`,
    payment_capture: 1 // Auto-capture payments
  };

  try {
    if (razorpayInstance && !RAZORPAY_KEY_ID.startsWith('rzp_test_StMaryAcademy')) {
      const rxOrder = await razorpayInstance.orders.create(orderOptions);
      paymentRecord.razorpayOrderId = rxOrder.id;
      paymentRecord.status = 'Pending';
      DatabaseService.save();

      return res.json({
        orderId: rxOrder.id,
        amount: rxOrder.amount,
        currency: rxOrder.currency,
        keyId: RAZORPAY_KEY_ID,
        internalPaymentId: paymentRecord.id
      });
    } else {
      // High-fidelity sandbox environment simulator for immediate deployment without real API credential roadblocks
      const mockOrderId = `order_sim_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      paymentRecord.razorpayOrderId = mockOrderId;
      paymentRecord.status = 'Pending';
      DatabaseService.save();

      return res.json({
        orderId: mockOrderId,
        amount: orderOptions.amount,
        currency: orderOptions.currency,
        keyId: RAZORPAY_KEY_ID,
        internalPaymentId: paymentRecord.id,
        isSandboxSimulator: true
      });
    }
  } catch (error: any) {
    console.error('Razorpay Order Creation Failed:', error);
    res.status(500).json({ error: 'Failed to initiate secure online processing order transaction: ' + (error.message || error) });
  }
});

// Razorpay Payment Verification & Full Receipt Generation
app.post('/api/payments/razorpay/verify', authenticateToken, (req: AuthRequest, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, internalPaymentId, isSandboxSimulatedSuccess } = req.body;
  const db = DatabaseService.getDb();

  const paymentRecord = db.payments.find(p => p.id === internalPaymentId);
  if (!paymentRecord) {
    return res.status(404).json({ error: 'Associated invoice item trace failed. Corrupted transaction map.' });
  }

  // If executing under sandbox simulator fallback
  if (isSandboxSimulatedSuccess || razorpay_order_id?.startsWith('order_sim_') || RAZORPAY_KEY_ID.startsWith('rzp_test_StMaryAcademy')) {
    paymentRecord.status = 'Paid';
    paymentRecord.razorpayOrderId = razorpay_order_id || `order_sim_${Date.now()}`;
    paymentRecord.razorpayPaymentId = razorpay_payment_id || `pay_sim_${Date.now()}`;
    paymentRecord.paidDate = new Date().toISOString().split('T')[0];
    paymentRecord.receiptNo = `REC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    
    DatabaseService.save();
    return res.json({
      message: 'Sandbox Simulated receipt cleared and paid successfully!',
      status: 'Paid',
      receipt: {
        receiptNo: paymentRecord.receiptNo,
        amount: paymentRecord.amount,
        dueDate: paymentRecord.dueDate,
        paidDate: paymentRecord.paidDate,
        type: paymentRecord.type,
        description: paymentRecord.description,
        transactionId: paymentRecord.razorpayPaymentId
      }
    });
  }

  // Real Signature Verification Flow
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Incomplete credentials sent for processing verification' });
  }

  // HMAC-SHA256 verification
  const secret = RAZORPAY_KEY_SECRET;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
  const generatedSignature = hmac.digest('hex');

  if (generatedSignature !== razorpay_signature) {
    return res.status(400).json({ error: 'Fraud/Security block: Signature verification failed. Cryptographic mismatch.' });
  }

  // Record Success
  paymentRecord.status = 'Paid';
  paymentRecord.razorpayOrderId = razorpay_order_id;
  paymentRecord.razorpayPaymentId = razorpay_payment_id;
  paymentRecord.paidDate = new Date().toISOString().split('T')[0];
  paymentRecord.receiptNo = `REC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  DatabaseService.save();
  res.json({
    message: 'Payment verification complete. Invoice cleared!',
    status: 'Paid',
    receipt: {
      receiptNo: paymentRecord.receiptNo,
      amount: paymentRecord.amount,
      dueDate: paymentRecord.dueDate,
      paidDate: paymentRecord.paidDate,
      type: paymentRecord.type,
      description: paymentRecord.description,
      transactionId: paymentRecord.razorpayPaymentId
    }
  });
});


// --- INTEGRATING PROGRAMMATIC DEVELOPER VITE MIDDLEWARE ---
// This serves client SPA in production and developer server assets seamlessly.
const isProd = process.env.NODE_ENV === 'production' || fs.existsSync(path.resolve(process.cwd(), 'dist'));

if (isProd) {
  // Serve the built static assets
  const distPath = path.resolve(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
} else {
  // Programmatic dev mounting
  console.log('Mounting Reactive Dev Workspace environments...');
  try {
    const createViteServer = (require as any)('vite').createServer;
    createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    }).then((vite: any) => {
      app.use(vite.middlewares);
    }).catch((err: any) => {
      console.error('Vite dev server failed to start:', err);
    });
  } catch (err) {
    console.error('Vite dev server failed to load dynamically:', err);
  }
}

// Global Exception Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Critical Exception Stack trace: ", err);
  res.status(500).json({ error: 'Internal system fault: ' + (err.message || 'unknown exception') });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`===================================================`);
  console.log(`ST. MARY ERP SYSTEM: Server listening on port ${PORT}`);
  console.log(`Running mode: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`===================================================`);
});
