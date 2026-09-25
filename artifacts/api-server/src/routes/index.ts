import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import vinRouter from "./vin.js";
import userRouter from "./user.js";
import paymentsRouter from "./payments.js";
import adminRouter from "./admin.js";
import countriesRouter from "./countries.js";
import announcementsRouter from "./announcements.js";
import pluginsRouter from "./plugins.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(vinRouter);
router.use(userRouter);
router.use(paymentsRouter);
router.use(pluginsRouter);
router.use(adminRouter);
router.use(countriesRouter);
router.use(announcementsRouter);

export default router;
