import { RoleType, Prisma } from "@prisma/client";
import { prisma } from "../utils/client";
import AppError from "../utils/error";

type TxClient = Prisma.TransactionClient;

export class CEHOGroupService {
  // ─── Hospital-based membership: shared helpers ────────────────────────────────
  // A CHW's team is derived from which hospital they and their CEHO share.
  // These helpers keep that in sync whenever a hospital or a CEHO changes,
  // while still allowing CEHOs/admins to manually add/remove people as
  // exceptions (manual placements are only ever touched by an explicit
  // hospital change for that specific person, never by a bulk re-sync).

  private static computeAvgProgress(courseProgresses: { progress: number }[]): number {
    if (!courseProgresses.length) return 0;
    return courseProgresses.reduce((s, c) => s + c.progress, 0) / courseProgresses.length;
  }

  /**
   * Keep a single CHW's group membership in sync with their current hospital:
   * leave their current group if it no longer matches, then join the group
   * anchored to their new hospital, if one exists.
   */
  private static async syncChwHospitalMembership(
    tx: TxClient,
    studentId: string,
    userId: string,
    newHospitalId: string | null,
  ) {
    const currentMembership = await tx.cEHOGroupMember.findUnique({
      where: { studentId },
      include: { group: true },
    });

    if (currentMembership && currentMembership.group.hospitalId !== newHospitalId) {
      await tx.cEHOGroupMember.delete({ where: { id: currentMembership.id } });
      if (currentMembership.group.groupChatId) {
        await tx.groupChatParticipant.deleteMany({
          where: { groupId: currentMembership.group.groupChatId, userId },
        });
      }
    }

    const stillMatches = currentMembership && currentMembership.group.hospitalId === newHospitalId;
    if (newHospitalId && !stillMatches) {
      const targetGroup = await tx.cEHOGroup.findUnique({ where: { hospitalId: newHospitalId } });
      if (targetGroup && targetGroup.cehoId !== studentId) {
        await tx.cEHOGroupMember.create({
          data: { groupId: targetGroup.id, studentId, addedVia: "AUTO" },
        });
        if (targetGroup.groupChatId) {
          const existingChat = await tx.groupChatParticipant.findFirst({
            where: { groupId: targetGroup.groupChatId, userId },
          });
          if (!existingChat) {
            await tx.groupChatParticipant.create({
              data: { groupId: targetGroup.groupChatId, userId, role: "member" },
            });
          }
        }
      }
    }
  }

  /**
   * When a new hospital-anchored group is created, immediately pull in every
   * currently-unassigned CHW already at that hospital.
   */
  private static async bulkAutoJoinUnassignedChws(tx: TxClient, hospitalId: string, groupId: string) {
    const group = await tx.cEHOGroup.findUnique({ where: { id: groupId } });
    const candidates = await tx.student.findMany({
      where: { role: RoleType.TRAINEE, groupMembership: null, user: { hospitalId } },
      include: { user: { select: { id: true } } },
    });

    for (const c of candidates) {
      await tx.cEHOGroupMember.create({
        data: { groupId, studentId: c.id, addedVia: "AUTO" },
      });
      if (group?.groupChatId) {
        const existingChat = await tx.groupChatParticipant.findFirst({
          where: { groupId: group.groupChatId, userId: c.user.id },
        });
        if (!existingChat) {
          await tx.groupChatParticipant.create({
            data: { groupId: group.groupChatId, userId: c.user.id, role: "member" },
          });
        }
      }
    }
    return candidates.length;
  }

