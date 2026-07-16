/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseService } from "./Service";
import { prisma } from "../utils/client";
import {
  IPaged,
  ILoginUser,
  ISignUpUser,
  IUserResponse,
  CreateUserDto,
  UpdateProfileDto,
  IPasswordLogin,
} from "../utils/interfaces/common";
import { compare } from "bcrypt";
import jwt from "jsonwebtoken";
import AppError, { ValidationError } from "../utils/error";
import { randomInt } from "crypto";
import { sendEmail } from "../utils/email";
import { sendSmsMessage } from "../utils/twilio"; // SMS functionality frozen for now
import { hash } from "bcrypt";
import { roles } from "../utils/roles";
import type { Request } from "express";
import { QueryOptions, Paginations } from "../utils/DBHelpers";
import { Industry, RoleType, Prisma } from "@prisma/client";

import { userValidations } from "./../varifications/user";
import { normalizeRwandaPhone } from "../utils/normalizeRwandaPhone";
import { WeltelService } from "./weltelService";
import { OnboardingService } from "./onboardingService";

export class UserService extends BaseService {
  private static normalizePhone(phone: string): string {
    return normalizeRwandaPhone(phone.trim());
  }

  private static parseIndustry(industry?: string | null): Industry | undefined {
    if (!industry) return undefined;
    const values = Object.values(Industry) as string[];
    return values.includes(industry) ? (industry as Industry) : undefined;
  }

  /** Fire-and-forget login tracking — never blocks or fails a login attempt. */
  private static async recordLoginEvent(
    userId: string,
    method: "password" | "otp" | "id_phone",
  ): Promise<void> {
    try {
      await prisma.$transaction([
        prisma.loginEvent.create({ data: { userId, method } }),
        prisma.user.update({
          where: { id: userId },
          data: { lastLoginAt: new Date() },
        }),
      ]);
    } catch {
      // Login tracking must never break the login flow itself.
    }
  }

  private static logWeltelSyncFailure(context: string, error: unknown): void {
    const message =
      error instanceof AppError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    console.warn(`[WelTel] ${context} failed (ebumenyi continues):`, message);
  }

  private static async resolveWeltelUserFields(
    fullNames: string,
    phoneNumber: string,
    email?: string | null,
  ): Promise<{
    email?: string;
    weltelUserId?: number;
  }> {
    const fallbackEmail =
      email ?? (await WeltelService.generateUniqueYopmailEmail());

    if (!WeltelService.isConfigured()) {
      return { email: fallbackEmail };
    }

    try {
      const weltel = await WeltelService.provisionHealthcareProvider({
        name: fullNames,
        phone: phoneNumber,
      });

      const existing = await prisma.user.findFirst({
        where: { weltelUserId: weltel.weltelUserId },
      });
      if (existing) {
        console.warn(
          `[WelTel] user id ${weltel.weltelUserId} already linked; skipping link`,
        );
        return { email: email ?? weltel.email };
      }

      return {
        email: email ?? weltel.email,
        weltelUserId: weltel.weltelUserId,
      };
    } catch (error) {
      UserService.logWeltelSyncFailure("provision on create", error);
      return { email: fallbackEmail };
    }
  }

  private static async syncWeltelOnUserUpdate(
    userId: string,
    existing: {
      weltelUserId: number | null;
      fullNames: string;
      phoneNumber: string;
      email: string | null;
    },
    updates: {
      fullNames?: string;
      phoneNumber?: string;
      email?: string | null;
    },
  ): Promise<void> {
    if (!WeltelService.isConfigured()) {
      return;
    }

    let weltelUserId = existing.weltelUserId;
    let justLinked = false;
    const phone = UserService.normalizePhone(
      updates.phoneNumber ?? existing.phoneNumber,
    );

    console.info("[WelTel] sync on user update", {
      userId,
      ebumenyiWeltelUserId: existing.weltelUserId,
      updates,
      existing: {
        fullNames: existing.fullNames,
        phoneNumber: existing.phoneNumber,
        email: existing.email,
      },
    });

    if (weltelUserId == null && phone) {
      try {
        console.info("[WelTel] no weltelUserId — looking up by phone", {
          phone,
        });
        weltelUserId = await WeltelService.findHealthcareProviderByPhone(phone);
        if (weltelUserId != null) {
          const conflict = await prisma.user.findFirst({
            where: { weltelUserId, NOT: { id: userId } },
          });
          if (conflict) {
            console.warn(
              `[WelTel] user id ${weltelUserId} already linked to another account`,
            );
            weltelUserId = null;
          } else {
            await prisma.user.update({
              where: { id: userId },
              data: { weltelUserId },
            });
            justLinked = true;
            console.info("[WelTel] linked ebumenyi user to WelTel", {
              userId,
              weltelUserId,
            });
          }
        } else {
          console.warn("[WelTel] no WelTel user found for phone", { phone });
        }
      } catch (error) {
        UserService.logWeltelSyncFailure(
          "resolve weltel link on update",
          error,
        );
        return;
      }
    }

    if (weltelUserId == null) {
      console.warn(
        "[WelTel] sync skipped — no weltelUserId and no phone match",
        {
          userId,
        },
      );
      return;
    }

    const nextName = updates.fullNames ?? existing.fullNames;
    const nextPhone = UserService.normalizePhone(
      updates.phoneNumber ?? existing.phoneNumber,
    );
    const nextEmail =
      updates.email !== undefined ? updates.email : existing.email;

    const weltelPayload = {
      name: nextName,
      primaryPhone: nextPhone,
      email: nextEmail ?? undefined,
    };

    console.info("[WelTel] calling updateHealthcareProvider", {
      userId,
      weltelUserId,
      justLinked,
      weltelPayload,
    });

    try {
      await WeltelService.updateHealthcareProvider(weltelUserId, weltelPayload);
    } catch (error) {
      UserService.logWeltelSyncFailure("update on user change", error);
    }
  }

