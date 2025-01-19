const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = new sqlite3.Database("./databases/database.db", (err) => {
  if (err) {
    console.error("Error connecting to SQLite database:", err.message);
  } else {
    console.log("Connected to the SQLite database.");
  }
});

const SECRET_KEY =
  "XdvZ1GSeTsE48kPKCo3zqkZb2sLFnUbsfoqwFL2SN4pn6EcEyFS9IEI3evPvwo59";

const app = express();
const PORT = 5001;

// Middleware
app.use(cors());
app.use(express.json());

// JWT verification middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(403).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1]; // Bearer <token>
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    req.user = user; // Attach user data to request
    next(); // Proceed to the next middleware or route handler
  });
};

// Validation function for registration input
const validateRegisterInput = ({ username, email, password }) => {
  if (!username || !email || !password) {
    return "All fields are required";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  if (!/\S+@\S+\.\S+/.test(email)) {
    return "Invalid email format";
  }
  return null;
};

// API Endpoints
app.get("/api/message", (req, res) => {
  res.json({ message: "Hello from the backend!" });
});

// Protected route example --> use for div. subpages
app.get("/api/protected", authenticateToken, (req, res) => {
  res.json({ message: "This is a protected route", user: req.user });
});

// Register endpoint
app.post("/register", (req, res) => {
  const { username, email, password, role, birthDate } = req.body;

  const validationError = validateRegisterInput({ username, email, password });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const hashedPassword = bcrypt.hashSync(password, 8);
  db.get(
    `SELECT id FROM roles WHERE name = ?`,
    [role || "student"],
    (err, roleRow) => {
      if (err || !roleRow) {
        return res.status(400).json({ error: "Invalid role specified" });
      }

      const roleId = roleRow.id;
      db.run(
        `INSERT INTO users (username, email, password, roleId, birthDate) VALUES (?, ?, ?, ?, ?)`,
        [username, email, hashedPassword, roleId, birthDate],
        function (err) {
          if (err) {
            if (err.code === "SQLITE_CONSTRAINT") {
              return res.status(400).json({ error: "Username already exists" });
            }
            return res.status(500).json({ error: "Internal server error" });
          }

          const token = jwt.sign(
            { id: this.lastID, username, role: role || "student" },
            SECRET_KEY,
            { expiresIn: 86400 }
          );

          res.json({
            id: this.lastID,
            username,
            email,
            role,
            birthDate,
            token,
          });
        }
      );
    }
  );
});

// Login endpoint
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Both username and password are required" });
  }

  db.get(
    `SELECT users.*, roles.name AS role FROM users JOIN roles ON users.roleId = roles.id WHERE username = ?`,
    [username],
    (err, user) => {
      if (err || !user) {
        return res.status(401).json({ error: "Invalid Username" });
      }

      if (!bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: "Invalid Password" });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        SECRET_KEY,
        { expiresIn: 86400 }
      );

      logUserActivity(user.id, "/api/login", "login");

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        birthDate: user.birthDate,
        token,
      });
    }
  );
});

//User Daten abrufen
app.get("/api/user", authenticateToken, async (req, res) => {
  const userId = req.user.id; // Benutzer-ID aus dem Token extrahieren

  // SQL-Abfrage zum Abrufen der Benutzerdaten
  const query = `SELECT id, username, email, birthDate FROM users WHERE id = ?`;

  try {
    // Verwende db.get für das Abrufen der Benutzerdaten aus der Datenbank
    db.get(query, [userId], (err, row) => {
      if (err) {
        console.error("Fehler bei der Abfrage der Benutzerdaten:", err.message);
        return res
          .status(500)
          .json({ error: "Fehler beim Abrufen der Benutzerdaten." });
      }

      if (!row) {
        return res.status(404).json({ error: "Benutzer nicht gefunden." });
      }

      // Erfolgreiche Antwort mit den Benutzerdaten
      return res.status(200).json({
        id: row.id,
        username: row.username,
        email: row.email,
        birthDate: row.birthDate,
      });
    });
  } catch (error) {
    console.error("Fehler bei der Verarbeitung der Anfrage:", error);
    return res
      .status(500)
      .json({ error: "Fehler beim Abrufen der Benutzerdaten." });
  }
});

