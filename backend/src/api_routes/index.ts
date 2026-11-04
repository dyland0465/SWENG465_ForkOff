/**
 * routes/index.ts
 *
 * Puts every route file together into one router that app.ts mounts.
 * Each file handles one area of the API.
 *
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
import restaurantManagementRoutes from "./restaurantManagementRoutes";

const router = Router();

router.use(lobbyRoutes);        // lobbies, live chat, guest + login session check, logout
router.use(adminRoutes);        // /api/admin (admins only)
router.use(healthRoutes);       // /api/health
router.use(authRoutes);         // /api/auth/login
router.use(userRoutes);         // /api/users
router.use(partnerRoutes);      // /api/partners/register
router.use(restaurantRoutes);   // /api/restaurants
router.use(placesRoutes);       // /api/places (Google)
router.use(restaurantManagementRoutes);

export default router;