  /**
   * A CEHO's own hospital changed. Their team stays anchored to the OLD
   * hospital — since a group can't exist without a leader, the remaining
   * member with the highest average course progress is auto-promoted in
   * their place (tie-broken by whoever joined the group earliest). If no
   * members remain, the group is dissolved instead. The outgoing CEHO
   * becomes a plain CHW and is then synced into their new hospital's team
   * the normal way.
   */
  private static async handleCehoHospitalChange(
    tx: TxClient,
    student: { id: string; userId: string },
    group: { id: string; groupChatId: string | null },
    newHospitalId: string | null,
  ) {
    const userId = student.userId;

    const members = await tx.cEHOGroupMember.findMany({
      where: { groupId: group.id },
      include: {
        student: {
          include: {
            courseProgresses: { select: { progress: true } },
            user: { include: { userRoles: true } },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    if (members.length === 0) {
      await tx.userRole.deleteMany({ where: { userId, name: RoleType.CEHO } });
      await tx.userRole.create({ data: { userId, name: RoleType.TRAINEE } });
      await tx.student.update({ where: { id: student.id }, data: { role: RoleType.TRAINEE } });
      if (group.groupChatId) {
        await tx.groupChat.update({ where: { id: group.groupChatId }, data: { isArchived: true } });
      }
      await tx.cEHOGroup.delete({ where: { id: group.id } });
    } else {
      let best = members[0];
      let bestAvg = this.computeAvgProgress(best.student.courseProgresses);
      for (const m of members.slice(1)) {
        const avg = this.computeAvgProgress(m.student.courseProgresses);
        if (avg > bestAvg) {
          best = m;
          bestAvg = avg;
        }
      }
      const newLeader = best.student;

      // They're the leader now, not a member.
      await tx.cEHOGroupMember.delete({ where: { id: best.id } });

      // Ownership transfers; hospitalId is untouched — the team stays put.
      await tx.cEHOGroup.update({ where: { id: group.id }, data: { cehoId: newLeader.id } });

      await tx.userRole.deleteMany({ where: { userId, name: RoleType.CEHO } });
      await tx.userRole.create({ data: { userId, name: RoleType.TRAINEE } });
      await tx.student.update({ where: { id: student.id }, data: { role: RoleType.TRAINEE } });

      const newAlreadyCEHO = newLeader.user.userRoles.some((r) => r.name === RoleType.CEHO);
      if (!newAlreadyCEHO) {
        await tx.userRole.create({ data: { userId: newLeader.userId, name: RoleType.CEHO } });
      }
      await tx.student.update({ where: { id: newLeader.id }, data: { role: RoleType.CEHO } });

      if (group.groupChatId) {
        const existingChat = await tx.groupChatParticipant.findFirst({
          where: { groupId: group.groupChatId, userId: newLeader.userId },
        });
        if (!existingChat) {
          await tx.groupChatParticipant.create({
            data: { groupId: group.groupChatId, userId: newLeader.userId, role: "admin" },
          });
        } else {
          await tx.groupChatParticipant.update({ where: { id: existingChat.id }, data: { role: "admin" } });
        }
        await tx.groupChatParticipant.updateMany({
          where: { groupId: group.groupChatId, userId },
          data: { role: "member" },
        });
      }
    }

    // The outgoing CEHO is now a plain CHW — join their new hospital's team.
    await this.syncChwHospitalMembership(tx, student.id, userId, newHospitalId);
  }

  /**
   * Entry point to call whenever a user's hospital is set or changed
   * (e.g. from profile-update or admin student-edit flows). No-ops for
   * anyone without a student record, or for roles this system doesn't
   * apply to.
   */
  static async handleUserHospitalChange(
    tx: TxClient,
    userId: string,
    oldHospitalId: string | null,
    newHospitalId: string | null,
  ) {
    if (oldHospitalId === newHospitalId) return;

    const student = await tx.student.findUnique({
      where: { userId },
      include: {
        user: { include: { userRoles: true } },
        ledGroup: { select: { id: true, groupChatId: true } },
      },
    });
    if (!student) return;

    const isCEHO = student.user.userRoles.some((r) => r.name === RoleType.CEHO);
    if (isCEHO && student.ledGroup) {
      await this.handleCehoHospitalChange(tx, student, student.ledGroup, newHospitalId);
      return;
    }

    if (student.role === RoleType.TRAINEE) {
      await this.syncChwHospitalMembership(tx, student.id, userId, newHospitalId);
    }
  }

  /**
   * Replace the CEHO of an existing hospital-anchored group: the incumbent is
   * demoted to CHW (and re-synced back into the very same group as a plain
   * member, since their hospital hasn't changed), and the candidate takes
   * over leadership of that group. No new group is created.
   */
  private static async replaceCeho(
    tx: TxClient,
    group: { id: string; cehoId: string; groupChatId: string | null },
    newLeaderStudentId: string,
    newLeaderUserId: string,
  ) {
    const oldCehoStudent = await tx.student.findUnique({
      where: { id: group.cehoId },
      include: { user: { select: { id: true, fullNames: true, hospitalId: true } } },
    });

    // The candidate is very likely already a plain member of this same
    // hospital's group (auto-joined) — they're the leader now, not a member.
    await tx.cEHOGroupMember.deleteMany({ where: { studentId: newLeaderStudentId } });

    const updatedGroup = await tx.cEHOGroup.update({
      where: { id: group.id },
      data: { cehoId: newLeaderStudentId },
      include: {
        ceho: {
          include: {
            user: { select: { id: true, fullNames: true, photo: true, phoneNumber: true, district: true, sector: true } },
          },
        },
      },
    });

    await tx.userRole.deleteMany({ where: { userId: oldCehoStudent!.userId, name: RoleType.CEHO } });
    await tx.userRole.create({ data: { userId: oldCehoStudent!.userId, name: RoleType.TRAINEE } });
    await tx.student.update({ where: { id: group.cehoId }, data: { role: RoleType.TRAINEE } });

    await tx.userRole.deleteMany({
      where: { userId: newLeaderUserId, name: { in: [RoleType.TRAINEE, RoleType.TESTER] } },
    });
    await tx.userRole.create({ data: { userId: newLeaderUserId, name: RoleType.CEHO } });
    await tx.student.update({ where: { id: newLeaderStudentId }, data: { role: RoleType.CEHO } });

    if (group.groupChatId) {
      const existingChat = await tx.groupChatParticipant.findFirst({
        where: { groupId: group.groupChatId, userId: newLeaderUserId },
      });
      if (!existingChat) {
        await tx.groupChatParticipant.create({
          data: { groupId: group.groupChatId, userId: newLeaderUserId, role: "admin" },
        });
      } else {
        await tx.groupChatParticipant.update({ where: { id: existingChat.id }, data: { role: "admin" } });
      }
      await tx.groupChatParticipant.updateMany({
        where: { groupId: group.groupChatId, userId: oldCehoStudent!.userId },
        data: { role: "member" },
      });
    }

    // Old CEHO's hospital hasn't changed — sync them back in as a plain member.
    await this.syncChwHospitalMembership(
      tx,
      group.cehoId,
      oldCehoStudent!.userId,
      oldCehoStudent!.user.hospitalId,
    );

    return { demotedCeho: { id: oldCehoStudent!.userId, fullNames: oldCehoStudent!.user.fullNames }, group: updatedGroup };
  }

  /**
   * Read-only check for whether promoting this user would hit the
   * one-CEHO-per-hospital conflict — lets the UI show the right confirmation
   * state before the admin clicks anything, instead of after a failed attempt.
   */
  static async checkHospitalConflict(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { hospitalId: true } });
    if (!user?.hospitalId) return { existingCeho: null };

    const group = await prisma.cEHOGroup.findUnique({
      where: { hospitalId: user.hospitalId },
      include: { ceho: { include: { user: { select: { id: true, fullNames: true } } } } },
    });

    return { existingCeho: group ? { id: group.ceho.user.id, fullNames: group.ceho.user.fullNames } : null };
  }

  // ─── Admin: promote CHW → CEHO ────────────────────────────────────────────────

  /**
   * If the CHW's hospital already has a CEHO and `confirmReplace` isn't set,
   * this returns `{ conflict: true, existingCeho }` instead of promoting, so
   * the caller can ask "are you sure?" before replacing the incumbent.
   */
  static async promoteToCEHO(userId: string, confirmReplace = false) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: true, student: true, hospital: true },
    });
    if (!user) throw new AppError("User not found", 404);
    if (!user.student) throw new AppError("User has no student record", 404);

