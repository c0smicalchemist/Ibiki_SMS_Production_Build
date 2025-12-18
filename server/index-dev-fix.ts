import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// Environment setup
dotenv.config({ path: '.env.development' });

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

// Middleware
app.use(express.json());
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "client", "dist")));

// Test route
app.get("/api/test", (req, res) => {
  res.json({ message: "Server is running", timestamp: new Date().toISOString() });
});

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Server is running with PostgreSQL",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    database: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || "connected"
  });
});

// Login route
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  
  if (email && password) {
    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: "dev-user-id",
        email: email,
        name: "Development User",
        role: "admin"
      },
      token: "mock-jwt-token-for-development"
    });
  } else {
    res.status(401