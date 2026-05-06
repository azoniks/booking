import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding…");

  // Чистим только если БД не пустая (для повторных reset)
  await prisma.notificationLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.objectBlock.deleteMany();
  await prisma.objectMedia.deleteMany();
  await prisma.bookingObject.deleteMany();
  await prisma.objectType.deleteMany();
  await prisma.category.deleteMany();
  await prisma.adminUser.deleteMany();

  // Админ
  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.adminUser.create({
    data: {
      email: "admin@example.com",
      name: "Администратор",
      passwordHash,
    },
  });

  // Settings
  await prisma.settings.upsert({
    where: { key: "siteName" },
    create: { key: "siteName", value: "База отдыха «У реки»" },
    update: { value: "База отдыха «У реки»" },
  });
  await prisma.settings.upsert({
    where: { key: "siteContact" },
    create: { key: "siteContact", value: "+7 (900) 123-45-67" },
    update: { value: "+7 (900) 123-45-67" },
  });
  await prisma.settings.upsert({
    where: { key: "adminNotifyEmails" },
    create: { key: "adminNotifyEmails", value: ["admin@example.com"] },
    update: { value: ["admin@example.com"] },
  });

  // 4 категории
  const rooms = await prisma.category.create({
    data: {
      name: "Номера",
      slug: "rooms",
      description: "Уютные номера для проживания",
      sortOrder: 0,
      bookingMode: "DAILY",
    },
  });
  const spa = await prisma.category.create({
    data: {
      name: "СПА",
      slug: "spa",
      description: "Сауны, бани, СПА-комплексы",
      sortOrder: 1,
      bookingMode: "HOURLY",
    },
  });
  const gazebos = await prisma.category.create({
    data: {
      name: "Беседки",
      slug: "gazebos",
      description: "Беседки для отдыха компанией",
      sortOrder: 2,
      bookingMode: "HOURLY",
    },
  });
  const bridges = await prisma.category.create({
    data: {
      name: "Мостики для рыбалки",
      slug: "bridges",
      description: "Места для рыбалки на пруду",
      sortOrder: 3,
      bookingMode: "HOURLY",
    },
  });

  // Типы и объекты
  const stdRoom = await prisma.objectType.create({
    data: {
      categoryId: rooms.id,
      name: "Стандарт",
      description: "Двухместный номер со всеми удобствами",
      checkInTime: "14:00",
      checkOutTime: "12:00",
      cleaningMinutes: 0,
      baseCapacity: 2,
      maxCapacity: 4,
      basePrice: 5000,
      extraGuestPrice: 1500,
    },
  });
  const luxRoom = await prisma.objectType.create({
    data: {
      categoryId: rooms.id,
      name: "Люкс",
      description: "Просторный номер с видом",
      checkInTime: "14:00",
      checkOutTime: "12:00",
      cleaningMinutes: 0,
      baseCapacity: 2,
      maxCapacity: 4,
      basePrice: 9000,
      extraGuestPrice: 2000,
    },
  });

  const sauna = await prisma.objectType.create({
    data: {
      categoryId: spa.id,
      name: "Русская баня",
      description: "На дровах",
      hourlyStepMinutes: 60,
      workingHoursStart: "10:00",
      workingHoursEnd: "23:00",
      minBookingHours: 2,
      maxBookingHours: 8,
      cleaningMinutes: 60,
      baseCapacity: 6,
      maxCapacity: 8,
      basePrice: 1800,
      extraGuestPrice: 300,
    },
  });

  const gazeboBig = await prisma.objectType.create({
    data: {
      categoryId: gazebos.id,
      name: "Беседка на 8 человек",
      hourlyStepMinutes: 60,
      workingHoursStart: "09:00",
      workingHoursEnd: "23:00",
      minBookingHours: 2,
      maxBookingHours: 12,
      cleaningMinutes: 30,
      baseCapacity: 6,
      maxCapacity: 8,
      basePrice: 800,
      extraGuestPrice: 200,
    },
  });

  const bridge = await prisma.objectType.create({
    data: {
      categoryId: bridges.id,
      name: "Рыболовное место",
      hourlyStepMinutes: 60,
      workingHoursStart: "06:00",
      workingHoursEnd: "22:00",
      minBookingHours: 1,
      maxBookingHours: 12,
      cleaningMinutes: 0,
      baseCapacity: 2,
      maxCapacity: 4,
      basePrice: 400,
      extraGuestPrice: 100,
    },
  });

  // Конкретные объекты с placeholder фото
  const placeholders = [
    "https://picsum.photos/seed/room1/800/600",
    "https://picsum.photos/seed/room2/800/600",
    "https://picsum.photos/seed/room3/800/600",
    "https://picsum.photos/seed/spa1/800/600",
    "https://picsum.photos/seed/gazebo1/800/600",
    "https://picsum.photos/seed/gazebo2/800/600",
    "https://picsum.photos/seed/bridge1/800/600",
    "https://picsum.photos/seed/bridge2/800/600",
  ];

  async function createObj(args: {
    typeId: string;
    name: string;
    slug: string;
    description?: string;
    photoUrl: string;
    sortOrder: number;
  }) {
    const o = await prisma.bookingObject.create({
      data: {
        objectTypeId: args.typeId,
        name: args.name,
        slug: args.slug,
        description: args.description,
        sortOrder: args.sortOrder,
      },
    });
    await prisma.objectMedia.create({
      data: {
        objectId: o.id,
        type: "IMAGE",
        url: args.photoUrl,
        isMain: true,
        sortOrder: 0,
      },
    });
    return o;
  }

  await createObj({
    typeId: stdRoom.id,
    name: "Номер 101",
    slug: "room-101",
    description: "С видом на сад",
    photoUrl: placeholders[0],
    sortOrder: 0,
  });
  await createObj({
    typeId: stdRoom.id,
    name: "Номер 102",
    slug: "room-102",
    description: "С балконом",
    photoUrl: placeholders[1],
    sortOrder: 1,
  });
  await createObj({
    typeId: luxRoom.id,
    name: "Люкс №1",
    slug: "lux-1",
    photoUrl: placeholders[2],
    sortOrder: 0,
  });
  await createObj({
    typeId: sauna.id,
    name: "Баня «Сосновая»",
    slug: "sauna-pine",
    description: "Парная, душ, комната отдыха",
    photoUrl: placeholders[3],
    sortOrder: 0,
  });
  await createObj({
    typeId: gazeboBig.id,
    name: "Беседка №1",
    slug: "gazebo-1",
    description: "Мангал, дрова, посуда",
    photoUrl: placeholders[4],
    sortOrder: 0,
  });
  await createObj({
    typeId: gazeboBig.id,
    name: "Беседка №2",
    slug: "gazebo-2",
    description: "У воды",
    photoUrl: placeholders[5],
    sortOrder: 1,
  });
  await createObj({
    typeId: bridge.id,
    name: "Мостик №1",
    slug: "bridge-1",
    description: "Карп, карась",
    photoUrl: placeholders[6],
    sortOrder: 0,
  });
  await createObj({
    typeId: bridge.id,
    name: "Мостик №2",
    slug: "bridge-2",
    photoUrl: placeholders[7],
    sortOrder: 1,
  });

  console.log("Done. Login: admin@example.com / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
