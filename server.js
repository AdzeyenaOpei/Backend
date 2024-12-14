const express = require("express");
const cors = require("cors");
require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const path = require("path");
const { Sequelize } = require('sequelize');

const app = express();

const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = process.env.JWT_SECRET || "your_jwt_secret";

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    credentials: true,
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  })
);

// Serve static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Database connection
const sequelize = require("./config/database");

// Import models after sequelize initialization
const User = require("./models/User");
const Event = require("./models/Event");
const Ticket = require("./models/Ticket");

// Define relationships
User.hasMany(Ticket);
Ticket.belongsTo(User);
Event.hasMany(Ticket);
Ticket.belongsTo(Event);

// Sync database
sequelize.sync({ alter: true })
  .then(() => console.log('Database synced'))
  .catch(err => console.error('Error syncing database:', err));

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Helper Functions
const isAdmin = (user) => user && user.role === "admin";

// Create default admin user
const createDefaultAdmin = async () => {
  try {
    const adminExists = await User.findOne({ where: { role: "admin" } });
    if (!adminExists) {
      await User.create({
        name: "Admin",
        email: "admin@example.com",
        password: bcrypt.hashSync("admin123", bcryptSalt),
        role: "admin",
      });
      console.log("Default admin created");
    }
  } catch (err) {
    console.error("Error creating default admin:", err);
  }
};

// Initialize admin after database sync
sequelize.authenticate()
  .then(() => {
    console.log("Database connected...");
    createDefaultAdmin();
  })
  .catch((err) => console.error("Error connecting to database:", err));

// Routes
app.get("/test", (req, res) => res.json("test ok"));

app.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const userRole = role || "user";
    const user = await User.create({
      name,
      email,
      password: bcrypt.hashSync(password, bcryptSalt),
      role: userRole,
    });

    res.status(201).json({ message: "Registration successful", user });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        error: "Duplicate entry",
        details: "This email is already registered",
      });
    }
    res.status(500).json({ error: "Registration failed", details: error.message });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({
      where: { email },
      attributes: ["id", "name", "email", "password", "role"],
    });
    
    if (!user) return res.status(404).json({ error: "User not found" });

    const passOk = bcrypt.compareSync(password, user.password);
    if (!passOk) return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign(
      { email: user.email, id: user.id, role: user.role },
      jwtSecret,
      { expiresIn: "1h" }
    );

    res.cookie("token", token, { httpOnly: true }).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (e) {
    console.error("Error during login:", e);
    res.status(500).json({ error: "Login failed", details: e.message });
  }
});

app.get("/profile", async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findByPk(decoded.id, {
      attributes: ["id", "name", "email", "role"]
    });
    
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: "Failed to authenticate token" });
  }
});

app.post("/createEvent", upload.single("image"), async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findByPk(decoded.id);

    if (!isAdmin(user)) {
      return res.status(403).json({ error: "Only admins can create events" });
    }

    const { title, description, eventDate, eventTime, location } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : "";

    const event = await Event.create({
      title,
      description,
      date: eventDate,
      time: eventTime,
      location,
      image
    });

    res.status(201).json(event);
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ error: "Failed to create event" });
  }
});

app.get("/events", async (req, res) => {
  try {
    const events = await Event.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

app.get("/event/:id", async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

app.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 