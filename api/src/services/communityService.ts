import { prisma } from "../utils/client";
import AppError from "../utils/error";
import { CacheService } from "./cacheService";
import { NotificationHelper } from "../utils/notificationHelper";

const communityMemberUserInclude = {
  user: {
    select: { id: true, fullNames: true, photo: true },
  },
} as const;

export class CommunityService {
  /**
   * Removes member rows whose user no longer exists.
   * Prevents Prisma inconsistent-result errors on member.user includes.
   */
  private static async pruneOrphanCommunityMembers(): Promise<void> {
    await prisma.$executeRaw`
      DELETE FROM community_members AS cm
      WHERE NOT EXISTS (
        SELECT 1 FROM "User" AS u WHERE u.id = cm."userId"
      )
    `;
  }

  /**
   * Create a new community
   */
  public static async createCommunity(
    name: string,
    createdById: string,
    description?: string,
    photo?: string,
    isPublic: boolean = false,
    participantIds?: string[],
  ) {
    // Create members list starting with creator as admin
    const membersToCreate = [
      {
        userId: createdById,
        role: "admin",
      },
    ];

    // Add additional participants if provided
    if (participantIds && participantIds.length > 0) {
      for (const participantId of participantIds) {
        // Don't add creator twice
        if (participantId !== createdById) {
          membersToCreate.push({
            userId: participantId,
            role: "member",
          });
        }
      }
    }

    const community = await prisma.community.create({
      data: {
        name,
        description,
        photo,
        isPublic,
        createdById,
        members: {
          create: membersToCreate,
        },
      },
      include: {
        creator: {
          select: { id: true, fullNames: true, photo: true },
        },
        members: {
          include: communityMemberUserInclude,
        },
      },
    });

    return community;
  }

