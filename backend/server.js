const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("./database");

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

// Error handling for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
