import { hashSync } from "bcrypt";
import { roles } from "../../src/utils/roles";
import { prisma } from "../../src/utils/client";

const PASSWORD = hashSync("Password123!", 10);

async function seedHospitals() {
  const hospitals = [
    {
      name: "King Faisal Hospital",
      province: "Kigali City",
      district: "Gasabo",
      sector: "Remera",
      cell: "Rukiri I",
      village: "Nyagatovu",
      contact: "250788200001",
      email: "kfh@health.gov.rw",
      chwSupervisor: "Dr. Jean Pierre Habimana",
      chwSupervisorContact: "250788200010",
      totalChws: 120,
      activeChws: 98,
      catchmentArea: ["Gasabo", "Kicukiro"],
    },
    {
      name: "Rwanda Military Hospital",
      province: "Kigali City",
      district: "Kicukiro",
      sector: "Gahanga",
      cell: "Kabuga",
      village: "Nyabisindu",
      contact: "250788200002",
      email: "rmh@health.gov.rw",
      chwSupervisor: "Dr. Solange Uwimana",
      chwSupervisorContact: "250788200011",
      totalChws: 80,
      activeChws: 72,
      catchmentArea: ["Kicukiro", "Nyarugenge"],
    },
    {
      name: "Muhima District Hospital",
      province: "Kigali City",
      district: "Nyarugenge",
      sector: "Nyamirambo",
      cell: "Biryogo",
      village: "Rugunga",
      contact: "250788200003",
      email: "muhima@health.gov.rw",
      chwSupervisor: "Dr. Patrick Niyonzima",
      chwSupervisorContact: "250788200012",
      totalChws: 60,
      activeChws: 55,
      catchmentArea: ["Nyarugenge"],
    },
  ];

  const created: Record<string, string> = {};
  for (const h of hospitals) {
    const record = await prisma.hospital.upsert({
      where: {
        id: `hospital-seed-${h.name.toLowerCase().replace(/\s+/g, "-")}`,
      },
      update: { ...h },
      create: {
        id: `hospital-seed-${h.name.toLowerCase().replace(/\s+/g, "-")}`,
        ...h,
      },
    });
    created[h.name] = record.id;
  }
  return created;
}

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
    bio?: string;
    photo?: string;
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