    if (user.userRoles.some((r) => r.name === RoleType.CEHO))
      throw new AppError("User is already a CEHO", 409);

    const existingGroup = await prisma.cEHOGroup.findUnique({
      where: { cehoId: user.student.id },
    });
    if (existingGroup) throw new AppError("This student already leads a group", 409);

    if (!user.hospitalId)
      throw new AppError("This user has no hospital set — assign one before promoting to CEHO", 400);

    const hospitalTaken = await prisma.cEHOGroup.findUnique({
      where: { hospitalId: user.hospitalId },
      include: { ceho: { include: { user: { select: { id: true, fullNames: true } } } } },
    });

    if (hospitalTaken) {
      if (!confirmReplace) {
        return {
          conflict: true as const,
          existingCeho: { id: hospitalTaken.ceho.user.id, fullNames: hospitalTaken.ceho.user.fullNames },
        };
      }
      return prisma.$transaction((tx) =>
        this.replaceCeho(tx, hospitalTaken, user.student!.id, userId),
      );
    }

    return prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: {
          userId,
          name: { in: [RoleType.TRAINEE, RoleType.TESTER] },
        },
      });
      await tx.userRole.create({ data: { userId, name: RoleType.CEHO } });
      await tx.student.update({
        where: { id: user.student!.id },
        data: { role: RoleType.CEHO },
      });

      // Groups are anchored to a hospital, so the name always follows it.
      const name = `${user.hospital!.name} Group`;

      const groupChat = await tx.groupChat.create({
        data: {
          name,
          createdById: userId,
          participants: {
            create: [{ userId, role: "admin" }],
          },
        },
      });

      const group = await tx.cEHOGroup.create({
        data: {
          name,
          cehoId: user.student!.id,
          hospitalId: user.hospitalId,
          sectors: user.sector ? [user.sector] : [],
          groupChatId: groupChat.id,
        },
        include: {
          ceho: {
            include: {
              user: { select: { id: true, fullNames: true, photo: true, phoneNumber: true, district: true, sector: true } },
            },
          },
        },
      });

      await this.bulkAutoJoinUnassignedChws(tx, user.hospitalId!, group.id);

      return { user: { id: user.id, fullNames: user.fullNames }, group };
    });
  }

  // ─── Admin: demote CEHO → CHW, transfer group to new CEHO ─────────────────────

  static async demoteToCHW(userId: string, newCehoStudentId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: true, student: true },
    });
    if (!user) throw new AppError("User not found", 404);
    if (!user.student) throw new AppError("User has no student record", 404);

    if (!user.userRoles.some((r) => r.name === RoleType.CEHO))
      throw new AppError("User is not a CEHO", 400);

    if (newCehoStudentId === user.student.id)
      throw new AppError("New CEHO cannot be the same as the demoted CEHO", 400);

    const group = await prisma.cEHOGroup.findUnique({
      where: { cehoId: user.student.id },
    });
    if (!group) throw new AppError("This CEHO does not lead any group", 404);

    const newCEHOStudent = await prisma.student.findUnique({
      where: { id: newCehoStudentId },
      include: { user: { include: { userRoles: true } }, ledGroup: true },
    });
    if (!newCEHOStudent) throw new AppError("New CEHO student not found", 404);
    if (newCEHOStudent.ledGroup)
      throw new AppError("The selected student already leads another group", 409);

    return prisma.$transaction(async (tx) => {
      // Transfer group ownership
      const updatedGroup = await tx.cEHOGroup.update({
        where: { id: group.id },
        data: { cehoId: newCehoStudentId },
        include: {
          ceho: {
            include: {
              user: { select: { id: true, fullNames: true, photo: true, phoneNumber: true } },
            },
          },
        },
      });

      // Remove CEHO role and revert student role
      await tx.userRole.deleteMany({ where: { userId, name: RoleType.CEHO } });
      await tx.student.update({
        where: { id: user.student!.id },
        data: { role: RoleType.TRAINEE },
      });

      // Ensure new leader has CEHO role
      const newAlreadyCEHO = newCEHOStudent.user.userRoles.some((r) => r.name === RoleType.CEHO);
      if (!newAlreadyCEHO) {
        await tx.userRole.create({ data: { userId: newCEHOStudent.userId, name: RoleType.CEHO } });
        await tx.student.update({
          where: { id: newCehoStudentId },
          data: { role: RoleType.CEHO },
        });
      }

      // Sync GroupChat: promote new CEHO to admin, downgrade old CEHO to member
      if (group.groupChatId) {
        const existing = await tx.groupChatParticipant.findFirst({
          where: { groupId: group.groupChatId, userId: newCEHOStudent.userId },
        });
        if (!existing) {
          await tx.groupChatParticipant.create({
            data: { groupId: group.groupChatId, userId: newCEHOStudent.userId, role: "admin" },
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
        newCEHO: { id: newCEHOStudent.user.id, fullNames: newCEHOStudent.user.fullNames },
        group: updatedGroup,
      };
    });
  }

  // ─── Admin: create a group and assign a CEHO ──────────────────────────────────

  static async createGroup(data: {
    cehoStudentId: string;
    sectors?: string[];
    cells?: string[];
    villages?: string[];
    description?: string;
  }) {
    const ceho = await prisma.student.findUnique({
      where: { id: data.cehoStudentId },
      include: { user: { include: { userRoles: true, hospital: true } } },
    });
    if (!ceho) throw new AppError("CEHO student not found", 404);

    const isCEHO = ceho.user.userRoles.some((r) => r.name === "CEHO");
    if (!isCEHO)
      throw new AppError("The selected student does not have the CEHO role", 400);

    const existing = await prisma.cEHOGroup.findUnique({ where: { cehoId: data.cehoStudentId } });
    if (existing) throw new AppError("This CEHO already leads a group", 409);

    if (!ceho.user.hospitalId)
      throw new AppError("This CEHO has no hospital set — assign one before creating a group", 400);

    const hospitalTaken = await prisma.cEHOGroup.findUnique({ where: { hospitalId: ceho.user.hospitalId } });
    if (hospitalTaken) throw new AppError("This hospital already has a CEHO", 409);

    // Groups are anchored to a hospital, so the name always follows it.
    const name = `${ceho.user.hospital!.name} Group`;

    return prisma.$transaction(async (tx) => {
      const groupChat = await tx.groupChat.create({
        data: {
          name,
          createdById: ceho.userId,
          participants: {
            create: [{ userId: ceho.userId, role: "admin" }],
          },
        },
      });

      const group = await tx.cEHOGroup.create({
        data: {
          name,
          cehoId: data.cehoStudentId,
          hospitalId: ceho.user.hospitalId,
          sectors: data.sectors ?? [],
          cells: data.cells ?? [],
          villages: data.villages ?? [],
          description: data.description,
          groupChatId: groupChat.id,
        },
        include: { ceho: { include: { user: true } } },
      });

      await this.bulkAutoJoinUnassignedChws(tx, ceho.user.hospitalId!, group.id);

      return group;
    });
  }

  // ─── Admin: list all groups ──────────────────────────────────────────────────

  static async getAllGroups(limit = 20, offset = 0) {
    const [groups, total] = await Promise.all([
      prisma.cEHOGroup.findMany({
        skip: offset,
        take: limit,
        include: {
          ceho: {
            include: {
              user: { select: { id: true, fullNames: true, photo: true, phoneNumber: true } },
            },
          },
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.cEHOGroup.count(),
    ]);
    return { groups, total };
  }

  // ─── Admin: get a specific group by ID ───────────────────────────────────────

  static async getGroupById(groupId: string) {
    const group = await prisma.cEHOGroup.findUnique({
      where: { id: groupId },
      include: {
        ceho: {
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
      prisma.cEHOGroup.findUnique({ where: { id: groupId } }),
      prisma.student.findUnique({
        where: { id: studentId },
        include: { groupMembership: true },
      }),
    ]);

    if (!group) throw new AppError("Group not found", 404);
    if (!student) throw new AppError("Student not found", 404);
    if (student.groupMembership)
      throw new AppError("Student already belongs to a group", 409);
    if (group.cehoId === studentId)
      throw new AppError("CEHO cannot be added as a regular member", 400);

    return prisma.$transaction(async (tx) => {
      const member = await tx.cEHOGroupMember.create({
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
      prisma.cEHOGroup.findUnique({ where: { id: groupId } }),
      prisma.cEHOGroupMember.findFirst({ where: { groupId, studentId } }),
    ]);
    if (!member) throw new AppError("Member not found in this group", 404);

    const target = group
      ? await prisma.student.findUnique({
          where: { id: studentId },
          select: { userId: true },
        })
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.cEHOGroupMember.delete({ where: { id: member.id } });
      if (group?.groupChatId && target) {
        await tx.groupChatParticipant.deleteMany({
          where: { groupId: group.groupChatId, userId: target.userId },
        });
      }
    });
  }

  // ─── CEHO: get own group ───────────────────────────────────────────────────────

  static async getMyGroup(cehoUserId: string) {
    const student = await prisma.student.findUnique({ where: { userId: cehoUserId } });
    if (!student) throw new AppError("Student record not found", 404);

    const group = await prisma.cEHOGroup.findUnique({
      where: { cehoId: student.id },
      include: {
        _count: { select: { members: true } },
        ceho: {
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

  // ─── CEHO: list own group members ─────────────────────────────────────────────

  static async getMyGroupMembers(cehoUserId: string) {
    const student = await prisma.student.findUnique({ where: { userId: cehoUserId } });
    if (!student) throw new AppError("Student record not found", 404);

    const group = await prisma.cEHOGroup.findUnique({ where: { cehoId: student.id } });
    if (!group) throw new AppError("You do not lead any group", 404);

    return prisma.cEHOGroupMember.findMany({
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

  // ─── CEHO: directly add a CHW to their group (no invitation needed) ───────────

  static async directlyAddMember(cehoUserId: string, targetStudentId: string) {
    const ceho = await prisma.student.findUnique({ where: { userId: cehoUserId } });
    if (!ceho) throw new AppError("Student record not found", 404);

    const group = await prisma.cEHOGroup.findUnique({ where: { cehoId: ceho.id } });
    if (!group) throw new AppError("You do not lead any group", 404);

    if (targetStudentId === ceho.id)
      throw new AppError("You cannot add yourself as a member", 400);

    const target = await prisma.student.findUnique({
      where: { id: targetStudentId },
      include: { groupMembership: true },
    });
    if (!target) throw new AppError("Student not found", 404);
    if (target.groupMembership)
      throw new AppError("This student already belongs to a group", 409);

    return prisma.$transaction(async (tx) => {
      const member = await tx.cEHOGroupMember.create({
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

  // ─── CEHO: remove a member from own group ─────────────────────────────────────

  static async removeMyMember(cehoUserId: string, targetStudentId: string) {
    const ceho = await prisma.student.findUnique({ where: { userId: cehoUserId } });
    if (!ceho) throw new AppError("Student record not found", 404);

    const group = await prisma.cEHOGroup.findUnique({ where: { cehoId: ceho.id } });
    if (!group) throw new AppError("You do not lead any group", 404);

    const member = await prisma.cEHOGroupMember.findFirst({
      where: { groupId: group.id, studentId: targetStudentId },
    });
    if (!member) throw new AppError("Member not found in your group", 404);

    const target = await prisma.student.findUnique({
      where: { id: targetStudentId },
      select: { userId: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.cEHOGroupMember.delete({ where: { id: member.id } });
      if (group.groupChatId && target) {
        await tx.groupChatParticipant.deleteMany({
          where: { groupId: group.groupChatId, userId: target.userId },
        });
      }
    });
  }

  // ─── Admin: update a group ───────────────────────────────────────────────────

  static async updateGroup(groupId: string, data: { name?: string; district?: string; sectors?: string[]; cells?: string[]; villages?: string[]; cell?: string; village?: string; description?: string }) {
    const group = await prisma.cEHOGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new AppError("Group not found", 404);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.cEHOGroup.update({
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
          ceho: {
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

  // ─── Admin: delete a group (revokes CEHO role, removes all memberships) ────────

  static async deleteGroup(groupId: string) {
    const group = await prisma.cEHOGroup.findUnique({
      where: { id: groupId },
      include: { ceho: { include: { user: true } } },
    });
    if (!group) throw new AppError("Group not found", 404);

    return prisma.$transaction(async (tx) => {
      await tx.cEHOGroupMember.deleteMany({ where: { groupId } });
      await tx.userRole.deleteMany({ where: { userId: group.ceho.userId, name: RoleType.CEHO } });
      await tx.student.update({ where: { id: group.cehoId }, data: { role: RoleType.TRAINEE } });

      if (group.groupChatId) {
        await tx.groupChat.update({
          where: { id: group.groupChatId },
          data: { isArchived: true },
        });
      }

      await tx.cEHOGroup.delete({ where: { id: groupId } });
      return { success: true };
    });
  }

  // ─── CEHO: update own group ────────────────────────────────────────────────────

  static async updateMyGroup(cehoUserId: string, data: { name?: string; district?: string; sectors?: string[]; cells?: string[]; villages?: string[]; cell?: string; village?: string; description?: string }) {
    const student = await prisma.student.findUnique({ where: { userId: cehoUserId } });
    if (!student) throw new AppError("Student record not found", 404);

    const group = await prisma.cEHOGroup.findUnique({ where: { cehoId: student.id } });
    if (!group) throw new AppError("You do not lead any group", 404);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.cEHOGroup.update({
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
          ceho: {
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

  // ─── CEHO: search CHW candidates in same area (max 10) ────────────────────────

  static async searchCHWCandidates(cehoUserId: string, search?: string) {
    const cehoStudent = await prisma.student.findUnique({
      where: { userId: cehoUserId },
      include: { user: { select: { hospitalId: true } } },
    });
    if (!cehoStudent) throw new AppError("Student record not found", 404);

    const group = await prisma.cEHOGroup.findUnique({ where: { cehoId: cehoStudent.id } });
    if (!group) throw new AppError("You do not lead any group", 404);

    const userWhere: any = {
      userRoles: { some: { name: RoleType.TRAINEE } },
    };
    // Without a search term, show suggestions from the CEHO's hospital only
    // (this is also who auto-joins the team). When the CEHO searches, remove
    // the restriction so they can find anyone as a manual exception.
    if (cehoStudent.user.hospitalId && !search) {
      userWhere.hospitalId = cehoStudent.user.hospitalId;
    }
    if (search) {
      userWhere.OR = [
        { fullNames: { contains: search, mode: "insensitive" } },
        { phoneNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const students = await prisma.student.findMany({
      where: {
        id: { not: cehoStudent.id },
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

  // ─── CEHO: monitoring — progress & scores of all members ──────────────────────

  static async getGroupMonitoring(cehoUserId: string) {
    const ceho = await prisma.student.findUnique({ where: { userId: cehoUserId } });
    if (!ceho) throw new AppError("Student record not found", 404);

    const group = await prisma.cEHOGroup.findUnique({ where: { cehoId: ceho.id } });
    if (!group) throw new AppError("You do not lead any group", 404);

    const members = await prisma.cEHOGroupMember.findMany({
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
