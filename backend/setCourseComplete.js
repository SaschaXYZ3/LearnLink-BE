const sqlite3 = require("sqlite3").verbose();
const moment = require("moment"); // Um das aktuelle Datum und die Zeit zu vergleichen

// Verbindung zur SQLite-Datenbank herstellen
const db = new sqlite3.Database("./databases/database.db");

// Funktion zum Setzen des Kursstatus auf "completed" (2), wenn das Datum überschritten ist
const updateCourseStatusToCompleted = () => {
  return new Promise((resolve, reject) => {
    // Aktuelles Datum holen
    const currentDate = moment().format("YYYY-MM-DD"); // Das aktuelle Datum im Format "YYYY-MM-DD"

    // SQL-Abfrage, die alle Einträge mit dem Status "booked" (1) und überschrittenem Datum auswählt
    const query = `
      SELECT ce.userId, ce.courseId
      FROM course_enrollment ce
      JOIN courses c ON ce.courseId = c.id
      WHERE ce.status = 1 AND c.date < ?;`;

    db.all(query, [currentDate], (err, rows) => {
      if (err) {
        console.error("Fehler bei der Abfrage der Kurse:", err.message);
        reject(err);
      } else if (rows.length === 0) {
        console.log("Es gibt keine Kurse, deren Datum überschritten ist.");
        resolve(false); // Keine Kurse gefunden, die den Status ändern müssen
      } else {
        // Wenn Kurse gefunden werden, Status auf "completed" (2) setzen
        const updateQuery = `
          UPDATE course_enrollment
          SET status = 2
          WHERE userId = ? AND courseId = ? AND status = 1;
        `;

        // Durch alle gefundenen Kurse iterieren und den Status ändern
        let promises = rows.map((row) => {
          return new Promise((resolve, reject) => {
            db.run(updateQuery, [row.userId, row.courseId], function (err) {
              if (err) {
                console.error(
                  `Fehler beim Aktualisieren des Status für userId=${row.userId}, courseId=${row.courseId}:`,
                  err.message
                );
                reject(err);
              } else if (this.changes === 0) {
                console.log(
                  `Kein Status für userId=${row.userId}, courseId=${row.courseId} aktualisiert.`
                );
                resolve(false); // Kein Datensatz geändert
              } else {
                console.log(
                  `Status für userId=${row.userId}, courseId=${row.courseId} auf "completed" (2) gesetzt.`
                );
                resolve(true); // Erfolgreich aktualisiert
              }
            });
          });
        });

        // Auf alle Promises warten
        Promise.all(promises)
          .then(() => {
            console.log("Alle Kursstatus erfolgreich auf 'completed' gesetzt.");
            resolve(true);
          })
          .catch((err) => {
            console.error(
              "Fehler beim Aktualisieren der Kursstatus:",
              err.message
            );
            reject(err);
          });
      }
    });
  });
};

// Hauptfunktion
const main = async () => {
  try {
    const result = await updateCourseStatusToCompleted();
    if (result) {
      console.log("Alle Kursstatus wurden erfolgreich aktualisiert.");
    } else {
      console.log("Es wurden keine Kursstatus aktualisiert.");
    }
  } catch (error) {
    console.error("Fehler:", error.message);
  } finally {
    db.close(); // Datenbankverbindung schließen
  }
};

// Skript starten
main();
