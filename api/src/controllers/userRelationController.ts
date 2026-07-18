import {
  Get,
  Post,
  Delete,
  Path,
  Route,
  Tags,
  Middlewares,
  Security,
  Request,
} from "tsoa";
import { Request as ExpressRequest } from "express";
import { UserBlockService } from "../services/userBlockService";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";

@Route("/api/users")
@Tags("User Relations")
@Security("jwt")
export class UserRelationController {
  /**
   * Block a user
   */
  @Post("/block/{userId}")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async blockUser(
    @Request() req: ExpressRequest,
    @Path() userId: string,
  ) {
    const blockerId = req.user?.id as string;
    return UserBlockService.blockUser(blockerId, userId);
  }

  /**
   * Unblock a user
   */
  @Delete("/block/{userId}")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async unblockUser(
    @Request() req: ExpressRequest,
    @Path() userId: string,
  ) {
    const blockerId = req.user?.id as string;
    return UserBlockService.unblockUser(blockerId, userId);
  }

  /**
   * Get the list of users blocked by the current user
   */
  @Get("/blocked")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async getBlockedUsers(@Request() req: ExpressRequest) {
    const blockerId = req.user?.id as string;
    return UserBlockService.getBlockedUsers(blockerId);
  }
}
