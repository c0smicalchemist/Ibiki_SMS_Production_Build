import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// Environment setup
dotenv.config({ path: '.env.development' });

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "client", "dist")));

// Simple test route
app.get("/api/test", (req, res) => {
  res.json({ message: "Server is running", timestamp: new Date().toISOString() });
});

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

// Login route (mock for development)
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  
  // Mock authentication for development
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
    res.status(401).json({
      success: false,
      message: "Invalid credentials"
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Development server running at http://localhost:${port}`);
  console.log(`📝 Test API: http://localhost:${port}/api/test`);
  console.log(`💚 Health check: http://localhost:${port}/api/health`);
  console.log(`🔐 Login: POST to http://localhost:${port}/api/auth/login`);
});