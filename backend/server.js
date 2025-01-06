const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const db = require("./database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");

const SECRET_KEY =
  "XdvZ1GSeTsE48kPKCo3zqkZb2sLFnUbsfoqwFL2SN4pn6EcEyFS9IEI3evPvwo59";

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.json());

// Setup multer (Speichern von Profilbildern im "uploads" Verzeichnis)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Zielverzeichnis
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Dateiname wird auf die aktuelle Zeit + Dateierweiterung gesetzt
  },
});

const upload = multer({ storage: storage });

// API Endpoints

// Endpoint zum Abrufen des Profils eines Benutzers (GET /api/user/:id)
app.get("/api/user/:id", authenticateToken, (req, res) => {
  const query = "SELECT id, username, email, role, birthDate, profileImage FROM users WHERE id = ?";
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: "Failed to retrieve user profile" });
    }

    if (!row) {
      return res.status(404).json({ error: "User not found" });
    }

    // Profilbild muss als URL zur Verfügung gestellt werden
    const profileImageUrl = row.profileImage
      ? `${req.protocol}://${req.get("host")}/uploads/${row.profileImage}`
      : null;

    res.json({
      ...row,
      profileImageUrl, // Füge das Profilbild als URL hinzu
    });
  });
});

// Endpoint zum Aktualisieren des Profils eines Benutzers (POST /api/user/update)
app.post("/api/user/update", authenticateToken, upload.single("profileImage"), (req, res) => {
  const { name, email, role, birthdate, address } = req.body;
  const profileImage = req.file ? req.file.filename : null; // Falls ein Profilbild hochgeladen wurde, wird es gespeichert.

  // SQL-Abfrage zum Aktualisieren der Benutzerinformationen
  const query = `
    UPDATE users
    SET username = ?, email = ?, role = ?, birthDate = ?, address = ?, profileImage = ?
    WHERE id = ?;
  `;

  db.run(
    query,
    [name, email, role, birthdate, address, profileImage, req.user.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "Failed to update user profile" });
      }

      res.json({ message: "Profile updated successfully", userId: req.user.id });
    }
  );
});



app.get("/api/message", (req, res) => {
  res.json({ message: "Hello from the backend!" });
});

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
  const { username, email, password, role, birthDate } = req.body;

  // Validate input
  const validationError = validateRegisterInput({ username, email, password });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  // only admins are allowed to create users with the the role 'admin'
  const requestedRole = role && role === "admin" ? "admin" : "student";

  const hashedPassword = bcrypt.hashSync(password, 8); // Hash password
  const query = `INSERT INTO users (username, email, password, role, birthDate) VALUES (?, ?, ?, ?, ?)`; // Corrected query

  // Insert user into the database
  db.run(query, 
    [username, email, hashedPassword, requestedRole, birthDate], 
    function (err) {
    if (err) {
      console.error("Database error:", err.message); 
      if (err.code === "SQLITE_CONSTRAINT") {
        return res.status(400).json({ error: "Username already exists" });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
    res.status(201).json({ id: this.lastID, username, email, role: requestedRole, birthDate });
  });
});

// Login endpoint
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Both username and password are required" });
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
      { id: user.id, username: user.username }, // Payload
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
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Access denied, you are not an admin" });
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




// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