// API endpoint for updating user profile
app.post("/api/user/update", authenticateToken, async (req, res) => {
  const { username, email, birthDate, currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  // Überprüfen user existiert
  db.get("SELECT * FROM users WHERE id = ?", [userId], async (err, user) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Wenn ein neues Passwort bereitgestellt wurde
    if (newPassword) {
      // Überprüfen, ob das aktuelle Passwort korrekt ist
      const passwordMatch = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!passwordMatch) {
        return res.status(400).json({ error: "Incorrect current password" });
      }

      // Neues Passwort hashen
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update Passwort und andere Felder
      db.run(
        "UPDATE users SET username = ?, email = ?, birthDate = ?, password = ? WHERE id = ?",
        [username, email, birthDate, hashedPassword, userId],
        (err) => {
          if (err)
            return res.status(500).json({ error: "Database update error" });
          logUserActivity(userId, "/api/user/update", "password changed");
          res.json({ message: "Profile updated successfully" });
        }
      );
    } else {
      // Kein neues Passwort bereitgestellt, nur andere Felder aktualisieren
      db.run(
        "UPDATE users SET username = ?, email = ?, birthDate = ? WHERE id = ?",
        [username, email, birthDate, userId],
        (err) => {
          if (err)
            return res.status(500).json({ error: "Database update error" });
          logUserActivity(userId, "/api/user/update", "updated user profile");
          res.json({ message: "Profile updated successfully" });
        }
      );
    }
  });
});

// Protected route example
app.get("/api/protected", authenticateToken, (req, res) => {
  res.json({ message: "This is a protected route", user: req.user });
});

// Get all users (Admin Dashboard)
app.get("/admin", authenticateToken, (req, res) => {
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ error: "Access denied, you are not an admin" });
  }

  db.all(
    `SELECT users.id, username, email, roles.name AS role, birthDate
     FROM users
     JOIN roles ON users.roleId = roles.id`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Failed to retrieve users" });
      }
      res.json(rows);
    }
  );
});

// API Endpoint um einen Kurs hinzuzufügen
app.post("/api/courses", authenticateToken, (req, res) => {
  console.log("Received request to add a course");

  // Destrukturierung der Werte aus dem Request Body
  const {
    title,
    category,
    subcategory,
    level,
    maxStudents,
    tutoringType,
    date,
    time,
    meetingLink,
    description,
  } = req.body;

  const userId = req.user.id; // Die userId des eingeloggten Benutzers
  console.log("Authenticated userId: ", userId);

  // Überprüfung, ob alle Felder im Request vorhanden sind
  if (
    !title ||
    !category ||
    !subcategory ||
    !level ||
    !maxStudents ||
    !date ||
    !time ||
    !meetingLink ||
    !description
  ) {
    console.log("Missing required fields");
    return res.status(400).json({ error: "All fields are required" });
  }

  // SQL Query zum Hinzufügen des Kurses
  const insertCourseQuery = `INSERT INTO courses (
    title, category, subcategory, level, maxStudents, tutoringType, date, time, meetingLink, userId, description
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,  ?)`;

  // Logging der Werte, bevor die Datenbankabfrage ausgeführt wird
  console.log("Course Data:", {
    title,
    category,
    subcategory,
    level,
    maxStudents,
    tutoringType,
    date,
    time,
    meetingLink,
    userId,
    description,
  });

  // Kurs in der Tabelle 'courses' einfügen
  db.run(
    insertCourseQuery,
    [
      title,
      category,
      subcategory,
      level,
      maxStudents,
      tutoringType,
      date,
      time,
      meetingLink,
      userId,
      description,
    ],
    function (err) {
      if (err) {
        console.error("Database error:", err.message);
        return res.status(500).json({ error: "Failed to add the course" });
      }

      // Erfolgreiches Hinzufügen des Kurses
      console.log("Course added successfully, ID:", this.lastID);

      // Nach dem Hinzufügen des Kurses: Eintrag in die Tabelle 'course_availability' erstellen
      const courseId = this.lastID; // Die ID des neu hinzugefügten Kurses

      const insertAvailabilityQuery = `
        INSERT INTO course_availability (courseId, maxStudents, actualStudents)
        VALUES (?, ?, ?)
      `;

      db.run(
        insertAvailabilityQuery,
        [courseId, maxStudents, 0], // Setze actualStudents auf 0, da zu Beginn keine Plätze belegt sind
        function (err) {
          if (err) {
            console.error(
              "Database error when inserting into course_availability:",
              err.message
            );
            return res
              .status(500)
              .json({ error: "Failed to create course availability" });
          }

          console.log(
            "Availability entry created successfully for course ID:",
            courseId
          );
          logUserActivity(userId, "/api/courses", "created course");
          res.status(201).json({
            message: "Course added successfully",
            courseId: this.lastID,
          });
        }
      );
    }
  );
});

