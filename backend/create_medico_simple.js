// Script para crear usuario médico usando el pool de conexiones existente
const db = require('./database_medical');
const { hashPassword } = require('./utils/password');
require('dotenv').config();

async function createMedico() {
  try {
    // Verificar si ya existe
    const existingUsers = await db.getAllUsers();
    const existingMedico = existingUsers.find(u => u.username === 'medico');
    
    if (existingMedico) {
      console.log('✓ Usuario medico ya existe. Actualizando contraseña...');
      const password_hash = await hashPassword('medico123');
      
      // Actualizar usando pool directamente
      await db.pool.execute(
        'UPDATE users SET password_hash = ?, is_active = TRUE WHERE username = ?',
        [password_hash, 'medico']
      );
      console.log('✓ Contraseña del usuario medico actualizada');
    } else {
      console.log('✓ Creando usuario médico...');
      const password_hash = await hashPassword('medico123');
      
      await db.createUser({
        username: 'medico',
        email: 'medico@sistema.com',
        password_hash: password_hash,
        role: 'medico'
      });
      console.log('✓ Usuario médico creado exitosamente');
    }
    
    console.log('\n📋 Credenciales:');
    console.log('   Username: medico');
    console.log('   Password: medico123');
    console.log('   Rol: medico');
    console.log('   ⚠️  IMPORTANTE: Cambia la contraseña después del primer inicio de sesión\n');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

createMedico();

