const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database.db"); // Stelle sicher, dass der Pfad zu deiner Datenbank korrekt ist

// Testdaten für Benutzer (Admin, 2 Tutoren und 3 Studenten)
const users = [
  {
    username: "Admin",
    role: "admin",
    email: "admin@example.com",
    password: "admin123",
  },
  {
    username: "Heinz Neunmalklug",
    role: "tutor",
    email: "heinz@example.com",
    password: "password123",
  },
  {
    username: "Franz Schule",
    role: "tutor",
    email: "franz@example.com",
    password: "password123",
  },
  {
    username: "Camilla Studiosa",
    role: "student",
    email: "camilla@example.com",
    password: "student123",
  },
  {
    username: "Christian Klug",
    role: "student",
    email: "christian@example.com",
    password: "student123",
  },
  {
    username: "Viktoria Lernreich",
    role: "student",
    email: "viktoria@example.com",
    password: "student123",
  },
];

// Testdaten für 6 Kurse (3 pro Tutor)
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
    userId: 1,
  }, // Heinz Neunmalklug
  {
    title: "React Fundamentals",
    category: "Coding",
    subcategory: "React",
    level: "Intermediate",
    maxStudents: 15,
    tutoringType: "Online",
    date: "2025-02-05",
    time: "14:00",
    meetingLink: "http://zoom.com/meeting2",
    userId: 1,
  }, // Heinz Neunmalklug
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
    userId: 1,
  }, // Heinz Neunmalklug
  {
    title: "CCNA Routing & Switching",
    category: "Network Technologies",
    subcategory: "CCNA",
    level: "Advanced",
    maxStudents: 10,
    tutoringType: "Online",
    date: "2025-01-25",
    time: "11:00",
    meetingLink: "http://zoom.com/meeting4",
    userId: 2,
  }, // Franz Schule
  {
    title: "Cloud Networking",
    category: "Network Technologies",
    subcategory: "Cloud Networking",
    level: "Intermediate",
    maxStudents: 12,
    tutoringType: "In-person",
    date: "2025-02-10",
    time: "15:00",
    meetingLink: "http://zoom.com/meeting5",
    userId: 2,
  }, // Franz Schule
  {
    title: "Wireless Security Basics",
    category: "Network Technologies",
    subcategory: "Wireless Security",
    level: "Intermediate",
    maxStudents: 8,
    tutoringType: "Online",
    date: "2025-03-15",
    time: "13:00",
    meetingLink: "http://zoom.com/meeting6",
    userId: 2,
  }, // Franz Schule
];

// Funktion zum Hinzufügen der Testdaten
const addTestData = () => {
  db.serialize(() => {
    // Lösche die bestehenden Tabellen (falls vorhanden)
    db.run("DROP TABLE IF EXISTS users", (err) => {
      if (err) {
        console.error("Error dropping users table:", err.message);
      } else {
        console.log("Users table dropped (if it existed)");
      }
    });

    db.run("DROP TABLE IF EXISTS courses", (err) => {
      if (err) {
        console.error("Error dropping courses table:", err.message);
      } else {
        console.log("Courses table dropped (if it existed)");
      }
    });

    // Erstelle die Tabellen neu
    db.run(
      `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        role TEXT NOT NULL,
        email TEXT NOT NULL,
        password TEXT NOT NULL
      )
    `,
      (err) => {
        if (err) {
          console.error("Error creating users table:", err.message);
        }
      }
    );

    db.run(
      `
      CREATE TABLE courses (
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
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `,
      (err) => {
        if (err) {
          console.error("Error creating courses table:", err.message);
        }
      }
    );

    // Benutzer hinzufügen, beginnend mit dem Admin
    const insertUserQuery =
      "INSERT INTO users (username, role, email, password) VALUES (?, ?, ?, ?)";

    // Admin-Benutzer zuerst hinzufügen
    db.run(
      insertUserQuery,
      [users[0].username, users[0].role, users[0].email, users[0].password],
      function (err) {
        if (err) {
          console.error("Error inserting admin:", err.message);
          db.close();
        } else {
          const adminId = this.lastID; // ID des Admins erhalten
          console.log("Admin added with ID:", adminId);

          // Dann die restlichen Benutzer hinzufügen
          users.slice(1).forEach((user) => {
            db.run(
              insertUserQuery,
              [user.username, user.role, user.email, user.password],
              function (err) {
                if (err) {
                  console.error("Error inserting user:", err.message);
                }
              }
            );
          });

          // Kurse hinzufügen
          const insertCourseQuery = `
          INSERT INTO courses (title, category, subcategory, level, maxStudents, tutoringType, date, time, meetingLink, userId)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

          courses.forEach((course) => {
            db.run(
              insertCourseQuery,
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
                }
              }
            );
          });

          console.log("Test data added successfully!");

          // Schließe die Datenbankverbindung nach dem Einfügen aller Daten
          db.close();
        }
      }
    );
  });
};

// Führe die Funktion aus
addTestData();