async function seedUsers(hospitalIds: Record<string, string>) {
  // ─── Developer ───────────────────────────────────────────────
  const developer = await upsertUser("developer@gmail.com", {
    id: "user-seed-developer",
    fullNames: "CHW Developer",
    phoneNumber: "250788111111",
    district: "Nyarugenge",
    sector: "Nyamirambo",
    cell: "Biryogo",
    village: "Rugunga",
    industry: "WELTEL",
    NID: "1199080000000001",
  });
  await ensureRole(developer.id, roles.DEVELOPER);

  // ─── Admin (RBC) ─────────────────────────────────────────────
  const admin = await upsertUser("admin@gmail.com", {
    id: "user-seed-admin",
    fullNames: "Rwanda Biomedical Centre (RBC)",
    phoneNumber: "2507886666111",
    district: "Nyarugenge",
    sector: "Nyamirambo",
    cell: "Biryogo",
    village: "Rugunga",
    industry: "RBC",
    NID: "1199080000000002",
    photo:
      "https://res.cloudinary.com/dleiqpvue/image/upload/v1759124054/rbc-removebg-preview_k8xhjr.png",
  });
  await ensureRole(admin.id, roles.ADMIN);
  await prisma.staff.upsert({
    where: { userId: admin.id },
    update: { role: roles.ADMIN },
    create: { userId: admin.id, role: roles.ADMIN },
  });

  // ─── Administrator ────────────────────────────────────────────
  const administrator = await upsertUser("administrator@chwplatform.rw", {
    id: "user-seed-administrator",
    fullNames: "Marie Claire Umutoni",
    phoneNumber: "250788222001",
    district: "Gasabo",
    sector: "Remera",
    cell: "Rukiri I",
    village: "Nyagatovu",
    industry: "RBC",
    NID: "1199080000000003",
    gender: "Female",
    hospitalId: hospitalIds["King Faisal Hospital"],
    bio: "Platform administrator responsible for user management and system oversight.",
  });
  await ensureRole(administrator.id, roles.TESTER);
  await prisma.staff.upsert({
    where: { userId: administrator.id },
    update: { role: roles.TESTER },
    create: { userId: administrator.id, role: roles.TESTER },
  });

  // ─── Trainers ─────────────────────────────────────────────────
  const trainer1 = await upsertUser("trainer.alice@chwplatform.rw", {
    id: "user-seed-trainer1",
    fullNames: "Alice Ingabire",
    phoneNumber: "250788333001",
    district: "Gasabo",
    sector: "Kacyiru",
    cell: "Kamatamu",
    village: "Amahoro",
    industry: "WELTEL",
    NID: "1199080000000004",
    gender: "Female",
    hospitalId: hospitalIds["King Faisal Hospital"],
    bio: "Senior CHW trainer specializing in maternal and child health.",
  });
  await ensureRole(trainer1.id, roles.TRAINER);
  await prisma.staff.upsert({
    where: { userId: trainer1.id },
    update: { role: roles.TRAINER },
    create: { userId: trainer1.id, role: roles.TRAINER },
  });

  const trainer2 = await upsertUser("trainer.bob@chwplatform.rw", {
    id: "user-seed-trainer2",
    fullNames: "Bob Ndayishimiye",
    phoneNumber: "250788333002",
    district: "Kicukiro",
    sector: "Niboye",
    cell: "Gikondo",
    village: "Agatare",
    industry: "SFH",
    NID: "1199080000000005",
    gender: "Male",
    hospitalId: hospitalIds["Rwanda Military Hospital"],
    bio: "Trainer focused on community disease surveillance and prevention.",
  });
  await ensureRole(trainer2.id, roles.TRAINER);
  await prisma.staff.upsert({
    where: { userId: trainer2.id },
    update: { role: roles.TRAINER },
    create: { userId: trainer2.id, role: roles.TRAINER },
  });

  // ─── Supervisors ──────────────────────────────────────────────
  const supervisor1 = await upsertUser("supervisor.grace@chwplatform.rw", {
    id: "user-seed-supervisor1",
    fullNames: "Grace Uwase",
    phoneNumber: "250788444001",
    district: "Nyarugenge",
    sector: "Nyamirambo",
    cell: "Kimisagara",
    village: "Kigarama",
    industry: "RBC",
    NID: "1199080000000006",
    gender: "Female",
    hospitalId: hospitalIds["Muhima District Hospital"],
    bio: "CHW supervisor overseeing Nyarugenge district health programs.",
  });
  await ensureRole(supervisor1.id, roles.CHO);

  const supervisor2 = await upsertUser("supervisor.james@chwplatform.rw", {
    id: "user-seed-supervisor2",
    fullNames: "James Nshimiyimana",
    phoneNumber: "250788444002",
    district: "Gasabo",
    sector: "Gisozi",
    cell: "Bumbogo",
    village: "Rukaranka",
    industry: "WELTEL",
    NID: "1199080000000007",
    gender: "Male",
    hospitalId: hospitalIds["King Faisal Hospital"],
    bio: "Field supervisor coordinating CHW activities in Gasabo district.",
  });
  await ensureRole(supervisor2.id, roles.CHO);

  // ─── Testers (Learners with tester role) ─────────────────────
  const tester1 = await upsertUser("tester.jean@chwplatform.rw", {
    id: "user-seed-tester1",
    fullNames: "Jean Claude Umutekano",
    phoneNumber: "250788555006",
    district: "Gasabo",
    sector: "Kimironko",
    cell: "Bibare",
    village: "Rukiri",
    industry: "WELTEL",
    NID: "1199080000000013",
    gender: "Male",
    hospitalId: hospitalIds["King Faisal Hospital"],
    bio: "Platform tester for validating learner-facing workflows and permissions.",
  });
  await ensureRole(tester1.id, roles.TESTER);
  await prisma.student.upsert({
    where: { userId: tester1.id },
    update: { role: roles.TESTER, status: "ACTIVE" },
    create: { userId: tester1.id, role: roles.TESTER, status: "ACTIVE" },
  });

  // ─── Trainees (Students) ──────────────────────────────────────
  const trainees = [
    {
      id: "user-seed-trainee1",
      email: "trainee.amina@chwplatform.rw",
      fullNames: "Amina Mukamurenzi",
      phoneNumber: "250788555001",
      district: "Gasabo",
      sector: "Remera",
      cell: "Rukiri II",
      village: "Gisimenti",
      NID: "1199080000000008",
      gender: "Female",
      hospitalId: hospitalIds["King Faisal Hospital"],
    },
    {
      id: "user-seed-trainee2",
      email: "trainee.eric@chwplatform.rw",
      fullNames: "Eric Habimana",
      phoneNumber: "250788555002",
      district: "Kicukiro",
      sector: "Kagarama",
      cell: "Nyanza",
      village: "Rwezamenyo",
      NID: "1199080000000009",
      gender: "Male",
      hospitalId: hospitalIds["Rwanda Military Hospital"],
    },
    {
      id: "user-seed-trainee3",
      email: "trainee.fatuma@chwplatform.rw",
      fullNames: "Fatuma Nirere",
      phoneNumber: "250788555003",
      district: "Nyarugenge",
      sector: "Nyamirambo",
      cell: "Biryogo",
      village: "Rugunga",
      NID: "1199080000000010",
      gender: "Female",
      hospitalId: hospitalIds["Muhima District Hospital"],
    },
    {
      id: "user-seed-trainee4",
      email: "trainee.david@chwplatform.rw",
      fullNames: "David Nkurunziza",
      phoneNumber: "250788555004",
      district: "Gasabo",
      sector: "Kimironko",
      cell: "Bibare",
      village: "Cyahafi",
      NID: "1199080000000011",
      gender: "Male",
      hospitalId: hospitalIds["King Faisal Hospital"],
    },
    {
      id: "user-seed-trainee5",
      email: "trainee.hope@chwplatform.rw",
      fullNames: "Hope Umubyeyi",
      phoneNumber: "250788555005",
      district: "Kicukiro",
      sector: "Gahanga",
      cell: "Kabuga",
      village: "Nyabisindu",
      NID: "1199080000000012",
      gender: "Female",
      hospitalId: hospitalIds["Rwanda Military Hospital"],
    },
    {
      id: "user-seed-trainee6",
      email: "trainee.yvonne@chwplatform.rw",
      fullNames: "Yvonne Mukamana",
      phoneNumber: "250788666001",
      district: "Gasabo",
      sector: "Gisozi",
      cell: "Bumbogo",
      village: "Rukaranka",
      NID: "1199080000000014",
      gender: "Female",
      hospitalId: hospitalIds["King Faisal Hospital"],
    },
    {
      id: "user-seed-trainee7",
      email: "trainee.pascal@chwplatform.rw",
      fullNames: "Pascal Niyongabo",
      phoneNumber: "250788666002",
      district: "Gasabo",
      sector: "Kacyiru",
      cell: "Kamatamu",
      village: "Amahoro",
      NID: "1199080000000015",
      gender: "Male",
      hospitalId: hospitalIds["King Faisal Hospital"],
    },
    {
      id: "user-seed-trainee8",
      email: "trainee.solange@chwplatform.rw",
      fullNames: "Solange Umutoniwase",
      phoneNumber: "250788666003",
      district: "Kicukiro",
      sector: "Niboye",
      cell: "Gikondo",
      village: "Agatare",
      NID: "1199080000000016",
      gender: "Female",
      hospitalId: hospitalIds["Rwanda Military Hospital"],
    },
    {
      id: "user-seed-trainee9",
      email: "trainee.emmanuel@chwplatform.rw",
      fullNames: "Emmanuel Nshuti",
      phoneNumber: "250788666004",
      district: "Nyarugenge",
      sector: "Nyakabanda",
      cell: "Karuruma",
      village: "Nyabugogo",
      NID: "1199080000000017",
      gender: "Male",
      hospitalId: hospitalIds["Muhima District Hospital"],
    },
    {
      id: "user-seed-trainee10",
      email: "trainee.chantal@chwplatform.rw",
      fullNames: "Chantal Uwimana",
      phoneNumber: "250788666005",
      district: "Gasabo",
      sector: "Kimironko",
      cell: "Kibagabaga",
      village: "Karama",
      NID: "1199080000000018",
      gender: "Female",
      hospitalId: hospitalIds["King Faisal Hospital"],
    },
    {
      id: "user-seed-trainee11",
      email: "trainee.olivier@chwplatform.rw",
      fullNames: "Olivier Habimana",
      phoneNumber: "250788666006",
      district: "Kicukiro",
      sector: "Kagarama",
      cell: "Nyanza",
      village: "Rwezamenyo",
      NID: "1199080000000019",
      gender: "Male",
      hospitalId: hospitalIds["Rwanda Military Hospital"],
    },
    {
      id: "user-seed-trainee12",
      email: "trainee.vestine@chwplatform.rw",
      fullNames: "Vestine Mukagasana",
      phoneNumber: "250788666007",
      district: "Nyarugenge",
      sector: "Nyamirambo",
      cell: "Kimisagara",
      village: "Kigarama",
      NID: "1199080000000020",
      gender: "Female",
      hospitalId: hospitalIds["Muhima District Hospital"],
    },
    {
      id: "user-seed-trainee13",
      email: "trainee.celestin@chwplatform.rw",
      fullNames: "Celestin Nzeyimana",
      phoneNumber: "250788666008",
      district: "Gasabo",
      sector: "Remera",
      cell: "Rukiri I",
      village: "Nyagatovu",
      NID: "1199080000000021",
      gender: "Male",
      hospitalId: hospitalIds["King Faisal Hospital"],
    },
    {
      id: "user-seed-trainee14",
      email: "trainee.diane@chwplatform.rw",
      fullNames: "Diane Umutesi",
      phoneNumber: "250788666009",
      district: "Kicukiro",
      sector: "Gahanga",
      cell: "Kabuga",
      village: "Nyabisindu",
      NID: "1199080000000022",
      gender: "Female",
      hospitalId: hospitalIds["Rwanda Military Hospital"],
    },
    {
      id: "user-seed-trainee15",
      email: "trainee.justin@chwplatform.rw",
      fullNames: "Justin Hakizimana",
      phoneNumber: "250788666010",
      district: "Gasabo",
      sector: "Gisozi",
      cell: "Bumbogo",
      village: "Rukaranka",
      NID: "1199080000000023",
      gender: "Male",
      hospitalId: hospitalIds["King Faisal Hospital"],
    },
  ];

  const traineeUsers: Array<{ id: string; userId: string }> = [];
  for (const t of trainees) {
    const { email, ...rest } = t;
    const u = await upsertUser(email, { ...rest, industry: "WELTEL" });
    await ensureRole(u.id, roles.TRAINEE);
    const student = await prisma.student.upsert({
      where: { userId: u.id },
      update: { role: roles.TRAINEE, status: "ACTIVE" },
      create: { userId: u.id, role: roles.TRAINEE, status: "ACTIVE" },
    });
    traineeUsers.push({ id: student.id, userId: u.id });
  }

  // Create Student records for CHO supervisors
  const choStudent1 = await prisma.student.upsert({
    where: { userId: supervisor1.id },
    update: { role: roles.CHO, status: "ACTIVE" },
    create: { userId: supervisor1.id, role: roles.CHO, status: "ACTIVE" },
  });

  const choStudent2 = await prisma.student.upsert({
    where: { userId: supervisor2.id },
    update: { role: roles.CHO, status: "ACTIVE" },
    create: { userId: supervisor2.id, role: roles.CHO, status: "ACTIVE" },
  });

  const staffRecords = await prisma.staff.findMany({
    where: { userId: { in: [trainer1.id, trainer2.id] } },
  });

  return {
    developer,
    admin,
    administrator,
    trainer1,
    trainer2,
    supervisor1,
    supervisor2,
    choStudent1,
    choStudent2,
    tester1,
    trainees: traineeUsers,
    staffRecords,
  };
}

