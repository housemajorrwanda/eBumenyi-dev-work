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
  Delete,
  Put,
  Query,
} from "tsoa";
import { Request as ExpressRequest } from "express";
import { GroupChatService } from "../services/groupChatService";
import { ConversationMuteService } from "../services/conversationMuteService";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";

// Helper to get io instance from express app
function getIOInstance(req: ExpressRequest): any {
  return (req as any).app?.get?.("io");
}

@Route("/api/group-chats")
@Tags("Group Chat")
@Security("jwt")
export class GroupChatController {
  /**
   * Create a new group chat
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
  public async createGroup(
    @Request() req: ExpressRequest,
    @Body()
    body: {
      name: string;
      participantIds: string[];
      description?: string;
      photo?: string;
    },
  ) {
    const createdById = req.user?.id as string;
    return GroupChatService.createGroup(
      body.name,
      createdById,
      body.participantIds,
      body.description,
      body.photo,
    );
  }

  /**
   * Get all groups for the current user
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
  public async getUserGroups(@Request() req: ExpressRequest) {
    const userId = req.user?.id as string;
    return GroupChatService.getUserGroups(userId);
  }

  /**
   * Send a message in a group
   */
  @Post("/{groupId}/messages")
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
    @Path() groupId: string,
    @Body()
    body: {
      content: string;
      type?: string;
      attachments?: string;
    },
  ) {
    const userId = req.user?.id as string;
    const io = getIOInstance(req);
    return GroupChatService.sendMessage(
      groupId,
      userId,
      body.content,
      body.type || "text",
      body.attachments,
      io,
    );
  }

  /**
   * Get messages from a group chat with pagination
   * GET /group-chats/{groupId}/messages?limit=50&offset=0
   */
  @Get("/{groupId}/messages")
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
  public async getGroupMessages(
    @Request() req: ExpressRequest,
    @Path() groupId: string,
    @Query() limit: number = 50,
    @Query() offset: number = 0,
  ) {
    const userId = req.user?.id as string;
    return GroupChatService.getGroupMessages(groupId, userId, limit, offset);
  }
  /**
   * Search messages in a group chat by content, across full history
   * GET /group-chats/{groupId}/messages/search?q=&limit=20&offset=0
   */
  @Get("/{groupId}/messages/search")
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
  public async searchGroupMessages(
    @Request() req: ExpressRequest,
    @Path() groupId: string,
    @Query() q: string,
    @Query() limit: number = 20,
    @Query() offset: number = 0,
  ) {
    const userId = req.user?.id as string;
    return GroupChatService.searchGroupMessages(
      groupId,
      userId,
      q,
      limit,
      offset,
    );
  }
  /**
   * Add a participant to the group
   */
  @Post("/{groupId}/participants")
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
  public async addParticipant(
    @Request() req: ExpressRequest,
    @Path() groupId: string,
    @Body() body: { userId: string },
  ) {
    const requesterId = req.user?.id as string;
    const io = getIOInstance(req);
    return GroupChatService.addParticipant(
      groupId,
      body.userId,
      requesterId,
      io,
    );
  }

  /**
   * Remove a participant from the group
   */
  @Delete("/{groupId}/participants/{userId}")
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
  public async removeParticipant(
    @Request() req: ExpressRequest,
    @Path() groupId: string,
    @Path() userId: string,
  ) {
    const requesterId = req.user?.id as string;
    const io = getIOInstance(req);
    return GroupChatService.removeParticipant(groupId, userId, requesterId, io);
  }

  /**
   * Add a comment to a message
   */
  @Post("/{groupId}/messages/{messageId}/comments")
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
  public async addComment(
    @Request() req: ExpressRequest,
    @Path() messageId: string,
    @Body() body: { content: string; parentId?: string },
  ) {
    const userId = req.user?.id as string;
    const io = getIOInstance(req);
    return GroupChatService.addComment(
      messageId,
      userId,
      body.content,
      body.parentId,
      io,
    );
  }

  /**
   * Edit a message
   */
  @Put("/{groupId}/messages/{messageId}")
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
    return GroupChatService.editMessage(messageId, userId, body.content, io);
  }

  /**
   * Delete a message
   */
  @Delete("/{groupId}/messages/{messageId}")
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
    return GroupChatService.deleteMessage(messageId, userId, io);
  }

  /**
   * Mark a message as read
   */
  @Post("/{groupId}/messages/{messageId}/read")
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
    return GroupChatService.markMessageAsRead(messageId, userId);
  }

  /**
   * Toggle like on a message
   */
  @Post("/{groupId}/messages/{messageId}/like")
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
    return GroupChatService.toggleLike(messageId, userId, io);
  }

  /**
   * Update group info (name, description, photo)
   */
  @Put("/{groupId}")
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
  public async updateGroup(
    @Request() req: ExpressRequest,
    @Path() groupId: string,
    @Body() body: { name?: string; description?: string; photo?: string },
  ) {
    const userId = req.user?.id as string;
    return GroupChatService.updateGroup(groupId, userId, body);
  }

  /**
   * Mute or unmute a group chat for the current user
   */
  @Put("/{groupId}/mute")
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
  public async muteGroupChat(
    @Request() req: ExpressRequest,
    @Path() groupId: string,
    @Body() body: { muted: boolean },
  ) {
    const userId = req.user?.id as string;
    return ConversationMuteService.setMute(
      userId,
      "group",
      groupId,
      body.muted,
    );
  }

  /**
   * Delete group chat
   */
  @Delete("/{groupId}")
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
  public async deleteGroup(
    @Request() req: ExpressRequest,
    @Path() groupId: string,
  ) {
    const userId = req.user?.id as string;
    return GroupChatService.deleteGroup(groupId, userId);
  }

  /**
   * Get unread message counts for all groups
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
    return GroupChatService.getUnreadCounts(userId);
  }

  /**
   * Get unread messages for a specific group
   */
  @Get("/{groupId}/unread")
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
  public async getUnreadMessagesInGroup(
    @Request() req: ExpressRequest,
    @Path() groupId: string,
  ) {
    const userId = req.user?.id as string;
    return GroupChatService.getUnreadMessagesInGroup(groupId, userId);
  }

  /**
   * Get comments for a message
   */
  @Get("/messages/{messageId}/comments")
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
  public async getMessageComments(@Path() messageId: string) {
    const limit = 20;
    const offset = 0;
    return GroupChatService.getComments(messageId, limit, offset);
  }

  /**
   * Add a comment to a message
   */
  @Post("/messages/{messageId}/comments")
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
  public async addMessageComment(
    @Request() req: ExpressRequest,
    @Path() messageId: string,
    @Body() body: { text: string; parentId?: string },
  ) {
    const userId = req.user?.id as string;
    const io = getIOInstance(req);
    return GroupChatService.addComment(
      messageId,
      userId,
      body.text,
      body.parentId,
      io,
    );
  }

  /**
   * Edit a comment
   */
  @Put("/comments/{commentId}")
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
  public async editComment(
    @Request() req: ExpressRequest,
    @Path() commentId: string,
    @Body() body: { text: string },
  ) {
    const userId = req.user?.id as string;
    const io = getIOInstance(req);
    return GroupChatService.editComment(commentId, userId, body.text, io);
  }

  /**
   * Delete a comment
   */
  @Delete("/comments/{commentId}")
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
  public async deleteComment(
    @Request() req: ExpressRequest,
    @Path() commentId: string,
  ) {
    const userId = req.user?.id as string;
    const io = getIOInstance(req);
    return GroupChatService.deleteComment(commentId, userId, io);
  }

  /**
   * Get a specific group with messages
   */
  @Get("/{groupId}")
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
  public async getGroupWithMessages(
    @Request() req: ExpressRequest,
    @Path() groupId: string,
  ) {
    const userId = req.user?.id as string;
    return GroupChatService.getGroupWithMessages(groupId, userId);
  }
}
