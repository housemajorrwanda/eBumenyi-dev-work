import { hashSync } from "bcrypt";
import { roles } from "../../src/utils/roles";
import { prisma } from "../../src/utils/client";

const PASSWORD = hashSync("Password123!", 10);

async function upsertUser(
  email: string,
  data: {
    id: string;
    fullNames: string;
    phoneNumber: string;
    district: string;
    sector: string;
    cell: string;
    village: string;
    industry?: "WELTEL" | "RBC" | "SFH" | "CIIC_HIN";
    NID?: string;
    gender?: string;
    hospitalId?: string;
  },
) {
  const { id, ...updateData } = data;
  return prisma.user.upsert({
    where: { email },
    update: updateData,
    create: { id, email, password: PASSWORD, ...updateData },
  });
}

async function ensureRole(userId: string, role: string) {
  const existing = await prisma.userRole.findFirst({
    where: { userId, name: role as never },
  });
  if (!existing) {
    await prisma.userRole.create({ data: { userId, name: role as never } });
  }
}

async function main() {
  console.log("🌱 Starting seed...");

  const hospital = await prisma.hospital.upsert({
    where: { id: "hospital-seed-default" },
    update: {},
    create: {
      id: "hospital-seed-default",
      name: "King Faisal Hospital",
      province: "Kigali City",
      district: "Gasabo",
      sector: "Remera",
      cell: "Rukiri I",
      village: "Nyagatovu",
      contact: "+250788200001",
      email: "kfh@health.gov.rw",
    },
  });

  const developer = await upsertUser("developer@gmail.com", {
    id: "user-seed-developer",
    fullNames: "CHW Developer",
    phoneNumber: "+250788111111",
    district: "Nyarugenge",
    sector: "Nyamirambo",
    cell: "Biryogo",
    village: "Rugunga",
    industry: "WELTEL",
    NID: "1199080000000001",
  });
  await ensureRole(developer.id, roles.DEVELOPER);

  const admin = await upsertUser("admin@gmail.com", {
    id: "user-seed-admin",
    fullNames: "Rwanda Biomedical Centre (RBC)",
    phoneNumber: "+250788666111",
    district: "Nyarugenge",
    sector: "Nyamirambo",
    cell: "Biryogo",
    village: "Rugunga",
    industry: "RBC",
    NID: "1199080000000002",
  });
  await ensureRole(admin.id, roles.ADMIN);
  await prisma.staff.upsert({
    where: { userId: admin.id },
    update: { role: roles.ADMIN },
    create: { userId: admin.id, role: roles.ADMIN },
  });

  const trainer = await upsertUser("trainer.alice@chwplatform.rw", {
    id: "user-seed-trainer",
    fullNames: "Alice Ingabire",
    phoneNumber: "+250788333001",
    district: "Gasabo",
    sector: "Kacyiru",
    cell: "Kamatamu",
    village: "Amahoro",
    industry: "WELTEL",
    NID: "1199080000000004",
    gender: "Female",
    hospitalId: hospital.id,
  });
  await ensureRole(trainer.id, roles.TRAINER);
  await prisma.staff.upsert({
    where: { userId: trainer.id },
    update: { role: roles.TRAINER },
    create: { userId: trainer.id, role: roles.TRAINER },
  });

  const supervisor = await upsertUser("supervisor.grace@chwplatform.rw", {
    id: "user-seed-supervisor",
    fullNames: "Grace Uwase",
    phoneNumber: "+250788444001",
    district: "Nyarugenge",
    sector: "Nyamirambo",
    cell: "Kimisagara",
    village: "Kigarama",
    industry: "RBC",
    NID: "1199080000000006",
    gender: "Female",
    hospitalId: hospital.id,
  });
  await ensureRole(supervisor.id, roles.CHO);

  const trainee = await upsertUser("trainee.amina@chwplatform.rw", {
    id: "user-seed-trainee",
    fullNames: "Amina Mukamurenzi",
    phoneNumber: "+250788555001",
    district: "Gasabo",
    sector: "Remera",
    cell: "Rukiri II",
    village: "Gisimenti",
    industry: "WELTEL",
    NID: "1199080000000008",
    gender: "Female",
    hospitalId: hospital.id,
  });
  await ensureRole(trainee.id, roles.TRAINEE);
  await prisma.student.upsert({
    where: { userId: trainee.id },
    update: { status: "ACTIVE" },
    create: { userId: trainee.id, role: roles.TRAINEE, status: "ACTIVE" },
  });

  console.log("\n✅ Seed complete!");
  console.log("\n🔑 Login credentials (password: Password123!)");
  console.log("   developer@gmail.com            → DEVELOPER");
  console.log("   admin@gmail.com                → ADMIN");
  console.log("   trainer.alice@chwplatform.rw   → TRAINER");
  console.log("   supervisor.grace@chwplatform.rw → CHO");
  console.log("   trainee.amina@chwplatform.rw   → TRAINEE");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