  /**
   * Get all communities for a user
   */
  public static async getUserCommunities(userId: string) {
    await this.pruneOrphanCommunityMembers();

    const communities = await prisma.community.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        creator: {
          select: { id: true, fullNames: true, photo: true },
        },
        members: {
          include: communityMemberUserInclude,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return communities;
  }

  /**
   * Get public communities (discover)
   */
  public static async getPublicCommunities(limit = 20, offset = 0) {
    return await prisma.community.findMany({
      where: {
        isPublic: true,
      },
      include: {
        creator: {
          select: { id: true, fullNames: true, photo: true },
        },
        _count: {
          select: { members: true, posts: true },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get community with posts
   * Tries cache first (Redis), falls back to database
   * Auto-adds user as member if they're accessing a public community
   */
  public static async getCommunityWithPosts(
    communityId: string,
    userId: string,
    limit = 20,
    offset = 0,
  ) {
    await this.pruneOrphanCommunityMembers();

    const community = await prisma.community.findFirst({
      where: {
        id: communityId,
        OR: [{ isPublic: true }, { members: { some: { userId } } }],
      },
      include: {
        creator: {
          select: { id: true, fullNames: true, photo: true },
        },
        members: {
          include: communityMemberUserInclude,
        },
        _count: {
          select: { posts: true },
        },
      },
    });

    if (!community) {
      throw new AppError("Community not found", 404);
    }

    // Auto-add user to community if public and they're not already a member
    if (community.isPublic && userId) {
      const isAlreadyMember = community.members.some(
        (m) => m.userId === userId,
      );
      if (!isAlreadyMember) {
        await prisma.communityMember
          .create({
            data: {
              communityId,
              userId,
            },
          })
          .catch(() => {
            // Silently fail if member already exists (race condition)
          });
      }
    }

    let posts;
    const cache = CacheService.getInstance();

    // Try cache first if no offset (first page)
    if (offset === 0) {
      const cachedPosts = await cache.getMessages(
        communityId,
        "community",
        limit,
      );
      if (cachedPosts && cachedPosts.length > 0) {
        // Cache hit — but cache has no per-user likes data.
        // Run a lightweight DB query to merge the current user's like state.
        const cached = cachedPosts as { id: string }[];
        const postIds = cached.map((p) => p.id);
        const [userLikes, userSaved] = await Promise.all([
          prisma.communityPostLike.findMany({
            where: { postId: { in: postIds }, userId },
            select: { postId: true, id: true },
          }),
          prisma.savedCommunityPost.findMany({
            where: { postId: { in: postIds }, userId },
            select: { postId: true, id: true },
          }),
        ]);
        const likedMap = new Map(userLikes.map((l) => [l.postId, l.id]));
        const savedMap = new Map(userSaved.map((s) => [s.postId, s.id]));
        posts = cached.map((p) => ({
          ...p,
          likes: likedMap.has(p.id) ? [{ id: likedMap.get(p.id) }] : [],
          savedBy: savedMap.has(p.id) ? [{ id: savedMap.get(p.id) }] : [],
        }));
      } else {
        // Cache miss - fetch from database
        const dbPosts = await prisma.communityPost.findMany({
          where: { communityId, isDeleted: false },
          include: {
            author: {
              select: { id: true, fullNames: true, photo: true },
            },
            likes: {
              where: { userId },
              select: { id: true },
            },
            savedBy: {
              where: { userId },
              select: { id: true },
            },
            comments: {
              where: { parentId: null },
              include: {
                user: {
                  select: { id: true, fullNames: true, photo: true },
                },
                replies: {
                  include: {
                    user: {
                      select: { id: true, fullNames: true, photo: true },
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            timestamp: "desc",
          },
          take: limit,
          skip: offset,
        });

        posts = dbPosts.reverse();

        // Populate cache asynchronously (non-blocking)
        for (const post of dbPosts) {
          await cache
            .cacheMessage(
              communityId,
              {
                id: post.id,
                senderId: post.authorId,
                content: post.content,
                type: "post",
                attachments: post.photo || undefined,
                readCount: post.viewCount,
                likeCount: post.likeCount,
                isDeleted: post.isDeleted,
                editedAt: post.editedAt
                  ? post.editedAt.toISOString()
                  : undefined,
                timestamp: post.timestamp.getTime(),
              },
              "community",
            )
            .catch((err) => console.error("Cache population error:", err));
        }
      }
    } else {
      // Pagination - fetch older posts from database
      posts = await prisma.communityPost.findMany({
        where: { communityId, isDeleted: false },
        include: {
          author: {
            select: { id: true, fullNames: true, photo: true },
          },
          likes: {
            where: { userId },
            select: { id: true },
          },
          savedBy: {
            where: { userId },
            select: { id: true },
          },
          comments: {
            where: { parentId: null },
            include: {
              user: {
                select: { id: true, fullNames: true, photo: true },
              },
              replies: {
                include: {
                  user: {
                    select: { id: true, fullNames: true, photo: true },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          timestamp: "desc",
        },
        take: limit,
        skip: offset,
      });

      posts = posts.reverse();
    }

    return {
      community,
      posts,
    };
  }

  /**
   * Get community posts with pagination
   * Returns paginated posts for React Query infinite scroll
   */
  public static async getCommunityPosts(
    communityId: string,
    userId: string,
    limit = 50,
    offset = 0,
  ) {
    // Verify user has access to community (is member or community is public)
    const community = await prisma.community.findFirst({
      where: {
        id: communityId,
        OR: [{ isPublic: true }, { members: { some: { userId } } }],
      },
    });

    if (!community) {
      throw new AppError("Community not found or access denied", 404);
    }

    // Always fetch from database to ensure author data is included
    const dbPosts = await prisma.communityPost.findMany({
      where: { communityId, isDeleted: false },
      include: {
        author: {
          select: { id: true, fullNames: true, photo: true },
        },
        likes: {
          where: { userId },
          select: { id: true },
        },
        savedBy: {
          where: { userId },
          select: { id: true },
        },
        resharedFrom: {
          include: {
            author: { select: { id: true, fullNames: true, photo: true } },
          },
        },
        comments: {
          where: { parentId: null },
          include: {
            user: {
              select: { id: true, fullNames: true, photo: true },
            },
            replies: {
              include: {
                user: {
                  select: { id: true, fullNames: true, photo: true },
                },
              },
            },
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
      take: limit,
      skip: offset,
    });

    // Transform posts to include sender (author) info
    const posts = dbPosts.reverse().map((post) => ({
      ...post,
      sender: post.author,
      author: undefined, // Remove author field to avoid duplication
    }));

    // Cache posts asynchronously for first page (non-blocking)
    if (offset === 0) {
      const cache = CacheService.getInstance();
      for (const post of dbPosts) {
        await cache
          .cacheMessage(
            communityId,
            {
              id: post.id,
              senderId: post.authorId,
              content: post.content,
              type: "post",
              attachments: post.photo || undefined,
              readCount: post.viewCount,
              likeCount: post.likeCount,
              isDeleted: post.isDeleted,
              editedAt: post.editedAt ? post.editedAt.toISOString() : undefined,
              timestamp: post.timestamp.getTime(),
            },
            "community",
          )
          .catch((err) => console.error("Cache population error:", err));
      }
    }

    const total = await prisma.communityPost.count({
      where: { communityId, isDeleted: false },
    });

    return { data: posts, total };
  }

  /**
   * Create a community post
   * Caches post immediately after creation
   */
  public static async createPost(
    communityId: string,
    authorId: string,
    title: string,
    content: string,
    photo?: string,
    io?: any,
    attachments?: string,
  ) {
    // Verify author is community member
    const member = await prisma.communityMember.findFirst({
      where: {
        communityId,
        userId: authorId,
      },
    });

    if (!member) {
      throw new AppError("Unauthorized - not a community member", 403);
    }

    const post = await prisma.communityPost.create({
      data: {
        communityId,
        authorId,
        title,
        content,
        photo,
        attachments,
      },
      include: {
        author: {
          select: { id: true, fullNames: true, photo: true },
        },
      },
    });

    // Update lastPostId in community to track latest post for preview
    await prisma.community.update({
      where: { id: communityId },
      data: {
        lastPostId: post.id,
        updatedAt: new Date(), // Force timestamp update to invalidate cache
      },
    });

    // Cache post asynchronously
    const cache = CacheService.getInstance();
    await cache
      .cacheMessage(
        communityId,
        {
          id: post.id,
          senderId: post.authorId,
          content: post.content,
          type: "post",
          attachments: post.photo || undefined,
          readCount: post.viewCount,
          likeCount: post.likeCount,
          isDeleted: post.isDeleted,
          editedAt: post.editedAt ? post.editedAt.toISOString() : undefined,
          timestamp: post.timestamp.getTime(),
        },
        "community",
      )
      .catch((err) => {
        console.error("Cache error on post create:", err);
      });

    // Notify other members
    if (io) {
      const members = await prisma.communityMember.findMany({
        where: { communityId },
        select: { userId: true },
      });
      const targets = members
        .map((m) => m.userId)
        .filter((id) => id && id !== authorId);
      if (targets.length) {
        NotificationHelper.sendToUsers(
          io,
          targets,
          "New community post",
          title || "New post",
          "info",
          `/community/${communityId}`,
          "community",
          communityId,
          { postId: post.id },
          30_000,
          `community:post:${communityId}`,
        ).catch((err) =>
          console.warn("[CommunityService] post notify failed", err),
        );
      }
    }

    // Broadcast post:created to community room
    if (io) {
      try {
        const postPayload = { ...post, sender: post.author, author: undefined };
        io.of("/community")
          .to(`community:${communityId}`)
          .emit("post:created", postPayload);
        console.log(
          `[CommunityService] 📢 Broadcasted post:created to community:${communityId}`,
        );
      } catch (err) {
        console.warn("[CommunityService] post:created broadcast failed", err);
      }

      // Notify every member's personal room so their conversation lists
      // update in real-time regardless of which screen they're on
      try {
        const allMembers = await prisma.communityMember.findMany({
          where: { communityId },
          select: { userId: true },
        });
        const conversationUpdatedPayload = {
          type: "community",
          chatId: communityId,
          lastMessage: {
            id: post.id,
            content: post.content,
            type: "post",
            senderId: post.authorId,
            timestamp: post.timestamp,
          },
          updatedAt: new Date(),
        };
        allMembers.forEach(({ userId }) => {
          io.to(`user:${userId}`).emit(
            "conversation:updated",
            conversationUpdatedPayload,
          );
        });
        console.log(
          `[CommunityService] 📢 Broadcasted conversation:updated to ${allMembers.length} members`,
        );
      } catch (err) {
        console.warn(
          "[CommunityService] conversation:updated broadcast failed",
          err,
        );
      }
    }

    // Return post with sender info for consistency with frontend IMessage type
    return {
      ...post,
      sender: post.author,
      author: undefined,
    };
  }

  /**
   * Add member to community
   */
  public static async addMember(
    communityId: string,
    userIdToAdd: string,
    addedById: string,
    io?: any,
  ) {
    const community = await prisma.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      throw new AppError("Community not found", 404);
    }

    // Check if requester is admin
    const adder = await prisma.communityMember.findFirst({
      where: {
        communityId,
        userId: addedById,
      },
    });

    if (!adder || adder.role !== "admin") {
      throw new AppError("Unauthorized - only admins can add members", 403);
    }

    // Check if user already a member
    const existing = await prisma.communityMember.findFirst({
      where: {
        communityId,
        userId: userIdToAdd,
      },
    });

    if (existing) {
      throw new AppError("User already in community", 400);
    }

    const member = await prisma.communityMember.create({
      data: {
        communityId,
        userId: userIdToAdd,
      },
      include: {
        user: {
          select: { id: true, fullNames: true, photo: true },
        },
      },
    });

    if (io) {
      const adminIds = await prisma.communityMember.findMany({
        where: { communityId, role: "admin" },
        select: { userId: true },
      });
      const targets = Array.from(
        new Set([userIdToAdd, ...adminIds.map((a) => a.userId)]).values(),
      ).filter((id) => id !== addedById);

      NotificationHelper.sendToUsers(
        io,
        targets,
        "Community membership update",
        `${member.user?.fullNames || "A user"} joined the community.`,
        "info",
        `/community/${communityId}`,
        "community",
        communityId,
        { addedUserId: userIdToAdd },
        30_000,
        `community:member:${communityId}`,
      ).catch((err) =>
        console.warn("[CommunityService] add member notification failed", err),
      );
    }

    return member;
  }

  /**
   * Remove member from community
   */
  public static async removeMember(
    communityId: string,
    userIdToRemove: string,
    removedById: string,
    io?: any,
  ) {
    const community = await prisma.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      throw new AppError("Community not found", 404);
    }

    // Check if requester is admin OR if they're removing themselves (leaving)
    const remover = await prisma.communityMember.findFirst({
      where: {
        communityId,
        userId: removedById,
      },
    });

    const isSelfRemoval = removedById === userIdToRemove;

    if (!remover) {
      throw new AppError("You are not a member of this community", 403);
    }

    // Prevent creator from leaving - they should delete the community instead
    if (isSelfRemoval && community.createdById === userIdToRemove) {
      throw new AppError(
        "Creator cannot leave community. Delete the community instead.",
        403,
      );
    }

    if (!isSelfRemoval && remover.role !== "admin") {
      throw new AppError(
        "Unauthorized - only admins can remove other members",
        403,
      );
    }

    await prisma.communityMember.deleteMany({
      where: {
        communityId,
        userId: userIdToRemove,
      },
    });

    if (io) {
      const adminIds = await prisma.communityMember.findMany({
        where: { communityId, role: "admin" },
        select: { userId: true },
      });
      const targets = Array.from(
        new Set([userIdToRemove, ...adminIds.map((a) => a.userId)]).values(),
      ).filter((id) => id !== removedById);

      NotificationHelper.sendToUsers(
        io,
        targets,
        "Community membership update",
        `A member was removed from the community.`,
        "warning",
        `/community/${communityId}`,
        "community",
        communityId,
        { removedUserId: userIdToRemove },
        30_000,
        `community:member:${communityId}`,
      ).catch((err) =>
        console.warn(
          "[CommunityService] remove member notification failed",
          err,
        ),
      );
    }

    return { success: true, userId: userIdToRemove };
  }

  /**
   * Toggle like on a post
   * Uses Redis INCR for fast async counting
   * Actual like is stored in database, count is updated asynchronously
   */
  public static async togglePostLike(postId: string, userId: string, io?: any) {
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new AppError("Post not found", 404);
    }

    const existingLike = await prisma.communityPostLike.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });

    if (existingLike) {
      await prisma.communityPostLike.delete({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
      });
    } else {
      await prisma.communityPostLike.create({
        data: {
          postId,
          userId,
        },
      });
    }

    // Use a fresh DB count — authoritative, survives Redis restarts and syncs
    const likeCount = await prisma.communityPostLike.count({
      where: { postId },
    });

    // Write back to DB so subsequent fetches return the correct count
    await prisma.communityPost.update({
      where: { id: postId },
      data: { likeCount },
    });

    // Update Redis cache asynchronously
    const cache = CacheService.getInstance();
    await cache
      .updateMessage(post.communityId, postId, { likeCount }, "community")
      .catch((err) => console.error("Cache update error:", err));

    // Broadcast post:liked to community room
    if (io && post) {
      try {
        io.of("/community")
          .to(`community:${post.communityId}`)
          .emit("post:liked", {
            postId,
            messageId: postId,
            chatId: post.communityId, // needed so handleMessageLiked can match communityId
            userId,
            liked: !existingLike,
            likeCount,
            userLiked: !existingLike,
          });
        console.log(
          `[CommunityService] 📢 Broadcasted post:liked likeCount=${likeCount} to community:${post.communityId}`,
        );
      } catch (err) {
        console.warn("[CommunityService] post:liked broadcast failed", err);
      }
    }

    return { liked: !existingLike, likeCount };
  }

  /**
   * Add comment to a post
   */
  public static async addComment(
    postId: string,
    userId: string,
    text: string,
    parentId?: string,
    io?: any,
  ) {
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new AppError("Post not found", 404);
    }

    if (parentId) {
      const parent = await prisma.communityPostComment.findUnique({
        where: { id: parentId },
      });

      if (!parent) {
        throw new AppError("Parent comment not found", 404);
      }
    }

    const comment = await prisma.communityPostComment.create({
      data: {
        postId,
        userId,
        text,
        parentId,
      },
      include: {
        user: {
          select: { id: true, fullNames: true, photo: true },
        },
      },
    });

    // Update denormalized commentCount — count ALL comments (top-level + replies)
    const commentCount = await prisma.communityPostComment.count({
      where: { postId },
    });

    await prisma.communityPost.update({
      where: { id: postId },
      data: { commentCount },
    });

    if (io) {
      const members = await prisma.communityMember.findMany({
        where: { communityId: post.communityId },
        select: { userId: true },
      });
      const targets = members
        .map((m) => m.userId)
        .filter((id) => id && id !== userId);
      if (targets.length) {
        NotificationHelper.sendToUsers(
          io,
          targets,
          "New comment",
          text.slice(0, 120),
          "info",
          `/community/${post.communityId}`,
          "community",
          post.communityId,
          { postId },
          30_000,
          `community:comment:${postId}`,
        ).catch((err) =>
          console.warn("[CommunityService] comment notify failed", err),
        );
      }
    }

    // Broadcast comment:created to community room (include updated commentCount)
    if (io && post) {
      try {
        io.of("/community")
          .to(`community:${post.communityId}`)
          .emit("comment:created", { ...comment, postId, commentCount });
        console.log(
          `[CommunityService] 📢 Broadcasted comment:created to community:${post.communityId}`,
        );
      } catch (err) {
        console.warn(
          "[CommunityService] comment:created broadcast failed",
          err,
        );
      }
    }

    return { ...comment, commentCount };
  }

  /**
   * Get comments for a post with pagination
   * Returns top-level comments with ALL their replies (nested or not) in a flat array
   */
  public static async getComments(
    postId: string,
    limit: number = 10,
    offset: number = 0,
  ) {
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new AppError("Post not found", 404);
    }

    // Get top-level comments
    const topLevelComments = await prisma.communityPostComment.findMany({
      where: {
        postId,
        parentId: null, // Only get top-level comments
      },
      include: {
        user: {
          select: { id: true, fullNames: true, photo: true },
        },
      },
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    });

    // Get ALL replies for these top-level comments (regardless of nesting level)
    // This includes replies to comments AND replies to replies
    const topLevelCommentIds = topLevelComments.map((c) => c.id);

    if (topLevelCommentIds.length > 0) {
      // Fetch all replies that belong to this comment thread
      // We need to recursively find all descendants
      const allReplies = await prisma.communityPostComment.findMany({
        where: {
          postId,
          parentId: { not: null }, // All replies (not top-level)
        },
        include: {
          user: {
            select: { id: true, fullNames: true, photo: true },
          },
        },
        orderBy: { timestamp: "asc" },
      });

      // Build a map to track which replies belong to which top-level comment
      // We need to traverse the parent chain to find the root comment
      const replyMap = new Map<string, any[]>();

      // Helper function to find the root parent (top-level comment)
      const findRootParent = (
        reply: any,
        allRepliesMap: Map<string, any>,
      ): string => {
        if (topLevelCommentIds.includes(reply.parentId)) {
          return reply.parentId; // Parent is a top-level comment
        }
        const parent = allRepliesMap.get(reply.parentId);
        if (!parent) return reply.parentId; // Fallback
        return findRootParent(parent, allRepliesMap);
      };

      // Create a map for quick lookup
      const allRepliesMap = new Map(allReplies.map((r) => [r.id, r]));

      // Group replies by their root parent
      for (const reply of allReplies) {
        const rootParentId = findRootParent(reply, allRepliesMap);
        if (!replyMap.has(rootParentId)) {
          replyMap.set(rootParentId, []);
        }
        replyMap.get(rootParentId)!.push(reply);
      }

      // Attach replies to their top-level comments
      const comments = topLevelComments.map((comment) => ({
        ...comment,
        replies: replyMap.get(comment.id) || [],
      }));

      const total = await prisma.communityPostComment.count({
        where: { postId },
      });

      return {
        comments,
        total,
        limit,
        offset,
      };
    }

    const total = await prisma.communityPostComment.count({
      where: { postId },
    });

    return {
      comments: topLevelComments.map((c) => ({ ...c, replies: [] })),
      total,
      limit,
      offset,
    };
  }

  /**
   * Edit a comment
   */
  public static async editComment(
    commentId: string,
    userId: string,
    text: string,
    io?: any,
  ) {
    const comment = await prisma.communityPostComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new AppError("Comment not found", 404);
    }

    if (comment.userId !== userId) {
      throw new AppError("Unauthorized - only comment author can edit", 403);
    }

    const updated = await prisma.communityPostComment.update({
      where: { id: commentId },
      data: {
        text,
      },
      include: {
        user: {
          select: { id: true, fullNames: true, photo: true },
        },
      },
    });

    // Broadcast comment:edited to community room
    if (io) {
      try {
        const parentPost = await prisma.communityPost.findUnique({
          where: { id: comment.postId },
          select: { communityId: true },
        });
        if (parentPost) {
          io.of("/community")
            .to(`community:${parentPost.communityId}`)
            .emit("comment:edited", updated);
          console.log(
            `[CommunityService] 📢 Broadcasted comment:edited to community:${parentPost.communityId}`,
          );
        }
      } catch (err) {
        console.warn("[CommunityService] comment:edited broadcast failed", err);
      }
    }

    return updated;
  }

  /**
   * Delete a comment
   */
  public static async deleteComment(
    commentId: string,
    userId: string,
    io?: any,
  ) {
    const comment = await prisma.communityPostComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new AppError("Comment not found", 404);
    }

    if (comment.userId !== userId) {
      throw new AppError("Unauthorized - only comment author can delete", 403);
    }

    await prisma.communityPostComment.delete({
      where: { id: commentId },
    });

    // Update denormalized commentCount — count ALL comments (top-level + replies)
    const commentCount = await prisma.communityPostComment.count({
      where: { postId: comment.postId },
    });

    await prisma.communityPost.update({
      where: { id: comment.postId },
      data: { commentCount },
    });

    // Broadcast comment:deleted to community room (include updated commentCount)
    if (io) {
      try {
        const parentPost = await prisma.communityPost.findUnique({
          where: { id: comment.postId },
          select: { communityId: true },
        });
        if (parentPost) {
          io.of("/community")
            .to(`community:${parentPost.communityId}`)
            .emit("comment:deleted", {
              commentId,
              postId: comment.postId,
              commentCount,
            });
          console.log(
            `[CommunityService] 📢 Broadcasted comment:deleted to community:${parentPost.communityId}`,
          );
        }
      } catch (err) {
        console.warn(
          "[CommunityService] comment:deleted broadcast failed",
          err,
        );
      }
    }

    return { success: true, commentId };
  }

  /**
   * Edit a post

   * Updates cache with new content and editedAt timestamp
   */
  public static async editPost(
    postId: string,
    userId: string,
    title: string,
    content: string,
    io?: any,
  ) {
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new AppError("Post not found", 404);
    }

    if (post.authorId !== userId) {
      throw new AppError("Unauthorized - can only edit own posts", 403);
    }

    const editedAt = new Date();
    const updatedPost = await prisma.communityPost.update({
      where: { id: postId },
      data: {
        title,
        content,
        editedAt,
      },
      include: {
        author: {
          select: { id: true, fullNames: true, photo: true },
        },
      },
    });

    // Update cache asynchronously
    const cache = CacheService.getInstance();
    await cache
      .updateMessage(
        post.communityId,
        postId,
        { content, editedAt: editedAt.toISOString() },
        "community",
      )
      .catch((err) => console.error("Cache update error:", err));

    // Broadcast post:edited to community room
    if (io) {
      try {
        io.of("/community")
          .to(`community:${post.communityId}`)
          .emit("post:edited", updatedPost);
        console.log(
          `[CommunityService] 📢 Broadcasted post:edited to community:${post.communityId}`,
        );
      } catch (err) {
        console.warn("[CommunityService] post:edited broadcast failed", err);
      }
    }

    return updatedPost;
  }

  /**
   * Delete a post
   * Updates cache to mark post as deleted
   */
  public static async deletePost(postId: string, userId: string, io?: any) {
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new AppError("Post not found", 404);
    }

    if (post.authorId !== userId) {
      throw new AppError("Unauthorized - can only delete own posts", 403);
    }

    await prisma.communityPost.update({
      where: { id: postId },
      data: { isDeleted: true, content: "[Deleted]" },
    });

    // Update cache asynchronously
    const cache = CacheService.getInstance();
    await cache
      .updateMessage(
        post.communityId,
        postId,
        { isDeleted: true, content: "[Deleted]" },
        "community",
      )
      .catch((err) => console.error("Cache update error:", err));

    // Broadcast post:deleted to community room
    if (io) {
      try {
        io.of("/community")
          .to(`community:${post.communityId}`)
          .emit("post:deleted", { postId });
        console.log(
          `[CommunityService] 📢 Broadcasted post:deleted to community:${post.communityId}`,
        );
      } catch (err) {
        console.warn("[CommunityService] post:deleted broadcast failed", err);
      }
    }

    return { success: true, postId };
  }

  /**
   * Increment view count for a post
   */
  public static async incrementViewCount(postId: string) {
    return await prisma.communityPost.update({
      where: { id: postId },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Update community info
   */
  public static async updateCommunity(
    communityId: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
      photo?: string;
      isPublic?: boolean;
    },
  ) {
    const community = await prisma.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      throw new AppError("Community not found", 404);
    }

    // Only creator can update community
    if (community.createdById !== userId) {
      throw new AppError("Only creator can update community", 403);
    }

    return await prisma.community.update({
      where: { id: communityId },
      data,
      include: {
        creator: {
          select: { id: true, fullNames: true, photo: true },
        },
        members: {
          include: communityMemberUserInclude,
        },
      },
    });
  }

  /**
   * Delete community
   */
  public static async deleteCommunity(communityId: string, userId: string) {
    const community = await prisma.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      throw new AppError("Community not found", 404);
    }

    if (community.createdById !== userId) {
      throw new AppError("Only creator can delete community", 403);
    }

    return await prisma.$transaction(async (tx) => {
      const posts = await tx.communityPost.findMany({
        where: { communityId },
        select: { id: true },
      });
      const postIds = posts.map((p) => p.id);

      // Clear lastPostId to break the circular Community <-> CommunityPost reference
      await tx.community.update({
        where: { id: communityId },
        data: { lastPostId: null },
      });

      if (postIds.length > 0) {
        // Null-out resharedFromId on any post that reshared a post from this community
        // (self-referencing relation uses Restrict so must be cleared before deletion)
        await tx.communityPost.updateMany({
          where: { resharedFromId: { in: postIds } },
          data: { resharedFromId: null },
        });

        // Break comment reply chains so the whole batch can be deleted at once
        // (parent -> child self-reference also uses Restrict)
        await tx.communityPostComment.updateMany({
          where: { postId: { in: postIds }, parentId: { not: null } },
          data: { parentId: null },
        });

        // Delete all comments (likes and saved posts cascade automatically)
        await tx.communityPostComment.deleteMany({
          where: { postId: { in: postIds } },
        });

        // Delete all posts (likes and saved posts cascade automatically)
        await tx.communityPost.deleteMany({
          where: { communityId },
        });
      }

      // Delete community — members cascade automatically (onDelete: Cascade)
      return await tx.community.delete({
        where: { id: communityId },
      });
    });
  }

  /**
   * Get unread post comments for all communities for a user
   * Only counts comments created after user's last visit to each community
   */
  public static async getUnreadCounts(userId: string) {
    const memberships = await prisma.communityMember.findMany({
      where: {
        userId,
      },
      select: {
        communityId: true,
        lastVisitedAt: true,
        community: {
          select: {
            id: true,
            posts: {
              select: {
                id: true,
                timestamp: true,
                comments: {
                  where: {
                    userId: {
                      not: userId,
                    },
                  },
                  select: {
                    id: true,
                    timestamp: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const result = memberships.map((membership) => {
      const lastVisited = membership.lastVisitedAt;

      // Count comments created after last visit
      // If never visited, count all comments from others
      const unreadCommentCount = membership.community.posts.reduce(
        (sum, post) => {
          const newComments = post.comments.filter(
            (comment) => !lastVisited || comment.timestamp > lastVisited,
          );
          return sum + newComments.length;
        },
        0,
      );

      return {
        communityId: membership.communityId,
        unreadCommentCount,
      };
    });

    const totalUnread = result.reduce(
      (sum, community) => sum + community.unreadCommentCount,
      0,
    );

    return {
      total: totalUnread,
      byCommunity: result,
    };
  }

  /**
   * Get unread comments for a specific community
   */
  public static async getUnreadCommentsInCommunity(
    communityId: string,
    userId: string,
  ) {
    const community = await prisma.community.findFirst({
      where: {
        id: communityId,
        members: {
          some: { userId },
        },
      },
    });

    if (!community) {
      throw new AppError("Community not found or unauthorized", 404);
    }

    const unreadComments = await prisma.communityPostComment.findMany({
      where: {
        post: {
          communityId,
        },
        userId: {
          not: userId,
        },
      },
      include: {
        user: {
          select: { id: true, fullNames: true, photo: true },
        },
        post: {
          select: { id: true, title: true },
        },
      },
    });

    return {
      communityId,
      unreadCommentCount: unreadComments.length,
      comments: unreadComments,
    };
  }

  /**
   * Mark community as visited by user
   * Updates lastVisitedAt timestamp to current time
   * This is used to calculate unread counts
   */
  public static async markCommunityAsVisited(
    communityId: string,
    userId: string,
  ) {
    const membership = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new AppError("User is not a member of this community", 403);
    }

    const visitedAt = new Date();

    await prisma.communityMember.update({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },
      data: {
        lastVisitedAt: visitedAt,
      },
    });

    return { success: true, communityId, visitedAt };
  }

  public static async toggleSavePost(postId: string, userId: string) {
    const existing = await prisma.savedCommunityPost.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existing) {
      await prisma.savedCommunityPost.delete({
        where: { userId_postId: { userId, postId } },
      });
      await prisma.communityPost.update({
        where: { id: postId },
        data: { saveCount: { decrement: 1 } },
      });
      return { saved: false };
    } else {
      await prisma.savedCommunityPost.create({ data: { userId, postId } });
      await prisma.communityPost.update({
        where: { id: postId },
        data: { saveCount: { increment: 1 } },
      });
      return { saved: true };
    }
  }

  public static async getSavedPosts(userId: string) {
    const saved = await prisma.savedCommunityPost.findMany({
      where: { userId },
      include: {
        post: {
          include: {
            author: { select: { id: true, fullNames: true, photo: true } },
            community: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { savedAt: "desc" },
    });
    return {
      message: "Saved posts fetched",
      statusCode: 200,
      data: saved.map((s) => s.post).filter((p) => p && !p.isDeleted),
    };
  }

  public static async resharePost(
    postId: string,
    communityId: string,
    userId: string,
    io?: any,
  ) {
    const original = await prisma.communityPost.findUnique({
      where: { id: postId },
      include: { author: { select: { id: true, fullNames: true, photo: true } } },
    });
    if (!original) throw new AppError("Ubutumwa butabonetse", 404);

    const member = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (!member) throw new AppError("Ntabwo uri umunyamuryango", 403);

    const reshare = await prisma.communityPost.create({
      data: {
        communityId,
        authorId: userId,
        title: original.title,
        // content is intentionally left blank for reshares — the original content/media
        // is accessed via the resharedFrom relation so the card can render it directly.
        content: "",
        photo: original.photo,
        attachments: original.attachments, // carry over original media attachment URL
        resharedFromId: postId,
      },
      include: {
        author: { select: { id: true, fullNames: true, photo: true } },
        resharedFrom: {
          include: {
            author: { select: { id: true, fullNames: true, photo: true } },
          },
        },
      },
    });

    await prisma.communityPost.update({
      where: { id: postId },
      data: { reshareCount: { increment: 1 } },
    });

    if (io) {
      io.of("/community")
        .to(`community:${communityId}`)
        .emit("post:created", {
          ...reshare,
          sender: reshare.author,
        });
    }

    return { message: "Byakopiwe neza", statusCode: 201, data: reshare };
  }
}