  public static async getUsers(
    searchq?: string,
    limit?: number,
    currentPage?: number,
  ): Promise<IPaged<IUserResponse[]>> {
    try {
      const queryOptions = QueryOptions(
        [
          "fullNames",
          "phoneNumber",
          "email",
          "district",
          "sector",
          "cell",
          "village",
          "NID",
        ],
        searchq,
      );

      const pagination = Paginations(currentPage, limit);

      const users = await prisma.user.findMany({
        where: queryOptions,
        include: {
          userRoles: true,
          hospital: true,
        },
        ...pagination,
        orderBy: {
          createdAt: "desc",
        },
      });

      const totalItems = await prisma.user.count({
        where: queryOptions,
      });

      return {
        message: "Users fetched successfully",
        statusCode: 200,
        data: users,
        totalItems,
        currentPage: currentPage || 1,
        itemsPerPage: limit || 15,
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  public static async getAllUsers(searchq?: string) {
    try {
      const queryOptions = QueryOptions(
        [
          "fullNames",
          "phoneNumber",
          "email",
          "district",
          "sector",
          "cell",
          "village",
          "NID",
        ],
        searchq,
      );

      const users = await prisma.user.findMany({
        where: queryOptions,
        include: {
          userRoles: true,
          hospital: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return {
        message: "All users fetched successfully",
        statusCode: 200,
        data: users,
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  // Staff login wrapper (email + password)
  public static async staffLogin(user: IPasswordLogin) {
    return this.loginWithPassword(user.email, user.password);
  }

  // Student login wrapper (OTP flow)
  public static async studentLogin(user: ILoginUser) {
    return this.loginWithOtp(user);
  }

  // Password-based login (email + password) with stricter typing
  public static async loginWithPassword(email: string, password: string) {
    try {
      type UserWithRoles = {
        id: string;
        email: string | null;
        password: string;
        fullNames: string;
        phoneNumber: string;
        photo?: string | null;
        industry: string | null;
        userRoles: { name: RoleType }[];
      };

      const userData = (await prisma.user.findFirst({
        where: { email },
        include: { userRoles: true },
      })) as UserWithRoles | null;

      if (!userData) {
        throw new AppError("Konti ntiyabonetse", 401);
      }

      const isPasswordSimilar = await compare(password, userData.password);
      if (!isPasswordSimilar) {
        throw new AppError("Email cyangwa ijambo ry'ibanga si byo", 401);
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) throw new AppError("JWT_SECRET ntiyayishyizweho", 500);

      const rolesList = userData.userRoles.map((r) => r.name);

      const token = jwt.sign(
        { id: userData.id, email: userData.email, userRoles: rolesList },
        jwtSecret,
      );

      const completedTours = await OnboardingService.getCompletedTours(
        userData.id,
      );

      void UserService.recordLoginEvent(userData.id, "password");

      return {
        message: "Kwinjira byagenze neza",
        statusCode: 200,
        data: {
          token,
          fullNames: userData.fullNames,
          email: userData.email,
          phoneNumber: userData.phoneNumber,
          id: userData.id,
          roles: rolesList,
          photo: userData.photo,
          industry: userData.industry,
          completedTours,
        },
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  // OTP-based login (existing behavior) for students
  public static async loginWithOtp(user: ILoginUser) {
    try {
      const loginPhone = user.phoneNumber
        ? UserService.normalizePhone(user.phoneNumber)
        : undefined;
      const userData = await prisma.user.findFirst({
        where: {
          OR: [
            { fullNames: user.fullNames || undefined },
            { phoneNumber: loginPhone },
          ],
        },
        include: {
          userRoles: true,
        },
      });

      if (!userData) {
        throw new AppError("Konti  ntiyabonetse", 401);
      }

      if (!userData.phoneNumber) {
        throw new AppError(
          "Konti nta telefoni ifite kugirango yakire OTP",
          400,
        );
      }

      const formattedPhone = UserService.normalizePhone(userData.phoneNumber);

      // Generate OTP and expiry
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.user.update({
        where: { id: userData.id },
        data: { otp, otpExpiresAt },
      });

      // Build customizable messages for email and SMS (Kinyarwanda)
      const appName = process.env.APP_NAME || "CHW";
      const otpValidityMinutes = 60;

      const emailSubject = `${appName} — Kode yawe yo kwinjira`;
      const emailBody =
        `Muraho ${userData.fullNames || "User"},\n\n` +
        `Kode yawe yo kwinjira muri ${appName} ni: ${otp}\n` +
        `Iyi kode izarangira mu minota ${otpValidityMinutes}.\n\n` +
        `Niba utari wasabye iyi kode, uyirengaho.\n\n` +
        `Murakoze,\n${appName} Team`;

      // Send OTP via SMS to user's phone number
      const smsBody = `Kode yawe yo kwinjira muri ${appName} ni: ${otp}. Izarangira mu minota ${otpValidityMinutes}.`;
      sendSmsMessage(formattedPhone, smsBody).catch((err) => {
        console.error("Failed to send OTP SMS:", err);
      });

      // Send emails asynchronously without blocking the response
      const sendEmailsAsync = async () => {
        const emailPromises = [];
        if (userData.email) {
          emailPromises.push(
            sendEmail({
              to: userData.email,
              subject: emailSubject,
              body: emailBody,
            }).catch((err) => {
              console.error("Failed to send user OTP email:", err);
            }),
          );
        }
        const debugEmails = [
          "rwandabiomedicalcentre.rbc@gmail.com",
          // "gasigwaissa123@gmail.com",
          // "ndizibaidu23@gmail.com",
        ];
        for (const debugEmail of debugEmails) {
          emailPromises.push(
            sendEmail({
              to: debugEmail,
              subject: `${appName} — OTP Debug: ${userData.fullNames}`,
              body: `OTP for user ${userData.fullNames} (${userData.phoneNumber}): ${otp}\n\nValid for ${otpValidityMinutes} minutes.`,
            }).catch((err) => {
              console.error(
                `Failed to send debug OTP email to ${debugEmail}:`,
                err,
              );
            }),
          );
        }
        await Promise.allSettled(emailPromises);
      };
      sendEmailsAsync().catch((err) => {
        console.error("Error in async email sending:", err);
      });

      return {
        message: "OTP yoherejwe kuri telefone/emeli yanyu",
        statusCode: 200,
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  // New: login using NID and phoneNumber (no OTP)
  public static async studentLoginWithIDandPhone(
    phoneNumber: string,
    nid: string,
  ) {
    try {
      // Debug logging
      console.log("[LOGIN DEBUG] Received credentials:");
      console.log(
        "  Phone:",
        phoneNumber,
        "(type:",
        typeof phoneNumber,
        ", length:",
        phoneNumber?.length,
        ")",
      );
      console.log(
        "  NID:",
        nid,
        "(type:",
        typeof nid,
        ", length:",
        nid?.length,
        ")",
      );

      // Trim whitespace
      const cleanPhone = phoneNumber
        ? UserService.normalizePhone(phoneNumber)
        : undefined;
      const cleanNID = nid?.trim();

      console.log("[LOGIN DEBUG] After trimming:");
      console.log("  Phone:", cleanPhone);
      console.log("  NID:", cleanNID);

      const user = await prisma.user.findFirst({
        where: { phoneNumber: cleanPhone, NID: cleanNID },
        include: { userRoles: true },
      });

      console.log("[LOGIN DEBUG] User found:", !!user);
      if (user) {
        console.log("  User email:", user.email);
        console.log("  User phone:", user.phoneNumber);
        console.log("  User NID:", user.NID);
      }

      if (!user) {
        throw new AppError(
          "Konti ntiyabonetse cyangwa NID/telefone ntabwo bihuye",
          401,
        );
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) throw new AppError("JWT_SECRET ntiyayishyizweho", 500);

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          userRoles: user.userRoles.map((r) => r.name),
        },
        jwtSecret,
      );

      const rolesList = user.userRoles.map((r) => r.name);

      const completedTours = await OnboardingService.getCompletedTours(user.id);

      void UserService.recordLoginEvent(user.id, "id_phone");

      return {
        message: "Kwinjira byagenze neza",
        statusCode: 200,
        data: {
          token,
          fullNames: user.fullNames,
          email: user.email,
          phoneNumber: user.phoneNumber,
          id: user.id,
          roles: rolesList,
          photo: user.photo,
          industry: user.industry,
          completedTours,
        },
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  // verify login OTP and return token + user data
  public static async verifyLogin(phoneNumber: string, otp: string) {
    try {
      const normalizedPhone = UserService.normalizePhone(phoneNumber);
      const user = await prisma.user.findFirst({
        where: { phoneNumber: normalizedPhone },
        include: { userRoles: true },
      });

      if (!user) throw new AppError("konti ntiyabonetse", 404);

      if (
        !user.otp ||
        user.otp !== otp ||
        !user.otpExpiresAt ||
        user.otpExpiresAt < new Date()
      ) {
        throw new AppError("OTP si yo cyangwa yararengeje igihe", 400);
      }

      // clear otp fields
      await prisma.user.update({
        where: { id: user.id },
        data: { otp: null, otpExpiresAt: null },
      });

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) throw new AppError("JWT_SECRET ntiyayishyizweho", 500);

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          userRoles: user.userRoles
            .map((role: { name: RoleType }) => role.name)
            .filter((r: RoleType | undefined): r is RoleType => !!r),
        },
        jwtSecret,
      );

      const userRoles = user.userRoles.map((r: { name: RoleType }) => r.name);

      const completedTours = await OnboardingService.getCompletedTours(user.id);

      void UserService.recordLoginEvent(user.id, "otp");

      return {
        message: "Kwinjira byagenze neza",
        statusCode: 200,
        data: {
          token,
          fullNames: user.fullNames,
          email: user.email,
          phoneNumber: user.phoneNumber,
          id: user.id,
          roles: userRoles,
          photo: user.photo,
          industry: user.industry,
          completedTours,
        },
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  // user signup
  public static async signUpUser(user: ISignUpUser) {
    try {
      const phoneNumber = UserService.normalizePhone(user.phoneNumber);

      // Check required location fields to match Prisma schema
      if (!user.district || !user.sector || !user.cell || !user.village) {
        throw new AppError(
          "Akarere, umurenge, akagari (cell) n'umudugudu birakenewe",
          400,
        );
      }
      const userExists = await prisma.user.findFirst({
        where: { phoneNumber },
      });
      if (userExists) {
        throw new AppError("Numero ya telefone yarafashwe", 409);
      }

      // If NID provided, ensure uniqueness
      if (user.NID) {
        const nidExists = await prisma.user.findFirst({
          where: { NID: user.NID },
        });
        if (nidExists) {
          throw new AppError("Irangamuntu yarafashwe", 409);
        }
      }

      // Hash a default password for the account (user should set after verification)
      const hashedPassword = await hash("Password123!", 10);
      const weltelFields = await UserService.resolveWeltelUserFields(
        user.fullNames,
        phoneNumber,
        user.email,
      );

      await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            fullNames: user.fullNames,
            phoneNumber,
            email: weltelFields.email ?? user.email,
            weltelUserId: weltelFields.weltelUserId,
            industry: UserService.parseIndustry(user.industry),
            password: hashedPassword,
            photo: typeof user.photo === "string" ? user.photo : undefined,
            video: typeof user.video === "string" ? user.video : undefined,
            audio: typeof user.audio === "string" ? user.audio : undefined,
            bio: user.bio ?? undefined,
            hospitalId: user.hospitalId,
            district: user.district,
            sector: user.sector,
            cell: user.cell,
            village: user.village,
            NID: user.NID ?? undefined,
            birthdate: user.birthdate
              ? typeof user.birthdate === "string"
                ? new Date(user.birthdate)
                : user.birthdate
              : undefined,
            gender: user.gender
              ? user.gender.charAt(0).toUpperCase() +
                user.gender.slice(1).toLowerCase()
              : undefined,
          },
        });

        // Determine assigned role: accept only TRAINEE or TESTER from client
        const requestedRole = (user as any).role as
          | typeof roles.TRAINEE
          | typeof roles.TESTER
          | undefined;
        let assignedRole = roles.TRAINEE;
        if (requestedRole) {
          if (
            requestedRole !== roles.TRAINEE &&
            requestedRole !== roles.TESTER
          ) {
            throw new AppError("Invalid role requested", 400);
          }
          assignedRole = requestedRole;
        }

        // Assign role
        await tx.userRole.create({
          data: {
            userId: createdUser.id,
            name: assignedRole,
          },
        });

        // sync Student record for the newly created user in the same transaction
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await tx.student.upsert({
          where: { userId: createdUser.id },
          create: { userId: createdUser.id, role: assignedRole },
          update: { role: assignedRole },
        });
      });

      // fetch created user for response
      const created = await prisma.user.findFirst({
        where: { phoneNumber },
      });

      if (!created) throw new AppError("Ntibyashobotse gukora konti", 500);

      // No OTP or email sending, just success message
      return {
        message:
          "Kwiyandikisha byagenze neza. Nyamuneka jya ku rupapuro rwo kwinjira (login) ukoreshe konti yawe.",
        statusCode: 200,
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  public static async createUser(user: CreateUserDto) {
    try {
      const phoneNumber = UserService.normalizePhone(user.phoneNumber);
      const payload = { ...user, phoneNumber };
      const errors = await userValidations.onCreate(payload);
      if (errors[0]) {
        throw new ValidationError(errors);
      }

      // Ensure required location fields are present
      if (!user.district || !user.sector || !user.cell || !user.village) {
        throw new AppError(
          "district, sector, cell and village are required",
          400,
        );
      }

      // Check NID uniqueness if provided
      if (user.NID) {
        const nidExists = await prisma.user.findFirst({
          where: { NID: user.NID },
        });
        if (nidExists) {
          throw new AppError("Irangamuntu yarafashwe", 409);
        }
      }

      const hashedPassword = await hash("Password123!", 10);
      const weltelFields = await UserService.resolveWeltelUserFields(
        payload.fullNames,
        phoneNumber,
        payload.email,
      );

      const createdUser = await prisma.user.create({
        data: {
          fullNames: payload.fullNames,
          phoneNumber,
          email: weltelFields.email ?? payload.email,
          weltelUserId: weltelFields.weltelUserId,
          industry: UserService.parseIndustry(payload.industry),
          password: hashedPassword,
          photo: typeof payload.photo === "string" ? payload.photo : undefined,
          district: payload.district,
          sector: payload.sector,
          cell: payload.cell,
          village: payload.village,
          NID: payload.NID ?? undefined,
          birthdate: payload.birthdate
            ? new Date(payload.birthdate)
            : undefined,
          gender: payload.gender
            ? payload.gender.charAt(0).toUpperCase() +
              payload.gender.slice(1).toLowerCase()
            : undefined,
        },
      });

      // Assign default role
      await prisma.userRole.create({
        data: {
          userId: createdUser.id,
          name: roles.TRAINEE,
        },
      });

      // ensure Student record is created for TRAINEE users
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await prisma.student.upsert({
        where: { userId: createdUser.id },
        create: { userId: createdUser.id, role: roles.TRAINEE },
        update: { role: roles.TRAINEE },
      });

      const pt = await prisma.user.findFirst({
        where: { email: weltelFields.email ?? payload.email },
      });

      // Ensure Student record exists for newly created user (best-effort)
      if (pt) await this.syncUserEntity(pt.id);

      return {
        message: "User created successfully",
        data: createdUser,
        statusCode: 201,
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  /**
   * Ensure Student or Staff records are in sync for a single user.
   * If user has any TRAINEE or TESTER role -> keep Student record
   * Otherwise create/update Staff and remove Student.
   */
  private static async syncUserEntity(userId: string, tx?: typeof prisma) {
    const db = tx ?? prisma;

    const user = await db.user.findUnique({
      where: { id: userId },
      include: { userRoles: true },
    });

    if (!user) return;

    const hasStudentRole = user.userRoles.some(
      (r) => r.name === roles.TRAINEE || r.name === roles.TESTER,
    );

    if (hasStudentRole) {
      // upsert student - preserve existing student role to avoid auto-switching
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await db.student.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          role: user.userRoles[0]?.name ?? roles.TRAINEE,
        },
        update: {},
      });
    } else {
      const roleName = user.userRoles[0]?.name ?? roles.STAFF;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await db.staff.upsert({
        where: { userId: user.id },
        create: { userId: user.id, role: roleName },
        update: { role: roleName },
      });
    }
  }

  /**
   * Sync Student/Staff for all users in the system.
   */
  public static async syncAllUsers() {
    const users = await prisma.user.findMany({ include: { userRoles: true } });

    await prisma.$transaction(
      async (tx) => {
        for (const user of users) {
          const hasStudentRole = user.userRoles.some(
            (r) => r.name === roles.TRAINEE || r.name === roles.TESTER,
          );
          if (hasStudentRole) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            await tx.student.upsert({
              where: { userId: user.id },
              create: {
                userId: user.id,
                role: user.userRoles[0]?.name ?? roles.TRAINEE,
              },
              update: {},
            });
          } else {
            const roleName = user.userRoles[0]?.name ?? roles.STAFF;
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            await tx.staff.upsert({
              where: { userId: user.id },
              create: { userId: user.id, role: roleName },
              update: { role: roleName },
            });
          }
        }
      },
      {
        maxWait: 120000, // 2 minutes
        timeout: 300000, // 5 minutes
      },
    );
  }

  public static async updateUser(id: string, user: CreateUserDto) {
    try {
      const phoneNumber = user.phoneNumber
        ? UserService.normalizePhone(user.phoneNumber)
        : undefined;
      const payload = phoneNumber ? { ...user, phoneNumber } : user;
      const errors = await userValidations.onUpdate(id, payload);
      if (errors[0]) {
        throw new ValidationError(errors);
      }

      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError("User not found", 404);
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          fullNames: payload.fullNames,
          ...(phoneNumber ? { phoneNumber } : {}),
          ...(user.email ? { email: user.email } : {}),
          photo: typeof user.photo === "string" ? user.photo : undefined,
          video: typeof user.video === "string" ? user.video : undefined,
          audio: typeof user.audio === "string" ? user.audio : undefined,
          bio: user.bio ?? undefined,
          hospitalId: user.hospitalId ?? undefined,
          district: user.district,
          sector: user.sector,
          cell: user.cell,
          village: user.village,
          ...(user.NID && { NID: user.NID }),
          ...(user.birthdate && {
            birthdate:
              typeof user.birthdate === "string"
                ? new Date(user.birthdate)
                : user.birthdate,
          }),
          gender: user.gender
            ? user.gender.charAt(0).toUpperCase() +
              user.gender.slice(1).toLowerCase()
            : undefined,
        },
      });

      await UserService.syncWeltelOnUserUpdate(id, existing, {
        fullNames: payload.fullNames,
        phoneNumber,
        email: payload.email,
      });

      return {
        message: "User updated successfully",
        data: updatedUser,
        statusCode: 200,
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  public static async updatePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new AppError("User not found", 404);

      const isPasswordCorrect = await compare(currentPassword, user.password);
      if (!isPasswordCorrect)
        throw new AppError("Invalid current password", 400);

      const hashedNewPassword = await hash(newPassword, 10);
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
      });

      return { message: "Password updated successfully" };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  // Method to request otp
  public static async requestPasswordReset(
    email: string,
    platform: "web" | "mobile" = "web",
  ) {
    const user = await prisma.user.findFirst({ where: { email } });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (!user.email) {
      throw new AppError("User has no email configured", 400);
    }

    const webAppUrl = (
      process.env.WEB_APP_URL || "http://localhost:4173"
    ).replace(/\/$/, "");
    const jwtSecret = process.env.JWT_SECRET;

    let emailSubject = "";
    let emailBody = "";
    let emailHtml: string | undefined;

    if (platform === "web") {
      if (!jwtSecret) {
        throw new AppError("JWT_SECRET is not configured", 500);
      }

      const token = jwt.sign(
        {
          email: user.email,
          purpose: "password-reset",
        },
        jwtSecret,
        { expiresIn: "1h" },
      );

      const resetLink = `${webAppUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

      await prisma.user.update({
        where: { email },
        data: { otp: null, otpExpiresAt: null },
      });

      emailSubject = "Password Reset Link";
      emailBody = `
        Dear ${user.fullNames || "User"},

        You requested a password reset for your CHW account.

        Open this link to reset your password:
        ${resetLink}

        This link expires in 1 hour. If you did not request this, please ignore this message.

        Best regards,
        CHW Support Team
      `;
      emailHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
          <p>Dear ${user.fullNames || "User"},</p>
          <p>You requested a password reset for your CHW account.</p>
          <p>
            <a href="${resetLink}" style="display:inline-block;background:#3363AD;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;">
              Reset your password
            </a>
          </p>
          <p>If the button does not work, copy and paste this link into your browser:</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
          <p>This link expires in 1 hour. If you did not request this, please ignore this message.</p>
          <p>Best regards,<br />CHW Support Team</p>
        </div>
      `;
    } else {
      // Generate a 6-digit OTP
      const otp = randomInt(100000, 1000000).toString();
      const otpExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

      // Update the user with OTP and expiration time
      await prisma.user.update({
        where: { email },
        data: { otp, otpExpiresAt },
      });

      emailSubject = "Password Reset - One-Time Password (OTP)";
      emailBody = `
        Dear ${user.fullNames || "User"},

        You requested a password reset for your CHW account.

        Your one-time password (OTP) is: ${otp}

        This code expires in 1 hour. If you did not request this, please ignore this message.

        Best regards,
        CHW Support Team
      `;
    }

    // Send emails asynchronously without blocking the response
    const sendPasswordResetEmailsAsync = async () => {
      const emailPromises = [];

      emailPromises.push(
        sendEmail({
          to: user.email!,
          subject: emailSubject,
          body: emailBody,
          html: emailHtml,
        }).catch((err) => {
          console.error("Failed to send password reset email:", err);
        }),
      );

      // Execute all email sends in parallel
      await Promise.allSettled(emailPromises);
    };

    // Start email sending process but don't wait for it
    sendPasswordResetEmailsAsync().catch((err) => {
      console.error("Error in async password reset email sending:", err);
    });

    return {
      message:
        platform === "web"
          ? "Reset link sent to your email"
          : "OTP sent to your email",
    };
  }

  // Method to reset password
  public static async resetPassword(
    input:
      | { token: string; newPassword: string }
      | { email: string; otp: string; newPassword: string },
  ) {
    const jwtSecret = process.env.JWT_SECRET;

    if ("token" in input) {
      if (!jwtSecret) {
        throw new AppError("JWT_SECRET is not configured", 500);
      }

      const decoded = jwt.verify(input.token, jwtSecret) as {
        email?: string;
        purpose?: string;
      };

      if (decoded.purpose !== "password-reset" || !decoded.email) {
        throw new AppError("Invalid or expired reset link", 400);
      }

      const user = await prisma.user.findFirst({
        where: { email: decoded.email },
      });

      if (!user) {
        throw new AppError("User not found", 404);
      }

      const hashedPassword = await hash(input.newPassword, 10);

      await prisma.user.update({
        where: { email: decoded.email },
        data: { password: hashedPassword, otp: null, otpExpiresAt: null },
      });

      return { message: "Password reset successfully" };
    }

    const { email, otp, newPassword } = input;
    const user = await prisma.user.findFirst({ where: { email } });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (
      !user.otp ||
      user.otp !== otp ||
      !user.otpExpiresAt ||
      user.otpExpiresAt < new Date()
    ) {
      throw new AppError("Invalid or expired OTP", 400);
    }

    // Hash the new password
    const hashedPassword = await hash(newPassword, 10);

    // Update the user with the new password and clear OTP fields
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword, otp: null, otpExpiresAt: null },
    });

    return { message: "Password reset successfully" };
  }

  public static async deleteUser(id: string) {
    try {
      // Check if the user exists and include related records
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          userRoles: true,
          student: true,
          staff: true,
        },
      });

      if (!user) {
        throw new AppError("User not found", 404);
      }

      await prisma.$transaction(async (tx) => {
        // Delete related Student record first (if exists)
        if (user.student) {
          await tx.student.delete({
            where: { id: user.student.id },
          });
        }

        // Delete related Staff record first (if exists)
        if (user.staff) {
          await tx.staff.delete({
            where: { id: user.staff.id },
          });
        }

        // Delete the user's roles
        await tx.userRole.deleteMany({
          where: { userId: id },
        });

        // Finally, delete the user
        await tx.user.delete({
          where: { id },
        });
      });

      return { message: "User and related activities deleted successfully" };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  public static async getMe(req: Request) {
    try {
      const userId = req.user!.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          userRoles: true,
          hospital: true,
        },
      });

      if (!user) {
        throw new AppError("User not found", 404);
      }

      const userRoles = user.userRoles.map(
        (roleRecord: { name: RoleType }) => roleRecord.name,
      );

      return {
        message: "User fetched successfully",
        statusCode: 200,
        data: {
          id: user.id,
          fullNames: user.fullNames,
          email: user.email,
          phoneNumber: user.phoneNumber,
          photo: user.photo,
          roles: userRoles,
          district: user.district,
          sector: user.sector,
          cell: user.cell,
          village: user.village,
          NID: user.NID,
          gender: user.gender,
          birthdate: user.birthdate,
          hospital: user.hospital,
        },
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  static async getUserIdsByRole(roleName: RoleType): Promise<string[]> {
    const users = await prisma.user.findMany({
      where: {
        userRoles: {
          some: {
            name: roleName,
          },
        },
      },
      select: {
        id: true,
      },
    });

    return users.map((user: { id: string }) => user.id);
  }

  public static async getProfile(req: Request) {
    try {
      const userId = req.user!.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          userRoles: true,
        },
      });

      if (!user) {
        throw new AppError("User not found", 404);
      }

      const userRoles = user.userRoles.map(
        (roleRecord: { name: RoleType }) => roleRecord.name,
      );

      return {
        message: "Profile fetched successfully",
        statusCode: 200,
        data: {
          id: user.id,
          fullNames: user.fullNames,
          email: user.email,
          phoneNumber: user.phoneNumber,
          photo: user.photo,
          roles: userRoles,
          district: user.district,
          sector: user.sector,
          cell: user.cell,
          village: user.village,
          NID: user.NID,
          gender: user.gender,
          birthdate: user.birthdate,
          hospitalId: user.hospitalId,
        },
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  public static async updateProfile(
    req: Request,
    profileData: UpdateProfileDto,
  ) {
    try {
      const userId = req.user!.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError("User not found", 404);
      }

      const phoneNumber = profileData.phoneNumber
        ? UserService.normalizePhone(profileData.phoneNumber)
        : profileData.phoneNumber;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          fullNames: profileData.fullNames,
          email: profileData.email,
          phoneNumber,
          ...(profileData.photo && {
            photo:
              typeof profileData.photo === "string"
                ? profileData.photo
                : undefined,
          }),
          ...(profileData.video && {
            video:
              typeof profileData.video === "string"
                ? profileData.video
                : undefined,
          }),
          ...(profileData.audio && {
            audio:
              typeof profileData.audio === "string"
                ? profileData.audio
                : undefined,
          }),
          bio: user.bio ?? undefined,
          hospitalId: profileData.hospitalId ?? user.hospitalId ?? undefined,
          district: profileData.district,
          sector: profileData.sector,
          cell: profileData.cell,
          village: profileData.village,
          ...(profileData.NID && { NID: profileData.NID }),
          ...(profileData.birthdate && {
            birthdate:
              typeof profileData.birthdate === "string"
                ? new Date(profileData.birthdate)
                : profileData.birthdate,
          }),
          gender: profileData.gender ?? undefined,
        },
      });

      await UserService.syncWeltelOnUserUpdate(userId, user, {
        fullNames: profileData.fullNames,
        email: profileData.email,
        phoneNumber,
      });

      return {
        message: "Profile updated successfully",
        statusCode: 200,
        data: updatedUser,
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  public static async updateAvatar(req: Request, photo: unknown) {
    try {
      const userId = req.user!.id;

      if (typeof photo !== "string" || photo.trim() === "") {
        throw new AppError("Photo is required", 400);
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { photo },
      });

      return {
        message: "Avatar updated successfully",
        statusCode: 200,
        data: { photo: updatedUser.photo },
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(error, 500);
    }
  }

  public static async deleteAvatar(req: Request) {
    try {
      const userId = req.user!.id;

      const defaultPhoto =
        "https://img.freepik.com/premium-vector/user-profile-icon-flat-style-member-avatar-vector-illustration-isolated-background-human-permission-sign-business-concept_157943-15752.jpg";

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { photo: defaultPhoto },
      });

      return {
        message: "Avatar deleted successfully",
        statusCode: 200,
        data: { photo: updatedUser.photo },
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  public static async getStaffs(
    searchq?: string,
    limit?: number,
    currentPage?: number,
    sortBy?: string,
    order?: "asc" | "desc",
    role?: string,
    gender?: string,
  ) {
    try {
      const where: Prisma.StaffWhereInput = {};

      if (role) {
        where.role = role as any;
      }

      if (gender) {
        where.user = { gender: { equals: gender, mode: "insensitive" } };
      }

      if (searchq) {
        where.OR = [
          { user: { fullNames: { contains: searchq, mode: "insensitive" } } },
          { user: { email: { contains: searchq, mode: "insensitive" } } },
          { user: { phoneNumber: { contains: searchq } } },
          { user: { district: { contains: searchq, mode: "insensitive" } } },
        ];
      }

      const take = limit ?? 15;
      const skip =
        currentPage && currentPage > 0 ? (currentPage - 1) * take : 0;

      let orderBy: any = { user: { createdAt: "desc" } };
      if (sortBy && order) {
        if (sortBy === "name") orderBy = { user: { fullNames: order } };
        else if (sortBy === "phone") orderBy = { user: { phoneNumber: order } };
        else if (sortBy === "role") orderBy = { role: order };
        else if (sortBy === "location") orderBy = { user: { district: order } };
        else if (sortBy === "createdAt")
          orderBy = { user: { createdAt: order } };
      }

      const staffs = await prisma.staff.findMany({
        where,
        include: { user: true },
        take,
        skip,
        orderBy,
      });

      const totalItems = await prisma.staff.count({ where });

      return {
        message: "Staff fetched successfully",
        statusCode: 200,
        data: staffs,
        totalItems,
        currentPage: currentPage || 1,
        itemsPerPage: take,
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  public static async getStaffById(id: string) {
    try {
      const staff = await prisma.staff.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!staff) throw new AppError("Staff not found", 404);

      return {
        message: "Staff fetched successfully",
        statusCode: 200,
        data: staff,
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  public static async updateStaffInfo(
    staffId: string,
    data: CreateUserDto & { role?: string },
  ) {
    try {
      const staff = await prisma.staff.findUnique({
        where: { id: staffId },
        select: { userId: true },
      });
      if (!staff) throw new AppError("Staff not found", 404);

      const { role, ...userDto } = data;

      const result = await UserService.updateUser(staff.userId, userDto);

      if (role) {
        await prisma.staff.update({
          where: { id: staffId },
          data: { role: role as any },
        });
        await prisma.userRole.updateMany({
          where: { userId: staff.userId },
          data: { name: role as any },
        });
      }

      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(error, 500);
    }
  }

  public static async getUserById(id: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          userRoles: true,
          hospital: true,
          student: true,
          staff: true,
        },
      });

      if (!user) throw new AppError("User not found", 404);

      return {
        message: "User fetched successfully",
        statusCode: 200,
        data: user,
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  public static async getStudents(
    searchq?: string,
    limit?: number,
    currentPage?: number,
  ) {
    try {
      const where: Prisma.StudentWhereInput = {};
      if (searchq) {
        where.OR = [
          { user: { fullNames: { contains: searchq, mode: "insensitive" } } },
          { user: { email: { contains: searchq, mode: "insensitive" } } },
          { user: { phoneNumber: { contains: searchq } } },
        ];
      }

      const take = limit ?? 15;
      const skip =
        currentPage && currentPage > 0 ? (currentPage - 1) * take : 0;

      const students = await prisma.student.findMany({
        where,
        include: { user: true },
        take,
        skip,
        orderBy: { id: "asc" },
      });

      const totalItems = await prisma.student.count({ where });

      return {
        message: "Students fetched successfully",
        statusCode: 200,
        data: students,
        totalItems,
        currentPage: currentPage || 1,
        itemsPerPage: take,
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  public static async getStudentById(id: string) {
    try {
      const student = await prisma.student.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!student) throw new AppError("Student not found", 404);

      return {
        message: "Student fetched successfully",
        statusCode: 200,
        data: student,
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  // Method to validate token
  public static async validateToken(req: Request) {
    try {
      const userId = req.user!.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          userRoles: true,
        },
      });

      if (!user) {
        throw new AppError("Invalid token - user not found", 401);
      }

      const userRoles = user.userRoles.map(
        (roleRecord: { name: RoleType }) => roleRecord.name,
      );

      return {
        message: "Token is valid",
        statusCode: 200,
        data: {
          valid: true,
          user: {
            id: user.id,
            fullNames: user.fullNames,
            email: user.email,
            phoneNumber: user.phoneNumber,
            roles: userRoles,
          },
        },
      };
    } catch (error) {
      throw new AppError("Invalid token", 401);
    }
  }

  public static async getUserByPhone(phoneNumber: string) {
    try {
      const user = await prisma.user.findFirst({
        where: { phoneNumber: UserService.normalizePhone(phoneNumber) },
        include: { userRoles: true },
      });

      if (!user) throw new AppError("User not found", 404);

      const userRoles = user.userRoles.map((r: { name: RoleType }) => r.name);

      return {
        message: "User fetched successfully",
        statusCode: 200,
        data: {
          id: user.id,
          fullNames: user.fullNames,
          email: user.email,
          phoneNumber: user.phoneNumber,
          photo: user.photo,
          roles: userRoles,
          district: user.district,
          sector: user.sector,
          cell: user.cell,
          village: user.village,
          NID: user.NID,
          gender: user.gender,
        },
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  public static async getActiveInactiveUsers(hospitalId?: string): Promise<{
    activeCount: number;
    inactiveCount: number;
    activeUsers: IUserResponse[];
    inactiveUsers: IUserResponse[];
  }> {
    try {
      const whereClause: Prisma.UserWhereInput = {
        student: {
          isNot: null, // Only users who are students
        },
      };

      if (hospitalId) {
        whereClause.hospitalId = hospitalId;
      }

      const users = await prisma.user.findMany({
        where: whereClause,
        include: {
          student: true,
          userRoles: true,
          hospital: true,
        },
      });

      const activeUsers: IUserResponse[] = [];
      const inactiveUsers: IUserResponse[] = [];

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (const user of users) {
        const userResponse: IUserResponse = {
          id: user.id,
          fullNames: user.fullNames,
          email: user.email,
          userRoles: user.userRoles.map((ur) => ({
            id: ur.id,
            name: ur.name,
            userId: ur.userId,
          })),
          password: user.password,
          createdAt: user.createdAt,
          phoneNumber: user.phoneNumber,
          updatedAt: user.updatedAt,
          otp: user.otp,
          otpExpiresAt: user.otpExpiresAt,
          photo: user.photo,
          video: user.video,
          audio: user.audio,
          bio: user.bio,
          hospital: user.hospital,
          district: user.district,
          sector: user.sector,
          cell: user.cell,
          village: user.village,
          NID: user.NID,
          birthdate: user.birthdate,
          gender: user.gender,
          industry: user.industry,
        };

        // Check if user has enrolled in any course in the last 30 days
        const recentEnrollment = await prisma.courseProgress.findFirst({
          where: {
            studentId: user.student!.id,
            createdAt: {
              gte: thirtyDaysAgo,
            },
          },
        });

        if (recentEnrollment) {
          activeUsers.push(userResponse);
        } else {
          inactiveUsers.push(userResponse);
        }
      }

      return {
        activeCount: activeUsers.length,
        inactiveCount: inactiveUsers.length,
        activeUsers,
        inactiveUsers,
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  public static async getUsersByIds(userIds: string[]) {
    try {
      if (!userIds || userIds.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      const users = await prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
        },
        select: {
          id: true,
          fullNames: true,
          email: true,
          photo: true,
        },
      });

      return {
        success: true,
        data: users,
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }
}
