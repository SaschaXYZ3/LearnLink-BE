const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");

const db = new sqlite3.Database("./databases/database.db", (err) => {
  if (err) {
    console.error("Error connecting to SQLite database:", err.message);
  } else {
    console.log("Connected to the SQLite database.");
  }
});

db.serialize(() => {
  // Drop tables if they exist (uncomment for resetting database)
  /*db.run("DROP TABLE IF EXISTS users", (err) => {
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
  });*/

  // Create roles table
  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT,
      password TEXT,
      roleId INTEGER,
      birthDate TEXT,
      profileImage TEXT,
      FOREIGN KEY (roleId) REFERENCES roles (id)
    )
  `);

  // Create courses table
  db.run(`
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
      FOREIGN KEY(userId) REFERENCES users(id)
    )

  `);

  //FORUM 

  //posts tabelle
  db.run(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      username TEXT NOT NULL,
      likes INTEGER DEFAULT 0,
      reported INTEGER DEFAULT 0
      )
    `);

    //Post interactions tabelle

    db.run(`
      CREATE TABLE IF NOT EXISTS post_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      liked INTEGER DEFAULT 0, -- 0 represents false, 1 represents true
      reported INTEGER DEFAULT 0, -- 0 represents false, 1 represents true
      UNIQUE(user_id, post_id) -- Ensure one user can interact only once per post
        )
      `);
  
  
  

  // Tabelle für Kommentare (Posts verlinken mit Post-ID)
  db.run(`
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        postId INTEGER,
        content TEXT NOT NULL,
        author TEXT NOT NULL,
        FOREIGN KEY (postId) REFERENCES posts(id)
      )
    `);
  db.run(`
      CREATE TABLE IF NOT EXISTS contact_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        date TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

  db.run(`
      CREATE TABLE IF NOT EXISTS course_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        courseId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        rating INTEGER CHECK(rating BETWEEN 1 AND 5),
        comment TEXT,
        date TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (courseId) REFERENCES courses (id),
        FOREIGN KEY (userId) REFERENCES users (id)
      )
    `);

  db.run(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        courseId INTEGER NOT NULL,
        UNIQUE(userId, courseId), 
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (courseId) REFERENCES courses(id)
      )
    `);

  db.run(`
      CREATE TABLE IF NOT EXISTS course_students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        courseId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        date_enrolled TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(courseId, userId)
      )
    `);

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

  /*
  db.run("DROP TABLE IF EXISTS course_enrollment", (err) => {
      if (err) {
        console.error("Error dropping users table:", err.message);
      } else {
        console.log("Users table dropped (if it existed)");
      }
    });
    */

  db.run(`
      CREATE TABLE IF NOT EXISTS course_enrollment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,  
        courseId INTEGER NOT NULL,             
        userId INTEGER NOT NULL,               
        status INTEGER NOT NULL DEFAULT 3,     
        date DATETIME DEFAULT CURRENT_TIMESTAMP,            
        FOREIGN KEY(courseId) REFERENCES courses(id), 
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

  // Add initial roles
  const roles = ["admin", "tutor", "student"];
  roles.forEach((role) => {
    db.run(`INSERT OR IGNORE INTO roles (name) VALUES (?)`, [role], (err) => {
      if (err) {
        console.error(`Error inserting role '${role}':`, err.message);
      }
    });
  });

  // Tabelle booking_status erstellen, falls sie noch nicht existiert
  db.run(
    `
  CREATE TABLE IF NOT EXISTS booking_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL
  );
`,
    (err) => {
      if (err) {
        console.error("Fehler beim Erstellen der booking_status-Tabelle:", err);
      } else {
        console.log("Tabelle booking_status erfolgreich erstellt.");
      }
    }
  );

  // Füge die Standardstatus-Werte in die Tabelle booking_status ein, falls sie noch nicht vorhanden sind.
  const statuses = ["requested", "booked", "completed", "rejected"];
  statuses.forEach((status) => {
    db.run("INSERT OR IGNORE INTO booking_status (status) VALUES (?)", [
      status,
    ]);
  });

  // Add admin user if not already present
  const adminUsername = "admin";
  const adminEmail = "admin@learnlink.at";
  const adminPassword = bcrypt.hashSync("admin123", 10); // Password hashing

  db.get(
    `SELECT * FROM users WHERE username = ?`,
    [adminUsername],
    (err, row) => {
      if (err) {
        console.error(
          "Error while checking for existing admin user:",
          err.message
        );
        return;
      }

      if (row) {
        console.log("Admin user already exists, skipping insertion.");
      } else {
        db.get(
          `SELECT id FROM roles WHERE name = ?`,
          ["admin"],
          (err, role) => {
            if (err) {
              console.error("Error fetching admin role:", err.message);
              return;
            }
            if (!role) {
              console.error("Admin role not found in roles table.");
              return;
            }

            db.run(
              `INSERT INTO users (username, email, password, roleId, birthDate)
             VALUES (?, ?, ?, ?, ?)`,
              [adminUsername, adminEmail, adminPassword, role.id, "2000-01-01"],
              (err) => {
                if (err) {
                  console.error("Error while adding admin user:", err.message);
                } else {
                  console.log("Admin user added successfully!");
                }
              }
            );
          }
        );
      }
    }
  );

  // Testdaten (kann zum Testen verwendet werden, einfach den Block auskommentieren)

  // Definiere alle Benutzer
  /*const users = [
    {
      username: "admin",
      role: "admin",
      email: "admin@learnlink.at",
      password: "admin123",
    }, // Admin
    {
      username: "Heinz Neunmalklug",
      role: "tutor",
      email: "heinz@example.com",
      password: "password123",
    }, // Tutor 1
    {
      username: "Franz Schule",
      role: "tutor",
      email: "franz@example.com",
      password: "password123",
    }, // Tutor 2
    {
      username: "Camilla Studiosa",
      role: "student",
      email: "camilla@example.com",
      password: "student123",
    }, // Student 1
    {
      username: "Christian Klug",
      role: "student",
      email: "christian@example.com",
      password: "student123",
    }, // Student 2
    {
      username: "Viktoria Lernreich",
      role: "student",
      email: "viktoria@example.com",
      password: "student123",
    }, // Student 3
  ];

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
      subcategory: "React",
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
      category: "Network Technologies",
      subcategory: "CCNA",
      level: "Advanced",
      maxStudents: 10,
      tutoringType: "Online",
      date: "2025-01-25",
      time: "11:00",
      meetingLink: "http://zoom.com/meeting4",
      userId: 3,
    },
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
      userId: 3,
    },
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
      userId: 3,
    },
  ];

  // Benutzer einfügen
  users.forEach((user, index) => {
    let roleId = 0;
    if (user.role === "admin") {
      roleId = 1;
    } else if (user.role === "tutor") {
      roleId = 2;
    } else if (user.role === "student") {
      roleId = 3;
    }

    db.run(
      `INSERT INTO users (username, email, password, roleId, birthDate) VALUES (?, ?, ?, ?, ?)`,
      [
        user.username,
        user.email,
        bcrypt.hashSync(user.password, 10),
        roleId,
        "2000-01-01",
      ],
      (err) => {
        if (err) {
          console.error(`Error inserting ${user.username}:`, err.message);
        }
      }
    );
  });

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

  console.log("Test data added successfully!");*/
});

module.exports = db;