app.post("/contact", async (req, res) => {
  const { name, email, message } = req.body;

  // Validierung der Eingaben
  if (!name || !email || !message) {
    return res.status(400).json({ error: "All fields are required" });
  }

  // SQL-Abfrage zum Einfügen des neuen Kontaktantrags
  const query = `
    INSERT INTO contact_requests (name, email, message, date)
    VALUES (?, ?, ?, ?)
  `;
  const createdAt = new Date().toISOString(); // Zeitstempel

  db.run(query, [name, email, message, createdAt], function (err) {
    if (err) {
      console.error("Error inserting contact request:", err.message);
      return res
        .status(500)
        .json({ error: "Failed to save the contact request" });
    }

    res.status(201).json({ message: "Contact request submitted successfully" });
  });
});
// API Endpoint zum Abrufen aller Kurse
/*app.get("/api/courses", authenticateToken, (req, res) => {
  const query = `SELECT courses.*, users.username AS tutor
    FROM courses
    JOIN users ON courses.userId = users.id`;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({ error: "Failed to retrieve courses" });
    }

    res.status(200).json(rows);
  });
});*/

// API Endpoint zum Abrufen aller Kurse mit erweiterten Informationen
app.get("/api/courses", authenticateToken, (req, res) => {
  const userId = req.user.id; // Aus dem Token abgeleiteter Benutzer

  const query = `
    SELECT 
      courses.*, 
      course_availability.maxStudents,
      course_availability.actualStudents,
      users.username AS tutor,
      EXISTS(
        SELECT 1 
        FROM favorites 
        WHERE favorites.userId = ? AND favorites.courseId = courses.id
      ) AS isFavorite,
      EXISTS(
        SELECT 1 
        FROM course_students 
        WHERE course_students.userId = ? AND course_students.courseId = courses.id
      ) AS isEnrolled
    FROM courses
    JOIN users ON courses.userId = users.id
    LEFT JOIN course_availability ON course_availability.courseId = courses.id
    GROUP BY courses.id;
  `;

  db.all(query, [userId, userId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get("/api/public/courses", (req, res) => {
  const query = `
    SELECT 
      courses.*, 
      course_availability.maxStudents,
      course_availability.actualStudents,
      users.username AS tutor
    FROM courses
    JOIN users ON courses.userId = users.id
    LEFT JOIN course_availability ON course_availability.courseId = courses.id
    GROUP BY courses.id;
  `;

  db.all(query, (err, rows) => {
    if (err) {
      console.error("Datenbankfehler:", err.message);
      return res.status(500).json({ error: "Fehler beim Abrufen der Kurse" });
    }

    res.status(200).json(rows);
  });
});

//Kurs buchen
app.post("/api/book/:courseId", authenticateToken, (req, res) => {
  const { courseId } = req.params;
  const userId = req.user?.id;
  console.log("User ID from Token: ", req.user);
  if (!userId) {
    return res
      .status(401)
      .json({ error: `Benutzer-ID nicht im Token gefunden.` });
  }

  console.log(
    `Benutzer mit ID ${userId} möchte Kurs mit ID ${courseId} buchen.`
  );

  // Kurs existiert überprüfen
  db.get("SELECT * FROM courses WHERE id = ?", [courseId], (err, course) => {
    if (err) {
      console.error("Fehler bei der Kursabfrage:", err.message);
      return res
        .status(500)
        .json({ error: "Fehler beim Überprüfen des Kurses." });
    }

    if (!course) {
      console.error(`Kurs mit ID ${courseId} wurde nicht gefunden.`);
      return res.status(404).json({ error: "Kurs nicht gefunden." });
    }

    console.log(`Kurs gefunden: ${course.title}`);

    // Überprüfen, ob der Benutzer sich bereits für diesen Kurs angemeldet hat
    db.get(
      "SELECT * FROM course_enrollment WHERE courseId = ? AND userId = ?",
      [courseId, userId],
      (err, existingEnrollment) => {
        if (err) {
          console.error("Fehler bei der Überprüfung der Buchung:", err.message);
          return res
            .status(500)
            .json({ error: "Fehler bei der Überprüfung der Buchung." });
        }

        if (existingEnrollment) {
          console.error(
            `Benutzer mit ID ${userId} hat sich bereits für den Kurs mit ID ${courseId} angemeldet.`
          );
          return res.status(400).json({
            error: "Sie haben sich bereits für diesen Kurs angemeldet.",
          });
        }

        console.log(
          `Benutzer mit ID ${userId} ist noch nicht für den Kurs angemeldet.`
        );

        // Eintrag in die course_enrollment-Tabelle einfügen mit Status 'requested' (Status-ID 3)
        db.run(
          "INSERT INTO course_enrollment (courseId, userId, status, date) VALUES (?, ?, ?, ?)",
          [courseId, userId, 3, new Date()], // status 3 bedeutet 'requested'
          function (err) {
            if (err) {
              console.error("Fehler beim Hinzufügen der Buchung:", err.message);
              return res
                .status(500)
                .json({ error: "Fehler bei der Kursbuchung." });
            }

            console.log(
              `Buchung erfolgreich für Benutzer mit ID ${userId} für Kurs mit ID ${courseId}`
            );
            logUserActivity(
              userId,
              `/api/book/${courseId}`,
              "course requested"
            );

            return res.status(200).json({
              message: "Sie haben sich erfolgreich für den Kurs angemeldet.",
            });
          }
        );
      }
    );
  });
});

//toggle favorite
app.post("/api/courses/:courseId/favorite", authenticateToken, (req, res) => {
  const courseId = req.params.courseId;
  const userId = req.user.id; // Angemeldeter Benutzer aus dem Token

  // Favoritenstatus abfragen
  const queryCheck = `SELECT * FROM favorites WHERE userId = ? AND courseId = ?`;
  db.get(queryCheck, [userId, courseId], (err, row) => {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({ error: "Datenbankfehler." });
    }

    if (row) {
      // Wenn Favorit existiert, dann entfernen
      const queryDelete = `DELETE FROM favorites WHERE userId = ? AND courseId = ?`;
      db.run(queryDelete, [userId, courseId], (err) => {
        if (err) {
          console.error("Database error:", err.message);
          return res
            .status(500)
            .json({ error: "Fehler beim Entfernen des Favoriten." });
        }
        logUserActivity(
          userId,
          `/api/courses/${courseId}/favorite`,
          "removed favorite"
        );
        res.status(200).json({ isFavorite: false });
      });
    } else {
      // Wenn Favorit nicht existiert, dann hinzufügen
      const queryInsert = `INSERT INTO favorites (userId, courseId) VALUES (?, ?)`;
      db.run(queryInsert, [userId, courseId], (err) => {
        if (err) {
          console.error("Database error:", err.message);
          return res
            .status(500)
            .json({ error: "Fehler beim Hinzufügen des Favoriten." });
        }
        logUserActivity(
          userId,
          `/api/courses/${courseId}/favorite`,
          "added favorite"
        );
        res.status(200).json({ isFavorite: true });
      });
    }
  });
});

// API Endpoint zum Abrufen der Kurse des eingeloggten Tutors
app.get("/api/courses/mine", authenticateToken, (req, res) => {
  const userId = req.user.id;

  const query = `SELECT 
      courses.id,
      courses.title,
      courses.category,
      courses.subcategory,
      courses.level,
      courses.date,
      courses.time,
      courses.meetingLink,
      courses.description,
      course_availability.maxStudents,
      course_availability.actualStudents
    FROM courses
    JOIN course_availability ON courses.id = course_availability.courseId
    WHERE courses.userId = ?
`;

  db.all(query, [userId], (err, rows) => {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({ error: "Failed to retrieve your courses" });
    }

    res.status(200).json(rows);
  });
});

// API Endpoint zum Abrufen eines einzelnen Kurses
app.get("/api/courses/:id", authenticateToken, (req, res) => {
  const { id } = req.params;

  const query = `SELECT courses.*, users.username AS tutor
    FROM courses
    JOIN users ON courses.userId = users.id
    WHERE courses.id = ?`;

  db.get(query, [id], (err, course) => {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({ error: "Failed to retrieve course" });
    }

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    res.status(200).json(course);
  });
});

// API Endpoint zum Löschen eines Kurses
app.delete("/api/courses/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  // Überprüfen, ob der Benutzer berechtigt ist, den Kurs zu löschen
  const checkQuery = `SELECT * FROM courses WHERE id = ?`;
  db.get(checkQuery, [id], (err, course) => {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({ error: "Failed to retrieve course" });
    }

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Prüfen, ob der Benutzer der Ersteller des Kurses oder ein Admin ist
    if (course.userId !== userId && userRole !== "admin") {
      return res
        .status(403)
        .json({ error: "You are not authorized to delete this course" });
    }

    // Kurs löschen
    const deleteQuery = `DELETE FROM courses WHERE id = ?`;
    db.run(deleteQuery, [id], function (err) {
      if (err) {
        console.error("Database error:", err.message);
        return res.status(500).json({ error: "Failed to delete course" });
      }
      logUserActivity(userId, `/api/courses/${id}`, "removed course");
      res
        .status(200)
        .json({ message: `Course with ID ${id} deleted successfully` });
    });
  });
});

