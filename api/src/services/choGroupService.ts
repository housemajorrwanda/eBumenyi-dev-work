import { RoleType } from "@prisma/client";
import { prisma } from "../utils/client";
import AppError from "../utils/error";

export class CHOGroupService {
  // ─── Admin: promote CHW → CHO ────────────────────────────────────────────────

  static async promoteToCHO(userId: string, groupName?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: true, student: true },
    });
    if (!user) throw new AppError("User not found", 404);
    if (!user.student) throw new AppError("User has no student record", 404);

    if (user.userRoles.some((r) => r.name === RoleType.CHO))
      throw new AppError("User is already a CHO", 409);

    const existingGroup = await prisma.cHOGroup.findUnique({
      where: { choId: user.student.id },
    });
    if (existingGroup) throw new AppError("This student already leads a group", 409);

    return prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: {
          userId,
          name: { in: [RoleType.TRAINEE, RoleType.TESTER] },
        },
      });
      await tx.userRole.create({ data: { userId, name: RoleType.CHO } });
      await tx.student.update({
        where: { id: user.student!.id },
        data: { role: RoleType.CHO },
      });

      const name = groupName ?? `${user.fullNames}'s Group`;

      const groupChat = await tx.groupChat.create({
        data: {
          name,
          createdById: userId,
          participants: {
            create: [{ userId, role: "admin" }],
          },
        },
      });

      const group = await tx.cHOGroup.create({
        data: { name, choId: user.student!.id, sectors: user.sector ? [user.sector] : [], groupChatId: groupChat.id },
        include: {
          cho: {
            include: {
              user: { select: { id: true, fullNames: true, photo: true, phoneNumber: true, district: true, sector: true } },
            },
          },
        },
      });

      return { user: { id: user.id, fullNames: user.fullNames }, group };
    });
  }

  // ─── Admin: demote CHO → CHW, transfer group to new CHO ─────────────────────

  static async demoteToCHW(userId: string, newChoStudentId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: true, student: true },
    });
    if (!user) throw new AppError("User not found", 404);
    if (!user.student) throw new AppError("User has no student record", 404);

    if (!user.userRoles.some((r) => r.name === RoleType.CHO))
      throw new AppError("User is not a CHO", 400);

    if (newChoStudentId === user.student.id)
      throw new AppError("New CHO cannot be the same as the demoted CHO", 400);

    const group = await prisma.cHOGroup.findUnique({
      where: { choId: user.student.id },
    });
    if (!group) throw new AppError("This CHO does not lead any group", 404);

    const newCHOStudent = await prisma.student.findUnique({
      where: { id: newChoStudentId },
      include: { user: { include: { userRoles: true } }, ledGroup: true },
    });
    if (!newCHOStudent) throw new AppError("New CHO student not found", 404);
    if (newCHOStudent.ledGroup)
      throw new AppError("The selected student already leads another group", 409);

    return prisma.$transaction(async (tx) => {
      // Transfer group ownership
      const updatedGroup = await tx.cHOGroup.update({
        where: { id: group.id },
        data: { choId: newChoStudentId },
        include: {
          cho: {
            include: {
              user: { select: { id: true, fullNames: true, photo: true, phoneNumber: true } },
            },
          },
        },
      });

      // Remove CHO role and revert student role
      await tx.userRole.deleteMany({ where: { userId, name: RoleType.CHO } });
      await tx.student.update({
        where: { id: user.student!.id },
        data: { role: RoleType.TRAINEE },
      });

      // Ensure new leader has CHO role
      const newAlreadyCHO = newCHOStudent.user.userRoles.some((r) => r.name === RoleType.CHO);
      if (!newAlreadyCHO) {
        await tx.userRole.create({ data: { userId: newCHOStudent.userId, name: RoleType.CHO } });
        await tx.student.update({
          where: { id: newChoStudentId },
          data: { role: RoleType.CHO },
        });
      }

      // Sync GroupChat: promote new CHO to admin, downgrade old CHO to member
      if (group.groupChatId) {
        const existing = await tx.groupChatParticipant.findFirst({
          where: { groupId: group.groupChatId, userId: newCHOStudent.userId },
        });
        if (!existing) {
          await tx.groupChatParticipant.create({
            data: { groupId: group.groupChatId, userId: newCHOStudent.userId, role: "admin" },
          });
        } else {
          await tx.groupChatParticipant.update({
            where: { id: existing.id },
            data: { role: "admin" },
          });
        }
        await tx.groupChatParticipant.updateMany({
          where: { groupId: group.groupChatId, userId },
          data: { role: "member" },
        });
      }

      return {
        demotedUser: { id: user.id, fullNames: user.fullNames },
        newCHO: { id: newCHOStudent.user.id, fullNames: newCHOStudent.user.fullNames },
        group: updatedGroup,
      };
    });
  }

  // ─── Admin: create a group and assign a CHO ──────────────────────────────────

  static async createGroup(data: {
    name: string;
    choStudentId: string;
    sectors?: string[];
    cells?: string[];
    villages?: string[];
    description?: string;
  }) {
    const cho = await prisma.student.findUnique({
      where: { id: data.choStudentId },
      include: { user: { include: { userRoles: true } } },
    });
    if (!cho) throw new AppError("CHO student not found", 404);

    const isCHO = cho.user.userRoles.some((r) => r.name === "CHO");
    if (!isCHO)
      throw new AppError("The selected student does not have the CHO role", 400);

    const existing = await prisma.cHOGroup.findUnique({ where: { choId: data.choStudentId } });
    if (existing) throw new AppError("This CHO already leads a group", 409);

    return prisma.$transaction(async (tx) => {
      const groupChat = await tx.groupChat.create({
        data: {
          name: data.name,
          createdById: cho.userId,
          participants: {
            create: [{ userId: cho.userId, role: "admin" }],
          },
        },
      });

      return tx.cHOGroup.create({
        data: {
          name: data.name,
          choId: data.choStudentId,
          sectors: data.sectors ?? [],
          cells: data.cells ?? [],
          villages: data.villages ?? [],
          description: data.description,
          groupChatId: groupChat.id,
        },
        include: { cho: { include: { user: true } } },
      });
    });
  }

  // ─── Admin: list all groups ──────────────────────────────────────────────────

  static async getAllGroups(limit = 20, offset = 0) {
    const [groups, total] = await Promise.all([
      prisma.cHOGroup.findMany({
        skip: offset,
        take: limit,
        include: {
          cho: {
            include: {
              user: { select: { id: true, fullNames: true, photo: true, phoneNumber: true } },
            },
          },
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.cHOGroup.count(),
    ]);
    return { groups, total };
  }

  // ─── Admin: get a specific group by ID ───────────────────────────────────────

  static async getGroupById(groupId: string) {
    const group = await prisma.cHOGroup.findUnique({
      where: { id: groupId },
      include: {
        cho: {
          include: {
            user: { select: { id: true, fullNames: true, photo: true, phoneNumber: true, district: true, sector: true } },
          },
        },
        members: {
          include: {
            student: {
              include: {
                user: { select: { id: true, fullNames: true, photo: true, phoneNumber: true, district: true, sector: true } },
              },
            },
          },
        },
        _count: { select: { members: true } },
      },
    });
    if (!group) throw new AppError("Group not found", 404);
    return group;
  }

  // ─── Admin: add a CHW directly to a group ────────────────────────────────────

  static async addMemberByAdmin(groupId: string, studentId: string) {
    const [group, student] = await Promise.all([
      prisma.cHOGroup.findUnique({ where: { id: groupId } }),
      prisma.student.findUnique({
        where: { id: studentId },
        include: { groupMembership: true },
      }),
    ]);

    if (!group) throw new AppError("Group not found", 404);
    if (!student) throw new AppError("Student not found", 404);
    if (student.groupMembership)
      throw new AppError("Student already belongs to a group", 409);
    if (group.choId === studentId)
      throw new AppError("CHO cannot be added as a regular member", 400);

    return prisma.$transaction(async (tx) => {
      const member = await tx.cHOGroupMember.create({
        data: { groupId, studentId },
        include: { student: { include: { user: true } } },
      });

      if (group.groupChatId) {
        const alreadyInChat = await tx.groupChatParticipant.findFirst({
          where: { groupId: group.groupChatId, userId: student.userId },
        });
        if (!alreadyInChat) {
          await tx.groupChatParticipant.create({
            data: { groupId: group.groupChatId, userId: student.userId, role: "member" },
          });
        }
      }

      return member;
    });
  }

  // ─── Admin: remove a CHW from a group ────────────────────────────────────────

  static async removeMember(groupId: string, studentId: string) {
    const [group, member] = await Promise.all([
      prisma.cHOGroup.findUnique({ where: { id: groupId } }),
      prisma.cHOGroupMember.findFirst({ where: { groupId, studentId } }),
    ]);
    if (!member) throw new AppError("Member not found in this group", 404);

    const target = group
      ? await prisma.student.findUnique({
          where: { id: studentId },
          select: { userId: true },
        })
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.cHOGroupMember.delete({ where: { id: member.id } });
      if (group?.groupChatId && target) {
        await tx.groupChatParticipant.deleteMany({
          where: { groupId: group.groupChatId, userId: target.userId },
        });
      }
    });
  }

  // ─── CHO: get own group ───────────────────────────────────────────────────────

  static async getMyGroup(choUserId: string) {
    const student = await prisma.student.findUnique({ where: { userId: choUserId } });
    if (!student) throw new AppError("Student record not found", 404);

    const group = await prisma.cHOGroup.findUnique({
      where: { choId: student.id },
      include: {
        _count: { select: { members: true } },
        cho: {
          include: {
            user: {
              select: { id: true, fullNames: true, photo: true, phoneNumber: true },
            },
          },
        },
      },
    });
    if (!group) throw new AppError("You do not lead any group yet", 404);
    return group;
  }

  // ─── CHO: list own group members ─────────────────────────────────────────────

  static async getMyGroupMembers(choUserId: string) {
    const student = await prisma.student.findUnique({ where: { userId: choUserId } });
    if (!student) throw new AppError("Student record not found", 404);

    const group = await prisma.cHOGroup.findUnique({ where: { choId: student.id } });
    if (!group) throw new AppError("You do not lead any group", 404);

    return prisma.cHOGroupMember.findMany({
      where: { groupId: group.id },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                fullNames: true,
                photo: true,
                phoneNumber: true,
                district: true,
                sector: true,
                cell: true,
                village: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
  }

  // ─── CHO: directly add a CHW to their group (no invitation needed) ───────────

  static async directlyAddMember(choUserId: string, targetStudentId: string) {
    const cho = await prisma.student.findUnique({ where: { userId: choUserId } });
    if (!cho) throw new AppError("Student record not found", 404);

    const group = await prisma.cHOGroup.findUnique({ where: { choId: cho.id } });
    if (!group) throw new AppError("You do not lead any group", 404);

    if (targetStudentId === cho.id)
      throw new AppError("You cannot add yourself as a member", 400);

    const target = await prisma.student.findUnique({
      where: { id: targetStudentId },
      include: { groupMembership: true },
    });
    if (!target) throw new AppError("Student not found", 404);
    if (target.groupMembership)
      throw new AppError("This student already belongs to a group", 409);

    return prisma.$transaction(async (tx) => {
      const member = await tx.cHOGroupMember.create({
        data: { groupId: group.id, studentId: targetStudentId },
        include: {
          student: {
            include: {
              user: {
                select: { id: true, fullNames: true, photo: true, phoneNumber: true, district: true, sector: true },
              },
            },
          },
        },
      });

      if (group.groupChatId) {
        const alreadyInChat = await tx.groupChatParticipant.findFirst({
          where: { groupId: group.groupChatId, userId: target.userId },
        });
        if (!alreadyInChat) {
          await tx.groupChatParticipant.create({
            data: { groupId: group.groupChatId, userId: target.userId, role: "member" },
          });
        }
      }

      return member;
    });
  }

  // ─── CHO: remove a member from own group ─────────────────────────────────────

  static async removeMyMember(choUserId: string, targetStudentId: string) {
    const cho = await prisma.student.findUnique({ where: { userId: choUserId } });
    if (!cho) throw new AppError("Student record not found", 404);

    const group = await prisma.cHOGroup.findUnique({ where: { choId: cho.id } });
    if (!group) throw new AppError("You do not lead any group", 404);

    const member = await prisma.cHOGroupMember.findFirst({
      where: { groupId: group.id, studentId: targetStudentId },
    });
    if (!member) throw new AppError("Member not found in your group", 404);

    const target = await prisma.student.findUnique({
      where: { id: targetStudentId },
      select: { userId: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.cHOGroupMember.delete({ where: { id: member.id } });
      if (group.groupChatId && target) {
        await tx.groupChatParticipant.deleteMany({
          where: { groupId: group.groupChatId, userId: target.userId },
        });
      }
    });
  }

  // ─── Admin: update a group ───────────────────────────────────────────────────

  static async updateGroup(groupId: string, data: { name?: string; district?: string; sectors?: string[]; cells?: string[]; villages?: string[]; cell?: string; village?: string; description?: string }) {
    const group = await prisma.cHOGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new AppError("Group not found", 404);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.cHOGroup.update({
        where: { id: groupId },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.district !== undefined ? { district: data.district || null } : {}),
          ...(data.sectors !== undefined ? { sectors: data.sectors } : {}),
          ...(data.cells !== undefined ? { cells: data.cells } : {}),
          ...(data.villages !== undefined ? { villages: data.villages } : {}),
          ...(data.cell !== undefined ? { cell: data.cell || null } : {}),
          ...(data.village !== undefined ? { village: data.village || null } : {}),
          ...(data.description !== undefined ? { description: data.description || null } : {}),
        },
        include: {
          cho: {
            include: {
              user: { select: { id: true, fullNames: true, photo: true, phoneNumber: true, district: true, sector: true } },
            },
          },
          _count: { select: { members: true } },
        },
      });

      if (data.name && group.groupChatId) {
        await tx.groupChat.update({
          where: { id: group.groupChatId },
          data: { name: data.name },
        });
      }

      return updated;
    });
  }

  // ─── Admin: delete a group (revokes CHO role, removes all memberships) ────────

  static async deleteGroup(groupId: string) {
    const group = await prisma.cHOGroup.findUnique({
      where: { id: groupId },
      include: { cho: { include: { user: true } } },
    });
    if (!group) throw new AppError("Group not found", 404);

    return prisma.$transaction(async (tx) => {
      await tx.cHOGroupMember.deleteMany({ where: { groupId } });
      await tx.userRole.deleteMany({ where: { userId: group.cho.userId, name: RoleType.CHO } });
      await tx.student.update({ where: { id: group.choId }, data: { role: RoleType.TRAINEE } });

      if (group.groupChatId) {
        await tx.groupChat.update({
          where: { id: group.groupChatId },
          data: { isArchived: true },
        });
      }

      await tx.cHOGroup.delete({ where: { id: groupId } });
      return { success: true };
    });
  }

  // ─── CHO: update own group ────────────────────────────────────────────────────

  static async updateMyGroup(choUserId: string, data: { name?: string; district?: string; sectors?: string[]; cells?: string[]; villages?: string[]; cell?: string; village?: string; description?: string }) {
    const student = await prisma.student.findUnique({ where: { userId: choUserId } });
    if (!student) throw new AppError("Student record not found", 404);

    const group = await prisma.cHOGroup.findUnique({ where: { choId: student.id } });
    if (!group) throw new AppError("You do not lead any group", 404);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.cHOGroup.update({
        where: { id: group.id },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.district !== undefined ? { district: data.district || null } : {}),
          ...(data.sectors !== undefined ? { sectors: data.sectors } : {}),
          ...(data.cells !== undefined ? { cells: data.cells } : {}),
          ...(data.villages !== undefined ? { villages: data.villages } : {}),
          ...(data.cell !== undefined ? { cell: data.cell || null } : {}),
          ...(data.village !== undefined ? { village: data.village || null } : {}),
          ...(data.description !== undefined ? { description: data.description || null } : {}),
        },
        include: {
          _count: { select: { members: true } },
          cho: {
            include: {
              user: { select: { id: true, fullNames: true, photo: true, phoneNumber: true } },
            },
          },
        },
      });

      if (data.name && group.groupChatId) {
        await tx.groupChat.update({
          where: { id: group.groupChatId },
          data: { name: data.name },
        });
      }

      return updated;
    });
  }

  // ─── CHO: search CHW candidates in same area (max 10) ────────────────────────

  static async searchCHWCandidates(choUserId: string, search?: string) {
    const choStudent = await prisma.student.findUnique({
      where: { userId: choUserId },
      include: { user: { select: { district: true, sector: true } } },
    });
    if (!choStudent) throw new AppError("Student record not found", 404);

    const group = await prisma.cHOGroup.findUnique({ where: { choId: choStudent.id } });
    if (!group) throw new AppError("You do not lead any group", 404);

    const userWhere: any = {
      userRoles: { some: { name: RoleType.TRAINEE } },
    };
    // Without a search term, show suggestions from the CHO's district only.
    // When the CHO searches, remove the district restriction so they can find anyone.
    if (choStudent.user.district && !search) {
      userWhere.district = choStudent.user.district;
    }
    if (search) {
      userWhere.OR = [
        { fullNames: { contains: search, mode: "insensitive" } },
        { phoneNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const students = await prisma.student.findMany({
      where: {
        id: { not: choStudent.id },
        groupMembership: null,
        user: userWhere,
      },
      take: search ? 30 : 10,
      include: {
        user: {
          select: { id: true, fullNames: true, photo: true, phoneNumber: true, district: true, sector: true },
        },
      },
      orderBy: { user: { fullNames: "asc" } },
    });

    return students.map((s) => ({
      id: s.id,
      userId: s.userId,
      status: s.status,
      user: s.user,
    }));
  }

  // ─── CHO: monitoring — progress & scores of all members ──────────────────────

  static async getGroupMonitoring(choUserId: string) {
    const cho = await prisma.student.findUnique({ where: { userId: choUserId } });
    if (!cho) throw new AppError("Student record not found", 404);

    const group = await prisma.cHOGroup.findUnique({ where: { choId: cho.id } });
    if (!group) throw new AppError("You do not lead any group", 404);

    const members = await prisma.cHOGroupMember.findMany({
      where: { groupId: group.id },
      include: {
        student: {
          include: {
            user: { select: { id: true, fullNames: true, photo: true, phoneNumber: true } },
            courseProgresses: {
              include: { course: { select: { id: true, title: true } } },
              orderBy: { updatedAt: "desc" },
            },
            attempts: {
              where: { isCompleted: true },
              orderBy: { updatedAt: "desc" },
              take: 10,
              select: {
                id: true,
                marks: true,
                isCompleted: true,
                tryCount: true,
                updatedAt: true,
                preTestId: true,
                midTestId: true,
                finalTestId: true,
                finalExamId: true,
              },
            },
          },
        },
      },
    });

    return {
      groupId: group.id,
      groupName: group.name,
      totalMembers: members.length,
      members: members.map((m) => ({
        studentId: m.studentId,
        user: m.student.user,
        status: m.student.status,
        joinedGroupAt: m.joinedAt,
        courseProgress: m.student.courseProgresses.map((cp) => ({
          courseId: cp.courseId,
          courseTitle: cp.course.title,
          progress: cp.progress,
          isCompleted: cp.isCompleted,
        })),
        recentTestAttempts: m.student.attempts,
      })),
    };
  }
}
