import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

// --- Relational Interfaces ---

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'principal' | 'teacher' | 'student' | 'parent';
  name: string;
  phone: string;
  address: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface SchoolClass {
  id: string; // e.g. "class-1"
  name: string; // e.g. "Grade 10"
  section: string; // e.g. "A"
  department: string; // e.g. "Science"
  roomNumber: string;
  advisorId: string; // FK to User (Teacher/Principal)
}

export interface Subject {
  id: string;
  name: string;
  code: string; // e.g. "MATH101"
  classId: string; // FK to SchoolClass
  teacherId: string; // FK to User (Teacher)
}

export interface Student {
  id: string; // FK to User
  rollNo: string;
  admissionNo: string;
  classId: string; // FK to SchoolClass
  guardianId: string; // FK to User (Parent)
  admissionDate: string;
  dob: string;
  gender: string;
}

export interface Teacher {
  id: string; // FK to User
  department: string;
  qualification: string;
  joiningDate: string;
  subjectSpecialization: string;
}

export interface Parent {
  id: string; // FK to User
  occupation: string;
  relation: string; // "Father" | "Mother" | "Guardian"
}

export interface Timetable {
  id: string;
  classId: string; // FK
  subjectId: string; // FK
  teacherId: string; // FK
  dayOfWeek: number; // 1 = Monday, 5 = Friday, etc.
  startTime: string; // "09:00"
  endTime: string; // "10:00"
  room: string;
}

export interface Exam {
  id: string;
  name: string; // e.g. "Midterm Exams 2026"
  type: string; // "Midterm" | "Final" | "Unit Test"
  classId: string; // FK
  subjectId: string; // FK
  examDate: string;
  maxMarks: number;
}

export interface Mark {
  id: string;
  examId: string; // FK
  studentId: string; // FK
  subjectId: string; // FK
  obtainedMarks: number;
  comments: string;
  gradedDate: string;
  gradedBy: string; // FK to User (Teacher)
}

export interface Attendance {
  id: string;
  studentId: string; // FK
  classId: string; // FK
  date: string; // YYYY-MM-DD
  status: 'Present' | 'Absent' | 'Late';
  markedBy: string; // FK to User (Teacher)
}

export interface Payment {
  id: string;
  studentId: string; // FK
  amount: number;
  status: 'Paid' | 'Unpaid' | 'Pending';
  type: string; // "Tuition" | "Admission" | "Exam" | "Facility"
  description: string;
  dueDate: string;
  paidDate?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  receiptNo?: string;
}

export interface Homework {
  id: string;
  classId: string; // FK
  subjectId: string; // FK
  title: string;
  description: string;
  dueDate: string;
  teacherId: string; // FK
  createdAt: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  targetRole: 'all' | 'teacher' | 'student' | 'parent';
  postedBy: string; // FK to User
  label: 'Notice' | 'Event' | 'Holiday';
  createdAt: string;
  eventDate?: string; // Filled if Event
}

export interface LeaveRequest {
  id: string;
  userId: string; // FK to User (Teacher or Student)
  startDate: string;
  endDate: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string; // FK to User (Admin/Principal/Teacher)
  createdAt: string;
}

export interface SchoolSettings {
  schoolName: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  currentAcademicYear: string;
  currency: string;
}

// --- Combined Schema Structure ---

export interface DatabaseSchema {
  users: User[];
  classes: SchoolClass[];
  subjects: Subject[];
  students: Student[];
  teachers: Teacher[];
  parents: Parent[];
  timetables: Timetable[];
  exams: Exam[];
  marks: Mark[];
  attendances: Attendance[];
  payments: Payment[];
  homeworks: Homework[];
  notices: Notice[];
  leaves: LeaveRequest[];
  settings: SchoolSettings;
}

// --- Database Service Class ---

const DB_FILE_PATH = path.resolve(process.cwd(), 'db.json');
const BACKUPS_DIR = path.resolve(process.cwd(), 'backups');

