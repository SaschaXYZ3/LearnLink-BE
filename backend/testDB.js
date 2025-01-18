const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./databases/database.db"); // Um den Pfad zur DB zu verwalten

// Die SQL-Abfrage, die du testen möchtest
const testQuery = () => {
  const courseId = 5; // Beispiel-Kurs-ID
  const status = 1; // Status "booked"

  // SQL-Abfrage
  const sql = `
    SELECT u.username AS studentName, u.email AS studentEmail
    FROM course_enrollment ce
    JOIN users u ON ce.userId = u.id
    WHERE ce.courseId = ? AND ce.status = ?
  `;

  // Führe die Abfrage aus
  db.get(sql, [courseId, status], (err, rows) => {
    if (err) {
      console.error("Error during query execution:", err.message);
    } else {
      console.log("Fetched participants:", rows); // Zeigt die Ergebnisse der Abfrage
    }
  });
};

// Starte die Testabfrage
testQuery();

// Schließe die Datenbankverbindung
db.close((err) => {
  if (err) {
    console.error("Error closing the database:", err.message);
  } else {
    console.log("Database connection closed.");
  }
});