async function seedCoursesAndContent(
  staffId: string,
  studentIds: string[],
  userId: string,
) {
  // ─── Course 1: Maternal & Child Health ────────────────────────
  const course1 = await prisma.course.upsert({
    where: { id: "course-seed-mch" },
    update: {},
    create: {
      id: "course-seed-mch",
      creatorId: staffId,
      title: "Maternal and Child Health Essentials",
      coverIcon: "https://img.icons8.com/color/96/mother.png",
      description:
        "A comprehensive course for CHWs covering antenatal care, safe delivery support, postnatal care, and child nutrition.",
      rating: 4.5,
      isPublished: true,
    },
  });

  await prisma.courseIntro.upsert({
    where: { courseId: course1.id },
    update: {},
    create: {
      courseId: course1.id,
      title: "Welcome to Maternal and Child Health Essentials",
      summary:
        "This course equips Community Health Workers with skills to support mothers and children in their communities through evidence-based health practices.",
      bannerImage:
        "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800",
      thumbnail:
        "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400",
    },
  });

  // Sections for course1
  const section1 = await prisma.section.upsert({
    where: { id: "section-seed-mch-1" },
    update: {},
    create: {
      id: "section-seed-mch-1",
      courseId: course1.id,
      title: "Antenatal Care",
      description:
        "Understanding and delivering quality antenatal care services.",
      totalChapter: 2,
    },
  });

  const section2 = await prisma.section.upsert({
    where: { id: "section-seed-mch-2" },
    update: {},
    create: {
      id: "section-seed-mch-2",
      courseId: course1.id,
      title: "Child Nutrition",
      description: "Principles of child nutrition from birth through age five.",
      totalChapter: 2,
    },
  });

  // Chapters
  const chapter1 = await prisma.chapter.upsert({
    where: { id: "chapter-seed-mch-1-1" },
    update: {},
    create: {
      id: "chapter-seed-mch-1-1",
      sectionId: section1.id,
      title: "First Antenatal Visit",
      description: "What to assess and advise during the first ANC visit.",
      totalSlide: 3,
      chapterNumber: 1,
      lessonDuration: 15,
      isPublished: true,
    },
  });

  const chapter2 = await prisma.chapter.upsert({
    where: { id: "chapter-seed-mch-1-2" },
    update: {},
    create: {
      id: "chapter-seed-mch-1-2",
      sectionId: section1.id,
      title: "Danger Signs in Pregnancy",
      description:
        "Recognizing and responding to danger signs in pregnant women.",
      totalSlide: 2,
      chapterNumber: 2,
      lessonDuration: 10,
      isPublished: true,
    },
  });

  const chapter3 = await prisma.chapter.upsert({
    where: { id: "chapter-seed-mch-2-1" },
    update: {},
    create: {
      id: "chapter-seed-mch-2-1",
      sectionId: section2.id,
      title: "Exclusive Breastfeeding",
      description:
        "Promoting and supporting exclusive breastfeeding for the first 6 months.",
      totalSlide: 3,
      chapterNumber: 1,
      lessonDuration: 12,
      isPublished: true,
    },
  });

  const chapter4 = await prisma.chapter.upsert({
    where: { id: "chapter-seed-mch-2-2" },
    update: {},
    create: {
      id: "chapter-seed-mch-2-2",
      sectionId: section2.id,
      title: "Complementary Feeding",
      description:
        "Introducing complementary foods at 6 months while continuing breastfeeding.",
      totalSlide: 2,
      chapterNumber: 2,
      lessonDuration: 10,
      isPublished: true,
    },
  });

  // Slides
  const slideData = [
    {
      id: "slide-seed-mch-1-1-1",
      chapterId: chapter1.id,
      slideNumber: 1,
      note: "ANC Slide 1",
      description:
        "Importance of early antenatal registration within the first trimester.",
    },
    {
      id: "slide-seed-mch-1-1-2",
      chapterId: chapter1.id,
      slideNumber: 2,
      note: "ANC Slide 2",
      description:
        "Physical examination during first ANC: weight, blood pressure, fundal height.",
    },
    {
      id: "slide-seed-mch-1-1-3",
      chapterId: chapter1.id,
      slideNumber: 3,
      note: "ANC Slide 3",
      description: "Laboratory tests: malaria, syphilis, HIV, hemoglobin.",
    },
    {
      id: "slide-seed-mch-1-2-1",
      chapterId: chapter2.id,
      slideNumber: 1,
      note: "Danger Signs 1",
      description:
        "Severe headache, blurred vision, and epigastric pain as pre-eclampsia warning signs.",
    },
    {
      id: "slide-seed-mch-1-2-2",
      chapterId: chapter2.id,
      slideNumber: 2,
      note: "Danger Signs 2",
      description:
        "Vaginal bleeding, absence of fetal movements, and fever during pregnancy.",
    },
    {
      id: "slide-seed-mch-2-1-1",
      chapterId: chapter3.id,
      slideNumber: 1,
      note: "BF Slide 1",
      description: "Benefits of exclusive breastfeeding for mother and child.",
    },
    {
      id: "slide-seed-mch-2-1-2",
      chapterId: chapter3.id,
      slideNumber: 2,
      note: "BF Slide 2",
      description: "Correct breastfeeding positions and latching techniques.",
    },
    {
      id: "slide-seed-mch-2-1-3",
      chapterId: chapter3.id,
      slideNumber: 3,
      note: "BF Slide 3",
      description: "Common breastfeeding challenges and how to address them.",
    },
    {
      id: "slide-seed-mch-2-2-1",
      chapterId: chapter4.id,
      slideNumber: 1,
      note: "CF Slide 1",
      description: "Signs of readiness for complementary foods at 6 months.",
    },
    {
      id: "slide-seed-mch-2-2-2",
      chapterId: chapter4.id,
      slideNumber: 2,
      note: "CF Slide 2",
      description:
        "Food groups for complementary feeding: proteins, carbohydrates, vegetables, fats.",
    },
  ];

  const slides: { id: string }[] = [];
  for (const s of slideData) {
    const slide = await prisma.slide.upsert({
      where: { id: s.id },
      update: {},
      create: { ...s, isPublished: true },
    });
    slides.push(slide);
  }

  // ─── Course 2: Disease Surveillance ───────────────────────────
  const course2 = await prisma.course.upsert({
    where: { id: "course-seed-ds" },
    update: {},
    create: {
      id: "course-seed-ds",
      creatorId: staffId,
      title: "Community Disease Surveillance",
      coverIcon: "https://img.icons8.com/color/96/virus.png",
      description:
        "Train CHWs to detect, report, and respond to disease outbreaks at the community level.",
      rating: 4.2,
      isPublished: true,
    },
  });

  await prisma.courseIntro.upsert({
    where: { courseId: course2.id },
    update: {},
    create: {
      courseId: course2.id,
      title: "Welcome to Community Disease Surveillance",
      summary:
        "Learn how to identify early warning signs of disease outbreaks and use proper reporting channels to protect your community.",
      bannerImage:
        "https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?w=800",
      thumbnail:
        "https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?w=400",
    },
  });

  const dsSection = await prisma.section.upsert({
    where: { id: "section-seed-ds-1" },
    update: {},
    create: {
      id: "section-seed-ds-1",
      courseId: course2.id,
      title: "Surveillance Fundamentals",
      description:
        "Core concepts of disease surveillance in community settings.",
      totalChapter: 2,
    },
  });

  const dsChapter1 = await prisma.chapter.upsert({
    where: { id: "chapter-seed-ds-1" },
    update: {},
    create: {
      id: "chapter-seed-ds-1",
      sectionId: dsSection.id,
      title: "What Is Disease Surveillance?",
      description: "Definition, purpose, and types of disease surveillance.",
      totalSlide: 2,
      chapterNumber: 1,
      lessonDuration: 8,
      isPublished: true,
    },
  });

  await prisma.slide.upsert({
    where: { id: "slide-seed-ds-1-1" },
    update: {},
    create: {
      id: "slide-seed-ds-1-1",
      chapterId: dsChapter1.id,
      slideNumber: 1,
      note: "DS Slide 1",
      description: "Definition and objectives of disease surveillance.",
      isPublished: true,
    },
  });

  await prisma.slide.upsert({
    where: { id: "slide-seed-ds-1-2" },
    update: {},
    create: {
      id: "slide-seed-ds-1-2",
      chapterId: dsChapter1.id,
      slideNumber: 2,
      note: "DS Slide 2",
      description: "Passive vs active surveillance: differences and use cases.",
      isPublished: true,
    },
  });

  // ─── MidTest for chapter1 (MCH) ────────────────────────────────
  const midTest1 = await prisma.midTest.upsert({
    where: { chapterId: chapter1.id },
    update: {},
    create: {
      chapterId: chapter1.id,
      questionToBeAnswered: 2,
      marksToPass: 60,
      description: "Test your knowledge of the first antenatal visit.",
    },
  });

  // Questionnaires for midTest1
  const q1 = await prisma.questionnaire.upsert({
    where: { id: "q-seed-mch-mid1-1" },
    update: {},
    create: {
      id: "q-seed-mch-mid1-1",
      question:
        "At what gestational age should the first ANC visit ideally occur?",
      feedbackStatement:
        "The first ANC visit should occur within the first trimester (before 12 weeks).",
      allowMultiple: false,
      midTestId: midTest1.id,
    },
  });

  await prisma.option.upsert({
    where: { id: "opt-seed-q1-a" },
    update: {},
    create: {
      id: "opt-seed-q1-a",
      questionnaireId: q1.id,
      label: "Before 12 weeks",
    },
  });
  await prisma.option.upsert({
    where: { id: "opt-seed-q1-b" },
    update: {},
    create: {
      id: "opt-seed-q1-b",
      questionnaireId: q1.id,
      label: "Between 13-20 weeks",
    },
  });
  await prisma.option.upsert({
    where: { id: "opt-seed-q1-c" },
    update: {},
    create: {
      id: "opt-seed-q1-c",
      questionnaireId: q1.id,
      label: "After 20 weeks",
    },
  });
  await prisma.option.upsert({
    where: { id: "opt-seed-q1-d" },
    update: {},
    create: {
      id: "opt-seed-q1-d",
      questionnaireId: q1.id,
      label: "Any time during pregnancy",
    },
  });
  await prisma.answer.upsert({
    where: { id: "ans-seed-q1-a" },
    update: {},
    create: {
      id: "ans-seed-q1-a",
      questionnaireId: q1.id,
      label: "Before 12 weeks",
    },
  });

  const q2 = await prisma.questionnaire.upsert({
    where: { id: "q-seed-mch-mid1-2" },
    update: {},
    create: {
      id: "q-seed-mch-mid1-2",
      question:
        "Which of the following is assessed during a first ANC visit? (Select all that apply)",
      feedbackStatement:
        "Blood pressure, weight, and hemoglobin are all assessed during the first ANC visit.",
      allowMultiple: true,
      midTestId: midTest1.id,
    },
  });

  await prisma.option.upsert({
    where: { id: "opt-seed-q2-a" },
    update: {},
    create: {
      id: "opt-seed-q2-a",
      questionnaireId: q2.id,
      label: "Blood pressure measurement",
    },
  });
  await prisma.option.upsert({
    where: { id: "opt-seed-q2-b" },
    update: {},
    create: {
      id: "opt-seed-q2-b",
      questionnaireId: q2.id,
      label: "Dental examination",
    },
  });
  await prisma.option.upsert({
    where: { id: "opt-seed-q2-c" },
    update: {},
    create: {
      id: "opt-seed-q2-c",
      questionnaireId: q2.id,
      label: "Weight assessment",
    },
  });
  await prisma.option.upsert({
    where: { id: "opt-seed-q2-d" },
    update: {},
    create: {
      id: "opt-seed-q2-d",
      questionnaireId: q2.id,
      label: "Hemoglobin test",
    },
  });
  await prisma.answer.upsert({
    where: { id: "ans-seed-q2-a" },
    update: {},
    create: {
      id: "ans-seed-q2-a",
      questionnaireId: q2.id,
      label: "Blood pressure measurement",
    },
  });
  await prisma.answer.upsert({
    where: { id: "ans-seed-q2-b" },
    update: {},
    create: {
      id: "ans-seed-q2-b",
      questionnaireId: q2.id,
      label: "Weight assessment",
    },
  });
  await prisma.answer.upsert({
    where: { id: "ans-seed-q2-c" },
    update: {},
    create: {
      id: "ans-seed-q2-c",
      questionnaireId: q2.id,
      label: "Hemoglobin test",
    },
  });

  // ─── PreTest for course1 ───────────────────────────────────────
  const preTest1 = await prisma.preTest.upsert({
    where: { id: "pretest-seed-mch" },
    update: {},
    create: {
      id: "pretest-seed-mch",
      courseId: course1.id,
      questionToBeAnswered: 2,
      marksToPass: 50,
      description:
        "Pre-assessment to gauge your baseline knowledge of maternal health.",
      isPublished: true,
    },
  });

  const preQ1 = await prisma.questionnaire.upsert({
    where: { id: "q-seed-pre1-1" },
    update: {},
    create: {
      id: "q-seed-pre1-1",
      question:
        "How many antenatal care visits does WHO recommend during pregnancy?",
      feedbackStatement:
        "WHO recommends at least 8 antenatal care contacts during pregnancy.",
      allowMultiple: false,
      courseId: course1.id,
    },
  });

  await prisma.option.upsert({
    where: { id: "opt-pre1-a" },
    update: {},
    create: {
      id: "opt-pre1-a",
      questionnaireId: preQ1.id,
      label: "At least 4 visits",
    },
  });
  await prisma.option.upsert({
    where: { id: "opt-pre1-b" },
    update: {},
    create: {
      id: "opt-pre1-b",
      questionnaireId: preQ1.id,
      label: "At least 6 visits",
    },
  });
  await prisma.option.upsert({
    where: { id: "opt-pre1-c" },
    update: {},
    create: {
      id: "opt-pre1-c",
      questionnaireId: preQ1.id,
      label: "At least 8 contacts",
    },
  });
  await prisma.option.upsert({
    where: { id: "opt-pre1-d" },
    update: {},
    create: {
      id: "opt-pre1-d",
      questionnaireId: preQ1.id,
      label: "2 visits only",
    },
  });
  await prisma.answer.upsert({
    where: { id: "ans-pre1-a" },
    update: {},
    create: {
      id: "ans-pre1-a",
      questionnaireId: preQ1.id,
      label: "At least 8 contacts",
    },
  });

  // ─── FinalTest for course1 ─────────────────────────────────────
  const finalTest1 = await prisma.finalTest.upsert({
    where: { id: "finaltest-seed-mch" },
    update: {},
    create: {
      id: "finaltest-seed-mch",
      courseId: course1.id,
      questionToBeAnswered: 2,
      marksToPass: 70,
      description:
        "Final knowledge assessment for Maternal and Child Health Essentials.",
      isPublished: true,
    },
  });

  // ─── FinalExam for course1 ─────────────────────────────────────
  await prisma.finalExam.upsert({
    where: { id: "finalexam-seed-mch" },
    update: {},
    create: {
      id: "finalexam-seed-mch",
      courseId: course1.id,
      questionToBeAnswered: 3,
      marksToPass: 75,
      description: "Comprehensive practical examination for course completion.",
      isPublished: true,
    },
  });

  // ─── Student Progress & Attempts ─────────────────────────────
  if (studentIds.length > 0) {
    const s1 = studentIds[0];
    await prisma.courseProgress.upsert({
      where: { id: "cp-seed-mch-s1" },
      update: {},
      create: {
        id: "cp-seed-mch-s1",
        studentId: s1,
        courseId: course1.id,
        progress: 75.0,
        isCompleted: false,
      },
    });

    await prisma.chapterProgress.upsert({
      where: { id: "chp-seed-mch-s1-c1" },
      update: {},
      create: {
        id: "chp-seed-mch-s1-c1",
        studentId: s1,
        chapterId: chapter1.id,
        progress: 100.0,
        isCompleted: true,
      },
    });

    await prisma.slideProgress.upsert({
      where: { id: "sp-seed-mch-s1-sl1" },
      update: {},
      create: {
        id: "sp-seed-mch-s1-sl1",
        studentId: s1,
        slideId: slideData[0].id,
        isCompleted: true,
      },
    });

    // Attempt for pretest
    const attempt = await prisma.attempTest.upsert({
      where: { id: "attempt-seed-s1-pre1" },
      update: {},
      create: {
        id: "attempt-seed-s1-pre1",
        studentId: s1,
        preTestId: preTest1.id,
        tryCount: 1,
        marks: 80.0,
        isCompleted: true,
      },
    });

    // FAQ and Feedback on first slide
    const firstSlideId = slideData[0].id;
    await prisma.fAQOnSlide.upsert({
      where: { id: "faq-seed-s1-sl1" },
      update: {},
      create: {
        id: "faq-seed-s1-sl1",
        userId,
        slideId: firstSlideId,
        message:
          "What should we do if the mother refuses to come for ANC visits?",
        isPublished: true,
      },
    });

    await prisma.feedbackOnSlide.upsert({
      where: { id: "fb-seed-s1-sl1" },
      update: {},
      create: {
        id: "fb-seed-s1-sl1",
        userId,
        slideId: firstSlideId,
        message:
          "This slide clearly explains the importance of early registration. Very helpful!",
        isPublished: true,
      },
    });
  }

  return { course1, course2, chapter1, section1, section2 };
}

