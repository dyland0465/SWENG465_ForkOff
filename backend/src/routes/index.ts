/**
 * routes/index.ts
 *
 * Puts every route file together into one router that app.ts mounts.
 * Each file handles one area of the API.
 *
 * Order matters: lobbyRoutes must come before placeholderRoutes, because the
 * membership guard at the end of lobbyRoutes.ts protects the placeholder
 * /api/lobbies/:id/votes and /results routes.
 */
import { Router } from "express";
import lobbyRoutes from "./lobbyRoutes";
import adminRoutes from "./adminRoutes";
import healthRoutes from "./healthRoutes";
import authRoutes from "./authRoutes";
import userRoutes from "./userRoutes";
import partnerRoutes from "./partnerRoutes";
import restaurantRoutes from "./restaurantRoutes";
import placesRoutes from "./placesRoutes";
import placeholderRoutes from "./placeholderRoutes";

const router = Router();

router.use(lobbyRoutes);        // lobbies, live chat, guest + login session check, logout
router.use(adminRoutes);        // /api/admin (admins only)
router.use(healthRoutes);       // /api/health
router.use(authRoutes);         // /api/auth/login
router.use(userRoutes);         // /api/users
router.use(partnerRoutes);      // /api/partners/register
router.use(restaurantRoutes);   // /api/restaurants
router.use(placesRoutes);       // /api/places (Google)
router.use(placeholderRoutes);  // ⚠️ demo-data routes that aren't built yet

export default router;
