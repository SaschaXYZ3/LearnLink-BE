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
      role TEXT,
      birthDate TEXT,
      profileImage TEXT
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

  // Drop the old courses table if needed
  //db.run("DROP TABLE IF EXISTS courses");

  // Create courses table with userId
  db.run(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL,
      level TEXT NOT NULL,
      maxStudents INTEGER NOT NULL,
      tutoringType TEXT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      meetingLink TEXT NOT NULL,
      userId INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users (id)
    )
  `);

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
        console.error(
          "Error while checking for existing admin user:",
          err.message
        );
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

{
  /*}
db.run("ALTER TABLE users ADD COLUMN profileImage TEXT", (err) => {
  if (err) {
    console.error("Error adding profileImage column:", err.message);
  } else {
    console.log("profileImage column added successfully.");
  }
});
*/
}

module.exports = db;
