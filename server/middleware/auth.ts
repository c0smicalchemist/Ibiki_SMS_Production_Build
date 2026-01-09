import jwt from "jsonwebtoken";
import { storage } from "../storage";

const JWT_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Middleware to verify JWT token
export async function authenticateToken(req: any, res: any, next: any) {
  const hdr = req.headers["authorization"] || req.headers["Authorization"] || req.headers["x-auth-token"];
  let token: string | undefined = undefined;
  if (hdr && typeof hdr === 'string') {
    token = hdr.includes('Bearer ') ? hdr.split(' ')[1] : hdr;
  }

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decodedAny = jwt.verify(token, JWT_SECRET) as any;
    req.user = { userId: decodedAny.userId, role: String(decodedAny.role || '').toLowerCase() };
    const iatMs = decodedAny?.iat ? Number(decodedAny.iat) * 1000 : Date.now();
    try {
      const globalInv = await storage.getSystemConfig('jwt.invalidate_after');
      const userInv = await storage.getSystemConfig(`jwt.invalidate_after.user.${req.user.userId}`);
      const globalCutoff = globalInv?.value ? Number(globalInv.value) : 0;
      const userCutoff = userInv?.value ? Number(userInv.value) : 0;
      if ((globalCutoff && iatMs && iatMs < globalCutoff) || (userCutoff && iatMs && iatMs < userCutoff)) {
        return res.status(401).json({ error: "Authentication required" });
      }
    } catch {}
    try {
      const fresh = await storage.getUser(req.user.userId);
      const dbRole = String((fresh as any)?.role || '').toLowerCase();
      if (dbRole && dbRole !== req.user.role) {
        req.user.role = dbRole as any;
      }
    } catch {}
    next();
  } catch (error) {
    return res.status(401).json({ error: "Authentication required" });
  }
}

// Middleware to verify admin role
export function requireAdmin(req: any, res: any, next: any) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// Role gate: allow any of the provided roles
export function requireRole(roles: string[]) {
  return (req: any, res: any, next: any) => {
    const role = String(req.user?.role || '').toLowerCase();
    const allowed = roles.map(r => String(r).toLowerCase());
    if (!req.user || !allowed.includes(role)) {
      return res.status(403).json({ error: "Insufficient privileges" });
    }
    next();
  };
}
