const sqlite3 = require("sqlite3").verbose();

// Verbindung zur SQLite-Datenbank herstellen
const db = new sqlite3.Database("./databases/database.db");

// Funktion zum Setzen des Kursstatus auf "2" (abgelehnt)
const setCourseComplete = (userId, courseId) => {
  return new Promise((resolve, reject) => {
    const query = `
            UPDATE course_enrollment
            SET status = 2 -- Status auf "2" setzen
            WHERE userId = ? AND courseId = ? AND status != 2
        `;

    db.run(query, [userId, courseId], function (err) {
      if (err) {
        console.error("Fehler beim Aktualisieren des Status:", err.message);
        reject(err);
      } else if (this.changes === 0) {
        console.log(
          "Kein Kurs wurde aktualisiert. Überprüfen Sie die Eingaben."
        );
        resolve(false); // Kein Datensatz aktualisiert
      } else {
        console.log(
          `Status für userId=${userId}, courseId=${courseId} erfolgreich auf "2" gesetzt.`
        );
        resolve(true); // Erfolgreich aktualisiert
      }
    });
  });
};

// Hauptfunktion
const main = async () => {
  const userId = 6; // Hier die userId eintragen
  const courseId = 3; // Hier die courseId eintragen

  try {
    const result = await setCourseComplete(userId, courseId);
    if (result) {
      console.log("Kursstatus erfolgreich aktualisiert.");
    } else {
      console.log("Es wurde kein Status aktualisiert.");
    }
  } catch (error) {
    console.error("Fehler:", error.message);
  } finally {
    db.close(); // Datenbankverbindung schließen
  }
};

// Skript starten
main();
