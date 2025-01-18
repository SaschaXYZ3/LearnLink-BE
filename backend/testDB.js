const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./databases/database.db"); // Um den Pfad zur DB zu verwalten

// Die SQL-Abfrage, die du testen möchtest
db.run("DROP TABLE IF EXISTS course_availability", (err) => {
  if (err) {
    console.error("Error dropping users table:", err.message);
  } else {
    console.log("Users table dropped (if it existed)");
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

db.run("DROP TABLE IF EXISTS course_enrollment", (err) => {
  if (err) {
    console.error("Error dropping users table:", err.message);
  } else {
    console.log("Users table dropped (if it existed)");
  }
});
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

// Schließe die Datenbankverbindung
db.close((err) => {
  if (err) {
    console.error("Error closing the database:", err.message);
  } else {
    console.log("Database connection closed.");
  }
});
