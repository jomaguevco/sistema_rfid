// Script para crear usuario médico usando el módulo de base de datos
const db = require('./database_medical');
const { hashPassword } = require('./utils/password');
require('dotenv').config();

async function createMedico() {
  try {
    // Buscar un doctor específico para asociar el usuario
    // Por defecto, usar el primer doctor de Medicina General o el primero disponible
    const doctors = await db.getAllDoctors({});
    let selectedDoctor = null;
    
    // Intentar encontrar un doctor de Medicina General primero
    selectedDoctor = doctors.find(d => d.specialty === 'Medicina General');
    
    // Si no hay de Medicina General, usar el primero disponible
    if (!selectedDoctor && doctors.length > 0) {
      selectedDoctor = doctors[0];
    }
    
    if (selectedDoctor) {
      console.log(`✓ Doctor seleccionado: ${selectedDoctor.name} (${selectedDoctor.specialty})`);
      console.log(`   Licencia: ${selectedDoctor.license_number}`);
      console.log(`   Email: ${selectedDoctor.email || 'N/A'}`);
    } else {
      console.log('⚠️  No se encontraron doctores en la base de datos');
      console.log('   El usuario médico se creará sin asociación específica');
    }

    // Verificar si ya existe
    const existingUsers = await db.getAllUsers();
    const existingMedico = existingUsers.find(u => u.username === 'medico');

    if (existingMedico) {
      console.log('\n✓ Usuario medico ya existe. Actualizando contraseña...');
      const password_hash = await hashPassword('medico123');
      
      // Actualizar usando query directo
      await db.pool.execute(
        'UPDATE users SET password_hash = ?, is_active = TRUE WHERE username = ?',
        [password_hash, 'medico']
      );
      console.log('✓ Contraseña del usuario medico actualizada');
    } else {
      console.log('\n✓ Creando usuario médico...');
      const password_hash = await hashPassword('medico123');
      
      // Usar el email del doctor si está disponible, sino usar uno genérico
      const email = selectedDoctor?.email || 'medico@sistema.com';
      
      await db.createUser({
        username: 'medico',
        email: email,
        password_hash: password_hash,
        role: 'medico'
      });
      console.log('✓ Usuario médico creado exitosamente');
    }
    
    console.log('\n📋 Credenciales del Usuario Médico:');
    console.log('   Username: medico');
    console.log('   Password: medico123');
    console.log('   Rol: medico');
    if (selectedDoctor) {
      console.log(`\n👨‍⚕️  Asociado al Doctor:`);
      console.log(`   Nombre: ${selectedDoctor.name}`);
      console.log(`   Especialidad: ${selectedDoctor.specialty}`);
      console.log(`   Licencia: ${selectedDoctor.license_number}`);
      console.log(`   ID Doctor: ${selectedDoctor.id}`);
      console.log(`\n   💡 Al crear recetas, puede usar:`);
      console.log(`      - doctor_name: "${selectedDoctor.name}"`);
      console.log(`      - doctor_id: ${selectedDoctor.id}`);
      console.log(`      - doctor_license: "${selectedDoctor.license_number}"`);
    }
    console.log('\n   ⚠️  IMPORTANTE: Cambia la contraseña después del primer inicio de sesión\n');
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error('Stack:', error.stack);
    if (error.code) {
      console.error('Código de error:', error.code);
    }
    process.exit(1);
  } finally {
    // Cerrar pool si es necesario
    if (db.pool && typeof db.pool.end === 'function') {
      // No cerrar el pool aquí porque puede estar siendo usado por el servidor
      // await db.pool.end();
    }
  }
}

createMedico();
