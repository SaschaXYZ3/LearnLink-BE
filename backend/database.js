const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const db = new sqlite3.Database("../databases/user.db", (err) => {
  if (err) {
    console.error("Error connecting to SQLite database:", err.message);
  } else {
    console.log("Connected to the SQLite database.");
  }
});

db.serialize(() => {
  // drop the old users table
  //db.run("DROP TABLE IF EXISTS users");
  
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT,
      password TEXT,
      role TEXT DEFAULT 'student',
      birthDate TEXT
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

  // AAdd admin user if not already present
  const adminUsername = "admin";
  const adminEmail = "admin@learnlink.at";
  const adminPassword = bcrypt.hashSync("admin123", 10); // Passwort hashen
  const adminRole = "admin";
  const adminBirthDate = "2000-01-01";

  db.get(
    `SELECT * FROM users WHERE username = ?`,
    [adminUsername],
    (err, row) => {
      if (err) {
        console.error("Error while checking for existing admin user:", err.message);
        return;
      }

      if (row) {
        console.log("Admin user already exists, skipping insertion.");
      } else {
        db.run(
          `INSERT INTO users (username, email, password, role, birthDate)
           VALUES (?, ?, ?, ?, ?)`,
          [adminUsername, adminEmail, adminPassword, adminRole, adminBirthDate],
          (err) => {
            if (err) {
              console.error("Error while adding admin user:", err.message);
            } else {
              console.log("Admin user added successfully!");
            }
          }
        );
      }
    }
  );
});


module.exports = db;
