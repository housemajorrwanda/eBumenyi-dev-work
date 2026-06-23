import {
  Get,
  Middlewares,
  Path,
  Post,
  Request,
  Route,
  Security,
  Tags,
} from "tsoa";
import type { Request as ExpressRequest } from "express";
import { WeltelBackfillService } from "../services/weltelBackfillService";
import { WeltelService } from "../services/weltelService";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";

@Route("/api/weltel")
@Tags("WelTel")
export class WeltelController {
  /**
   * List users from the WelTel project API (proxied with server-side auth).
   */
  @Get("/users")
  @Middlewares(loggerMiddleware)
  public async getUsers() {
    return WeltelService.getUsers();
  }

  /**
   * Verify WelTel env, login, and GET the logged-in API user (id from login response).
   */
  @Get("/connection")
  @Middlewares(loggerMiddleware)
  public async testConnection() {
    return WeltelService.testConnection();
  }

  /**
   * Fetch the logged-in WelTel API user (from login response user.id).
   */
  @Get("/me")
  @Middlewares(loggerMiddleware)
  public async getLoggedInUser() {
    return WeltelService.getProjectUser();
  }

  /**
   * Fetch a WelTel user by id.
   */
  @Get("/users/{weltelUserId}")
  @Middlewares(loggerMiddleware)
  public async getProjectUser(@Path() weltelUserId: number) {
    return WeltelService.getProjectUser(weltelUserId);
  }

  /**
   * Manually link ebumenyi users that have no weltelUserId to WelTel.
   */
  @Post("/backfill")
  @Middlewares(loggerMiddleware)
  public async backfillUnlinkedUsers() {
    return WeltelBackfillService.backfillUnlinkedUsers();
  }

  /**
   * JWT login link for WelTel (name + phone signed with WELTEL_SECRET, encrypted with WELTEL_ENCRYPTION_KEY).
   * Returns https://rw-chw1.weltelhealth.net/login?jwtKey=...&locale=...
   */
  @Get("/login-url")
  @Security("jwt")
  @Middlewares(loggerMiddleware)
  public async getLoginUrl(@Request() req: ExpressRequest) {
    return WeltelService.getLoginUrlForEbumenyiUser(req.user!.id);
  }
}
