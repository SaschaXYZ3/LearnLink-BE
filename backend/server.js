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
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (!bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        SECRET_KEY,
        { expiresIn: 86400 }
      );

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
app.get('/api/user', authenticateToken, async (req, res) => {
  const userId = req.user.id; // Benutzer-ID aus dem Token extrahieren

  // SQL-Abfrage zum Abrufen der Benutzerdaten
  const query = `SELECT id, username, email, birthDate FROM users WHERE id = ?`;

  try {
    // Verwende db.get für das Abrufen der Benutzerdaten aus der Datenbank
    db.get(query, [userId], (err, row) => {
      if (err) {
        console.error('Fehler bei der Abfrage der Benutzerdaten:', err.message);
        return res.status(500).json({ error: 'Fehler beim Abrufen der Benutzerdaten.' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
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
    console.error('Fehler bei der Verarbeitung der Anfrage:', error);
    return res.status(500).json({ error: 'Fehler beim Abrufen der Benutzerdaten.' });
  }
});


// API endpoint for updating user profile
app.post("/api/user/update", authenticateToken, async (req, res) => {
  const { username, email, birthDate, currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  // Überprüfen, ob der Benutzer existiert
  db.get("SELECT * FROM users WHERE id = ?", [userId], async (err, user) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Wenn ein neues Passwort bereitgestellt wurde
    if (newPassword) {
      // Überprüfen, ob das aktuelle Passwort korrekt ist
      const passwordMatch = await bcrypt.compare(currentPassword, user.password);
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
          if (err) return res.status(500).json({ error: "Database update error" });
          res.json({ message: "Profile updated successfully" });
        }
      );
    } else {
      // Kein neues Passwort bereitgestellt, nur andere Felder aktualisieren
      db.run(
        "UPDATE users SET username = ?, email = ?, birthDate = ? WHERE id = ?",
        [username, email, birthDate, userId],
        (err) => {
          if (err) return res.status(500).json({ error: "Database update error" });
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
    !meetingLink
  ) {
    console.log("Missing required fields");
    return res.status(400).json({ error: "All fields are required" });
  }

  // SQL Query zum Hinzufügen des Kurses
  const insertCourseQuery = `INSERT INTO courses (
    title, category, subcategory, level, maxStudents, tutoringType, date, time, meetingLink, userId
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

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
          res.status(201).json({
            message: "Course added successfully",
            courseId: this.lastID,
          });
        }
      );
    }
  );
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
app.get("/api/courses", (req, res) => {
  //const userId = req.user.id; // Aus dem Token abgeleiteter Benutzer

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

  db.all(query, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
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
            return res.status(200).json({
              message: "Sie haben sich erfolgreich für den Kurs angemeldet.",
            });
          }
        );
      }
    );
  });
});

/*app.get("/api/courses", async (req, res) => {
  try {
    const allCourses = await courses.findAll({
      include: [
        {
          model: course_availability,
          attributes: ["maxStudents", "actualStudents"],
        },
        {
          model: course_reviews,
          attributes: ["rating", "comment", "date"],
        },
        {
          model: course_enrollment,
          attributes: ["userId", "status", "isFavorite"],
        },
      ],
    });

    res.status(200).json(allCourses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching courses." });
  }
});*/

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
        res.status(200).json({ isFavorite: true });
      });
    }
  });
});

// API Endpoint zum Abrufen der Kurse des eingeloggten Tutors
app.get("/api/courses/mine", authenticateToken, (req, res) => {
  const userId = req.user.id;

  const query = `SELECT * FROM courses WHERE userId = ?`;

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

app.post("/api/enrollments/:enrollmentId/accept", async (req, res) => {
  const { enrollmentId } = req.params;

  try {
    // Hole die Buchung aus der course_enrollment Tabelle
    const enrollment = await db.get(
      "SELECT * FROM course_enrollment WHERE id = ?",
      [enrollmentId]
    );

    if (!enrollment) {
      console.error(`Enrollment with ID ${enrollmentId} not found`);
      return res.status(404).json({ error: "Enrollment not found" });
    }

    // Hole den Kurs aus der course_availability Tabelle
    const course = await db.get(
      "SELECT * FROM course_availability WHERE courseId = ?",
      [enrollment.courseId]
    );

    if (!course) {
      console.error(`Course with ID ${enrollment.courseId} not found`);
      return res.status(404).json({ error: "Course not found" });
    }

    // Überprüfe, ob der Kurs voll ist
    if (course.actualStudents >= course.maxStudents) {
      console.error(`Course with ID ${enrollment.courseId} is full`);
      return res.status(400).json({ error: "Course is already full" });
    }

    // Ändere den Status der Buchung auf "Accepted" (Status = 0)
    await db.run("UPDATE course_enrollment SET status = 1 WHERE id = ?", [
      enrollmentId,
    ]);

    // Erhöhe die tatsächliche Anzahl der Studenten im Kurs
    await db.run(
      "UPDATE course_availability SET actualStudents = actualStudents + 1 WHERE courseId = ?",
      [enrollment.courseId]
    );

    console.log(`Enrollment with ID ${enrollmentId} has been accepted`);

    res.status(200).json({ message: "Enrollment accepted", enrollment });
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
  const { postId, comment, username } = req.body;

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
      if (row) return res.status(400).json({ error: "You already liked this post" });

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
        return res.status(400).json({ error: "You have already reported this post" });
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
