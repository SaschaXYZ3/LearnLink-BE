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
  db.run("DROP TABLE IF EXISTS favorites", (err) => {
    if (err) {
      console.error("Error dropping users table:", err.message);
    } else {
      console.log("Users table dropped (if it existed)");
    }
  });
});

db.serialize(() => {
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
});
