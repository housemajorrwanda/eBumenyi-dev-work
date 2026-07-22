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
  Query,
  Put,
} from "tsoa";
import { Request as ExpressRequest } from "express";
import { CommunityService } from "../services/communityService";
import { ConversationMuteService } from "../services/conversationMuteService";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";

function getIOInstance(req: ExpressRequest): any {
  return (req as any).app?.get?.("io");
}

@Route("/api/communities")
@Tags("Community")
@Security("jwt")
export class CommunityController {
  /**
   * Create a new community
   */
  @Post("/")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async createCommunity(
    @Request() req: ExpressRequest,
    @Body()
    body: {
      name: string;
      description?: string;
      photo?: string;
      isPublic?: boolean;
      participantIds?: string[];
    },
  ) {
    const createdById = req.user?.id as string;
    return CommunityService.createCommunity(
      body.name,
      createdById,
      body.description,
      body.photo,
      body.isPublic || false,
      body.participantIds,
    );
  }

  /**
   * Get all communities for the current user
   */
  @Get("/")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async getUserCommunities(@Request() req: ExpressRequest) {
    const userId = req.user?.id as string;
    return CommunityService.getUserCommunities(userId);
  }

  /**
   * Get public communities (discover)
   */
  @Get("/public")
  @Middlewares(loggerMiddleware)
  public async getPublicCommunities(
    @Query() limit: number = 20,
    @Query() offset: number = 0,
  ) {
    return CommunityService.getPublicCommunities(limit, offset);
  }

  /**
   * Create a post in the community
   */
  @Post("/{communityId}/posts")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async createPost(
    @Request() req: ExpressRequest,
    @Path() communityId: string,
    @Body()
    body: {
      title: string;
      content: string;
      photo?: string;
      attachments?: string;
    },
  ) {
    const userId = req.user?.id as string;
    const io = getIOInstance(req);
    return CommunityService.createPost(
      communityId,
      userId,
      body.title,
      body.content,
      body.photo,
      io,
      body.attachments,
    );
  }

  /**
   * Add a comment to a post
   */
  @Post("/{communityId}/posts/{postId}/comments")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async addComment(
    @Request() req: ExpressRequest,
    @Path() postId: string,
    @Body() body: { text: string; parentId?: string },
  ) {
    const userId = req.user?.id as string;
    const io = getIOInstance(req);
    return CommunityService.addComment(
      postId,
      userId,
      body.text,
      body.parentId,
      io,
    );
  }

  /**
   * Toggle like on a post
   */
  @Post("/{communityId}/posts/{postId}/like")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async togglePostLike(
    @Request() req: ExpressRequest,
    @Path() postId: string,
  ) {
    const userId = req.user?.id as string;
    const io = getIOInstance(req);
    return CommunityService.togglePostLike(postId, userId, io);
  }

  /**
   * Edit a post
   */
  @Put("/{communityId}/posts/{postId}")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async editPost(
    @Request() req: ExpressRequest,
    @Path() postId: string,
    @Body() body: { title: string; content: string },
  ) {
    const userId = req.user?.id as string;
    const io = getIOInstance(req);
    return CommunityService.editPost(
      postId,
      userId,
      body.title,
      body.content,
      io,
    );
  }

  /**
   * Delete a post
   */
  @Delete("/{communityId}/posts/{postId}")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async deletePost(
    @Request() req: ExpressRequest,
    @Path() postId: string,
  ) {
    const userId = req.user?.id as string;
    const io = getIOInstance(req);
    return CommunityService.deletePost(postId, userId, io);
  }

