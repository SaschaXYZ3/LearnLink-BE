const express = require("express");
const cors = require("cors");
const db = require("./database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");

const SECRET_KEY =
  "XdvZ1GSeTsE48kPKCo3zqkZb2sLFnUbsfoqwFL2SN4pn6EcEyFS9IEI3evPvwo59";

const app = express();
const PORT = 5000;

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

// API Endpoints
app.get("/api/message", (req, res) => {
  res.json({ message: "Hello from the backend!" });
});

// Protected route example --> use for div. subpages
app.get("/api/protected", authenticateToken, (req, res) => {
  res.json({ message: "This is a protected route", user: req.user });
});

// Validation function for register input
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

// Register endpoint
app.post("/register", (req, res) => {
  console.log("Request Body:", req.body);
  const { username, email, password, role, birthDate } = req.body;

  // Validate input
  const validationError = validateRegisterInput({ username, email, password });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  // only admins are allowed to create users with the the role 'admin'
  const requestedRole = role === "admin" ? "admin" : role;

  const hashedPassword = bcrypt.hashSync(password, 8); // Hash password
  const query = `INSERT INTO users (username, email, password, role, birthDate) VALUES (?, ?, ?, ?, ?)`; // Corrected query

  // Insert user into the database
  db.run(
    query,
    [username, email, hashedPassword, requestedRole, birthDate],
    function (err) {
      if (err) {
        console.error("Database error:", err.message);
        if (err.code === "SQLITE_CONSTRAINT") {
          return res.status(400).json({ error: "Username already exists" });
        }
        return res.status(500).json({ error: "Internal server error" });
      }

      // Generate JWT token after successful user creation
      const token = jwt.sign(
        { id: this.lastID, username, role: requestedRole }, // Payload
        SECRET_KEY, // Secret key
        { expiresIn: 86400 } // Token validity
      );

      // Respond with user details and the token
      res.json({
        id: this.lastID, // Use the lastID from the db insertion
        username,
        email,
        role: requestedRole,
        birthDate,
        token, // JWT token returned
      });
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

  // SQL query to fetch user by username
  const query = `SELECT * FROM users WHERE username = ?`;

  db.get(query, [username], (err, user) => {
    if (err) {
      return res.status(500).json({ error: "Internal server error" });
    }

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Compare hashed password with the provided password
    const passwordIsValid = bcrypt.compareSync(password, user.password);
    if (!passwordIsValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role }, // Payload
      SECRET_KEY, // Secret key
      { expiresIn: 86400 } // Token validity
    );

    // Successful login, return user info and JWT token
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      birthDate: user.birthDate,
      token, // JWT token returned
    });
  });
});

// Route zum Abrufen aller Benutzer (für das Admin Dashboard)
app.get("/admin", authenticateToken, (req, res) => {
  // Sicherstellen, dass der Benutzer ein Admin ist
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ error: "Access denied, you are not an admin" });
  }

  // SQL-Abfrage, um alle Benutzer aus der Tabelle zu holen
  const query = `SELECT id, username, email, role, birthDate FROM users`;

  // Alle Benutzer aus der Datenbank abfragen
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({ error: "Failed to retrieve users" });
    }

    // Erfolgreiche Antwort mit den Benutzerdaten
    res.status(200).json(rows);
  });
});

// API Endpoint um einen Kurs hinzuzufügen
app.post("/api/courses", authenticateToken, (req, res) => {
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
    return res.status(400).json({ error: "All fields are required" });
  }

  const query = `
    INSERT INTO courses (
      title, category, subcategory, level, maxStudents, tutoringType, date, time, meetingLink, userId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

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

      res
        .status(201)
        .json({ message: "Course added successfully", courseId: this.lastID });
    }
  );
});

// API Endpoint zum Abrufen aller Kurse
app.get("/api/courses", authenticateToken, (req, res) => {
  const query = `
    SELECT courses.*, users.username AS tutor
    FROM courses
    JOIN users ON courses.userId = users.id
  `;

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

  const query = `
    SELECT * FROM courses WHERE userId = ?
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

  const query = `
    SELECT courses.*, users.username AS tutor
    FROM courses
    JOIN users ON courses.userId = users.id
    WHERE courses.id = ?
  `;

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

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
