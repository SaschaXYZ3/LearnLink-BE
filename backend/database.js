const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");

const db = new sqlite3.Database("./databases/user.db", (err) => {
  if (err) {
    console.error("Error connecting to SQLite database:", err.message);
  } else {
    console.log("Connected to the SQLite database.");
  }
});

db.serialize(() => {
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

  // Add initial roles
  const roles = ["admin", "tutor", "student"];
  roles.forEach((role) => {
    db.run(`INSERT OR IGNORE INTO roles (name) VALUES (?)`, [role], (err) => {
      if (err) {
        console.error(`Error inserting role '${role}':`, err.message);
      }
    });
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
});

module.exports = db;
