const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");

const db = new sqlite3.Database("../databases/database.db", (err) => {
  if (err) {
    console.error("Error connecting to SQLite database:", err.message);
  } else {
    console.log("Connected to the SQLite database.");
  }
});

db.serialize(() => {
  // Drop the courses table if it exists
  db.run("DROP TABLE IF EXISTS courses", (err) => {
    if (err) {
      console.error("Error dropping courses table:", err.message);
    } else {
      console.log("Courses table dropped (if it existed)");
    }
  });

  // Create the courses table with the necessary fields
  db.run(
    `
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL,
      level TEXT NOT NULL,
      maxStudents INTEGER NOT NULL,
      tutoringType TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      meetingLink TEXT NOT NULL,
      userId INTEGER,
      description TEXT,  -- Added description field
      FOREIGN KEY(userId) REFERENCES users(id)
    )
  `,
    (err) => {
      if (err) {
        console.error("Error creating courses table:", err.message);
      } else {
        console.log("Courses table created successfully.");
      }
    }
  );
});

db.serialize(() => {
  // Drop the courses table if it exists
  db.run("DROP TABLE IF EXISTS course_availability", (err) => {
    if (err) {
      console.error(
        "Error dropping cocourse_availabilityurses table:",
        err.message
      );
    } else {
      console.log("course_availability table dropped (if it existed)");
    }
  });
  db.run(`
    CREATE TABLE IF NOT EXISTS course_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courseId INTEGER NOT NULL,
      maxStudents INTEGER NOT NULL,
      actualStudents INTEGER DEFAULT 0,
      FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE,
      UNIQUE(courseId)
    )
  `);

  (err) => {
    if (err) {
      console.error("Error creating course_availability table:", err.message);
    } else {
      console.log("course_availability table created successfully.");
    }
  };
});