async function seedCalendarEvents(creatorId: string, participantIds: string[]) {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const events = [
    {
      id: "event-seed-training1",
      title: "Monthly CHW Training Session",
      description:
        "Monthly training session covering updates in community health protocols and refreshers.",
      type: "TRAINING" as const,
      frequency: "MONTHLY" as const,
      startAt: nextWeek,
      endAt: new Date(nextWeek.getTime() + 3 * 60 * 60 * 1000),
      location: "King Faisal Hospital Conference Room",
      priority: "HIGH" as const,
      meetingType: "EBUMENYI_MEETING" as const,
      reminderMinutesBefore: [60, 1440],
    },
    {
      id: "event-seed-webinar1",
      title: "National CHW Webinar: Mental Health Awareness",
      description:
        "A national webinar on integrating mental health screening into routine CHW home visits.",
      type: "WEBINAR" as const,
      frequency: "NONE" as const,
      startAt: nextMonth,
      endAt: new Date(nextMonth.getTime() + 2 * 60 * 60 * 1000),
      location: "Online - Zoom",
      priority: "MEDIUM" as const,
      meetingType: "ZOOM" as const,
      hostEmail: "training@rbc.gov.rw",
      reminderMinutesBefore: [30, 60],
    },
    {
      id: "event-seed-deadline1",
      title: "Monthly Report Submission Deadline",
      description:
        "Submit your monthly community health reports to your supervisor.",
      type: "DEADLINE" as const,
      frequency: "MONTHLY" as const,
      startAt: new Date(now.getFullYear(), now.getMonth() + 1, 5),
      allDay: true,
      priority: "URGENT" as const,
      reminderMinutesBefore: [1440, 2880],
    },
    {
      id: "event-seed-meeting1",
      title: "Supervisor-CHW Weekly Check-in",
      description: "Weekly check-in meeting between supervisors and CHW teams.",
      type: "MEETING" as const,
      frequency: "WEEKLY" as const,
      daysOfWeek: [1], // Monday
      startAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      endAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      location: "Community Health Center",
      priority: "MEDIUM" as const,
      reminderMinutesBefore: [30],
    },
  ];

  for (const ev of events) {
    await prisma.calendarEvent.upsert({
      where: { id: ev.id },
      update: {},
      create: { ...ev, createdById: creatorId },
    });

    // Add participants
    for (const pid of participantIds.slice(0, 3)) {
      const participantId = `event-participant-${ev.id}-${pid}`;
      const existing = await prisma.calendarEventParticipant.findFirst({
        where: { eventId: ev.id, userId: pid },
      });
      if (!existing) {
        await prisma.calendarEventParticipant.create({
          data: { eventId: ev.id, userId: pid },
        });
      }
    }
  }
}