//API Endpoint um die Bewertung eines Kurses abzurufen
app.get("/api/courses/:courseId/reviews", async (req, res) => {
  const courseId = req.params.courseId;
  try {
    const reviews = await db.all(
      "SELECT * FROM course_reviews WHERE courseId = ? ORDER BY date DESC",
      [courseId]
    );
    res.json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error retrieving course reviews");
  }
});

//Anzeige von Pending Requests in TutorView
app.get("/api/tutors/pending-bookings", authenticateToken, (req, res) => {
  const userId = req.user.id; // Benutzer-ID aus dem Token extrahieren
  console.log("Tutor ID from token:", userId);

  const query = `
    SELECT 
        ce.id AS enrollmentId,
        u.username AS studentName,
        u.email AS studentEmail,
        u.ProfileImage AS studentProfileImage,
        c.id AS courseId,
        c.title AS courseName,
        bs.status AS bookingStatus,
        c.category,
        c.subcategory,
        c.level,
        c.maxStudents,
        c.tutoringType,
        c.date AS courseDate,
        c.time AS courseTime,
        c.meetingLink
    FROM 
        course_enrollment ce
    JOIN 
        users u ON ce.userId = u.id
    JOIN 
        courses c ON ce.courseId = c.id
    JOIN 
        booking_status bs ON ce.status = bs.id
    WHERE 
        c.userId = ? AND ce.status = 3;
  `;

  db.all(query, [userId], (err, rows) => {
    if (err) {
      console.error("Error fetching pending bookings:", err.message);
      res.status(500).json({ error: "Failed to fetch pending bookings" });
    } else {
      res.status(200).json(rows);
    }
  });
});