  /**
   * Update community info
   */
  @Put("/{communityId}")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async updateCommunity(
    @Request() req: ExpressRequest,
    @Path() communityId: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      photo?: string;
      isPublic?: boolean;
    },
  ) {
    const userId = req.user?.id as string;
    return CommunityService.updateCommunity(communityId, userId, body);
  }

  /**
   * Mute or unmute a community for the current user
   */
  @Put("/{communityId}/mute")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async muteCommunity(
    @Request() req: ExpressRequest,
    @Path() communityId: string,
    @Body() body: { muted: boolean },
  ) {
    const userId = req.user?.id as string;
    return ConversationMuteService.setMute(
      userId,
      "community",
      communityId,
      body.muted,
    );
  }

  /**
   * Delete community
   */
  @Delete("/{communityId}")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async deleteCommunity(
    @Request() req: ExpressRequest,
    @Path() communityId: string,
  ) {
    const userId = req.user?.id as string;
    return CommunityService.deleteCommunity(communityId, userId);
  }

  /**
   * Get unread comment counts for all communities
   */
  @Get("/unread/counts")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async getUnreadCounts(@Request() req: ExpressRequest) {
    const userId = req.user?.id as string;
    return CommunityService.getUnreadCounts(userId);
  }

  /**
   * Mark community as visited (updates lastVisitedAt for unread tracking)
   */
  @Post("/{communityId}/visit")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async markAsVisited(
    @Path() communityId: string,
    @Request() req: ExpressRequest,
  ) {
    const userId = req.user?.id as string;
    return CommunityService.markCommunityAsVisited(communityId, userId);
  }

  /**
   * Get unread comments for a specific community
   */
  @Get("/{communityId}/unread")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async getUnreadCommentsInCommunity(
    @Request() req: ExpressRequest,
    @Path() communityId: string,
  ) {
    const userId = req.user?.id as string;
    return CommunityService.getUnreadCommentsInCommunity(communityId, userId);
  }

  /**
   * Get comments for a post
   */
  @Get("/posts/{postId}/comments")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async getPostComments(@Path() postId: string) {
    const limit = 20;
    const offset = 0;
    return CommunityService.getComments(postId, limit, offset);
  }

  /**
   * Add a comment to a post
   */
  @Post("/posts/{postId}/comments")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async addPostComment(
    @Request() req: ExpressRequest,
    @Path() postId: string,
    @Body() body: { text: string; parentId?: string },
  ) {
    const userId = req.user?.id as string;
    const io = getIOInstance(req);
    return CommunityService.addComment(
      postId,
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
      roles.CEHO,
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
    return CommunityService.editComment(commentId, userId, body.text, io);
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
      roles.CEHO,
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
    return CommunityService.deleteComment(commentId, userId, io);
  }

  /**
   * Get community posts with pagination
   */
  @Get("/{communityId}/posts")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async getCommunityPosts(
    @Request() req: ExpressRequest,
    @Path() communityId: string,
    @Query() limit: number = 50,
    @Query() offset: number = 0,
  ) {
    const userId = req.user?.id as string;
    return CommunityService.getCommunityPosts(
      communityId,
      userId,
      limit,
      offset,
    );
  }

  /**
   * Search community posts by title/content, across full history
   * GET /communities/{communityId}/posts/search?q=&limit=20&offset=0
   */
  @Get("/{communityId}/posts/search")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async searchCommunityPosts(
    @Request() req: ExpressRequest,
    @Path() communityId: string,
    @Query() q: string,
    @Query() limit: number = 20,
    @Query() offset: number = 0,
  ) {
    const userId = req.user?.id as string;
    return CommunityService.searchCommunityPosts(
      communityId,
      userId,
      q,
      limit,
      offset,
    );
  }

  @Get("/saved")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async getSavedPosts(@Request() req: ExpressRequest) {
    const userId = req.user?.id as string;
    return CommunityService.getSavedPosts(userId);
  }

  /**
   * Get a specific community with posts
   */
  @Get("/{communityId}")
  @Middlewares(loggerMiddleware)
  public async getCommunityWithPosts(
    @Request() req: ExpressRequest,
    @Path() communityId: string,
  ) {
    const userId = req.user?.id as string;
    return CommunityService.getCommunityWithPosts(communityId, userId, 20, 0);
  }

  /**
   * Add a member to the community
   */
  @Post("/{communityId}/members")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async addMember(
    @Request() req: ExpressRequest,
    @Path() communityId: string,
    @Body() body: { userId: string },
  ) {
    const requesterId = req.user?.id as string;
    const io = getIOInstance(req);
    return CommunityService.addMember(
      communityId,
      body.userId,
      requesterId,
      io,
    );
  }

  /**
   * Remove a member from the community
   */
  @Delete("/{communityId}/members/{userId}")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async removeMember(
    @Request() req: ExpressRequest,
    @Path() communityId: string,
    @Path() userId: string,
  ) {
    const requesterId = req.user?.id as string;
    const io = getIOInstance(req);
    return CommunityService.removeMember(communityId, userId, requesterId, io);
  }

  @Post("/{communityId}/posts/{postId}/visit")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async markPostAsVisited(@Path() postId: string) {
    return CommunityService.incrementViewCount(postId);
  }

  @Post("/{communityId}/posts/{postId}/save")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async toggleSavePost(
    @Request() req: ExpressRequest,
    @Path() postId: string,
  ) {
    const userId = req.user?.id as string;
    return CommunityService.toggleSavePost(postId, userId);
  }

  @Post("/{communityId}/posts/{postId}/reshare")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.DEVELOPER,
    ),
  )
  public async resharePost(
    @Request() req: ExpressRequest,
    @Path() communityId: string,
    @Path() postId: string,
  ) {
    const userId = req.user?.id as string;
    const io = getIOInstance(req);
    return CommunityService.resharePost(postId, communityId, userId, io);
  }
}