async function seedAnnouncements(creatorId: string) {
  const announcements = [
    {
      id: "ann-seed-1",
      title: "Welcome to the CHW Learning Platform",
      body: "We are excited to launch the Community Health Worker digital learning platform. All CHWs are encouraged to complete their profile and enroll in available courses.",
      segment: "all",
      priority: "high",
      status: "published",
      publishAt: new Date(),
    },
    {
      id: "ann-seed-2",
      title: "New Course Available: Disease Surveillance",
      body: "A new course on Community Disease Surveillance is now available. Supervisors are required to ensure all CHWs in their area complete this course by end of month.",
      segment: "TRAINEE",
      priority: "medium",
      status: "published",
      publishAt: new Date(),
      validUntil: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000),
    },
    {
      id: "ann-seed-3",
      title: "System Maintenance Notice",
      body: "The platform will undergo scheduled maintenance this Saturday from 11 PM to 2 AM. Please save your progress before then.",
      segment: "all",
      priority: "low",
      status: "published",
      publishAt: new Date(),
    },
  ];

  for (const ann of announcements) {
    await prisma.announcement.upsert({
      where: { id: ann.id },
      update: {},
      create: { ...ann, createdById: creatorId },
    });
  }
}

async function seedCommunity(creatorId: string, memberIds: string[]) {
  const community = await prisma.community.upsert({
    where: { id: "community-seed-chw" },
    update: {},
    create: {
      id: "community-seed-chw",
      name: "CHW Knowledge Hub",
      description:
        "A community space for Community Health Workers to share knowledge, ask questions, and support each other.",
      photo: "https://img.icons8.com/color/96/community.png",
      createdById: creatorId,
      isPublic: true,
    },
  });

  // Add members
  for (const mid of [creatorId, ...memberIds]) {
    const existing = await prisma.communityMember.findFirst({
      where: { communityId: community.id, userId: mid },
    });
    if (!existing) {
      await prisma.communityMember.create({
        data: {
          communityId: community.id,
          userId: mid,
          role: mid === creatorId ? "admin" : "member",
        },
      });
    }
  }

  // Posts
  const post1 = await prisma.communityPost.upsert({
    where: { id: "post-seed-1" },
    update: {},
    create: {
      id: "post-seed-1",
      communityId: community.id,
      authorId: creatorId,
      title: "Best practices for home visit documentation",
      content:
        "Hello colleagues! I wanted to share some tips I have learned for documenting home visits effectively. Consistency in recording is key — always note the date, family composition, health concerns raised, interventions provided, and referrals made. Would love to hear your approaches too!",
      viewCount: 45,
      likeCount: 12,
      commentCount: 3,
      timestamp: new Date(),
    },
  });

  const post2 = await prisma.communityPost.upsert({
    where: { id: "post-seed-2" },
    update: {},
    create: {
      id: "post-seed-2",
      communityId: community.id,
      authorId: memberIds[0] ?? creatorId,
      title: "Question: How to handle a mother who refuses vaccination?",
      content:
        "I recently encountered a situation where a mother refused to vaccinate her child due to religious beliefs. After careful listening and respectful dialogue using motivational interviewing techniques, she agreed to vaccinate. Has anyone had similar experiences? How did you approach it?",
      viewCount: 78,
      likeCount: 24,
      commentCount: 5,
      timestamp: new Date(),
    },
  });

  // Comments
  if (memberIds.length > 0) {
    await prisma.communityPostComment.upsert({
      where: { id: "comment-seed-1" },
      update: {},
      create: {
        id: "comment-seed-1",
        postId: post1.id,
        userId: memberIds[0],
        text: "Great tips! I also find it helpful to use a simple checklist to make sure I cover everything during each visit.",
        timestamp: new Date(),
      },
    });

    await prisma.communityPostComment.upsert({
      where: { id: "comment-seed-2" },
      update: {},
      create: {
        id: "comment-seed-2",
        postId: post2.id,
        userId: creatorId,
        text: "Well done! Active listening and showing respect for beliefs while sharing facts about vaccine safety is the right approach.",
        timestamp: new Date(),
      },
    });

    // Post like
    const existingLike = await prisma.communityPostLike.findFirst({
      where: { postId: post1.id, userId: memberIds[0] },
    });
    if (!existingLike) {
      await prisma.communityPostLike.create({
        data: { postId: post1.id, userId: memberIds[0], likedAt: new Date() },
      });
    }
  }

  return community;
}