const dbGet = (db, query, params) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

app.post("/api/enrollments/:enrollmentId/accept", async (req, res) => {
  const { enrollmentId } = req.params;

  // Logge das empfangene `enrollmentId`
  console.log("Received enrollmentId from request:", enrollmentId);

  // Sicherstellen, dass enrollmentId ein Integer ist
  const enrollmentIdInteger = parseInt(enrollmentId, 10);

  if (isNaN(enrollmentIdInteger)) {
    console.error("Invalid enrollmentId format, must be an integer");
    return res.status(400).json({ error: "Invalid enrollmentId format" });
  }

  try {
    // Hole die `courseId` aus der Tabelle `course_enrollment`
    const courseRow = await dbGet(
      db,
      "SELECT courseId FROM course_enrollment WHERE id = ?",
      [enrollmentIdInteger]
    );

    if (!courseRow || !courseRow.courseId) {
      console.error(`Enrollment with ID ${enrollmentIdInteger} not found`);
      return res.status(404).json({ error: "Enrollment not found" });
    }

    const courseId = courseRow.courseId;

    console.log("Fetched courseId dynamically:", courseId);

    // Hole die Daten zur Verfügbarkeit des Kurses
    const courseAvailability = await dbGet(
      db,
      "SELECT actualStudents, maxStudents FROM course_availability WHERE courseId = ?",
      [courseId]
    );

    if (!courseAvailability) {
      console.error(`Course with ID ${courseId} not found`);
      return res.status(404).json({ error: "Course not found" });
    }

    const { actualStudents, maxStudents } = courseAvailability;

    console.log(
      `Course Details - actualStudents: ${actualStudents}, maxStudents: ${maxStudents}`
    );

    // Überprüfe, ob der Kurs voll ist
    if (actualStudents >= maxStudents) {
      console.error(`Course with ID ${courseId} is full`);
      return res.status(400).json({ error: "Course is already full" });
    }

    // Akzeptiere die Buchung
    await db.run("UPDATE course_enrollment SET status = 1 WHERE id = ?", [
      enrollmentIdInteger,
    ]);

    // Erhöhe die Anzahl der Studenten
    await db.run(
      "UPDATE course_availability SET actualStudents = actualStudents + 1 WHERE courseId = ?",
      [courseId]
    );

    console.log(`Enrollment with ID ${enrollmentIdInteger} has been accepted`);

    res.status(200).json({ message: "Enrollment accepted", courseId });
  } catch (error) {
    console.error("Error during enrollment acceptance:", error.message);
    res.status(500).json({ error: "Failed to accept enrollment" });
  }
});

