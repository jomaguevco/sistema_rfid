// Script para crear usuarios médicos para todos los doctores registrados
const db = require('./database_medical');
const { hashPassword } = require('./utils/password');
require('dotenv').config();

async function createMedicosForDoctors() {
  try {
    console.log('🔍 Buscando doctores en la base de datos...\n');
    
    // Obtener todos los doctores
    const doctors = await db.getAllDoctors({});
    
    if (doctors.length === 0) {
      console.log('⚠️  No se encontraron doctores en la base de datos');
      console.log('   Ejecuta primero el script de población de datos: node backend/scripts/complete_database_setup.js');
      process.exit(1);
    }
    
    console.log(`✓ Se encontraron ${doctors.length} doctores\n`);
    
    // Obtener usuarios existentes
    const existingUsers = await db.getAllUsers();
    const existingMedicos = existingUsers.filter(u => u.role === 'medico');
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    
    console.log('📝 Creando usuarios médicos para cada doctor...\n');
    
    for (const doctor of doctors) {
      try {
        // Generar username basado en el nombre del doctor
        // Ejemplo: "Dr. Juan Carlos Pérez" -> "medico_juan_perez"
        const username = generateUsernameFromDoctorName(doctor.name);
        
        // Verificar si el usuario ya existe
        const existingUser = existingUsers.find(u => u.username === username);
        
        if (existingUser) {
          // Actualizar contraseña si existe
          const password_hash = await hashPassword('medico123');
          await db.pool.execute(
            'UPDATE users SET password_hash = ?, email = ?, role = ?, is_active = TRUE WHERE username = ?',
            [password_hash, doctor.email || `${username}@sistema.com`, 'medico', username]
          );
          console.log(`✓ Actualizado: ${username} - ${doctor.name}`);
          updated++;
        } else {
          // Crear nuevo usuario
          const password_hash = await hashPassword('medico123');
          const email = doctor.email || `${username}@sistema.com`;
          
          await db.createUser({
            username: username,
            email: email,
            password_hash: password_hash,
            role: 'medico'
          });
          console.log(`✓ Creado: ${username} - ${doctor.name} (${doctor.specialty})`);
          created++;
        }
      } catch (error) {
        console.error(`✗ Error al procesar doctor ${doctor.name}:`, error.message);
        skipped++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Resumen:');
    console.log(`   ✓ Usuarios creados: ${created}`);
    console.log(`   ✓ Usuarios actualizados: ${updated}`);
    console.log(`   ✗ Errores: ${skipped}`);
    console.log('='.repeat(60));
    
    console.log('\n📋 Credenciales de acceso (todos usan la misma contraseña por defecto):');
    console.log('   Password: medico123');
    console.log('   ⚠️  IMPORTANTE: Cada médico debe cambiar su contraseña después del primer inicio de sesión\n');
    
    console.log('👨‍⚕️  Usuarios creados/actualizados:');
    const allMedicos = await db.getAllUsers();
    const medicosUsers = allMedicos.filter(u => u.role === 'medico');
    
    medicosUsers.forEach((user, index) => {
      const doctor = doctors.find(d => {
        const expectedUsername = generateUsernameFromDoctorName(d.name);
        return user.username === expectedUsername;
      });
      
      if (doctor) {
        console.log(`   ${index + 1}. Username: ${user.username.padEnd(25)} | Doctor: ${doctor.name} (${doctor.specialty})`);
      } else {
        console.log(`   ${index + 1}. Username: ${user.username.padEnd(25)} | (Usuario médico genérico)`);
      }
    });
    
    console.log('\n✅ Proceso completado\n');
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error('Stack:', error.stack);
    if (error.code) {
      console.error('Código de error:', error.code);
    }
    process.exit(1);
  }
}

/**
 * Genera un username a partir del nombre del doctor
 * Ejemplo: "Dr. Juan Carlos Pérez" -> "medico_juan_perez"
 */
function generateUsernameFromDoctorName(doctorName) {
  // Remover títulos (Dr., Dra., etc.)
  let name = doctorName
    .replace(/^Dr\.?\s*/i, '')
    .replace(/^Dra\.?\s*/i, '')
    .trim();
  
  // Dividir en palabras
  const words = name.split(/\s+/);
  
  // Tomar primer nombre y primer apellido
  let username = 'medico_';
  
  if (words.length >= 1) {
    // Primer nombre (sin acentos y en minúsculas)
    const firstName = normalizeString(words[0]);
    username += firstName;
    
    if (words.length >= 2) {
      // Primer apellido
      const lastName = normalizeString(words[words.length - 1]); // Última palabra (apellido)
      username += '_' + lastName;
    }
  } else {
    // Si solo hay una palabra, usar esa
    username += normalizeString(name);
  }
  
  return username.toLowerCase();
}

/**
 * Normaliza un string removiendo acentos y caracteres especiales
 */
function normalizeString(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-zA-Z0-9]/g, '') // Remover caracteres especiales
    .toLowerCase();
}

createMedicosForDoctors();

