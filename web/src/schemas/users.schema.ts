import { z } from "zod";


export const userSchema = z.object({
  firstName: z.string().min(1, "firstName is required"),
  lastName: z.string().min(1, "lastName is required"),
  email: z.string().email("Invalid email"),
  phoneNumber: z.string().min(10, "Invalid phone number"),
  role: z.string().optional(),
  photo: z.any().optional(),
});


export const signupSchema = z.object({
  email: z.string().email("Invalid email"),
  fullNames: z.string().min(1, "Full name is required"),
  phoneNumber: z.string().min(10, "Invalid phone number"),
  district: z.string().optional(),
  sector: z.string().optional(),
  cell: z.string().optional(),
  village: z.string().optional(),
  NID: z.string().optional(),
  birthdate: z
    .string()
    .optional()
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
      message: "Invalid birthdate",
    }),
  gender: z.string().min(1, "Gender is required"),
  hospitalId: z.string().optional(),
});