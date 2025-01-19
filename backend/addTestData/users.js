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
  db.run("DROP TABLE IF EXISTS users", (err) => {
    if (err) {
      console.error("Error dropping users table:", err.message);
    } else {
      console.log("Users table dropped (if it existed)");
    }
  });
});

db.serialize(() => {
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
});

const users = [
  {
    id: 1, // Admin hat immer die ID 1
    username: "admin",
    role: "admin",
    email: "admin@learnlink.at",
    password: "admin123",
  }, // Admin
  {
    id: 2, // Tutor 1
    username: "Heinz Neunmalklug",
    role: "tutor",
    email: "heinz@example.com",
    password: "password123",
  },
  {
    id: 8, // Tutor 2
    username: "Franz Schule",
    role: "tutor",
    email: "franz@example.com",
    password: "password123",
  },
  {
    id: 9, // Tutor 3
    username: "Lisa Smart",
    role: "tutor",
    email: "lisa@example.com",
    password: "password123",
  },
  {
    id: 11, // Tutor 4
    username: "John Doe",
    role: "tutor",
    email: "john@example.com",
    password: "password123",
  },
  {
    id: 3, // Student 1
    username: "Camilla Studiosa",
    role: "student",
    email: "camilla@example.com",
    password: "student123",
  },
  {
    id: 4, // Student 2
    username: "Christian Klug",
    role: "student",
    email: "christian@example.com",
    password: "student123",
  },
  {
    id: 5, // Student 3
    username: "Viktoria Lernreich",
    role: "student",
    email: "viktoria@example.com",
    password: "student123",
  },
  {
    id: 6, // Student 4
    username: "Max Wissen",
    role: "student",
    email: "max@example.com",
    password: "student123",
  },
  {
    id: 7, // Student 5
    username: "Sophie Neugier",
    role: "student",
    email: "sophie@example.com",
    password: "student123",
  },
  {
    id: 10, // Student 6
    username: "Leonardo Klug",
    role: "student",
    email: "leonardo@example.com",
    password: "student123",
  },
];

// Benutzer einfügen
users.forEach((user) => {
  let roleId = 0;
  if (user.role === "admin") {
    roleId = 1;
  } else if (user.role === "tutor") {
    roleId = 2;
  } else if (user.role === "student") {
    roleId = 3;
  }

  db.run(
    `INSERT INTO users (id, username, email, password, roleId, birthDate) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      user.id, // ID
      user.username, // Username
      user.email, // Email
      bcrypt.hashSync(user.password, 10), // Password
      roleId, // Role ID
      "2000-01-01", // Birth Date (optional, hier als Beispiel)
    ],
    (err) => {
      if (err) {
        console.error(`Error inserting ${user.username}:`, err.message);
      }
    }
  );
});