export class DatabaseService {
  private static db: DatabaseSchema | null = null;

  // Initialize and load database
  public static getDb(): DatabaseSchema {
    if (!this.db) {
      this.load();
    }
    return this.db!;
  }

  // Load from disk, create with seeds if missing
  private static load(): void {
    if (fs.existsSync(DB_FILE_PATH)) {
      try {
        const fileContent = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        this.db = JSON.parse(fileContent);
      } catch (err) {
        console.error('Error loading database, resetting...', err);
        this.initializeWithSeeds();
      }
    } else {
      this.initializeWithSeeds();
    }
  }

  // Save database back to db.json
  public static save(): void {
    if (!this.db) return;
    try {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(this.db, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving database:', err);
    }
  }

  // Create standard schema and bootstrap with seeded entries
  private static initializeWithSeeds(): void {
    console.log('Seeding relational school database...');

    const salt = bcrypt.genSaltSync(10);
    
    // Default passwords for testing
    const p_admin = bcrypt.hashSync('admin123', salt);
    const p_principal = bcrypt.hashSync('principal123', salt);
    const p_teacher1 = bcrypt.hashSync('teacher123', salt);
    const p_teacher2 = bcrypt.hashSync('teacher123', salt);
    const p_student = bcrypt.hashSync('student123', salt);
    const p_parent = bcrypt.hashSync('parent123', salt);

    const users: User[] = [
      {
        id: 'u-admin',
        email: 'admin@school.com',
        passwordHash: p_admin,
        role: 'admin',
        name: 'John Doe (Super Admin)',
        phone: '+1 555-0101',
        address: '100 Admin HQ Blvd',
        status: 'active',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'u-principal',
        email: 'principal@school.com',
        passwordHash: p_principal,
        role: 'principal',
        name: 'Dr. Sarah Jenkins (Principal)',
        phone: '+1 555-0102',
        address: '102 Principal Residence',
        status: 'active',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'u-teacher1',
        email: 'teacher.alex@school.com',
        passwordHash: p_teacher1,
        role: 'teacher',
        name: 'Alex Mercer (Math Specialist)',
        phone: '+1 555-0103',
        address: '404 Linear Algebra Way',
        status: 'active',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'u-teacher2',
        email: 'teacher.elena@school.com',
        passwordHash: p_teacher2,
        role: 'teacher',
        name: 'Elena Rostova (Science Specialist)',
        phone: '+1 555-0104',
        address: '505 Quantum Physics Ave',
        status: 'active',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'u-parent',
        email: 'parent.mark@gmail.com',
        passwordHash: p_parent,
        role: 'parent',
        name: 'Mark Miller (Parent)',
        phone: '+1 555-0105',
        address: '707 Maple Street Oaks',
        status: 'active',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'u-student',
        email: 'student.billy@school.com',
        passwordHash: p_student,
        role: 'student',
        name: 'Billy Miller (Class 10-A Student)',
        phone: '+1 555-0106',
        address: '707 Maple Street Oaks',
        status: 'active',
        createdAt: new Date().toISOString(),
      }
    ];

    const classes: SchoolClass[] = [
      {
        id: 'c-10a',
        name: 'Grade 10',
        section: 'A',
        department: 'High School Science',
        roomNumber: 'Room 302',
        advisorId: 'u-teacher1',
      },
      {
        id: 'c-11b',
        name: 'Grade 11',
        section: 'B',
        department: 'High School Humanities',
        roomNumber: 'Room 305',
        advisorId: 'u-teacher2',
      }
    ];

    const subjects: Subject[] = [
      {
        id: 's-math10',
        name: 'Advanced Mathematics',
        code: 'MATH-102',
        classId: 'c-10a',
        teacherId: 'u-teacher1',
      },
      {
        id: 's-phys10',
        name: 'Physics Foundations',
        code: 'PHYS-101',
        classId: 'c-10a',
        teacherId: 'u-teacher2',
      },
      {
        id: 's-lit11',
        name: 'English Literature',
        code: 'LIT-201',
        classId: 'c-11b',
        teacherId: 'u-teacher2',
      }
    ];

    const students: Student[] = [
      {
        id: 'u-student',
        rollNo: '1024',
        admissionNo: 'ADM-2026-90',
        classId: 'c-10a',
        guardianId: 'u-parent',
        admissionDate: '2026-01-10',
        dob: '2010-05-14',
        gender: 'Male',
      }
    ];

    const teachers: Teacher[] = [
      {
        id: 'u-teacher1',
        department: 'Mathematics',
        qualification: 'M.Sc. in Mathematics',
        joiningDate: '2022-08-15',
        subjectSpecialization: 'Calculus & Statistics',
      },
      {
        id: 'u-teacher2',
        department: 'Natural Sciences',
        qualification: 'Ph.D. in Physics',
        joiningDate: '2023-09-01',
        subjectSpecialization: 'Electromagnetism & Wave Mechanics',
      }
    ];

    const parents: Parent[] = [
      {
        id: 'u-parent',
        occupation: 'Software Engineer',
        relation: 'Father',
      }
    ];

    // Build some high quality Initial Timetable schedule
    const timetables: Timetable[] = [
      {
        id: 'tt-1',
        classId: 'c-10a',
        subjectId: 's-math10',
        teacherId: 'u-teacher1',
        dayOfWeek: 1, // Monday
        startTime: '08:30',
        endTime: '09:45',
        room: 'Room 302',
      },
      {
        id: 'tt-2',
        classId: 'c-10a',
        subjectId: 's-phys10',
        teacherId: 'u-teacher2',
        dayOfWeek: 1, // Monday
        startTime: '10:00',
        endTime: '11:15',
        room: 'Lab 2A',
      },
      {
        id: 'tt-3',
        classId: 'c-10a',
        subjectId: 's-math10',
        teacherId: 'u-teacher1',
        dayOfWeek: 3, // Wednesday
        startTime: '08:30',
        endTime: '09:45',
        room: 'Room 302',
      },
      {
        id: 'tt-4',
        classId: 'c-10a',
        subjectId: 's-phys10',
        teacherId: 'u-teacher2',
        dayOfWeek: 4, // Thursday
        startTime: '10:00',
        endTime: '11:15',
        room: 'Lab 2A',
      }
    ];

    const exams: Exam[] = [
      {
        id: 'ex-mid1',
        name: 'First Term Calculus Exam',
        type: 'Midterm',
        classId: 'c-10a',
        subjectId: 's-math10',
        examDate: '2026-06-25',
        maxMarks: 100,
      }
    ];

    const marks: Mark[] = [
      {
        id: 'm-1',
        examId: 'ex-mid1',
        studentId: 'u-student',
        subjectId: 's-math10',
        obtainedMarks: 92,
        comments: 'Excellent analytic skills shown.',
        gradedDate: '2026-06-26',
        gradedBy: 'u-teacher1',
      }
    ];

    const attendances: Attendance[] = [
      { id: 'att-1', studentId: 'u-student', classId: 'c-10a', date: '2026-06-15', status: 'Present', markedBy: 'u-teacher1' },
      { id: 'att-2', studentId: 'u-student', classId: 'c-10a', date: '2026-06-16', status: 'Present', markedBy: 'u-teacher1' },
      { id: 'att-3', studentId: 'u-student', classId: 'c-10a', date: '2026-06-17', status: 'Late', markedBy: 'u-teacher1' }
    ];

    // Seed some core Tuition/Exam billing
    const payments: Payment[] = [
      {
        id: 'pay-1',
        studentId: 'u-student',
        amount: 2500,
        status: 'Paid',
        type: 'Tuition',
        description: 'First Term Tuition Fee 2026',
        dueDate: '2026-05-01',
        paidDate: '2026-04-28',
        receiptNo: 'REC-2026-1002',
        razorpayOrderId: 'order_offline_seeded',
        razorpayPaymentId: 'pay_offline_seeded',
      },
      {
        id: 'pay-2',
        studentId: 'u-student',
        amount: 1500,
        status: 'Unpaid',
        type: 'Tuition',
        description: 'Second Term Tuition Fee 2026',
        dueDate: '2026-09-01',
      },
      {
        id: 'pay-3',
        studentId: 'u-student',
        amount: 350,
        status: 'Unpaid',
        type: 'Exam',
        description: 'Midterm Board Examination Fees',
        dueDate: '2026-06-30',
      }
    ];

    const homeworks: Homework[] = [
      {
        id: 'hw-1',
        classId: 'c-10a',
        subjectId: 's-math10',
        title: 'Fourier Series & Periodic Signals',
        description: 'Solve questions 1 through 8 from chapter 4. Write proofs clearly on grid paper and upload scan.',
        dueDate: '2026-06-22',
        teacherId: 'u-teacher1',
        createdAt: new Date().toISOString(),
      }
    ];

    const notices: Notice[] = [
      {
        id: 'not-1',
        title: 'Annual Science Fair 2026',
        content: 'We are pleased to invite all teachers, students, and parents to the school Science and Technology Exposition. Exhibits open from 9 AM in the main pavilion.',
        targetRole: 'all',
        postedBy: 'u-principal',
        label: 'Event',
        createdAt: new Date().toISOString(),
        eventDate: '2026-07-10',
      },
      {
        id: 'not-2',
        title: 'Summer Holiday Notice',
        content: 'The school will remain closed for summer break starting July 15th through August 15th. Regular sessions resume on August 18th.',
        targetRole: 'all',
        postedBy: 'u-principal',
        label: 'Holiday',
        createdAt: new Date().toISOString(),
      }
    ];

    const leaves: LeaveRequest[] = [
      {
        id: 'lv-1',
        userId: 'u-teacher1',
        startDate: '2026-06-19',
        endDate: '2026-06-20',
        reason: 'Attending University Conference peer-panel.',
        status: 'Approved',
        approvedBy: 'u-principal',
        createdAt: new Date().toISOString(),
      }
    ];

    const settings: SchoolSettings = {
      schoolName: 'St. Mary Advanced Academy',
      address: '742 Evergreen Terrace, Sector 4, Metro State',
      contactEmail: 'administration@stmaryacademy.edu',
      contactPhone: '+1 (555) 0190-200',
      currentAcademicYear: '2026-2027',
      currency: 'INR',
    };

    this.db = {
      users,
      classes,
      subjects,
      students,
      teachers,
      parents,
      timetables,
      exams,
      marks,
      attendances,
      payments,
      homeworks,
      notices,
      leaves,
      settings,
    };

    this.save();
    console.log('Seed initialization complete!');
  }

  // --- Backup & Restore Engine ---
  
  public static getBackupsList(): string[] {
    if (!fs.existsSync(BACKUPS_DIR)) {
      return [];
    }
    try {
      return fs.readdirSync(BACKUPS_DIR).filter(file => file.endsWith('.json')).sort().reverse();
    } catch {
      return [];
    }
  }

  public static createBackup(): string {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.json`;
    const targetPath = path.join(BACKUPS_DIR, filename);
    const data = JSON.stringify(this.getDb(), null, 2);
    fs.writeFileSync(targetPath, data, 'utf-8');
    return filename;
  }

  public static restoreBackup(filename: string): boolean {
    const targetPath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(targetPath)) {
      return false;
    }
    try {
      const data = fs.readFileSync(targetPath, 'utf-8');
      const loaded = JSON.parse(data) as DatabaseSchema;
      // Do standard validation check
      if (loaded.users && loaded.settings && loaded.classes) {
        this.db = loaded;
        this.save();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error during restoration:', err);
      return false;
    }
  }
}
