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
  const query = `INSERT INTO courses (
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

  db.run(
    query,
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
      res
        .status(201)
        .json({ message: "Course added successfully", courseId: this.lastID });
    }
  );
});

// API Endpoint zum Abrufen aller Kurse
app.get("/api/courses", authenticateToken, (req, res) => {
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

// POST: Beitrag liken
app.post("/forum/like/:id", (req, res) => {
  const { id } = req.params;

  const query = `UPDATE posts SET likes = likes + 1 WHERE id = ?`;
  db.run(query, [id], (err) => {
    if (err) {
      return res.status(500).json({ error: "Error liking the post" });
    }
    res.json({ message: "Post liked successfully" });
  });
});

// POST: Beitrag melden
app.post("/forum/report/:id", (req, res) => {
  const { id } = req.params;

  const query = `UPDATE posts SET reported = 1 WHERE id = ?`;
  db.run(query, [id], (err) => {
    if (err) {
      return res.status(500).json({ error: "Error reporting the post" });
    }
    res.json({ message: "Post reported successfully" });
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
