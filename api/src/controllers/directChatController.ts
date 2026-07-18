import {
  Get,
  Post,
  Path,
  Route,
  Tags,
  Middlewares,
  Security,
  Body,
  Request,
  Put,
  Delete,
  Query,
} from "tsoa";
import { Request as ExpressRequest } from "express";
import { DirectChatService } from "../services/directChatService";
import { ConversationMuteService } from "../services/conversationMuteService";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";

// Helper to get io instance from express app
function getIOInstance(req: ExpressRequest): any {
  return (req as any).app?.get?.("io");
}

@Route("/api/direct-chats")
@Tags("Direct Chat")
@Security("jwt")
export class DirectChatController {
  /**
   * Get or create a direct chat with another user
   */
  @Post("/")
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
  public async getOrCreateDirectChat(
    @Request() req: ExpressRequest,
    @Body() body: { otherUserId: string },
  ) {
    const userId = req.user?.id as string;
    return DirectChatService.getOrCreateDirectChat(userId, body.otherUserId);
  }

  /**
   * Get all direct chats for the current user
   */
  @Get("/")
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
  public async getUserDirectChats(@Request() req: ExpressRequest) {
    const userId = req.user?.id as string;
    return DirectChatService.getUserDirectChats(userId);
  }

  /**
   * Send a message in a direct chat
   */
  @Post("/{chatId}/messages")
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
  public async sendMessage(
    @Request() req: ExpressRequest,
    @Path() chatId: string,
    @Body()
    body: {
      content: string;
      type?: string;
      attachments?: string;
    },
  ) {
    const userId = req.user?.id as string;
    const io = getIOInstance(req);
    return DirectChatService.sendMessage(
      chatId,
      userId,
      body.content,
      body.type || "text",
      body.attachments,
      io,
    );
  }
  /**
   * Get messages from a direct chat with pagination
   * GET /direct-chats/{chatId}/messages?limit=50&offset=0
   */
  @Get("/{chatId}/messages")
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
  public async getDirectChatMessages(
    @Request() req: ExpressRequest,
    @Path() chatId: string,
    @Query() limit: number = 50,
    @Query() offset: number = 0,
  ) {
    const userId = req.user?.id as string;
    return DirectChatService.getDirectChatMessages(
      chatId,
      userId,
      limit,
      offset,
    );
  }
  /**
   * Search messages in a direct chat by content, across full history
   * GET /direct-chats/{chatId}/messages/search?q=&limit=50&offset=0
   */
  @Get("/{chatId}/messages/search")
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
  public async searchDirectChatMessages(
    @Request() req: ExpressRequest,
    @Path() chatId: string,
    @Query() q: string,
    @Query() limit: number = 20,
    @Query() offset: number = 0,
  ) {
    const userId = req.user?.id as string;
    return DirectChatService.searchDirectChatMessages(
      chatId,
      userId,
      q,
      limit,
      offset,
    );
  }
  /**
   * Edit a message
   */
  @Put("/{chatId}/messages/{messageId}")
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
  public async editMessage(
    @Request() req: ExpressRequest,
    @Path() messageId: string,
    @Body() body: { content: string },
  ) {
    const userId = req.user?.id as string;
    const io = getIOInstance(req);
    return DirectChatService.editMessage(messageId, userId, body.content, io);
  }

  /**
   * Delete a message
   */
  @Delete("/{chatId}/messages/{messageId}")
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
  public async deleteMessage(
    @Request() req: ExpressRequest,
    @Path() messageId: string,
  ) {
    const userId = req.user?.id as string;
    const io = getIOInstance(req);
    return DirectChatService.deleteMessage(messageId, userId, io);
  }

  /**
   * Mark a message as read
   */
  @Post("/{chatId}/messages/{messageId}/read")
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
  public async markMessageAsRead(
    @Request() req: ExpressRequest,
    @Path() messageId: string,
  ) {
    const userId = req.user?.id as string;
    return DirectChatService.markMessageAsRead(messageId, userId);
  }

  /**
   * Toggle like on a message
   */
  @Post("/{chatId}/messages/{messageId}/like")
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
  public async toggleLike(
    @Request() req: ExpressRequest,
    @Path() messageId: string,
  ) {
    const userId = req.user?.id as string;
    const io = getIOInstance(req);
    return DirectChatService.toggleLike(messageId, userId, io);
  }

  /**
   * Get unread message counts for all direct chats
   */
  @Get("/unread/counts")
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
  public async getUnreadCounts(@Request() req: ExpressRequest) {
    const userId = req.user?.id as string;
    return DirectChatService.getUnreadCounts(userId);
  }

  /**
   * Get unread messages for a specific direct chat
   */
  @Get("/{chatId}/unread")
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
  public async getUnreadMessagesInChat(
    @Request() req: ExpressRequest,
    @Path() chatId: string,
  ) {
    const userId = req.user?.id as string;
    return DirectChatService.getUnreadMessagesInChat(chatId, userId);
  }

  /**
   * Update direct chat (archive, etc)
   */
  @Put("/{chatId}")
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
  public async updateDirectChat(
    @Request() req: ExpressRequest,
    @Path() chatId: string,
    @Body() body: { isArchived?: boolean },
  ) {
    const userId = req.user?.id as string;
    return DirectChatService.updateDirectChat(chatId, userId, body);
  }

  /**
   * Mute or unmute a direct chat for the current user
   */
  @Put("/{chatId}/mute")
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
  public async muteDirectChat(
    @Request() req: ExpressRequest,
    @Path() chatId: string,
    @Body() body: { muted: boolean },
  ) {
    const userId = req.user?.id as string;
    return ConversationMuteService.setMute(
      userId,
      "direct",
      chatId,
      body.muted,
    );
  }

  /**
   * Get a specific direct chat with message history
   */
  @Get("/{chatId}")
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
  public async getDirectChatWithMessages(
    @Request() req: ExpressRequest,
    @Path() chatId: string,
  ) {
    const userId = req.user?.id as string;
    return DirectChatService.getDirectChatWithMessages(chatId, userId);
  }
}