async function seedDirectChat(user1Id: string, user2Id: string) {
  // Ensure unique pair (userId1 < userId2 lexicographically to avoid duplicates)
  const [uid1, uid2] = [user1Id, user2Id].sort();

  const existingChat = await prisma.directChat.findFirst({
    where: { userId1: uid1, userId2: uid2 },
  });

  if (existingChat) return existingChat;

  const chat = await prisma.directChat.create({
    data: { userId1: uid1, userId2: uid2 },
  });

  const msg1 = await prisma.directMessage.create({
    data: {
      chatId: chat.id,
      senderId: user1Id,
      content:
        "Hello! Welcome to the CHW platform. How can I support you today?",
      type: "text",
      timestamp: new Date(Date.now() - 60 * 60 * 1000),
    },
  });

  const msg2 = await prisma.directMessage.create({
    data: {
      chatId: chat.id,
      senderId: user2Id,
      content:
        "Thank you! I have a question about the antenatal care module. When does it open?",
      type: "text",
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
    },
  });

  const msg3 = await prisma.directMessage.create({
    data: {
      chatId: chat.id,
      senderId: user1Id,
      content:
        "The antenatal care module is already available. You can access it from the Courses section. Let me know if you need any help navigating it!",
      type: "text",
      timestamp: new Date(),
    },
  });

  // Update lastMessage
  await prisma.directChat.update({
    where: { id: chat.id },
    data: { lastMessageId: msg3.id },
  });

  return chat;
}

