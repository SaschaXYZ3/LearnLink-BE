const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const db = require("./database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const SECRET_KEY =
  "XdvZ1GSeTsE48kPKCo3zqkZb2sLFnUbsfoqwFL2SN4pn6EcEyFS9IEI3evPvwo59";

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// API Endpoint
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

  const hashedPassword = bcrypt.hashSync(password, 8); // Hash password
  const query = `INSERT INTO users (username, email, password, role, birthDate) VALUES (?, ?, ?, ?, ?)`;

  // Insert user into the database
db.run(query, [username, email, hashedPassword, role, birthDate], function (err) {
    if (err) {
      console.error("Database error:", err.message); 
      if (err.code === "SQLITE_CONSTRAINT") {
        return res.status(400).json({ error: "Username already exists" });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
    res.status(201).json({ id: this.lastID, username, email, role, birthDate });
  });
});


// Login endpoint
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Both username and password are required" });
  }

  // Contact Form Submission Endpoint
app.post("/contact", (req, res) => {
  const { name, email, message } = req.body;

  // Validate input
  if (!name || !email || !message) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const query = `INSERT INTO contact_requests (name, email, message) VALUES (?, ?, ?)`;

  // Save contact form data into the database
  db.run(query, [name, email, message], function (err) {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({ error: "Failed to save the contact request" });
    }

    res.status(201).json({ message: "Contact request saved successfully!" });
  });
});

/* TO BE REENABLED ONCE ADMIN PANEL IS LIVE

// Retrieve all contact form submissions
app.get("/contact", (req, res) => {
  const query = `SELECT * FROM contact_requests ORDER BY date DESC`;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({ error: "Failed to retrieve contact requests" });
    }

    res.status(200).json(rows);
  });
});

*/

  const query = `SELECT * FROM users WHERE username = ?`;

  // Fetch user from database by username
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

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,         
      birthDate: user.birthDate, 
      token,
    });
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
