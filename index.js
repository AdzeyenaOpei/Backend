const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");

// Import database connection
const pool = require('./config/database');


const app = express();

require("dotenv").config();
const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = process.env.JWT_SECRET || "Opei";

// Middleware
app.use(express.json());

app.use(
  cors({
    credentials: true,
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  })
);



// Routes
app.get("/", (req, res) => {
  res.send("Welcome to the API!");
});


app.post("/register", async (req, res) => {
  const { name, email, password, role, preferences } = req.body;
  if (!name || !email || !password || !role || !preferences) {
    console.log("Missing required fields");
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const userRole = role || "user";
    const user = await pool.query(
      'INSERT INTO users (name, email, password, role, preferences) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, preferences',
      [name, email, bcrypt.hashSync(password, bcryptSalt), userRole, preferences]
    );

    res.status(201).json({ message: "Registration successful", user: user.rows[0] });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ error: "Registration failed", details: error.message });
  }
});


app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    console.log("Missing required fields");
    return res.status(400).json({ error: "Missing required fields" });
  }

  try { 
    const user = await pool.query('SELECT * FROM users WHERE email = $1',[email]);
    if (user.rows.length === 0) {
      console.log("User not found");
      return res.status(404).json({ error: "User not found" });
    }

    const passOk = bcrypt.compare(password, user.rows[0].password);
    // const passOk = password === user.rows[0].password;
    if (!passOk) {
      console.log("Invalid password");
      return res.status(401).json({ error: "Invalid password" });
    }

    res.json({ user: user.rows[0], message: "Login successful" });
  } catch (e) {
    console.error("Error during login:", e);
    res.status(500).json({ error: "Login failed", details: e.message });
  }
});

app.get("/profile/:id", async (req, res) => {
  const { id } = req.params;
  if (id === undefined) {
    console.log("No ID was sent to the backend");
    return res.status(400).json({ error: "No ID was found" });
  }
  try {
    const user = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [req.params.id]
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("Error verifying token:", err);
    res.status(401).json({ error: "Failed to authenticate token" });
  }
});

app.get("/events", async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM events ORDER BY event_date DESC');
    res.json(result.rows);
  } catch (error) {
    console.error("Failed to fetch events:", error);
    res.status(500).json({ error: "Failed to fetch events", details: error.message });
  }
});

app.get("/event/:id", async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).json({ error: "Failed to fetch event", details: error.message });
  }
});

app.post("/createEvent", async (req, res) => {
  const { user_id, event_name, available_seats, event_date, event_time, location } = req.body;

  console.log(`userId: ${user_id}`);

  try {
    // Check if user is admin
    const userResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [user_id]
    );

    
    if (!userResult.rows[0] || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ error: "Only admins can create events" });
    }

    if (!event_name || !available_seats || !event_date || !event_time || !location) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(
      'INSERT INTO events (event_name, available_seats, event_date, event_time, location) VALUES ($1, $2, $3, $4, $5)',
      [event_name, available_seats, event_date, event_time, location]
    );
    console.log(`Event created successfully: ${result.rows[0]}`);
    res.status(201).json({ message: "Event created successfully"});
  } catch (error) {
    console.error("Error creating event:", error);  
    res.status(500).json({ error: "Failed to create event", details: error.message });
  }
});

app.post("/rsvp", async (req, res) => {
  const { userId, eventId, rsvpDate } = req.body;

  try {
    // Check available capacity 
    const eventResult = await pool.query(
      'SELECT available_seats FROM events WHERE id = $1',
      [eventId]
    );

    if (eventResult.rows[0].available_seats < 1) {
      return res.status(400).json({ error: 'Not enough seats available' });
    }

    const existingRsvp = await pool.query(
      "SELECT * FROM rsvps WHERE event_id = $1 AND user_id = $2",
      [eventId, userId]
    );

    if (existingRsvp.rows.length > 0) {
      return res.status(400).json({ error: "User has already RSVP'd for this event" });
    }
    
    await pool.query(
      'INSERT INTO rsvps (user_id, event_id, rsvp_date) VALUES ($1, $2, $3)',
      [userId, eventId, rsvpDate]
    );
    
    await pool.query(
      'UPDATE events SET available_seats = available_seats - 1 WHERE id = $1',
      [eventId]
    );

    console.log(`RSVP created successfully for event ${eventId} by user ${userId}`);
    res.status(201).json({ message: "RSVP created successfully" });
  } catch (error) {
    console.error("Error creating RSVP:", error);
    res.status(500).json({ error: "Failed to create RSVP", details: error.message });
  }
});


// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