// POST /api/enrollments/:enrollmentId/reject
app.post("/api/enrollments/:enrollmentId/reject", async (req, res) => {
  const { enrollmentId } = req.params;

  try {
    const enrollment = await db.get(
      "SELECT * FROM course_enrollment WHERE id = ?",
      [enrollmentId]
    );

    if (!enrollment) {
      return res.status(404).json({ error: "Enrollment not found" });
    }

    await db.run("UPDATE course_enrollment SET status = 4 WHERE id = ?", [
      enrollmentId,
    ]);

    res.status(200).json({ message: "Enrollment rejected", enrollment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to reject enrollment" });
  }
});

// GET /api/enrollments/:courseId
app.get("/api/enrollments/:courseId", async (req, res) => {
  const { courseId } = req.params;
  console.log("Course ID is:", courseId); // Überprüfe die übergebene courseId

  const status = 1; // Fixe Status, dass nur "booked" angezeigt werden

  // SQL-Abfrage
  const sql = `
    SELECT u.username AS studentName, u.email AS studentEmail
    FROM course_enrollment ce
    JOIN users u ON ce.userId = u.id
    WHERE ce.courseId = ? AND ce.status = ?
  `;

  console.log("SQL Query:", sql); // Logge die SQL-Abfrage
  console.log("Parameters:", [parseInt(courseId), status]); // Logge die übergebenen Parameter

  try {
    // Verwende db.all(), um mehrere Zeilen abzurufen:
    //ACHTUNG!!!
    //SQLite3 verwendet in node.js Callbacks um async await zu implementieren muss man Promise nutzen
    const participants = await new Promise((resolve, reject) => {
      db.all(sql, [parseInt(courseId), status], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log("Fetched participants from DB:", participants); // Zeige das Ergebnis der DB-Abfrage

    if (!participants || participants.length === 0) {
      return res.status(404).json({ error: "No participants found" });
    }

    res.status(200).json(participants); // Gebe die Teilnehmerdaten als JSON zurück
  } catch (error) {
    console.error("Error fetching participants:", error.message);
    res.status(500).json({ error: "Failed to load participants" });
  }
});

app.get("/api/courses/:courseId/students", async (req, res) => {
  const { courseId } = req.params;
  console.log("courseid is ", courseId);
  try {
    const course = await db.get(
      "SELECT maxStudents, actualStudents FROM course_availability WHERE courseId =?",
      [courseId]
    );
  } catch (error) {
    res.status(500).json({ error: "Failed to load course seats" });
  }
});

//STUDENT VIEW SECTION

// API Endpoint, um die Kurse des eingeloggten Studenten zu holen
app.get("/api/student/bookings", authenticateToken, (req, res) => {
  const userId = req.user.id; // Benutzer-ID aus dem Token

  const query = `
    SELECT 
        ce.id AS enrollmentId,
        c.id AS courseId,
        c.title AS courseTitle,
        c.category,
        c.subcategory,
        c.level,
        c.date,
        c.time,
        c.description,
        ca.maxStudents,
        ca.actualStudents,
        bs.status AS bookingStatus
    FROM course_enrollment ce
    JOIN courses c ON ce.courseId = c.id
    JOIN course_availability ca ON c.id = ca.courseId
    JOIN booking_status bs ON ce.status = bs.id
    WHERE ce.userId = ? 
  `;

  db.all(query, [userId], (err, rows) => {
    if (err) {
      console.error("Fehler beim Abrufen der Buchungen:", err.message);
      return res.status(500).json({ error: "Datenbankfehler" });
    }

    if (rows.length === 0) {
      return res.status(404).json({ message: "Keine Buchungen gefunden" });
    }

    res.status(200).json(rows); // Rückgabe der gefundenen Daten
  });
});

app.get("/api/courses/:courseId/reviews", (req, res) => {
  const { courseId } = req.params;

  const query = `
      SELECT 
          cr.rating, cr.comment, cr.date, u.username 
      FROM course_reviews cr
      JOIN users u ON cr.userId = u.id
      WHERE cr.courseId = ?
      ORDER BY cr.date DESC
  `;

  db.all(query, [courseId], (err, rows) => {
    if (err) {
      return res
        .status(500)
        .json({ error: "Database error while fetching reviews." });
    }
    res.status(200).json(rows);
  });
});

app.post("/api/courses/:courseId/review", authenticateToken, (req, res) => {
  const { courseId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.user.id;

  // Validate inputs
  if (!rating || rating < 1 || rating > 5) {
    return res
      .status(400)
      .json({ error: "Invalid rating. Must be between 1 and 5." });
  }

  const checkQuery = `
      SELECT * FROM course_reviews WHERE userId = ? AND courseId = ?
  `;

  db.get(checkQuery, [userId, courseId], (err, row) => {
    if (err) {
      return res
        .status(500)
        .json({ error: "Database error while checking review." });
    }

    if (row) {
      // Update existing review
      const updateQuery = `
              UPDATE course_reviews 
              SET rating = ?, comment = ?, date = CURRENT_TIMESTAMP 
              WHERE userId = ? AND courseId = ?
          `;
      db.run(updateQuery, [rating, comment, userId, courseId], (err) => {
        if (err) {
          return res
            .status(500)
            .json({ error: "Database error while updating review." });
        }
        return res
          .status(200)
          .json({ message: "Review updated successfully." });
      });
    } else {
      // Insert new review
      const insertQuery = `
              INSERT INTO course_reviews (courseId, userId, rating, comment, date)
              VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          `;
      db.run(insertQuery, [courseId, userId, rating, comment], (err) => {
        if (err) {
          return res
            .status(500)
            .json({ error: "Database error while adding review." });
        }
        logUserActivity(
          userId,
          `/api/courses/${courseId}/review`,
          "added review"
        );
        return res.status(201).json({ message: "Review added successfully." });
      });
    }
  });
});

// Endpoint: Fortschrittsdaten für einen Student abrufen
app.get("/user/progress", authenticateToken, (req, res) => {
  const userId = req.user.id; // Benutzer-ID aus dem JWT-Token extrahieren

  const totalQuery = `
      SELECT COUNT(*) AS total
      FROM course_enrollment
      WHERE userId = ? AND status IN (1,3)
  `;

  const completedQuery = `
      SELECT COUNT(*) AS completed
      FROM course_enrollment
      WHERE userId = ? AND status = 2
  `;

  db.serialize(() => {
    db.get(totalQuery, [userId], (err, totalResult) => {
      if (err) {
        console.error("Fehler beim Abrufen der Gesamtkurse:", err.message);
        return res
          .status(500)
          .json({ error: "Fehler beim Abrufen der Gesamtkurse" });
      }

      db.get(completedQuery, [userId], (err, completedResult) => {
        if (err) {
          console.error(
            "Fehler beim Abrufen der abgeschlossenen Kurse:",
            err.message
          );
          return res
            .status(500)
            .json({ error: "Fehler beim Abrufen der abgeschlossenen Kurse" });
        }

        res.json({
          total: totalResult.total || 0,
          completed: completedResult.completed || 0,
        });
      });
    });
  });
});

//LOGGING:
//----------------
const logUserActivity = (userId, endpoint, action) => {
  const query = `
    INSERT INTO user_logs (userId, endpoint, action)
    VALUES (?, ?, ?)
  `;

  db.run(query, [userId, endpoint, action], (err) => {
    if (err) {
      console.error("Error logging user activity:", err.message);
    } else {
      console.log(`Logged activity: ${action} for user ${userId}`);
    }
  });
};

// FORUM SECTION:
//-----------------

// GET: Alle Beiträge abrufen inklusive Anzahl der Kommentare
app.get("/forum", (req, res) => {
  const query = `SELECT posts.*, COUNT(comments.id) AS commentCount 
                 FROM posts 
                 LEFT JOIN comments ON posts.id = comments.postId 
                 GROUP BY posts.id`;

  db.all(query, (err, rows) => {
    if (err) {
      return res
        .status(500)
        .json({ error: "Database error when retrieving posts" });
    }
    res.json(rows);
  });
});

// POST: Neuen Beitrag hinzufügen
app.post("/forum", (req, res) => {
  const { title, content, username } = req.body;
  const userId = req.user.id;

  if (!title || !content || !username) {
    return res
      .status(400)
      .json({ error: "Title, content, and username are required" });
  }

  const query = `INSERT INTO posts (title, content, username, likes, reported) VALUES (?, ?, ?, 0, 0)`;
  db.run(query, [title, content, username], function (err) {
    if (err) {
      return res.status(500).json({ error: "Error adding the post" });
    }

    res.status(201).json({ id: this.lastID, title, content, username });
  });
});

// POST: Kommentar hinzufügen
app.post("/forum/comment", (req, res) => {
  const userId = req.user.id;

  if (!postId || !comment || !username) {
    return res
      .status(400)
      .json({ error: "PostId, comment, and username are required" });
  }

  const query = `INSERT INTO comments (postId, content, author) VALUES (?, ?, ?)`;
  db.run(query, [postId, comment, username], function (err) {
    if (err) {
      console.error("Error adding comment:", err.message);
      return res.status(500).json({ error: "Error adding the comment" });
    }

    res.status(201).json({ id: this.lastID, comment, username });
  });
});

// GET: Kommentare zu einem Beitrag abrufen
app.get("/forum/comments/:postId", (req, res) => {
  const { postId } = req.params;

  const query = `SELECT content, author AS username FROM comments WHERE postId = ?`;
  db.all(query, [postId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Error retrieving comments" });
    }
    res.json(rows);
  });
});

// GET: Interactions auf Forumeinträge
app.get("/forum/interactions", authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.all(
    "SELECT post_id, liked, reported FROM post_interactions WHERE user_id = ?",
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json(rows);
    }
  );
});

// POST: Beitrag liken
app.post("/forum/like/:id", authenticateToken, (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;

  // Check if the user has already liked the post
  db.get(
    "SELECT * FROM post_interactions WHERE user_id = ? AND post_id = ? AND liked = 1",
    [userId, postId],
    (err, row) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (row)
        return res.status(400).json({ error: "You already liked this post" });

      // Add like interaction
      db.run(
        "INSERT INTO post_interactions (user_id, post_id, liked) VALUES (?, ?, 1)",
        [userId, postId],
        (err) => {
          if (err) return res.status(500).json({ error: "Database error" });

          // Update the like count in the posts table
          db.run(
            "UPDATE posts SET likes = likes + 1 WHERE id = ?",
            [postId],
            (err) => {
              if (err) return res.status(500).json({ error: "Database error" });
              res.json({ message: "Post liked successfully" });
            }
          );
        }
      );
    }
  );
});

// POST: Beitrag melden
app.post("/forum/report/:id", authenticateToken, (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;

  // Check if the user has already reported the post
  db.get(
    "SELECT * FROM post_interactions WHERE user_id = ? AND post_id = ?",
    [userId, postId],
    (err, row) => {
      if (err) {
        console.error("Database error:", err.message); // Log the actual error
        return res.status(500).json({ error: "Database error" });
      }

      if (row && row.reported === 1) {
        return res
          .status(400)
          .json({ error: "You have already reported this post" });
      }

      // Add or update the report interaction
      const query = row
        ? "UPDATE post_interactions SET reported = 1 WHERE user_id = ? AND post_id = ?"
        : "INSERT INTO post_interactions (user_id, post_id, reported) VALUES (?, ?, 1)";

      db.run(query, [userId, postId], (err) => {
        if (err) {
          console.error("Database error:", err.message); // Log the actual error
          return res.status(500).json({ error: "Database error" });
        }

        // Increment the reported count in the posts table
        db.run(
          "UPDATE posts SET reported = reported + 1 WHERE id = ?",
          [postId],
          (err) => {
            if (err) {
              console.error("Database error:", err.message); // Log the actual error
              return res.status(500).json({ error: "Database error" });
            }

            // Respond with success and normalized boolean for `reported`
            res.json({ message: "Post reported successfully", reported: 1 });
          }
        );
      });
    }
  );
});

// ANALYTICS PAGE

app.get("/api/analytics", async (req, res) => {
  try {
    const authLogs = [
      {
        username: "john_doe",
        action: "Login",
        timestamp: "2025-01-17 12:00:00",
        ipAddress: "192.168.1.1",
      },
      {
        username: "jane_doe",
        action: "Logout",
        timestamp: "2025-01-17 13:00:00",
        ipAddress: "192.168.1.2",
      },
    ];

    const profileChanges = [
      {
        username: "john_doe",
        changeType: "Email Changed",
        timestamp: "2025-01-17 11:30:00",
        ipAddress: "192.168.1.1",
      },
    ];

    const interactions = [
      {
        username: "jane_doe",
        action: "Enrolled in Course",
        timestamp: "2025-01-17 14:00:00",
      },
    ];
    console.log("Fetched contact entries from DB:", contactEntries);
    res.status(200).json({ authLogs, profileChanges, interactions });
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    res.status(500).json({ error: "Failed to fetch analytics data" });
  }
});

app.get("/api/contact-entries", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    const contactEntries = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM contact_requests", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.status(200).json(contactEntries);
  } catch (error) {
    console.error("Error fetching contact entries:", error.message);
    res.status(500).json({ error: "Failed to fetch contact entries" });
  }
});

app.delete("/api/contact-entries/:id", authenticateToken, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied" });
  }

  const { id } = req.params;

  db.run("DELETE FROM contact_requests WHERE id = ?", [id], function (err) {
    if (err) {
      console.error("Error deleting contact entry:", err.message);
      return res.status(500).json({ error: "Failed to delete contact entry" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: "Contact entry not found" });
    }

    res.status(200).json({ message: "Contact entry deleted successfully" });
  });
});
// DELETE: Kommentar löschen
/*
app.delete("/forum/comment/:id", (req, res) => {
  const { id } = req.params;

  const query = `DELETE FROM comments WHERE id = ?`;

  db.run(query, [id], function (err) {
    if (err) {
      console.error("Error deleting comment:", err.message);
      return res.status(500).json({ error: "Error deleting the comment" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    res.status(200).json({ message: "Comment deleted successfully" });
  });
});

*/

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Error handling for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});