// Definiere alle Kurse
const courses = [
  {
    title: "Advanced Python",
    category: "Coding",
    subcategory: "Python",
    level: "Advanced",
    maxStudents: 10,
    tutoringType: "Online",
    date: "2025-01-20",
    time: "10:00",
    meetingLink: "http://zoom.com/meeting1",
    userId: 2,
  },
  {
    title: "React Fundamentals",
    category: "Coding",
    subcategory: "JavaScript",
    level: "Intermediate",
    maxStudents: 15,
    tutoringType: "Online",
    date: "2025-02-05",
    time: "14:00",
    meetingLink: "http://zoom.com/meeting2",
    userId: 2,
  },
  {
    title: "JavaScript for Beginners",
    category: "Coding",
    subcategory: "JavaScript",
    level: "Amateur",
    maxStudents: 20,
    tutoringType: "In-person",
    date: "2025-03-01",
    time: "16:00",
    meetingLink: "http://zoom.com/meeting3",
    userId: 2,
  },
  {
    title: "CCNA Routing & Switching",
    category: "Networking Technologies",
    subcategory: "Routing",
    level: "Advanced",
    maxStudents: 10,
    tutoringType: "Online",
    date: "2025-01-25",
    time: "11:00",
    meetingLink: "http://zoom.com/meeting4",
    userId: 8,
  },
  {
    title: "Cloud Networking",
    category: "Networking Technologies",
    subcategory: "WAN",
    level: "Intermediate",
    maxStudents: 12,
    tutoringType: "In-person",
    date: "2025-02-10",
    time: "15:00",
    meetingLink: "http://zoom.com/meeting5",
    userId: 8,
  },
  {
    title: "Wireless Security Basics",
    category: "Networking Technologies",
    subcategory: "LAN",
    level: "Intermediate",
    maxStudents: 8,
    tutoringType: "Online",
    date: "2025-03-15",
    time: "13:00",
    meetingLink: "http://zoom.com/meeting6",
    userId: 8,
  },
  {
    title: "Machine Learning Overview",
    category: "AI and Data Science",
    subcategory: "Machine Learning",
    level: "Advanced",
    maxStudents: 12,
    tutoringType: "Online",
    date: "2025-04-05",
    time: "09:00",
    meetingLink: "http://zoom.com/meeting7",
    userId: 9,
  },
  {
    title: "Data Analytics Basics",
    category: "AI and Data Science",
    subcategory: "Data Analytics",
    level: "Intermediate",
    maxStudents: 15,
    tutoringType: "In-person",
    date: "2025-04-10",
    time: "14:00",
    meetingLink: "http://zoom.com/meeting8",
    userId: 9,
  },
  {
    title: "Introduction to Cryptography",
    category: "IT Security",
    subcategory: "Cryptography",
    level: "Beginner",
    maxStudents: 20,
    tutoringType: "Online",
    date: "2025-05-01",
    time: "11:00",
    meetingLink: "http://zoom.com/meeting9",
    userId: 9,
  },
  {
    title: "Ethical Hacking Bootcamp",
    category: "IT Security",
    subcategory: "Ethical Hacking",
    level: "Advanced",
    maxStudents: 12,
    tutoringType: "In-person",
    date: "2025-05-15",
    time: "13:00",
    meetingLink: "http://zoom.com/meeting10",
    userId: 9,
  },
  {
    title: "Linux System Administration Basics",
    category: "Linux System Administration",
    subcategory: "Linux",
    level: "Intermediate",
    maxStudents: 10,
    tutoringType: "Online",
    date: "2025-06-01",
    time: "09:30",
    meetingLink: "http://zoom.com/meeting11",
    userId: 11,
  },
  {
    title: "Mail Services (SMTP) Configuration",
    category: "Linux System Administration",
    subcategory: "SMTP",
    level: "Intermediate",
    maxStudents: 8,
    tutoringType: "In-person",
    date: "2025-06-15",
    time: "16:00",
    meetingLink: "http://zoom.com/meeting12",
    userId: 11,
  },
  {
    title: "Introduction to UML",
    category: "Software Design & Engineering",
    subcategory: "UML",
    level: "Intermediate",
    maxStudents: 20,
    tutoringType: "Online",
    date: "2025-07-01",
    time: "10:00",
    meetingLink: "http://zoom.com/meeting13",
    userId: 11,
  },
  {
    title: "Agile Methodologies for Software Engineering",
    category: "Software Design & Engineering",
    subcategory: "Agile Methodologies",
    level: "Advanced",
    maxStudents: 15,
    tutoringType: "In-person",
    date: "2025-07-10",
    time: "14:00",
    meetingLink: "http://zoom.com/meeting14",
    userId: 11,
  },
  {
    title: "Fiber Optics in Telecommunications",
    category: "Telecommunications Systems",
    subcategory: "Fiber Optics",
    level: "Advanced",
    maxStudents: 12,
    tutoringType: "Online",
    date: "2025-08-01",
    time: "11:00",
    meetingLink: "http://zoom.com/meeting15",
    userId: 11,
  },
];

// Kurse einfügen und die Verfügbarkeit in 'course_availability' hinzufügen
courses.forEach((course) => {
  db.run(
    `INSERT INTO courses (title, category, subcategory, level, maxStudents, tutoringType, date, time, meetingLink, userId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      course.title,
      course.category,
      course.subcategory,
      course.level,
      course.maxStudents,
      course.tutoringType,
      course.date,
      course.time,
      course.meetingLink,
      course.userId,
    ],
    function (err) {
      if (err) {
        console.error("Error inserting course:", err.message);
      } else {
        const courseId = this.lastID; // Kurs-ID nach Einfügen des Kurses
        const insertAvailabilityQuery = `
          INSERT INTO course_availability (courseId, maxStudents, actualStudents)
          VALUES (?, ?, ?)
        `;
        db.run(
          insertAvailabilityQuery,
          [courseId, course.maxStudents, 0], // Setze initial 0 für actualStudents
          (err) => {
            if (err) {
              console.error(
                "Error inserting into course_availability:",
                err.message
              );
            }
          }
        );
      }
    }
  );
});
