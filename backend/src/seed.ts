import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from './utils/prisma';

async function main() {
  console.log('🌱 Seeding database...');

  // Admin user
  const password = await bcrypt.hash('admin1234', 12);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@hospital.th',
      password,
      name: 'ผู้ดูแลระบบ',
      role: 'ADMIN',
    },
  });

  // Pharmacist
  const pharmPass = await bcrypt.hash('pharm1234', 12);
  await prisma.user.upsert({
    where: { username: 'pharmacist' },
    update: {},
    create: {
      username: 'pharmacist',
      email: 'pharmacist@hospital.th',
      password: pharmPass,
      name: 'เภสัชกร ทดสอบ',
      role: 'PHARMACIST',
    },
  });

  // Emergency box medications (11 items)
  const medications = [
    { name: 'Epinephrine', genericName: 'Epinephrine (Adrenaline)', strength: '1 mg/mL', unit: 'Amp', standardQty: 5, sortOrder: 1 },
    { name: 'Atropine', genericName: 'Atropine Sulfate', strength: '0.6 mg/mL', unit: 'Amp', standardQty: 5, sortOrder: 2 },
    { name: 'Amiodarone', genericName: 'Amiodarone HCl', strength: '150 mg/3 mL', unit: 'Amp', standardQty: 3, sortOrder: 3 },
    { name: 'Lidocaine', genericName: 'Lidocaine HCl', strength: '100 mg/5 mL', unit: 'Amp', standardQty: 3, sortOrder: 4 },
    { name: 'Dopamine', genericName: 'Dopamine HCl', strength: '200 mg/5 mL', unit: 'Amp', standardQty: 2, sortOrder: 5 },
    { name: 'Sodium Bicarbonate', genericName: 'Sodium Bicarbonate', strength: '8.4% 50 mL', unit: 'Vial', standardQty: 2, sortOrder: 6 },
    { name: 'Calcium Gluconate', genericName: 'Calcium Gluconate', strength: '10% 10 mL', unit: 'Amp', standardQty: 2, sortOrder: 7 },
    { name: 'Dextrose 50%', genericName: 'Dextrose 50%', strength: '50% 50 mL', unit: 'Vial', standardQty: 2, sortOrder: 8 },
    { name: 'Adenosine', genericName: 'Adenosine', strength: '6 mg/2 mL', unit: 'Vial', standardQty: 2, sortOrder: 9 },
    { name: 'Magnesium Sulfate', genericName: 'Magnesium Sulfate', strength: '50% 10 mL', unit: 'Amp', standardQty: 2, sortOrder: 10 },
    { name: 'Morphine', genericName: 'Morphine Sulfate', strength: '10 mg/mL', unit: 'Amp', standardQty: 3, sortOrder: 11 },
  ];

  for (const med of medications) {
    await prisma.medication.upsert({
      where: { id: med.name },
      update: {},
      create: { ...med, id: med.name },
    });
  }

  // Wards
  const wards = [
    { name: 'หอผู้ป่วยอายุรกรรมชาย', code: 'MED-M', floor: '3', building: 'A', department: 'อายุรกรรม' },
    { name: 'หอผู้ป่วยอายุรกรรมหญิง', code: 'MED-F', floor: '3', building: 'A', department: 'อายุรกรรม' },
    { name: 'หอผู้ป่วยศัลยกรรม', code: 'SURG', floor: '4', building: 'A', department: 'ศัลยกรรม' },
    { name: 'หอผู้ป่วยกุมารเวช', code: 'PED', floor: '2', building: 'B', department: 'กุมารเวช' },
    { name: 'หน่วยผู้ป่วยวิกฤต (ICU)', code: 'ICU', floor: '5', building: 'A', department: 'ICU' },
    { name: 'ห้องฉุกเฉิน', code: 'ER', floor: '1', building: 'A', department: 'ฉุกเฉิน' },
    { name: 'หอผู้ป่วยสูติกรรม', code: 'OB', floor: '2', building: 'C', department: 'สูติกรรม' },
    { name: 'หอผู้ป่วยออร์โธปีดิกส์', code: 'ORTHO', floor: '4', building: 'B', department: 'ออร์โธปีดิกส์' },
  ];

  for (const ward of wards) {
    await prisma.ward.upsert({
      where: { code: ward.code },
      update: {},
      create: ward,
    });
  }

  // Sample boxes
  for (let i = 1; i <= 5; i++) {
    const boxNumber = `EB-${String(i).padStart(3, '0')}`;
    await prisma.box.upsert({
      where: { boxNumber },
      update: {},
      create: {
        boxNumber,
        qrCode: `EBTS-BOX-${uuidv4()}`,
        status: 'AVAILABLE',
      },
    });
  }

  // Default system settings
  const settings = [
    { key: 'hospital_name', value: 'โรงพยาบาล', label: 'ชื่อโรงพยาบาล' },
    { key: 'alert_days_30', value: '30', label: 'แจ้งเตือนก่อนหมดอายุ 30 วัน' },
    { key: 'alert_days_7', value: '7', label: 'แจ้งเตือนก่อนหมดอายุ 7 วัน' },
    { key: 'alert_days_1', value: '1', label: 'แจ้งเตือนก่อนหมดอายุ 1 วัน' },
    { key: 'default_return_days', value: '30', label: 'กำหนดวันคืนกล่อง (วัน)' },
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  console.log('✅ Seed completed!');
  console.log('   Admin: admin / admin1234');
  console.log('   Pharmacist: pharmacist / pharm1234');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