async function seedGroupChat(creatorId: string, participantIds: string[]) {
  const existing = await prisma.groupChat.findFirst({
    where: { id: "group-seed-chw-kigali" },
  });

  if (existing) return existing;

  const group = await prisma.groupChat.create({
    data: {
      id: "group-seed-chw-kigali",
      name: "Kigali CHW Team",
      description: "Group chat for all CHWs and supervisors in Kigali City.",
      photo: "https://img.icons8.com/color/96/conference-call.png",
      createdById: creatorId,
    },
  });

  // Add participants
  for (const pid of [creatorId, ...participantIds]) {
    const existing = await prisma.groupChatParticipant.findFirst({
      where: { groupId: group.id, userId: pid },
    });
    if (!existing) {
      await prisma.groupChatParticipant.create({
        data: {
          groupId: group.id,
          userId: pid,
          role: pid === creatorId ? "admin" : "member",
        },
      });
    }
  }

  // Messages
  const gm1 = await prisma.groupMessage.create({
    data: {
      groupId: group.id,
      senderId: creatorId,
      content:
        "Welcome everyone to the Kigali CHW Team group! This is our space for coordination and sharing updates.",
      type: "text",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
  });

  const gm2 = await prisma.groupMessage.create({
    data: {
      groupId: group.id,
      senderId: participantIds[0] ?? creatorId,
      content:
        "Thank you for setting this up! Very useful for quick communications.",
      type: "text",
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
    },
  });

  const gm3 = await prisma.groupMessage.create({
    data: {
      groupId: group.id,
      senderId: participantIds[1] ?? creatorId,
      content:
        "Reminder: Monthly report deadline is next Friday. Please submit on time.",
      type: "text",
      timestamp: new Date(),
    },
  });

  await prisma.groupChat.update({
    where: { id: group.id },
    data: { lastMessageId: gm3.id },
  });

  return group;
}

async function seedNotifications(users: { id: string; fullNames: string }[]) {
  const notifData = [
    {
      type: "info" as const,
      title: "Profile Incomplete",
      message: "Please complete your profile to unlock all platform features.",
    },
    {
      type: "success" as const,
      title: "Course Enrollment Confirmed",
      message:
        "You have successfully enrolled in 'Maternal and Child Health Essentials'.",
    },
    {
      type: "new_message" as const,
      title: "New Message",
      message: "You have a new message from your supervisor.",
    },
    {
      type: "system" as const,
      title: "Platform Update",
      message:
        "The platform has been updated with new features. Check out what's new!",
    },
  ];

  for (const user of users) {
    for (const n of notifData) {
      await prisma.notification.upsert({
        where: { id: `notif-seed-${user.id}-${n.type}` },
        update: {},
        create: {
          id: `notif-seed-${user.id}-${n.type}`,
          userId: user.id,
          ...n,
          isRead: false,
        },
      });
    }
  }
}

async function seedSystemReview(userId: string) {
  const review = await prisma.systemReview.upsert({
    where: { id: "sysreview-seed-1" },
    update: {},
    create: {
      id: "sysreview-seed-1",
      userId,
      feedback:
        "The platform is very user-friendly and the content is well-structured. I especially appreciate the offline access to course materials.",
      overallRating: 4.5,
      recommendation:
        "I would highly recommend this platform to all CHWs. It has significantly improved my knowledge and confidence.",
    },
  });

  await prisma.categoryRating.upsert({
    where: { id: "catrating-seed-1-content" },
    update: {},
    create: {
      id: "catrating-seed-1-content",
      systemReviewId: review.id,
      category: "content",
      categoryId: "content-quality",
      label: "Content Quality",
      rating: 5,
    },
  });

  await prisma.categoryRating.upsert({
    where: { id: "catrating-seed-1-ui" },
    update: {},
    create: {
      id: "catrating-seed-1-ui",
      systemReviewId: review.id,
      category: "usability",
      categoryId: "ease-of-use",
      label: "Ease of Use",
      rating: 4,
    },
  });
}

async function seedCHOGroups(
  choStudent1: { id: string },
  choStudent2: { id: string },
  traineeUsers: Array<{ id: string }>,
) {
  // Group 1 — Grace Uwase leads, 4 members
  const group1 = await prisma.cHOGroup.upsert({
    where: { choId: choStudent1.id },
    update: { name: "Nyamirambo CHW Group", sector: "Nyamirambo", description: "CHW group managed by Grace Uwase" },
    create: {
      name: "Nyamirambo CHW Group",
      choId: choStudent1.id,
      sector: "Nyamirambo",
      description: "CHW group managed by Grace Uwase",
    },
  });

  for (let i = 0; i < Math.min(4, traineeUsers.length); i++) {
    await prisma.cHOGroupMember.upsert({
      where: { studentId: traineeUsers[i].id },
      update: {},
      create: {
        groupId: group1.id,
        studentId: traineeUsers[i].id,
      },
    });
  }

  // Group 2 — James Nshimiyimana leads, 3 members (Yvonne, Pascal, Solange)
  const group2 = await prisma.cHOGroup.upsert({
    where: { choId: choStudent2.id },
    update: { name: "Gisozi CHW Group", sector: "Gisozi", description: "CHW group managed by James Nshimiyimana" },
    create: {
      name: "Gisozi CHW Group",
      choId: choStudent2.id,
      sector: "Gisozi",
      description: "CHW group managed by James Nshimiyimana",
    },
  });

  // Add trainees[5..7] (Yvonne, Pascal, Solange) to Gisozi group
  for (let i = 5; i <= 7 && i < traineeUsers.length; i++) {
    await prisma.cHOGroupMember.upsert({
      where: { studentId: traineeUsers[i].id },
      update: {},
      create: {
        groupId: group2.id,
        studentId: traineeUsers[i].id,
      },
    });
  }

  // traineeUsers[4] (Hope) and trainees[8..14] (Emmanuel, Chantal, Olivier, Vestine,
  // Celestin, Diane, Justin) are left ungrouped — 8 free CHWs for testing noGroup filter
}

async function main() {
  try {
    console.log("🌱 Starting seed...");

    console.log("  → Seeding hospitals...");
    let hospitalIds: Record<string, string> = {};
    try {
      hospitalIds = await seedHospitals();
    } catch (e) {
      console.warn("  ⚠ Hospital seed failed (non-fatal):", e);
    }

    console.log("  → Seeding users...");
    const {
      developer,
      admin,
      trainer1,
      trainer2,
      supervisor1,
      supervisor2,
      choStudent1,
      choStudent2,
      tester1,
      trainees,
      staffRecords,
    } = await seedUsers(hospitalIds);

    const trainerStaff = staffRecords.find((s) => s.userId === trainer1.id);
    const staffId = trainerStaff?.id ?? staffRecords[0]?.id;

    if (!staffId) {
      console.warn(
        "  ⚠ No staff record found for trainers — skipping course seed.",
      );
    } else {
      try {
        console.log("  → Seeding courses and content...");
        await seedCoursesAndContent(
          staffId,
          trainees.map((t) => t.id),
          supervisor1.id,
        );
      } catch (e) {
        console.warn("  ⚠ Course seed failed (non-fatal):", e);
      }
    }

    try {
      console.log("  → Seeding calendar events...");
      const participantIds = [
        trainer1.id,
        trainer2.id,
        supervisor1.id,
        supervisor2.id,
        tester1.id,
        ...trainees.map((t) => t.userId),
      ];
      await seedCalendarEvents(admin.id, participantIds);
    } catch (e) {
      console.warn("  ⚠ Calendar seed failed (non-fatal):", e);
    }

    try {
      console.log("  → Seeding announcements...");
      await seedAnnouncements(admin.id);
    } catch (e) {
      console.warn("  ⚠ Announcement seed failed (non-fatal):", e);
    }

    try {
      console.log("  → Seeding community...");
      await seedCommunity(supervisor1.id, [
        trainer1.id,
        trainer2.id,
        supervisor2.id,
        tester1.id,
        ...trainees.map((t) => t.userId),
      ]);
    } catch (e) {
      console.warn("  ⚠ Community seed failed (non-fatal):", e);
    }

    try {
      console.log("  → Seeding direct chats...");
      await seedDirectChat(supervisor1.id, trainees[0]?.userId ?? trainer1.id);
      await seedDirectChat(trainer1.id, trainees[1]?.userId ?? supervisor1.id);
      await seedDirectChat(tester1.id, trainees[0]?.userId ?? supervisor1.id);
    } catch (e) {
      console.warn("  ⚠ Direct chat seed failed (non-fatal):", e);
    }

    try {
      console.log("  → Seeding group chat...");
      await seedGroupChat(supervisor1.id, [
        supervisor2.id,
        trainer1.id,
        trainer2.id,
        tester1.id,
        ...trainees.map((t) => t.userId),
      ]);
    } catch (e) {
      console.warn("  ⚠ Group chat seed failed (non-fatal):", e);
    }

    try {
      console.log("  → Seeding notifications...");
      const notifUsers = [
        { id: admin.id, fullNames: "Admin" },
        { id: trainer1.id, fullNames: trainer1.fullNames },
        { id: supervisor1.id, fullNames: supervisor1.fullNames },
        { id: tester1.id, fullNames: tester1.fullNames },
        ...trainees
          .slice(0, 3)
          .map((t) => ({ id: t.userId, fullNames: "Trainee" })),
      ];
      await seedNotifications(notifUsers);
    } catch (e) {
      console.warn("  ⚠ Notification seed failed (non-fatal):", e);
    }

    try {
      console.log("  → Seeding system review...");
      await seedSystemReview(trainees[0]?.userId ?? trainer1.id);
    } catch (e) {
      console.warn("  ⚠ System review seed failed (non-fatal):", e);
    }

    try {
      console.log("  → Seeding CHO groups...");
      await seedCHOGroups(choStudent1, choStudent2, trainees);
    } catch (e) {
      console.warn("  ⚠ CHO groups seed failed (non-fatal):", e);
    }

    console.log("\n✅ Seed complete!");
    console.log("\n🔑 Login credentials (all use password: Password123!)");
    console.log("   developer@gmail.com     → DEVELOPER");
    console.log("   admin@gmail.com         → ADMIN");
    console.log("   administrator@chwplatform.rw → TESTER");
    console.log("   trainer.alice@chwplatform.rw → TRAINER");
    console.log("   trainer.bob@chwplatform.rw   → TRAINER");
    console.log("   supervisor.grace@chwplatform.rw → CHO");
    console.log("   supervisor.james@chwplatform.rw → CHO");
    console.log("   tester.jean@chwplatform.rw   → TESTER");
    console.log("   trainee.amina@chwplatform.rw    → TRAINEE (Nyamirambo group)");
    console.log("   trainee.eric@chwplatform.rw     → TRAINEE (Nyamirambo group)");
    console.log("   trainee.fatuma@chwplatform.rw   → TRAINEE (Nyamirambo group)");
    console.log("   trainee.david@chwplatform.rw    → TRAINEE (Nyamirambo group)");
    console.log("   trainee.yvonne@chwplatform.rw   → TRAINEE (Gisozi group)");
    console.log("   trainee.pascal@chwplatform.rw   → TRAINEE (Gisozi group)");
    console.log("   trainee.solange@chwplatform.rw  → TRAINEE (Gisozi group)");
    console.log("   trainee.hope@chwplatform.rw     → TRAINEE (NO GROUP)");
    console.log("   trainee.emmanuel@chwplatform.rw → TRAINEE (NO GROUP)");
    console.log("   trainee.chantal@chwplatform.rw  → TRAINEE (NO GROUP)");
    console.log("   trainee.olivier@chwplatform.rw  → TRAINEE (NO GROUP)");
    console.log("   trainee.vestine@chwplatform.rw  → TRAINEE (NO GROUP)");
    console.log("   trainee.celestin@chwplatform.rw → TRAINEE (NO GROUP)");
    console.log("   trainee.diane@chwplatform.rw    → TRAINEE (NO GROUP)");
    console.log("   trainee.justin@chwplatform.rw   → TRAINEE (NO GROUP)");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
